'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';

interface BottomNavigationProps {
  isWalletConnected: boolean;
  onConnectWallet: () => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  isWalletConnected, 
  onConnectWallet 
}) => {
  const [isClient, setIsClient] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<string>('home');
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
    
    // Set active item based on current path
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/') setActiveItem('home');
      else if (path === '/collection') setActiveItem('collection');
      else if (path === '/about') setActiveItem('about');
      else if (path === '/orders') setActiveItem('profile');
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
  
  // Navigation items with icons and labels
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      href: '/'
    },
    {
      id: 'collection',
      label: 'Cards',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      href: '/collection'
    },
    {
      id: 'forge',
      label: 'Forge',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    },
    {
      id: 'about',
      label: 'About',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: '/about'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: isWalletConnected ? undefined : onConnectWallet,
      href: isWalletConnected ? '/orders' : undefined
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
        
        {/* Navigation bar with glass effect */}
        <div className="bg-[var(--cosmic-black)]/95 backdrop-blur-xl border-t border-[var(--glass-border)] shadow-lg">
          <div className="flex justify-around items-center px-2 py-3">
            {navItems.map((item) => {
              const isActive = activeItem === item.id;
              const isForge = item.id === 'forge';
              const isProfile = item.id === 'profile';
              
              // Create the navigation item
              const navItem = (
                <div 
                  key={item.id}
                  className={`flex flex-col items-center justify-center ${
                    isForge ? 'relative -mt-8' : ''
                  }`}
                >
                  {/* Icon container with improved touch target */}
                  <div 
                    className={`
                      flex items-center justify-center rounded-full
                      ${isForge 
                        ? 'w-16 h-16 bg-gradient-to-br from-[var(--secondary)] to-[var(--primary)] p-3.5 shadow-lg border-2 border-white/20 relative z-10 animate-pulse-subtle' 
                        : `w-14 h-14 p-3 ${isActive ? 'bg-[var(--primary)]/20' : 'bg-transparent'}`
                      }
                      transition-all duration-200 relative
                    `}
                  >
                    {/* Special glow effects for Forge button */}
                    {isForge && (
                      <>
                        {/* Inner glow */}
                        <div className="absolute inset-0 rounded-full bg-[var(--primary)] opacity-20 blur-md -z-10"></div>
                        
                        {/* Outer glow */}
                        <div className="absolute -inset-2 rounded-full bg-[var(--secondary)] opacity-10 blur-lg -z-20"></div>
                      </>
                    )}
                    {/* Active indicator ring */}
                    {isActive && !isForge && (
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--secondary)] animate-pulse-fade"></div>
                    )}
                    
                    <div className={`
                      ${isActive && !isForge ? 'text-[var(--secondary)]' : 'text-white'}
                      ${isForge ? 'text-white' : ''}
                    `}>
                      {item.icon}
                    </div>
                    
                    {/* Enhanced connection status indicator for profile */}
                    {isProfile && (
                      <div className={`absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center
                        ${isWalletConnected 
                          ? 'bg-green-500 animate-pulse-glow' 
                          : 'bg-red-500'
                        }`}
                      >
                        {isWalletConnected && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Label with better visibility */}
                  <span className={`
                    text-xs mt-1 font-medium tracking-wide
                    ${isActive ? 'text-[var(--secondary)]' : 'text-white/80'}
                    ${isForge ? 'text-white font-bold' : ''}
                  `}>
                    {item.label}
                    
                    {/* Active indicator dot under label */}
                    {isActive && !isForge && (
                      <span className="block mx-auto mt-1 w-1 h-1 rounded-full bg-[var(--secondary)]"></span>
                    )}
                  </span>
                </div>
              );
              
              // Wrap with Link or Button based on item configuration
              if (item.href) {
                return (
                  <Link 
                    key={item.id}
                    href={item.href}
                    className="flex flex-col items-center touch-manipulation active:opacity-80 transition-opacity"
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
                    className="flex flex-col items-center touch-manipulation bg-transparent border-0 active:opacity-80 transition-opacity"
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
