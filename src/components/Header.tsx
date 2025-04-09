'use client';

import React, { useState, useEffect } from 'react';
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
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled]);
  
  // Animate runes on load - only on client side
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const timer = setTimeout(() => {
      setAnimateRunes(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Empty array for rune symbols (removed as requested)
  const runeSymbols: { symbol: string; top: string; left: string; delay: string }[] = [];
  
  // Navigation items
  const navItems = [
    { name: 'Home', icon: '', href: '/' },
    { name: 'Collection', icon: '', href: '/collection' },
    { name: 'About', icon: '', href: '/about' }
  ];
  
  return (
    <header 
      className={`w-full max-w-[100vw] py-0.5 px-6 md:px-10 flex justify-between items-center backdrop-blur-xl sticky top-0 z-50 transition-all duration-500 overflow-x-hidden ${
        scrolled 
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
      
      <div className="flex items-center">
        <div className="relative group">
          {/* Logo with enhanced glow effect */}
          <div className="flex items-center justify-center relative z-10">
            <Image 
              src="/logo.svg" 
              alt="Cards of Cronos Logo" 
              width={72} 
              height={72}
              className="object-contain modern-floating"
              priority
            />
          </div>
          
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 -m-1 rounded-full opacity-0 group-hover:opacity-70 transition-all duration-500 blur-md bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)]"></div>
        </div>
      </div>
      
      {/* Navigation links */}
      <nav className="hidden md:flex items-center space-x-8">
        {navItems.map((item, index) => (
          <Link 
            key={index}
            href={item.href} 
            className="text-white/80 hover:text-[var(--primary-glow)] transition-all duration-300 relative group text-xs uppercase tracking-wider flex flex-col items-center"
            onMouseEnter={() => setHoverItem(item.name)}
            onMouseLeave={() => setHoverItem(null)}
          >
            {/* Icon that appears on hover */}
            <span 
              className={`absolute -top-4 text-xs transition-all duration-300 ${
                hoverItem === item.name ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-2'
              }`}
            >
              {item.icon}
            </span>
            
            {/* Text */}
            <span className="relative">
              {item.name}
              <span className="absolute bottom-0 left-0 w-0 h-px bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] group-hover:w-full transition-all duration-300"></span>
            </span>
            
            {/* Glow effect on hover */}
            {hoverItem === item.name && (
              <span className="absolute inset-0 rounded-full bg-[var(--primary)]/5 blur-md"></span>
            )}
          </Link>
        ))}
      </nav>
      
      <div className="flex items-center space-x-4">
        {/* Custom styled AppKit button wrapper */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition duration-1000"></div>
          <div className="relative">
            {/* @ts-ignore - Custom web component */}
            <appkit-button />
          </div>
        </div>
        
        {/* Mobile menu button - only visible on small screens */}
        <button 
          className="md:hidden text-white bg-gradient-to-r from-[var(--primary)]/50 to-[var(--primary-glow)]/50 hover:from-[var(--primary)]/60 hover:to-[var(--primary-glow)]/60 rounded-full p-2.5 transition-all duration-300 border-2 border-[var(--primary)]/30 flex items-center justify-center shadow-lg"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          style={{ zIndex: mobileMenuOpen ? 1001 : 998 }}
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <span 
              className={`absolute h-0.5 w-5 bg-white rounded-full transition-all duration-300 ${
                mobileMenuOpen ? 'rotate-45' : '-translate-y-1.5'
              }`}
            ></span>
            <span 
              className={`absolute h-0.5 w-5 bg-white rounded-full transition-all duration-300 ${
                mobileMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            ></span>
            <span 
              className={`absolute h-0.5 w-5 bg-white rounded-full transition-all duration-300 ${
                mobileMenuOpen ? '-rotate-45' : 'translate-y-1.5'
              }`}
            ></span>
          </div>
        </button>
      </div>
      
      {/* Mobile menu overlay */}
      <div 
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      ></div>
      
      {/* Mobile menu panel */}
      <div 
        className={`fixed right-0 top-0 bottom-0 w-72 max-w-[90vw] bg-gradient-to-b from-[var(--cosmic-black)] to-[var(--cosmic-purple)]/90 backdrop-blur-lg z-[1000] md:hidden flex flex-col items-center transition-all duration-500 shadow-2xl overflow-y-auto ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ height: '100vh' }}
      >
        {/* Close button */}
        <div className="w-full flex justify-end p-4">
          <button 
            className="text-white/80 hover:text-white p-2 rounded-full bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Logo at the top of mobile menu */}
        <div className="absolute top-6 left-6">
          <Image 
            src="/logo.svg" 
            alt="Cards of Cronos Logo" 
            width={48} 
            height={48}
            className="object-contain"
          />
        </div>
        
        <div className="flex flex-col items-center space-y-4 py-8 mt-16 mb-24 w-full px-4">
          {navItems.map((item, index) => (
            <Link 
              key={index}
              href={item.href} 
              className="w-full text-white text-xl font-medium tracking-wide relative group px-6 py-3 rounded-xl hover:bg-[var(--primary)]/20 transition-all duration-300 border border-transparent hover:border-[var(--primary)]/30 text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="inline-block mr-3">{item.icon}</span>
              {item.name}
              <span className="block h-px w-0 group-hover:w-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] transition-all duration-300 mt-1"></span>
            </Link>
          ))}
        </div>
        
        {/* Connect wallet button in mobile menu */}
        <div className="w-full flex justify-center mt-6">
          <button 
            onClick={() => {
              onConnectWallet();
              setMobileMenuOpen(false);
            }}
            className="modern-btn-primary text-sm px-8 py-3"
          >
            {isWalletConnected ? 'Dashboard' : 'Connect Wallet'}
          </button>
        </div>
        
        {/* Decorative elements removed */}
      </div>
      
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

export default Header;
