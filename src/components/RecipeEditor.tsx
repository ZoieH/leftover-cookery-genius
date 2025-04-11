import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, X, Check } from 'lucide-react';
import { 
  getAllRecipes, 
  getRecipeById, 
  updateRecipe, 
  deleteRecipe 
} from '@/services/firebaseService';
import type { LocalRecipe } from '@/types/recipe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RecipeEditor: React.FC = () => {
  const [recipes, setRecipes] = useState<LocalRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<LocalRecipe | null>(null);
  const { toast } = useToast();

  // Modified fields with proper types
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  
  // New ingredient/instruction input fields
  const [newIngredient, setNewIngredient] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [newTag, setNewTag] = useState('');

  // Load all recipes initially
  useEffect(() => {
    const loadRecipes = async () => {
      setLoading(true);
      try {
        const allRecipes = await getAllRecipes();
        setRecipes(allRecipes);
      } catch (error) {
        console.error('Error loading recipes:', error);
        toast({
          title: 'Error',
          description: 'Failed to load recipes',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadRecipes();
  }, [toast]);

  // Load selected recipe
  useEffect(() => {
    const loadRecipe = async () => {
      if (!selectedRecipeId) {
        setCurrentRecipe(null);
        setIngredients([]);
        setInstructions([]);
        setDietaryTags([]);
        return;
      }
      
      setLoading(true);
      try {
        const recipe = await getRecipeById(selectedRecipeId);
        if (recipe) {
          setCurrentRecipe(recipe);
          setIngredients(recipe.ingredients || []);
          setInstructions(recipe.instructions || []);
          setDietaryTags(recipe.dietaryTags || []);
        }
      } catch (error) {
        console.error('Error loading recipe:', error);
        toast({
          title: 'Error',
          description: 'Failed to load the selected recipe',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadRecipe();
  }, [selectedRecipeId, toast]);

  const handleSaveRecipe = async () => {
    if (!currentRecipe || !selectedRecipeId) return;
    
    setSaving(true);
    try {
      // Create the updated recipe object with all fields
      const updatedRecipe = {
        ...currentRecipe,
        ingredients,
        instructions,
        dietaryTags,
      };
      
      // Update the recipe in Firestore
      await updateRecipe(selectedRecipeId, updatedRecipe);
      
      toast({
        title: 'Success',
        description: 'Recipe updated successfully',
      });
      
      // Refresh the recipe list
      const updatedRecipes = await getAllRecipes();
      setRecipes(updatedRecipes);
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to save recipe changes',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipeId || !window.confirm('Are you sure you want to delete this recipe?')) return;
    
    setSaving(true);
    try {
      await deleteRecipe(selectedRecipeId);
      
      toast({
        title: 'Success',
        description: 'Recipe deleted successfully',
      });
      
      // Refresh the recipe list and clear the selection
      const updatedRecipes = await getAllRecipes();
      setRecipes(updatedRecipes);
      setSelectedRecipeId(null);
      setCurrentRecipe(null);
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete recipe',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handler for adding ingredients
  const handleAddIngredient = () => {
    if (!newIngredient.trim()) return;
    setIngredients([...ingredients, newIngredient.trim()]);
    setNewIngredient('');
  };

  // Handler for removing ingredients
  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Handler for adding instructions
  const handleAddInstruction = () => {
    if (!newInstruction.trim()) return;
    setInstructions([...instructions, newInstruction.trim()]);
    setNewInstruction('');
  };

  // Handler for removing instructions
  const handleRemoveInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  // Handler for adding dietary tags
  const handleAddTag = () => {
    if (!newTag.trim()) return;
    setDietaryTags([...dietaryTags, newTag.trim()]);
    setNewTag('');
  };

  // Handler for removing dietary tags
  const handleRemoveTag = (index: number) => {
    setDietaryTags(dietaryTags.filter((_, i) => i !== index));
  };

  // Handler for updating recipe fields
  const handleRecipeChange = (field: string, value: string | number) => {
    if (!currentRecipe) return;
    setCurrentRecipe({
      ...currentRecipe,
      [field]: value,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Recipe Editor</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Recipe Selector */}
            <div className="space-y-2">
              <Label htmlFor="recipe-select">Select Recipe to Edit</Label>
              <Select
                value={selectedRecipeId || ""}
                onValueChange={(value) => setSelectedRecipeId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a recipe" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentRecipe && (
              <div className="space-y-6">
                {/* Basic Recipe Info */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={currentRecipe.title || ''}
                      onChange={(e) => handleRecipeChange('title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="servings">Servings</Label>
                    <Input
                      id="servings"
                      type="number"
                      value={currentRecipe.servings || ''}
                      onChange={(e) => handleRecipeChange('servings', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prepTime">Prep Time</Label>
                    <Input
                      id="prepTime"
                      value={currentRecipe.prepTime || ''}
                      onChange={(e) => handleRecipeChange('prepTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cookTime">Cook Time</Label>
                    <Input
                      id="cookTime"
                      value={currentRecipe.cookTime || ''}
                      onChange={(e) => handleRecipeChange('cookTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={currentRecipe.description || ''}
                      onChange={(e) => handleRecipeChange('description', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="image">Image URL</Label>
                    <Input
                      id="image"
                      value={currentRecipe.image || ''}
                      onChange={(e) => handleRecipeChange('image', e.target.value)}
                    />
                  </div>
                </div>

                {/* Ingredients Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Ingredients</h3>
                  <div className="space-y-2">
                    {ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={ingredient}
                          onChange={(e) => {
                            const newIngredients = [...ingredients];
                            newIngredients[index] = e.target.value;
                            setIngredients(newIngredients);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveIngredient(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        placeholder="Add new ingredient"
                        value={newIngredient}
                        onChange={(e) => setNewIngredient(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIngredient();
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAddIngredient}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Instructions Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Instructions</h3>
                  <div className="space-y-2">
                    {instructions.map((instruction, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Textarea
                          value={instruction}
                          onChange={(e) => {
                            const newInstructions = [...instructions];
                            newInstructions[index] = e.target.value;
                            setInstructions(newInstructions);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveInstruction(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <Textarea
                        placeholder="Add new instruction"
                        value={newInstruction}
                        onChange={(e) => setNewInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            handleAddInstruction();
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAddInstruction}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Dietary Tags Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Dietary Tags</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {dietaryTags.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md"
                      >
                        <span>{tag}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleRemoveTag(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      placeholder="Add new tag (e.g., vegetarian, gluten-free)"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleAddTag}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Common tags: vegetarian, vegan, gluten-free, dairy-free, low-carb, high-protein, keto
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {currentRecipe && (
          <>
            <Button
              variant="destructive"
              onClick={handleDeleteRecipe}
              disabled={saving || !selectedRecipeId}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Recipe
            </Button>
            <Button
              onClick={handleSaveRecipe}
              disabled={saving || !selectedRecipeId}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default RecipeEditor; 