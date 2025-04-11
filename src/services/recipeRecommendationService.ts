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
 * 
 * Returns a maximum of 3 recipes total, combined from all sources.
 */
export const recommendRecipesFromIngredients = async (
  ingredients: string[],
  dietaryFilter?: string,
  options: RecommendationOptions = {}
): Promise<Recipe[]> => {
  const {
    maxResults = 3 // Changed default to 3
  } = options;

  // Track how many recipes we've collected so far
  let collectedRecipes: Recipe[] = [];
  let remainingCount = maxResults;

  try {
    // Layer 1: Search our own database
    const localRecipes = await searchRecipes({
      ingredients,
      dietaryPreference: dietaryFilter,
      maxResults: remainingCount // Only request what we still need
    });

    // Sort local recipes by coverage
    const sortedLocalRecipes = localRecipes
      .sort((a, b) => {
        const coverageA = calculateIngredientCoverage(a, ingredients);
        const coverageB = calculateIngredientCoverage(b, ingredients);
        return coverageB - coverageA;
      });

    // Add local recipes to our collection
    collectedRecipes = [...collectedRecipes, ...sortedLocalRecipes.slice(0, remainingCount)];
    remainingCount = maxResults - collectedRecipes.length;

    console.log(`📊 [RECIPE-SERVICE] Local recipes added: ${sortedLocalRecipes.length > 0 ? sortedLocalRecipes.slice(0, remainingCount + sortedLocalRecipes.length).length : 0}, remaining slots: ${remainingCount}`);
    
    // If we've reached our max, return early
    if (remainingCount <= 0) {
      return collectedRecipes;
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

      // Add Spoonacular recipes to our collection, but only up to remaining count
      collectedRecipes = [...collectedRecipes, ...sortedSpoonacularRecipes.slice(0, remainingCount)];
      remainingCount = maxResults - collectedRecipes.length;

      console.log(`📊 [RECIPE-SERVICE] Spoonacular recipes added: ${sortedSpoonacularRecipes.length > 0 ? sortedSpoonacularRecipes.slice(0, remainingCount + sortedSpoonacularRecipes.length).length : 0}, remaining slots: ${remainingCount}`);

      // If we've reached our max, return early
      if (remainingCount <= 0) {
        return collectedRecipes;
      }

      // If we had no Spoonacular recipes, log it
      if (sortedSpoonacularRecipes.length === 0) {
        console.log('⚠️ [RECIPE-SERVICE] No Spoonacular recipes found, trying ChatGPT...');
      }
    } catch (error) {
      console.warn('Spoonacular API error:', error);
      console.log('Spoonacular API failed, falling back to ChatGPT...');
    }

    // Layer 3: Generate recipe using OpenAI (only if we still need more recipes)
    if (remainingCount > 0) {
      try {
        console.log('Attempting to generate recipe with ChatGPT...');
        const aiRecipe = await generateRecipeWithOpenAI(ingredients, dietaryFilter);
        if (aiRecipe) {
          console.log('Successfully generated recipe with ChatGPT');
          collectedRecipes = [...collectedRecipes, aiRecipe];
          // No need to update remainingCount since we're done after this
        } else {
          console.error('ChatGPT failed to generate a recipe');
        }
      } catch (error) {
        console.error('Error generating recipe with ChatGPT:', error);
      }
    }

    // Return all collected recipes (max of maxResults)
    console.log(`📊 [RECIPE-SERVICE] Total recipes collected: ${collectedRecipes.length}`);
    return collectedRecipes;

  } catch (error) {
    console.error('Error recommending recipes:', error);
    return collectedRecipes.length > 0 ? collectedRecipes : []; // Return what we have, even if there was an error
  }
}; 