'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import StarryBackground from '@/components/StarryBackground';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Dynamically import components that use AppKit with ssr: false
const NFTMintingForm = dynamic(() => import('@/components/NFTMinting/NFTMintingForm'), { ssr: false });
const AppKitStatusCheck = dynamic(() => import('@/components/AppKitStatusCheck'), { ssr: false });
const BottomNavigation = dynamic(() => import('@/components/BottomNavigation'), { ssr: false });

// Collection card images for floating background
const cardImages = [
  '/sxfdO1IW9tFd2uK7oUg54HWLfM8.png',
  '/TS0ZEQa6LqHIwGwyQsgxIYJVPzc.jpeg',
  '/E8okCphkavy5wOswGJQ1oyw07iI.png',
  '/BGOS4PVp4nxOsRhrupybTvvXMw.jpeg',
  '/ixf80jUKzkQNqTo81qXYh7m4XE.jpeg',
  '/rVKTvtW79Mqp1jOGCihZ4gRFQ.png',
  '/sP5BVR81GV5Mhr5SODg8zLpC74.png',
  '/uCrEh7EWdfVpkejS6m0onxU0s0.png',
  '/USrOQ3pjPgMuvG2eKO0VObUqw.png'
];

// Rarity colors for styling
const rarityColors = {
  Common: 'from-gray-400 to-gray-600',
  Rare: 'from-yellow-400 to-yellow-600',
  Epic: 'from-purple-400 to-purple-600',
  Legendary: 'from-orange-400 to-orange-600',
  Mythical: 'from-gray-900 to-gray-700'
};

// Rarities for random assignment
const rarities = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical'];

const MintPage = () => {
  const [isClient, setIsClient] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
    
    // Add event listener for debug logs
    const handleDebugLog = (event: CustomEvent) => {
      console.log('DEBUG:', event.detail);
    };
    
    // Listen for custom debug events
    document.addEventListener('debug-log', handleDebugLog as EventListener);
    
    // Add a global error handler to catch unhandled errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError(...args);
      
      // Log to our debug system as well
      if (args[0] && typeof args[0] === 'string') {
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `ERROR: ${args[0]}`
        }));
      }
    };
    
    // Log initial page load
    document.dispatchEvent(new CustomEvent('debug-log', {
      detail: `Mint page loaded at ${new Date().toISOString()}`
    }));
    
    // Check wallet connection status on client side only
    if (typeof window !== 'undefined') {
      try {
        // Dynamically import AppKit
        import('@reown/appkit/react').then(({ useAppKitAccount }) => {
          try {
            const { isConnected } = useAppKitAccount();
            setIsConnected(isConnected);
          } catch (error) {
            console.error('Error checking wallet connection:', error);
          }
        });
      } catch (error) {
        console.error('Error importing AppKit:', error);
      }
    }
    
    return () => {
      document.removeEventListener('debug-log', handleDebugLog as EventListener);
      console.error = originalConsoleError;
    };
  }, []);
  
  // Create a function to open AppKit that will be passed to BottomNavigation
  const handleOpenAppKit = () => {
    if (typeof window !== 'undefined') {
      try {
        // Dynamically import AppKit
        import('@reown/appkit/react').then(({ useAppKit }) => {
          try {
            const { open } = useAppKit();
            if (open) {
              open();
            }
          } catch (error) {
            console.error('Error opening AppKit:', error);
          }
        });
      } catch (error) {
        console.error('Error importing AppKit:', error);
      }
    }
  };
  
  // Only render the full content on the client side
  if (!isClient) {
    return (
      <div className="flex flex-col min-h-screen relative">
        <StarryBackground />
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 relative">
          <div className="w-full max-w-4xl mx-auto z-10 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-center text-white mb-3 font-['Cinzel']">
              Mint Your NFT
            </h1>
            <p className="text-lg md:text-xl text-center text-white/70 max-w-2xl mx-auto">
              Loading...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen relative">
      <StarryBackground />
      <Header />
      <AppKitStatusCheck />
      
      <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 relative">
        <div className="w-full max-w-4xl mx-auto z-10">
          {/* Decorative elements */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"></div>
          
          <div className="text-center mb-8 relative">
            <h1 className="text-4xl md:text-6xl font-bold text-center text-white mb-3 font-['Cinzel'] relative inline-block">
              Mint Your NFT
              <div className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--primary-glow)]/70 to-transparent"></div>
            </h1>
            <p className="text-lg md:text-xl text-center text-white/70 max-w-2xl mx-auto">
              Mint your exclusive Cards of Cronos NFTs and join the cosmic collection
            </p>
          </div>
          
          {/* Background removed as requested */}
          
          <div className="relative">
            {/* Decorative corner elements */}
            <div className="absolute -top-2 -left-2 text-[var(--primary-glow)] text-xl opacity-50">✧</div>
            <div className="absolute -top-2 -right-2 text-[var(--primary-glow)] text-xl opacity-50">✦</div>
            <div className="absolute -bottom-2 -left-2 text-[var(--primary-glow)] text-xl opacity-50">⚜</div>
            <div className="absolute -bottom-2 -right-2 text-[var(--primary-glow)] text-xl opacity-50">⚝</div>
            
            <NFTMintingForm />
          </div>
        </div>
        
        {/* Simplified styles */}
        <style jsx>{`
          @keyframes rotate-y {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(360deg); }
          }
          .rotate-y-5 {
            transform: rotateY(5deg);
          }
        `}</style>
      </main>
      
      <Footer />
      <BottomNavigation
        isWalletConnected={isConnected}
        onConnectWallet={handleOpenAppKit}
      />
    </div>
  );
};

export default MintPage;