'use client'

import { createAppKit } from '@reown/appkit/react'
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5'
import React, { useEffect, useState } from 'react'

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
}

// Track if AppKit has been initialized
let appKitInitialized = false;

// Ensure createAppKit is called before any hooks are used
if (typeof window !== 'undefined' && !appKitInitialized) {
  try {
    console.log('Initializing AppKit in context/appkit.tsx');
    
    // Create the AppKit instance
    createAppKit({
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
    });
    
    appKitInitialized = true;
    console.log('AppKit initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AppKit:', error);
  }
}

export function AppKit({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(appKitInitialized);

  // Handle client-side initialization if needed
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialized) {
      try {
        console.log('Initializing AppKit in client-side effect');
        
        // Create the AppKit instance
        createAppKit({
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
        });
        
        setInitialized(true);
        appKitInitialized = true;
        console.log('AppKit initialized successfully in client-side effect');
      } catch (error) {
        console.error('Failed to initialize AppKit in client-side effect:', error);
      }
    }
  }, [initialized]);

  return (
    <>{children}</>
  )
}
