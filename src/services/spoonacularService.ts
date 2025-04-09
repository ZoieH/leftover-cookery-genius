import { Recipe, RecipeSource, SpoonacularRecipe } from '@/types/recipe';

const API_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY;
const BASE_URL = 'https://api.spoonacular.com/recipes';

interface SpoonacularSearchResult {
  id: number;
  title: string;
  image: string;
  missedIngredientCount: number;
  usedIngredientCount: number;
  likes: number;
}

interface SpoonacularRecipeDetail {
  id: number;
  title: string;
  summary: string;
  image: string;
  sourceUrl: string;
  sourceName: string;
  readyInMinutes: number;
  servings: number;
  diets: string[];
  extendedIngredients: Array<{
    original: string;
  }>;
  analyzedInstructions: Array<{
    steps: Array<{
      step: string;
    }>;
  }>;
}

class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minDelay: number;

  constructor(requestsPerMinute: number) {
    this.minDelay = (60 * 1000) / requestsPerMinute;
  }

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const now = Date.now();
    const delay = Math.max(0, this.minDelay - (now - this.lastRequestTime));
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const request = this.queue.shift();
    if (request) {
      this.lastRequestTime = Date.now();
      await request();
    }

    this.processQueue();
  }
}

const rateLimiter = new RateLimiter(Number(import.meta.env.VITE_API_RATE_LIMIT) || 50);

export async function searchSpoonacularRecipes(
  ingredients: string[],
  dietaryPreference?: string
): Promise<Recipe[]> {
  try {
    const params = new URLSearchParams({
      apiKey: API_KEY,
      ingredients: ingredients.join(','),
      number: '5',
      ranking: '2', // Maximize used ingredients
      ignorePantry: 'true'
    });

    if (dietaryPreference) {
      params.append('diet', dietaryPreference.toLowerCase());
    }

    const searchResponse = await rateLimiter.add(() =>
      fetch(`${BASE_URL}/findByIngredients?${params}`)
    );

    if (!searchResponse.ok) {
      throw new Error(`Spoonacular API error: ${searchResponse.statusText}`);
    }

    const searchResults: SpoonacularSearchResult[] = await searchResponse.json();
    
    // Get detailed information for each recipe
    const detailedRecipes = await Promise.all(
      searchResults.map(result => getSpoonacularRecipeById(result.id))
    );

    return detailedRecipes.filter((recipe): recipe is SpoonacularRecipe => recipe !== null);
  } catch (error) {
    console.error('Error searching Spoonacular recipes:', error);
    return [];
  }
}

export async function getSpoonacularRecipeById(id: string | number): Promise<SpoonacularRecipe | null> {
  try {
    const params = new URLSearchParams({
      apiKey: API_KEY
    });

    const response = await rateLimiter.add(() =>
      fetch(`${BASE_URL}/${id}/information?${params}`)
    );

    if (!response.ok) {
      throw new Error(`Spoonacular API error: ${response.statusText}`);
    }

    const data: SpoonacularRecipeDetail = await response.json();

    return {
      id: String(data.id),
      spoonacularId: data.id,
      title: data.title,
      description: data.summary.replace(/<[^>]*>/g, ''), // Remove HTML tags
      image: data.image,
      sourceUrl: data.sourceUrl,
      sourceName: data.sourceName,
      prepTime: `${Math.floor(data.readyInMinutes / 2)}min`,
      cookTime: `${Math.ceil(data.readyInMinutes / 2)}min`,
      servings: data.servings,
      ingredients: data.extendedIngredients.map(ing => ing.original),
      instructions: data.analyzedInstructions[0]?.steps.map(step => step.step) || [],
      dietaryTags: data.diets,
      source: RecipeSource.SPOONACULAR
    };
  } catch (error) {
    console.error('Error getting Spoonacular recipe details:', error);
    return null;
  }
} 