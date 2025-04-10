import type { Recipe } from './recipeService';
import { addRecipe } from './firebaseService';
import { extractStructuredRecipeData, extractRecipeFromAnyStructure } from './structuredDataService';

interface ScraperResult {
  success: boolean;
  recipe?: Omit<Recipe, 'id'>;
  error?: string;
}

/**
 * Supported recipe websites
 * Add more websites here as they're implemented
 */
export const supportedWebsites = [
  'recipetineats.com',
  'seriouseats.com',
  'epicurious.com',
  'simplyrecipes.com',
  'thekitchn.com',
  'pinchofyum.com'
];

/**
 * Check if the URL is from a supported website
 * Currently returning true for all valid URLs for testing purposes
 */
export function isSupportedWebsite(url: string): boolean {
  try {
    // Just validate it's a valid URL
    new URL(url);
    return true; // Allow all websites for testing
  } catch (e) {
    return false;
  }
}

/**
 * Test if a website allows scraping via our proxy
 * @param url The URL to test
 * @returns An object indicating success or failure
 */
export async function testWebsiteScraping(url: string): Promise<{success: boolean; message: string}> {
  try {
    // Only test supported websites
    if (!isSupportedWebsite(url)) {
      return {
        success: false,
        message: 'Unsupported website'
      };
    }

    // Use a CORS proxy to bypass browser restrictions
    const corsProxy = 'https://corsproxy.io/?';
    const response = await fetch(`${corsProxy}${encodeURIComponent(url)}`, {
      method: 'HEAD', // Just check headers first to be more respectful
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        message: `Website returned status code: ${response.status}`
      };
    }
    
    return {
      success: true,
      message: 'Website can be scraped'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extracts structured recipe data from a URL
 * Uses a CORS proxy to bypass same-origin policy restrictions
 */
export async function scrapeRecipe(url: string): Promise<ScraperResult> {
  try {
    if (!isSupportedWebsite(url)) {
      return {
        success: false,
        error: 'Invalid URL format'
      };
    }

    // First test if the website allows scraping
    const testResult = await testWebsiteScraping(url);
    if (!testResult.success) {
      return {
        success: false,
        error: `Cannot scrape this website: ${testResult.message}`
      };
    }

    // Use a CORS proxy to bypass browser restrictions
    const corsProxy = 'https://corsproxy.io/?';
    const response = await fetch(`${corsProxy}${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch recipe. Status: ${response.status}`
      };
    }

    const html = await response.text();
    
    // Parse the recipe based on the website
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    let recipe: Omit<Recipe, 'id'> | null = null;
    
    // Select the parser based on the website
    if (hostname.includes('recipetineats.com')) {
      recipe = parseRecipeTinEats(html);
    } else if (hostname.includes('seriouseats.com')) {
      recipe = parseSeriousEats(html);
    } else if (hostname.includes('simplyrecipes.com')) {
      recipe = parseSimplyRecipes(html);
    } else if (hostname.includes('epicurious.com')) {
      recipe = parseEpicurious(html);
    } else if (hostname.includes('thekitchn.com')) {
      recipe = parseTheKitchn(html);
    } else if (hostname.includes('pinchofyum.com')) {
      recipe = parsePinchOfYum(html);
    } else {
      // For any other website, try a generic parser
      recipe = parseGenericRecipe(html, url);
    }
    
    if (!recipe) {
      return {
        success: false,
        error: 'Failed to parse recipe from this website'
      };
    }
    
    // Add source URL to the recipe
    const recipeWithSource = {
      ...recipe,
      sourceUrl: url
    };
    
    return {
      success: true,
      recipe: recipeWithSource
    };
    
  } catch (error) {
    console.error('Error scraping recipe:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Scrape a recipe and add it directly to the database
 */
export async function scrapeAndSaveRecipe(url: string): Promise<ScraperResult> {
  const result = await scrapeRecipe(url);
  
  if (result.success && result.recipe) {
    try {
      const recipeId = await addRecipe(result.recipe);
      return {
        success: true,
        recipe: result.recipe
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to save recipe to database'
      };
    }
  }
  
  return result;
}

/**
 * Parse recipes from RecipeTinEats.com
 */
function parseRecipeTinEats(html: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using structured data approach
    const structuredRecipe = extractStructuredRecipeData(html);
    if (structuredRecipe) {
      return structuredRecipe;
    }
    
    // If structured data approach fails, continue with the existing parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract recipe data from the structured JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    
    if (jsonLd) {
      const jsonContent = jsonLd.textContent || '{}';
      const recipeData = JSON.parse(jsonContent);
      
      // RecipeTinEats usually has an @graph array with the recipe inside
      const recipe = Array.isArray(recipeData['@graph']) 
        ? recipeData['@graph'].find((item: any) => item['@type'] === 'Recipe')
        : (recipeData['@type'] === 'Recipe' ? recipeData : null);
      
      if (recipe) {
        // Extract ingredients
        const ingredients = Array.isArray(recipe.recipeIngredient) 
          ? recipe.recipeIngredient 
          : [];
        
        // Extract instructions
        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((step: any) => 
              typeof step === 'object' ? step.text : step)
          : [recipe.recipeInstructions || ''];
        
        // Create the recipe object
        return {
          title: recipe.name || 'Untitled Recipe',
          description: recipe.description || '',
          ingredients: ingredients,
          instructions: instructions,
          image: recipe.image?.url || recipe.image || '',
          prepTime: recipe.prepTime || '15 minutes',
          cookTime: recipe.cookTime || '30 minutes',
          servings: recipe.recipeYield || 4,
          calories: recipe.nutrition?.calories || 0,
          dietaryTags: extractDietaryTags(recipe),
        };
      }
    }
    
    // Fallback to HTML parsing if JSON-LD is not available or couldn't be parsed
    const title = doc.querySelector('h1')?.textContent?.trim() || 'Untitled Recipe';
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    
    // Try to find ingredients in common structures
    const ingredients: string[] = [];
    doc.querySelectorAll('.wprm-recipe-ingredient').forEach(el => {
      const ingredient = el.textContent?.trim();
      if (ingredient) ingredients.push(ingredient);
    });
    
    // Try to find instructions in common structures
    const instructions: string[] = [];
    doc.querySelectorAll('.wprm-recipe-instruction-text').forEach(el => {
      const instruction = el.textContent?.trim();
      if (instruction) instructions.push(instruction);
    });
    
    // Try to find an image
    const imageEl = doc.querySelector('.wprm-recipe-image img') as HTMLImageElement;
    const image = imageEl?.src || '';
    
    if (ingredients.length === 0 || instructions.length === 0) {
      return null; // Couldn't extract the essential data
    }
    
    return {
      title,
      description,
      ingredients,
      instructions,
      image,
      prepTime: '15 minutes', // Defaults if not found
      cookTime: '30 minutes',
      servings: 4,
      calories: 0,
      dietaryTags: [],
    };
    
  } catch (error) {
    console.error('Error parsing RecipeTinEats:', error);
    return null;
  }
}

/**
 * Parse recipes from SeriousEats.com
 */
function parseSeriousEats(html: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using structured data approach
    const structuredRecipe = extractStructuredRecipeData(html);
    if (structuredRecipe) {
      return structuredRecipe;
    }
    
    // If structured data approach fails, continue with the existing parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract recipe data from the structured JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    
    if (jsonLd) {
      const jsonContent = jsonLd.textContent || '{}';
      const recipeData = JSON.parse(jsonContent);
      
      // SeriousEats usually has the recipe directly in the JSON-LD
      const recipe = recipeData['@type'] === 'Recipe' ? recipeData : null;
      
      if (recipe) {
        // Extract ingredients
        const ingredients = Array.isArray(recipe.recipeIngredient) 
          ? recipe.recipeIngredient 
          : [];
        
        // Extract instructions
        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((step: any) => 
              typeof step === 'object' ? step.text : step)
          : [recipe.recipeInstructions || ''];
        
        // Create the recipe object
        return {
          title: recipe.name || 'Untitled Recipe',
          description: recipe.description || '',
          ingredients: ingredients,
          instructions: instructions,
          image: recipe.image?.url || recipe.image || '',
          prepTime: recipe.prepTime || '15 minutes',
          cookTime: recipe.cookTime || '30 minutes',
          servings: recipe.recipeYield || 4,
          calories: recipe.nutrition?.calories || 0,
          dietaryTags: extractDietaryTags(recipe),
        };
      }
    }
    
    // Fallback to HTML parsing
    const title = doc.querySelector('.recipe-title')?.textContent?.trim() || 'Untitled Recipe';
    const description = doc.querySelector('.recipe-introduction')?.textContent?.trim() || '';
    
    const ingredients: string[] = [];
    doc.querySelectorAll('.ingredient').forEach(el => {
      const ingredient = el.textContent?.trim();
      if (ingredient) ingredients.push(ingredient);
    });
    
    const instructions: string[] = [];
    doc.querySelectorAll('.recipe-procedure-text').forEach(el => {
      const instruction = el.textContent?.trim();
      if (instruction) instructions.push(instruction);
    });
    
    const imageEl = doc.querySelector('.photo') as HTMLImageElement;
    const image = imageEl?.src || '';
    
    if (ingredients.length === 0 || instructions.length === 0) {
      return null; // Couldn't extract the essential data
    }
    
    return {
      title,
      description,
      ingredients,
      instructions,
      image,
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      servings: 4,
      calories: 0,
      dietaryTags: [],
    };
    
  } catch (error) {
    console.error('Error parsing SeriousEats recipe:', error);
    return null;
  }
}

/**
 * Parse recipes from SimplyRecipes.com
 */
function parseSimplyRecipes(html: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using structured data approach
    const structuredRecipe = extractStructuredRecipeData(html);
    if (structuredRecipe) {
      return structuredRecipe;
    }
    
    // If structured data approach fails, continue with the existing parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract recipe data from the structured JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    
    if (jsonLd) {
      const jsonContent = jsonLd.textContent || '{}';
      const recipeData = JSON.parse(jsonContent);
      
      // Simply Recipes usually has an @graph array
      const recipe = Array.isArray(recipeData['@graph']) 
        ? recipeData['@graph'].find((item: any) => item['@type'] === 'Recipe')
        : (recipeData['@type'] === 'Recipe' ? recipeData : null);
      
      if (recipe) {
        // Extract ingredients
        const ingredients = Array.isArray(recipe.recipeIngredient) 
          ? recipe.recipeIngredient 
          : [];
        
        // Extract instructions
        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((step: any) => 
              typeof step === 'object' ? step.text : step)
          : [recipe.recipeInstructions || ''];
        
        // Create the recipe object
        return {
          title: recipe.name || 'Untitled Recipe',
          description: recipe.description || '',
          ingredients: ingredients,
          instructions: instructions,
          image: recipe.image?.url || recipe.image || '',
          prepTime: recipe.prepTime || '15 minutes',
          cookTime: recipe.cookTime || '30 minutes',
          servings: recipe.recipeYield || 4,
          calories: recipe.nutrition?.calories || 0,
          dietaryTags: extractDietaryTags(recipe),
        };
      }
    }
    
    // Fallback to HTML parsing
    // Simply Recipes uses Wordpress Recipe Maker (WPRM)
    const title = doc.querySelector('.recipe-title, .entry-title')?.textContent?.trim() || 'Untitled Recipe';
    const description = doc.querySelector('.recipe-summary, .entry-content p')?.textContent?.trim() || '';
    
    const ingredients: string[] = [];
    doc.querySelectorAll('.wprm-recipe-ingredient, .ingredient').forEach(el => {
      const ingredient = el.textContent?.trim();
      if (ingredient) ingredients.push(ingredient);
    });
    
    const instructions: string[] = [];
    doc.querySelectorAll('.wprm-recipe-instruction-text, .instruction').forEach(el => {
      const instruction = el.textContent?.trim();
      if (instruction) instructions.push(instruction);
    });
    
    const imageEl = doc.querySelector('.featured-image img, .wprm-recipe-image img') as HTMLImageElement;
    const image = imageEl?.src || '';
    
    if (ingredients.length === 0 || instructions.length === 0) {
      return null; // Couldn't extract the essential data
    }
    
    return {
      title,
      description,
      ingredients,
      instructions,
      image,
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      servings: 4,
      calories: 0,
      dietaryTags: [],
    };
    
  } catch (error) {
    console.error('Error parsing SimplyRecipes recipe:', error);
    return null;
  }
}

/**
 * Parse recipes from Epicurious.com
 */
function parseEpicurious(html: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using structured data approach
    const structuredRecipe = extractStructuredRecipeData(html);
    if (structuredRecipe) {
      return structuredRecipe;
    }
    
    // If structured data approach fails, continue with the existing parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract recipe data from the structured JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    
    if (jsonLd) {
      const jsonContent = jsonLd.textContent || '{}';
      const recipeData = JSON.parse(jsonContent);
      
      // Epicurious usually has the recipe directly or in an @graph array
      const recipe = Array.isArray(recipeData['@graph']) 
        ? recipeData['@graph'].find((item: any) => item['@type'] === 'Recipe')
        : (recipeData['@type'] === 'Recipe' ? recipeData : null);
      
      if (recipe) {
        // Extract ingredients
        const ingredients = Array.isArray(recipe.recipeIngredient) 
          ? recipe.recipeIngredient 
          : [];
        
        // Extract instructions
        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((step: any) => 
              typeof step === 'object' ? step.text : step)
          : [recipe.recipeInstructions || ''];
        
        // Create the recipe object
        return {
          title: recipe.name || 'Untitled Recipe',
          description: recipe.description || '',
          ingredients: ingredients,
          instructions: instructions,
          image: recipe.image?.url || recipe.image || '',
          prepTime: recipe.prepTime || '15 minutes',
          cookTime: recipe.cookTime || '30 minutes',
          servings: recipe.recipeYield || 4,
          calories: recipe.nutrition?.calories || 0,
          dietaryTags: extractDietaryTags(recipe),
        };
      }
    }
    
    // Fallback to HTML parsing
    const title = doc.querySelector('.recipe-title')?.textContent?.trim() || 'Untitled Recipe';
    const description = doc.querySelector('.recipe-dek')?.textContent?.trim() || '';
    
    const ingredients: string[] = [];
    doc.querySelectorAll('.ingredient').forEach(el => {
      const ingredient = el.textContent?.trim();
      if (ingredient) ingredients.push(ingredient);
    });
    
    const instructions: string[] = [];
    doc.querySelectorAll('.preparation-step').forEach(el => {
      const instruction = el.textContent?.trim();
      if (instruction) instructions.push(instruction);
    });
    
    const imageEl = doc.querySelector('.photo-wrap img') as HTMLImageElement;
    const image = imageEl?.src || '';
    
    if (ingredients.length === 0 || instructions.length === 0) {
      return null; // Couldn't extract the essential data
    }
    
    return {
      title,
      description,
      ingredients,
      instructions,
      image,
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      servings: 4,
      calories: 0,
      dietaryTags: [],
    };
    
  } catch (error) {
    console.error('Error parsing Epicurious recipe:', error);
    return null;
  }
}

/**
 * Parse recipes from TheKitchn.com
 */
function parseTheKitchn(html: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using structured data approach
    const structuredRecipe = extractStructuredRecipeData(html);
    if (structuredRecipe) {
      return structuredRecipe;
    }
    
    // If structured data approach fails, continue with the existing parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract recipe data from the structured JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    
    if (jsonLd) {
      const jsonContent = jsonLd.textContent || '{}';
      const recipeData = JSON.parse(jsonContent);
      
      // The Kitchn usually has the recipe in an array or directly
      const recipe = Array.isArray(recipeData) 
        ? recipeData.find((item: any) => item['@type'] === 'Recipe')
        : (recipeData['@type'] === 'Recipe' ? recipeData : null);
      
      if (recipe) {
        // Extract ingredients
        const ingredients = Array.isArray(recipe.recipeIngredient) 
          ? recipe.recipeIngredient 
          : [];
        
        // Extract instructions
        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((step: any) => 
              typeof step === 'object' ? step.text : step)
          : [recipe.recipeInstructions || ''];
        
        // Create the recipe object
        return {
          title: recipe.name || 'Untitled Recipe',
          description: recipe.description || '',
          ingredients: ingredients,
          instructions: instructions,
          image: recipe.image?.url || recipe.image || '',
          prepTime: recipe.prepTime || '15 minutes',
          cookTime: recipe.cookTime || '30 minutes',
          servings: recipe.recipeYield || 4,
          calories: recipe.nutrition?.calories || 0,
          dietaryTags: extractDietaryTags(recipe),
        };
      }
    }
    
    // Fallback to HTML parsing
    const title = doc.querySelector('h1')?.textContent?.trim() || 'Untitled Recipe';
    const description = doc.querySelector('.Recipe__description')?.textContent?.trim() || '';
    
    const ingredients: string[] = [];
    doc.querySelectorAll('.Recipe__ingredient').forEach(el => {
      const ingredient = el.textContent?.trim();
      if (ingredient) ingredients.push(ingredient);
    });
    
    const instructions: string[] = [];
    doc.querySelectorAll('.Recipe__instruction').forEach(el => {
      const instruction = el.textContent?.trim();
      if (instruction) instructions.push(instruction);
    });
    
    const imageEl = doc.querySelector('.Recipe__image img') as HTMLImageElement;
    const image = imageEl?.src || '';
    
    if (ingredients.length === 0 || instructions.length === 0) {
      return null; // Couldn't extract the essential data
    }
    
    return {
      title,
      description,
      ingredients,
      instructions,
      image,
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      servings: 4,
      calories: 0,
      dietaryTags: [],
    };
    
  } catch (error) {
    console.error('Error parsing TheKitchn recipe:', error);
    return null;
  }
}

/**
 * Parse recipes from PinchOfYum.com
 */
function parsePinchOfYum(html: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using structured data approach
    const structuredRecipe = extractStructuredRecipeData(html);
    if (structuredRecipe) {
      return structuredRecipe;
    }
    
    // If structured data approach fails, continue with the existing parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract recipe data from the structured JSON-LD
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    
    if (jsonLd) {
      const jsonContent = jsonLd.textContent || '{}';
      const recipeData = JSON.parse(jsonContent);
      
      // PinchOfYum usually has the recipe directly in JSON-LD
      const recipe = recipeData['@type'] === 'Recipe' ? recipeData : null;
      
      if (recipe) {
        // Extract ingredients
        const ingredients = Array.isArray(recipe.recipeIngredient) 
          ? recipe.recipeIngredient 
          : [];
        
        // Extract instructions
        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((step: any) => 
              typeof step === 'object' ? step.text : step)
          : [recipe.recipeInstructions || ''];
        
        // Create the recipe object
        return {
          title: recipe.name || 'Untitled Recipe',
          description: recipe.description || '',
          ingredients: ingredients,
          instructions: instructions,
          image: recipe.image?.url || recipe.image || '',
          prepTime: recipe.prepTime || '15 minutes',
          cookTime: recipe.cookTime || '30 minutes',
          servings: recipe.recipeYield || 4,
          calories: recipe.nutrition?.calories || 0,
          dietaryTags: extractDietaryTags(recipe),
        };
      }
    }
    
    // Fallback to HTML parsing
    const title = doc.querySelector('.tasty-recipes-title')?.textContent?.trim() || 'Untitled Recipe';
    const description = doc.querySelector('.tasty-recipes-description')?.textContent?.trim() || '';
    
    const ingredients: string[] = [];
    doc.querySelectorAll('.tasty-recipes-ingredients li').forEach(el => {
      const ingredient = el.textContent?.trim();
      if (ingredient) ingredients.push(ingredient);
    });
    
    const instructions: string[] = [];
    doc.querySelectorAll('.tasty-recipes-instructions li').forEach(el => {
      const instruction = el.textContent?.trim();
      if (instruction) instructions.push(instruction);
    });
    
    const imageEl = doc.querySelector('.tasty-recipes-image img') as HTMLImageElement;
    const image = imageEl?.src || '';
    
    if (ingredients.length === 0 || instructions.length === 0) {
      return null; // Couldn't extract the essential data
    }
    
    return {
      title,
      description,
      ingredients,
      instructions,
      image,
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      servings: 4,
      calories: 0,
      dietaryTags: [],
    };
    
  } catch (error) {
    console.error('Error parsing PinchOfYum recipe:', error);
    return null;
  }
}

/**
 * Extract dietary tags from recipe metadata
 */
function extractDietaryTags(recipeData: any): string[] {
  const tags: string[] = [];
  
  // Check for common dietary indicators
  const keywords = typeof recipeData.keywords === 'string' ? recipeData.keywords : '';
  const description = recipeData.description || '';
  const name = recipeData.name || '';
  
  // Common dietary patterns to check for
  const dietaryPatterns = {
    'vegetarian': ['vegetarian', 'meatless', 'meat-free'],
    'vegan': ['vegan', 'plant-based', 'dairy-free', 'egg-free'],
    'gluten-free': ['gluten-free', 'gluten free', 'no gluten'],
    'low-carb': ['low-carb', 'low carb', 'keto', 'ketogenic'],
    'dairy-free': ['dairy-free', 'dairy free', 'no dairy'],
  };
  
  // Check each dietary pattern against recipe data
  Object.entries(dietaryPatterns).forEach(([tag, patterns]) => {
    for (const pattern of patterns) {
      if (
        keywords.toLowerCase().includes(pattern) ||
        description.toLowerCase().includes(pattern) ||
        name.toLowerCase().includes(pattern)
      ) {
        tags.push(tag);
        break; // Found a match for this tag, no need to check other patterns
      }
    }
  });
  
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Generic parser that tries to extract recipe data from any website
 * Uses a combination of approaches focusing on structured data
 */
function parseGenericRecipe(html: string, url: string): Omit<Recipe, 'id'> | null {
  try {
    // First try to extract using our structured data extractor
    const structuredRecipe = extractRecipeFromAnyStructure(html);
    if (structuredRecipe) {
      return {
        ...structuredRecipe,
        title: structuredRecipe.title || 'Untitled Recipe',
        description: `${structuredRecipe.description}\n\nSource: ${url}`,
        ingredients: structuredRecipe.ingredients || [],
        instructions: structuredRecipe.instructions || [],
        dietaryTags: structuredRecipe.dietaryTags || [],
        source: RecipeSource.SPOONACULAR
      };
    }
    
    // If we can't find structured data, look for JSON-LD recipe data
    // (this is already handled by extractRecipeFromAnyStructure, but keeping as fallback)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Look for JSON-LD data
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const jsonLdContent = jsonLdScripts[i].textContent || '{}';
        const jsonLdData = JSON.parse(jsonLdContent);
        
        // Handle both direct recipe and @graph containing recipes
        const recipes = [];
        
        // Check if it's a direct recipe
        if (jsonLdData['@type'] === 'Recipe' || (Array.isArray(jsonLdData['@type']) && jsonLdData['@type'].includes('Recipe'))) {
          recipes.push(jsonLdData);
        }
        
        // Check if it has an @graph with recipes
        if (jsonLdData['@graph'] && Array.isArray(jsonLdData['@graph'])) {
          const graphRecipes = jsonLdData['@graph'].filter((item: any) => 
            item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
          );
          recipes.push(...graphRecipes);
        }
        
        // Handle array of items
        if (Array.isArray(jsonLdData)) {
          const arrayRecipes = jsonLdData.filter((item: any) => 
            item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
          );
          recipes.push(...arrayRecipes);
        }
        
        // Use the first recipe found
        if (recipes.length > 0) {
          return extractRecipeFromJsonLd(recipes[0]);
        }
      } catch (error) {
        console.error('Error parsing JSON-LD:', error);
      }
    }
    
    // No structured data found, try to extract using crude heuristics
    // This is a last resort and likely to be less reliable
    
    // Try to find recipe title
    const title = doc.querySelector('h1')?.textContent?.trim() || 'Unknown Recipe';
    
    // Look for common recipe ingredient patterns
    const ingredientListItems = doc.querySelectorAll('.ingredients li, .ingredient-list li, ul.ingredients li, .recipe-ingredients li');
    const ingredients: string[] = [];
    ingredientListItems.forEach(li => {
      const text = li.textContent?.trim();
      if (text) ingredients.push(text);
    });
    
    // If no ingredients found via common classes, try to find any list near keywords
    if (ingredients.length === 0) {
      const allLists = doc.querySelectorAll('ul');
      for (let i = 0; i < allLists.length; i++) {
        const list = allLists[i];
        const nearbyText = list.previousElementSibling?.textContent?.toLowerCase() || '';
        if (nearbyText.includes('ingredient')) {
          const items = list.querySelectorAll('li');
          items.forEach(item => {
            const text = item.textContent?.trim();
            if (text) ingredients.push(text);
          });
          break;
        }
      }
    }
    
    // Look for common recipe instruction patterns
    const instructionListItems = doc.querySelectorAll('.instructions li, .direction-list li, ol.instructions li, .recipe-directions li, .recipe-steps li');
    const instructions: string[] = [];
    instructionListItems.forEach(li => {
      const text = li.textContent?.trim();
      if (text) instructions.push(text);
    });
    
    // If no structured instructions found, look for steps with numbers
    if (instructions.length === 0) {
      const allLists = doc.querySelectorAll('ol');
      for (let i = 0; i < allLists.length; i++) {
        const list = allLists[i];
        const nearbyText = list.previousElementSibling?.textContent?.toLowerCase() || '';
        if (nearbyText.includes('instruction') || nearbyText.includes('direction') || nearbyText.includes('step')) {
          const items = list.querySelectorAll('li');
          items.forEach(item => {
            const text = item.textContent?.trim();
            if (text) instructions.push(text);
          });
          break;
        }
      }
    }
    
    // If we found at least a title and some ingredients or instructions
    if ((ingredients.length > 0 || instructions.length > 0)) {
      return {
        title,
        description: '',
        ingredients,
        instructions,
        image: '', // Could try to find image but that's more complex
        prepTime: '',
        cookTime: '',
        servings: 4, // Default value
        calories: 0,
        dietaryTags: [],
        sourceUrl: url
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in generic recipe parser:', error);
    return null;
  }
}

/**
 * Helper function to extract recipe data from JSON-LD
 */
function extractRecipeFromJsonLd(recipe: any): Omit<Recipe, 'id'> {
  // Extract ingredients
  const ingredients = Array.isArray(recipe.recipeIngredient) 
    ? recipe.recipeIngredient 
    : [];
  
  // Extract instructions
  const instructions = Array.isArray(recipe.recipeInstructions)
    ? recipe.recipeInstructions.map((step: any) => 
        typeof step === 'object' ? step.text : step)
    : [recipe.recipeInstructions || ''];
  
  // Extract author name
  let author = '';
  if (recipe.author) {
    if (typeof recipe.author === 'string') {
      author = recipe.author;
    } else if (recipe.author.name) {
      author = recipe.author.name;
    }
  }
  
  // Create the recipe object
  return {
    title: recipe.name || 'Untitled Recipe',
    description: recipe.description || '',
    ingredients: ingredients,
    instructions: instructions,
    image: recipe.image?.url || recipe.image || '',
    prepTime: recipe.prepTime || '15 minutes',
    cookTime: recipe.cookTime || '30 minutes',
    servings: recipe.recipeYield || 4,
    calories: recipe.nutrition?.calories || 0,
    dietaryTags: extractDietaryTags(recipe),
    author: author || undefined,
    attribution: recipe.attribution || undefined
  };
}