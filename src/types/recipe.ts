export enum RecipeSource {
  LOCAL = 'LOCAL',
  SPOONACULAR = 'SPOONACULAR'
}

export interface BaseRecipe {
  id: string;
  title: string;
  description: string;
  image?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  dietaryTags: string[];
  source: RecipeSource;
  sourceUrl?: string;
  calories?: number;
  author?: string;
  attribution?: string;
}

export interface LocalRecipe extends BaseRecipe {
  source: RecipeSource.LOCAL;
}

export interface SpoonacularRecipe extends BaseRecipe {
  source: RecipeSource.SPOONACULAR;
  sourceUrl: string;
  sourceName: string;
  spoonacularId: number;
}

export type Recipe = LocalRecipe | SpoonacularRecipe;

export interface RecipeSearchParams {
  ingredients?: string[];
  dietaryPreference?: string;
  source?: RecipeSource[];
  maxResults?: number;
} 