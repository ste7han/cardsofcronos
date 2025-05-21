'use client';

import { useState, useEffect } from 'react';
import BottomNavigation from './BottomNavigation';

/**
 * A wrapper component that adds bottom navigation to all pages
 * This component uses the global AppKit instance to manage wallet connection
 */
const NavigationWrapper = ({ children }: { children: React.ReactNode }) => {
  // Client-side only state
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined);
  
  // Set up wallet connection functions
  const handleConnectWallet = () => {
    if (typeof window !== 'undefined' && window.AppKitInstance) {
      window.AppKitInstance.open();
    }
  };

  // Effect to check wallet connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsClient(true);
    
    // Function to check wallet connection status
    const checkWalletConnection = () => {
      try {
        if (window.AppKitInstance && typeof window.AppKitInstance.getWalletInfo === 'function') {
          const walletInfo = window.AppKitInstance.getWalletInfo();
          if (walletInfo) {
            setIsWalletConnected(!!walletInfo.isConnected);
            setWalletAddress(walletInfo.address);
          }
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };
    
    // Check connection immediately
    checkWalletConnection();
    
    // Also set up a periodic check and event listener
    const connectionCheckInterval = setInterval(checkWalletConnection, 3000);
    
    // Clean up
    return () => {
      clearInterval(connectionCheckInterval);
    };
  }, []);

  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <BottomNavigation
        isWalletConnected={isWalletConnected}
        onConnectWallet={handleConnectWallet}
      />
    </>
  );
};

export default NavigationWrapper;