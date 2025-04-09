import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { scrapeAndSaveRecipe, supportedWebsites, isSupportedWebsite } from '@/services/scraperService';
import { useToast } from '@/components/ui/use-toast';

const RecipeImporter: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a recipe URL',
        variant: 'destructive',
      });
      return;
    }
    
    // Basic URL validation
    try {
      new URL(url);
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }
    
    // We no longer need to check if website is supported
    
    setIsImporting(true);
    setResult(null);
    
    try {
      const importResult = await scrapeAndSaveRecipe(url);
      
      if (importResult.success) {
        setResult({
          success: true,
          message: `Successfully imported: ${importResult.recipe?.title}`,
        });
        
        toast({
          title: 'Success',
          description: `Recipe "${importResult.recipe?.title}" imported successfully!`,
        });
        
        // Clear the form
        setUrl('');
      } else {
        setResult({
          success: false,
          message: importResult.error || 'Unknown error occurred',
        });
        
        toast({
          title: 'Import Failed',
          description: importResult.error || 'Failed to import recipe',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while importing',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import Recipe</CardTitle>
        <CardDescription>
          Import a recipe from any recipe website
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="recipe-url" className="text-sm font-medium mb-2 block">
              Recipe URL
            </label>
            <div className="flex gap-2">
              <Input
                id="recipe-url"
                placeholder="https://www.anyrecipewebsite.com/recipe/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isImporting}
                className="flex-1"
              />
              <Button type="submit" disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : 'Import'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You can try importing from any recipe website. Success depends on how the recipe data is structured.
            </p>
          </div>
        </form>
        
        {result && (
          <div className={`mt-4 p-3 rounded-md ${result.success ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}`}>
            <div className="flex gap-2 items-center">
              {result.success ? (
                <Check className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span>{result.message}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Recipes will be imported into your personal collection. If importing fails, try using the "Test Website" tool first.
      </CardFooter>
    </Card>
  );
};

export default RecipeImporter; 