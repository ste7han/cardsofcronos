'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

// Initialize AppKit only once at the module level (outside of component lifecycle)
let appKitInitialized = false;

if (typeof window !== 'undefined' && !appKitInitialized) {
  try {
    // Create the AppKit instance
    const appKitInstance = createAppKit({
      adapters: [new Ethers5Adapter()],
      metadata,
      networks: [cronos],
      projectId,
      features: {
        analytics: true
      }
    });
    
    // Store the instance globally so components can access it
    if (typeof window !== 'undefined') {
      // Add additional methods and properties to make it easier to use from components
      window.AppKitInstance = {
        ...appKitInstance,
        getWalletInfo: () => {
          // Safe implementation of getting wallet info
          try {
            // This is a safe fallback implementation
            return {
              isConnected: false,
              address: undefined
            };
          } catch (error) {
            console.error("Error getting wallet info:", error);
            return {
              isConnected: false,
              address: undefined
            };
          }
        },
        open: () => {
          try {
            appKitInstance.open();
          } catch (error) {
            console.error("Error opening AppKit:", error);
          }
        }
      };
    }
    
    appKitInitialized = true;
    console.log('AppKit initialized at module level');
  } catch (error) {
    console.error('Failed to initialize AppKit at module level:', error);
  }
}

interface AppKitProviderProps {
  children: React.ReactNode;
}

const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  const [initialized, setInitialized] = useState(appKitInitialized);

  // We still need an effect to handle client-side rendering
  // This initializes AppKit if it wasn't initialized at the module level
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialized) {
      try {
        // Create the AppKit instance
        const appKitInstance = createAppKit({
          adapters: [new Ethers5Adapter()],
          metadata,
          networks: [cronos],
          projectId,
          features: {
            analytics: true
          }
        });
        
        // Store the instance globally with additional helper methods
        if (typeof window !== 'undefined') {
          window.AppKitInstance = {
            ...appKitInstance,
            getWalletInfo: () => {
              // Safe implementation of getting wallet info
              try {
                // This is a safe fallback implementation
                return {
                  isConnected: false,
                  address: undefined
                };
              } catch (error) {
                console.error("Error getting wallet info:", error);
                return {
                  isConnected: false,
                  address: undefined
                };
              }
            },
            open: () => {
              try {
                appKitInstance.open();
              } catch (error) {
                console.error("Error opening AppKit:", error);
              }
            }
          };
        }
        
        setInitialized(true);
        appKitInitialized = true;
        console.log('AppKit initialized in component');
      } catch (error) {
        console.error('Failed to initialize AppKit in component:', error);
      }
    }
  }, [initialized]);

  return (
    <AppKitContext.Provider value={initialized}>
      {children}
    </AppKitContext.Provider>
  );
};

export default AppKitProvider;
