import type { Recipe } from './recipeService';

interface StructuredRecipeData {
  '@type': string;
  name: string;
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?: (string | { '@type': string; text: string })[];
  image?: string | { '@type': string; url: string }[];
  cookTime?: string;
  prepTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  nutrition?: {
    '@type': string;
    calories?: string;
    fatContent?: string;
    // other nutrition properties
  };
  author?: {
    '@type': string;
    name: string;
  } | string;
  keywords?: string;
  attribution?: string;
}

/**
 * Extract structured recipe data (JSON-LD) from HTML content
 * @param htmlContent The HTML content of the recipe page
 * @returns Recipe data if found, or null if no valid recipe data was found
 */
export function extractStructuredRecipeData(htmlContent: string): Omit<Recipe, 'id'> | null {
  try {
    // Look for JSON-LD scripts in the HTML
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const matches = [...htmlContent.matchAll(jsonLdRegex)];
    
    if (!matches.length) {
      console.log('No JSON-LD data found in the HTML');
      return null;
    }
    
    // Process all JSON-LD blocks to find recipe data
    for (const match of matches) {
      try {
        const jsonString = match[1].trim();
        const jsonData = JSON.parse(jsonString);
        
        // JSON-LD can be a single object or an array of objects
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        // Find the first item that's a Recipe or has a Recipe in @graph
        for (const item of items) {
          // Check for @graph property which might contain multiple structured data items
          if (item['@graph'] && Array.isArray(item['@graph'])) {
            for (const graphItem of item['@graph']) {
              if (isRecipeType(graphItem)) {
                return convertStructuredDataToRecipe(graphItem);
              }
            }
          }
          
          // Check if the item itself is a Recipe
          if (isRecipeType(item)) {
            return convertStructuredDataToRecipe(item);
          }
        }
      } catch (error) {
        console.error('Error parsing JSON-LD block:', error);
        // Continue to the next JSON-LD block
      }
    }
    
    console.log('No recipe data found in JSON-LD');
    return null;
  } catch (error) {
    console.error('Error extracting structured data:', error);
    return null;
  }
}

/**
 * Check if the given structured data item is a Recipe
 */
function isRecipeType(item: any): item is StructuredRecipeData {
  return (
    item && 
    (item['@type'] === 'Recipe' || 
     (Array.isArray(item['@type']) && item['@type'].includes('Recipe')))
  );
}

/**
 * Convert structured recipe data to our app's Recipe format
 */
function convertStructuredDataToRecipe(data: StructuredRecipeData): Omit<Recipe, 'id'> {
  // Extract and normalize ingredients
  const ingredients = data.recipeIngredient?.map(ingredient => ingredient) || [];
  
  // Extract and normalize instructions
  let instructions: string[] = [];
  if (data.recipeInstructions) {
    instructions = data.recipeInstructions.map(instruction => {
      if (typeof instruction === 'string') {
        return instruction;
      } else if (instruction['@type'] && instruction.text) {
        return instruction.text;
      }
      return '';
    }).filter(Boolean);
  }
  
  // Extract image URL
  let image = '';
  if (data.image) {
    if (typeof data.image === 'string') {
      image = data.image;
    } else if (Array.isArray(data.image) && data.image[0]?.url) {
      image = data.image[0].url;
    }
  }
  
  // Extract author name
  let author = '';
  if (data.author) {
    if (typeof data.author === 'string') {
      author = data.author;
    } else if (data.author.name) {
      author = data.author.name;
    }
  }
  
  // Parse cook and prep times from ISO8601 duration format (PT1H30M) to minutes
  const cookTimeMinutes = parseISODuration(data.cookTime || '');
  const prepTimeMinutes = parseISODuration(data.prepTime || '');
  
  // Convert yield to servings
  let servings = 4; // Default value
  if (data.recipeYield) {
    if (typeof data.recipeYield === 'number') {
      servings = data.recipeYield;
    } else {
      // Try to extract a number from the yield string
      const match = data.recipeYield.match(/\d+/);
      if (match) {
        servings = parseInt(match[0], 10);
      }
    }
  }
  
  // Try to extract calories from nutrition info
  let calories = 0;
  if (data.nutrition?.calories) {
    const caloriesMatch = data.nutrition.calories.match(/\d+/);
    if (caloriesMatch) {
      calories = parseInt(caloriesMatch[0], 10);
    }
  }
  
  // Extract dietary tags from keywords
  const dietaryTags: string[] = [];
  if (data.keywords) {
    const keywords = data.keywords.split(',').map(k => k.trim().toLowerCase());
    
    // Check for common dietary terms
    const dietaryTerms = [
      'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 
      'low-carb', 'keto', 'paleo', 'low-fat', 'sugar-free'
    ];
    
    dietaryTerms.forEach(term => {
      if (keywords.some(k => k.includes(term))) {
        dietaryTags.push(term);
      }
    });
  }
  
  // Create the recipe object
  return {
    title: data.name,
    description: data.description || '',
    ingredients,
    image,
    prepTime: `${prepTimeMinutes} minutes`,
    cookTime: `${cookTimeMinutes} minutes`,
    servings,
    calories,
    dietaryTags,
    instructions,
    author: author || undefined,
    attribution: data.attribution || undefined
  };
}

/**
 * Parse ISO8601 duration format (e.g., PT1H30M) to minutes
 */
function parseISODuration(isoDuration: string): number {
  if (!isoDuration) return 0;
  
  const matches = isoDuration.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return 0;
  
  const days = parseInt(matches[1] || '0', 10);
  const hours = parseInt(matches[2] || '0', 10);
  const minutes = parseInt(matches[3] || '0', 10);
  const seconds = parseInt(matches[4] || '0', 10);
  
  return days * 24 * 60 + hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Extract recipes from multiple potential structured data formats
 * This is a more comprehensive approach that tries different methods
 */
export function extractRecipeFromAnyStructure(htmlContent: string): Omit<Recipe, 'id'> | null {
  // First try JSON-LD structured data (most common and reliable)
  const jsonLdRecipe = extractStructuredRecipeData(htmlContent);
  if (jsonLdRecipe) {
    return jsonLdRecipe;
  }
  
  // Other approaches could be added here:
  // 1. Try microdata format
  // 2. Try RDFa format
  // 3. Look for common recipe page patterns
  
  return null;
} 