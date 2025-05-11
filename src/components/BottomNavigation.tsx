'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import BuyTokenButton from './BuyTokenButton';
import dynamic from 'next/dynamic';

// Import types only
import type { useAppKit as UseAppKitType } from '@reown/appkit/react';

interface BottomNavigationProps {
  isWalletConnected: boolean;
  onConnectWallet: () => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  isWalletConnected, 
  onConnectWallet 
}) => {
  // Client-side AppKit integration
  const [openAppKit, setOpenAppKit] = useState<any>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<string>('home');
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  
  // Set isClient to true once component mounts on client and initialize AppKit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Dynamically import the hook only on the client side
      import('@reown/appkit/react').then(({ useAppKit }) => {
        // Get the open function from the imported hook
        try {
          const { open } = useAppKit();
          setOpenAppKit(() => open);
        } catch (error) {
          console.error('Failed to load AppKit:', error);
        }
      }).catch(err => {
        console.error('Error importing AppKit:', err);
      });
      
      // Set active item based on current path
      const path = window.location.pathname;
      if (path === '/') setActiveItem('home');
      else if (path === '/collection') setActiveItem('collection');
      else if (path === '/mint') setActiveItem('mint');
      else if (path === '/about') setActiveItem('about');
      else if (path === '/orders') setActiveItem('profile');
      
      setIsClient(true);
    }
  }, []);
  
  // Memoized scroll handler to improve performance
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    // Only hide when scrolling down and past 100px threshold
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
    
    setLastScrollY(currentScrollY);
  }, [lastScrollY]);
  
  // Handle scroll behavior - hide on scroll down, show on scroll up
  useEffect(() => {
    if (!isClient) return;
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient, handleScroll]);
  
  // Handle touch events to allow swiping up to reveal the navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    
    // If swiped up significantly, show the navigation
    if (diff < -50 && !isVisible) {
      setIsVisible(true);
    }
    
    setTouchStartY(null);
  };
  
  // The Wolfswap URL for buying tokens
  const wolfswapUrl = "https://wolfswap.app/swap?chainId=25&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=0xECf3361441512c1e9F6A6e8734D86614D8e795BC";

  // Navigation items with icons and labels
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      href: '/'
    },
    {
      id: 'collection',
      label: 'Cards',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      href: '/collection'
    },
    {
      id: 'mint',
      label: 'Mint',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
      href: '/mint'
    },
    {
      id: 'buy',
      label: 'Buy',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      onClick: () => {
        // Open Wolfswap in a new tab
        if (typeof window !== 'undefined') {
          window.open(wolfswapUrl, '_blank', 'noopener,noreferrer');
        }
      }
    },
    {
      id: 'forge',
      label: 'Forge',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      onClick: () => {
        // Navigate to home page and open card form
        if (typeof window !== 'undefined') {
          if (window.location.pathname !== '/') {
            window.location.href = '/#card-form';
          } else {
            window.location.hash = 'card-form';
          }
        }
      }
    }
  ];
  
  if (!isClient) {
    // Return a placeholder during SSR to prevent hydration mismatch
    return <div className="h-20 md:hidden"></div>;
  }
  
  return (
    <>
      {/* Spacer to prevent content from being hidden behind the navigation */}
      <div className="h-20 md:hidden"></div>
      
      {/* Bottom navigation bar */}
      <nav 
        className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 md:hidden ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0)' 
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Mobile navigation"
      >
        {/* Pull indicator - visible when nav is hidden */}
        <div 
          className={`absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-6 
            bg-gradient-to-b from-transparent to-black/80 rounded-t-lg flex justify-center items-center
            transition-opacity duration-300 ${isVisible ? 'opacity-0' : 'opacity-100'}`}
          onClick={() => setIsVisible(true)}
        >
          <div className="w-10 h-1 bg-white/30 rounded-full"></div>
        </div>
        
        {/* Navigation bar with simple dark background */}
        <div className="bg-[#050314] border-t border-[#1a1a2e]">
          <div className="flex justify-around items-center px-2 py-4">
            {navItems.map((item) => {
              const isActive = activeItem === item.id;
              
              // Create the navigation item
              const navItem = (
                <div
                  key={item.id}
                  className="flex flex-col items-center justify-center"
                >
                  {/* Icon container */}
                  <div className="flex items-center justify-center mb-1">
                    <div className={`text-[#FFD700] ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                      {item.icon}
                    </div>
                  </div>
                  
                  {/* Simple label */}
                  <span className={`text-xs font-medium ${isActive ? 'text-[#FFD700]' : 'text-[#FFD700]/80'}`}>
                    {item.label}
                  </span>
                </div>
              );
              
              // Wrap with Link or Button based on item configuration
              if (item.href) {
                return (
                  <Link 
                    key={item.id}
                    href={item.href}
                    className="flex flex-col items-center touch-manipulation active:opacity-70 transition-opacity"
                    onClick={() => setActiveItem(item.id)}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {navItem}
                  </Link>
                );
              } else {
                return (
                  <button
                    key={item.id}
                    className="flex flex-col items-center touch-manipulation bg-transparent border-0 active:opacity-70 transition-opacity"
                    onClick={() => {
                      setActiveItem(item.id);
                      if (item.onClick) item.onClick();
                    }}
                    aria-label={item.label}
                  >
                    {navItem}
                  </button>
                );
              }
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(BottomNavigation);
