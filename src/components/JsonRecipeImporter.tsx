import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { Loader2, CheckCircle, AlertCircle, FileJson } from 'lucide-react';
import { processAndImportJsonRecipe } from '@/utils/recipeImport';

const JsonRecipeImporter: React.FC = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    recipeId?: string;
    recipeName?: string;
    error?: string;
    importCount?: number;
  } | null>(null);
  const { toast } = useToast();

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      toast({
        title: 'JSON Required',
        description: 'Please paste recipe JSON to import.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Attempt to fix common JSON formatting issues
      let cleanedInput = jsonInput.trim();
      
      // Check for multiple recipes that aren't properly enclosed in an array
      // Look for patterns that indicate multiple JSON objects
      if (cleanedInput.match(/}\s*,?\s*\s*{/g) || 
          // Count number of recipe title fields - if more than 1, likely multiple recipes
          (cleanedInput.match(/"title"\s*:/g) || []).length > 1) {
        
        // Ensure recipes are properly separated with commas
        cleanedInput = cleanedInput.replace(/}\s*{/g, '},{');
        
        // If input doesn't start with [, add it
        if (!cleanedInput.startsWith('[')) {
          cleanedInput = '[' + cleanedInput;
        }
        
        // If input doesn't end with ], add it
        if (!cleanedInput.endsWith(']')) {
          cleanedInput = cleanedInput + ']';
        }
        
        console.log("Detected multiple recipe objects - adding array brackets");
      }
      
      // Validate JSON
      let recipeData;
      try {
        recipeData = JSON.parse(cleanedInput);
      } catch (error) {
        console.error("JSON parsing error:", error);
        
        // Try a more aggressive approach if initial parsing fails:
        // Assume there might be multiple recipe objects and try wrapping in array
        if (!cleanedInput.startsWith('[')) {
          try {
            // Ensure the input has proper formatting before wrapping
            let wrappedInput = cleanedInput;
            
            // If the input ends with a comma, remove it to avoid syntax error
            if (wrappedInput.endsWith(',')) {
              wrappedInput = wrappedInput.slice(0, -1);
            }
            
            wrappedInput = `[${wrappedInput}]`;
            recipeData = JSON.parse(wrappedInput);
            console.log("Successfully parsed JSON after wrapping in array");
          } catch (secondError) {
            toast({
              title: 'Invalid JSON',
              description: 'The provided JSON format is invalid. Please ensure each recipe has proper formatting.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }
        } else {
          toast({
            title: 'Invalid JSON',
            description: 'The provided JSON is not valid. Please check the format.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      // Check if we have an array of recipes or a single recipe
      const isArray = Array.isArray(recipeData);
      
      if (isArray) {
        // Process multiple recipes
        if (recipeData.length === 0) {
          toast({
            title: 'Empty Array',
            description: 'The JSON array contains no recipes to import.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        
        // Validate each recipe has minimum required fields
        const invalidRecipes = recipeData.filter(recipe => !recipe.title || !Array.isArray(recipe.ingredients));
        if (invalidRecipes.length > 0) {
          setResult({
            success: false,
            error: `${invalidRecipes.length} recipe(s) are missing required fields (title, ingredients).`
          });
          toast({
            title: 'Invalid Recipe Data',
            description: 'Some recipes are missing required fields.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        
        // Import each recipe one by one
        let successCount = 0;
        const recipeNames: string[] = [];
        
        for (const recipe of recipeData) {
          try {
            const importResult = await processAndImportJsonRecipe(JSON.stringify(recipe));
            if (importResult.success) {
              successCount++;
              recipeNames.push(recipe.title);
            }
          } catch (error) {
            console.error(`Error importing recipe "${recipe.title}":`, error);
          }
        }
        
        if (successCount > 0) {
          setResult({
            success: true,
            recipeName: recipeNames.join(', '),
            importCount: successCount
          });
          
          toast({
            title: 'Recipes Imported',
            description: `Successfully imported ${successCount} of ${recipeData.length} recipes`,
            variant: 'default',
          });
        } else {
          setResult({
            success: false,
            error: 'Failed to import any recipes'
          });
          
          toast({
            title: 'Import Failed',
            description: 'None of the recipes could be imported',
            variant: 'destructive',
          });
        }
      } else {
        // Process single recipe
        // Check if it has the minimum required fields
        if (!recipeData.title || !Array.isArray(recipeData.ingredients)) {
          setResult({
            success: false,
            error: 'The JSON is missing required recipe fields (title, ingredients).'
          });
          toast({
            title: 'Invalid Recipe Data',
            description: 'The JSON is missing required recipe fields.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        // Process and import the recipe
        const importResult = await processAndImportJsonRecipe(jsonInput);
        
        if (importResult.success) {
          setResult({
            success: true,
            recipeId: importResult.recipeId,
            recipeName: recipeData.title,
            importCount: 1
          });
          
          toast({
            title: 'Recipe Imported',
            description: `Successfully imported "${recipeData.title}"`,
            variant: 'default',
          });
        } else {
          setResult({
            success: false,
            error: importResult.error
          });
          
          toast({
            title: 'Import Failed',
            description: importResult.error || 'Failed to import recipe',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: 'Import Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handlePasteExample = () => {
    // If the user has already pasted the single recipe example, show the multi-recipe example
    if (jsonInput.includes("Chicken Enchiladas")) {
      setJsonInput(`[
    {
      "title": "Chicken Enchiladas with Creamy Green Chile Sauce",
      "description": "This recipe features chicken and cheese-filled corn tortillas baked under a creamy green chile sauce.",
      "ingredients": [
        "2 tablespoons vegetable oil, or more as needed",
        "12 corn tortillas",
        "3 cooked boneless skinless chicken breast halves, shredded",
        "12 ounces shredded Monterey Jack cheese, divided"
      ],
      "instructions": [
        {
          "step": "Preheat the oven to 375°F (190°C). Grease a 9x13-inch baking dish."
        },
        {
          "step": "Heat oil in a skillet over medium-high heat. Quickly fry each tortilla for about 5 seconds per side until pliable."
        }
      ],
      "prep_time": "30 minutes",
      "cook_time": "30 minutes",
      "servings": 6,
      "image_url": "https://example.com/enchiladas.jpg"
    },
    {
      "title": "Classic Caesar Salad",
      "description": "A traditional Caesar salad with homemade dressing and crisp romaine lettuce.",
      "ingredients": [
        "1 large head romaine lettuce, torn into bite-size pieces",
        "1/2 cup olive oil",
        "3 cloves garlic, minced",
        "2 large eggs, coddled"
      ],
      "instructions": [
        {
          "step": "Wash and dry the romaine lettuce leaves, then tear into bite-sized pieces."
        },
        {
          "step": "In a bowl, whisk together the olive oil, minced garlic, eggs, lemon juice, Worcestershire sauce, and anchovy paste."
        }
      ],
      "prep_time": "15 minutes",
      "cook_time": "0 minutes",
      "servings": 4,
      "image_url": "https://example.com/caesar-salad.jpg"
    }
  ]`);
    } else {
      // Show the single recipe example
      setJsonInput(`{
    "title": "Chicken Enchiladas with Creamy Green Chile Sauce",
    "description": "This recipe features chicken and cheese-filled corn tortillas baked under a creamy green chile sauce.",
    "ingredients": [
      "2 tablespoons vegetable oil, or more as needed",
      "12 corn tortillas",
      "3 cooked boneless skinless chicken breast halves, shredded",
      "12 ounces shredded Monterey Jack cheese, divided",
      "¾ cup minced onion",
      "¼ cup butter",
      "¼ cup all-purpose flour",
      "2 cups chicken broth",
      "1 cup sour cream",
      "1 (4 ounce) can chopped green chiles, drained"
    ],
    "instructions": [
      {
        "step": "Preheat the oven to 375°F (190°C). Grease a 9x13-inch baking dish."
      },
      {
        "step": "Heat oil in a skillet over medium-high heat. Quickly fry each tortilla for about 5 seconds per side until pliable. Add more oil as needed. Drain tortillas on paper towels."
      },
      {
        "step": "Combine shredded chicken, 3 cups Monterey Jack cheese, and minced onion in a bowl. Fill each tortilla with about 1/4 cup of the chicken mixture, roll up, and place seam-side down in the prepared baking dish."
      },
      {
        "step": "Melt butter in a saucepan over medium heat. Stir in flour and cook for 1 minute. Gradually whisk in chicken broth and cook until the sauce thickens, about 5 minutes."
      },
      {
        "step": "Remove from heat and stir in sour cream and chopped green chiles. Pour the sauce over the enchiladas."
      },
      {
        "step": "Bake in the preheated oven for 20 minutes. Sprinkle remaining Monterey Jack cheese over the top and continue baking until the cheese melts, about 5 minutes more."
      }
    ],
    "prep_time": "30 minutes",
    "cook_time": "30 minutes",
    "servings": 6,
    "image_url": "https://www.allrecipes.com/thmb/9SnqRslFq8GGxGwAU5fwTlj93No=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/125658-chicken-enchiladas-with-creamy-green-chile-sauce-DDMFS-4x3-c02721a9d51941b8aa6557d73061ab8f.jpg"
  }`);
    }
  };

  const handleClearJson = () => {
    setJsonInput('');
    setResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Recipe from JSON</CardTitle>
        <CardDescription>
          Import recipes by pasting structured JSON data directly.
          You can import a single recipe or multiple recipes as an array.
          Perfect for importing from API services or third-party sources.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Paste recipe JSON data here..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            disabled={isLoading}
          />
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePasteExample}
              disabled={isLoading}
            >
              <FileJson className="mr-2 h-4 w-4" />
              Paste Example
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearJson}
              disabled={isLoading}
            >
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            JSON must include at minimum a title and ingredients array for each recipe.
            You can paste a single recipe object or an array of recipe objects.
          </p>
        </div>

        {result && (
          <div className={`p-3 rounded-md flex items-start gap-2 ${
            result.success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {result.success ? 'Recipe Import Successful' : 'Import Failed'}
              </p>
              {result.success ? (
                <p className="text-xs mt-1">
                  {result.importCount && result.importCount > 1 
                    ? `Successfully imported ${result.importCount} recipes` 
                    : `Successfully imported "${result.recipeName}"`}
                </p>
              ) : (
                <p className="text-xs mt-1">{result.error}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleImportJson}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <FileJson className="mr-2 h-4 w-4" />
              Import JSON Recipe
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default JsonRecipeImporter; 