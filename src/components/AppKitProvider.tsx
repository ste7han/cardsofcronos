'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import { getAppKit } from '@/lib/appkit';

// Create a context to track AppKit initialization
const AppKitContext = createContext<boolean>(false);

// Hook to check if AppKit is initialized
export const useAppKitInitialized = () => useContext(AppKitContext);

interface AppKitProviderProps {
  children: React.ReactNode;
}

const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if AppKit is initialized on the client side
  useEffect(() => {
    if (!isClient) return;
    
    // Check if AppKit is already initialized
    const appKit = getAppKit();
    if (appKit) {
      console.log('AppKit is already initialized');
      setInitialized(true);
    } else {
      console.error('AppKit is not initialized');
    }
  }, [isClient]);

  return (
    <AppKitContext.Provider value={isClient ? initialized : false}>
      {children}
    </AppKitContext.Provider>
  );
};

export default AppKitProvider;
