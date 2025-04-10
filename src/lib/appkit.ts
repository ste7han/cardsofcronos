'use client';

import { createAppKit } from '@reown/appkit/react';
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5';
import { useAppKit as useReownAppKit, 
         useAppKitAccount as useReownAppKitAccount, 
         useAppKitNetwork as useReownAppKitNetwork, 
         useAppKitProvider as useReownAppKitProvider, 
         useDisconnect as useReownDisconnect } from '@reown/appkit/react';

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
  url: 'https://cardsofcronos.com', // Replace with your actual domain
  icons: ['/logo.svg']
};

// Initialize AppKit at the module level
let appKitInstance: any = null;
let initializationError: Error | null = null;

// Only initialize on the client side
if (typeof window !== 'undefined') {
  try {
    // Create the AppKit instance
    appKitInstance = createAppKit({
      adapters: [new Ethers5Adapter()],
      metadata,
      networks: [cronos],
      projectId,
      features: {
        analytics: true
      }
    });
    
    console.log('Reown AppKit initialized with Cronos chain');
  } catch (error) {
    initializationError = error as Error;
    console.error('Failed to initialize AppKit:', error);
    // Throw error to prevent application from running with invalid state
    throw new Error('Failed to initialize AppKit. Please check your configuration and try again.');
  }
}

// Export function to check initialization status
export const isAppKitInitialized = () => {
  if (initializationError) {
    throw initializationError;
  }
  return !!appKitInstance;
};

// Export hooks for use in components
export const useAppKit = useReownAppKit;
export const useAppKitAccount = useReownAppKitAccount;
export const useAppKitNetwork = useReownAppKitNetwork;
export const useAppKitProvider = useReownAppKitProvider;
export const useDisconnect = useReownDisconnect;

// Export the AppKit instance
export const getAppKit = () => appKitInstance;

// For backward compatibility
export const initAppKit = () => {
  if (!appKitInstance && typeof window !== 'undefined') {
    try {
      appKitInstance = createAppKit({
        adapters: [new Ethers5Adapter()],
        metadata,
        networks: [cronos],
        projectId,
        features: {
          analytics: true
        }
      });
      
      console.log('Reown AppKit initialized with Cronos chain');
    } catch (error) {
      console.error('Failed to initialize AppKit:', error);
    }
  }
  
  return appKitInstance;
};
