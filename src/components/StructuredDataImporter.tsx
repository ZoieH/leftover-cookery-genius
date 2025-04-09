import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { useToast } from './ui/use-toast';
import { Loader2, CheckCircle, AlertCircle, Link } from 'lucide-react';
import { testWebsiteScraping, scrapeAndSaveRecipe } from '@/services/scraperService';

const StructuredDataImporter: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; title?: string; error?: string } | null>(null);
  const { toast } = useToast();

  const handleTestUrl = async () => {
    if (!url.trim()) {
      toast({
        title: 'URL Required',
        description: 'Please enter a recipe URL to test.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    setImportResult(null);

    try {
      // Validate URL format first
      try {
        new URL(url);
      } catch (error) {
        setTestResult({ success: false, message: 'Invalid URL format' });
        setIsLoading(false);
        return;
      }

      // Test if the URL can be accessed through our proxy
      const result = await testWebsiteScraping(url);
      setTestResult(result);
      
      if (result.success) {
        toast({
          title: 'Website Test Successful',
          description: 'The website can be accessed. You can now import the recipe.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Website Test Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      toast({
        title: 'Test Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!url.trim()) {
      toast({
        title: 'URL Required',
        description: 'Please enter a recipe URL to import.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setImportResult(null);

    try {
      // If we haven't tested the URL yet, do it now
      if (!testResult) {
        const testResponse = await testWebsiteScraping(url);
        setTestResult(testResponse);
        
        if (!testResponse.success) {
          setImportResult({
            success: false,
            error: `Cannot access website: ${testResponse.message}`
          });
          toast({
            title: 'Import Failed',
            description: `Cannot access website: ${testResponse.message}`,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      // Try to import the recipe
      const result = await scrapeAndSaveRecipe(url);
      
      if (result.success && result.recipe) {
        setImportResult({
          success: true,
          title: result.recipe.title
        });
        
        toast({
          title: 'Recipe Imported',
          description: `Successfully imported "${result.recipe.title}"`,
          variant: 'default',
        });
      } else {
        setImportResult({
          success: false,
          error: result.error || 'Unknown error'
        });
        
        toast({
          title: 'Import Failed',
          description: result.error || 'Failed to import recipe',
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Recipe with Structured Data</CardTitle>
        <CardDescription>
          Import recipes from websites using JSON-LD structured data.
          This is the most reliable method for extracting recipe information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="url"
            placeholder="Enter recipe URL (e.g., https://www.example.com/recipe)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            <Link className="h-3 w-3 inline-block mr-1" />
            This method works best with sites that use standardized recipe markup.
          </p>
        </div>

        {testResult && (
          <div className={`p-3 rounded-md flex items-start gap-2 ${
            testResult.success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {testResult.success ? 'Website Test Successful' : 'Website Test Failed'}
              </p>
              <p className="text-xs mt-1">{testResult.message}</p>
            </div>
          </div>
        )}

        {importResult && (
          <div className={`p-3 rounded-md flex items-start gap-2 ${
            importResult.success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            {importResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {importResult.success ? 'Recipe Imported Successfully' : 'Import Failed'}
              </p>
              {importResult.success ? (
                <p className="text-xs mt-1">Successfully imported "{importResult.title}"</p>
              ) : (
                <p className="text-xs mt-1">{importResult.error}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleTestUrl}
          disabled={isLoading}
        >
          {isLoading && !importResult ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Test URL
        </Button>
        <Button 
          onClick={handleImport}
          disabled={isLoading}
        >
          {isLoading && importResult === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Import Recipe
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StructuredDataImporter; 