import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { TourProps, Modal } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarPreferences } from './SidebarContext';

interface TourContextType {
  isRunning: boolean;
  currentStep: number;
  steps: TourProps['steps'];
  startTour: (resetSidebar?: boolean) => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setSteps: (steps: TourProps['steps']) => void;
  setCurrentStep: (step: number) => void;
  navigateToPage: (path: string) => Promise<void>;
  setSidebarResetCallback: (callback: (() => void) | null) => void;
  setSidebarRestoreCallback: (callback: ((prefs?: SidebarPreferences) => void) | null) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

interface TourProviderProps {
  children: React.ReactNode;
}

export const TourProvider: React.FC<TourProviderProps> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourProps['steps']>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const originalSidebarPrefsRef = useRef<SidebarPreferences | null>(null);
  const sidebarResetCallbackRef = useRef<(() => void) | null>(null);
  const sidebarRestoreCallbackRef = useRef<((prefs?: SidebarPreferences) => void) | null>(null);

  const navigateToPage = useCallback(
    async (path: string): Promise<void> => {
      return new Promise((resolve) => {
        // Clear any existing timeout
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }

        // If already on the target page, resolve immediately
        if (location.pathname === path) {
          // Wait a bit for any dynamic content to render
          navigationTimeoutRef.current = setTimeout(() => {
            resolve();
          }, 300);
          return;
        }

        // Navigate to the page
        navigate(path);

        // Wait for navigation and content to load
        navigationTimeoutRef.current = setTimeout(() => {
          // Additional wait to ensure elements are rendered
          const checkElement = (selector: string, maxAttempts = 10, attempt = 0) => {
            const element = document.querySelector(selector);
            if (element || attempt >= maxAttempts) {
              resolve();
            } else {
              setTimeout(() => checkElement(selector, maxAttempts, attempt + 1), 100);
            }
          };
          // Start checking after a short delay
          setTimeout(() => {
            checkElement('[data-tour]');
          }, 200);
        }, 500);
      });
    },
    [navigate, location.pathname]
  );

  const startTour = useCallback((resetSidebar: boolean = true) => {
    // Check if sidebar has any customizations
    const hasCustomizations = () => {
      try {
        const stored = localStorage.getItem('sidebar_preferences');
        if (stored) {
          const prefs = JSON.parse(stored);
          return (
            (prefs.hiddenItems && prefs.hiddenItems.length > 0) ||
            (prefs.pinnedItems && prefs.pinnedItems.length > 0) ||
            (prefs.order && prefs.order.length > 0)
          );
        }
      } catch (error) {
        console.error('Error checking sidebar preferences:', error);
      }
      return false;
    };

    // If resetSidebar is true and there are customizations, show confirmation
    if (resetSidebar && hasCustomizations() && sidebarResetCallbackRef.current) {
      Modal.confirm({
        title: 'Reset Sidebar for Tour?',
        content: 'To show all features in the tour, we need to temporarily reset your sidebar customization (show all items, reset order). Your preferences will be restored after the tour ends. Do you want to continue?',
        okText: 'Yes, Start Tour',
        cancelText: 'Cancel',
        onOk: () => {
          // Save current preferences before resetting
          try {
            const stored = localStorage.getItem('sidebar_preferences');
            if (stored) {
              originalSidebarPrefsRef.current = JSON.parse(stored);
            }
          } catch (error) {
            console.error('Error saving sidebar preferences:', error);
          }
          
          // Reset sidebar preferences
          const resetCallback = sidebarResetCallbackRef.current;
          if (resetCallback) {
            resetCallback();
          }
          
          // Start the tour
          setIsRunning(true);
          setCurrentStep(0);
        },
      });
    } else {
      // Start tour without resetting sidebar (no customizations or resetSidebar is false)
      setIsRunning(true);
      setCurrentStep(0);
    }
  }, []);

  const stopTour = useCallback(() => {
    setIsRunning(false);
    setCurrentStep(0);
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Restore original sidebar preferences if they were saved
    if (originalSidebarPrefsRef.current && sidebarRestoreCallbackRef.current) {
      const restoreCallback = sidebarRestoreCallbackRef.current;
      const savedPrefs = originalSidebarPrefsRef.current;
      // Pass the saved preferences to restore
      try {
        localStorage.setItem('sidebar_preferences', JSON.stringify(savedPrefs));
        // Call the restore callback which will update the context
        restoreCallback(savedPrefs);
        originalSidebarPrefsRef.current = null;
      } catch (error) {
        console.error('Error restoring sidebar preferences:', error);
      }
    }
  }, []);

  const setSidebarResetCallback = useCallback((callback: (() => void) | null) => {
    sidebarResetCallbackRef.current = callback;
  }, []);

  const setSidebarRestoreCallback = useCallback((callback: ((prefs?: SidebarPreferences) => void) | null) => {
    sidebarRestoreCallbackRef.current = callback;
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (steps && prev < steps.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [steps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const setCurrentStepState = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const value: TourContextType = {
    isRunning,
    currentStep,
    steps,
    startTour,
    stopTour,
    nextStep,
    prevStep,
    setSteps,
    setCurrentStep: setCurrentStepState,
    navigateToPage,
    setSidebarResetCallback: setSidebarResetCallback,
    setSidebarRestoreCallback: setSidebarRestoreCallback,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};
