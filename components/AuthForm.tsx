import React, { useState } from 'react';
import { signIn, signUp } from '../services/supabaseService';
import { Mail, Lock, Loader2, ArrowRight, ChefHat, X, AlertCircle, User } from 'lucide-react';

interface AuthFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, onCancel }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error: authError } = await signIn(email, password);
        if (authError) throw authError;
      } else {
        const { data, error: authError } = await signUp(email, password, firstName, lastName);
        if (authError) throw authError;
        // Supabase sends confirmation email by default, notify user if needed
        if (data.user && !data.session) {
           setError("Success! Please check your email for a verification link.");
           setLoading(false);
           return;
        }
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-white/50 overflow-hidden relative animate-scale-in">
        <button 
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-gray-100"
        >
          <X size={20} />
        </button>

        <div className="p-10">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <ChefHat size={32} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
              {isLogin ? 'Chef Entrance' : 'New Kitchen Admin'}
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              {isLogin ? 'Please sign in to manage your menu.' : 'Create your chef account below.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 border animate-slide-up ${error.includes('Success') ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4 animate-slide-up">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="First Name"
                    className="w-full bg-gray-50 border border-gray-100 py-4 pl-12 pr-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-black/5 focus:border-black/10 transition-all font-medium"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="Last Name"
                    className="w-full bg-gray-50 border border-gray-100 py-4 pl-12 pr-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-black/5 focus:border-black/10 transition-all font-medium"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
              <input 
                type="email" 
                required
                placeholder="Chef Email"
                className="w-full bg-gray-50 border border-gray-100 py-4 pl-12 pr-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-black/5 focus:border-black/10 transition-all font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
              <input 
                type="password" 
                required
                placeholder="Secret Key"
                className="w-full bg-gray-50 border border-gray-100 py-4 pl-12 pr-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-black/5 focus:border-black/10 transition-all font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:bg-gray-800 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? 'Enter Kitchen' : 'Initialize Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-xs font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest"
            >
              {isLogin ? "Don't have access? Create Account" : "Back to Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};