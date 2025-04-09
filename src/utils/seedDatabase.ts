import recipesData from '@/data/recipes.json';
import { addRecipe } from '@/services/firebaseService';
import type { Recipe } from '@/services/recipeService';

/**
 * Seeds the Firebase database with recipes from our local data
 * This should only be run once, or it will create duplicate recipes
 */
export async function seedFirebaseDatabase(): Promise<void> {
  try {
    console.log('Starting to seed database...');
    const recipes = recipesData as Recipe[];
    
    for (const recipe of recipes) {
      // Remove the id since Firestore will generate one
      const { id, ...recipeData } = recipe;
      
      await addRecipe(recipeData);
      console.log(`Added recipe: ${recipe.title}`);
    }
    
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

/**
 * Seeds a single recipe for testing
 */
export async function seedSingleRecipe(recipe: Recipe): Promise<string> {
  try {
    // Remove the id since Firestore will generate one
    const { id, ...recipeData } = recipe;
    
    const newId = await addRecipe(recipeData);
    console.log(`Added recipe: ${recipe.title} with ID: ${newId}`);
    return newId;
  } catch (error) {
    console.error('Error seeding recipe:', error);
    throw error;
  }
} 