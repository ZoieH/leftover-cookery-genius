
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Printer, Share2, Info, Play, Video, Circle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import IngredientCategoryIcon from '@/components/IngredientCategoryIcon';

// Mock recipe data
const recipeData = {
  title: "Beef Stir-Fry with Fresh Vegetables",
  rating: 4.5,
  reviews: 26,
  totalTime: "1 hour",
  yield: "6-8",
  servings: 4,
  calories: 320,
  cookTime: "25 mins",
  difficulty: "Easy",
  description: "Rich and savory Beef Stir-Fry with delicious tomato flavor, juicy beef, tender vegetables, lots of herbs and spices. Bright and spicy and comforting!",
  ingredients: [
    { id: "1", name: "beef", amount: "300g", detail: "thinly sliced", checked: false },
    { id: "2", name: "tomatoes", amount: "2", detail: "diced", checked: false },
    { id: "3", name: "asparagus", amount: "100g", detail: "trimmed and cut into pieces", checked: false },
    { id: "4", name: "cucumber", amount: "1", detail: "sliced", checked: false },
    { id: "5", name: "corn", amount: "2 ears", detail: "kernels removed", checked: false },
    { id: "6", name: "eggs", amount: "3", detail: "beaten", checked: false },
    { id: "7", name: "garlic", amount: "3 cloves", detail: "minced", checked: false },
    { id: "8", name: "soy sauce", amount: "2 tbsp", detail: "", checked: false },
    { id: "9", name: "oyster sauce", amount: "1 tbsp", detail: "", checked: false },
    { id: "10", name: "vegetable oil", amount: "1 tbsp", detail: "", checked: false },
    { id: "11", name: "sesame oil", amount: "1 tsp", detail: "", checked: false },
    { id: "12", name: "sugar", amount: "½ tsp", detail: "", checked: false },
    { id: "13", name: "salt and pepper", amount: "", detail: "to taste", checked: false }
  ],
  steps: [
    {
      id: "1",
      instruction: "Heat vegetable oil in a large wok or skillet over high heat.",
      image: "/placeholder.svg"
    },
    {
      id: "2",
      instruction: "Add the beef and stir-fry until browned, about 3-4 minutes. Remove and set aside.",
      image: "/placeholder.svg"
    },
    {
      id: "3",
      instruction: "In the same pan, add garlic and stir-fry for 30 seconds until fragrant.",
      image: "/placeholder.svg"
    },
    {
      id: "4",
      instruction: "Add asparagus and corn kernels, stir-fry for 2 minutes.",
      image: ""
    },
    {
      id: "5",
      instruction: "Add tomatoes and cucumber, stir-fry for another minute.",
      image: ""
    },
    {
      id: "6",
      instruction: "Push vegetables to one side of the pan and pour beaten eggs into the empty space. Scramble until just set.",
      image: "/placeholder.svg"
    },
    {
      id: "7",
      instruction: "Return beef to the pan and add soy sauce, oyster sauce, sugar, salt, and pepper.",
      image: ""
    },
    {
      id: "8",
      instruction: "Toss everything together until well combined and heated through, about 1-2 minutes.",
      image: ""
    },
    {
      id: "9",
      instruction: "Drizzle with sesame oil, give a final toss, and remove from heat.",
      image: ""
    },
    {
      id: "10",
      instruction: "Serve immediately over rice or noodles.",
      image: ""
    }
  ],
  notes: "This recipe is flexible! Feel free to substitute vegetables with whatever you have in your fridge. For a vegetarian version, replace beef with tofu or just add more eggs."
};

const RecipePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState(recipeData.ingredients);
  const [videoMode, setVideoMode] = useState(false);
  const [showQuantity, setShowQuantity] = useState(true);
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  
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
        // It's a whole number
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
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="py-6 border-b border-border">
        <div className="container">
          <h1 className="text-3xl font-bold text-primary">Leftover Cookery Genius</h1>
          <p className="text-muted-foreground">Turn your leftovers into delicious meals</p>
        </div>
      </header>
      
      <main className="container flex-1 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/ingredients')}
              className="flex items-center gap-1"
            >
              <ArrowLeft size={16} />
              Back to Ingredients
            </Button>
          </div>
          
          {/* Hero section with image */}
          <div className="relative mb-6">
            <div className="w-36 h-36 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
              <img 
                src="/placeholder.svg" 
                alt="Recipe" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-purple-800 text-white text-center py-8 -mt-16 pt-20 rounded-lg">
              <h1 className="text-2xl font-bold mb-2">{recipeData.title}</h1>
              <Separator className="w-3/4 mx-auto my-3 bg-white/30" />
              
              {/* Rating stars */}
              <div className="flex items-center justify-center gap-1 mb-2">
                {[...Array(Math.floor(recipeData.rating))].map((_, i) => (
                  <svg key={`star-${i}`} className="w-5 h-5 text-yellow-400 fill-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
                {recipeData.rating % 1 !== 0 && (
                  <svg className="w-5 h-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    <path fill="#fff" d="M12 2v15.27l6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
                  </svg>
                )}
                <span className="text-sm ml-2">{recipeData.rating} from {recipeData.reviews} reviews</span>
              </div>
              
              {/* Recipe meta */}
              <div className="flex justify-center items-center gap-6 text-sm mt-3">
                <div className="flex items-center gap-1">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{recipeData.totalTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Serves {recipeData.servings}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button 
              variant="outline" 
              className="w-full flex justify-center items-center gap-2" 
              onClick={handlePrint}
            >
              <Printer size={18} />
              PRINT
            </Button>
            <Button 
              variant="outline" 
              className="w-full flex justify-center items-center gap-2" 
              onClick={handleShare}
            >
              <Share2 size={18} />
              PIN
            </Button>
          </div>
          
          {/* Recipe description */}
          <Card className="p-6 mb-6 recipe-card">
            <p className="text-muted-foreground">{recipeData.description}</p>
          </Card>
          
          <div className="grid md:grid-cols-5 gap-8">
            {/* Ingredients section - 2 columns */}
            <div className="md:col-span-2">
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Ingredients ({ingredients.length})</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm mr-2">Show quantity</span>
                    <Switch
                      checked={showQuantity}
                      onCheckedChange={setShowQuantity}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end items-center gap-2 text-sm border rounded-md overflow-hidden mb-4">
                  <button className={`px-2 py-1 ${scaleMultiplier === 0.5 ? 'bg-black text-white' : ''}`} onClick={() => setScale(0.5)}>½x</button>
                  <button className={`px-2 py-1 ${scaleMultiplier === 1 ? 'bg-black text-white' : ''}`} onClick={() => setScale(1)}>1x</button>
                  <button className={`px-2 py-1 ${scaleMultiplier === 2 ? 'bg-black text-white' : ''}`} onClick={() => setScale(2)}>2x</button>
                  <button className={`px-2 py-1 ${scaleMultiplier === 4 ? 'bg-black text-white' : ''}`} onClick={() => setScale(4)}>4x</button>
                </div>
                
                <div className="space-y-3 recipe-card p-4 rounded-lg">
                  {ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="flex items-start gap-3">
                      <Checkbox 
                        id={`ingredient-${ingredient.id}`}
                        checked={ingredient.checked}
                        onCheckedChange={() => toggleIngredientCheck(ingredient.id)}
                        className="mt-1"
                      />
                      <label 
                        htmlFor={`ingredient-${ingredient.id}`}
                        className={`flex-1 cursor-pointer ${ingredient.checked ? 'line-through text-muted-foreground' : ''}`}
                      >
                        {showQuantity && (
                          <span className="font-medium">{scaleAmount(ingredient.amount)} </span>
                        )}
                        <span className="font-medium">{ingredient.name}</span>
                        {ingredient.detail && showQuantity && (
                          <span className="text-muted-foreground">, {ingredient.detail}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                
                {/* Allergens info */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-bold">Allergens</h3>
                      <p className="text-sm text-muted-foreground">Recipe may contain yeast, milk and lactose.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Instructions section - 3 columns */}
            <div className="md:col-span-3">
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Method</h2>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={!videoMode ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setVideoMode(false)}
                      className="flex items-center gap-1"
                    >
                      TEXT
                    </Button>
                    <Button 
                      variant={videoMode ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setVideoMode(true)}
                      className="flex items-center gap-1"
                    >
                      <Video size={16} />
                      VIDEO
                    </Button>
                  </div>
                </div>
                
                {!videoMode ? (
                  <div className="space-y-8">
                    {recipeData.steps.map((step, index) => (
                      <div key={step.id} className="p-6 border rounded-lg recipe-card">
                        <div className="flex gap-4 mb-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full step-number flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <h3 className="text-lg font-semibold">Step {index + 1}</h3>
                        </div>
                        <p className="mb-4">{step.instruction}</p>
                        {step.image && (
                          <div className="rounded-md overflow-hidden border">
                            <img 
                              src={step.image || "/placeholder.svg"} 
                              alt={`Step ${index + 1}`} 
                              className="w-full h-56 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border aspect-video">
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <div className="text-center">
                        <Button 
                          variant="default" 
                          size="icon" 
                          className="h-16 w-16 rounded-full mb-4"
                        >
                          <Play size={32} />
                        </Button>
                        <p className="text-lg font-medium">Recipe Video</p>
                        <p className="text-muted-foreground">Watch the step-by-step guide</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chef's notes */}
              {recipeData.notes && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold mb-4">Chef's Notes</h2>
                  <Card className="p-6 recipe-card">
                    <p className="italic">{recipeData.notes}</p>
                  </Card>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-8 flex justify-center">
            <Button onClick={() => navigate('/')}>
              Find Another Recipe
            </Button>
          </div>
        </div>
      </main>
      
      <footer className="py-6 border-t border-border print:hidden">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Leftover Cookery Genius. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default RecipePage;
