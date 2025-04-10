'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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

interface AppKitProviderProps {
  children: React.ReactNode;
}

const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);

  // Initialize AppKit on mount
  useEffect(() => {
    try {
      createAppKit({
        adapters: [new Ethers5Adapter()],
        metadata,
        networks: [cronos],
        projectId,
        features: {
          analytics: true
        }
      });
      setInitialized(true);
      console.log('AppKit initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AppKit:', error);
      // Handle error appropriately (e.g., show error message to user)
    }
  }, []);

  return (
    <AppKitContext.Provider value={initialized}>
      {children}
    </AppKitContext.Provider>
  );
};

export default AppKitProvider;
