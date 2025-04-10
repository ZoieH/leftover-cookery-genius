import React, { useState, useEffect, FC } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Search, Plus, Clock, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { recommendRecipesFromIngredients } from '../services/recipeRecommendationService';
import { calculateIngredientCoverage, findMissingIngredients } from '../utils/recipeUtils';
import type { Recipe } from '@/types/recipe';
import { cn } from '@/lib/utils';
import { SpoonacularError } from '../services/spoonacularService';
import { toast } from '@/components/ui/use-toast';

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
        // Check dietary requirements if specified
        if (dietaryFilter && dietaryFilter !== 'none' && !recipe.dietaryTags.includes(dietaryFilter)) {
          return false;
        }
        return true;
      };

      // Split recipes into recommendations and alternatives
      const exactMatches = allRecipes.filter(recipe => {
        const coverage = calculateIngredientCoverage(recipe, ingredients);
        return coverage >= 0.3 && meetsRequirements(recipe);
      });
      
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

      // Calculate how many alternatives we need to show to reach minimum of 3 total recipes
      const minTotalRecipes = 3;
      const alternativesNeeded = Math.max(0, minTotalRecipes - exactMatches.length);
      const alternatives = potentialAlternatives.slice(0, Math.max(alternativesNeeded, 2)); // Show at least 2 alternatives if available
      
      setRecommendations(exactMatches);
      setAlternativeRecipes(alternatives);
      
      if (exactMatches.length === 0 && showToast) {
        toast({
          title: "No Exact Matches Found",
          description: alternatives.length > 0 
            ? "Here are some alternative recipes you might like based on your ingredients."
            : "We couldn't find any recipes. Try adding different ingredients or adjusting your filters.",
          variant: alternatives.length > 0 ? "default" : "destructive",
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

  useEffect(() => {
    if (ingredients.length > 0) {
      loadRecommendations(false);
    } else {
      setRecommendations([]);
    }
  }, [ingredients, dietaryFilter]);

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
                      <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                          {recipe.image && (
                            <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden">
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
                          <div className="flex-1">
                            <CardTitle>{recipe.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {isExpanded ? recipe.description : truncateDescription(recipe.description)}
                            </CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRecipeExpansion(String(recipe.id))}
                          >
                            {isExpanded ? "Show Less" : "Show More"}
                          </Button>
                        </div>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {recipe.dietaryTags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{recipe.prepTime} + {recipe.cookTime}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
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
                      
                      <CardFooter className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {Math.round(coverage * 100)}% Match
                          </Badge>
                          {coverage < 1 && (
                            <span className="text-xs text-muted-foreground">
                              ({findMissingIngredients(recipe, ingredients).length} ingredients missing)
                            </span>
                          )}
                        </div>
                        {onSelectRecipe && (
                          <Button
                            size="sm"
                            onClick={() => onSelectRecipe(recipe)}
                          >
                            Select Recipe
                          </Button>
                        )}
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
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    {recipe.image && (
                      <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden">
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
                    <div className="flex-1">
                      <CardTitle>{recipe.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {isExpanded ? recipe.description : truncateDescription(recipe.description)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRecipeExpansion(String(recipe.id))}
                    >
                      {isExpanded ? "Show Less" : "Show More"}
                    </Button>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {recipe.dietaryTags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{recipe.prepTime} + {recipe.cookTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
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
                
                <CardFooter className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {Math.round(coverage * 100)}% Match
                    </Badge>
                    {coverage < 1 && (
                      <span className="text-xs text-muted-foreground">
                        ({findMissingIngredients(recipe, ingredients).length} ingredients missing)
                      </span>
                    )}
                  </div>
                  {onSelectRecipe && (
                    <Button
                      size="sm"
                      onClick={() => onSelectRecipe(recipe)}
                    >
                      Select Recipe
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IngredientBasedRecommendations; 