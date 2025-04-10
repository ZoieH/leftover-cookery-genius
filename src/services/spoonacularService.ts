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

export class SpoonacularError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'SpoonacularError';
  }
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
  if (!API_KEY) {
    throw new SpoonacularError(400, 'Spoonacular API key not configured');
  }

  if (!ingredients.length) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: API_KEY,
      ingredients: ingredients.join(','),
      number: '3',
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
      if (searchResponse.status === 402) {
        throw new SpoonacularError(402, 'API quota exceeded');
      }
      throw new SpoonacularError(searchResponse.status, `API error: ${searchResponse.statusText}`);
    }

    const searchResults: SpoonacularSearchResult[] = await searchResponse.json();
    
    // Get detailed information for each recipe
    const detailedRecipes = await Promise.all(
      searchResults.map(result => getSpoonacularRecipeById(result.id))
    );

    return detailedRecipes.filter((recipe): recipe is SpoonacularRecipe => recipe !== null);
  } catch (error) {
    if (error instanceof SpoonacularError) {
      throw error;
    }
    throw new SpoonacularError(500, `Failed to search recipes: ${error.message}`);
  }
}

export async function getSpoonacularRecipeById(id: string | number): Promise<SpoonacularRecipe | null> {
  if (!API_KEY) {
    throw new SpoonacularError(400, 'Spoonacular API key not configured');
  }

  try {
    const params = new URLSearchParams({
      apiKey: API_KEY
    });

    const response = await rateLimiter.add(() =>
      fetch(`${BASE_URL}/${id}/information?${params}`)
    );

    if (!response.ok) {
      if (response.status === 402) {
        throw new SpoonacularError(402, 'API quota exceeded');
      }
      throw new SpoonacularError(response.status, `API error: ${response.statusText}`);
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
    if (error instanceof SpoonacularError) {
      throw error;
    }
    throw new SpoonacularError(500, `Failed to get Spoonacular recipe details: ${error.message}`);
  }
} 