import { create } from 'zustand';
import { useAuthStore } from './authStore';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  
  // Actions
  setTheme: (theme: Theme) => void;
  initialize: () => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  return theme === 'system' ? getSystemTheme() : theme;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'light',

  setTheme: (theme: Theme) => {
    const resolvedTheme = resolveTheme(theme);
    
    // Update local state
    set({ theme, resolvedTheme });
    
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
    // Store in localStorage as backup
    localStorage.setItem('theme', theme);
    
    // Update user profile if authenticated
    const authStore = useAuthStore.getState();
    if (authStore.user) {
      authStore.setTheme(theme);
    }
  },

  initialize: () => {
    const authStore = useAuthStore.getState();
    
    // Get theme from user profile or localStorage or default to system
    let initialTheme: Theme = 'system';
    
    if (authStore.user?.theme) {
      initialTheme = authStore.user.theme;
    } else {
      const storedTheme = localStorage.getItem('theme') as Theme;
      if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
        initialTheme = storedTheme;
      }
    }
    
    const resolvedTheme = resolveTheme(initialTheme);
    
    set({ theme: initialTheme, resolvedTheme });
    
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      const currentTheme = get().theme;
      if (currentTheme === 'system') {
        const newResolvedTheme = getSystemTheme();
        set({ resolvedTheme: newResolvedTheme });
        
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(newResolvedTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    // Return cleanup function
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  },
}));

// Subscribe to auth store changes to sync theme
useAuthStore.subscribe(
  (state) => state.user?.theme,
  (userTheme) => {
    if (userTheme) {
      const themeStore = useThemeStore.getState();
      if (themeStore.theme !== userTheme) {
        themeStore.setTheme(userTheme);
      }
    }
  }
);
