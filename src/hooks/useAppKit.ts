'use client';

import { useState, useEffect } from 'react';
import { useAppKitInitialized } from '@/components/AppKitProvider';

// Type definitions now defined in window.d.ts

// Local interface for the AppKit instance
interface AppKitInstance {
  open: () => void;
  close: () => void;
  getAccount?: () => any;
  getWalletInfo?: () => any;
}

/**
 * A simple safe wrapper hook that provides AppKit functionality 
 * without directly calling the AppKit hooks until we know initialization is complete
 */
export function useAppKit() {
  const isInitialized = useAppKitInitialized();
  const [account, setAccount] = useState<any>(null);
  const [kit, setKit] = useState<any>(null);
  const [openFunction, setOpenFunction] = useState<() => void>(() => {
    console.warn('AppKit not yet initialized');
  });

  // This effect runs only on client side and when initialization changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized) return;

    let appKitInstance: AppKitInstance | null = null;

    // Try to get the AppKit instance directly
    try {
      const { getAppKit } = require('@reown/appkit/react');
      appKitInstance = getAppKit() as AppKitInstance;
      window.AppKitInstance = appKitInstance;
      
      // Create a real open function that will work on mobile
      if (appKitInstance && typeof appKitInstance.open === 'function') {
        setOpenFunction(() => () => {
          if (appKitInstance) appKitInstance.open();
        });
      }

      // Get account info if available
      if (appKitInstance && typeof appKitInstance.getAccount === 'function') {
        const accountInfo = appKitInstance.getAccount();
        setAccount(accountInfo || { isConnected: false, address: undefined });
      }

      setKit(appKitInstance || {
        open: () => console.warn('AppKit not yet initialized'),
        close: () => console.warn('AppKit not yet initialized')
      });

      // This function is used to open the wallet connection dialog
      window.openAppKitWalletModal = () => {
        if (appKitInstance && typeof appKitInstance.open === 'function') {
          console.log('Opening AppKit wallet modal from global function');
          appKitInstance.open();
        } else {
          console.warn('AppKit instance is not available');
        }
      };

      // Log successful initialization for debugging
      console.log('AppKit is properly initialized for mobile wallet connection');
    } catch (error) {
      console.error('Failed to get AppKit instance:', error);
    }
  }, [isInitialized]);

  return {
    isInitialized,
    appKitAccount: account,
    appKit: kit,
    openAppKit: openFunction
  };
}
