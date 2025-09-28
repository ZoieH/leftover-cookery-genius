import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Edit, Trash2, Plus, Loader2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { findMatchingRecipes } from '@/services/recipeService';
import IngredientBasedRecommendations from '@/components/IngredientBasedRecommendations';
import type { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';
import Layout from '@/components/Layout';
import { useUsageStore, canPerformSearch, getRemainingSearches, canUsePremiumFeature } from '@/services/usageService';
import PaywallModal from '@/components/PaywallModal';
import { useAuthStore } from '@/services/firebaseService';
import AuthModal from '@/components/AuthModal';
import SEOHead from '@/components/SEOHead';

// Type for ingredient objects
type Ingredient = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  selected: boolean;
};

// We'll now load identified ingredients from sessionStorage if available
const getInitialIngredients = (): Ingredient[] => {
  try {
    const savedIngredients = sessionStorage.getItem('identified_ingredients');
    if (savedIngredients) {
      return JSON.parse(savedIngredients);
    }
  } catch (error) {
    console.error('Error loading ingredients from session storage:', error);
  }
  
  // Fallback to mock data if no saved ingredients
  return [
    { id: 1, name: 'Beef', quantity: '300', unit: 'g', selected: true },
    { id: 2, name: 'Tomato', quantity: '5', unit: 'pieces', selected: true },
    { id: 3, name: 'Asparagus', quantity: '100', unit: 'g', selected: true },
    { id: 4, name: 'Cucumber', quantity: '2', unit: 'pieces', selected: true },
    { id: 5, name: 'Corn', quantity: '5', unit: 'pieces', selected: true },
    { id: 6, name: 'Egg', quantity: '5', unit: 'pieces', selected: true },
  ];
};

type DietaryPreference = 
  | 'none' 
  | 'vegetarian' 
  | 'vegan' 
  | 'gluten-free' 
  | 'lactose-free'
  | 'high-protein'
  | 'low-carb'
  | 'kosher'
  | 'halal'
  | 'atlantic'
  | 'keto';

const IngredientsPage = () => {
  // Change the starting step to 1 and update step handling
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>('none');
  const [calorieLimit, setCalorieLimit] = useState<string>('');
  const [editing, setEditing] = useState<number | null>(null);
  const [tempIngredient, setTempIngredient] = useState({ name: '', quantity: '', unit: 'g' });
  const [isAddingNewIngredient, setIsAddingNewIngredient] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const { user } = useAuthStore();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { incrementSearchCount, isPremium } = useUsageStore();
  
  // Check premium status on component mount and when isPremium changes
  useEffect(() => {
    const checkPremiumStatus = async () => {
      const hasPremium = await canUsePremiumFeature();
      setIsPremiumUser(hasPremium);
      
      // Update remaining searches text
      const remainingElement = document.getElementById('remaining-searches');
      if (remainingElement) {
        const remaining = await getRemainingSearches();
        remainingElement.textContent = `${remaining} searches remaining today.`;
      }
    };
    
    checkPremiumStatus();
  }, [isPremium]);
  
  // Load ingredients and step when component mounts
  useEffect(() => {
    const loadedIngredients = getInitialIngredients();
    setIngredients(loadedIngredients);
    
    // Check if we should restore the step from session storage
    const savedStep = sessionStorage.getItem('ingredients_page_step');
    if (savedStep) {
      setCurrentStep(parseInt(savedStep));
      // Clear the stored step after using it
      sessionStorage.removeItem('ingredients_page_step');
    }
    
    setIsInitialLoad(false);
  }, []);
  
  // Handle empty ingredients after user actions (not on initial load)
  useEffect(() => {
    if (!isInitialLoad && ingredients.length === 0) {
      toast({
        title: "No ingredients found",
        description: "Returning to image upload page",
      });
      
      // Use a short timeout to allow the toast to be seen
      const timer = setTimeout(() => {
        navigate('/');
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [ingredients, navigate, toast, isInitialLoad]);
  
  const handleCheckboxChange = (id: number) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, selected: !ing.selected } : ing
    ));
  };
  
  const handleDelete = (id: number) => {
    const updatedIngredients = ingredients.filter(ing => ing.id !== id);
    setIngredients(updatedIngredients);
    
    if (updatedIngredients.length > 0) {
      toast({
        description: "Ingredient removed",
      });
    }
    // If there are no ingredients left, the useEffect will handle navigation
  };
  
  const startEditing = (id: number) => {
    const ingredient = ingredients.find(ing => ing.id === id);
    if (ingredient) {
      setTempIngredient({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit
      });
      setEditing(id);
    }
  };
  
  const saveEdit = () => {
    if (editing) {
      setIngredients(ingredients.map(ing => 
        ing.id === editing 
          ? { ...ing, name: tempIngredient.name, quantity: tempIngredient.quantity, unit: tempIngredient.unit }
          : ing
      ));
      setEditing(null);
    }
  };

  const startAddingIngredient = () => {
    setTempIngredient({ name: '', quantity: '1', unit: 'pieces' });
    setIsAddingNewIngredient(true);
  };

  const saveNewIngredient = () => {
    if (tempIngredient.name.trim() === '') {
      toast({
        title: "Name required",
        description: "Please enter an ingredient name",
        variant: "destructive"
      });
      return;
    }

    // Generate a new unique ID (highest ID + 1)
    const newId = ingredients.length > 0 
      ? Math.max(...ingredients.map(ing => ing.id)) + 1 
      : 1;

    const newIngredient = {
      id: newId,
      name: tempIngredient.name,
      quantity: tempIngredient.quantity || '1',
      unit: tempIngredient.unit,
      selected: true
    };

    setIngredients([...ingredients, newIngredient]);
    setIsAddingNewIngredient(false);
    setTempIngredient({ name: '', quantity: '', unit: 'g' });

    toast({
      description: "Ingredient added",
    });
  };
  
  const cancelEdit = () => {
    setEditing(null);
    setIsAddingNewIngredient(false);
  };
  
  const showPaywall = (feature: string) => {
    if (!user) {
      setAuthModalOpen(true);
      setPaywallFeature(feature);
    } else {
      setPaywallOpen(true);
      setPaywallFeature(feature);
    }
  };

  const handleDietaryChange = async (value: DietaryPreference) => {
    // Only vegetarian and none are free; others require premium
    if (!['none', 'vegetarian'].includes(value)) {
      const isPremium = await canUsePremiumFeature();
      if (!isPremium) {
        showPaywall('Dietary preference filter');
        return;
      }
    }
    setDietaryPreference(value);
  };

  const handleCalorieChange = async (value: string) => {
    const isPremium = await canUsePremiumFeature();
    if (!isPremium) {
      showPaywall('Calorie control');
      return;
    }
    setCalorieLimit(value);
  };

  const handleFindRecipes = async () => {
    const canSearch = await canPerformSearch();
    if (!canSearch) {
      showPaywall('Unlimited recipe searches');
      return;
    }

    // Increment search count
    incrementSearchCount();

    // Proceed with recipe search
    const selectedIngredients = ingredients.filter(ing => ing.selected);
    if (selectedIngredients.length === 0) {
      toast({
        title: "No Ingredients Selected",
        description: "Please select at least one ingredient to find recipes.",
        variant: "destructive",
      });
      return;
    }

    // Save selected ingredients to session storage
    sessionStorage.setItem('selected_ingredients', JSON.stringify(selectedIngredients));
    
    // Check premium status for dietary and calorie filters
    const isPremium = await canUsePremiumFeature();
    
    // Only include dietary and calorie filters if premium
    sessionStorage.setItem('dietary_preference', isPremium ? dietaryPreference : 'none');
    sessionStorage.setItem('calorie_limit', isPremium ? calorieLimit : '');
    
    setCurrentStep(2);
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    
    // Store the selected recipe in session storage for the recipe page
    sessionStorage.setItem('matching_recipes', JSON.stringify([recipe]));
    
    toast({
      title: "Recipe selected",
      description: `You selected ${recipe.title}`,
    });
    
    // Navigate to the recipe page
    navigate('/recipe');
  };
  
  // Get the selected ingredient names for the recommendation component
  const getSelectedIngredientNames = () => {
    return ingredients
      .filter(ing => ing.selected)
      .map(ing => ing.name);
  };

  const handleBack = () => {
    if (currentStep === 2) {
      // If we're on step 2 (recommendations), go back to step 1 (ingredient list)
      setCurrentStep(1);
    } else {
      // If we're on step 1, navigate back to home
      navigate('/');
    }
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "AI Recipe Generator - Select Ingredients",
    "description": "Select your leftover ingredients and dietary preferences. Our AI will generate personalized recipes to reduce food waste.",
    "url": "https://lefto.com/ingredients",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Lefto",
      "url": "https://lefto.com"
    }
  };

  return (
    <>
      <SEOHead 
        title="Select Ingredients - AI Recipe Generator"
        description="Select your leftover ingredients and dietary preferences. Our AI will generate personalized recipes to reduce food waste."
        keywords="ingredient selection, AI recipe generator, dietary preferences, leftover ingredients, food waste reduction"
        canonical="https://lefto.com/ingredients"
        structuredData={structuredData}
      />
      
      <Layout>
        <div className="container max-w-4xl mx-auto p-4 space-y-8 pb-24 md:pb-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
              {currentStep === 2 ? 'Back to Ingredients' : 'Back'}
            </Button>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-center">
                {currentStep === 1 ? 'Select Your Ingredients' : 'AI Recipe Recommendations'}
              </h1>
              
              <div className="flex justify-center">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full font-medium transition-colors",
                    currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    1
                  </div>
                  <div className={cn(
                    "h-px w-16",
                    currentStep >= 2 ? "bg-primary" : "bg-muted"
                  )} />
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full font-medium transition-colors",
                    currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    2
                  </div>
                </div>
              </div>
            </div>

            {/* Show remaining searches for free users */}
            {!isPremiumUser && (
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span id="remaining-searches">
                    {/* This will be populated by effect */}
                    Loading search count...
                  </span>{' '}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto font-normal text-primary"
                    onClick={() => navigate('/upgrade')}
                  >
                    Upgrade to premium
                  </Button>
                </p>
              </div>
            )}

            {/* Step 1: Combined ingredients and preferences */}
            {currentStep === 1 && (
              <>
                <h2 className="text-2xl font-semibold mb-4">Step 1: Select Ingredients & Preferences</h2>
                <Card className="mb-8">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      {ingredients.map(ingredient => (
                        <div key={ingredient.id} className="ingredient-item">
                          {editing === ingredient.id ? (
                            <div className="flex flex-col gap-3 w-full">
                              <div className="flex items-center gap-2">
                                <Input 
                                  value={tempIngredient.name}
                                  onChange={(e) => setTempIngredient({
                                    ...tempIngredient, 
                                    name: e.target.value.slice(0, 50)
                                  })}
                                  className="flex-1 min-h-[4rem] text-base py-2 px-3 resize-none"
                                  placeholder="Ingredient name"
                                  style={{ height: 'auto', minHeight: '4rem' }}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Input 
                                  value={tempIngredient.quantity}
                                  onChange={(e) => setTempIngredient({...tempIngredient, quantity: e.target.value})}
                                  className="w-20"
                                  type="number"
                                  placeholder="Qty"
                                />
                                <Select 
                                  value={tempIngredient.unit}
                                  onValueChange={(value) => setTempIngredient({...tempIngredient, unit: value})}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="g">g</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="ml">ml</SelectItem>
                                    <SelectItem value="l">l</SelectItem>
                                    <SelectItem value="pieces">pieces</SelectItem>
                                    <SelectItem value="cups">cups</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-2 ml-auto">
                                  <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                                  <Button size="sm" onClick={saveEdit}>Save</Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <Checkbox 
                                  id={`ingredient-${ingredient.id}`}
                                  checked={ingredient.selected}
                                  onCheckedChange={() => handleCheckboxChange(ingredient.id)}
                                />
                                <label 
                                  htmlFor={`ingredient-${ingredient.id}`}
                                  className={`font-medium ${!ingredient.selected ? 'text-muted-foreground line-through' : ''}`}
                                >
                                  {ingredient.name}
                                </label>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">
                                  {ingredient.quantity} {ingredient.unit}
                                </span>
                                
                                <div className="flex items-center">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => startEditing(ingredient.id)}
                                    className="h-8 w-8"
                                  >
                                    <Edit size={16} />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDelete(ingredient.id)}
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 size={16} />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Add New Ingredient Form */}
                      {isAddingNewIngredient && (
                        <div className="ingredient-item bg-muted/20 rounded-md p-3 mt-4">
                          <div className="flex flex-col gap-3 w-full">
                            <div className="flex items-center gap-2">
                              <Input 
                                value={tempIngredient.name}
                                onChange={(e) => setTempIngredient({
                                  ...tempIngredient, 
                                  name: e.target.value.slice(0, 50)
                                })}
                                placeholder="Ingredient name"
                                className="flex-1 min-h-[4rem] text-base py-2 px-3 resize-none"
                                style={{ height: 'auto', minHeight: '4rem' }}
                                autoFocus
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Input 
                                value={tempIngredient.quantity}
                                onChange={(e) => setTempIngredient({...tempIngredient, quantity: e.target.value})}
                                placeholder="Qty"
                                className="w-20"
                                type="number"
                              />
                              <Select 
                                value={tempIngredient.unit}
                                onValueChange={(value) => setTempIngredient({...tempIngredient, unit: value})}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="g">g</SelectItem>
                                  <SelectItem value="kg">kg</SelectItem>
                                  <SelectItem value="ml">ml</SelectItem>
                                  <SelectItem value="l">l</SelectItem>
                                  <SelectItem value="pieces">pieces</SelectItem>
                                  <SelectItem value="cups">cups</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2 ml-auto">
                                <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                                <Button size="sm" onClick={saveNewIngredient}>Add</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Add Ingredient Button */}
                      {!isAddingNewIngredient && !editing && (
                        <Button 
                          variant="outline" 
                          className="w-full mt-4 flex items-center justify-center gap-2 border-dashed"
                          onClick={startAddingIngredient}
                        >
                          <Plus size={16} />
                          Add Ingredient
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Add dietary preferences to Step 1 */}
                <div className="grid gap-6 md:grid-cols-2 mb-8">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-medium">Dietary Requirements</h3>
                        {dietaryPreference && !['none', 'vegetarian'].includes(dietaryPreference) && (
                          <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                            PRO
                          </span>
                        )}
                      </div>
                      <Select 
                        value={dietaryPreference} 
                        onValueChange={handleDietaryChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select dietary preference" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No restrictions</SelectItem>
                          <SelectItem value="vegetarian">Vegetarian</SelectItem>
                          <SelectItem value="vegan">
                            Vegan
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="gluten-free">
                            Gluten-Free
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="lactose-free">
                            Lactose-Free
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="high-protein">
                            High-Protein
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="low-carb">
                            Low-Carb
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="kosher">
                            Kosher
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="halal">
                            Halal
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="atlantic">
                            Atlantic
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                          <SelectItem value="keto">
                            Keto
                            <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">PRO</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent 
                      className="pt-6 cursor-pointer" 
                      onClick={() => !isPremiumUser && showPaywall('Calorie control')}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-medium">Calorie Control</h3>
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                          PRO
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div 
                          className="flex-1 relative cursor-pointer"
                          onClick={() => !isPremiumUser && showPaywall('Calorie control')}
                        >
                          <Input 
                            type="number" 
                            placeholder="Max calories per serving"
                            value={calorieLimit}
                            onChange={(e) => handleCalorieChange(e.target.value)}
                            disabled={!isPremiumUser}
                            className={`w-full disabled:opacity-50 ${!isPremiumUser ? "pointer-events-none" : ""}`}
                          />
                          {!isPremiumUser && (
                            <div className="absolute inset-0" />
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">kcal</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Remove the old premium feature notice since we now show inline PRO badges */}
                {!isPremiumUser && (dietaryPreference && !['none', 'vegetarian'].includes(dietaryPreference) || calorieLimit) && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">Premium Features Selected</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Your search will proceed without the premium filters you've selected.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/upgrade')}
                    >
                      Upgrade to Premium
                    </Button>
                  </div>
                )}
              </>
            )}
            
            {/* Step 2: Recipe recommendations (was Step 3 before) */}
            {currentStep === 2 && (
              <>
                <h2 className="text-2xl font-semibold mb-4">Step 2: Recipe Recommendations</h2>
                
                <IngredientBasedRecommendations 
                  ingredients={getSelectedIngredientNames()}
                  dietaryFilter={isPremiumUser ? dietaryPreference : ''}
                  calorieLimit={isPremiumUser ? parseInt(calorieLimit) : undefined}
                  onSelectRecipe={handleSelectRecipe}
                />
                
                <div className="mt-8 flex justify-start">
                  <Button 
                    variant="outline"
                    className="gap-2"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowLeft size={16} />
                    Back to Ingredients
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Sticky button container */}
          {currentStep === 1 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:relative md:border-0 md:p-0 md:mt-8">
              <div className="container max-w-4xl mx-auto md:flex md:justify-center">
                <Button 
                  onClick={handleFindRecipes}
                  className="w-full gap-2 md:w-auto"
                  disabled={isGeneratingRecipe}
                >
                  {isGeneratingRecipe ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Finding Recipes...
                    </>
                  ) : (
                    <>
                      Find Recipes
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {user ? (
          <PaywallModal 
            isOpen={paywallOpen}
            onClose={() => setPaywallOpen(false)}
            feature={paywallFeature}
          />
        ) : (
          <AuthModal 
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            feature={paywallFeature}
          />
        )}
      </Layout>
    </>
  );
};

export default IngredientsPage;
