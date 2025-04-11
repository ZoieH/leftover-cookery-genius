import React, { useState, useEffect, FC } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Search, Plus, Clock, User, Bookmark } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { recommendRecipesFromIngredients } from '../services/recipeRecommendationService';
import { calculateIngredientCoverage, findMissingIngredients } from '../utils/recipeUtils';
import { saveRecipe, unsaveRecipe, isRecipeSaved } from '../services/recipeService';
import type { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';
import { SpoonacularError } from '../services/spoonacularService';
import { useAuthStore } from '@/services/firebaseService';
import AuthModal from '@/components/AuthModal';

interface IngredientBasedRecommendationsProps {
  ingredients: string[];
  dietaryFilter?: string;
  calorieLimit?: number;
  onSelectRecipe: (recipe: Recipe) => void;
}

// Helper function to generate cache key
const getCacheKey = (ingredients: string[], dietaryFilter?: string): string => {
  const sortedIngredients = [...ingredients].sort().join(',');
  return `recipe_recommendations_${sortedIngredients}_${dietaryFilter || 'none'}`;
};

// Helper function to clear recipe cache
const clearRecipeCache = () => {
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('recipe_recommendations_')) {
      keys.push(key);
    }
  }
  keys.forEach(key => sessionStorage.removeItem(key));
};

const IngredientBasedRecommendations: FC<IngredientBasedRecommendationsProps> = ({
  ingredients,
  dietaryFilter,
  calorieLimit,
  onSelectRecipe
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [alternativeRecipes, setAlternativeRecipes] = useState<Recipe[]>([]);
  const [expandedRecipeId, setExpandedRecipeId] = useState<Recipe['id']>(null);
  const [useCache, setUseCache] = useState(true);
  const [savedRecipes, setSavedRecipes] = useState<Record<string, boolean>>({});
  const [isCheckingSaved, setIsCheckingSaved] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState<Recipe | null>(null);
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Function to truncate description
  const truncateDescription = (description: string, maxLength: number = 150) => {
    if (description.length <= maxLength) return description;
    return description.slice(0, maxLength).trim() + '...';
  };

  const loadRecommendations = async (showToast: boolean = false, forceFresh: boolean = false) => {
    if (ingredients.length === 0) {
      if (showToast) {
        toast({
          title: "No Ingredients",
          description: "Please add ingredients to get recipe recommendations.",
          variant: "destructive",
        });
      }
      return;
    }

    setIsLoading(true);
    setRecommendations([]);
    setAlternativeRecipes([]);

    try {
      // Check cache first if not forcing fresh results
      const cacheKey = getCacheKey(ingredients, dietaryFilter);
      const cachedResults = !forceFresh && useCache ? sessionStorage.getItem(cacheKey) : null;
      
      let allRecipes: Recipe[];
      
      if (cachedResults) {
        // Use cached results
        allRecipes = JSON.parse(cachedResults);
        console.log('Using cached recipe recommendations');
      } else {
        try {
          // Get fresh results from API
          allRecipes = await recommendRecipesFromIngredients(ingredients, dietaryFilter, { threshold: 0.1 });
          // Log recipe sources
          console.log('Recipe sources:', allRecipes.map(recipe => ({
            title: recipe.title,
            source: recipe.source,
            id: recipe.id
          })));
          // Cache the results
          if (useCache) {
            sessionStorage.setItem(cacheKey, JSON.stringify(allRecipes));
            console.log('Caching new recipe recommendations');
          }
        } catch (error) {
          if (error instanceof SpoonacularError) {
            toast({
              description: 'API limit reached. Please try again later.',
              variant: 'destructive',
            });
          } else {
            toast({
              description: 'Failed to get recipe recommendations.',
              variant: 'destructive',
            });
          }
          allRecipes = []; // Initialize to empty array if API call fails
        }
      }
      
      // Helper function to check if recipe meets dietary and calorie requirements
      const meetsRequirements = (recipe: Recipe) => {
        // Check calorie limit if specified
        if (calorieLimit && recipe.calories && recipe.calories > calorieLimit) {
          return false;
        }
        
        // Check dietary requirements if specified, with a special case for OpenAI recipes
        if (dietaryFilter && dietaryFilter !== 'none') {
          // For OpenAI-generated recipes, be more lenient as they may not have properly formatted tags
          if (recipe.id.toString().includes('openai')) {
            // If we can't verify diet compliance, assume it's ok since OpenAI was given the dietary constraint
            return true;
          }
          
          // For other recipes, check dietary tags
          return recipe.dietaryTags.some(tag => 
            tag.toLowerCase().includes(dietaryFilter.toLowerCase()) || 
            dietaryFilter.toLowerCase().includes(tag.toLowerCase())
          );
        }
        
        return true;
      };

      // Split recipes into recommendations and alternatives with a lower threshold
      const exactMatches = allRecipes.filter(recipe => {
        const coverage = calculateIngredientCoverage(recipe, ingredients);
        // Lower threshold to 0.2 (20%) to be more inclusive
        const meets = coverage >= 0.2 && meetsRequirements(recipe);
        console.log(`Recipe ${recipe.title} - Coverage: ${coverage.toFixed(2)}, Meets requirements: ${meetsRequirements(recipe)}, Categorized as: ${meets ? 'main recommendation' : 'alternative'}`);
        return meets;
      });
      
      // Log the split of recipes
      console.log('Main recommendations count:', exactMatches.length);
      console.log('Main recommendations:', exactMatches.map(r => r.title));
      
      const potentialAlternatives = allRecipes
        .filter(recipe => {
          const coverage = calculateIngredientCoverage(recipe, ingredients);
          // Include recipes that either:
          // 1. Have less than 30% ingredient match but meet dietary/calorie requirements
          // 2. Have good ingredient match but don't meet dietary/calorie requirements
          return (coverage < 0.3 && meetsRequirements(recipe)) || 
                 (coverage >= 0.3 && !meetsRequirements(recipe));
        })
        .sort((a, b) => {
          // Sort by ingredient coverage first
          const coverageA = calculateIngredientCoverage(a, ingredients);
          const coverageB = calculateIngredientCoverage(b, ingredients);
          if (Math.abs(coverageB - coverageA) > 0.1) { // If coverage difference is significant
            return coverageB - coverageA;
          }
          // If coverage is similar, prioritize recipes that meet requirements
          return Number(meetsRequirements(b)) - Number(meetsRequirements(a));
        });

      // If no exact matches but we have alternatives, move the best alternative to exactMatches
      if (exactMatches.length === 0 && potentialAlternatives.length > 0) {
        // Find any OpenAI-generated recipes first (they should be prioritized)
        const openAiRecipe = potentialAlternatives.find(r => r.id.toString().includes('openai'));
        
        if (openAiRecipe) {
          console.log('Moving OpenAI recipe to main recommendations:', openAiRecipe.title);
          exactMatches.push(openAiRecipe);
          // Remove from alternatives
          const index = potentialAlternatives.findIndex(r => r.id === openAiRecipe.id);
          if (index !== -1) {
            potentialAlternatives.splice(index, 1);
          }
        } else if (potentialAlternatives.length > 0) {
          // If no OpenAI recipe, move the top alternative
          console.log('Moving top alternative recipe to main recommendations:', potentialAlternatives[0].title);
          exactMatches.push(potentialAlternatives[0]);
          potentialAlternatives.splice(0, 1);
        }
      }
      
      setRecommendations(exactMatches);
      setAlternativeRecipes(potentialAlternatives);
      
      if (exactMatches.length === 0 && showToast) {
        toast({
          title: "No Exact Matches Found",
          description: potentialAlternatives.length > 0 
            ? "Here are some alternative recipes you might like based on your ingredients."
            : "We couldn't find any recipes. Try adding different ingredients or adjusting your filters.",
          variant: potentialAlternatives.length > 0 ? "default" : "destructive",
        });
      }
    } catch (error) {
      console.error("Error getting recipe recommendations:", error);
      if (showToast) {
        toast({
          title: "Recommendation Error",
          description: "Failed to fetch recipe recommendations. Please try again later.",
          variant: "destructive",
        });
      }
      setRecommendations([]);
      setAlternativeRecipes([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add refresh button to force new results
  const handleRefresh = () => {
    loadRecommendations(true, true);
  };

  // Check which recipes are saved by the user
  const checkSavedRecipes = async () => {
    if (!user) return;
    
    setIsCheckingSaved(true);
    try {
      const allRecipes = [...recommendations, ...alternativeRecipes];
      const savedStatus: Record<string, boolean> = {};
      
      // Check each recipe in parallel
      await Promise.all(allRecipes.map(async (recipe) => {
        const isSaved = await isRecipeSaved(user.uid, String(recipe.id));
        savedStatus[String(recipe.id)] = isSaved;
      }));
      
      setSavedRecipes(savedStatus);
    } catch (error) {
      console.error('Error checking saved recipes:', error);
    } finally {
      setIsCheckingSaved(false);
    }
  };
  
  // Handle saving a recipe
  const handleToggleSave = async (recipe: Recipe) => {
    if (!user) {
      // Show auth modal if user is not logged in
      setRecipeToSave(recipe);
      setAuthModalOpen(true);
      return;
    }
    
    const recipeId = String(recipe.id);
    const isCurrentlySaved = savedRecipes[recipeId];
    
    try {
      if (isCurrentlySaved) {
        // Unsave the recipe
        const success = await unsaveRecipe(user.uid, recipeId);
        if (success) {
          setSavedRecipes(prev => ({
            ...prev,
            [recipeId]: false
          }));
          toast({
            title: "Recipe Unsaved",
            description: "Recipe removed from your saved recipes.",
          });
        }
      } else {
        // Save the recipe
        const success = await saveRecipe(user.uid, recipe);
        if (success) {
          setSavedRecipes(prev => ({
            ...prev,
            [recipeId]: true
          }));
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
  
  // Handle auth modal close
  const handleAuthModalClose = () => {
    setAuthModalOpen(false);
    setRecipeToSave(null);
  };
  
  // Handle login success
  const handleLoginSuccess = async () => {
    setAuthModalOpen(false);
    
    // If there was a recipe waiting to be saved, save it
    if (recipeToSave && user) {
      await handleToggleSave(recipeToSave);
      setRecipeToSave(null);
    }
  };

  useEffect(() => {
    if (ingredients.length > 0) {
      loadRecommendations(false);
    } else {
      setRecommendations([]);
    }
  }, [ingredients, dietaryFilter]);
  
  // Check saved recipes when user or recipes change
  useEffect(() => {
    if (user && (recommendations.length > 0 || alternativeRecipes.length > 0)) {
      checkSavedRecipes();
    }
  }, [user, recommendations, alternativeRecipes]);

  const toggleRecipeExpansion = (recipeId: string) => {
    setExpandedRecipeId(expandedRecipeId === recipeId ? null : recipeId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Recipe Recommendations</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <Search className="h-4 w-4 mr-2" />
          Refresh Results
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-48 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Finding recipes that match your ingredients...
          </p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center p-8 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">
              {ingredients.length === 0 
                ? "Add ingredients to get recipe recommendations" 
                : "No exact recipe matches found"}
            </p>
            {ingredients.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Try adding more ingredients or adjusting your filters
              </p>
            )}
          </div>

          {alternativeRecipes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-muted-foreground">
                You Might Also Like
              </h3>
              <div className="space-y-4">
                {alternativeRecipes.map((recipe) => {
                  const coverage = calculateIngredientCoverage(recipe, ingredients);
                  const isExpanded = expandedRecipeId === String(recipe.id);
                  
                  return (
                    <Card key={recipe.id} className={cn(
                      "transition-all duration-200",
                      isExpanded && "ring-2 ring-primary"
                    )}>
                      <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          {recipe.image && (
                            <div className="flex-shrink-0 w-full sm:w-24 h-40 sm:h-24 rounded-md overflow-hidden mb-3 sm:mb-0">
                              <img 
                                src={recipe.image}
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <CardTitle className="text-xl sm:text-2xl">{recipe.title}</CardTitle>
                            <CardDescription className="mt-1 text-sm">
                              {isExpanded ? recipe.description : truncateDescription(recipe.description)}
                            </CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="self-start mt-2 sm:mt-0"
                            onClick={() => toggleRecipeExpansion(String(recipe.id))}
                          >
                            {isExpanded ? "Show Less" : "Show More"}
                          </Button>
                        </div>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {recipe.dietaryTags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span>{recipe.prepTime} + {recipe.cookTime}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span>Serves {recipe.servings}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <h3 className="font-medium">Ingredients</h3>
                              <ul className="list-disc list-inside space-y-1">
                                {recipe.ingredients.map((ingredient, index) => (
                                  <li key={index} className="text-sm">
                                    {ingredient}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      )}
                      
                      <CardFooter className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {Math.round(coverage * 100)}% Match
                          </Badge>
                          {coverage < 1 && (
                            <span className="text-xs text-muted-foreground">
                              ({findMissingIngredients(recipe, ingredients).length} ingredients missing)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleSave(recipe)}
                            disabled={isCheckingSaved}
                          >
                            {savedRecipes[String(recipe.id)] ? (
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
                              {savedRecipes[String(recipe.id)] ? "Unsave Recipe" : "Save Recipe"}
                            </span>
                          </Button>
                          {onSelectRecipe && (
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => onSelectRecipe(recipe)}
                            >
                              Select Recipe
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((recipe) => {
            const coverage = calculateIngredientCoverage(recipe, ingredients);
            const isExpanded = expandedRecipeId === String(recipe.id);
            
            return (
              <Card key={recipe.id} className={cn(
                "transition-all duration-200",
                isExpanded && "ring-2 ring-primary"
              )}>
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    {recipe.image && (
                      <div className="flex-shrink-0 w-full sm:w-24 h-40 sm:h-24 rounded-md overflow-hidden mb-3 sm:mb-0">
                        <img 
                          src={recipe.image}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-xl sm:text-2xl">{recipe.title}</CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        {isExpanded ? recipe.description : truncateDescription(recipe.description)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start mt-2 sm:mt-0"
                      onClick={() => toggleRecipeExpansion(String(recipe.id))}
                    >
                      {isExpanded ? "Show Less" : "Show More"}
                    </Button>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {recipe.dietaryTags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span>{recipe.prepTime} + {recipe.cookTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span>Serves {recipe.servings}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="font-medium">Ingredients</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {recipe.ingredients.map((ingredient, index) => (
                            <li key={index} className="text-sm">
                              {ingredient}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                )}
                
                <CardFooter className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="whitespace-nowrap">
                      {Math.round(coverage * 100)}% Match
                    </Badge>
                    {coverage < 1 && (
                      <span className="text-xs text-muted-foreground">
                        ({findMissingIngredients(recipe, ingredients).length} ingredients missing)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleSave(recipe)}
                      disabled={isCheckingSaved}
                    >
                      {savedRecipes[String(recipe.id)] ? (
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
                        {savedRecipes[String(recipe.id)] ? "Unsave Recipe" : "Save Recipe"}
                      </span>
                    </Button>
                    {onSelectRecipe && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => onSelectRecipe(recipe)}
                      >
                        Select Recipe
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
          
          {/* Always show the "You Might Also Like" section if there are alternative recipes */}
          {alternativeRecipes.length > 0 && (
            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-semibold text-muted-foreground">
                You Might Also Like
              </h3>
              <div className="space-y-4">
                {alternativeRecipes.map((recipe) => {
                  const coverage = calculateIngredientCoverage(recipe, ingredients);
                  const isExpanded = expandedRecipeId === String(recipe.id);
                  
                  return (
                    <Card key={recipe.id} className={cn(
                      "transition-all duration-200",
                      isExpanded && "ring-2 ring-primary"
                    )}>
                      <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          {recipe.image && (
                            <div className="flex-shrink-0 w-full sm:w-24 h-40 sm:h-24 rounded-md overflow-hidden mb-3 sm:mb-0">
                              <img 
                                src={recipe.image}
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <CardTitle className="text-xl sm:text-2xl">{recipe.title}</CardTitle>
                            <CardDescription className="mt-1 text-sm">
                              {isExpanded ? recipe.description : truncateDescription(recipe.description)}
                            </CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="self-start mt-2 sm:mt-0"
                            onClick={() => toggleRecipeExpansion(String(recipe.id))}
                          >
                            {isExpanded ? "Show Less" : "Show More"}
                          </Button>
                        </div>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {recipe.dietaryTags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span>{recipe.prepTime} + {recipe.cookTime}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span>Serves {recipe.servings}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <h3 className="font-medium">Ingredients</h3>
                              <ul className="list-disc list-inside space-y-1">
                                {recipe.ingredients.map((ingredient, index) => (
                                  <li key={index} className="text-sm">
                                    {ingredient}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      )}
                      
                      <CardFooter className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {Math.round(coverage * 100)}% Match
                          </Badge>
                          {coverage < 1 && (
                            <span className="text-xs text-muted-foreground">
                              ({findMissingIngredients(recipe, ingredients).length} ingredients missing)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleSave(recipe)}
                            disabled={isCheckingSaved}
                          >
                            {savedRecipes[String(recipe.id)] ? (
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
                              {savedRecipes[String(recipe.id)] ? "Unsave Recipe" : "Save Recipe"}
                            </span>
                          </Button>
                          {onSelectRecipe && (
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => onSelectRecipe(recipe)}
                            >
                              Select Recipe
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <AuthModal 
        isOpen={authModalOpen}
        onClose={handleAuthModalClose}
        onLoginSuccess={handleLoginSuccess}
        feature="save recipes"
      />
    </div>
  );
};

export default IngredientBasedRecommendations; 