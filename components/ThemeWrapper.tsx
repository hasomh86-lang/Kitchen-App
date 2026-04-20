import React, { useEffect } from 'react';
import { ThemeType } from '../types';

interface ThemeWrapperProps {
  theme: ThemeType;
  children: React.ReactNode;
  className?: string;
}

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ theme, children, className = '' }) => {
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  let themeClasses = 'theme-transition ';

  switch (theme) {
    case 'modern':
      themeClasses += 'bg-[#FBFBFB] font-["Inter"] text-slate-900';
      break;
    case 'classic':
      themeClasses += 'bg-parchment font-["Playfair_Display"] text-[#2C2C2C]';
      break;
    case 'dark':
      themeClasses += 'bg-zinc-950 font-["Inter"] text-[#F0F0F0]';
      break;
    default:
      themeClasses += 'bg-white font-sans';
  }

  return (
    <div className={`min-h-screen w-full ${themeClasses} ${className}`}>
      {children}
    </div>
  );
};

export const getThemeButtonClass = (theme: ThemeType) => {
    switch (theme) {
        case 'modern': return 'bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-6 py-2 transition-all shadow-sm';
        case 'classic': return 'bg-[#2C2C2C] text-white hover:bg-black border border-[#2C2C2C] px-6 py-2 italic transition-all';
        case 'dark': return 'bg-white text-black hover:bg-zinc-200 rounded-xl px-6 py-2 transition-all shadow-sm';
        default: return 'bg-blue-600 text-white hover:bg-blue-700 rounded-lg';
    }
}