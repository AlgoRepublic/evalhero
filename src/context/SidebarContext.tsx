import React, { createContext, useContext, useState, useCallback } from 'react';

export interface SidebarPreferences {
  pinnedItems: string[];
  hiddenItems: string[];
  order: string[];
  collapsedSections: string[];
}

export interface MenuItemInfo {
  key: string;
  label: string;
  children?: MenuItemInfo[];
}

interface SidebarContextType {
  preferences: SidebarPreferences;
  allMenuItems: MenuItemInfo[];
  setAllMenuItems: (items: MenuItemInfo[]) => void;
  updatePreferences: (prefs: Partial<SidebarPreferences>) => void;
  resetPreferences: () => void;
  pinItem: (key: string) => void;
  unpinItem: (key: string) => void;
  hideItem: (key: string) => void;
  showItem: (key: string) => void;
  reorderItems: (newOrder: string[]) => void;
  toggleSection: (sectionKey: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'sidebar_preferences';
const DEFAULT_PREFERENCES: SidebarPreferences = {
  pinnedItems: [],
  hiddenItems: [],
  order: [],
  collapsedSections: [],
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preferences, setPreferences] = useState<SidebarPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading sidebar preferences:', error);
    }
    return DEFAULT_PREFERENCES;
  });

  const [allMenuItems, setAllMenuItems] = useState<MenuItemInfo[]>([]);

  const savePreferences = useCallback((prefs: SidebarPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setPreferences(prefs);
    } catch (error) {
      console.error('Error saving sidebar preferences:', error);
    }
  }, []);

  const updatePreferences = useCallback(
    (updates: Partial<SidebarPreferences>) => {
      const newPrefs = { ...preferences, ...updates };
      savePreferences(newPrefs);
    },
    [preferences, savePreferences]
  );

  const resetPreferences = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  const pinItem = useCallback(
    (key: string) => {
      const newPinned = preferences.pinnedItems.includes(key)
        ? preferences.pinnedItems
        : [...preferences.pinnedItems, key];
      updatePreferences({ pinnedItems: newPinned });
    },
    [preferences.pinnedItems, updatePreferences]
  );

  const unpinItem = useCallback(
    (key: string) => {
      const newPinned = preferences.pinnedItems.filter((k) => k !== key);
      updatePreferences({ pinnedItems: newPinned });
    },
    [preferences.pinnedItems, updatePreferences]
  );

  const hideItem = useCallback(
    (key: string) => {
      const newHidden = preferences.hiddenItems.includes(key)
        ? preferences.hiddenItems
        : [...preferences.hiddenItems, key];
      updatePreferences({ hiddenItems: newHidden });
    },
    [preferences.hiddenItems, updatePreferences]
  );

  const showItem = useCallback(
    (key: string) => {
      const newHidden = preferences.hiddenItems.filter((k) => k !== key);
      updatePreferences({ hiddenItems: newHidden });
    },
    [preferences.hiddenItems, updatePreferences]
  );

  const reorderItems = useCallback(
    (newOrder: string[]) => {
      updatePreferences({ order: newOrder });
    },
    [updatePreferences]
  );

  const toggleSection = useCallback(
    (sectionKey: string) => {
      const newCollapsed = preferences.collapsedSections.includes(sectionKey)
        ? preferences.collapsedSections.filter((k) => k !== sectionKey)
        : [...preferences.collapsedSections, sectionKey];
      updatePreferences({ collapsedSections: newCollapsed });
    },
    [preferences.collapsedSections, updatePreferences]
  );

  return (
    <SidebarContext.Provider
      value={{
        preferences,
        allMenuItems,
        setAllMenuItems,
        updatePreferences,
        resetPreferences,
        pinItem,
        unpinItem,
        hideItem,
        showItem,
        reorderItems,
        toggleSection,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};
