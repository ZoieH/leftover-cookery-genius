import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, AlertCircle, Database, ListFilter, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { 
  bulkScrapeRecipes, 
  recipeUrlLists, 
  getAllRecipeUrlsToScrape, 
  bulkTestRecipeUrls,
  autoTestAndScrapeUrls
} from '@/utils/bulkScraper';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Define the available operation modes
type OperationMode = 'scrape' | 'test' | 'auto';

const BulkRecipeScraper: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [category, setCategory] = useState<keyof typeof recipeUrlLists | 'all' | 'custom'>('all');
  const [customUrls, setCustomUrls] = useState('');
  const [operationMode, setOperationMode] = useState<OperationMode>('scrape');
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    total: number;
    testedUrls?: number;
    validUrls?: number;
    details: Array<{ title: string; url: string; }>;
  } | null>(null);
  const { toast } = useToast();

  // Helper function to parse URLs from the textarea
  const parseCustomUrls = (): string[] => {
    return customUrls
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('http'));
  };

  // Start the selected operation (test, scrape, or auto)
  const handleOperation = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setProgress(0);
    setResult(null);
    
    try {
      // Determine which URLs to process based on the selected category
      let urlsToProcess: string[] = [];
      
      if (category === 'custom') {
        urlsToProcess = parseCustomUrls();
      } else if (category === 'all') {
        urlsToProcess = await getAllRecipeUrlsToScrape();
      } else {
        urlsToProcess = [...recipeUrlLists[category]];
      }
      
      if (urlsToProcess.length === 0) {
        toast({
          title: 'No URLs to Process',
          description: 'There are no valid URLs to process in this category.',
          variant: 'destructive',
        });
        setIsRunning(false);
        return;
      }
      
      // Execute the appropriate operation based on the selected mode
      switch (operationMode) {
        case 'test': 
          await handleTestOnly(urlsToProcess);
          break;
        case 'scrape':
          await handleScrapeOnly(urlsToProcess);
          break;
        case 'auto':
          await handleAutoTestAndScrape(urlsToProcess);
          break;
      }
      
    } catch (error) {
      console.error('Operation error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Handle test-only mode
  const handleTestOnly = async (urls: string[]) => {
    toast({
      title: 'Bulk Testing Started',
      description: `Testing ${urls.length} URLs for scraping compatibility...`,
    });
    
    const testResult = await bulkTestRecipeUrls(urls, (current, total) => {
      const progressPercent = Math.round((current / total) * 100);
      setProgress(progressPercent);
    });
    
    setResult({
      success: testResult.successful,
      failed: testResult.failed.length,
      total: testResult.total,
      details: testResult.validUrls.map(url => ({ title: url, url })),
    });
    
    toast({
      title: 'Bulk Testing Completed',
      description: `${testResult.successful} out of ${testResult.total} URLs can be scraped.`,
      variant: 'default',
    });
  };

  // Handle scrape-only mode
  const handleScrapeOnly = async (urls: string[]) => {
    toast({
      title: 'Bulk Scraping Started',
      description: `Starting to scrape ${urls.length} recipes...`,
    });
    
    const scrapeResult = await bulkScrapeRecipes(urls, (current, total) => {
      const progressPercent = Math.round((current / total) * 100);
      setProgress(progressPercent);
    });
    
    setResult({
      success: scrapeResult.successful,
      failed: scrapeResult.failed.length,
      total: scrapeResult.totalAttempted,
      details: scrapeResult.successfulRecipes,
    });
    
    toast({
      title: 'Bulk Scraping Completed',
      description: `Successfully imported ${scrapeResult.successful} out of ${scrapeResult.totalAttempted} recipes.`,
      variant: scrapeResult.successful > 0 ? 'default' : 'destructive',
    });
  };

  // Handle auto test-then-scrape mode
  const handleAutoTestAndScrape = async (urls: string[]) => {
    toast({
      title: 'Auto Test & Scrape Started',
      description: `Testing and scraping ${urls.length} URLs...`,
    });
    
    const autoResult = await autoTestAndScrapeUrls(
      urls, 
      (current, total, phase) => {
        // Calculate overall progress based on the current phase
        const baseProgress = phase === 'testing' ? 0 : 50;
        const phaseProgress = Math.round((current / total) * 50); // Each phase is 50% of the total
        setProgress(baseProgress + phaseProgress);
      }
    );
    
    setResult({
      success: autoResult.scrapedUrls,
      failed: autoResult.testedUrls - autoResult.validUrls + (autoResult.validUrls - autoResult.scrapedUrls),
      total: autoResult.testedUrls,
      testedUrls: autoResult.testedUrls,
      validUrls: autoResult.validUrls,
      details: autoResult.recipes,
    });
    
    toast({
      title: 'Auto Test & Scrape Completed',
      description: `Tested ${autoResult.testedUrls} URLs, ${autoResult.validUrls} were valid, and successfully imported ${autoResult.scrapedUrls} recipes.`,
      variant: autoResult.scrapedUrls > 0 ? 'default' : 'destructive',
    });
  };

  // Get the operation button text based on the selected mode
  const getOperationButtonText = () => {
    if (isRunning) {
      switch (operationMode) {
        case 'test': return 'Testing URLs...';
        case 'scrape': return 'Scraping Recipes...';
        case 'auto': return 'Testing & Scraping...';
      }
    } else {
      switch (operationMode) {
        case 'test': return 'Start Bulk Testing';
        case 'scrape': return 'Start Bulk Scraping';
        case 'auto': return 'Auto Test & Scrape';
      }
    }
  };

  // Get the operation button icon based on the selected mode
  const getOperationButtonIcon = () => {
    if (isRunning) {
      return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    } else {
      switch (operationMode) {
        case 'test': return <ListFilter className="mr-2 h-4 w-4" />;
        case 'scrape': return <Database className="mr-2 h-4 w-4" />;
        case 'auto': return <Zap className="mr-2 h-4 w-4" />;
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Recipe Processor</CardTitle>
        <CardDescription>
          Test, scrape, and import multiple recipes automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="all" onValueChange={(value) => setCategory(value as any)}>
          <TabsList className="grid grid-cols-6 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="quickMeals">Quick Meals</TabsTrigger>
            <TabsTrigger value="vegetarian">Vegetarian</TabsTrigger>
            <TabsTrigger value="desserts">Desserts</TabsTrigger>
            <TabsTrigger value="healthyOptions">Healthy</TabsTrigger>
            <TabsTrigger value="custom">Custom URLs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <p className="text-sm text-muted-foreground mb-2">
              Process all recipes from our pre-defined lists across all categories.
            </p>
          </TabsContent>
          
          <TabsContent value="quickMeals">
            <p className="text-sm text-muted-foreground mb-2">
              Quick and easy recipes that can be prepared in 30 minutes or less.
            </p>
          </TabsContent>
          
          <TabsContent value="vegetarian">
            <p className="text-sm text-muted-foreground mb-2">
              Delicious vegetarian recipes with no meat or fish ingredients.
            </p>
          </TabsContent>
          
          <TabsContent value="desserts">
            <p className="text-sm text-muted-foreground mb-2">
              Sweet treats, cakes, cookies and other dessert recipes.
            </p>
          </TabsContent>
          
          <TabsContent value="healthyOptions">
            <p className="text-sm text-muted-foreground mb-2">
              Nutritious and health-conscious recipes with whole ingredients.
            </p>
          </TabsContent>
          
          <TabsContent value="custom">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">
                Paste your own recipe URLs below, one per line. You can use any recipe website.
              </p>
              <Textarea 
                placeholder="https://example.com/recipe1&#10;https://example.com/recipe2&#10;https://example.com/recipe3"
                rows={5}
                value={customUrls}
                onChange={(e) => setCustomUrls(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex flex-col space-y-2">
          <div className="border rounded-md p-4">
            <h3 className="text-sm font-medium mb-3">Operation Mode</h3>
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center space-x-2">
                <Button
                  variant={operationMode === 'test' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOperationMode('test')}
                  disabled={isRunning}
                >
                  <ListFilter className="h-4 w-4 mr-1" />
                  Test Only
                </Button>
                <div className="text-xs text-muted-foreground ml-2">
                  Just check if URLs can be accessed
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant={operationMode === 'scrape' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOperationMode('scrape')}
                  disabled={isRunning}
                >
                  <Database className="h-4 w-4 mr-1" />
                  Scrape All
                </Button>
                <div className="text-xs text-muted-foreground ml-2">
                  Try to scrape all URLs directly
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant={operationMode === 'auto' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOperationMode('auto')}
                  disabled={isRunning}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Auto Test & Scrape
                </Button>
                <div className="text-xs text-muted-foreground ml-2">
                  Test first, then only scrape valid URLs
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {operationMode === 'test' ? 'Testing in progress...' : 
                 operationMode === 'scrape' ? 'Scraping in progress...' : 
                 'Testing & scraping in progress...'}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {result && (
          <div className={`p-4 rounded-md ${
            result.success > 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-destructive/10'
          }`}>
            <div className="flex items-start gap-3">
              {result.success > 0 ? (
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              )}
              <div>
                <h4 className="font-medium">
                  {operationMode === 'test' ? 'Testing Results' : 
                   operationMode === 'scrape' ? 'Scraping Results' : 
                   'Test & Scrape Results'}
                </h4>
                
                {operationMode === 'test' && (
                  <p className="text-sm mt-1">
                    {result.success} out of {result.total} URLs can be scraped.
                    {result.failed > 0 && ` ${result.failed} URLs failed testing.`}
                  </p>
                )}
                
                {operationMode === 'scrape' && (
                  <p className="text-sm mt-1">
                    Successfully imported {result.success} out of {result.total} recipes.
                    {result.failed > 0 && ` Failed to import ${result.failed} recipes.`}
                  </p>
                )}
                
                {operationMode === 'auto' && (
                  <p className="text-sm mt-1">
                    Tested {result.total} URLs. {result.validUrls} passed testing.
                    Successfully imported {result.success} recipes.
                  </p>
                )}
                
                {operationMode === 'test' ? (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium mb-1">Valid URLs:</h5>
                    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                      {result.details.map((item, index) => (
                        <li key={index}>• {item.url}</li>
                      ))}
                    </ul>
                  </div>
                ) : result.details.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium mb-1">Imported Recipes:</h5>
                    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                      {result.details.map((recipe, index) => (
                        <li key={index}>• {recipe.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleOperation} 
          disabled={isRunning}
          className="w-full"
        >
          {getOperationButtonIcon()}
          {getOperationButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BulkRecipeScraper; 