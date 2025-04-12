import recipesData from '@/data/recipes.json';
import { searchRecipes as searchFirebaseRecipes } from './firebaseService';
import { Recipe, RecipeSource, LocalRecipe, RecipeSearchParams, BaseRecipe } from '@/types/recipe';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebaseService';

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

// Save a recipe for a user
export const saveRecipe = async (userId: string, recipe: Recipe): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    // Create a simplified version of the recipe to save
    // Ensure no undefined values are included
    const savedRecipe = {
      id: recipe.id || '',
      title: recipe.title || '',
      description: recipe.description?.substring(0, 150) || '',
      image: recipe.image || '',
      // Ensure ingredients is always an array
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      // Make sure instructions are included - this is critical for viewing the recipe
      instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
      // Ensure dietaryTags is always an array
      dietaryTags: Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : [],
      prepTime: recipe.prepTime || '',
      cookTime: recipe.cookTime || '',
      servings: recipe.servings || 0,
      calories: recipe.calories || 0,
      source: recipe.source || 'LOCAL',
      savedAt: new Date().toISOString()
    };
    
    console.log('Saving recipe to Firestore:', savedRecipe);
    
    if (!userDoc.exists()) {
      // Create user document with saved recipes
      await setDoc(userDocRef, {
        uid: userId,
        savedRecipes: [savedRecipe],
        createdAt: new Date().toISOString()
      });
    } else {
      // Update existing user document, adding the recipe to savedRecipes array
      await updateDoc(userDocRef, {
        savedRecipes: arrayUnion(savedRecipe)
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving recipe:', error);
    return false;
  }
};

// Unsave a recipe for a user
export const unsaveRecipe = async (userId: string, recipeId: string): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists() || !userDoc.data().savedRecipes) {
      return false;
    }
    
    // Find the recipe to remove
    const savedRecipes = userDoc.data().savedRecipes;
    const recipeToRemove = savedRecipes.find((r: any) => r.id === recipeId);
    
    if (!recipeToRemove) {
      return false;
    }
    
    // Remove the recipe from the savedRecipes array
    await updateDoc(userDocRef, {
      savedRecipes: arrayRemove(recipeToRemove)
    });
    
    return true;
  } catch (error) {
    console.error('Error unsaving recipe:', error);
    return false;
  }
};

// Get all saved recipes for a user
export const getSavedRecipes = async (userId: string): Promise<Recipe[]> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('User document does not exist');
      return [];
    }
    
    if (!userDoc.data().savedRecipes) {
      console.log('User has no saved recipes');
      return [];
    }
    
    const savedRecipes = userDoc.data().savedRecipes;
    
    // Log the first recipe structure to help with debugging
    if (savedRecipes.length > 0) {
      console.log('First saved recipe structure:', savedRecipes[0]);
      
      // Check for important missing fields in all recipes
      const missingFields = savedRecipes.map((recipe: any, index: number) => {
        const missing: string[] = [];
        if (!recipe.instructions) missing.push('instructions');
        if (!recipe.ingredients) missing.push('ingredients');
        if (missing.length > 0) {
          return `Recipe ${index+1} (${recipe.title}) is missing: ${missing.join(', ')}`;
        }
        return null;
      }).filter(Boolean);
      
      if (missingFields.length > 0) {
        console.warn('Some recipes are missing critical fields:', missingFields);
      }
      
      // Enrich recipes with missing fields to ensure compatibility
      return savedRecipes.map((recipe: any) => {
        // Create a properly formed recipe object with all necessary fields
        const enrichedRecipe = {
          ...recipe,
          // For empty fields, provide default values
          instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
          prepTime: recipe.prepTime || '0 mins',
          cookTime: recipe.cookTime || '0 mins',
          servings: recipe.servings || 1,
          dietaryTags: Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : [],
          source: recipe.source || 'LOCAL'
        };
        
        // If the recipe has no instructions but has a title, try to add a generic instruction
        if (enrichedRecipe.instructions.length === 0 && recipe.title) {
          enrichedRecipe.instructions = [
            `This recipe for ${recipe.title} was saved without detailed instructions.`,
            `You can prepare it using the ingredients listed above.`
          ];
        }
        
        return enrichedRecipe;
      });
    }
    
    return savedRecipes;
  } catch (error) {
    console.error('Error getting saved recipes:', error);
    return [];
  }
};

// Check if a recipe is saved by a user
export const isRecipeSaved = async (userId: string, recipeId: string): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists() || !userDoc.data().savedRecipes) {
      return false;
    }
    
    const savedRecipes = userDoc.data().savedRecipes;
    return savedRecipes.some((recipe: any) => recipe.id === recipeId);
  } catch (error) {
    console.error('Error checking if recipe is saved:', error);
    return false;
  }
}; 