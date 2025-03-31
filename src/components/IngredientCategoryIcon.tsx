
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
  Salad
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
  
  // Return the appropriate icon based on the category
  const iconProps = { size, className: `${className}` };
  
  switch (category) {
    case 'fruit':
      return <Apple {...iconProps} className={`${className} text-red-500`} />;
    case 'vegetable':
      return <Salad {...iconProps} className={`${className} text-green-500`} />;
    case 'meat':
      return <Beef {...iconProps} className={`${className} text-rose-700`} />;
    case 'seafood':
      return <Fish {...iconProps} className={`${className} text-blue-500`} />;
    case 'dairy':
      return <Milk {...iconProps} className={`${className} text-gray-300`} />;
    case 'grain':
      return <Wheat {...iconProps} className={`${className} text-yellow-600`} />;
    case 'spice':
      return <Flame {...iconProps} className={`${className} text-orange-500`} />;
    case 'beverage':
      return <Coffee {...iconProps} className={`${className} text-brown-600`} />;
    case 'other':
    default:
      return <Utensils {...iconProps} className={`${className} text-gray-400`} />;
  }
};

export default IngredientCategoryIcon;
