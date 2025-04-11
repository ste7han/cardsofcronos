'use client';

import React from 'react';

interface BuyTokenButtonProps {
  variant?: 'primary' | 'secondary' | 'small';
  className?: string;
}

const BuyTokenButton: React.FC<BuyTokenButtonProps> = ({ 
  variant = 'primary',
  className = '' 
}) => {
  const wolfswapUrl = "https://wolfswap.app/swap?chainId=25&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=0xECf3361441512c1e9F6A6e8734D86614D8e795BC";
  
  const baseStyles = "flex items-center justify-center font-medium uppercase tracking-wider transition-all duration-300 active:scale-95";
  
  const variantStyles = {
    primary: "modern-btn-primary text-xs sm:text-sm px-5 py-2 sm:py-2.5",
    secondary: "modern-btn-secondary text-xs sm:text-sm px-5 py-2 sm:py-2.5 bg-[var(--cosmic-purple)]/30",
    small: "modern-btn-secondary text-xs px-3 py-1.5 rounded-full"
  };
  
  return (
    <a 
      href={wolfswapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      <span>BUY $CROCARDS</span>
    </a>
  );
};

export default BuyTokenButton;
