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
    useSpoonacular = true
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

    // Get Spoonacular recipes if enabled
    if (useSpoonacular) {
      const spoonacularRecipes = await searchSpoonacularRecipes(ingredients, dietaryFilter);
      allRecipes.push(...spoonacularRecipes);
    }

    // Filter and sort all recipes
    return allRecipes
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

  } catch (error) {
    console.error('Error recommending recipes:', error);
    return [];
  }
}; 