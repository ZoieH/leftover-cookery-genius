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
    console.error('Spoonacular API key not found:', import.meta.env);
    throw new SpoonacularError(400, 'Spoonacular API key not configured');
  }

  if (!ingredients.length) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: API_KEY,
      ingredients: ingredients.join(','),
      number: '3', // Reduced from 5 to 3 to save API points
      ranking: '2', // Maximize used ingredients
      ignorePantry: 'true'
    });

    if (dietaryPreference) {
      params.append('diet', dietaryPreference.toLowerCase());
    }

    console.log('Searching Spoonacular with ingredients:', ingredients);
    const searchResponse = await rateLimiter.add(() =>
      fetch(`${BASE_URL}/findByIngredients?${params}`)
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Spoonacular API error response:', {
        status: searchResponse.status,
        statusText: searchResponse.statusText,
        errorText
      });
      
      if (searchResponse.status === 402) {
        throw new SpoonacularError(402, 'API quota exceeded');
      }
      throw new SpoonacularError(searchResponse.status, `API error: ${searchResponse.statusText} - ${errorText}`);
    }

    const searchResults: SpoonacularSearchResult[] = await searchResponse.json();
    console.log('Spoonacular search results:', searchResults);
    
    // Get detailed information for each recipe
    const detailedRecipes = await Promise.all(
      searchResults.map(result => getSpoonacularRecipeById(result.id))
    );

    const validRecipes = detailedRecipes.filter((recipe): recipe is SpoonacularRecipe => recipe !== null);
    console.log('Valid recipes found:', validRecipes.length);
    
    return validRecipes;
  } catch (error) {
    console.error('Spoonacular search error:', error);
    if (error instanceof SpoonacularError) {
      throw error;
    }
    throw new SpoonacularError(500, `Failed to search recipes: ${error.message}`);
  }
}

export async function getSpoonacularRecipeById(id: string | number): Promise<SpoonacularRecipe | null> {
  if (!API_KEY) {
    console.error('Spoonacular API key not found in recipe detail fetch');
    throw new SpoonacularError(400, 'Spoonacular API key not configured');
  }

  try {
    const params = new URLSearchParams({
      apiKey: API_KEY
    });

    console.log('Fetching recipe details for ID:', id);
    const response = await rateLimiter.add(() =>
      fetch(`${BASE_URL}/${id}/information?${params}`)
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Recipe detail fetch error:', {
        id,
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      
      if (response.status === 402) {
        throw new SpoonacularError(402, 'API quota exceeded');
      }
      throw new SpoonacularError(response.status, `API error: ${response.statusText} - ${errorText}`);
    }

    const data: SpoonacularRecipeDetail = await response.json();
    console.log('Recipe details received for ID:', id);

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
    console.error('Recipe detail error:', error);
    if (error instanceof SpoonacularError) {
      throw error;
    }
    throw new SpoonacularError(500, `Failed to get Spoonacular recipe details: ${error.message}`);
  }
} 