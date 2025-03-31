
import React from 'react';
import { X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import IngredientCategoryIcon from './IngredientCategoryIcon';

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  enabled: boolean;
}

interface IngredientItemProps {
  ingredient: Ingredient;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

const IngredientItem: React.FC<IngredientItemProps> = ({
  ingredient,
  onToggle,
  onDelete,
  onEdit,
}) => {
  return (
    <div className="ingredient-item">
      <div className="flex items-center gap-3">
        <IngredientCategoryIcon 
          ingredientName={ingredient.name} 
          size={20} 
          className="flex-shrink-0"
        />
        <div>
          <div className={`font-medium ${!ingredient.enabled ? 'text-muted-foreground line-through' : ''}`}>
            {ingredient.name}
          </div>
          <div className="text-xs text-muted-foreground">{ingredient.quantity}</div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={ingredient.enabled}
          onCheckedChange={(checked) => onToggle(ingredient.id, checked)}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(ingredient.id)}
          className="h-8 w-8"
        >
          <Edit size={16} />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(ingredient.id)}
          className="h-8 w-8 text-destructive"
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
};

export default IngredientItem;
