import { Recipe } from '@/types/recipe';
import { searchSpoonacularRecipes } from './spoonacularService';
import { searchRecipes } from './recipeService';
import { generateRecipeWithOpenAI } from './openaiService';
import { calculateIngredientCoverage } from '../utils/recipeUtils';

export interface RecommendationOptions {
  threshold?: number;
  maxResults?: number;
}

/**
 * Count how many ingredients from the recipe match the user's ingredients
 */
function countMatchingIngredients(recipe: Recipe, userIngredients: string[]): number {
  const normalizedUserIngredients = userIngredients.map(ing => ing.toLowerCase().trim());
  
  return recipe.ingredients.filter(recipeIng => {
    const normalizedRecipeIng = recipeIng.toLowerCase().trim();
    return normalizedUserIngredients.some(userIng => 
      normalizedRecipeIng.includes(userIng) || userIng.includes(normalizedRecipeIng)
    );
  }).length;
}

/**
 * Recommends recipes based on available ingredients using a three-layer approach:
 * 1. First searches our own database
 * 2. If no matches, tries Spoonacular API
 * 3. If still no matches, generates a recipe using OpenAI
 */
export const recommendRecipesFromIngredients = async (
  ingredients: string[],
  dietaryFilter?: string,
  options: RecommendationOptions = {}
): Promise<Recipe[]> => {
  const {
    maxResults = 10
  } = options;

  try {
    // Layer 1: Search our own database
    const localRecipes = await searchRecipes({
      ingredients,
      dietaryPreference: dietaryFilter,
      maxResults: maxResults
    });

    // Sort local recipes by coverage
    const sortedLocalRecipes = localRecipes
      .sort((a, b) => {
        const coverageA = calculateIngredientCoverage(a, ingredients);
        const coverageB = calculateIngredientCoverage(b, ingredients);
        return coverageB - coverageA;
      });

    if (sortedLocalRecipes.length > 0) {
      return sortedLocalRecipes.slice(0, maxResults);
    }

    // Layer 2: Try Spoonacular API
    try {
      console.log('🔍 [RECIPE-SERVICE] Attempting to fetch recipes from Spoonacular...');
      const spoonacularRecipes = await searchSpoonacularRecipes(ingredients, dietaryFilter);
      console.log('📊 [RECIPE-SERVICE] Spoonacular recipes received:', spoonacularRecipes.length);
      
      // Sort Spoonacular recipes by coverage without filtering
      const sortedSpoonacularRecipes = spoonacularRecipes
        .sort((a, b) => {
          const coverageA = calculateIngredientCoverage(a, ingredients);
          const coverageB = calculateIngredientCoverage(b, ingredients);
          return coverageB - coverageA;
        });

      console.log('📊 [RECIPE-SERVICE] Sorted Spoonacular recipes:', sortedSpoonacularRecipes.length);

      if (sortedSpoonacularRecipes.length > 0) {
        return sortedSpoonacularRecipes.slice(0, maxResults);
      }
      console.log('⚠️ [RECIPE-SERVICE] No Spoonacular recipes found, trying ChatGPT...');
    } catch (error) {
      console.warn('Spoonacular API error:', error);
      console.log('Spoonacular API failed, falling back to ChatGPT...');
    }

    // Layer 3: Generate recipe using OpenAI
    try {
      console.log('Attempting to generate recipe with ChatGPT...');
      const aiRecipe = await generateRecipeWithOpenAI(ingredients, dietaryFilter);
      if (aiRecipe) {
        console.log('Successfully generated recipe with ChatGPT');
        return [aiRecipe];
      }
      console.error('ChatGPT failed to generate a recipe');
    } catch (error) {
      console.error('Error generating recipe with ChatGPT:', error);
    }

    // If all layers fail, return empty array
    console.log('All recipe sources failed, returning empty array');
    return [];

  } catch (error) {
    console.error('Error recommending recipes:', error);
    return [];
  }
}; 