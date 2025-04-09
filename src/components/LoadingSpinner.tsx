'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'primary',
  className = ''
}) => {
  // Size mappings
  const sizeMap = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };
  
  // Color mappings
  const colorMap = {
    primary: 'border-[var(--primary)]/30 border-t-[var(--primary)]',
    secondary: 'border-[var(--secondary)]/30 border-t-[var(--secondary)]',
    white: 'border-white/30 border-t-white'
  };
  
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div className={`${sizeMap[size]} ${colorMap[color]} rounded-full animate-spin`}></div>
      
      {/* Subtle glow effect */}
      <div className={`absolute inset-0 rounded-full opacity-50 blur-sm ${
        color === 'primary' 
          ? 'bg-[var(--primary)]/20' 
          : color === 'secondary' 
            ? 'bg-[var(--secondary)]/20' 
            : 'bg-white/10'
      }`}></div>
      
      {/* Arcane rune that appears and fades */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs text-[var(--primary-glow)] opacity-0 animate-pulse-fade">✧</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;

// Add this to your global CSS
// @keyframes pulse-fade {
//   0%, 100% { opacity: 0; }
//   50% { opacity: 0.7; }
// }
