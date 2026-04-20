
import React, { useEffect, useState } from 'react';
import { CuisineCategory, Dish, ThemeType, SuitableForTag } from '../types';
import { 
  ChevronLeft, Home, Settings, Flame, Beef, Coffee, 
  Sun, Moon, Zap, Activity, Feather, Wheat, Loader2, ArrowRight,
  Droplets, X, Maximize2, Clock, ChevronRight, ShoppingBasket,
  CheckCircle2, Plus, Minus, Trash2, MessageSquare, ClipboardList
} from 'lucide-react';

interface ClientViewProps {
  categories: CuisineCategory[];
  dishes: Dish[];
  viewState: {
    view: 'menu-overview' | 'dish-viewer';
    currentCategory: string | null;
    currentDishIndex: number;
  };
  setViewState: React.Dispatch<React.SetStateAction<any>>;
  theme: ThemeType;
  appTitle: string;
  appSubtitle: string;
  promotionTitle?: string;
  philosophyTitle?: string;
  philosophyDescription?: string;
  promotedDishIds?: string[];
  isOffline?: boolean;
  onOpenSettings?: () => void;
  basket: any[];
  addToBasket: (dishId: string, notes?: string) => void;
  removeFromBasket: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  submitOrder: (tableNumber?: string, guestName?: string) => void;
  isOrderingEnabled: boolean;
  isNutritionVisible: boolean;
}

// Actual Logo URL removed as per request

const ImageWithFallback = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <div className={`responsive-image bg-gray-50 dark:bg-zinc-800 ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="animate-spin text-gray-300 dark:text-zinc-600" size={32} />
        </div>
      )}
      <img
        src={error ? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800' : src}
        alt={alt}
        className={`transition-all duration-1000 ${loading ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
};

const NutritionStat = ({ 
  label, 
  value, 
  unit = 'g', 
  isLast = false, 
  colorClass = "text-black dark:text-white",
  icon: Icon,
  animate = false
}: { 
  label: string, 
  value: number | string, 
  unit?: string, 
  isLast?: boolean, 
  colorClass?: string,
  icon?: React.ElementType,
  animate?: boolean
}) => (
  <div className={`flex-1 flex flex-col items-center px-1 ${!isLast ? 'border-r border-gray-100 dark:border-white/10' : ''} theme-transition`}>
    <div className="flex items-center gap-1.5 mb-2 group">
      {Icon && <Icon size={12} className={`${animate ? 'text-orange-500' : 'text-gray-200 dark:text-zinc-700'} group-hover:text-gray-400 transition-colors duration-700`} />}
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 dark:text-zinc-600 theme-transition">{label}</div>
    </div>
    <div className={`text-2xl font-black leading-none tracking-tighter ${colorClass} ${animate ? 'animate-pulse' : ''} theme-transition`}>
      {value}<span className="text-[10px] ml-0.5 opacity-40 font-bold lowercase tracking-normal">{unit}</span>
    </div>
  </div>
);

// Define DishCardProps interface
interface DishCardProps {
  dish: Dish;
  isClassic: boolean;
  onImageClick: (src: string) => void;
  onAddToBasket: (dishId: string) => void;
  index: number;
  isOrderingEnabled: boolean;
  isNutritionVisible: boolean;
}

const DishCard: React.FC<DishCardProps> = ({ dish, isClassic, onImageClick, onAddToBasket, index, isOrderingEnabled, isNutritionVisible }) => {
  const [isAdded, setIsAdded] = useState(false);
  const allComponents = [...dish.sideDishes, ...dish.ingredients];

  const handleAdd = () => {
    onAddToBasket(dish.id);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };
  
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] flex flex-col group hover:translate-y-[-8px] transition-all duration-700 h-full border border-gray-50 dark:border-white/5 opacity-0 animate-slide-up theme-transition" style={{ animationFillMode: 'forwards' }}>
      <div 
        className="relative overflow-hidden cursor-zoom-in group/img bg-gray-100 dark:bg-zinc-800 theme-transition"
        onClick={() => onImageClick(dish.image)}
      >
        <div className="absolute top-8 left-8 z-20 w-12 h-12 flex items-center justify-center bg-gray-400/20 dark:bg-black/40 backdrop-blur-md text-gray-500 dark:text-zinc-300 text-xs font-black rounded-full border border-white/20 dark:border-white/10 shadow-sm transition-transform duration-700 select-none tracking-widest">
          {(index + 1).toString().padStart(2, '0')}
        </div>

        <ImageWithFallback src={dish.image} alt={dish.name} className="group-hover:scale-110 transition-transform duration-[3s] ease-out" />
        
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center duration-700">
          <div className="p-4 bg-white/30 rounded-full text-white scale-75 group-hover/img:scale-100 transition-transform duration-700 border border-white/20">
            <Maximize2 size={24} />
          </div>
        </div>
      </div>

      <div className="p-10 flex-1 flex flex-col items-center text-center">
        <div className="mb-8 w-full flex flex-col items-center">
          <h3 className={`text-4xl font-black tracking-tighter text-[#1A1A1A] dark:text-zinc-100 mb-6 leading-tight ${isClassic ? 'font-serif italic' : ''} theme-transition`}>
            {dish.name}
          </h3>
          
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {allComponents.map((item, idx) => (
              <span 
                key={idx} 
                className="px-3 py-1.5 bg-gray-50/80 dark:bg-white/5 border border-gray-100/50 dark:border-white/5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500 whitespace-nowrap shadow-sm hover:bg-white dark:hover:bg-white/10 hover:shadow-md hover:border-gray-200 transition-all duration-700 theme-transition"
              >
                {item}
              </span>
            ))}
          </div>
 
          <p className="text-gray-400 dark:text-zinc-500 text-base font-light leading-relaxed line-clamp-3 italic tracking-wide theme-transition max-w-[90%]">
            {dish.description}
          </p>
        </div>
 
        <div className="mt-auto pt-8 border-t border-gray-50 dark:border-white/5 theme-transition w-full">
          {isNutritionVisible && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-4 h-px bg-gray-100 dark:bg-white/10"></div>
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-300 dark:text-zinc-600">Composition</span>
                <div className="w-4 h-px bg-gray-100 dark:bg-white/10"></div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <NutritionStat label="Cals" value={dish.nutrition.calories} unit="" icon={Flame} colorClass="text-orange-500" animate={true} />
                <NutritionStat label="Prot" value={dish.nutrition.protein} icon={Beef} />
                <NutritionStat label="Fat" value={dish.nutrition.fat} icon={Droplets} />
                <NutritionStat label="Carb" value={dish.nutrition.carbohydrates} icon={Wheat} />
                <NutritionStat label="Fiber" value={dish.nutrition.fiber} isLast icon={Feather} />
              </div>
            </div>
          )}

          {isOrderingEnabled && (
            <button 
              onClick={handleAdd}
              className={`w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 ${
                isAdded 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-black dark:bg-white text-white dark:text-black hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isAdded ? (
                <>
                  <CheckCircle2 size={16} /> Added to Basket
                </>
              ) : (
                <>
                  <ShoppingBasket size={16} /> Add to Basket
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Lightbox = ({ src, onClose }: { src: string; onClose: () => void }) => (
  <div 
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 cursor-zoom-out animate-fade-in p-6 md:p-20"
    onClick={onClose}
  >
    <button 
      className="absolute top-10 right-10 text-white/40 hover:text-white p-4 transition-all hover:rotate-90 duration-700"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <X size={40} />
    </button>
    <img 
      src={src} 
      className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-white/10 animate-scale-in select-none" 
      alt="Full size"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

interface BasketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  basket: any[];
  dishes: Dish[];
  removeFromBasket: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  submitOrder: (tableNumber?: string, guestName?: string) => void;
  tableNumber: string;
  setTableNumber: (val: string) => void;
  guestName: string;
  setGuestName: (val: string) => void;
  totalItems: number;
  totalCalories: number;
}

const BasketDrawer: React.FC<BasketDrawerProps> = ({
  isOpen, onClose, basket, dishes, removeFromBasket, updateQuantity,
  submitOrder, tableNumber, setTableNumber, guestName, setGuestName,
  totalItems, totalCalories
}) => (
  <div className={`fixed inset-0 z-[100] transition-all duration-700 ${isOpen ? 'visible' : 'invisible'}`}>
    <div 
      className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-700 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    />
    <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-950 shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="px-8 py-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black uppercase tracking-widest dark:text-white">Your Basket</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{totalItems} Items Selected</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={24} className="dark:text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6 no-scrollbar">
          {basket.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <ShoppingBasket size={32} className="text-gray-300" />
              </div>
              <h4 className="text-lg font-bold mb-2 dark:text-white">Basket is empty</h4>
              <p className="text-sm text-gray-400 max-w-[200px]">Browse our collection and add your favorite dishes.</p>
            </div>
          ) : (
            basket.map((item) => {
              const dish = dishes.find(d => d.id === item.dishId);
              if (!dish) return null;
              return (
                <div key={item.id} className="group">
                  <div className="flex gap-4 mb-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                      <img src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="text-sm font-bold truncate dark:text-white">{dish.name}</h5>
                        <button 
                          onClick={() => removeFromBasket(item.id)}
                          className="text-gray-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">
                        <Flame size={10} className="text-orange-500" />
                        {dish.nutrition.calories * item.quantity} kcal
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-full px-3 py-1">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-black w-4 text-center dark:text-white">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-xs font-black dark:text-white">#{dishes.indexOf(dish) + 1}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {basket.length > 0 && (
          <div className="p-8 bg-gray-50 dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5">
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1.5 ml-1">Table / Room</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 12"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border-none p-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-black/10 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1.5 ml-1">Guest Name</label>
                  <input 
                    type="text" 
                    placeholder="Optional"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border-none p-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-black/10 outline-none dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-white/10">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Total Energy</span>
                <div className="flex items-center gap-2 text-orange-500">
                  <Flame size={16} />
                  <span className="text-xl font-black tracking-tighter">{totalCalories} kcal</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                submitOrder(tableNumber, guestName);
                onClose();
                setTableNumber('');
                setGuestName('');
              }}
              className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10"
            >
              Submit Order to Butler
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

export const ClientView: React.FC<ClientViewProps> = ({ 
  categories, dishes, viewState, setViewState, theme, 
  appTitle, appSubtitle, promotionTitle, philosophyTitle, 
  philosophyDescription, promotedDishIds = [],
  basket, addToBasket, removeFromBasket, updateQuantity, submitOrder,
  isOrderingEnabled, isNutritionVisible
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const isClassic = theme === 'classic';

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNextCategory();
    } else if (isRightSwipe) {
      handlePrevCategory();
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedImage(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleNextCategory = () => {
    if (viewState.view === 'menu-overview') {
      setActiveCategoryIndex((prev) => (prev + 1) % categories.length);
    } else if (viewState.view === 'dish-viewer') {
      const currentIndex = categories.findIndex(c => c.id === viewState.currentCategory);
      const nextIndex = (currentIndex + 1) % categories.length;
      setViewState({ view: 'dish-viewer', currentCategory: categories[nextIndex].id, currentDishIndex: 0 });
    }
  };

  const handlePrevCategory = () => {
    if (viewState.view === 'menu-overview') {
      setActiveCategoryIndex((prev) => (prev - 1 + categories.length) % categories.length);
    } else if (viewState.view === 'dish-viewer') {
      const currentIndex = categories.findIndex(c => c.id === viewState.currentCategory);
      const prevIndex = (currentIndex - 1 + categories.length) % categories.length;
      setViewState({ view: 'dish-viewer', currentCategory: categories[prevIndex].id, currentDishIndex: 0 });
    }
  };

  const totalItems = basket.reduce((sum, item) => sum + item.quantity, 0);
  const totalCalories = basket.reduce((sum, item) => {
    const dish = dishes.find(d => d.id === item.dishId);
    return sum + (dish ? dish.nutrition.calories * item.quantity : 0);
  }, 0);

  if (viewState.view === 'menu-overview') {
    const promotedDishes = dishes.filter(d => promotedDishIds.includes(d.id));

    return (
      <div 
        className="min-h-screen bg-[#FBFBFA] dark:bg-zinc-950 text-slate-900 dark:text-slate-100 selection:bg-slate-900 selection:text-white antialiased overflow-x-hidden theme-transition touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {zoomedImage && <Lightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />}
        {isOrderingEnabled && (
          <BasketDrawer 
            isOpen={isBasketOpen}
            onClose={() => setIsBasketOpen(false)}
            basket={basket}
            dishes={dishes}
            removeFromBasket={removeFromBasket}
            updateQuantity={updateQuantity}
            submitOrder={submitOrder}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            guestName={guestName}
            setGuestName={setGuestName}
            totalItems={totalItems}
            totalCalories={totalCalories}
          />
        )}
        
        {/* Floating Basket Button */}
        {isOrderingEnabled && (
          <button 
            onClick={() => setIsBasketOpen(true)}
            className="fixed bottom-8 right-8 z-[60] w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          >
            <ShoppingBasket size={24} />
            {totalItems > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 animate-bounce">
                {totalItems}
              </div>
            )}
          </button>
        )}
        <div className="max-w-7xl mx-auto px-8 py-24 md:py-32">
          <header className="mb-24 flex flex-col md:flex-row md:items-start justify-between gap-12 opacity-0 animate-slide-up" style={{ animationFillMode: 'forwards' }}>
            <div className="relative transform-gpu flex flex-col">
              <h1 className="text-5xl md:text-7xl font-extralight tracking-tight text-slate-400 dark:text-zinc-600 mb-1 leading-none uppercase theme-transition">
                {appTitle}
              </h1>
              <div className="text-6xl md:text-8xl text-[#B08D57] dark:text-zinc-400 italic font-['Playfair_Display'] font-normal leading-none -mt-4 md:-mt-6 ml-1 drop-shadow-sm theme-transition">
                Selection
              </div>
            </div>
            <div className="md:mt-4 md:max-w-xs">
              <p className="text-slate-400 dark:text-zinc-500 text-xs md:text-sm font-black uppercase tracking-[0.5em] leading-relaxed theme-transition">
                {appSubtitle || "A curated anthology of culinary experiences, bridging the gap between historical heritage and modern avant-garde."}
              </p>
            </div>
          </header>

          <div className="relative mb-32 group">
            <div className="flex items-center justify-between mb-10">
              <span className="text-[10px] font-black uppercase tracking-[0.6em] text-gray-300 dark:text-zinc-700 theme-transition">Choose Your Menu Selection</span>
              <div className="flex gap-4">
                <button 
                  onClick={handlePrevCategory}
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-700 theme-transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={handleNextCategory}
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-700 theme-transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="relative h-[600px] flex items-center overflow-visible">
              <div 
                className="flex gap-10 transition-transform duration-[1.2s] ease-[cubic-bezier(0.23,1,0.32,1)] items-center"
                style={{ transform: `translateX(-${activeCategoryIndex * (420 + 40)}px)` }}
              >
                {categories.map((category, idx) => {
                  const isActive = idx === activeCategoryIndex;
                  return (
                    <div 
                      key={category.id} 
                      className={`w-[420px] shrink-0 transition-all duration-1000 ${isActive ? 'scale-100 opacity-100 z-10' : 'scale-90 opacity-40 blur-[1px]'}`}
                      onClick={() => setActiveCategoryIndex(idx)}
                    >
                      <div 
                        onClick={() => {
                          if (isActive) {
                            setViewState({ view: 'dish-viewer', currentCategory: category.id, currentDishIndex: 0 });
                          }
                        }}
                        className={`group cursor-pointer relative rounded-[3.5rem] overflow-hidden bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.06)] transition-all duration-700 flex flex-col h-[550px] theme-transition ${isActive ? 'hover:translate-y-[-8px] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)]' : ''}`}
                      >
                        <div className="w-full aspect-[4/3] overflow-hidden">
                          <ImageWithFallback src={category.image} alt={category.name} className="group-hover:scale-110 transition-transform duration-[3s] ease-out" />
                        </div>

                        <div className="p-12 flex flex-col justify-between flex-1 bg-white dark:bg-zinc-900 theme-transition">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.6em] text-[#B08D57] mb-4 block theme-transition">
                              Discover The Collection
                            </span>
                            <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mb-6 group-hover:text-[#B08D57] transition-colors duration-700 theme-transition">
                              {category.name}
                            </h2>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 font-light leading-relaxed line-clamp-3 italic theme-transition">
                              {category.description}
                            </p>
                          </div>
                          
                          <button className={`w-full py-5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-700 flex items-center justify-center gap-3 theme-transition ${isActive ? 'bg-black dark:bg-white text-white dark:text-black translate-y-0 opacity-100' : 'bg-gray-100 dark:bg-white/5 text-gray-400 translate-y-4 opacity-0'}`}>
                            Explore Menu <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-12 flex justify-start gap-3 pl-2">
              {categories.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setActiveCategoryIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-700 theme-transition ${i === activeCategoryIndex ? 'w-10 bg-[#B08D57]' : 'w-1.5 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-400'}`}
                />
              ))}
            </div>
          </div>

          {/* Signature Feature Section */}
          {promotedDishes.length > 0 && (
            <section className="opacity-0 animate-slide-up mb-32" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
                <div className="flex items-center gap-6 mb-12">
                    <div className="h-px bg-gray-200 dark:bg-zinc-800 flex-1 theme-transition"></div>
                    <span className="text-[9px] font-black uppercase tracking-[1em] text-gray-400 px-4 leading-none theme-transition">
                        {promotionTitle || "Signature Feature"}
                    </span>
                    <div className="h-px bg-gray-200 dark:bg-zinc-800 flex-1 theme-transition"></div>
                </div>

                <div className={`grid grid-cols-1 ${promotedDishes.length > 1 ? 'lg:grid-cols-2' : ''} gap-10`}>
                    {promotedDishes.map((dish, pIdx) => (
                        <div key={dish.id} className="relative group/promo">
                            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] overflow-hidden flex flex-col shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)] border border-gray-100/50 dark:border-white/5 transition-all duration-700 theme-transition h-full">
                                <div className="overflow-hidden bg-gray-50 dark:bg-black/20 relative theme-transition aspect-[16/9]">
                                    <div 
                                      className="w-full h-full cursor-zoom-in relative overflow-hidden group"
                                      onClick={() => setZoomedImage(dish.image)}
                                    >
                                        <img 
                                            src={dish.image} 
                                            alt={dish.name} 
                                            className="w-full h-full object-cover transition-transform duration-[6s] group-hover:scale-105 ease-out" 
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                    </div>
                                </div>

                                <div className="flex-1 p-8 lg:p-10 flex flex-col items-center text-center justify-center bg-white dark:bg-zinc-900 overflow-hidden theme-transition">
                                    <div className="flex items-center justify-center gap-3 mb-3">
                                        <span className="w-5 h-px bg-[#B08D57]"></span>
                                        <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[#B08D57]">Signature Selection {pIdx + 1}</span>
                                        <span className="w-5 h-px bg-[#B08D57]"></span>
                                    </div>
                                    
                                    <h2 className={`text-3xl lg:text-4xl font-black tracking-tighter text-slate-900 dark:text-zinc-100 mb-3 leading-tight ${isClassic ? 'font-serif italic' : ''} theme-transition`}>
                                        {dish.name}
                                    </h2>
                                    
                                    <p className="text-sm lg:text-base text-slate-400 dark:text-zinc-500 font-light leading-relaxed mb-6 max-w-xl italic line-clamp-2 theme-transition">
                                        {dish.description}
                                    </p>
                                    
                                    <div className="pt-6 border-t border-gray-100 dark:border-white/5 theme-transition mt-auto w-full">
                                        {isNutritionVisible && (
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="p-1 bg-[#B08D57]/10 rounded">
                                                        <Activity size={12} className="text-[#B08D57]" />
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 dark:text-zinc-600 theme-transition">Composition</span>
                                                </div>
                                                
                                                <div className="grid grid-cols-5 gap-x-2">
                                                    {[
                                                        { label: 'Cals', val: dish.nutrition.calories, unit: '' },
                                                        { label: 'Prot', val: dish.nutrition.protein, unit: 'g' },
                                                        { label: 'Fats', val: dish.nutrition.fat, unit: 'g' },
                                                        { label: 'Carbs', val: dish.nutrition.carbohydrates, unit: 'g' },
                                                        { label: 'Fiber', val: dish.nutrition.fiber, unit: 'g' }
                                                    ].map((stat, i) => (
                                                        <div key={i} className="flex flex-col items-center">
                                                            <span className="text-[7px] font-black uppercase tracking-widest text-gray-300 dark:text-zinc-600 mb-0.5 theme-transition">
                                                                {stat.label}
                                                            </span>
                                                            <div className="flex items-baseline gap-0.5">
                                                                <span className="text-lg font-black text-slate-800 dark:text-zinc-200 tracking-tighter theme-transition">
                                                                    {stat.val}
                                                                </span>
                                                                <span className="text-[7px] font-bold text-gray-300 dark:text-zinc-600 uppercase theme-transition">
                                                                    {stat.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                                  {isOrderingEnabled && (
                                                    <button 
                                                        onClick={() => addToBasket(dish.id)}
                                                        className="mt-8 w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                                                    >
                                                        <ShoppingBasket size={16} /> Add Signature to Basket
                                                    </button>
                                                  )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
          )}

          {/* Philosophy Section */}
          <section className="opacity-0 animate-slide-up mt-20 text-center max-w-2xl mx-auto px-6" style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}>
              <div className="inline-flex items-center justify-center gap-3 mb-6">
                  <div className="w-6 h-px bg-[#B08D57]/30"></div>
                  <span className="text-sm font-black uppercase tracking-[0.8em] text-[#B08D57]">
                      {philosophyTitle || "Nutritional Philosophy"}
                  </span>
                  <div className="w-6 h-px bg-[#B08D57]/30"></div>
              </div>
              <p className="text-2xl lg:text-3xl font-extralight text-slate-400 dark:text-zinc-500 leading-snug tracking-tight theme-transition">
                {philosophyDescription || "Every plate is balanced. Every calorie is considered. We believe private dining should be as nourishing as it is exquisite."}
              </p>
          </section>
        </div>
      </div>
    );
  }

  const currentCategoryDishes = dishes.filter(d => d.categoryId === viewState.currentCategory);
  const activeCategory = categories.find(c => c.id === viewState.currentCategory);

  return (
    <div 
      className="min-h-screen transition-all duration-700 ease-in-out font-['Inter'] selection:bg-black selection:text-white antialiased overflow-x-hidden theme-transition touch-pan-y"
      style={{
        backgroundColor: theme === 'dark' ? '#09090b' : '#FBFBFB'
      }}
    >
      {zoomedImage && <Lightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      {isOrderingEnabled && (
        <BasketDrawer 
          isOpen={isBasketOpen}
          onClose={() => setIsBasketOpen(false)}
          basket={basket}
          dishes={dishes}
          removeFromBasket={removeFromBasket}
          updateQuantity={updateQuantity}
          submitOrder={submitOrder}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
          guestName={guestName}
          setGuestName={setGuestName}
          totalItems={totalItems}
          totalCalories={totalCalories}
        />
      )}
 
      {/* Floating Basket Button */}
      {isOrderingEnabled && (
        <button 
          onClick={() => setIsBasketOpen(true)}
          className="fixed bottom-8 right-8 z-[60] w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
        >
          <ShoppingBasket size={24} />
          {totalItems > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 animate-bounce">
              {totalItems}
            </div>
          )}
        </button>
      )}
      
      <header className="px-12 py-10 flex justify-between items-center bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5 sticky top-0 z-50 theme-transition">
        <div className="flex-1">
          <button 
            onClick={() => setViewState((p: any) => ({...p, view: 'menu-overview'}))} 
            className="flex items-center gap-5 group"
          >
            <div className="w-14 h-14 flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-full group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all duration-700 shadow-sm border border-transparent dark:border-white/10 theme-transition">
              <Home size={22} />
            </div>
            <div className="hidden md:block text-left">
              <span className="text-[10px] font-black uppercase tracking-widest block text-gray-400 mb-0.5 theme-transition">Return to</span>
              <span className="text-sm font-bold tracking-tight dark:text-white theme-transition">Main Selection</span>
            </div>
          </button>
        </div>

        <div className="text-center flex-1 flex flex-col items-center">
          <h2 className={`text-xl font-black tracking-tight uppercase mb-2 dark:text-white ${isClassic ? 'font-serif italic' : ''} theme-transition`}>
            {activeCategory?.name || appTitle}
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-px bg-gray-200 dark:bg-white/10 theme-transition"></div>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-black uppercase tracking-[0.4em] theme-transition">
              {currentCategoryDishes.length} Featured Creations
            </span>
            <div className="w-10 h-px bg-gray-200 dark:bg-white/10 theme-transition"></div>
          </div>
        </div>

        <div className="flex-1 flex justify-end"></div>
      </header>

      <main className="max-w-[1800px] mx-auto px-8 md:px-16 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
          {currentCategoryDishes.map((dish, idx) => (
            <DishCard 
              key={dish.id} 
              dish={dish} 
              isClassic={isClassic} 
              onImageClick={setZoomedImage}
              onAddToBasket={addToBasket}
              index={idx}
              isOrderingEnabled={isOrderingEnabled}
              isNutritionVisible={isNutritionVisible}
            />
          ))}
        </div>

        {currentCategoryDishes.length === 0 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
             <div className="p-10 bg-white/80 dark:bg-zinc-900 shadow-xl rounded-[3rem] mb-10 border border-gray-100 dark:border-white/5 backdrop-blur theme-transition">
                <Feather size={56} className="text-gray-200 dark:text-zinc-700 theme-transition" />
             </div>
             <h3 className="text-3xl font-black mb-4 tracking-tight dark:text-white theme-transition">Curation in Progress</h3>
             <p className="text-gray-400 dark:text-zinc-500 max-w-sm text-lg font-light leading-relaxed theme-transition">Our culinary team is currently perfecting this collection. Return shortly for a sensory update.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export const PDFExportView: React.FC<{ dishes: Dish[], categories: CuisineCategory[], theme: ThemeType, onClose: () => void }> = ({ dishes, categories, theme, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            window.print();
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    const isClassic = theme === 'classic';

    return (
        <div className="bg-white text-black min-h-screen">
            <div className="fixed top-6 right-6 print:hidden flex gap-4 z-50">
                <button onClick={onClose} className="bg-black text-white px-8 py-3 rounded-full hover:bg-gray-800 text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all">Close Preview</button>
            </div>
            {dishes.map((dish, dishIdx) => (
                <div key={dish.id} className="w-full h-screen flex break-after-page page-break-always overflow-hidden bg-white" style={{ pageBreakAfter: 'always' }}>
                     <div className="w-1/2 h-full relative p-20 flex items-center justify-center">
                         <div className="responsive-image rounded-[4rem] overflow-hidden shadow-2xl border-[12px] border-gray-50 bg-gray-50">
                            <img src={dish.image} alt={dish.name} />
                         </div>
                     </div>
                     <div className="w-1/2 h-full p-24 flex flex-col justify-center">
                         <div className="text-[10px] uppercase tracking-[0.6em] mb-10 text-gray-400 font-black">{categories.find(c => c.id === dish.categoryId)?.name}</div>
                         <h1 className={`text-6xl mb-16 leading-none tracking-tighter ${isClassic ? 'font-serif italic font-bold' : 'font-black uppercase'}`}>{dish.name}</h1>
                         
                         <div className="grid grid-cols-2 gap-16 mb-20">
                             <div className="border-l-4 border-gray-100 pl-8"><span className="block text-[10px] uppercase font-black text-gray-300 mb-2 tracking-widest">Energy</span><span className="text-4xl font-black">{dish.nutrition.calories} <span className="text-xl font-bold opacity-30">kcal</span></span></div>
                             <div className="border-l-4 border-gray-100 pl-8"><span className="block text-[10px] uppercase font-black text-gray-300 mb-2 tracking-widest">Protein</span><span className="text-4xl font-black">{dish.nutrition.protein}<span className="text-xl font-bold opacity-30">g</span></span></div>
                         </div>

                         <div className="space-y-8">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-gray-200">Primary Components</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {dish.ingredients.map((ing, i) => (
                                  <div key={i} className="text-xl font-medium text-gray-800 flex items-center gap-3 italic">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                    {ing}
                                  </div>
                                ))}
                            </div>
                         </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
