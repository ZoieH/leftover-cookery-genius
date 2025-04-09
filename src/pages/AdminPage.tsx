import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import AdminSeedDatabase from '@/components/AdminSeedDatabase';
import JsonRecipeImporter from '@/components/JsonRecipeImporter';
import ChatGptRecipeExtractor from '@/components/ChatGptRecipeExtractor';
import BulkRecipeScraper from '@/components/BulkRecipeScraper';
import RecipeImporter from '@/components/RecipeImporter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// You can change this password to anything you want
const ADMIN_PASSWORD = 'zoiecreate';

const AdminPage = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already authenticated
  useEffect(() => {
    const adminAuth = sessionStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
      toast({
        title: "Success",
        description: "Welcome to the admin panel",
      });
    } else {
      toast({
        title: "Error",
        description: "Invalid password",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-md mx-auto py-12">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold">Admin Access</h1>
              <p className="text-sm text-muted-foreground">
                Please enter the admin password to continue
              </p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Admin Panel</h1>
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem('adminAuth');
                setIsAuthenticated(false);
                navigate('/');
              }}
            >
              Logout
            </Button>
          </div>
          
          <div className="grid gap-6">
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Recipe Management</h2>
              <Tabs defaultValue="chatgpt" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                  <TabsTrigger value="chatgpt">ChatGPT Extractor</TabsTrigger>
                  <TabsTrigger value="importer">URL Importer</TabsTrigger>
                  <TabsTrigger value="json">JSON Importer</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk Scraper</TabsTrigger>
                </TabsList>
                
                <TabsContent value="chatgpt" className="mt-0">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Simply paste recipe URLs and let ChatGPT automatically extract and structure the recipe data for you.
                      This is the fastest way to import recipes from any website.
                    </p>
                    <ChatGptRecipeExtractor />
                  </div>
                </TabsContent>
                
                <TabsContent value="importer" className="mt-0">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Import recipes directly from recipe websites. You can now test importing from any URL.
                    </p>
                    <RecipeImporter />
                  </div>
                </TabsContent>
                
                <TabsContent value="json" className="mt-0">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Import recipes by pasting structured JSON data from recipe APIs or other sources.
                      This is useful when you already have recipe data in JSON format.
                    </p>
                    <JsonRecipeImporter />
                  </div>
                </TabsContent>
                
                <TabsContent value="bulk" className="mt-0">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Bulk scrape recipes from supported websites or enter your own list of URLs to scrape.
                    </p>
                    <BulkRecipeScraper />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">User Statistics</h2>
              {/* Add user statistics */}
            </div>
          </div>
          
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="text-2xl font-semibold mb-6">Database Management</h2>
            <AdminSeedDatabase />
          </div>
          
          <div className="mt-16 border-t border-border pt-8">
            <h3 className="text-lg font-medium mb-4">Firebase Configuration Instructions</h3>
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p className="mb-2">To set up Firebase:</p>
              <ol className="list-decimal ml-5 space-y-2">
                <li>Go to <a href="https://firebase.google.com/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">firebase.google.com</a> and create a new project</li>
                <li>In the Firebase console, add a web app to your project</li>
                <li>Copy the configuration values to your <code className="bg-muted-foreground/20 px-1 py-0.5 rounded">.env</code> file</li>
                <li>Set up Firestore Database in the Firebase console</li>
                <li>Set security rules to allow read/write access</li>
                <li>Use this page to seed your database with initial recipes</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminPage; 