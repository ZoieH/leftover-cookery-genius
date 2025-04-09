import recipesData from '@/data/recipes.json';
import { searchRecipes as searchFirebaseRecipes } from './firebaseService';
import { Recipe, RecipeSource, LocalRecipe, RecipeSearchParams, BaseRecipe } from '@/types/recipe';

/**
 * Find recipes in our database that match the given ingredients and preferences
 */
export async function findMatchingRecipes(params: RecipeSearchParams): Promise<Recipe[]> {
  // First, try to find recipes in Firebase
  const firebaseRecipes = await searchFirebaseRecipes(params);
  
  // If we have enough Firebase recipes, return those
  if (firebaseRecipes.length >= (params.maxResults || 5)) {
    return firebaseRecipes;
  }
  
  // Otherwise, supplement with local recipes
  const localRecipes = searchLocalRecipes(params);
  return [...firebaseRecipes, ...localRecipes].slice(0, params.maxResults || 5);
}

/**
 * Search local recipes without using Firebase
 */
function searchLocalRecipes(params: RecipeSearchParams): Recipe[] {
  const { ingredients = [], dietaryPreference } = params;
  
  if (!ingredients.length) {
    return [];
  }

  return recipesData
    .map(convertToLocalRecipe)
    .filter(recipe => {
      // Filter by ingredients
      const matchedIngredients = ingredients.filter(ingredient =>
        recipe.ingredients.some(recipeIngredient =>
          recipeIngredient.toLowerCase().includes(ingredient.toLowerCase())
        )
      );
      
      // Must match at least one ingredient
      if (matchedIngredients.length === 0) {
        return false;
      }
      
      // Filter by dietary preference if specified
      if (dietaryPreference && !recipe.dietaryTags.includes(dietaryPreference)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by number of matching ingredients (descending)
      const aMatches = ingredients.filter(ingredient =>
        a.ingredients.some(recipeIngredient =>
          recipeIngredient.toLowerCase().includes(ingredient.toLowerCase())
        )
      ).length;
      
      const bMatches = ingredients.filter(ingredient =>
        b.ingredients.some(recipeIngredient =>
          recipeIngredient.toLowerCase().includes(ingredient.toLowerCase())
        )
      ).length;
      
      return bMatches - aMatches;
    });
}

/**
 * Scrape recipes from popular recipe websites based on the given ingredients
 * Note: This is a placeholder. In a real implementation, you'd need to handle
 * CORS, rate limiting, and potentially use a backend service.
 */
async function scrapeRecipesFromWeb(params: RecipeSearchParams): Promise<Recipe[]> {
  // In a real implementation, you would:
  // 1. Make fetch requests to recipe sites or APIs
  // 2. Parse the HTML responses to extract recipe data
  // 3. Convert the scraped data to match our Recipe interface
  
  // For now, we'll return an empty array to indicate no scraped results
  // This function would be implemented when you're ready to add actual scraping
  
  console.log('Web scraping for recipes would be implemented here');
  return [];
  
  // Example implementation sketch (not functional):
  /*
  const ingredients = params.ingredients.join(',');
  
  try {
    // This would need to be a backend endpoint that handles the scraping
    const response = await fetch(`/api/scrape-recipes?ingredients=${ingredients}`);
    const data = await response.json();
    
    // Map the scraped data to our Recipe interface
    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      ingredients: item.ingredients,
      image: item.image || '/placeholder.svg',
      prepTime: item.prepTime || 'unknown',
      cookTime: item.cookTime || 'unknown',
      servings: item.servings || 4,
      calories: item.calories || 0,
      dietaryTags: item.dietaryTags || [],
      instructions: item.instructions || []
    }));
  } catch (error) {
    console.error('Error scraping recipes:', error);
    return [];
  }
  */
}

interface RawRecipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  image?: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  dietaryTags: string[];
  instructions: string[];
}

// Convert raw recipe data to LocalRecipe type
function convertToLocalRecipe(rawRecipe: RawRecipe): LocalRecipe {
  return {
    ...rawRecipe,
    source: RecipeSource.LOCAL,
    dietaryTags: rawRecipe.dietaryTags || []
  };
}

export async function getAllRecipes(): Promise<LocalRecipe[]> {
  try {
    return recipesData as LocalRecipe[];
  } catch (error) {
    console.error('Error getting all recipes:', error);
    return [];
  }
}

export async function getRecipeById(id: string): Promise<LocalRecipe | undefined> {
  try {
    const recipes = await getAllRecipes();
    return recipes.find(recipe => recipe.id === id);
  } catch (error) {
    console.error('Error getting recipe by ID:', error);
    return undefined;
  }
}

export async function searchRecipes(params: RecipeSearchParams): Promise<LocalRecipe[]> {
  try {
    const recipes = await getAllRecipes();
    
    return recipes.filter(recipe => {
      // Apply dietary filter if specified
      if (params.dietaryPreference && !recipe.dietaryTags.includes(params.dietaryPreference)) {
        return false;
      }
      
      // Apply ingredient filter if specified
      if (params.ingredients && params.ingredients.length > 0) {
        const hasMatchingIngredients = recipe.ingredients.some(recipeIng =>
          params.ingredients.some(userIng =>
            recipeIng.toLowerCase().includes(userIng.toLowerCase())
          )
        );
        if (!hasMatchingIngredients) return false;
      }
      
      return true;
    });
  } catch (error) {
    console.error('Error searching recipes:', error);
    return [];
  }
} 