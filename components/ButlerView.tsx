import React from 'react';
import { Order } from '../types';
import { ChevronLeft, Clock, Hash, Utensils, Flame, MessageSquare, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { upsertOrder, deleteOrderFromDB } from '../services/supabaseService';

interface ButlerViewProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  onClose: () => void;
}

export const ButlerView: React.FC<ButlerViewProps> = ({ orders, setOrders, onClose }) => {
  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const updatedOrder = { ...orderToUpdate, status };
    
    // Optimistic update
    setOrders(prev => prev.map(order => order.id === orderId ? updatedOrder : order));

    try {
      await upsertOrder(updatedOrder);
    } catch (err) {
      console.error("Error updating order status:", err);
      // Revert on error
      setOrders(prev => prev.map(order => order.id === orderId ? orderToUpdate : order));
    }
  };

  const deleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    // Optimistic update
    setOrders(prev => prev.filter(order => order.id !== orderId));

    try {
      await deleteOrderFromDB(orderId);
    } catch (err) {
      console.error("Error deleting order:", err);
      // Revert on error
      setOrders(prev => [...prev, orderToDelete].sort((a, b) => 
        new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime()
      ));
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] dark:bg-zinc-950 text-slate-900 dark:text-slate-100 font-['Inter'] antialiased theme-transition">
      <header className="px-8 py-6 flex justify-between items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5 sticky top-0 z-50 theme-transition">
        <button 
          onClick={onClose}
          className="flex items-center gap-3 group px-4 py-2 rounded-full hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Menu</span>
        </button>
        
        <div className="text-center">
          <h2 className="text-lg font-black uppercase tracking-[0.3em]">Butler Dashboard</h2>
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Order Management</p>
        </div>

        <div className="w-[120px]"></div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-extralight tracking-tight mb-2">Active Orders</h1>
            <p className="text-gray-400 dark:text-zinc-500 text-sm">Manage and track guest requests in real-time.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-gray-100 dark:bg-white/5 px-6 py-3 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">{orders.filter(o => o.status === 'pending').length} Pending</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="py-32 text-center bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
              <Utensils size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-6" />
              <h3 className="text-xl font-bold mb-2">No active orders</h3>
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
                          <span className="text-xl font-black tracking-tight">{order.id}</span>
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
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle2 size={16} /> Complete
                          </button>
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20"
                          >
                            <XCircle size={16} /> Cancel
                          </button>
                        </>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOrder(order.id);
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
                                <span className="text-lg font-black tracking-tight">x{item.quantity}</span>
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
                          <span className="text-sm font-bold">{order.items.reduce((sum, i) => sum + i.quantity, 0)}</span>
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
                            <span className="text-xs font-black uppercase tracking-widest">Status</span>
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
      </main>
    </div>
  );
};
