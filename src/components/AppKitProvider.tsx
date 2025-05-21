'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5';

// Define Cronos chain
const cronos = {
  id: 25,
  name: 'Cronos',
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:25',
  nativeCurrency: {
    name: 'Cronos',
    symbol: 'CRO',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://evm.cronos.org']
    }
  },
  blockExplorers: {
    default: {
      name: 'Cronoscan',
      url: 'https://cronoscan.com'
    }
  }
};

// Project ID from Reown Cloud
const projectId = '8d7572d8e272d20865722c1fe193e098';

// Metadata for the application
const metadata = {
  name: 'Cards of Cronos',
  description: 'The ultimate fantasy card collection for the Cronos blockchain',
  url: 'https://cardsofcronos.com',
  icons: ['/logo.svg']
};

// Create a context to track AppKit initialization
const AppKitContext = createContext<boolean>(false);

// Hook to check if AppKit is initialized
export const useAppKitInitialized = () => useContext(AppKitContext);

// Type definition for AppKit instance - using a more generic approach to avoid type mismatches
interface AppKitInstance {
  open: () => void;
  close: () => void;
  getAccount?: () => any;
  getWalletInfo?: () => any; // Use any to avoid type mismatch issues
}

// Global variable to track if AppKit was initialized
let appKitInitialized = false;
let appKitInstance: AppKitInstance | null = null;

// Function to initialize AppKit - exported for use in other files
export const initializeAppKit = () => {
  if (typeof window !== 'undefined' && !appKitInitialized) {
    try {
      console.log('Creating AppKit instance...');
      // Create the AppKit instance with Cronos chain support
      appKitInstance = createAppKit({
        adapters: [new Ethers5Adapter()],
        metadata,
        networks: [cronos],
        defaultNetwork: cronos,         // Set cronos as default network
        projectId,
        enableNetworkSwitch: true,      // Enable network switching
        features: {
          analytics: true
        },
        // Better handle chain mismatches
        defaultAccountTypes: {
          eip155: "eoa"                 // Use EOA for EVM chains
        },
        // Debug mode for development
        debug: true
      }) as AppKitInstance;
      
      // Make AppKit instance globally available
      window.AppKitInstance = appKitInstance;
      
      // Mark as initialized globally
      appKitInitialized = true;
      (window as any).AppKitInitialized = true;
      console.log('AppKit initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize AppKit:', error);
      return false;
    }
  }
  return appKitInitialized;
};

// Type definition for AppKit is now in window.d.ts

// Initialize at module level in browser environment
if (typeof window !== 'undefined') {
  // Immediate initialization attempt
  initializeAppKit();
  
  // Fallback initialization after window is fully loaded
  window.addEventListener('load', () => {
    if (!appKitInitialized) {
      console.log('Initializing AppKit on window load');
      initializeAppKit();
    }
  });
}

interface AppKitProviderProps {
  children: React.ReactNode;
}

const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  const [initialized, setInitialized] = useState(appKitInitialized);

  useEffect(() => {
    // Try to initialize if not already done
    if (!initialized) {
      const result = initializeAppKit();
      setInitialized(result);
    }
  }, [initialized]);

  // Make sure the AppKit instance is globally available
  useEffect(() => {
    if (initialized && typeof window !== 'undefined') {
      // Use a safer way to store initialization state
      (window as any).AppKitInitialized = true;
    }
  }, [initialized]);

  return (
    <AppKitContext.Provider value={initialized}>
      {children}
    </AppKitContext.Provider>
  );
};

export default AppKitProvider;
