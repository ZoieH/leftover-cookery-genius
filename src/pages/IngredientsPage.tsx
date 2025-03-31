
import React, { useState } from 'react';
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
import { ArrowLeft, ArrowRight, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Mock identified ingredients with quantities
const initialIngredients = [
  { id: 1, name: 'Beef', quantity: '300', unit: 'g', selected: true },
  { id: 2, name: 'Tomato', quantity: '5', unit: 'pieces', selected: true },
  { id: 3, name: 'Asparagus', quantity: '100', unit: 'g', selected: true },
  { id: 4, name: 'Cucumber', quantity: '2', unit: 'pieces', selected: true },
  { id: 5, name: 'Corn', quantity: '5', unit: 'pieces', selected: true },
  { id: 6, name: 'Egg', quantity: '5', unit: 'pieces', selected: true },
];

type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'gluten-free' | 'low-carb';

const IngredientsPage = () => {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>('none');
  const [calorieLimit, setCalorieLimit] = useState<string>('');
  const [editing, setEditing] = useState<number | null>(null);
  const [tempIngredient, setTempIngredient] = useState({ name: '', quantity: '', unit: 'g' });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleCheckboxChange = (id: number) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, selected: !ing.selected } : ing
    ));
  };
  
  const handleDelete = (id: number) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
    toast({
      description: "Ingredient removed",
    });
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
  
  const cancelEdit = () => {
    setEditing(null);
  };
  
  const handleGenerateRecipe = () => {
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

    // In a real app, we would call an API with the selected ingredients
    // and dietary preferences to generate recipes
    toast({
      title: "Generating your recipe...",
      description: "This may take a moment",
    });
    
    // Simulate API call delay
    setTimeout(() => {
      navigate('/recipe');
    }, 2000);
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="py-6 border-b border-border">
        <div className="container">
          <h1 className="text-3xl font-bold text-primary">Leftover Cookery Genius</h1>
          <p className="text-muted-foreground">Turn your leftovers into delicious meals</p>
        </div>
      </header>
      
      <main className="container flex-1 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="flex items-center gap-1"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            
            <h2 className="text-2xl font-semibold">Ingredients Found</h2>
            
            <div className="w-20"></div> {/* Spacer for alignment */}
          </div>
          
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
              </div>
            </CardContent>
          </Card>
          
          <div className="grid gap-6 md:grid-cols-2">
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
                  <span className="text-sm text-muted-foreground whitespace-nowrap">kcal/serving</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-8 text-center">
            <Button 
              size="lg" 
              onClick={handleGenerateRecipe}
              className="w-full md:w-auto md:px-8"
            >
              Generate Recipe
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      </main>
      
      <footer className="py-6 border-t border-border">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Leftover Cookery Genius. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default IngredientsPage;
