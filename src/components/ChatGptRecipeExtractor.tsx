import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { Loader2, Globe, FileJson, Download, Save, Key } from 'lucide-react';
import { processAndImportJsonRecipe } from '@/utils/recipeImport';
import { Input } from './ui/input';
import { setApiKey, getApiKey, clearApiKey, hasApiKey, extractRecipeData } from '@/services/apiKeyService';

const ChatGptRecipeExtractor: React.FC = () => {
  const [urls, setUrls] = useState('');
  const [apiKey, setApiKeyState] = useState('');
  const [extractedJson, setExtractedJson] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    recipeName?: string;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  // Load API key on component mount
  useEffect(() => {
    const storedKey = getApiKey();
    if (storedKey) {
      setApiKeyState(storedKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your OpenAI API key to save.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingKey(true);

    try {
      // Store the API key in memory
      setApiKey(apiKey);
      
      toast({
        title: 'API Key Saved',
        description: 'Your API key has been saved for this session.',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Error Saving Key',
        description: 'Failed to save your API key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleClearApiKey = () => {
    clearApiKey();
    setApiKeyState('');
    toast({
      title: 'API Key Cleared',
      description: 'Your API key has been removed.',
      variant: 'default',
    });
  };

  const handleExtract = async () => {
    if (!urls.trim()) {
      toast({
        title: 'URLs Required',
        description: 'Please enter at least one recipe URL to extract.',
        variant: 'destructive',
      });
      return;
    }

    if (!apiKey.trim() && !hasApiKey()) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your OpenAI API key.',
        variant: 'destructive',
      });
      return;
    }

    // If user has entered a new API key but not saved it, save it now
    if (apiKey.trim() && apiKey !== getApiKey()) {
      setApiKey(apiKey);
    }

    setIsLoading(true);
    setExtractedJson('');
    setImportResult(null);

    try {
      // Split the input into individual URLs and clean them
      const urlList = urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0)
        .map(url => {
          // Remove any leading colons or spaces
          return url.replace(/^[:\s]+/, '');
        });

      // Make sure we have at least one valid URL
      if (urlList.length === 0) {
        throw new Error('No valid URLs provided');
      }

      console.log('Starting recipe extraction for URLs:', urlList);

      // Extract recipe data using our service
      try {
        const jsonContent = await extractRecipeData(urlList);
        console.log('Recipe data extracted, received content:', jsonContent.substring(0, 200) + '...');
      
        // Validate and format the JSON
        try {
          console.log('Attempting to parse the extracted JSON in component');
          const parsedJson = JSON.parse(jsonContent);
          
          // Check if we received an error response
          if (parsedJson.error) {
            console.log('Received error response from API:', parsedJson.error);
            throw new Error(parsedJson.error);
          }
          
          console.log('JSON parsed successfully in component, formatting...');
          const formattedJson = JSON.stringify(parsedJson, null, 2);
          setExtractedJson(formattedJson);
          
          toast({
            title: 'Recipe Extracted',
            description: 'Recipe data was successfully extracted from the URL(s).',
            variant: 'default',
          });
        } catch (parseError) {
          if (parseError.message === "Could not access the URL or extract recipe data") {
            // This is a known error from our API
            console.error('API returned error:', parseError.message);
            throw new Error(`The API could not access the URL or extract recipe data. Please try a different URL or use the "test" URL for testing.`);
          } else {
            console.error('Error parsing JSON in component:', parseError);
            console.log('Content that failed to parse:', jsonContent);
            throw new Error('Failed to parse the extracted recipe data. Please check browser console for details.');
          }
        }
      } catch (extractionError) {
        console.error('Extraction error:', extractionError);
        throw extractionError;
      }
    } catch (error) {
      console.error('Overall extraction process error:', error);
      toast({
        title: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!extractedJson) {
      toast({
        title: 'No Recipe Data',
        description: 'Please extract recipe data before importing.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setImportResult(null);

    try {
      // Parse the JSON to make sure it's valid
      let recipeData;
      try {
        recipeData = JSON.parse(extractedJson);
      } catch (error) {
        throw new Error('Invalid JSON format. Please check the recipe data.');
      }

      // Handle both single recipe and array of recipes
      const recipes = Array.isArray(recipeData) ? recipeData : [recipeData];
      let successCount = 0;
      let failureCount = 0;
      let lastImportedRecipeName = '';

      // Import each recipe
      for (const recipe of recipes) {
        // Process and import the recipe
        const result = await processAndImportJsonRecipe(JSON.stringify(recipe));
        
        if (result.success) {
          successCount++;
          lastImportedRecipeName = recipe.title;
        } else {
          failureCount++;
        }
      }

      if (successCount > 0) {
        setImportResult({
          success: true,
          recipeName: successCount === 1 ? lastImportedRecipeName : `${successCount} recipes`
        });
        
        toast({
          title: 'Recipe Import Complete',
          description: `Successfully imported ${successCount} out of ${recipes.length} recipes.`,
          variant: 'default',
        });
      } else {
        setImportResult({
          success: false,
          error: 'Failed to import any recipes'
        });
        
        toast({
          title: 'Import Failed',
          description: 'Failed to import any recipes. Please check the recipe data.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: 'Import Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!extractedJson) {
      toast({
        title: 'No Recipe Data',
        description: 'Please extract recipe data first.',
        variant: 'destructive',
      });
      return;
    }

    // Create a blob with the JSON data
    const blob = new Blob([extractedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and click it to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'extracted_recipe.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'JSON Downloaded',
      description: 'Recipe data has been downloaded as a JSON file.',
      variant: 'default',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Extract Recipes with ChatGPT</CardTitle>
        <CardDescription>
          Enter recipe URLs and use ChatGPT to automatically extract structured recipe data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Enter your OpenAI API key (or set in .env file)"
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              disabled={isLoading || isSavingKey}
              className="flex-grow"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSaveApiKey}
              disabled={isLoading || isSavingKey || !apiKey.trim()}
              className="whitespace-nowrap"
            >
              {isSavingKey ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Key
            </Button>
            {hasApiKey() && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearApiKey}
                disabled={isLoading || isSavingKey}
              >
                <Key className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasApiKey() && apiKey === '' 
              ? "Using API key from environment variable or saved key"
              : "Your API key will be saved for this session only. Alternatively, set VITE_OPENAI_API_KEY in your .env file."
            }
          </p>
        </div>
        
        <div className="space-y-2">
          <Textarea
            placeholder="Enter recipe URLs (one per line)"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            rows={3}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Example: https://www.allrecipes.com/recipe/21261/yummy-sweet-potato-casserole/
          </p>
        </div>

        {extractedJson && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Extracted Recipe Data:</h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadJson}
                disabled={isLoading}
              >
                <Download className="h-4 w-4 mr-1" />
                Download JSON
              </Button>
            </div>
            <Textarea
              value={extractedJson}
              readOnly
              rows={8}
              className="font-mono text-xs"
            />
          </div>
        )}

        {importResult && (
          <div className={`p-3 rounded-md flex items-start gap-2 ${
            importResult.success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            <div>
              <p className="text-sm font-medium">
                {importResult.success ? 'Recipe Imported Successfully' : 'Import Failed'}
              </p>
              {importResult.success ? (
                <p className="text-xs mt-1">Successfully imported "{importResult.recipeName}"</p>
              ) : (
                <p className="text-xs mt-1">{importResult.error}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          variant="outline"
          onClick={handleExtract}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" />
              Extract Recipe
            </>
          )}
        </Button>
        
        <Button 
          onClick={handleImport}
          disabled={isLoading || !extractedJson}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <FileJson className="mr-2 h-4 w-4" />
              Import Recipe
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ChatGptRecipeExtractor; 