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
      className={`p-2.5 rounded-full border border-[#e4eaf2] dark:border-[#2b3b50] bg-[#f3f6fb] dark:bg-[#192a40] text-[#5a6b80] dark:text-[#b2c1d3] hover:bg-[#e9f2ff] dark:hover:bg-[#253e64] hover:text-[#1764db] transition-colors cursor-pointer flex items-center justify-center ${className}`}
    >
      {theme === 'dark' ? (
        <Moon className="w-4 h-4 text-slate-300" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500" />
      )}
    </button>
  );
};

