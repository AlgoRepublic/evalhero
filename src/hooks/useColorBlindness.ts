import { useState, useEffect } from 'react';
import {
  getColorBlindnessFilter,
  type ColorBlindnessType,
} from '../utils/colorBlindnessFilters';

const STORAGE_KEY = 'color_blindness_filter';

/**
 * Hook to manage color blindness filter
 * Returns the filter value to be applied to content area (not body)
 * to avoid breaking fixed positioning of sidebar
 */
export function useColorBlindness() {
  const [filterType, setFilterType] = useState<ColorBlindnessType>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored as ColorBlindnessType) || 'none';
    } catch {
      return 'none';
    }
  });

  // Save to localStorage whenever filterType changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, filterType);
    } catch (error) {
      console.error('Error saving color blindness filter:', error);
    }
  }, [filterType]);

  // Listen for storage changes to sync state across components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setFilterType(e.newValue as ColorBlindnessType);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    const handleCustomStorageChange = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setFilterType(stored as ColorBlindnessType);
        }
      } catch {
        // Ignore errors
      }
    };

    // Custom event for same-tab updates
    window.addEventListener('colorBlindnessFilterChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('colorBlindnessFilterChange', handleCustomStorageChange);
    };
  }, []);

  // Dispatch custom event when filterType changes (for same-tab sync)
  useEffect(() => {
    window.dispatchEvent(new Event('colorBlindnessFilterChange'));
  }, [filterType]);

  // Get the CSS filter string
  const filterValue = filterType === 'none' 
    ? '' 
    : getColorBlindnessFilter(filterType);

  return {
    filterType,
    setFilterType,
    filterValue, // Return the filter value to apply in component
  };
}
