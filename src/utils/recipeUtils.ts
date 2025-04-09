import { Recipe } from '@/types/recipe';

export function calculateIngredientCoverage(recipe: Recipe, userIngredients: string[]): number {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
  if (!userIngredients || userIngredients.length === 0) return 0;

  const normalizedUserIngredients = userIngredients.map(ing => 
    ing.toLowerCase().trim()
  );

  // Count how many recipe ingredients match user ingredients
  const matchingRecipeIngredients = recipe.ingredients.filter(recipeIng => 
    normalizedUserIngredients.some(userIng => 
      recipeIng.toLowerCase().includes(userIng) || 
      userIng.includes(recipeIng.toLowerCase())
    )
  );

  // Count how many user ingredients are used in the recipe
  const usedUserIngredients = normalizedUserIngredients.filter(userIng => 
    recipe.ingredients.some(recipeIng => 
      recipeIng.toLowerCase().includes(userIng) || 
      userIng.includes(recipeIng.toLowerCase())
    )
  );

  // Calculate coverage based on both recipe and user ingredients
  const recipeCoverage = matchingRecipeIngredients.length / recipe.ingredients.length;
  const userCoverage = usedUserIngredients.length / userIngredients.length;

  // Return the average of both coverages, weighted slightly towards recipe coverage
  return (recipeCoverage * 0.6 + userCoverage * 0.4);
}

export function findMissingIngredients(recipe: Recipe, userIngredients: string[]): string[] {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return [];
  if (!userIngredients || userIngredients.length === 0) return recipe.ingredients;

  const normalizedUserIngredients = userIngredients.map(ing => 
    ing.toLowerCase().trim()
  );

  return recipe.ingredients.filter(recipeIng => 
    !normalizedUserIngredients.some(userIng => 
      recipeIng.toLowerCase().includes(userIng) || 
      userIng.includes(recipeIng.toLowerCase())
    )
  );
} 