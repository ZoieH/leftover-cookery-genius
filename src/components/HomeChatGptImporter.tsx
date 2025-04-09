import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Loader2, FileJson } from 'lucide-react';
import { processAndImportJsonRecipe } from '@/utils/recipeImport';
import { hasApiKey, extractRecipeData } from '@/services/apiKeyService';

const HomeChatGptImporter: React.FC = () => {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    recipeName?: string;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!recipeUrl.trim()) {
      toast({
        title: 'URL Required',
        description: 'Please enter a recipe URL to import.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasApiKey()) {
      toast({
        title: 'API Key Required',
        description: 'Please add your OpenAI API key in .env file or set it in the Admin page.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setImportResult(null);

    try {
      // Clean the URL first
      const cleanedUrl = recipeUrl.trim().replace(/^[:\s]+/, '');
      console.log('Starting recipe extraction and import for URL:', cleanedUrl);
      
      // Extract recipe data using the apiKeyService
      try {
        const jsonContent = await extractRecipeData([cleanedUrl]);
        console.log('Recipe data extracted, attempting to parse');
        
        // Try to parse the JSON
        try {
          const recipeData = JSON.parse(jsonContent);
          console.log('JSON successfully parsed:', recipeData);
          
          // Check if we received an error response
          if (recipeData.error) {
            throw new Error(recipeData.error);
          }
          
          // Import the recipe
          console.log('Importing recipe to database');
          await processAndImportJsonRecipe(recipeData);
          console.log('Recipe successfully imported');
          
          // Show success message
          setImportResult({
            success: true,
            recipeName: Array.isArray(recipeData) 
              ? recipeData.map(r => r.title).join(', ')
              : recipeData.title
          });
          
          setRecipeUrl('');
        } catch (parseError) {
          console.error('Error parsing extracted JSON:', parseError);
          console.log('Content that failed to parse:', jsonContent);
          throw new Error('Failed to parse the extracted recipe data');
        }
      } catch (extractionError) {
        console.error('Error during recipe extraction:', extractionError);
        throw extractionError;
      }
    } catch (error) {
      console.error('Overall import process error:', error);
      setImportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import recipe'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import Recipe with ChatGPT</CardTitle>
        <CardDescription>
          Enter a recipe URL to extract and import it automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter recipe URL"
            value={recipeUrl}
            onChange={(e) => setRecipeUrl(e.target.value)}
            disabled={isLoading}
            className="flex-grow"
          />
          <Button 
            onClick={handleImport}
            disabled={isLoading || !recipeUrl.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileJson className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </div>
        
        {!hasApiKey() && (
          <p className="text-xs text-amber-500">
            Note: You need to set your OpenAI API key in the .env file or Admin page before using this feature.
          </p>
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
    </Card>
  );
};

export default HomeChatGptImporter; 