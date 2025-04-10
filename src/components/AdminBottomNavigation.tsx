'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';

interface AdminBottomNavigationProps {
  onLogout: () => void;
}

const AdminBottomNavigation: React.FC<AdminBottomNavigationProps> = ({ onLogout }) => {
  const [isClient, setIsClient] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<string>('admin');
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
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
      id: 'admin',
      label: 'Admin',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      href: '/admin'
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      onClick: onLogout
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
export default memo(AdminBottomNavigation);
