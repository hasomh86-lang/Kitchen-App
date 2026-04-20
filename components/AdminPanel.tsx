import React, { useState } from 'react';
import { CuisineCategory, Dish, SuitableForTag, SUITABLE_FOR_OPTIONS, Order } from '../types';
import { enhanceDishImage, suggestDishDescription, generateImageFromText } from '../services/geminiService';
import { upsertCategory, deleteCategoryFromDB, upsertDish, deleteDishFromDB, signOut, upsertOrder, deleteOrderFromDB } from '../services/supabaseService';
import { Plus, Trash2, Edit, Upload, Wand2, X, Save, Image as ImageIcon, Loader2, Sparkles, Copy, Eye, EyeOff, Undo2, GripVertical, Sun, Moon, Coffee, Utensils, Zap, Activity, Feather, Beef, Wheat, Maximize, ZoomIn, ZoomOut, ArrowUpDown, LogOut, Palette, Star, Info, Hash, Clock, CheckCircle2, XCircle, MessageSquare, ClipboardList, Flame } from 'lucide-react';

interface AdminPanelProps {
  categories: CuisineCategory[];
  setCategories: React.Dispatch<React.SetStateAction<CuisineCategory[]>>;
  dishes: Dish[];
  setDishes: React.Dispatch<React.SetStateAction<Dish[]>>;
  onClose: () => void;
  isOrderingEnabled: boolean;
  setIsOrderingEnabled: (enabled: boolean) => Promise<void>;
  isNutritionVisible: boolean;
  setIsNutritionVisible: (visible: boolean) => Promise<void>;
  // Brand Settings
  appTitle: string;
  setAppTitle: (val: string) => void;
  appSubtitle: string;
  setAppSubtitle: (val: string) => void;
  promotionTitle: string;
  setPromotionTitle: (val: string) => void;
  philosophyTitle: string;
  setPhilosophyTitle: (val: string) => void;
  philosophyDescription: string;
  setPhilosophyDescription: (val: string) => void;
  // Orders
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const TAG_CONFIG: Record<SuitableForTag, { icon: React.ElementType, className: string }> = {
    'breakfast': { icon: Coffee, className: 'bg-amber-100 text-amber-800 border-amber-200' },
    'lunch': { icon: Sun, className: 'bg-orange-100 text-orange-800 border-orange-200' },
    'dinner': { icon: Moon, className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    'pre-workout': { icon: Zap, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'post-workout': { icon: Activity, className: 'bg-rose-100 text-rose-800 border-rose-200' },
    'light-meal': { icon: Feather, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    'high-protein': { icon: Beef, className: 'bg-red-100 text-red-800 border-red-200' },
    'low-carb': { icon: Wheat, className: 'bg-green-100 text-green-800 border-green-200' },
};

const SCENE_PRESETS = [
    { id: 'clean', name: 'Clean Studio', prompt: 'clean white studio surface, professional food photography, soft lighting' },
    { id: 'marble', name: 'White Marble', prompt: 'premium white marble table top, luxury dining, bright' },
    { id: 'onyx', name: 'White Onyx', prompt: 'translucent white onyx stone surface, elegant, backlit, soft texture' },
    { id: 'light-wood', name: 'Nordic Wood', prompt: 'light oak wood surface, natural texture, scandinavian style, soft shadows' },
    { id: 'wood-rings', name: 'Wood Rings', prompt: 'artistic light wood surface with natural ring patterns, top down' },
    { id: 'rustic', name: 'Rustic Table', prompt: 'dark rustic wooden table, moody dramatic lighting, rich texture' },
    { id: 'burnt', name: 'Burnt Wood', prompt: 'charred shou sugi ban wood texture, black and brown rings, artistic, dark' },
    { id: 'concrete', name: 'Concrete', prompt: 'industrial grey concrete surface, modern minimalism, raw texture' },
    { id: 'stone', name: 'Rough Stone', prompt: 'natural beige rough stone texture, organic feel, outdoor dining vibe' },
    { id: 'plaster', name: 'White Plaster', prompt: 'minimalist white rough plaster texture, mediterranean style, textured' },
    { id: 'slate', name: 'Black Slate', prompt: 'dark black slate stone surface, high contrast, premium, fine texture' },
    { id: 'silk', name: 'Silk Drapes', prompt: 'white product podium with draped elegant silk fabric, soft folds, luxury background' },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  categories, setCategories, dishes, setDishes, onClose, 
  isOrderingEnabled, setIsOrderingEnabled,
  isNutritionVisible, setIsNutritionVisible,
  appTitle, setAppTitle, appSubtitle, setAppSubtitle,
  promotionTitle, setPromotionTitle, philosophyTitle, setPhilosophyTitle,
  philosophyDescription, setPhilosophyDescription,
  orders, setOrders
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'dishes' | 'settings' | 'butler'>('categories');
  const [sortBy, setSortBy] = useState<'default' | 'calories-high' | 'calories-low' | 'name-asc'>('default');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<Partial<CuisineCategory> | null>(null);
  const [isGeneratingCategoryImg, setIsGeneratingCategoryImg] = useState(false);
  
  const [editingDish, setEditingDish] = useState<Partial<Dish> | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  const [suggestedDesc, setSuggestedDesc] = useState<string | null>(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogOut = async () => {
    await signOut();
    onClose();
  };

  const saveCategory = async () => {
    if (!editingCategory?.name || !editingCategory.image) return;
    setIsSyncing(true);
    try {
        const catToSave: CuisineCategory = {
            id: editingCategory.id || generateId(),
            name: editingCategory.name,
            description: editingCategory.description || '',
            image: editingCategory.image,
            isHidden: editingCategory.isHidden || false,
            order: editingCategory.order ?? categories.length
        };
        await upsertCategory(catToSave);
        if (editingCategory.id) {
          setCategories(prev => prev.map(c => c.id === catToSave.id ? catToSave : c).sort((a, b) => a.order - b.order));
        } else {
          setCategories(prev => [...prev, catToSave].sort((a, b) => a.order - b.order));
        }
        setEditingCategory(null);
    } catch (e) {
        console.error("Failed to save category:", e);
        alert("Persistence error.");
    } finally {
        setIsSyncing(false);
    }
  };

  const removeCategory = async (id: string) => {
    if (!confirm("Are you sure? All dishes in this category will be orphaned.")) return;
    setIsSyncing(true);
    try {
        await deleteCategoryFromDB(id);
        setCategories(prev => prev.filter(c => c.id !== id));
    } catch (e) {
        console.error("Failed to delete category:", e);
        alert("Failed to delete category. Make sure it's empty or try again.");
    } finally {
        setIsSyncing(false);
    }
  }

  const duplicateCategory = async (category: CuisineCategory) => {
      setIsSyncing(true);
      try {
          const newCategoryId = generateId();
          const newCategory = { 
              ...category, 
              id: newCategoryId, 
              name: `${category.name} (Copy)`,
              isHidden: false,
              order: categories.length
          };

          // Deep duplication: Copy all dishes associated with this category
          const categoryDishes = dishes.filter(d => d.categoryId === category.id);
          const newDishes = categoryDishes.map(d => ({
              ...d,
              id: generateId(),
              categoryId: newCategoryId,
              name: `${d.name} (Copy)`,
              isHidden: false
          }));

          await upsertCategory(newCategory);
          for (const dish of newDishes) {
              await upsertDish(dish);
          }

          setCategories(prev => [...prev, newCategory].sort((a, b) => a.order - b.order));
          setDishes(prev => [...prev, ...newDishes]);
      } catch (e) {
          console.error("Duplication failed:", e);
          alert("Could not duplicate category contents.");
      } finally {
          setIsSyncing(false);
      }
  };

  const toggleCategoryVisibility = async (category: CuisineCategory) => {
      const updated = { ...category, isHidden: !category.isHidden };
      setIsSyncing(true);
      try {
          await upsertCategory(updated);
          setCategories(prev => prev.map(c => c.id === category.id ? updated : c));
      } catch (e) {
          console.error(e);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleCategoryDragStart = (e: React.DragEvent, catId: string) => {
    e.dataTransfer.setData('categoryId', catId);
  };

  const handleCategoryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCategoryDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('categoryId');
    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = categories.findIndex(c => c.id === sourceId);
    const targetIndex = categories.findIndex(c => c.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newCategories = [...categories];
    const [movedCategory] = newCategories.splice(sourceIndex, 1);
    newCategories.splice(targetIndex, 0, movedCategory);

    // Update orders
    const updatedCategories = newCategories.map((cat, index) => ({
      ...cat,
      order: index
    }));

    setCategories(updatedCategories);
    setIsSyncing(true);
    try {
      // Save all updated orders to DB
      await Promise.all(updatedCategories.map(cat => upsertCategory(cat)));
    } catch (e) {
      console.error("Failed to update category order:", e);
      alert("Failed to save new order.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateCategoryImage = async () => {
      if (!editingCategory?.name) return;
      setIsGeneratingCategoryImg(true);
      try {
          const prompt = `A professional food photography image representing the cuisine category: ${editingCategory.name}. ${editingCategory.description ? `Description: ${editingCategory.description}` : ''}. High quality, appetizing, photorealistic, premium lighting.`;
          const image = await generateImageFromText(prompt);
          if (image) {
              setEditingCategory(prev => ({ ...prev, image }));
          } else {
              alert("Failed to generate image.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingCategoryImg(false);
      }
  };

  const saveDish = async () => {
    if (!editingDish?.name || !editingDish.categoryId || !editingDish.image || !editingDish.nutrition) return;

    const dishToSave = {
        ...editingDish,
        id: editingDish.id || generateId(),
        description: editingDish.description || '',
        sideDishes: editingDish.sideDishes || [],
        ingredients: editingDish.ingredients || [],
        suitableFor: editingDish.suitableFor || [],
        isHidden: editingDish.isHidden || false
    } as Dish;

    setIsSyncing(true);
    try {
        await upsertDish(dishToSave);
        if (editingDish.id) {
          setDishes(prev => prev.map(d => d.id === dishToSave.id ? dishToSave : d));
        } else {
          setDishes(prev => [...prev, dishToSave]);
        }
        setEditingDish(null);
        setSuggestedDesc(null);
        setLastImage(null);
    } catch (e) {
        console.error("Failed to save dish:", e);
        alert("Database error.");
    } finally {
        setIsSyncing(false);
    }
  };

  const removeDish = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dish?")) return;
    setIsSyncing(true);
    try {
        await deleteDishFromDB(id);
        setDishes(prev => prev.filter(d => d.id !== id));
    } catch (e) {
        console.error("Failed to delete dish:", e);
        alert("Failed to delete dish. Please try again.");
    } finally {
        setIsSyncing(false);
    }
  }

  const duplicateDish = async (dish: Dish) => {
      const newDish = { 
          ...dish, 
          id: generateId(), 
          name: `${dish.name} (Copy)`,
          isHidden: false 
      };
      setIsSyncing(true);
      try {
          await upsertDish(newDish);
          setDishes(prev => [...prev, newDish]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSyncing(false);
      }
  };

  const toggleVisibility = async (dish: Dish) => {
      const updated = { ...dish, isHidden: !dish.isHidden };
      setIsSyncing(true);
      try {
          await upsertDish(updated);
          setDishes(prev => prev.map(d => d.id === dish.id ? updated : d));
      } catch (e) {
          console.error(e);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleAIImageEnhance = async (type: 'lighting' | 'color' | 'remove-bg' | 'replace-bg' | 'upscale' | 'zoom-in' | 'zoom-out', modifier?: string) => {
    if (!editingDish?.image) return;
    setLastImage(editingDish.image); 
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceDishImage(editingDish.image, type, modifier);
      if (enhanced) {
        setEditingDish(prev => ({ ...prev, image: enhanced }));
      }
    } catch (e) {
        console.error(e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUndoImage = () => {
      if (lastImage) {
          setEditingDish(prev => ({ ...prev, image: lastImage }));
          setLastImage(null);
      }
  };

  const handleAutoDescription = async () => {
      if(!editingDish?.name) return;
      setIsGeneratingDesc(true);
      try {
        const desc = await suggestDishDescription(editingDish.name, editingDish.ingredients || []);
        setSuggestedDesc(desc);
        setEditingDish(prev => ({ ...prev, description: desc }));
      } catch (e) {
        console.error(e);
      } finally {
        setIsGeneratingDesc(false);
      }
  }

  const handleDragStart = (e: React.DragEvent, dishId: string) => {
      e.dataTransfer.setData('dishId', dishId);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
      e.preventDefault();
      setDragOverCategoryId(categoryId);
  };

  const handleDrop = async (e: React.DragEvent, categoryId: string) => {
      e.preventDefault();
      if (sortBy !== 'default') return;

      const dishId = e.dataTransfer.getData('dishId');
      if (dishId) {
          const dish = dishes.find(d => d.id === dishId);
          if (dish) {
              const updated = { ...dish, categoryId };
              setIsSyncing(true);
              try {
                  await upsertDish(updated);
                  setDishes(prev => {
                     const newList = prev.filter(d => d.id !== dishId);
                     newList.push(updated);
                     return newList;
                  });
              } catch (e) {
                  console.error(e);
              } finally {
                  setIsSyncing(false);
              }
          }
      }
      setDragOverCategoryId(null);
  };

  const handleDishReorder = async (e: React.DragEvent, targetDish: Dish) => {
      e.preventDefault();
      e.stopPropagation();
      if (sortBy !== 'default') return;

      const draggedDishId = e.dataTransfer.getData('dishId');
      if (!draggedDishId || draggedDishId === targetDish.id) return;

      const draggedDish = dishes.find(d => d.id === draggedDishId);
      if (draggedDish) {
          const updated = { ...draggedDish, categoryId: targetDish.categoryId };
          setIsSyncing(true);
          try {
              await upsertDish(updated);
              setDishes(prev => {
                  const newList = prev.filter(d => d.id !== draggedDishId);
                  const targetIndex = newList.findIndex(d => d.id === targetDish.id);
                  newList.splice(targetIndex, 0, updated);
                  return newList;
              });
          } catch (e) {
              console.error(e);
          } finally {
              setIsSyncing(false);
          }
      }
  };

  const handleDragEnd = () => {
      setDragOverCategoryId(null);
  };

  const renderCategoryEditor = () => (
    <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl p-8 rounded-2xl shadow-2xl max-w-2xl mx-auto border border-white/50 dark:border-white/5 animate-scale-in no-scrollbar max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{editingCategory?.id ? 'Edit Category' : 'New Category'}</h3>
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Name</label>
                <input 
                    type="text" 
                    className="w-full bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3 rounded-lg focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:outline-none transition-all dark:text-white" 
                    value={editingCategory?.name || ''} 
                    onChange={e => setEditingCategory(p => ({...p, name: e.target.value}))}
                />
            </div>
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Description</label>
                <textarea 
                    className="w-full bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3 rounded-lg focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:outline-none transition-all dark:text-white h-24" 
                    value={editingCategory?.description || ''} 
                    onChange={e => setEditingCategory(p => ({...p, description: e.target.value}))}
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Card Image</label>
                <div className="flex flex-col gap-3">
                    {editingCategory?.image ? (
                        <div className="responsive-image bg-gray-50 rounded-xl overflow-hidden">
                            <img src={editingCategory.image} alt={editingCategory.name} />
                            <button onClick={() => setEditingCategory(p => ({...p, image: undefined}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-opacity z-10"><X size={12}/></button>
                        </div>
                    ) : (
                        <div className="w-full aspect-video bg-gray-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-white/10">
                            <ImageIcon size={32} />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-md">
                            <Upload size={14} />
                            Upload
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, (base64) => setEditingCategory(p => ({...p, image: base64})))} />
                        </label>
                        <button 
                            onClick={handleGenerateCategoryImage}
                            disabled={!editingCategory?.name || isGeneratingCategoryImg}
                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 shadow-md"
                        >
                            {isGeneratingCategoryImg ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                            AI
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/10">
                <button onClick={() => setEditingCategory(null)} className="px-6 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                <button onClick={saveCategory} disabled={isSyncing} className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-medium flex items-center gap-2">
                    {isSyncing && <Loader2 size={16} className="animate-spin" />}
                    Save Category
                </button>
            </div>
        </div>
    </div>
  );

  const renderDishEditor = () => (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-8 rounded-2xl shadow-2xl max-w-5xl mx-auto h-[85vh] overflow-y-auto border border-white/50 dark:border-white/5 animate-scale-in no-scrollbar">
        <h3 className="text-2xl font-bold mb-8 text-gray-800 dark:text-gray-100 flex items-center gap-3">
            {editingDish?.id ? 'Edit Dish' : 'New Dish'}
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-full border dark:border-white/10">AI Enabled</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
                 <div className="responsive-image bg-gray-50 dark:bg-white/5 rounded-2xl overflow-hidden relative group border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-colors">
                    {editingDish?.image ? (
                        <img src={editingDish.image} alt={editingDish.name} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                             <ImageIcon size={48} className="mb-2 opacity-50" />
                             <span>No Image Selected</span>
                        </div>
                    )}
                    
                    {lastImage && (
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUndoImage();
                            }}
                            className="absolute top-4 left-4 z-30 p-2.5 bg-white/80 dark:bg-black/80 hover:bg-white dark:hover:bg-black text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded-xl shadow-lg border border-white/40 dark:border-white/10 backdrop-blur-md transition-all hover:scale-105"
                            title="Undo last change"
                        >
                            <Undo2 size={20} />
                        </button>
                    )}

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <label className="cursor-pointer text-white flex flex-col items-center hover:scale-110 transition-transform">
                            <Upload className="w-10 h-10 mb-2" />
                            <span className="font-medium">Upload New</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, (base64) => {
                                setLastImage(editingDish?.image || null);
                                setEditingDish(p => ({...p, image: base64}));
                            })} />
                        </label>
                    </div>
                    {isEnhancing && (
                        <div className="absolute inset-0 bg-white/90 dark:bg-black/90 flex flex-col items-center justify-center z-20">
                            <Loader2 className="animate-spin text-blue-600 mb-2" size={40} />
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-300 animate-pulse">Enhancing with Gemini...</span>
                        </div>
                    )}
                 </div>
                 
                 {editingDish?.image && (
                     <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                         <h4 className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                             <Wand2 size={16}/> 
                             AI Studio Tools
                         </h4>
                         
                         <div className="grid grid-cols-2 gap-3 mb-6">
                             <button onClick={() => handleAIImageEnhance('lighting')} className="text-xs font-medium bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white hover:border-transparent transition-all shadow-sm">Improve Lighting</button>
                             <button onClick={() => handleAIImageEnhance('color')} className="text-xs font-medium bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white hover:border-transparent transition-all shadow-sm">Enhance Colors</button>
                             <button onClick={() => handleAIImageEnhance('upscale')} className="text-xs font-medium bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white hover:border-transparent transition-all shadow-sm flex items-center justify-center gap-2"><Maximize size={12}/> Upscale AI</button>
                             <button onClick={() => handleAIImageEnhance('remove-bg')} className="text-xs font-medium bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white hover:border-transparent transition-all shadow-sm">Remove Background</button>
                         </div>
                         <div className="border-t border-blue-200/50 dark:border-blue-900/20 pt-4">
                             <label className="text-xs font-bold text-blue-900 dark:text-blue-400 block mb-3 uppercase tracking-wide">Scene Generation</label>
                             <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                                {SCENE_PRESETS.map(scene => (
                                    <button 
                                        key={scene.id}
                                        onClick={() => handleAIImageEnhance('replace-bg', scene.prompt)} 
                                        className="text-xs bg-white/80 dark:bg-zinc-800 p-2.5 rounded-lg hover:bg-white dark:hover:bg-zinc-700 transition-all border border-transparent hover:border-blue-200 text-left flex items-center gap-2 group dark:text-zinc-300"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-blue-100 dark:bg-blue-900 group-hover:bg-blue-500 transition-colors"></div>
                                        {scene.name}
                                    </button>
                                ))}
                             </div>
                         </div>
                     </div>
                 )}
            </div>

            <div className="space-y-6">
                 <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Category</label>
                    <select 
                        className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all dark:text-white"
                        value={editingDish?.categoryId || ''}
                        onChange={e => setEditingDish(p => ({...p, categoryId: e.target.value}))}
                    >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Dish Name & Description</label>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all font-medium text-lg dark:text-white" 
                            value={editingDish?.name || ''} 
                            onChange={e => setEditingDish(p => ({...p, name: e.target.value}))} 
                        />
                         <button 
                            onClick={handleAutoDescription}
                            disabled={isGeneratingDesc || !editingDish?.name}
                            className="bg-purple-600 text-white p-4 rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 shadow-md hover:shadow-purple-200"
                            title="Generate AI Description"
                        >
                            {isGeneratingDesc ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                        </button>
                    </div>
                    <textarea 
                        className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all h-24 resize-none font-light text-base leading-relaxed dark:text-white" 
                        placeholder="Appetizing description..."
                        value={editingDish?.description || ''}
                        onChange={e => setEditingDish(p => ({...p, description: e.target.value}))}
                    />
                    {suggestedDesc && (
                        <div className="mt-4 p-5 bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-300 rounded-xl border border-purple-100 dark:border-purple-900/30 animate-slide-up relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-200 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>
                            <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">
                                <Sparkles size={14} />
                                <span>Gemini Suggestion Applied</span>
                            </div>
                            <p className="italic text-base leading-relaxed relative z-10">"{suggestedDesc}"</p>
                        </div>
                    )}
                 </div>

                 <div className="border border-gray-100 dark:border-white/5 p-6 rounded-2xl bg-white dark:bg-white/5 shadow-sm">
                     <h5 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-400 dark:text-gray-500">Nutrition Profile</h5>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 col-span-2">
                            <label className="text-xs text-orange-600 dark:text-orange-400 font-bold block mb-1">Calories (kcal)</label>
                            <input type="number" className="w-full bg-transparent font-mono font-bold text-xl outline-none text-orange-900 dark:text-orange-200" value={editingDish?.nutrition?.calories || 0} onChange={e => setEditingDish(p => ({...p, nutrition: {...p.nutrition!, calories: parseInt(e.target.value) || 0}}))} />
                         </div>
                         <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Protein (g)</label>
                            <input type="number" className="w-full bg-transparent font-mono text-lg outline-none dark:text-white" value={editingDish?.nutrition?.protein || 0} onChange={e => setEditingDish(p => ({...p, nutrition: {...p.nutrition!, protein: parseInt(e.target.value) || 0}}))} />
                         </div>
                         <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Fat (g)</label>
                            <input type="number" className="w-full bg-transparent font-mono text-lg outline-none dark:text-white" value={editingDish?.nutrition?.fat || 0} onChange={e => setEditingDish(p => ({...p, nutrition: {...p.nutrition!, fat: parseInt(e.target.value) || 0}}))} />
                         </div>
                         <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Carbs (g)</label>
                            <input type="number" className="w-full bg-transparent font-mono text-lg outline-none dark:text-white" value={editingDish?.nutrition?.carbohydrates || 0} onChange={e => setEditingDish(p => ({...p, nutrition: {...p.nutrition!, carbohydrates: parseInt(e.target.value) || 0}}))} />
                         </div>
                         <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Fiber (g)</label>
                            <input type="number" className="w-full bg-transparent font-mono text-lg outline-none dark:text-white" value={editingDish?.nutrition?.fiber || 0} onChange={e => setEditingDish(p => ({...p, nutrition: {...p.nutrition!, fiber: parseInt(e.target.value) || 0}}))} />
                         </div>
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Ingredients</label>
                        <textarea className="w-full bg-gray-50 dark:bg-white/5 border-none p-3 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all h-32 resize-none dark:text-white" 
                            placeholder="Comma separated..."
                            value={editingDish?.ingredients?.join(', ') || ''}
                            onChange={e => setEditingDish(p => ({...p, ingredients: e.target.value.split(',').map(s => s.trim())}))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Side Dishes</label>
                        <textarea className="w-full bg-gray-50 dark:bg-white/5 border-none p-3 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all h-32 resize-none dark:text-white" 
                            placeholder="Comma separated..."
                            value={editingDish?.sideDishes?.join(', ') || ''}
                            onChange={e => setEditingDish(p => ({...p, sideDishes: e.target.value.split(',').map(s => s.trim())}))}
                        />
                    </div>
                 </div>
            </div>
        </div>

        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-white/10">
            <button onClick={() => { setEditingDish(null); setSuggestedDesc(null); setLastImage(null); }} className="px-8 py-4 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
            <button onClick={saveDish} disabled={isSyncing} className="px-10 py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-bold tracking-wide flex items-center gap-2">
                {isSyncing && <Loader2 size={18} className="animate-spin" />}
                Save Dish
            </button>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/5 dark:bg-black/40 z-50 overflow-y-auto backdrop-blur-sm animate-fade-in">
        <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-white/20 dark:border-white/5 px-10 py-6 flex justify-between items-center sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                 <h1 className="text-xl font-bold tracking-tight dark:text-white">Chef Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLogOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={18} />
                Log Out
              </button>
              <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors dark:text-white"><X size={20}/></button>
            </div>
        </div>
        
        <div className="max-w-7xl mx-auto p-10">
            {editingCategory ? renderCategoryEditor() : editingDish ? renderDishEditor() : (
                <>
                    <div className="flex gap-8 mb-10 border-b border-gray-200 dark:border-white/10">
                        <button 
                            className={`pb-4 px-2 text-lg transition-all ${activeTab === 'categories' ? 'border-b-2 border-black dark:border-white font-bold dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => setActiveTab('categories')}
                        >
                            Categories
                        </button>
                        <button 
                            className={`pb-4 px-2 text-lg transition-all ${activeTab === 'dishes' ? 'border-b-2 border-black dark:border-white font-bold dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => setActiveTab('dishes')}
                        >
                            Dishes
                        </button>
                        <button 
                            className={`pb-4 px-2 text-lg transition-all ${activeTab === 'settings' ? 'border-b-2 border-black dark:border-white font-bold dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            Settings
                        </button>
                        <button 
                            className={`pb-4 px-2 text-lg transition-all ${activeTab === 'butler' ? 'border-b-2 border-black dark:border-white font-bold dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => setActiveTab('butler')}
                        >
                            Butler
                        </button>
                    </div>

                    {activeTab === 'butler' ? (
                        <div className="animate-fade-in space-y-10">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-extralight tracking-tight mb-2 dark:text-white">Active Orders</h2>
                                    <p className="text-gray-400 dark:text-zinc-500 text-sm">Manage and track guest requests in real-time.</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="bg-gray-100 dark:bg-white/5 px-6 py-3 rounded-2xl flex items-center gap-3">
                                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest dark:text-zinc-300">{orders.filter(o => o.status === 'pending').length} Pending</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {orders.length === 0 ? (
                                    <div className="py-32 text-center bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
                                        <Utensils size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-6" />
                                        <h3 className="text-xl font-bold mb-2 dark:text-white">No active orders</h3>
                                        <p className="text-gray-400 dark:text-zinc-500 text-sm">Orders will appear here once submitted by guests.</p>
                                    </div>
                                ) : (
                                    orders.map((order) => (
                                        <div 
                                            key={order.id} 
                                            className={`bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border transition-all overflow-hidden ${
                                                order.status === 'pending' ? 'border-amber-100 dark:border-amber-900/30' : 'border-gray-100 dark:border-white/5'
                                            }`}
                                        >
                                            <div className="p-8 md:p-10">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-gray-50 dark:border-white/5">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                                                            <Hash size={24} className="text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <span className="text-xl font-black tracking-tight dark:text-white">{order.id}</span>
                                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                                    order.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                                    order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                }`}>
                                                                    {order.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-gray-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                                                                <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(order.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                {order.tableNumber && <span>• Table {order.tableNumber}</span>}
                                                                {order.guestName && <span>• {order.guestName}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {order.status === 'pending' && (
                                                            <>
                                                                <button 
                                                                    onClick={async () => {
                                                                        const updated = { ...order, status: 'completed' as const };
                                                                        setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
                                                                        await upsertOrder(updated);
                                                                    }}
                                                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                                                                >
                                                                    <CheckCircle2 size={16} /> Complete
                                                                </button>
                                                                <button 
                                                                    onClick={async () => {
                                                                        const updated = { ...order, status: 'cancelled' as const };
                                                                        setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
                                                                        await upsertOrder(updated);
                                                                    }}
                                                                    className="flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20"
                                                                >
                                                                    <XCircle size={16} /> Cancel
                                                                </button>
                                                            </>
                                                        )}
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (confirm("Delete this order record?")) {
                                                                    setOrders(prev => prev.filter(o => o.id !== order.id));
                                                                    await deleteOrderFromDB(order.id);
                                                                }
                                                            }}
                                                            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl border border-gray-100 dark:border-white/5 transition-all"
                                                            title="Delete Order"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                                    <div className="lg:col-span-2 space-y-6">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4">Ordered Items</h4>
                                                        <div className="space-y-4">
                                                            {order.items.map((item, idx) => (
                                                                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl group transition-all hover:bg-gray-100 dark:hover:bg-white/10">
                                                                    <div className="flex items-center gap-5">
                                                                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm">
                                                                            <img src={item.dish.image} alt={item.dish.name} className="w-full h-full object-cover" />
                                                                        </div>
                                                                        <div>
                                                                            <h5 className="text-sm font-bold dark:text-white">{item.dish.name}</h5>
                                                                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium tracking-wide">
                                                                                {item.dish.nutrition.calories} kcal per serving
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-8">
                                                                        {item.notes && (
                                                                            <div className="hidden md:flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                                                <MessageSquare size={14} />
                                                                                <span className="text-[10px] font-bold italic">{item.notes}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="text-right">
                                                                            <span className="text-lg font-black tracking-tight dark:text-white">x{item.quantity}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] h-fit">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-6">Order Summary</h4>
                                                        <div className="space-y-4">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 dark:text-zinc-400">Total Items</span>
                                                                <span className="text-sm font-bold dark:text-white">{order.items.reduce((sum, i) => sum + i.quantity, 0)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-gray-500 dark:text-zinc-400">Total Energy</span>
                                                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                                    <Flame size={14} />
                                                                    <span className="text-sm font-bold">{order.totalCalories} kcal</span>
                                                                </div>
                                                            </div>
                                                            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-white/10">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs font-black uppercase tracking-widest text-gray-400">Status</span>
                                                                    <span className="text-xs font-black uppercase tracking-widest text-[#B08D57]">{order.status}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'settings' ? (
                        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                            {/* Brand Details Section */}
                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
                                <div className="flex items-center gap-3 mb-8">
                                    <Info size={24} className="text-black dark:text-white" />
                                    <h3 className="text-xl font-bold dark:text-white">Brand Identity</h3>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 ml-1">Restaurant Name</label>
                                            <input 
                                                type="text" 
                                                value={appTitle} 
                                                onChange={e => setAppTitle(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl text-sm font-bold focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 outline-none dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 ml-1">Promotion Subject</label>
                                            <input 
                                                type="text" 
                                                value={promotionTitle} 
                                                onChange={e => setPromotionTitle(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 outline-none dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 ml-1">Tagline</label>
                                        <input 
                                            type="text" 
                                            value={appSubtitle} 
                                            onChange={e => setAppSubtitle(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 outline-none dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 ml-1">Philosophy Title</label>
                                        <input 
                                            type="text" 
                                            value={philosophyTitle} 
                                            onChange={e => setPhilosophyTitle(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 outline-none dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 ml-1">Philosophy Text</label>
                                        <textarea 
                                            value={philosophyDescription} 
                                            onChange={e => setPhilosophyDescription(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none p-4 rounded-xl text-sm font-light focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 outline-none dark:text-white h-24 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold dark:text-white">Enable Basket & Ordering</h3>
                                        <p className="text-sm text-gray-500 dark:text-zinc-400">Toggle the entire ordering system ON or OFF for all customers.</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsOrderingEnabled(!isOrderingEnabled)}
                                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isOrderingEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
                                    >
                                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isOrderingEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                                    <Zap size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                                        <strong>Note:</strong> This is a global setting. Switching this OFF will immediately hide the basket, checkout, and all ordering buttons from all connected devices in real-time.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold dark:text-white">Display Nutrition Facts</h3>
                                        <p className="text-sm text-gray-500 dark:text-zinc-400">Show or hide nutritional information on all dish cards for clients.</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsNutritionVisible(!isNutritionVisible)}
                                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isNutritionVisible ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
                                    >
                                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isNutritionVisible ? 'translate-x-7' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                                    <Info size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                                        <strong>Control:</strong> Hiding nutrition facts will remove the composition breakdown from dish cards but keep your data safely stored in the dashboard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'categories' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <button 
                                onClick={() => setEditingCategory({})}
                                className="h-64 border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
                            >
                                <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-full mb-4 group-hover:scale-110 transition-transform"><Plus size={32} /></div>
                                <span className="font-medium">New Category</span>
                            </button>
                            {categories.map((cat, i) => (
                                <div 
                                    key={cat.id} 
                                    draggable
                                    onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                    onDragOver={handleCategoryDragOver}
                                    onDrop={(e) => handleCategoryDrop(e, cat.id)}
                                    className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group relative animate-slide-up cursor-move ${cat.isHidden ? 'opacity-75' : ''}`} 
                                    style={{animationDelay: `${i*100}ms`}}
                                >
                                    <div className="responsive-image bg-gray-50">
                                        <img src={cat.image} alt={cat.name} className={`transform group-hover:scale-110 transition-transform duration-700 ${cat.isHidden ? 'grayscale' : ''}`} />
                                        {cat.isHidden && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] z-[5]">
                                                 <span className="bg-black/70 text-white text-[10px] px-3 py-1 rounded-full uppercase font-black tracking-widest shadow-lg">Hidden From Menu</span>
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 p-2 bg-black/50 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <GripVertical size={16} />
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h4 className="font-bold text-xl mb-2 flex items-center gap-2 dark:text-white">
                                            {cat.name}
                                            {cat.isHidden && <EyeOff size={14} className="text-gray-400"/>}
                                        </h4>
                                        <p className="text-sm text-gray-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{cat.description}</p>
                                    </div>
                                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-10">
                                         <button 
                                            disabled={isSyncing}
                                            onClick={(e) => { e.stopPropagation(); toggleCategoryVisibility(cat); }} 
                                            className="p-2.5 bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all hover:scale-110 border border-black/5 dark:border-white/10 disabled:opacity-50" 
                                            title={cat.isHidden ? "Show Category" : "Hide Category"}
                                         >
                                            {cat.isHidden ? <Eye size={16}/> : <EyeOff size={16}/>}
                                        </button>
                                        <button 
                                            disabled={isSyncing}
                                            onClick={(e) => { e.stopPropagation(); duplicateCategory(cat); }} 
                                            className="p-2.5 bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all hover:scale-110 border border-black/5 dark:border-white/10 disabled:opacity-50" 
                                            title="Duplicate Category"
                                        >
                                            <Copy size={16}/>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); }} className="p-2.5 bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all hover:scale-110 border border-black/5 dark:border-white/10"><Edit size={16}/></button>
                                        <button 
                                            disabled={isSyncing}
                                            onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }} 
                                            className="p-2.5 bg-white/95 dark:bg-black/80 backdrop-blur-md text-red-600 rounded-full shadow-lg hover:bg-red-500 hover:text-white transition-all hover:scale-110 border border-black/5 dark:border-white/10 disabled:opacity-50"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-10 animate-slide-up">
                            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                                <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-white/5 flex items-center">
                                    <div className="px-3 py-2 border-r border-gray-100 dark:border-white/10 text-gray-400">
                                        <ArrowUpDown size={16} />
                                    </div>
                                    <select 
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                        className="bg-transparent py-2 pl-3 pr-8 text-sm font-medium text-gray-700 dark:text-zinc-300 outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 rounded-r-xl appearance-none"
                                        style={{backgroundImage: 'none'}}
                                    >
                                        <option value="default">Default Order</option>
                                        <option value="calories-high">Calories (High → Low)</option>
                                        <option value="calories-low">Calories (Low → High)</option>
                                        <option value="name-asc">Alphabetical (A-Z)</option>
                                    </select>
                                </div>
                                <button onClick={() => { setEditingDish({ nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0 } }); setSuggestedDesc(null); setLastImage(null); }} className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all font-bold">
                                    <Plus size={18}/> Add New Dish
                                </button>
                            </div>
                            {categories.map(cat => {
                                const sortedDishes = dishes.filter(d => d.categoryId === cat.id).sort((a, b) => {
                                    if (sortBy === 'calories-high') return b.nutrition.calories - a.nutrition.calories;
                                    if (sortBy === 'calories-low') return a.nutrition.calories - b.nutrition.calories;
                                    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
                                    return 0;
                                });
                                return (
                                    <div 
                                        key={cat.id} 
                                        className={`bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-6 rounded-3xl border transition-all duration-300 ${dragOverCategoryId === cat.id ? 'border-blue-400 bg-blue-50/50 scale-[1.01]' : 'border-gray-200 dark:border-white/5'}`}
                                        onDragOver={(e) => handleDragOver(e, cat.id)}
                                        onDrop={(e) => handleDrop(e, cat.id)}
                                    >
                                        <h3 className="text-xl font-bold mb-6 ml-2 dark:text-white flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-black dark:bg-white rounded-full"></div>
                                            {cat.name}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[100px]">
                                            {sortedDishes.length === 0 && (
                                                <div className="col-span-full border-2 border-dashed border-gray-200 dark:border-white/5 rounded-2xl flex items-center justify-center text-gray-400 text-sm font-medium h-32 text-center px-6">
                                                    No dishes in this category.<br/>Drag dishes here or add a new one.
                                                </div>
                                            )}
                                            {sortedDishes.map((dish, idx) => (
                                                <div 
                                                    key={dish.id} 
                                                    className={`bg-white dark:bg-zinc-800 rounded-2xl p-3 gap-3 shadow-sm hover:shadow-md transition-all group relative border border-transparent hover:border-gray-100 dark:hover:border-white/10 ${dish.isHidden ? 'opacity-50 grayscale' : ''}`}
                                                    draggable={sortBy === 'default'}
                                                    onDragStart={(e) => handleDragStart(e, dish.id)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => handleDishReorder(e, dish)}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                                                            <img src={dish.image} className="w-full h-full object-contain shadow-sm" alt={dish.name} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold truncate text-gray-800 dark:text-zinc-100">{dish.name}</div>
                                                            <div className="text-[10px] text-orange-500 font-mono font-bold mt-1 uppercase tracking-wider">{dish.nutrition.calories} kcal</div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 flex gap-1 bg-white/95 dark:bg-black/90 backdrop-blur-md p-1 rounded-full shadow-lg border border-black/5 dark:border-white/10 z-10">
                                                        <button 
                                                            disabled={isSyncing}
                                                            onClick={async (e) => { 
                                                                e.stopPropagation(); 
                                                                const featuredCount = dishes.filter(d => d.isFeatured).length;
                                                                const isFeatured = !!dish.isFeatured;
                                                                
                                                                if (!isFeatured && featuredCount >= 5) {
                                                                    alert("You can only feature up to 5 dishes.");
                                                                    return;
                                                                }

                                                                const updatedDish = { ...dish, isFeatured: !isFeatured };
                                                                setIsSyncing(true);
                                                                try {
                                                                    await upsertDish(updatedDish);
                                                                    setDishes(prev => prev.map(d => d.id === dish.id ? updatedDish : d));
                                                                } catch (err) {
                                                                    console.error("Failed to update featured status:", err);
                                                                    alert("Sync error.");
                                                                } finally {
                                                                    setIsSyncing(false);
                                                                }
                                                            }} 
                                                            className={`p-1.5 rounded-full transition-colors ${dish.isFeatured ? 'bg-amber-100 text-amber-600' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400'}`}
                                                            title="Feature on Landing Page"
                                                        >
                                                            <Star size={14} fill={dish.isFeatured ? "currentColor" : "none"} />
                                                        </button>
                                                        <button 
                                                            disabled={isSyncing}
                                                            onClick={(e) => { e.stopPropagation(); toggleVisibility(dish); }} 
                                                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors dark:text-white disabled:opacity-50"
                                                            title={dish.isHidden ? "Show Dish" : "Hide Dish"}
                                                        >
                                                            {dish.isHidden ? <Eye size={14}/> : <EyeOff size={14}/>}
                                                        </button>
                                                        <button 
                                                            disabled={isSyncing}
                                                            onClick={(e) => { e.stopPropagation(); duplicateDish(dish); }} 
                                                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors dark:text-white disabled:opacity-50"
                                                            title="Duplicate Dish"
                                                        >
                                                            <Copy size={14}/>
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingDish(dish); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors dark:text-white" title="Edit Dish"><Edit size={14}/></button>
                                                        <button 
                                                            disabled={isSyncing}
                                                            onClick={(e) => { e.stopPropagation(); removeDish(dish.id); }} 
                                                            className="p-1.5 hover:bg-red-50 rounded-full transition-colors text-red-500 disabled:opacity-50" 
                                                            title="Delete Dish"
                                                        >
                                                            <Trash2 size={14}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};