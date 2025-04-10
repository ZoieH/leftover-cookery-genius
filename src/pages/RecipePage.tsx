import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Printer, Share2, Info, Play, Video, Circle, Loader2, Plus, Wand2, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import IngredientCategoryIcon from '@/components/IngredientCategoryIcon';
import type { Recipe } from '@/types/recipe';
import Layout from '@/components/Layout';

const RecipePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [videoMode, setVideoMode] = useState(false);
  const [showQuantity, setShowQuantity] = useState(true);
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  
  useEffect(() => {
    // Load recipes from session storage
    const loadRecipes = () => {
      try {
        const savedRecipes = sessionStorage.getItem('matching_recipes');
        if (savedRecipes) {
          const parsedRecipes = JSON.parse(savedRecipes) as Recipe[];
          if (parsedRecipes.length > 0) {
            setRecipes(parsedRecipes);
            
            // Convert recipe ingredients to the format expected by the UI
            const currentRecipe = parsedRecipes[0];
            setIngredients(currentRecipe.ingredients.map((ing, index) => ({
              id: index.toString(),
              name: ing,
              amount: '1',  // We'll improve this with better data
              detail: '',
              checked: false
            })));
            
            setLoading(false);
            return;
          }
        }
        
        // If we get here, either no recipes were found or there was an error
        setLoading(false); // Make sure to set loading to false
        setRecipes([]); // Set recipes to empty array to trigger the no-recipes view
        
      } catch (error) {
        console.error('Error loading recipes:', error);
        setLoading(false); // Make sure to set loading to false
        setRecipes([]); // Set recipes to empty array to trigger the no-recipes view
      }
    };
    
    loadRecipes();
  }, [navigate, toast]);
  
  const handleShare = () => {
    toast({
      title: "Share feature",
      description: "In a real app, this would open sharing options.",
    });
  };
  
  const handlePrint = () => {
    window.print();
  };

  const toggleIngredientCheck = (id: string) => {
    setIngredients(
      ingredients.map(ingredient => 
        ingredient.id === id 
          ? { ...ingredient, checked: !ingredient.checked } 
          : ingredient
      )
    );
  };

  const setScale = (scale: number) => {
    setScaleMultiplier(scale);
  };
  
  // Function to scale ingredient amounts based on multiplier
  const scaleAmount = (amount: string): string => {
    if (!amount) return '';
    
    // Extract the numeric part
    const match = amount.match(/^([\d./]+)(.*)$/);
    if (!match) return amount;
    
    let numericPart = match[1];
    const textPart = match[2];
    
    // Handle fractions
    if (numericPart.includes('/')) {
      const [numerator, denominator] = numericPart.split('/');
      const decimal = parseFloat(numerator) / parseFloat(denominator);
      const scaled = decimal * scaleMultiplier;
      
      // Convert back to a nice fraction or decimal
      if (Math.floor(scaled) === scaled) {
        return `${scaled}${textPart}`;
      } else {
        // Approximate as a fraction
        return `${scaled.toFixed(1)}${textPart}`;
      }
    }
    
    // Handle regular numbers
    const numeric = parseFloat(numericPart);
    if (isNaN(numeric)) return amount;
    
    const scaled = numeric * scaleMultiplier;
    return `${scaled % 1 === 0 ? scaled : scaled.toFixed(1)}${textPart}`;
  };
  
  const handleBackClick = () => {
    // Navigate back to ingredients page with step 2 (recipe list)
    sessionStorage.setItem('ingredients_page_step', '2');
    navigate('/ingredients');
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading recipes...</p>
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <div className="text-center max-w-md space-y-4">
          <h2 className="text-2xl font-semibold">No Recipes Found</h2>
          <p className="text-muted-foreground">
            It looks like you haven't added any recipes yet. You can:
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/import')}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Import a Recipe
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/suggestions')}
              className="w-full"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Get AI Suggestions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // The current recipe to display
  const currentRecipe = recipes[0];
  
  return (
    <Layout>
      <div className="container max-w-4xl mx-auto p-4 space-y-8">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ingredients
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Hero section with image */}
        <div className="relative mb-6">
          <div className="w-36 h-36 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg bg-muted">
            {currentRecipe.image ? (
              <img 
                src={currentRecipe.image}
                alt={currentRecipe.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // If image fails to load, replace with placeholder
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder.svg';
                  target.onerror = null; // Prevent infinite loop if placeholder also fails
                }}
              />
            ) : (
              // Show placeholder if no image is provided
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <svg
                  className="w-12 h-12 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="m4.93 4.93 4.24 4.24" />
                  <path d="m14.83 4.93 4.24 4.24" />
                  <path d="M12 2v8" />
                </svg>
              </div>
            )}
          </div>
          <div className="bg-card text-card-foreground text-center py-8 -mt-16 pt-20 rounded-lg border shadow-sm">
            <h1 className="text-2xl font-bold mb-2">{currentRecipe.title}</h1>
            <Separator className="w-3/4 mx-auto my-3 bg-border" />
            
            {/* Recipe meta */}
            <div className="flex justify-center items-center gap-6 text-sm mt-3">
              <div className="flex items-center gap-1 text-muted-foreground">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{currentRecipe.prepTime} + {currentRecipe.cookTime}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Serves {currentRecipe.servings}</span>
              </div>
              {currentRecipe.calories > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                    <line x1="6" y1="1" x2="6" y2="4"></line>
                    <line x1="10" y1="1" x2="10" y2="4"></line>
                    <line x1="14" y1="1" x2="14" y2="4"></line>
                  </svg>
                  <span>{currentRecipe.calories} calories</span>
                </div>
              )}
            </div>
            
            {/* Dietary tags */}
            {currentRecipe.dietaryTags && currentRecipe.dietaryTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {currentRecipe.dietaryTags.map((tag, index) => (
                  <span key={index} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Recipe Description */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Description</h2>
          <p className="text-muted-foreground whitespace-pre-line">{currentRecipe.description}</p>
        </div>
        
        {/* Source Attribution */}
        {(currentRecipe.sourceUrl || currentRecipe.author || currentRecipe.attribution) && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Source</h2>
            <div className="text-muted-foreground space-y-2">
              {currentRecipe.author && (
                <p>Author: {currentRecipe.author}</p>
              )}
              {currentRecipe.sourceUrl && (
                <p>
                  Source: <a 
                    href={currentRecipe.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {new URL(currentRecipe.sourceUrl).hostname}
                  </a>
                </p>
              )}
              {currentRecipe.attribution && (
                <p className="text-sm italic">{currentRecipe.attribution}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Recipe controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="quantity-toggle">Show quantities</Label>
                <Switch 
                  id="quantity-toggle" 
                  checked={showQuantity} 
                  onCheckedChange={setShowQuantity} 
                />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Servings:</span>
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => setScale(Math.max(0.5, scaleMultiplier - 0.5))}
                >-</Button>
                <span className="w-8 text-center">{scaleMultiplier}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => setScale(Math.min(10, scaleMultiplier + 0.5))}
                >+</Button>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Ingredients */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
          <Card className="p-4">
            <div className="space-y-2">
              {currentRecipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Checkbox 
                    id={`ingredient-${index}`} 
                    checked={ingredients[index]?.checked || false} 
                    onCheckedChange={() => toggleIngredientCheck(index.toString())}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={`ingredient-${index}`} 
                      className={`${ingredients[index]?.checked ? 'line-through text-muted-foreground' : ''}`}
                    >
                      <span className="font-medium">{ingredient}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        
        {/* Instructions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Instructions</h2>
            <div className="flex items-center gap-2">
              <Label htmlFor="video-toggle" className="text-sm">Video mode</Label>
              <Switch 
                id="video-toggle" 
                checked={videoMode} 
                onCheckedChange={setVideoMode} 
              />
            </div>
          </div>
          
          <div className="space-y-6">
            {currentRecipe.instructions.map((instruction, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-none">
                  {videoMode ? (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      <Play size={16} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p>{instruction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Back to ingredients button */}
        <div className="flex justify-center mt-12">
          <Button 
            variant="outline" 
            onClick={handleBackClick}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ingredients
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default RecipePage;