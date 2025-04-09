import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import type { LocalRecipe, RecipeSearchParams } from '@/types/recipe';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection reference
const recipesCollection = collection(db, 'recipes');

/**
 * Get all recipes from Firestore
 */
export async function getAllRecipes(): Promise<LocalRecipe[]> {
  try {
    const querySnapshot = await getDocs(recipesCollection);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        ingredients: data.ingredients,
        image: data.image,
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        servings: data.servings,
        dietaryTags: data.dietaryTags || [],
        instructions: data.instructions,
        source: 'LOCAL' as const
      } as LocalRecipe;
    });
  } catch (error) {
    console.error('Error getting recipes:', error);
    throw error;
  }
}

/**
 * Add a new recipe to Firestore
 */
export async function addRecipe(recipe: Omit<LocalRecipe, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(recipesCollection, recipe);
    return docRef.id;
  } catch (error) {
    console.error('Error adding recipe:', error);
    throw error;
  }
}

/**
 * Search for recipes based on ingredients
 * Note: This is a simple implementation - Firestore doesn't support complex array filtering well
 * For production, you might want to use Algolia or a similar service for better search
 */
export async function searchRecipes(params: RecipeSearchParams): Promise<LocalRecipe[]> {
  // For now, we'll get all recipes and filter client-side
  // In production, consider a more scalable approach
  const allRecipes = await getAllRecipes();
  
  // Normalize ingredient names for comparison
  const normalizedIngredients = params.ingredients.map(ing => ing.toLowerCase().trim());
  
  // Filter recipes based on ingredients
  let matchingRecipes = allRecipes.filter(recipe => {
    // Count how many ingredients from the recipe match the user's ingredients
    const matchCount = recipe.ingredients.filter(recipeIng => {
      // Check if any of the user's ingredients contain this recipe ingredient
      return normalizedIngredients.some(userIng => 
        userIng.includes(recipeIng) || recipeIng.includes(userIng)
      );
    }).length;
    
    // Require that at least 2 ingredients match or 30% of the recipe's ingredients
    const minMatchCount = Math.max(2, Math.ceil(recipe.ingredients.length * 0.3));
    return matchCount >= minMatchCount;
  });
  
  // Apply dietary preference filter if specified
  if (params.dietaryPreference && params.dietaryPreference !== 'none') {
    matchingRecipes = matchingRecipes.filter(recipe => {
      // Map the UI dietary preference values to the tags used in our data
      const tagMap: Record<string, string[]> = {
        'vegetarian': ['vegetarian'],
        'vegan': ['vegan'],
        'gluten-free': ['gluten-free'],
        'low-carb': ['low-carb', 'keto']
      };
      
      const validTags = tagMap[params.dietaryPreference] || [];
      return recipe.dietaryTags.some(tag => validTags.includes(tag));
    });
  }
  
  return matchingRecipes;
} 