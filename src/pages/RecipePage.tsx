
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Printer, Share2, ThumbsUp, Users, Clock, Gauge, Flame } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Mock recipe data
const recipeData = {
  title: "Beef Stir-Fry with Fresh Vegetables",
  servings: 4,
  calories: 320,
  cookTime: "25 mins",
  difficulty: "Easy",
  ingredients: [
    "300g beef, thinly sliced",
    "2 tomatoes, diced",
    "100g asparagus, trimmed and cut into pieces",
    "1 cucumber, sliced",
    "2 ears of corn, kernels removed",
    "3 eggs, beaten",
    "3 cloves garlic, minced",
    "2 tbsp soy sauce",
    "1 tbsp oyster sauce",
    "1 tbsp vegetable oil",
    "1 tsp sesame oil",
    "½ tsp sugar",
    "Salt and pepper to taste"
  ],
  steps: [
    "Heat vegetable oil in a large wok or skillet over high heat.",
    "Add the beef and stir-fry until browned, about 3-4 minutes. Remove and set aside.",
    "In the same pan, add garlic and stir-fry for 30 seconds until fragrant.",
    "Add asparagus and corn kernels, stir-fry for 2 minutes.",
    "Add tomatoes and cucumber, stir-fry for another minute.",
    "Push vegetables to one side of the pan and pour beaten eggs into the empty space. Scramble until just set.",
    "Return beef to the pan and add soy sauce, oyster sauce, sugar, salt, and pepper.",
    "Toss everything together until well combined and heated through, about 1-2 minutes.",
    "Drizzle with sesame oil, give a final toss, and remove from heat.",
    "Serve immediately over rice or noodles."
  ],
  notes: "This recipe is flexible! Feel free to substitute vegetables with whatever you have in your fridge. For a vegetarian version, replace beef with tofu or just add more eggs."
};

const RecipePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
            
            <h2 className="text-2xl font-semibold">Recipe Generated</h2>
            
            <div className="w-32"></div> {/* Spacer for alignment */}
          </div>
          
          <Card className="recipe-container p-6">
            <div className="recipe-header flex justify-between items-start mb-4">
              <h1 className="text-2xl font-bold">{recipeData.title}</h1>
              
              <div className="recipe-actions flex gap-2">
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 size={18} />
                  <span className="sr-only">Share</span>
                </Button>
                
                <Button variant="outline" size="icon" onClick={handlePrint}>
                  <Printer size={18} />
                  <span className="sr-only">Print</span>
                </Button>
                
                <Button variant="outline" size="icon" onClick={handleLike}>
                  <ThumbsUp size={18} />
                  <span className="sr-only">Like</span>
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <span className="font-medium">Servings:</span> {recipeData.servings}
              </div>
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-orange-500" />
                <span className="font-medium">Calories:</span> {recipeData.calories} kcal/serving
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                <span className="font-medium">Time:</span> {recipeData.cookTime}
              </div>
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-green-500" />
                <span className="font-medium">Difficulty:</span> {recipeData.difficulty}
              </div>
            </div>
            
            <div className="my-4">
              <img 
                src="/placeholder.svg" 
                alt="Recipe" 
                className="w-full h-40 md:h-64 object-cover rounded-md mt-4 bg-muted"
              />
            </div>
            
            <div className="recipe-section my-6">
              <h2 className="recipe-section-title text-xl font-semibold mb-3">Ingredients:</h2>
              <ul className="space-y-1 list-disc list-inside">
                {recipeData.ingredients.map((ingredient, index) => (
                  <li key={index}>{ingredient}</li>
                ))}
              </ul>
            </div>
            
            <div className="recipe-section my-6">
              <h2 className="recipe-section-title text-xl font-semibold mb-3">Instructions:</h2>
              <ol className="space-y-3 list-decimal list-inside">
                {recipeData.steps.map((step, index) => (
                  <li key={index} className="pl-1">
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            
            {recipeData.notes && (
              <div className="recipe-section my-6">
                <h2 className="recipe-section-title text-xl font-semibold mb-3">Chef's Notes:</h2>
                <p className="italic bg-muted p-3 rounded-md">{recipeData.notes}</p>
              </div>
            )}
            
            <div className="mt-8 flex justify-center">
              <Button onClick={() => navigate('/')}>
                Find Another Recipe
              </Button>
            </div>
          </Card>
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
