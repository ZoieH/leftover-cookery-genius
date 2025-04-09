import { toast } from "@/components/ui/use-toast";

// Instead of storing in memory, we'll use an environment variable
const getApiKeyFromEnv = (): string => {
  // In a real app, this would be passed through Vite's import.meta.env.VITE_OPENAI_API_KEY
  // For development, we can also check localStorage as a fallback
  const envApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (envApiKey) {
    return envApiKey;
  }
  
  // Fallback to localStorage for development convenience
  try {
    const storedKey = localStorage.getItem('openai_api_key');
    return storedKey ? storedKey : '';
  } catch {
    return '';
  }
};

// We'll still use this variable for storing keys set through the UI
let apiKeyInMemory: string = '';

/**
 * Set the API key for the current session
 * @param key The OpenAI API key to store
 */
export const setApiKey = (key: string): void => {
  apiKeyInMemory = key;
  // For development convenience, also store in localStorage
  try {
    localStorage.setItem('openai_api_key', key);
  } catch (error) {
    console.error('Error saving API key to localStorage:', error);
  }
};

/**
 * Get the currently stored API key
 * @returns The stored API key or null if not set
 */
export const getApiKey = (): string => {
  if (apiKeyInMemory) {
    return apiKeyInMemory;
  }
  
  return getApiKeyFromEnv();
};

/**
 * Check if an API key is currently set
 * @returns True if an API key is set, false otherwise
 */
export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

/**
 * Clear the stored API key
 */
export const clearApiKey = (): void => {
  apiKeyInMemory = '';
  try {
    localStorage.removeItem('openai_api_key');
  } catch (error) {
    console.error('Error removing API key from localStorage:', error);
  }
};

/**
 * Call the OpenAI API using the stored API key
 * @param prompt The prompt to send to the API
 * @returns The response from the API
 */
export const callOpenAiApi = async (prompt: string): Promise<string> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not set. Please set it in your .env file or enter it in the admin panel.');
  }
  
  try {
    console.log('Calling OpenAI API with prompt:', prompt.substring(0, 100) + '...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error response:', errorData);
      throw new Error(errorData.error?.message || 'Error calling OpenAI API');
    }
    
    const data = await response.json();
    console.log('Full API response data:', data);
    
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No content found in the response');
    }
    
    console.log('OpenAI API full response content:', content);
    return content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    toast({
      title: 'API Error',
      description: error instanceof Error ? error.message : 'An unknown error occurred',
      variant: 'destructive',
    });
    throw error;
  }
};

// Mock recipe for testing purposes only
const mockRecipeData = {
  "title": "Test Recipe",
  "description": "This is a test recipe for development purposes only",
  "ingredients": ["Ingredient 1", "Ingredient 2", "Ingredient 3"],
  "instructions": [
    { "step": "Step 1 of the test recipe" },
    { "step": "Step 2 of the test recipe" },
    { "step": "Step 3 of the test recipe" }
  ],
  "prep_time": "10 minutes",
  "cook_time": "20 minutes",
  "servings": 4,
  "image_url": "https://example.com/test-image.jpg"
};

export const extractRecipeData = async (urls: string[]): Promise<string> => {
  // Clean up the URLs to ensure they're properly formatted
  const cleanedUrls = urls.map(url => {
    // Remove any leading colons
    let cleanUrl = url.replace(/^:/, '');
    
    // Ensure URL has http/https protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    return cleanUrl;
  });
  
  console.log('Extracting recipe data from cleaned URLs:', cleanedUrls);
  
  // Check if we should use mock data (if URL contains 'test' or 'mock')
  if (cleanedUrls.some(url => url.toLowerCase().includes('test') || url.toLowerCase().includes('mock'))) {
    console.log('Using mock recipe data for testing');
    return JSON.stringify(mockRecipeData);
  }
  
  const prompt = `You are a recipe extraction assistant that can access and analyze web pages. Visit the following URL${cleanedUrls.length > 1 ? 's' : ''} and extract the recipe information:
${cleanedUrls.join('\n')}

Return ONLY a valid JSON object with this structure (no markdown, no explanations):
{
  "title": "Recipe Title",
  "description": "Brief description of the recipe",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": [
    { 
      "step": "Step 1 instruction",
      "image_url": "URL to image for this step (if available)"
    },
    { 
      "step": "Step 2 instruction",
      "image_url": "URL to image for this step (if available)" 
    }
  ],
  "prep_time": "Time for preparation",
  "cook_time": "Time for cooking",
  "servings": number,
  "image_url": "URL to main recipe image if available"
}

For each instruction step, include the "image_url" field if there's a relevant image.

IMPORTANT: Your response must be ONLY THE JSON DATA with NO markdown formatting (no \`\`\`json, no \`\`\`, etc.).

If you cannot access the URL due to restrictions, provide your best attempt at extracting recipe data from the URL itself. If that's not possible, return exactly this:
{"error": "Could not access the URL or extract recipe data"}`;

  try {
    const jsonContent = await callOpenAiApi(prompt);
    
    // Before trying to parse, clean up any markdown or text that might be around the JSON
    const cleanupContent = (content: string) => {
      // Remove markdown code blocks
      let cleaned = content.replace(/```json\s+/g, '').replace(/```\s*$/g, '').replace(/```/g, '').trim();
      
      // If still not parseable, try to extract the JSON object or array pattern
      try {
        JSON.parse(cleaned);
        return cleaned;
      } catch (e) {
        const jsonPattern = /(\{[\s\S]*\}|\[[\s\S]*\])/s;
        const match = cleaned.match(jsonPattern);
        if (match && match[0]) {
          cleaned = match[0];
        }
        return cleaned;
      }
    };
    
    // Try clean the content first
    const cleanedContent = cleanupContent(jsonContent);
    console.log('Cleaned content before parsing:', cleanedContent.substring(0, 100) + '...');
    
    // Try to parse the cleaned content
    try {
      const parsed = JSON.parse(cleanedContent);
      console.log('Successfully parsed JSON content');
      return cleanedContent;
    } catch (error) {
      console.error('Failed to parse JSON even after cleanup:', error);
      console.log('Raw content that failed to parse:', jsonContent);
      throw new Error('Failed to parse the recipe data. The API response could not be converted to valid JSON.');
    }
  } catch (error) {
    console.error('Recipe extraction error:', error);
    throw error;
  }
}; 