
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Printer, Share2, ThumbsUp, Users, Clock, Gauge, Star, StarHalf } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

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
  
  const handleShare = () => {
    toast({
      title: "Share feature",
      description: "In a real app, this would open sharing options.",
    });
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleLike = () => {
    toast({
      title: "Recipe liked!",
      description: "This recipe has been saved to your favorites.",
    });
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
              onClick={() => navigate('/ingredients')}
              className="flex items-center gap-1"
            >
              <ArrowLeft size={16} />
              Back to Ingredients
            </Button>
            
            <div className="w-32"></div> {/* Spacer for alignment */}
          </div>
          
          {/* Hero section with image */}
          <div className="relative mb-6">
            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
              <img 
                src="/placeholder.svg" 
                alt="Recipe" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-purple-800 text-white text-center py-8 -mt-16 pt-20">
              <h1 className="text-2xl font-bold mb-2">{recipeData.title}</h1>
              <Separator className="w-3/4 mx-auto my-3 bg-white/30" />
              
              {/* Rating stars */}
              <div className="flex items-center justify-center gap-1 mb-2">
                {[...Array(Math.floor(recipeData.rating))].map((_, i) => (
                  <Star key={`star-${i}`} size={18} className="text-yellow-400 fill-yellow-400" />
                ))}
                {recipeData.rating % 1 !== 0 && (
                  <StarHalf size={18} className="text-yellow-400 fill-yellow-400" />
                )}
                <span className="text-sm ml-2">{recipeData.rating} from {recipeData.reviews} reviews</span>
              </div>
              
              {/* Recipe meta */}
              <div className="flex justify-center items-center gap-6 text-sm mt-3">
                <div className="flex items-center gap-1">
                  <Clock size={16} />
                  <span>TOTAL TIME: {recipeData.totalTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={16} />
                  <span>YIELD: {recipeData.yield}</span>
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
          <Card className="p-6 mb-6">
            <p className="text-muted-foreground">{recipeData.description}</p>
          </Card>
          
          {/* Ingredients section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase">Ingredients</h2>
              <div className="flex items-center gap-2 text-sm border rounded-md overflow-hidden">
                <button className="bg-black text-white px-2 py-1">US</button>
                <button className="px-2 py-1">M</button>
                <span className="px-2">SCALE</span>
                <button className="border-l px-2 py-1">1/2x</button>
                <button className="border-l border-r px-2 py-1 bg-black text-white">1x</button>
                <button className="px-2 py-1">2x</button>
              </div>
            </div>
            
            <div className="space-y-3">
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
                    <span className="font-medium">{ingredient.amount} {ingredient.name}</span>
                    {ingredient.detail && <span className="text-muted-foreground">, {ingredient.detail}</span>}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Instructions section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase">Instructions</h2>
              <div className="flex items-center gap-2 text-sm border rounded">
                <button className={`px-3 py-1 ${!videoMode ? 'bg-gray-200' : ''}`} onClick={() => setVideoMode(false)}>TEXT</button>
                <button className={`px-3 py-1 ${videoMode ? 'bg-gray-200' : ''}`} onClick={() => setVideoMode(true)}>VIDEO</button>
              </div>
            </div>
            
            <div className="space-y-6">
              {recipeData.steps.map((step, index) => (
                <div key={step.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-800 text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p>{step.instruction}</p>
                    {step.image && (
                      <div className="mt-2 rounded-md overflow-hidden border">
                        <img 
                          src={step.image} 
                          alt={`Step ${index + 1}`} 
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Chef's notes */}
          {recipeData.notes && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 uppercase">Chef's Notes</h2>
              <Card className="p-6">
                <p className="italic">{recipeData.notes}</p>
              </Card>
            </div>
          )}
          
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
