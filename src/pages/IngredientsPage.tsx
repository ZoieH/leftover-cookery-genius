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

type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'gluten-free' | 'low-carb';

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
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
  
  const handleGenerateRecipe = async () => {
    // Check if we have at least one ingredient selected
    const selectedIngredients = ingredients.filter(ing => ing.selected);
    
    if (selectedIngredients.length === 0) {
      toast({
        title: "No ingredients selected",
        description: "Please select at least one ingredient to generate a recipe.",
        variant: "destructive"
      });
      return;
    }

    // Move to step 2 (recommendations) instead of step 3
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

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto p-4 space-y-8">
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
            <h2 className="text-2xl font-medium text-center">
              {currentStep === 1 ? 'Your Ingredients' : 'Recipe Recommendations'}
            </h2>
            
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
                          <div className="flex items-center gap-2 w-full">
                            <Input 
                              value={tempIngredient.name}
                              onChange={(e) => setTempIngredient({...tempIngredient, name: e.target.value})}
                              className="flex-1"
                            />
                            <Input 
                              value={tempIngredient.quantity}
                              onChange={(e) => setTempIngredient({...tempIngredient, quantity: e.target.value})}
                              className="w-16"
                              type="number"
                            />
                            <Select 
                              value={tempIngredient.unit}
                              onValueChange={(value) => setTempIngredient({...tempIngredient, unit: value})}
                            >
                              <SelectTrigger className="w-24">
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
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                              <Button size="sm" onClick={saveEdit}>Save</Button>
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
                        <div className="flex items-center gap-2 w-full">
                          <Input 
                            value={tempIngredient.name}
                            onChange={(e) => setTempIngredient({...tempIngredient, name: e.target.value})}
                            placeholder="Ingredient name"
                            className="flex-1"
                            autoFocus
                          />
                          <Input 
                            value={tempIngredient.quantity}
                            onChange={(e) => setTempIngredient({...tempIngredient, quantity: e.target.value})}
                            placeholder="Qty"
                            className="w-16"
                            type="number"
                          />
                          <Select 
                            value={tempIngredient.unit}
                            onValueChange={(value) => setTempIngredient({...tempIngredient, unit: value})}
                          >
                            <SelectTrigger className="w-24">
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
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                            <Button size="sm" onClick={saveNewIngredient}>Add</Button>
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
                    <h3 className="text-lg font-medium mb-3">Dietary Requirements</h3>
                    <Select 
                      value={dietaryPreference} 
                      onValueChange={(value: DietaryPreference) => setDietaryPreference(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select dietary preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No restrictions</SelectItem>
                        <SelectItem value="vegetarian">Vegetarian</SelectItem>
                        <SelectItem value="vegan">Vegan</SelectItem>
                        <SelectItem value="gluten-free">Gluten-free</SelectItem>
                        <SelectItem value="low-carb">Low carb</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-medium mb-3">Calorie Control</h3>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number" 
                        placeholder="Max calories per serving"
                        value={calorieLimit}
                        onChange={(e) => setCalorieLimit(e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground">kcal</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="mt-8 flex justify-end">
                <Button 
                  onClick={handleGenerateRecipe}
                  className="gap-2"
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
            </>
          )}
          
          {/* Step 2: Recipe recommendations (was Step 3 before) */}
          {currentStep === 2 && (
            <>
              <h2 className="text-2xl font-semibold mb-4">Step 2: Recipe Recommendations</h2>
              
              <IngredientBasedRecommendations 
                ingredients={getSelectedIngredientNames()}
                dietaryFilter={dietaryPreference}
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
      </div>
    </Layout>
  );
};

export default IngredientsPage;
