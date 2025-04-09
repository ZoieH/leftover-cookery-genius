import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { isSupportedWebsite, supportedWebsites, scrapeAndSaveRecipe } from '@/services/scraperService';
import { Loader2 } from 'lucide-react';

const HomeRecipeImporter: React.FC = () => {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipeUrl.trim()) {
      toast({
        title: 'Enter a URL',
        description: 'Please enter a recipe URL to import',
        variant: 'destructive',
      });
      return;
    }
    
    // Basic URL validation
    try {
      new URL(recipeUrl);
    } catch (e) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }
    
    // We no longer need to check if website is supported
    
    setIsImporting(true);
    
    try {
      const result = await scrapeAndSaveRecipe(recipeUrl);
      
      if (result.success && result.recipe) {
        toast({
          title: 'Recipe Imported!',
          description: `"${result.recipe.title}" has been added to your collection.`,
        });
        setRecipeUrl('');
      } else {
        toast({
          title: 'Import Failed',
          description: result.error || 'Failed to import recipe',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      console.error('Recipe import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleImport}>
          <div className="space-y-3">
            <div className="flex items-center mb-2">
              <Link className="h-5 w-5 mr-2 text-primary" />
              <h3 className="text-lg font-medium">Import Recipe by URL</h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Have a favorite recipe? Paste its URL below to import it to your collection.
            </p>
            
            <div className="flex gap-2">
              <Input
                placeholder="https://www.anyrecipewebsite.com/recipe/..."
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
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
            
            <p className="text-xs text-muted-foreground">
              You can try any recipe URL - our system will attempt to extract the recipe details.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default HomeRecipeImporter; 