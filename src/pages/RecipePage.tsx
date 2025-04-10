import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, Printer, Share2, Info, Play, Video, Circle, Loader2, Plus, Wand2, Minus, Bookmark } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import IngredientCategoryIcon from '@/components/IngredientCategoryIcon';
import type { Recipe } from '@/types/recipe';
import Layout from '@/components/Layout';
import Fraction from 'fraction.js';
import { canUsePremiumFeature } from '@/services/usageService';
import PaywallModal from '@/components/PaywallModal';
import { saveRecipe, unsaveRecipe, isRecipeSaved } from '@/services/recipeService';
import { useAuthStore } from '@/services/firebaseService';
import AuthModal from '@/components/AuthModal';
import { cn } from '@/lib/utils';

const RecipePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [showQuantity, setShowQuantity] = useState(true);
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  const [baseServings, setBaseServings] = useState<number>(1);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isCheckingSaved, setIsCheckingSaved] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user } = useAuthStore();
  
  // The current recipe to display
  const currentRecipe = recipes[0];
  
  useEffect(() => {
    // Load recipes from session storage
    const storedRecipes = sessionStorage.getItem('matching_recipes');
    console.log('Stored recipes from session storage:', storedRecipes);
    
    if (storedRecipes) {
      const parsedRecipes = JSON.parse(storedRecipes);
      console.log('Parsed recipes:', parsedRecipes);
      setRecipes(parsedRecipes);
      
      // Set base servings from the first recipe
      if (parsedRecipes.length > 0 && parsedRecipes[0].servings) {
        setBaseServings(Number(parsedRecipes[0].servings));
      }
      
      // Parse ingredients
      if (parsedRecipes.length > 0 && parsedRecipes[0].ingredients) {
        try {
          console.log('Starting to parse ingredients:', parsedRecipes[0].ingredients);
          
          // Handle both string and object formats for ingredients
          const parsedIngredients = parsedRecipes[0].ingredients.map((ingredient: any) => {
            // If ingredient is already an object (from saved recipes) return it as is
            if (typeof ingredient === 'object' && ingredient !== null) {
              console.log('Ingredient is already an object:', ingredient);
              return ingredient;
            }
            
            if (typeof ingredient !== 'string') {
              console.warn('Unexpected ingredient format:', ingredient);
              return { quantity: null, unit: '', name: String(ingredient) };
            }
            
            // Otherwise parse the string
            const match = ingredient.match(/^([\d./\s]+)?\s*([a-zA-Z]+)?\s+(.+)$/);
            if (match) {
              const [_, quantity, unit, name] = match;
              let parsedQuantity = null;
              if (quantity) {
                try {
                  // Handle fractions like "1/2" or "1 1/2"
                  const parts = quantity.trim().split(' ');
                  if (parts.length > 1) {
                    // Mixed number (e.g., "1 1/2")
                    const whole = parseFloat(parts[0]);
                    try {
                      const fraction = new Fraction(parts[1]);
                      parsedQuantity = whole + fraction.valueOf();
                    } catch (e) {
                      parsedQuantity = whole;
                    }
                  } else if (quantity.includes('/')) {
                    // Simple fraction (e.g., "1/2")
                    try {
                      parsedQuantity = new Fraction(quantity).valueOf();
                    } catch (e) {
                      parsedQuantity = parseFloat(quantity) || null;
                    }
                  } else {
                    // Simple number
                    parsedQuantity = parseFloat(quantity);
                  }
                } catch (e) {
                  console.warn('Failed to parse quantity:', quantity);
                  parsedQuantity = null;
                }
              }
              return {
                quantity: parsedQuantity,
                unit: unit || '',
                name: name.trim()
              };
            }
            return { quantity: null, unit: '', name: ingredient };
          });
          
          console.log('Parsed ingredients:', parsedIngredients);
          setIngredients(parsedIngredients);
        } catch (error) {
          console.error('Error parsing ingredients:', error);
          // Fallback to raw ingredients if parsing fails
          setIngredients(parsedRecipes[0].ingredients.map((ingredient: any) => 
            typeof ingredient === 'string' 
              ? { quantity: null, unit: '', name: ingredient }
              : ingredient
          ));
        }
      }
    } else {
      console.log('No recipes found in session storage');
    }
    setLoading(false);
  }, []);
  
  // Add console log for recipes state changes
  useEffect(() => {
    console.log('Current recipes state:', recipes);
    console.log('Current recipe:', recipes[0]);
  }, [recipes]);
  
  // Update scale multiplier when servings change
  useEffect(() => {
    if (currentRecipe && baseServings > 0) {
      // Fix: baseServings (what user wants) divided by recipe's original servings
      setScaleMultiplier(baseServings / Number(currentRecipe.servings));
    }
  }, [currentRecipe?.servings, baseServings]);
  
  // Check if the recipe is saved
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (user && recipes.length > 0) {
        setIsCheckingSaved(true);
        try {
          const saved = await isRecipeSaved(user.uid, String(recipes[0].id));
          setIsSaved(saved);
        } catch (error) {
          console.error('Error checking saved status:', error);
        } finally {
          setIsCheckingSaved(false);
        }
      }
    };
    
    checkSavedStatus();
  }, [user, recipes]);
  
  const handleShare = () => {
    toast({
      title: "Share feature",
      description: "In a real app, this would open sharing options.",
    });
  };
  
  const showPaywall = (feature: string) => {
    setPaywallFeature(feature);
    setPaywallOpen(true);
  };

  const handlePrint = () => {
    if (!canUsePremiumFeature()) {
      showPaywall('Print shopping lists');
      return;
    }
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
  
  const formatIngredient = (ingredient: any) => {
    if (!showQuantity || ingredient.quantity === null) {
      return `${ingredient.unit} ${ingredient.name}`.trim();
    }
    
    const scaledQuantity = ingredient.quantity * scaleMultiplier;
    let formattedQuantity;
    
    // Format the number to handle different cases
    if (Number.isInteger(scaledQuantity)) {
      // Case 1: Whole numbers (e.g., 1, 2, 3)
      formattedQuantity = scaledQuantity.toString();
    } else {
      // Case 2: Decimal numbers
      // Convert to decimal with up to 2 decimal places and remove trailing zeros
      const decimal = Number(scaledQuantity.toFixed(2));
      
      // Common fractions to display nicely
      const fractionMap: { [key: number]: string } = {
        0.25: "¼",
        0.5: "½",
        0.75: "¾",
        0.33: "⅓",
        0.67: "⅔",
        0.2: "⅕",
        0.4: "⅖",
        0.6: "⅗",
        0.8: "⅘"
      };
      
      // Check if we have a clean fraction representation
      const fractionalPart = decimal % 1;
      const wholePart = Math.floor(decimal);
      
      // Find the closest fraction representation
      const closestFraction = Object.entries(fractionMap).reduce((closest, [value, symbol]) => {
        const currentDiff = Math.abs(fractionalPart - parseFloat(value));
        const closestDiff = Math.abs(fractionalPart - closest.value);
        return currentDiff < closestDiff ? { value: parseFloat(value), symbol } : closest;
      }, { value: 999, symbol: "" });
      
      // If the fractional part is very close to a common fraction (within 0.01)
      if (Math.abs(fractionalPart - closestFraction.value) < 0.01) {
        formattedQuantity = wholePart === 0 
          ? closestFraction.symbol 
          : `${wholePart}${closestFraction.symbol}`;
      } else {
        // Just use decimal format
        formattedQuantity = decimal.toString().replace(/\.?0+$/, '');
      }
    }
    
    return `${formattedQuantity} ${ingredient.unit} ${ingredient.name}`.trim();
  };
  
  const handleBackClick = () => {
    // Navigate back to ingredients page with step 2 (recipe list)
    sessionStorage.setItem('ingredients_page_step', '2');
    navigate('/ingredients');
  };
  
  const handleServingChange = (increase: boolean) => {
    if (!canUsePremiumFeature()) {
      showPaywall('Serving size adjustment');
      return;
    }
    
    if (increase) {
      setBaseServings(prev => prev + 1);
    } else {
      setBaseServings(prev => Math.max(1, prev - 1));
    }
  };
  
  const handleToggleSave = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    
    if (!recipes.length) return;
    
    try {
      if (isSaved) {
        // Unsave the recipe
        const success = await unsaveRecipe(user.uid, String(recipes[0].id));
        if (success) {
          setIsSaved(false);
          toast({
            title: "Recipe Unsaved",
            description: "Recipe removed from your saved recipes.",
          });
        }
      } else {
        // Save the recipe
        const success = await saveRecipe(user.uid, recipes[0]);
        if (success) {
          setIsSaved(true);
          toast({
            title: "Recipe Saved",
            description: "Recipe added to your saved recipes.",
          });
        }
      }
    } catch (error) {
      console.error('Error toggling save status:', error);
      toast({
        title: "Error",
        description: "Failed to update save status. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleAuthModalClose = () => {
    setAuthModalOpen(false);
  };
  
  const handleLoginSuccess = async () => {
    setAuthModalOpen(false);
    if (user && recipes.length > 0) {
      // Save the recipe after login
      handleToggleSave();
    }
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
            <Button
              variant="ghost" 
              size="icon"
              onClick={handleToggleSave}
              disabled={isCheckingSaved || loading}
            >
              {isSaved ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4 text-primary"
                >
                  <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
                </svg>
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              <span className="sr-only">
                {isSaved ? "Unsave Recipe" : "Save Recipe"}
              </span>
            </Button>
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
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={showQuantity}
                  onCheckedChange={setShowQuantity}
                  id="quantity-toggle"
                />
                <Label htmlFor="quantity-toggle">Show quantities</Label>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center space-x-4">
              <Label>Servings:</Label>
              <div 
                className="flex items-center space-x-1 cursor-pointer" 
                onClick={() => !canUsePremiumFeature() && showPaywall('Serving size adjustment')}
              >
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServingChange(false);
                  }}
                  disabled={!canUsePremiumFeature()}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center">
                  {baseServings}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServingChange(true);
                  }}
                  disabled={!canUsePremiumFeature()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {!canUsePremiumFeature() && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                    PRO
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>
        
        {/* Ingredients */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
          <Card className="p-4">
            <div className="space-y-2">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Checkbox 
                    id={`ingredient-${index}`} 
                    checked={ingredient.checked || false} 
                    onCheckedChange={() => toggleIngredientCheck(index.toString())}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={`ingredient-${index}`} 
                      className={`${ingredient.checked ? 'line-through text-muted-foreground' : ''}`}
                    >
                      <span className="font-medium">{formatIngredient(ingredient)}</span>
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
              <Label htmlFor="image-toggle" className="text-sm">Image mode</Label>
              <Switch 
                id="image-toggle" 
                checked={imageMode} 
                onCheckedChange={setImageMode} 
              />
            </div>
          </div>
          
          <div className="space-y-6">
            {currentRecipe.instructions && currentRecipe.instructions.length > 0 ? (
              currentRecipe.instructions.map((instruction, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-none">
                    {imageMode ? (
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
              ))
            ) : (
              <Card className="p-6">
                <div className="text-center space-y-2">
                  <Info className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No instructions available for this recipe.</p>
                  <p className="text-xs text-muted-foreground">
                    This may be a recipe you saved previously. You can still view the ingredients and other details.
                  </p>
                </div>
              </Card>
            )}
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

      <PaywallModal 
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        feature={paywallFeature}
      />
      
      <AuthModal 
        isOpen={authModalOpen}
        onClose={handleAuthModalClose}
        onLoginSuccess={handleLoginSuccess}
        feature="save recipes"
      />
    </Layout>
  );
};

export default RecipePage;