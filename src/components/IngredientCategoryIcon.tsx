
import React from 'react';
import { 
  Apple, 
  Beef, 
  Fish, 
  Milk, 
  Egg, 
  Wheat, 
  Coffee, 
  Banana, 
  Utensils,
  ChefHat,
  Flame,
  Salad,
  LucideIcon,
  LucideProps
} from 'lucide-react';

type IngredientCategory = 
  | 'fruit' 
  | 'vegetable' 
  | 'meat' 
  | 'seafood' 
  | 'dairy' 
  | 'grain' 
  | 'spice' 
  | 'beverage'
  | 'other';

const categoryMapping: Record<string, IngredientCategory> = {
  // Fruits
  apple: 'fruit',
  banana: 'fruit',
  orange: 'fruit',
  strawberry: 'fruit',
  blueberry: 'fruit',
  
  // Vegetables
  tomato: 'vegetable',
  cucumber: 'vegetable',
  carrot: 'vegetable',
  lettuce: 'vegetable',
  onion: 'vegetable',
  garlic: 'vegetable',
  potato: 'vegetable',
  
  // Meats
  chicken: 'meat',
  beef: 'meat',
  pork: 'meat',
  lamb: 'meat',
  turkey: 'meat',
  
  // Seafood
  fish: 'seafood',
  shrimp: 'seafood',
  salmon: 'seafood',
  tuna: 'seafood',
  
  // Dairy
  milk: 'dairy',
  cheese: 'dairy',
  yogurt: 'dairy',
  butter: 'dairy',
  egg: 'dairy',
  
  // Grains
  rice: 'grain',
  bread: 'grain',
  pasta: 'grain',
  flour: 'grain',
  oats: 'grain',
  
  // Spices
  salt: 'spice',
  pepper: 'spice',
  oregano: 'spice',
  basil: 'spice',
  thyme: 'spice',
  
  // Beverages
  water: 'beverage',
  juice: 'beverage',
  soda: 'beverage',
  coffee: 'beverage',
  tea: 'beverage',
};

interface IngredientCategoryIconProps {
  ingredientName: string;
  size?: number;
  className?: string;
}

// Create a map of category to icon component and color
const categoryIcons: Record<IngredientCategory, { icon: LucideIcon, color: string }> = {
  fruit: { icon: Apple, color: 'text-red-500' },
  vegetable: { icon: Salad, color: 'text-green-500' },
  meat: { icon: Beef, color: 'text-rose-700' },
  seafood: { icon: Fish, color: 'text-blue-500' },
  dairy: { icon: Milk, color: 'text-gray-300' },
  grain: { icon: Wheat, color: 'text-yellow-600' },
  spice: { icon: Flame, color: 'text-orange-500' },
  beverage: { icon: Coffee, color: 'text-amber-700' },
  other: { icon: Utensils, color: 'text-gray-400' }
};

const IngredientCategoryIcon: React.FC<IngredientCategoryIconProps> = ({ 
  ingredientName, 
  size = 20,
  className = ""
}) => {
  // Determine the category based on the ingredient name
  const lowerCaseName = ingredientName.toLowerCase();
  
  // Try to find an exact match first
  let category: IngredientCategory = categoryMapping[lowerCaseName] || 'other';
  
  // If no exact match, try to find a partial match
  if (category === 'other') {
    for (const [key, value] of Object.entries(categoryMapping)) {
      if (lowerCaseName.includes(key)) {
        category = value;
        break;
      }
    }
  }
  
  // Get the icon component and color from our mapping
  const { icon: IconComponent, color } = categoryIcons[category];
  
  // Return the icon with appropriate styling
  return (
    <IconComponent 
      size={size} 
      className={`${className} ${color}`} 
      aria-label={`${category} category`}
    />
  );
};

export default IngredientCategoryIcon;
