import { addRecipe } from '../services/firebaseService';
import type { Recipe } from '../services/recipeService';

/**
 * Convert external recipe JSON format to our app's format
 * @param externalRecipe The external recipe JSON data
 * @returns Recipe data in our app's format
 */
export function convertExternalRecipeFormat(externalRecipe: any): Omit<Recipe, 'id'> {
  // Extract ingredients as simple strings
  const ingredients = Array.isArray(externalRecipe.ingredients) 
    ? externalRecipe.ingredients.map((ingredient: string) => ingredient)
    : [];

  // Extract instructions as simple strings
  const instructions = Array.isArray(externalRecipe.instructions)
    ? externalRecipe.instructions.map((instruction: any) => {
        // Handle both string and object formats for instructions
        if (typeof instruction === 'string') {
          return instruction;
        } else if (instruction && instruction.step) {
          return instruction.step;
        }
        return '';
      }).filter(Boolean)
    : [];

  // Extract cooking times
  const prepTime = externalRecipe.prep_time || externalRecipe.prepTime || '';
  const cookTime = externalRecipe.cook_time || externalRecipe.cookTime || '';
  
  // Extract servings
  const servings = typeof externalRecipe.servings === 'number' 
    ? externalRecipe.servings 
    : (parseInt(externalRecipe.servings) || 4);
  
  // Extract image URL
  const image = externalRecipe.image_url || externalRecipe.imageUrl || externalRecipe.image || '';

  // Convert to our app's format
  return {
    title: externalRecipe.title || 'Untitled Recipe',
    description: externalRecipe.description || '',
    ingredients,
    image,
    prepTime,
    cookTime,
    servings,
    calories: 0, // Default if not provided
    dietaryTags: [], // Default if not provided
    instructions,
  };
}

/**
 * Import external recipe JSON and save it to Firebase
 * @param recipeJson The external recipe JSON data
 * @returns Promise with the ID of the newly added recipe
 */
export async function importExternalRecipeToFirebase(recipeJson: any): Promise<string> {
  // Convert to our app's format
  const convertedRecipe = convertExternalRecipeFormat(recipeJson);
  
  // Save to Firebase
  return await addRecipe(convertedRecipe);
}

/**
 * Process and import a raw JSON string into Firebase
 * @param jsonString Raw JSON string containing recipe data
 * @returns Object with success status and recipe ID or error message
 */
export async function processAndImportJsonRecipe(jsonString: string): Promise<{
  success: boolean;
  recipeId?: string;
  error?: string;
}> {
  try {
    // Parse the JSON string
    const recipeData = JSON.parse(jsonString);
    
    // Import to Firebase
    const recipeId = await importExternalRecipeToFirebase(recipeData);
    
    return {
      success: true,
      recipeId
    };
  } catch (error) {
    console.error('Error importing recipe JSON:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 