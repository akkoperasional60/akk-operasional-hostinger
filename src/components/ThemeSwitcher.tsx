import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeSwitcherProps {
  variant?: 'segmented' | 'compact' | 'icon-only';
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  className = ''
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Ganti ke Mode Cerah' : 'Ganti ke Mode Gelap'}
      aria-label="Toggle tema tampilan"
      className={`p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-amber-400 transition-colors cursor-pointer flex items-center justify-center ${className}`}
    >
      {theme === 'dark' ? (
        <Moon className="w-4 h-4 text-slate-300" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500" />
      )}
    </button>
  );
};

