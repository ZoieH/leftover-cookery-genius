import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where, updateDoc } from 'firebase/firestore';
import type { LocalRecipe, RecipeSearchParams, Recipe } from '@/types/recipe';
import { RecipeSource } from '@/types/recipe';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { create } from 'zustand';

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
export const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Collection references
const recipesCollection = collection(db, 'recipes');
const usersCollection = collection(db, 'users');

// Email link authentication settings
const actionCodeSettings = {
  // URL you want to redirect back to. The domain (www.example.com) for this
  // URL must be in the authorized domains list in the Firebase Console.
  url: window.location.origin + '/auth/email-link',
  // This must be true.
  handleCodeInApp: true,
};

// Auth store
interface AuthStore {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading })
}));

// Auth state observer
onAuthStateChanged(auth, (user) => {
  useAuthStore.getState().setUser(user);
  useAuthStore.getState().setLoading(false);
});

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
 * Add a recipe to Firestore
 */
export async function addRecipe(recipe: Omit<Recipe, 'id'>): Promise<string> {
  try {
    // Convert to LocalRecipe format
    const localRecipe: Omit<LocalRecipe, 'id'> = {
      ...recipe,
      source: RecipeSource.LOCAL
    };

    const docRef = await addDoc(recipesCollection, localRecipe);
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
        'lactose-free': ['lactose-free', 'dairy-free'],
        'high-protein': ['high-protein', 'protein-rich'],
        'low-carb': ['low-carb'],
        'kosher': ['kosher'],
        'halal': ['halal'],
        'atlantic': ['atlantic'],
        'keto': ['keto', 'ketogenic']
      };
      
      const validTags = tagMap[params.dietaryPreference] || [];
      return recipe.dietaryTags.some(tag => validTags.includes(tag));
    });
  }
  
  return matchingRecipes;
}

// Auth methods
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Email link authentication methods
export const sendSignInLink = async (email: string) => {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Save the email for later use
    window.localStorage.setItem('emailForSignIn', email);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

export const completeSignInWithEmailLink = async () => {
  try {
    // Get the saved email from localStorage
    const email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      return { 
        user: null, 
        error: 'No email found. Please try signing in again.' 
      };
    }

    // Check if the link is a sign-in with email link
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      return { 
        user: null, 
        error: 'Invalid sign-in link.' 
      };
    }

    // Sign in the user
    const result = await signInWithEmailLink(auth, email, window.location.href);
    
    // Clear the email from storage
    window.localStorage.removeItem('emailForSignIn');
    
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Helper functions
export const getCurrentUser = () => auth.currentUser;

export const isUserPremium = async (user: User | null): Promise<boolean> => {
  if (!user) return false;
  
  try {
    // Query the users collection for the current user's premium status
    const userQuery = query(usersCollection, where('uid', '==', user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      // If no document exists, create one with default premium status
      await addDoc(usersCollection, {
        uid: user.uid,
        email: user.email,
        isPremium: false,
        createdAt: new Date().toISOString()
      });
      return false;
    }
    
    // Get the first document (there should only be one per user)
    const userDoc = querySnapshot.docs[0];
    return userDoc.data().isPremium || false;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
};

export const upgradeToPremium = async (user: User | null): Promise<{ success: boolean; error?: string }> => {
  if (!user) {
    return { success: false, error: 'No user logged in' };
  }

  try {
    // Query the users collection for the current user
    const userQuery = query(usersCollection, where('uid', '==', user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      // Create new user document with premium status
      await addDoc(usersCollection, {
        uid: user.uid,
        email: user.email,
        isPremium: true,
        premiumSince: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    } else {
      // Update existing user document
      const userDoc = querySnapshot.docs[0];
      await updateDoc(userDoc.ref, {
        isPremium: true,
        premiumSince: new Date().toISOString()
      });
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error upgrading to premium:', error);
    return { success: false, error: error.message };
  }
}; 