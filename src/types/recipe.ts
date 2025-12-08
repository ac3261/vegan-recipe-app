export interface SelectedIngredient {
  name: string;
  note?: string;
}

export interface RecipeIngredient {
  item: string;
  quantity?: string;
}

export interface RecipeNutrition {
  calories: string;
  macros: {
    protein: string;
    carbohydrates: string;
    sugars?: string;
    fats: string;
    saturatedFats?: string;
    fiber?: string;
  };
  micros?: string[];
}

export interface RecipeResponse {
  title: string;
  description: string;
  servings: number;
  prepTime: string;
  cookTime: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  nutrition: RecipeNutrition;
  tips?: string[];
}

export interface RecipeRequestPayload {
  ingredients: SelectedIngredient[];
  mealType: 'Any' | 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  dietaryFocus: 'Balanced' | 'High Protein' | 'Low Carb' | 'High Fiber' | 'Gluten Free';
  servings: number;
  extraIngredientAllowance: number;
  seasonings: string[];
  notes?: string;
}
