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
      className={`w-full max-w-[100vw] py-0.5 px-6 md:px-10 flex justify-between items-center backdrop-blur-xl sticky top-0 z-[200] transition-all duration-500 ${
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
      
      {/* Navigation links - Always visible on all screen sizes */}
      <nav className="flex items-center">
        <div className="flex space-x-2 md:space-x-8">
          {navItems.map((item, index) => (
            <Link 
              key={index}
              href={item.href} 
              className="text-white/80 hover:text-[var(--primary-glow)] transition-all duration-300 relative group text-xs uppercase tracking-wider flex flex-col items-center px-2 py-1"
              onMouseEnter={() => setHoverItem(item.name)}
              onMouseLeave={() => setHoverItem(null)}
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
      
      <div className="flex items-center">
        {/* Custom styled AppKit button wrapper */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition duration-1000"></div>
          <div className="relative">
            {/* @ts-ignore - Custom web component */}
            <appkit-button />
          </div>
        </div>
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
