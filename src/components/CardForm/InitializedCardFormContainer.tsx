'use client';

import React, { useState, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5';
import CardFormContainer from './CardFormContainer';
import { useAppKitInitialized } from '../AppKitProvider';

// Define Cronos chain (copied from AppKitProvider.tsx to keep code consistent)
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

/**
 * A wrapper component that ensures AppKit is initialized before rendering the CardFormContainer
 */
const InitializedCardFormContainer: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const isContextInitialized = useAppKitInitialized();

  useEffect(() => {
    // Only try to initialize in the browser
    if (typeof window === 'undefined') return;
    
    const initializeAppKit = async () => {
      try {
        console.log('Explicitly initializing AppKit in InitializedCardFormContainer');
        
        // Create AppKit instance explicitly in this component
        createAppKit({
          adapters: [new Ethers5Adapter()],
          metadata,
          networks: [cronos],
          projectId,
          features: {
            analytics: true
          }
        });
        
        // Wait a moment for initialization to complete
        setTimeout(() => {
          setInitialized(true);
          console.log('AppKit initialized in InitializedCardFormContainer');
        }, 200);
      } catch (error) {
        console.error('Failed to initialize AppKit in InitializedCardFormContainer:', error);
      }
    };
    
    if (!initialized && !isContextInitialized) {
      initializeAppKit();
    } else {
      setInitialized(true);
    }
  }, [initialized, isContextInitialized]);

  // Don't render the CardFormContainer until AppKit is initialized
  if (!initialized) {
    return (
      <div className="flex justify-center items-center p-8 text-center">
        <div className="animate-pulse">
          <div className="h-8 w-8 mx-auto mb-4 rounded-full bg-[var(--secondary)]/50"></div>
          <p className="text-sm text-[var(--secondary)] font-bold">Initializing wallet connections...</p>
        </div>
      </div>
    );
  }

  // Render the real component once AppKit is initialized
  return <CardFormContainer />;
};

export default InitializedCardFormContainer;
