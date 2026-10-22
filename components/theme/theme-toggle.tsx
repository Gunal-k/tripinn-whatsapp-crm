'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { showToast } from '../../lib/utils/swal';
import { lightModeStyles } from '../../lib/theme/styles';

export type AppTheme = 'light' | 'dark';

/**
 * Apply the specified theme class to <html>, data attribute, and persist in localStorage.
 * Guarantees that the light mode stylesheet is dynamically injected if not present.
 */
export function applyTheme(next: AppTheme) {
  if (typeof document === 'undefined') return;

  // Guarantee stylesheet is active even if Turbopack HMR bypassed layout.tsx
  let styleTag = document.getElementById('tripinn-light-mode-styles') as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'tripinn-light-mode-styles';
    styleTag.textContent = lightModeStyles;
    document.head.appendChild(styleTag);
  } else {
    styleTag.textContent = lightModeStyles;
  }

  if (next === 'light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }
  document.documentElement.setAttribute('data-theme', next);

  try {
    localStorage.setItem('tripinn_theme', next);
  } catch {
    // ignore local storage restrictions
  }

  // Dispatch custom event for instantaneous synchronization across open components
  window.dispatchEvent(new CustomEvent('tripinn-theme-change', { detail: next }));
}

interface ThemeToggleProps {
  className?: string;
  variant?: 'top-nav' | 'icon-only' | 'sidebar';
  showNotification?: boolean;
}

export function ThemeToggle({
  className = '',
  variant = 'top-nav',
  showNotification = true,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<AppTheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Read stored theme or current documentElement class
    let currentTheme: AppTheme = 'light';
    try {
      const saved = localStorage.getItem('tripinn_theme');
      if (saved === 'dark' || saved === 'light') {
        currentTheme = saved;
      } else if (document.documentElement.classList.contains('dark')) {
        currentTheme = 'dark';
      }
    } catch {
      if (document.documentElement.classList.contains('dark')) {
        currentTheme = 'dark';
      }
    }

    setTheme(currentTheme);
    applyTheme(currentTheme);

    const handleCustomChange = (e: Event) => {
      const customEvt = e as CustomEvent<AppTheme>;
      if (customEvt.detail === 'light' || customEvt.detail === 'dark') {
        setTheme(customEvt.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tripinn_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
        applyTheme(e.newValue);
      }
    };

    window.addEventListener('tripinn-theme-change', handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('tripinn-theme-change', handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleToggle = () => {
    const next: AppTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);

    if (showNotification) {
      showToast(
        next === 'light' ? '☀️ Switched to Light Mode' : '🌙 Switched to Dark Mode',
        'success',
        1800
      );
    }
  };

  if (!mounted) {
    // Avoid layout shift before hydration
    return (
      <div className={`p-2 rounded-lg bg-[#111d3d] border border-[#1e293b] opacity-0 ${className}`} />
    );
  }

  if (variant === 'icon-only') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={`p-2 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] border border-[#1e293b] text-slate-300 hover:text-white transition cursor-pointer text-xs shadow-xs flex items-center justify-center ${className}`}
        title={theme === 'light' ? 'Current: Light Mode — Click for Dark Mode' : 'Current: Dark Mode — Click for Light Mode'}
        aria-label="Toggle visual theme"
      >
        {theme === 'light' ? (
          <Moon className="w-4 h-4 text-indigo-500 fill-indigo-500/20" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
        )}
      </button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] border border-[#1e293b] text-xs text-slate-300 hover:text-white transition cursor-pointer ${className}`}
        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      >
        <span className="flex items-center space-x-2 font-medium">
          {theme === 'light' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dark Mode</span>
            </>
          )}
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/20 text-slate-400">
          Switch
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] border border-[#1e293b] text-slate-300 hover:text-white transition cursor-pointer text-xs shadow-xs ${className}`}
      title={theme === 'light' ? 'Current: Light Mode — Click for Dark Mode' : 'Current: Dark Mode — Click for Light Mode'}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/20" />
          <span className="hidden md:inline font-semibold text-slate-700">Dark</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span className="hidden md:inline font-semibold text-amber-300">Light</span>
        </>
      )}
    </button>
  );
}
