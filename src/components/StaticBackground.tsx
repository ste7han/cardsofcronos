'use client';

import React from 'react';

const StaticBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[var(--cosmic-black)] via-[var(--cosmic-purple)]/30 to-[var(--cosmic-black)]">
      {/* Static gradient overlay */}
      <div className="absolute inset-0 bg-[var(--cosmic-black)] opacity-70"></div>
      
      {/* Top and bottom gradients */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"></div>
    </div>
  );
};

export default StaticBackground;
