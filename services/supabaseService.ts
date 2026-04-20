import { createClient } from '@supabase/supabase-js';
import { CuisineCategory, Dish, Order, AppSettings } from '../types';

const SUPABASE_URL = 'https://ixnddbaczpuqtqdnecpd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bmRkYmFjenB1cXRxZG5lY3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDY4NjMsImV4cCI6MjA4NDY4Mjg2M30.RHBinmh5KaRRzO6_CNLvZhLQnlPZcjtkL60YF3z8xFM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth Functions ---
export const signUp = (email: string, password: string, firstName: string, lastName: string) => 
  supabase.auth.signUp({ 
    email, 
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      }
    }
  });

export const signIn = (email: string, password: string) => 
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => 
  supabase.auth.signOut();

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// --- Data Mapping Helpers ---
const mapCategory = (row: any): CuisineCategory => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  image: row.image || '',
  isHidden: row.is_hidden || false,
  order: row.order || 0
});

const mapCategoryToDB = (cat: CuisineCategory) => ({
  id: cat.id,
  name: cat.name,
  description: cat.description,
  image: cat.image,
  is_hidden: cat.isHidden,
  order: cat.order
});

const mapDish = (row: any): Dish => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  description: row.description || '',
  image: row.image || '',
  sideDishes: Array.isArray(row.side_dishes) ? row.side_dishes : [],
  ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
  nutrition: row.nutrition || { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0 },
  suitableFor: Array.isArray(row.suitable_for) ? row.suitable_for : [],
  isHidden: row.is_hidden || false,
  isFeatured: row.is_featured || false
});

const mapDishToDB = (dish: Dish) => ({
  id: dish.id,
  category_id: dish.categoryId,
  name: dish.name,
  description: dish.description,
  image: dish.image,
  side_dishes: dish.sideDishes,
  ingredients: dish.ingredients,
  nutrition: dish.nutrition,
  suitable_for: dish.suitableFor,
  is_hidden: dish.isHidden,
  is_featured: dish.isFeatured
});

const mapOrder = (row: any): Order => ({
  id: row.id,
  items: row.items || [],
  status: row.status,
  orderTime: row.order_time,
  totalCalories: row.total_calories,
  tableNumber: row.table_number,
  guestName: row.guest_name
});

const mapOrderToDB = (order: Order) => ({
  id: order.id,
  items: order.items,
  status: order.status,
  order_time: order.orderTime,
  total_calories: order.totalCalories,
  table_number: order.tableNumber,
  guest_name: order.guestName
});

// --- Data Fetching Functions ---
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.code === '57014' || error.message?.includes('timeout'))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const fetchCategories = async (): Promise<CuisineCategory[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('order', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapCategory);
  });
};

export const fetchDishes = async (): Promise<Dish[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('dishes')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapDish);
  });
};

export const fetchOrders = async (): Promise<Order[]> => {
  return withRetry(async () => {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`status.eq.pending,order_time.gt.${yesterday.toISOString()}`)
      .order('order_time', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapOrder);
  });
};

export const upsertCategory = async (category: CuisineCategory) => {
  const payload = mapCategoryToDB(category);
  const { error } = await supabase
    .from('categories')
    .upsert(payload);
  if (error) throw error;
};

export const deleteCategoryFromDB = async (id: string) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const upsertDish = async (dish: Dish) => {
  const payload = mapDishToDB(dish);
  const { error } = await supabase
    .from('dishes')
    .upsert(payload);
  if (error) throw error;
};

export const deleteDishFromDB = async (id: string) => {
  const { error } = await supabase
    .from('dishes')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const upsertOrder = async (order: Order) => {
  const payload = mapOrderToDB(order);
  const { error } = await supabase
    .from('orders')
    .upsert(payload);
  if (error) throw error;
};

export const deleteOrderFromDB = async (id: string) => {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const fetchSettings = async (): Promise<AppSettings> => {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'global')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        const defaultSettings = { id: 'global', is_ordering_enabled: false, is_nutrition_visible: false };
        await supabase.from('settings').insert(defaultSettings);
        return { id: 'global', isOrderingEnabled: false, isNutritionVisible: false };
      }
      throw error;
    }
    return { 
      id: data.id, 
      isOrderingEnabled: data.is_ordering_enabled,
      isNutritionVisible: data.is_nutrition_visible ?? false
    };
  });
};

export const updateSettings = async (isOrderingEnabled: boolean, isNutritionVisible: boolean) => {
  const { error } = await supabase
    .from('settings')
    .upsert({ 
      id: 'global', 
      is_ordering_enabled: isOrderingEnabled,
      is_nutrition_visible: isNutritionVisible
    });
  if (error) throw error;
};
