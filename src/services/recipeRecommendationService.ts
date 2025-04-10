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
    threshold = 0.05,
    maxResults = 10
  } = options;

  try {
    // Layer 1: Search our own database
    const localRecipes = await searchRecipes({
      ingredients,
      dietaryPreference: dietaryFilter,
      maxResults: maxResults
    });

    // Filter and sort local recipes
    const filteredLocalRecipes = localRecipes
      .filter(recipe => {
        const coverage = calculateIngredientCoverage(recipe, ingredients);
        const hasAtLeastOneMatch = countMatchingIngredients(recipe, ingredients) > 0;
        return coverage >= threshold && hasAtLeastOneMatch;
      })
      .sort((a, b) => {
        const coverageA = calculateIngredientCoverage(a, ingredients);
        const coverageB = calculateIngredientCoverage(b, ingredients);
        return coverageB - coverageA;
      });

    if (filteredLocalRecipes.length > 0) {
      return filteredLocalRecipes.slice(0, maxResults);
    }

    // Layer 2: Try Spoonacular API
    try {
      console.log('🔍 [RECIPE-SERVICE] Attempting to fetch recipes from Spoonacular...');
      const spoonacularRecipes = await searchSpoonacularRecipes(ingredients, dietaryFilter);
      console.log('📊 [RECIPE-SERVICE] Spoonacular recipes received:', spoonacularRecipes.length);
      
      // For Spoonacular recipes, we'll be more lenient with filtering
      const filteredSpoonacularRecipes = spoonacularRecipes
        .filter(recipe => {
          const coverage = calculateIngredientCoverage(recipe, ingredients);
          const hasAtLeastOneMatch = countMatchingIngredients(recipe, ingredients) > 0;
          // More lenient threshold for Spoonacular recipes
          return coverage >= 0.05 && hasAtLeastOneMatch;
        })
        .sort((a, b) => {
          const coverageA = calculateIngredientCoverage(a, ingredients);
          const coverageB = calculateIngredientCoverage(b, ingredients);
          return coverageB - coverageA;
        });

      console.log('📊 [RECIPE-SERVICE] Filtered Spoonacular recipes:', filteredSpoonacularRecipes.length);

      if (filteredSpoonacularRecipes.length > 0) {
        return filteredSpoonacularRecipes.slice(0, maxResults);
      }
      console.log('⚠️ [RECIPE-SERVICE] No matching Spoonacular recipes found, trying ChatGPT...');
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