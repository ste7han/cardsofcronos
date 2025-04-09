'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface LoadingScreenProps {
  message?: string;
  timeout?: number;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Forging Your Destiny", 
  timeout = 2000 
}) => {
  // Add a client-side flag to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);
  const [activeRune, setActiveRune] = useState<number>(0);
  
  // Arcane rune symbols
  const runeSymbols = ['✧', '⚝', '⚜', '✦', '✴', '❈'];
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Simulate loading progress - only run on client side after hydration
  useEffect(() => {
    // Only run animations on the client side after hydration
    if (!isClient) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, timeout / 20);
    
    // Hide loading screen after timeout
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, timeout);
    
    // Animate runes
    const runeInterval = setInterval(() => {
      setActiveRune(prev => (prev + 1) % runeSymbols.length);
    }, 500);
    
    return () => {
      clearInterval(interval);
      clearTimeout(hideTimer);
      clearInterval(runeInterval);
    };
  }, [isClient, timeout]);
  
  if (!visible) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cosmic-black)] bg-opacity-90 backdrop-blur-md transition-opacity duration-500">
      <div className="text-center max-w-md px-6">
        {/* SVG image without border */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          <Image 
            src="/Untitled design (9).svg" 
            alt="Cards of Cronos Logo" 
            width={240} 
            height={240}
            className="object-contain modern-floating"
            priority
          />
          
          {/* Arcane symbols - only show animations on client side */}
          {isClient && runeSymbols.map((symbol, index) => (
            <div 
              key={index}
              className={`absolute w-8 h-8 text-[var(--secondary)] flex items-center justify-center transition-all duration-300 ${
                index === activeRune ? 'opacity-100 scale-110' : 'opacity-0 scale-90'
              }`}
              style={{
                top: index % 2 === 0 ? '-1rem' : 'auto',
                bottom: index % 2 === 1 ? '-1rem' : 'auto',
                left: index % 3 === 0 ? '-1rem' : 'auto',
                right: index % 3 !== 0 ? '-1rem' : 'auto',
              }}
            >
              {symbol}
            </div>
          ))}
        </div>
        
        <h2 className="text-2xl font-['Cinzel'] text-transparent bg-clip-text bg-gradient-to-r from-[var(--secondary)] to-[var(--secondary-glow)] mb-4 tracking-wider">
          {message}{isClient && <span className="animate-pulse">...</span>}
        </h2>
        
        {/* Mana orb progress */}
        <div className="w-48 h-2 bg-[var(--cosmic-black)] border border-[var(--glass-border)] rounded-full mx-auto overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full transition-all duration-300"
            style={{ width: `${isClient ? progress : 0}%` }}
          ></div>
        </div>
        
        {/* Progress percentage */}
        <p className="text-white/50 text-xs mt-2 font-mono">{isClient ? progress : 0}%</p>
        
        {/* Cosmic particles - only show on client side with fixed positions */}
        {isClient && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Use a small fixed set of particles with hardcoded values instead of random/calculated values */}
            <div 
              className="absolute w-1 h-1 rounded-full bg-[var(--primary-glow)]"
              style={{
                top: "10%",
                left: "20%",
                opacity: 0.1,
                animation: "float 3s infinite ease-in-out 0s"
              }}
            ></div>
            <div 
              className="absolute w-1 h-1 rounded-full bg-[var(--primary-glow)]"
              style={{
                top: "30%",
                left: "70%",
                opacity: 0.2,
                animation: "float 4s infinite ease-in-out 0.5s"
              }}
            ></div>
            <div 
              className="absolute w-1 h-1 rounded-full bg-[var(--primary-glow)]"
              style={{
                top: "70%",
                left: "30%",
                opacity: 0.15,
                animation: "float 5s infinite ease-in-out 1s"
              }}
            ></div>
            <div 
              className="absolute w-1 h-1 rounded-full bg-[var(--primary-glow)]"
              style={{
                top: "50%",
                left: "80%",
                opacity: 0.25,
                animation: "float 3.5s infinite ease-in-out 1.5s"
              }}
            ></div>
            <div 
              className="absolute w-1 h-1 rounded-full bg-[var(--primary-glow)]"
              style={{
                top: "80%",
                left: "10%",
                opacity: 0.2,
                animation: "float 4.5s infinite ease-in-out 0.75s"
              }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
