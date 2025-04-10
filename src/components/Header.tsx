'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface HeaderProps {
  onConnectWallet: () => void;
  isWalletConnected: boolean;
  walletAddress?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  onConnectWallet, 
  isWalletConnected, 
  walletAddress 
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [animateRunes, setAnimateRunes] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle scroll effect with memoized callback for better performance
  const handleScroll = useCallback(() => {
    const isScrolled = window.scrollY > 10;
    if (isScrolled !== scrolled) {
      setScrolled(isScrolled);
    }
  }, [scrolled]);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  // Animate runes on load - only on client side
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const timer = setTimeout(() => {
      setAnimateRunes(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen || typeof window === 'undefined') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#mobile-menu') && !target.closest('#menu-toggle')) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);
  
  // Close mobile menu on navigation
  const handleNavigation = () => {
    setMobileMenuOpen(false);
  };
  
  // Empty array for rune symbols (removed as requested)
  const runeSymbols: { symbol: string; top: string; left: string; delay: string }[] = [];
  
  // Navigation items with icons for mobile
  const navItems = [
    { 
      name: 'Home', 
      href: '/',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      name: 'Collection', 
      href: '/collection',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    { 
      name: 'About', 
      href: '/about',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];
  
  // Format wallet address for display
  const formatWalletAddress = (address?: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Render wallet button based on connection status
  const renderWalletButton = () => {
    if (!isClient) {
      // Return placeholder during SSR
      return (
        <div className="h-10 w-36 rounded-full bg-[var(--cosmic-black)]/50"></div>
      );
    }
    
    if (isWalletConnected) {
      return (
        <div className="flex items-center space-x-2 bg-[var(--cosmic-black)]/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-[var(--glass-border)]">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-medium text-white/90">{formatWalletAddress(walletAddress)}</span>
        </div>
      );
    }
    
    return (
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition duration-500"></div>
        <button 
          onClick={onConnectWallet}
          className="relative bg-[var(--cosmic-black)]/80 text-white px-4 py-2 rounded-full text-sm font-medium border border-[var(--glass-border)] hover:bg-[var(--cosmic-black)] transition-all duration-300 active:scale-95"
          aria-label="Connect Wallet"
        >
          Connect Wallet
        </button>
      </div>
    );
  };
  
  return (
    <header 
      className={`w-full max-w-[100vw] py-2 px-4 md:py-0.5 md:px-6 lg:px-10 flex justify-between items-center backdrop-blur-xl sticky top-0 z-[200] transition-all duration-500 ${
        scrolled || mobileMenuOpen
          ? 'bg-gradient-to-r from-[var(--cosmic-black)]/95 to-[var(--cosmic-purple)]/80 shadow-lg shadow-[var(--primary)]/20 border-b border-[var(--glass-border)]' 
          : 'bg-gradient-to-r from-[var(--cosmic-black)]/70 to-[var(--cosmic-purple)]/50'
      }`}
    >
      {/* Floating effect container */}
      <div className="absolute inset-x-0 -bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/50 to-transparent opacity-100 transition-opacity duration-500"></div>
      
      {/* Top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary-glow)]/40 to-transparent opacity-100"></div>
      
      {/* Animated arcane runes with fixed positions for SSR consistency */}
      {runeSymbols.map((rune, index) => (
        <div 
          key={index}
          className={`absolute text-[var(--primary-glow)] text-xs opacity-0 ${animateRunes ? 'rune-activate' : ''}`}
          style={{
            top: rune.top,
            left: rune.left,
            animationDelay: rune.delay
          }}
        >
          {rune.symbol}
        </div>
      ))}
      
      {/* Logo */}
      <div className="flex items-center">
        <Link href="/" className="relative group">
          {/* Logo with enhanced glow effect */}
          <div className="flex items-center justify-center relative z-10">
            <Image 
              src="/logo.svg" 
              alt="Cards of Cronos Logo" 
              width={60} 
              height={60}
              className="object-contain modern-floating md:w-[72px] md:h-[72px]"
              priority
            />
          </div>
          
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 -m-1 rounded-full opacity-0 group-hover:opacity-70 transition-all duration-500 blur-md bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)]"></div>
        </Link>
      </div>
      
      {/* Desktop Navigation - Hidden on mobile */}
      <nav className="hidden md:flex items-center">
        <div className="flex space-x-8">
          {navItems.map((item, index) => (
            <Link 
              key={index}
              href={item.href} 
              className="text-white/80 hover:text-[var(--primary-glow)] transition-all duration-300 relative group text-xs uppercase tracking-wider flex flex-col items-center px-2 py-1"
              onClick={handleNavigation}
            >
              {/* Text */}
              <span className="relative">
                {item.name}
                <span className="absolute bottom-0 left-0 w-0 h-px bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] group-hover:w-full transition-all duration-300"></span>
              </span>
            </Link>
          ))}
        </div>
      </nav>
      
      {/* Wallet Connection - Different styling for mobile/desktop */}
      <div className="flex items-center space-x-2">
        {/* Wallet button - Responsive styling */}
        <div className="hidden md:block">
          {/* Custom styled AppKit button wrapper for desktop */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition duration-1000"></div>
            <div className="relative">
              {/* @ts-ignore - Custom web component */}
              <appkit-button />
            </div>
          </div>
        </div>
        
        {/* Mobile wallet button */}
        <div className="md:hidden">
          {renderWalletButton()}
        </div>
        
        {/* Mobile menu toggle button */}
        <button 
          id="menu-toggle"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-[var(--cosmic-black)]/60 border border-[var(--glass-border)] active:scale-95 transition-transform duration-200"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          <div className="relative w-5 h-5">
            <span 
              className={`absolute h-0.5 w-5 bg-white rounded-full transition-all duration-300 ${
                mobileMenuOpen ? 'rotate-45 top-2' : 'rotate-0 top-1'
              }`}
            ></span>
            <span 
              className={`absolute h-0.5 w-5 bg-white rounded-full transition-all duration-300 ${
                mobileMenuOpen ? 'opacity-0' : 'opacity-100'
              } top-2`}
            ></span>
            <span 
              className={`absolute h-0.5 w-5 bg-white rounded-full transition-all duration-300 ${
                mobileMenuOpen ? '-rotate-45 top-2' : 'rotate-0 top-3'
              }`}
            ></span>
          </div>
        </button>
      </div>
      
      {/* Mobile Menu - Slide in from right */}
      <div 
        id="mobile-menu"
        className={`fixed top-[60px] right-0 bottom-0 w-[250px] bg-[var(--cosmic-black)]/95 backdrop-blur-xl border-l border-[var(--glass-border)] z-[201] transition-transform duration-300 ease-in-out transform ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        } md:hidden`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Mobile menu content */}
        <div className="flex flex-col h-full p-5">
          {/* Navigation links */}
          <nav className="flex-1">
            <ul className="space-y-4">
              {navItems.map((item, index) => (
                <li key={index}>
                  <Link 
                    href={item.href}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/20 transition-colors duration-200"
                    onClick={handleNavigation}
                  >
                    <span className="text-[var(--primary-glow)]">{item.icon}</span>
                    <span className="text-white font-medium">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          
          {/* Mobile menu footer */}
          <div className="pt-4 border-t border-[var(--glass-border)]">
            {/* Wallet status */}
            {isWalletConnected && walletAddress && (
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-xs text-white/80">Connected: {formatWalletAddress(walletAddress)}</span>
              </div>
            )}
            
            {/* Mobile AppKit button */}
            <div className="hidden">
              {/* @ts-ignore - Custom web component */}
              <appkit-button />
            </div>
            
            {/* Custom connect button for mobile */}
            {!isWalletConnected && (
              <button 
                onClick={onConnectWallet}
                className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white py-3 rounded-lg font-medium text-sm uppercase tracking-wider active:scale-98 transition-transform duration-200"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Backdrop for mobile menu */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      ></div>
      
      {/* Add keyframes for particle animation */}
      <style jsx>{`
        @keyframes particle-float {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(calc(-50% + ${Math.random() * 30 - 15}px), calc(-50% - ${Math.random() * 30}px)) scale(0); opacity: 0; }
        }
      `}</style>
    </header>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(Header);
