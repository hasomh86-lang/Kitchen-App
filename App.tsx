import React, { useState, useEffect } from 'react';
import { AppState, CuisineCategory, Dish, ThemeType, BasketItem, Order } from './types';
import { generateId } from './utils';
import { ThemeWrapper } from './components/ThemeWrapper';
import { AdminPanel } from './components/AdminPanel';
import { ClientView, PDFExportView } from './components/ClientView';
import { AuthForm } from './components/AuthForm';
import { Settings, ChefHat, Palette, FileText, X, ArrowRight, Sun, Moon, Star, ShoppingBasket, ClipboardList, Info } from 'lucide-react';
import { fetchCategories, fetchDishes, fetchOrders, upsertOrder, deleteOrderFromDB, upsertDish, supabase, fetchSettings, updateSettings } from './services/supabaseService';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [categories, setCategories] = useState<CuisineCategory[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  
  const [viewState, setViewState] = useState<AppState['view']>('menu-overview');
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [currentDishIndex, setCurrentDishIndex] = useState(0);
  const [theme, setTheme] = useState<ThemeType>('modern');

  const [appTitle, setAppTitle] = useState("Artisan Kitchen");
  const [appSubtitle, setAppSubtitle] = useState("Private Dining Curations");
  const [promotionTitle, setPromotionTitle] = useState("Signature Feature");
  const [philosophyTitle, setPhilosophyTitle] = useState("Nutritional Philosophy");
  const [philosophyDescription, setPhilosophyDescription] = useState("Every plate is balanced. Every calorie is considered. We believe private dining should be as nourishing as it is exquisite.");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOrderingEnabled, setIsOrderingEnabled] = useState(false);
  const [isNutritionVisible, setIsNutritionVisible] = useState(false);
  
  // Basket & Orders State
  const [basket, setBasket] = useState<BasketItem[]>(() => {
    const saved = localStorage.getItem('artisan_basket');
    return saved ? JSON.parse(saved) : [];
  });
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    localStorage.setItem('artisan_basket', JSON.stringify(basket));
  }, [basket]);

  useEffect(() => {
    if (!isOrderingEnabled) {
      setBasket([]);
      localStorage.removeItem('artisan_basket');
    }
  }, [isOrderingEnabled]);

  useEffect(() => {
    if (categories.length > 0) {
      localStorage.setItem('artisan_categories_cache', JSON.stringify(categories));
    }
  }, [categories]);

  useEffect(() => {
    if (dishes.length > 0) {
      localStorage.setItem('artisan_dishes_cache', JSON.stringify(dishes));
    }
  }, [dishes]);

  // Real-time Orders Subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', table: 'orders', schema: 'public' },
        async () => {
          const updatedOrders = await fetchOrders();
          setOrders(updatedOrders);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Real-time Settings Subscription
  useEffect(() => {
    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: '*', table: 'settings', schema: 'public', filter: 'id=eq.global' },
        (payload: any) => {
          if (payload.new) {
            if (typeof payload.new.is_ordering_enabled === 'boolean') {
              setIsOrderingEnabled(payload.new.is_ordering_enabled);
            }
            if (typeof payload.new.is_nutrition_visible === 'boolean') {
              setIsNutritionVisible(payload.new.is_nutrition_visible);
            }
            if (payload.new.app_title) setAppTitle(payload.new.app_title);
            if (payload.new.app_subtitle) setAppSubtitle(payload.new.app_subtitle);
            if (payload.new.promotion_title) setPromotionTitle(payload.new.promotion_title);
            if (payload.new.philosophy_title) setPhilosophyTitle(payload.new.philosophy_title);
            if (payload.new.philosophy_description) setPhilosophyDescription(payload.new.philosophy_description);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addToBasket = (dishId: string, notes?: string) => {
    if (!isOrderingEnabled) return;
    setBasket(prev => {
      const existing = prev.find(item => item.dishId === dishId);
      if (existing) {
        return prev.map(item => item.dishId === dishId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: generateId(), dishId, quantity: 1, notes }];
    });
  };

  const removeFromBasket = (itemId: string) => {
    setBasket(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setBasket(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const submitOrder = (tableNumber?: string, guestName?: string) => {
    if (!isOrderingEnabled || basket.length === 0) return;

    const orderDishes = basket.map(item => {
      const dish = dishes.find(d => d.id === item.dishId)!;
      return { ...item, dish };
    });

    const totalCalories = orderDishes.reduce((sum, item) => sum + (item.dish.nutrition.calories * item.quantity), 0);

    const newOrder: Order = {
      id: `ORD-${generateId()}`,
      items: orderDishes,
      status: 'pending',
      orderTime: new Date().toISOString(),
      totalCalories,
      tableNumber,
      guestName
    };

    upsertOrder(newOrder).catch(err => console.error("Error submitting order:", err));
    setOrders(prev => [newOrder, ...prev]);
    setBasket([]);
    setViewState('menu-overview');
  };

  // Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const loadData = async () => {
      // Try to load from cache first for instant feel
      try {
        const cachedCats = localStorage.getItem('artisan_categories_cache');
        const cachedDishes = localStorage.getItem('artisan_dishes_cache');
        
        if (cachedCats && cachedDishes) {
          setCategories(JSON.parse(cachedCats));
          setDishes(JSON.parse(cachedDishes));
          setLoading(false); // Show UI immediately with cached data
        }
      } catch (e) {
        console.warn("Failed to load from cache:", e);
        localStorage.removeItem('artisan_categories_cache');
        localStorage.removeItem('artisan_dishes_cache');
      }

      try {
        const [cats, ds, ords, settings] = await Promise.all([fetchCategories(), fetchDishes(), fetchOrders(), fetchSettings()]);
        
        setCategories(cats);
        setDishes(ds);
        setOrders(ords);
        setIsOrderingEnabled(settings.isOrderingEnabled);
        setIsNutritionVisible(settings.isNutritionVisible);
        if (settings.appTitle) setAppTitle(settings.appTitle);
        if (settings.appSubtitle) setAppSubtitle(settings.appSubtitle);
        if (settings.promotionTitle) setPromotionTitle(settings.promotionTitle);
        if (settings.philosophyTitle) setPhilosophyTitle(settings.philosophyTitle);
        if (settings.philosophyDescription) setPhilosophyDescription(settings.philosophyDescription);
        
        setDbError(null);
      } catch (err: any) {
        console.error("Supabase load error:", err);
        if (err.code === 'PGRST205' || err.message?.includes('not found')) {
          setDbError('DATABASE_SETUP_REQUIRED');
        } else {
          setDbError(err.message || 'Unknown database error');
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAdminAccess = () => {
    if (user) {
      setViewState('admin');
      setIsSettingsOpen(false);
    } else {
      setShowAuth(true);
    }
  };

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const visibleCategories = categories.filter(c => !c.isHidden);
  const visibleDishes = dishes.filter(d => !d.isHidden);

  const promotedDishIds = dishes.filter(d => d.isFeatured).map(d => d.id);

  const safeCurrentDishIndex = (currentDishIndex >= visibleDishes.length) ? 0 : currentDishIndex;

  const clientViewState = {
      view: viewState === 'menu-overview' || viewState === 'dish-viewer' ? viewState : 'menu-overview',
      currentCategory,
      currentDishIndex: safeCurrentDishIndex
  };
  
  const setClientViewState = (newState: any) => {
     if (typeof newState === 'function') {
         const res = newState(clientViewState);
         setViewState(res.view);
         setCurrentCategory(res.currentCategory);
         setCurrentDishIndex(res.currentDishIndex);
     } else {
         setViewState(newState.view);
         setCurrentCategory(newState.currentCategory);
         setCurrentDishIndex(newState.currentDishIndex);
     }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black/10 dark:border-white/10 border-t-black dark:border-t-white rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Opening Kitchen</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeWrapper theme={theme}>
        {showAuth && (
          <AuthForm 
            onSuccess={() => { setShowAuth(false); setViewState('admin'); setIsSettingsOpen(false); }}
            onCancel={() => setShowAuth(false)}
          />
        )}

        {/* Global Settings Panel Trigger - Positioned fixed over all views */}
        {(viewState === 'menu-overview' || viewState === 'dish-viewer') && (
            <div className="fixed top-6 right-6 z-[60] print:hidden">
                <button
                    onClick={toggleSettings}
                    className={`p-4 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center ${isSettingsOpen ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-zinc-800 dark:text-white'}`}
                >
                    {isSettingsOpen ? <X size={24} /> : <Settings size={24} />}
                </button>
            </div>
        )}

        {/* Branding & Settings Panel */}
        {isSettingsOpen && (
            <div className="fixed top-24 right-6 z-[70] w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-8 rounded-[2rem] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] border border-white/50 dark:border-white/5 animate-scale-in origin-top-right print:hidden max-h-[85vh] overflow-y-auto no-scrollbar">
                <div className="space-y-8">
                    {/* Theme Selector */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <Palette size={20} className="text-gray-800 dark:text-zinc-200"/>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-800 dark:text-zinc-200">Visual Identity</h3>
                        </div>
                        
                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-4 ml-1">Select Theme</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'modern', name: 'Modern', icon: <Sun size={14}/> },
                                { id: 'classic', name: 'Classic', icon: <FileText size={14}/> },
                                { id: 'dark', name: 'Dark', icon: <Moon size={14}/> }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id as ThemeType)}
                                    className={`flex flex-col items-center gap-2 px-3 py-4 rounded-2xl text-[10px] font-bold transition-all border-2 text-center leading-tight ${theme === t.id ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white scale-105 shadow-xl' : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-200 dark:bg-white/5 dark:hover:border-white/10'}`}
                                >
                                    {t.icon}
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button onClick={handleAdminAccess} className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-sm font-bold text-gray-800 dark:text-zinc-200">
                            <div className="flex items-center gap-3">
                                <ChefHat size={20} className="text-black dark:text-white"/>
                                {user ? 'Chef Dashboard' : 'Chef Entrance'}
                            </div>
                            <ArrowRight size={16}/>
                        </button>
                        <button onClick={() => { setViewState('pdf-preview'); setIsSettingsOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-sm font-bold text-gray-800 dark:text-zinc-200">
                            <div className="flex items-center gap-3">
                                <FileText size={20} className="text-black dark:text-white"/>
                                Export PDF Menu
                            </div>
                            <ArrowRight size={16}/>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {viewState === 'admin' ? (
            <AdminPanel 
                categories={categories} setCategories={setCategories}
                dishes={dishes} setDishes={setDishes}
                onClose={() => setViewState('menu-overview')}
                isOrderingEnabled={isOrderingEnabled}
                setIsOrderingEnabled={async (enabled) => {
                    setIsOrderingEnabled(enabled);
                    await updateSettings({ isOrderingEnabled: enabled });
                }}
                isNutritionVisible={isNutritionVisible}
                setIsNutritionVisible={async (visible) => {
                    setIsNutritionVisible(visible);
                    await updateSettings({ isNutritionVisible: visible });
                }}
                saveBranding={async () => {
                    await updateSettings({
                        appTitle,
                        appSubtitle,
                        promotionTitle,
                        philosophyTitle,
                        philosophyDescription
                    });
                }}
                appTitle={appTitle}
                setAppTitle={setAppTitle}
                appSubtitle={appSubtitle}
                setAppSubtitle={setAppSubtitle}
                promotionTitle={promotionTitle}
                setPromotionTitle={setPromotionTitle}
                philosophyTitle={philosophyTitle}
                setPhilosophyTitle={setPhilosophyTitle}
                philosophyDescription={philosophyDescription}
                setPhilosophyDescription={setPhilosophyDescription}
                orders={orders}
                setOrders={setOrders}
            />
        ) : viewState === 'pdf-preview' ? (
            <PDFExportView 
                dishes={visibleDishes.filter(d => visibleCategories.some(c => c.id === d.categoryId))} 
                categories={visibleCategories} 
                theme={theme} 
                onClose={() => setViewState('menu-overview')} 
            />
        ) : (
            <ClientView 
                categories={visibleCategories}
                dishes={visibleDishes}
                viewState={clientViewState as any}
                setViewState={setClientViewState}
                theme={theme}
                appTitle={appTitle}
                appSubtitle={appSubtitle}
                promotionTitle={promotionTitle}
                philosophyTitle={philosophyTitle}
                philosophyDescription={philosophyDescription}
                promotedDishIds={promotedDishIds}
                basket={basket}
                addToBasket={addToBasket}
                removeFromBasket={removeFromBasket}
                updateQuantity={updateQuantity}
                submitOrder={submitOrder}
                isOrderingEnabled={isOrderingEnabled}
                isNutritionVisible={isNutritionVisible}
            />
        )}
    </ThemeWrapper>
  );
};

export default App;