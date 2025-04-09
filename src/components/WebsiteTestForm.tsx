import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { testWebsiteScraping, supportedWebsites, isSupportedWebsite } from '@/services/scraperService';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const WebsiteTestForm: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a URL to test',
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
    
    // We no longer need to check if the website is supported since we're allowing all URLs
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testWebsiteScraping(url);
      
      setTestResult(result);
      
      toast({
        title: result.success ? 'Success!' : 'Test Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      
      toast({
        title: 'Error',
        description: 'An unexpected error occurred during testing',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Website Scrape Testing</CardTitle>
        <CardDescription>
          Test if a recipe website can be scraped before importing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="test-url" className="text-sm font-medium mb-2 block">
              Recipe URL
            </label>
            <div className="flex gap-2">
              <Input
                id="test-url"
                placeholder="https://www.anyrecipewebsite.com/recipe/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isTesting}
                className="flex-1"
              />
              <Button type="submit" disabled={isTesting}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : 'Test URL'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You can test any recipe URL. Best results come from sites that use structured recipe data.
            </p>
          </div>
        </form>
        
        {testResult && (
          <div className={`mt-4 p-3 rounded-md ${testResult.success ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
            <div className="flex gap-2 items-center">
              {testResult.success ? (
                <Check className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span>
                {testResult.success 
                  ? 'Website can be scraped! You can proceed with importing recipes.' 
                  : `Cannot scrape this website: ${testResult.message}`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Test results are based on the website's response to a simple request. Some sites may be accessible but contain recipes in formats we can't parse.
      </CardFooter>
    </Card>
  );
};

export default WebsiteTestForm; 