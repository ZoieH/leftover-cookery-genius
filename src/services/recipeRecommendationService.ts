import { Recipe } from '@/types/recipe';
import { searchSpoonacularRecipes } from './spoonacularService';
import { searchRecipes } from './recipeService';
import { calculateIngredientCoverage } from '../utils/recipeUtils';

export interface RecommendationOptions {
  threshold?: number;
  maxResults?: number;
  useLocalRecipes?: boolean;
  useSpoonacular?: boolean;
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
 * Recommends recipes based on available ingredients
 * @param ingredients List of ingredients the user has
 * @param dietaryFilter Optional dietary preference
 * @param options Additional options for the recommendation
 * @returns Promise with array of recommended recipes
 */
export const recommendRecipesFromIngredients = async (
  ingredients: string[],
  dietaryFilter?: string,
  options: RecommendationOptions = {}
): Promise<Recipe[]> => {
  const {
    threshold = 0.2,
    maxResults = 10,
    useLocalRecipes = true,
    useSpoonacular = false // Changed default to false due to API limits
  } = options;

  try {
    const allRecipes: Recipe[] = [];

    // Get local recipes if enabled
    if (useLocalRecipes) {
      const localRecipes = await searchRecipes({
        ingredients,
        dietaryPreference: dietaryFilter,
        maxResults: maxResults
      });
      allRecipes.push(...localRecipes);
    }

    // Try Spoonacular recipes if enabled, but handle failures gracefully
    if (useSpoonacular) {
      try {
        const spoonacularRecipes = await searchSpoonacularRecipes(ingredients, dietaryFilter);
        allRecipes.push(...spoonacularRecipes);
      } catch (error) {
        console.warn('Spoonacular API error, falling back to local recipes:', error);
        // Don't throw error, just continue with local recipes
      }
    }

    // If no recipes found at all, try local recipes as fallback even if not enabled
    if (allRecipes.length === 0 && !useLocalRecipes) {
      const fallbackRecipes = await searchRecipes({
        ingredients,
        dietaryPreference: dietaryFilter,
        maxResults: maxResults
      });
      allRecipes.push(...fallbackRecipes);
    }

    // Filter and sort all recipes
    const filteredRecipes = allRecipes
      .filter(recipe => {
        const coverage = calculateIngredientCoverage(recipe, ingredients);
        const hasAtLeastOneMatch = countMatchingIngredients(recipe, ingredients) > 0;
        return coverage >= threshold && hasAtLeastOneMatch;
      })
      .sort((a, b) => {
        const coverageA = calculateIngredientCoverage(a, ingredients);
        const coverageB = calculateIngredientCoverage(b, ingredients);
        return coverageB - coverageA;
      })
      .slice(0, maxResults);

    // If still no recipes found after filtering, lower the threshold and try again
    if (filteredRecipes.length === 0 && threshold > 0.1) {
      return recommendRecipesFromIngredients(ingredients, dietaryFilter, {
        ...options,
        threshold: threshold / 2
      });
    }

    return filteredRecipes;

  } catch (error) {
    console.error('Error recommending recipes:', error);
    return [];
  }
}; 