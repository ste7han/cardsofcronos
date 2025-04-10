'use client';

import { useState, useEffect } from 'react';
import { useAppKitInitialized } from '@/components/AppKitProvider';

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    appKitHooks?: {
      useAppKit: any;
      useAppKitAccount: any;
    };
    appKitInitialized?: boolean;
  }
}

/**
 * A simple safe wrapper hook that provides AppKit functionality 
 * without directly calling the AppKit hooks until we know initialization is complete
 */
export function useAppKit() {
  const isInitialized = useAppKitInitialized();
  const [account, setAccount] = useState<any>(null);
  const [kit, setKit] = useState<any>(null);

  // This effect runs only on client side and when initialization changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized) return;

    // Initialize a dummy object to return when not initialized
    const dummyKit = {
      open: () => console.warn('AppKit not yet initialized'),
      close: () => console.warn('AppKit not yet initialized')
    };

    // Set initial values for safety
    setKit(dummyKit);
    setAccount({ isConnected: false, address: undefined });

    // This is a separate function we'll call to access actual AppKit functionality
    const initRealAppKit = () => {
      try {
        // Import directly to prevent React hook rules violations
        const { useAppKit, useAppKitAccount } = require('@reown/appkit/react');
        
        // We're not calling the hooks here, just making them available to the component
        // The component will call these hooks directly
        window.appKitHooks = {
          useAppKit,
          useAppKitAccount
        };
        
        // Signal to the component that it can now safely use the real hooks
        window.appKitInitialized = true;
      } catch (error) {
        console.error('Failed to initialize AppKit hooks:', error);
      }
    };

    // Initialize the real AppKit hooks if not done already
    if (isInitialized && !window.appKitInitialized) {
      initRealAppKit();
    }
  }, [isInitialized]);

  return {
    isInitialized,
    appKitAccount: { isConnected: false, address: undefined },
    appKit: {
      open: () => {
        if (window.appKitInitialized) {
          // This would be replaced with direct AppKit usage in the component
          console.log('Would open AppKit (safe wrapper)');
        } else {
          console.warn('AppKit not yet initialized');
        }
      }
    }
  };
}
