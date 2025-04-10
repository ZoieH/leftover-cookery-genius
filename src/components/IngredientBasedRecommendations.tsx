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
  onSelectRecipe?: (recipe: Recipe) => void;
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
  onSelectRecipe
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [alternativeRecipes, setAlternativeRecipes] = useState<Recipe[]>([]);
  const [expandedRecipeId, setExpandedRecipeId] = useState<Recipe['id']>(null);
  const [useCache, setUseCache] = useState(true);
  const { toast } = useToast();

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
        }
      }
      
      // Split into exact matches (100% match) and alternatives (partial matches)
      const exactMatches = allRecipes.filter(recipe => 
        calculateIngredientCoverage(recipe, ingredients) === 1
      );
      
      const alternatives = allRecipes
        .filter(recipe => {
          const coverage = calculateIngredientCoverage(recipe, ingredients);
          // Include recipes with 30-90% match that aren't exact matches
          return coverage >= 0.3 && coverage < 1;
        })
        .sort((a, b) => 
          calculateIngredientCoverage(b, ingredients) - calculateIngredientCoverage(a, ingredients)
        )
        .slice(0, 3); // Take top 3 alternatives
      
      setRecommendations(exactMatches);
      setAlternativeRecipes(alternatives);
      
      if (exactMatches.length === 0 && showToast) {
        toast({
          title: "No Exact Matches Found",
          description: alternatives.length > 0 
            ? "We couldn't find recipes matching all your ingredients, but here are some alternatives you might like."
            : "We couldn't find any recipes matching your ingredients. Try adding more ingredients or adjusting your filters.",
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
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{recipe.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {recipe.description}
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
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{recipe.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {recipe.description}
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