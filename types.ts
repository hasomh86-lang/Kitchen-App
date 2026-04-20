export interface CuisineCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  isHidden?: boolean;
  order: number;
}

export type SuitableForTag = 
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'pre-workout'
  | 'post-workout'
  | 'light-meal'
  | 'high-protein'
  | 'low-carb';

export interface Nutrition {
  calories: number;
  protein: number; // grams
  fat: number; // grams
  carbohydrates: number; // grams
  fiber: number; // grams
}

export interface Dish {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  image: string;
  sideDishes: string[]; // List of strings
  ingredients: string[]; // List of strings
  nutrition: Nutrition;
  suitableFor: SuitableForTag[];
  isHidden?: boolean;
  isFeatured?: boolean;
}

export interface BasketItem {
  id: string;
  dishId: string;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  items: (BasketItem & { dish: Dish })[];
  status: 'pending' | 'completed' | 'cancelled';
  orderTime: string;
  totalCalories: number;
  tableNumber?: string;
  guestName?: string;
}

export interface AppSettings {
  id: string;
  isOrderingEnabled: boolean;
  isNutritionVisible: boolean;
}

export type ThemeType = 'modern' | 'classic' | 'dark';

export interface AppState {
  view: 'admin' | 'menu-overview' | 'dish-viewer' | 'pdf-preview' | 'butler';
  currentCategory: string | null;
  currentDishIndex: number;
  theme: ThemeType;
}

export const SUITABLE_FOR_OPTIONS: SuitableForTag[] = [
  'breakfast', 'lunch', 'dinner', 'pre-workout', 'post-workout', 'light-meal', 'high-protein', 'low-carb'
];