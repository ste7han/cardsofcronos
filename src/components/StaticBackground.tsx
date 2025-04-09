'use client';

import React from 'react';

const StaticBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[var(--cosmic-black)] via-[var(--cosmic-purple)]/30 to-[var(--cosmic-black)]">
      {/* Static gradient overlay */}
      <div className="absolute inset-0 bg-[var(--cosmic-black)] opacity-70"></div>
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5.61L7.5 18.8v24.38L30 56.39l22.5-13.2V18.8L30 5.61zm0 2.8l20 11.74v20.52L30 51.8l-20-11.74V20.15L30 8.4z' fill='%239D4EDD' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}
      ></div>
      
      {/* Top and bottom gradients */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"></div>
      
      {/* Left and right gradients */}
      <div className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--primary)]/30 to-transparent"></div>
      <div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-[var(--primary)]/30 to-transparent"></div>
      
      {/* Static stars - just a few fixed ones */}
      <div className="absolute top-[10%] left-[15%] w-1 h-1 rounded-full bg-white opacity-70"></div>
      <div className="absolute top-[25%] left-[40%] w-1.5 h-1.5 rounded-full bg-white opacity-80"></div>
      <div className="absolute top-[15%] left-[75%] w-1 h-1 rounded-full bg-white opacity-60"></div>
      <div className="absolute top-[45%] left-[25%] w-1 h-1 rounded-full bg-white opacity-70"></div>
      <div className="absolute top-[65%] left-[80%] w-1.5 h-1.5 rounded-full bg-white opacity-80"></div>
      <div className="absolute top-[85%] left-[10%] w-1 h-1 rounded-full bg-white opacity-60"></div>
      <div className="absolute top-[35%] left-[60%] w-2 h-2 rounded-full bg-[var(--primary-glow)] opacity-40 blur-[1px]"></div>
      <div className="absolute top-[75%] left-[30%] w-2 h-2 rounded-full bg-[var(--primary-glow)] opacity-40 blur-[1px]"></div>
      
      {/* Static nebula-like gradients */}
      <div className="absolute top-[20%] left-[20%] w-64 h-64 rounded-full bg-[var(--primary)]/5 blur-3xl"></div>
      <div className="absolute bottom-[30%] right-[25%] w-80 h-80 rounded-full bg-[var(--primary)]/5 blur-3xl"></div>
    </div>
  );
};

export default StaticBackground;
