'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface BottomNavigationProps {
  isWalletConnected: boolean;
  onConnectWallet: () => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  isWalletConnected, 
  onConnectWallet 
}) => {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<string>('home');
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
    
    // Set active item based on current path
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/') setActiveItem('home');
      else if (path === '/collection') setActiveItem('collection');
      else if (path === '/about') setActiveItem('about');
    }
  }, []);
  
  // Handle scroll behavior - hide on scroll down, show on scroll up
  // Only run on client side after hydration
  useEffect(() => {
    if (!isClient) return;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient, lastScrollY]);
  
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
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      href: '#card-form'
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
      href: isWalletConnected ? '#' : undefined
    }
  ];
  
  // Arcane rune symbols for decoration
  const runeSymbols = ['✧', '⚝', '⚜', '✦', '✴', '❈'];
  
  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 transform ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Simple, clean bottom navigation bar */}
      <div className="relative mx-auto">
        <div className="relative bg-black/80 backdrop-blur-xl border-t border-[#9D4EDD]/30 shadow-lg">
          {/* Navigation items */}
          <div className="relative z-10 flex justify-around items-center py-4 px-4 max-w-lg mx-auto">
            {navItems.map((item) => {
              const isActive = activeItem === item.id;
              
              // Determine if this is the forge (center) item
              const isForge = item.id === 'forge';
              
              return (
                <div 
                  key={item.id} 
                  className={`relative ${isForge ? 'px-3' : 'px-2'}`}
                >
                  {/* Animated background for active item */}
                  {isActive && (
                    <div className="absolute inset-0 -m-1 rounded-full bg-[#9D4EDD]/10 animate-pulse"></div>
                  )}
                  
                  {/* Rune symbol that appears when active - only show on client side */}
                  {isClient && isActive && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[#FFD700] text-xs opacity-0 animate-fadeIn">
                      {runeSymbols[item.id.length % runeSymbols.length]}
                    </div>
                  )}
                  
                  {/* Navigation item */}
                  {item.href ? (
                    <Link 
                      href={item.href}
                      onClick={() => setActiveItem(item.id)}
                      className={`flex flex-col items-center transition-all duration-300 ${
                        isActive 
                          ? 'text-[#FFD700]' 
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {/* Icon container with special styling for forge */}
                      <div className={`
                        relative flex items-center justify-center
                        ${isForge 
                          ? 'w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD700] to-[#9D4EDD] -mt-10 shadow-lg shadow-[#9D4EDD]/50 border-2 border-white/20' 
                          : 'w-8 h-8'
                        }
                      `}>
                        {/* Icon */}
                        <div className={`
                          ${isForge 
                            ? 'text-white' 
                            : isActive ? 'text-[#FFD700]' : 'text-white/70'
                          }
                          transition-all duration-300
                          ${isActive && !isForge ? 'scale-110' : ''}
                        `}>
                          {item.icon}
                        </div>
                        
                        {/* Pulse animation for forge button - only show on client side */}
                        {isClient && isForge && (
                          <span className="absolute inset-0 rounded-full animate-ping bg-white/20"></span>
                        )}
                        
                        {/* Glow effect for active items */}
                        {isActive && (
                          <div className="absolute inset-0 rounded-full opacity-60 blur-sm" style={{
                            background: isForge 
                              ? 'radial-gradient(circle at center, rgba(255, 215, 0, 0.5), transparent 70%)' 
                              : 'radial-gradient(circle at center, rgba(157, 78, 221, 0.3), transparent 70%)'
                          }}></div>
                        )}
                      </div>
                      
                      {/* Label - only show for active item or on hover */}
                      <span className={`text-xs mt-1 font-medium transition-all duration-300 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveItem(item.id);
                        if (item.onClick) item.onClick();
                      }}
                      className={`flex flex-col items-center transition-all duration-300 ${
                        isActive 
                          ? 'text-[#FFD700]' 
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {/* Icon container */}
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        {/* Icon */}
                        <div className={`
                          transition-all duration-300
                          ${isActive ? 'text-[#FFD700] scale-110' : 'text-white/70'}
                        `}>
                          {item.icon}
                        </div>
                        
                        {/* Connection status indicator for profile */}
                        {item.id === 'profile' && (
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                            isWalletConnected ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                        )}
                        
                        {/* Glow effect for active items */}
                        {isActive && (
                          <div className="absolute inset-0 rounded-full opacity-60 blur-sm bg-[#9D4EDD]/20"></div>
                        )}
                      </div>
                      
                      {/* Label - only show for active item or on hover */}
                      <span className={`text-xs mt-1 font-medium transition-all duration-300 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
                      }`}>
                        {item.label}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-10px) translateX(-50%); }
          100% { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s forwards;
        }
      `}</style>
    </nav>
  );
};

export default BottomNavigation;
