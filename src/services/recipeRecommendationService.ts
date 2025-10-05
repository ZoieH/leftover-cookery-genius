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
 * 1. First tries Spoonacular API (high-quality recipes with images)
 * 2. If insufficient results, tries ChatGPT (AI-generated recipes)
 * 3. If still insufficient, falls back to local database (last resort)
 * 
 * Returns a maximum of 3 recipes total, combined from all sources.
 */
export const recommendRecipesFromIngredients = async (
  ingredients: string[],
  dietaryFilter?: string,
  options: RecommendationOptions = {}
): Promise<Recipe[]> => {
  const {
    maxResults = 3
  } = options;

  // Track how many recipes we've collected so far
  let collectedRecipes: Recipe[] = [];
  let remainingCount = maxResults;

  try {
    // Layer 1: Try Spoonacular API first (high-quality recipes with images)
    try {
      console.log('🔍 [RECIPE-SERVICE] Attempting to fetch recipes from Spoonacular...');
      const spoonacularRecipes = await searchSpoonacularRecipes(ingredients, dietaryFilter);
      console.log('📊 [RECIPE-SERVICE] Spoonacular recipes received:', spoonacularRecipes.length);
      
      // Sort Spoonacular recipes by coverage
      const sortedSpoonacularRecipes = spoonacularRecipes
        .sort((a, b) => {
          const coverageA = calculateIngredientCoverage(a, ingredients);
          const coverageB = calculateIngredientCoverage(b, ingredients);
          return coverageB - coverageA;
        });

      // Add Spoonacular recipes to our collection
      collectedRecipes = [...collectedRecipes, ...sortedSpoonacularRecipes.slice(0, remainingCount)];
      const spoonacularRecipesAdded = Math.min(sortedSpoonacularRecipes.length, remainingCount);
      remainingCount = maxResults - collectedRecipes.length;

      console.log(`📊 [RECIPE-SERVICE] Spoonacular recipes added: ${spoonacularRecipesAdded}, remaining slots: ${remainingCount}`);

      // If we've reached our max, return early
      if (remainingCount <= 0) {
        return collectedRecipes;
      }
    } catch (error) {
      console.warn('Spoonacular API error:', error);
      console.log('Spoonacular API failed, trying ChatGPT...');
    }

    // Layer 2: Try ChatGPT (AI-generated recipes)
    if (remainingCount > 0) {
      try {
        console.log('🤖 [RECIPE-SERVICE] Attempting to generate recipe with ChatGPT...');
        const aiRecipe = await generateRecipeWithOpenAI(ingredients, dietaryFilter);
        if (aiRecipe) {
          console.log('✅ [RECIPE-SERVICE] Successfully generated recipe with ChatGPT');
          collectedRecipes = [...collectedRecipes, aiRecipe];
          remainingCount = maxResults - collectedRecipes.length;
        } else {
          console.log('⚠️ [RECIPE-SERVICE] ChatGPT failed to generate a recipe');
        }
      } catch (error) {
        console.error('❌ [RECIPE-SERVICE] Error generating recipe with ChatGPT:', error);
      }
    }

    // Layer 3: Fall back to local database (last resort)
    if (remainingCount > 0) {
      try {
        console.log('📚 [RECIPE-SERVICE] Falling back to local database...');
        const localRecipes = await searchRecipes({
          ingredients,
          dietaryPreference: dietaryFilter,
          maxResults: remainingCount
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
        const localRecipesAdded = Math.min(sortedLocalRecipes.length, remainingCount);
        remainingCount = maxResults - collectedRecipes.length;

        console.log(`�� [RECIPE-SERVICE] Local recipes added: ${localRecipesAdded}, remaining slots: ${remainingCount}`);
      } catch (error) {
        console.error('❌ [RECIPE-SERVICE] Error searching local recipes:', error);
      }
    }

    // Return all collected recipes (max of maxResults)
    console.log(`📊 [RECIPE-SERVICE] Total recipes collected: ${collectedRecipes.length}`);
    return collectedRecipes;

  } catch (error) {
    console.error('❌ [RECIPE-SERVICE] Error recommending recipes:', error);
    return collectedRecipes.length > 0 ? collectedRecipes : []; // Return what we have, even if there was an error
  }
};
