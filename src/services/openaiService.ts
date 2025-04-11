import { Recipe, RecipeSource } from '@/types/recipe';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIRecipeResponse {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: number;
  dietaryTags: string[];
}

/**
 * Generate a recipe using OpenAI based on available ingredients
 */
export async function generateRecipeWithOpenAI(
  ingredients: string[],
  dietaryFilter?: string
): Promise<Recipe | null> {
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key not found:', import.meta.env);
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log('Generating recipe with ingredients:', ingredients);
    const prompt = `Create a high-quality, authentic recipe using the following ingredients: ${ingredients.join(', ')}.
${dietaryFilter ? `The recipe must be ${dietaryFilter}.` : ''}
The recipe should be practical, well-balanced, and follow traditional cooking methods.
Include:
1. A creative but appropriate title
2. A brief description of the dish
3. A complete list of ingredients with measurements
4. Step-by-step cooking instructions
5. Estimated prep and cook times
6. Number of servings
7. Relevant dietary tags

Format the response as a JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "ingredients": ["string"],
  "instructions": ["string"],
  "prepTime": "string",
  "cookTime": "string",
  "servings": number,
  "dietaryTags": ["string"]
}`;

    console.log('Making OpenAI API request...');
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a professional chef and recipe developer. Create authentic, high-quality recipes that are practical and follow traditional cooking methods.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response received');
    
    try {
      // Log the raw response first for debugging
      console.log('Raw OpenAI response structure:', JSON.stringify({
        model: data.model,
        choices_length: data.choices?.length || 0,
        content_length: data.choices?.[0]?.message?.content?.length || 0
      }));
      
      // Clean up the response content by removing markdown code blocks
      const content = data.choices[0].message.content;
      console.log('Original content type:', typeof content);
      console.log('Original content starts with:', content.substring(0, 30));
      
      // More aggressive cleaning approach
      let cleanedContent = content;
      
      // First remove markdown code blocks
      cleanedContent = cleanedContent
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .replace(/```/g, '')
        .trim();
      
      console.log('After markdown removal:', cleanedContent.substring(0, 30));
      
      // If still not valid, try more aggressive JSON extraction
      try {
        JSON.parse(cleanedContent);
        console.log('First attempt at parsing succeeded');
      } catch (e) {
        console.log('First parse attempt failed:', e.message);
        
        // Try to extract the JSON object using regex - looking for the entire structure
        const jsonPattern = /\{[\s\S]*\}/;
        const match = content.match(jsonPattern);
        if (match && match[0]) {
          console.log('Found JSON pattern match of length:', match[0].length);
          cleanedContent = match[0];
        } else {
          console.log('No JSON pattern match found');
        }
      }
      
      console.log('Final cleaned content length:', cleanedContent.length);
      console.log('Final cleaned content starts with:', cleanedContent.substring(0, 30));
      
      // Last attempt to parse - with additional error information
      try {
        const recipeData: OpenAIRecipeResponse = JSON.parse(cleanedContent);
        console.log('Successfully parsed recipe data from OpenAI');

        // Convert OpenAI response to our Recipe format
        const recipe: Recipe = {
          id: `openai-${Date.now()}`,
          title: recipeData.title,
          description: recipeData.description,
          ingredients: recipeData.ingredients,
          instructions: recipeData.instructions,
          prepTime: recipeData.prepTime,
          cookTime: recipeData.cookTime,
          servings: recipeData.servings,
          dietaryTags: recipeData.dietaryTags || [],
          source: RecipeSource.LOCAL, // Using LOCAL as the source for AI-generated recipes
          image: '', // No image for AI-generated recipes
          calories: 0, // No calorie info for AI-generated recipes
          sourceUrl: 'https://openai.com' // Source URL for AI-generated recipes
        };

        // If a dietary filter was specified, make sure it's included in the tags
        if (dietaryFilter && !recipe.dietaryTags.includes(dietaryFilter)) {
          recipe.dietaryTags.push(dietaryFilter);
        }

        return recipe;
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        console.error('Raw response content:', data.choices[0]?.message?.content);
        throw new Error('Failed to parse recipe data from OpenAI response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw response content:', data.choices[0]?.message?.content);
      throw new Error('Failed to parse recipe data from OpenAI response');
    }
  } catch (error) {
    console.error('Error generating recipe with OpenAI:', error);
    throw error;
  }
} 