'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const AdminHeader: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
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
  
  return (
    <header 
      className={`w-full max-w-[100vw] py-2 px-4 md:py-0.5 md:px-6 lg:px-10 flex justify-between items-center backdrop-blur-xl sticky top-0 z-[200] transition-all duration-500 ${
        scrolled
          ? 'bg-gradient-to-r from-[var(--cosmic-black)]/95 to-[var(--cosmic-purple)]/80 shadow-lg shadow-[var(--primary)]/20 border-b border-[var(--glass-border)]' 
          : 'bg-gradient-to-r from-[var(--cosmic-black)]/70 to-[var(--cosmic-purple)]/50'
      }`}
    >
      {/* Floating effect container */}
      <div className="absolute inset-x-0 -bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/50 to-transparent opacity-100 transition-opacity duration-500"></div>
      
      {/* Top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary-glow)]/40 to-transparent opacity-100"></div>
      
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
      
      {/* Admin Label */}
      <div className="flex items-center">
        <div className="bg-[var(--primary)]/20 text-[var(--primary)] px-3 py-1 rounded-full text-sm font-medium border border-[var(--primary)]/30">
          Admin Panel
        </div>
      </div>
    </header>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(AdminHeader);
