import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize the Google Generative AI with your API key
// Note: In production, you should use environment variables for API keys
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Configure safety settings
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Define the structure of an identified ingredient
export interface IdentifiedIngredient {
  name: string;
  quantity: string;
  unit: string;
}

/**
 * Converts a base64 data URL to a Uint8Array for Gemini API
 */
function fileToGenerativePart(fileDataUrl: string): { inlineData: { data: string, mimeType: string } } {
  // Extract the base64 data from the data URL
  const regex = /^data:([^;]+);base64,(.+)$/;
  const match = fileDataUrl.match(regex);
  
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  
  const mimeType = match[1];
  const base64Data = match[2];
  
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

/**
 * Analyzes an image to identify food ingredients and their quantities using Gemini API
 * @param imageBase64DataUrl - Base64 encoded image data URL (e.g., "data:image/jpeg;base64,...")
 * @returns Array of identified ingredients with quantities
 */
export async function identifyIngredientsFromImage(imageBase64DataUrl: string): Promise<IdentifiedIngredient[]> {
  try {
    // Debug logging
    console.log('🔍 Debug - Starting ingredient identification');
    console.log('🔑 API Key present:', !!import.meta.env.VITE_GEMINI_API_KEY);
    console.log('🔑 API Key length:', import.meta.env.VITE_GEMINI_API_KEY?.length);
    console.log('📸 Image data length:', imageBase64DataUrl?.length);
    
    if (!API_KEY) {
      throw new Error('Gemini API key not found. Please set VITE_GEMINI_API_KEY in your environment.');
    }
    
    // Convert the data URL to a format acceptable by Gemini
    const imagePart = fileToGenerativePart(imageBase64DataUrl);
    
    // Get the generative model (Updated from gemini-pro-vision to gemini-2.0-flash)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Prepare the prompt to identify ingredients with quantities
    const prompt = `Identify all food ingredients in this image with their approximate quantities. 
Return a JSON array of objects with the following structure:
[
  {
    "name": "ingredient name",
    "quantity": "estimated quantity as a number",
    "unit": "appropriate unit (g, kg, ml, l, pieces, cups, etc.)"
  }
]
Focus on raw ingredients, not prepared dishes. Be realistic about quantities based on what you can see in the image.`;
    
    // Generate content
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse the response as JSON
    try {
      // The model might add markdown code blocks or extra text; try to extract just the JSON
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const ingredients = JSON.parse(jsonMatch[0]);
        return ingredients;
      } else {
        // If we can't extract JSON, fall back to processing the text line by line
        console.error('Failed to parse Gemini response as JSON, falling back to text processing');
        
        // Simple fallback to return just ingredient names with default quantities
        const lines = text.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('```') && !line.startsWith('{') && !line.startsWith('}'));
          
        return lines.map(line => ({ 
          name: line,
          quantity: "1",
          unit: "pieces" 
        }));
      }
    } catch (e) {
      console.error('Error parsing Gemini response:', e);
      // Return a simpler structure with default quantities as a fallback
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('```') && !line.startsWith('{') && !line.startsWith('}'));
        
      return lines.map(line => ({ 
        name: line,
        quantity: "1",
        unit: "pieces" 
      }));
    }
  } catch (error) {
    console.error('❌ Error identifying ingredients:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
} 