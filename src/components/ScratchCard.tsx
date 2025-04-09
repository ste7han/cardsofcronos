'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ScratchCardProps {
  image: string;
  name: string;
  color: string;
  aspectRatio?: string;
}

const ScratchCard: React.FC<ScratchCardProps> = ({ 
  image, 
  name, 
  color,
  aspectRatio = 'aspect-[3/4]'
}) => {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return (
    <div 
      className={`relative ${aspectRatio} rounded-lg overflow-hidden perspective-1000`}
      onMouseEnter={isClient ? () => setIsHovered(true) : undefined}
      onMouseLeave={isClient ? () => setIsHovered(false) : undefined}
    >
      {/* Card image */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br ${color} flex items-center justify-center transform transition-all duration-500 preserve-3d ${isClient && isHovered ? 'scale-105' : 'scale-100'}`}
        style={{
          boxShadow: isClient && isHovered 
            ? '0 15px 35px -5px rgba(0, 0, 0, 0.6), 0 0 25px rgba(157, 78, 221, 0.6), 0 0 40px rgba(255, 215, 0, 0.3)'
            : '0 15px 35px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(157, 78, 221, 0.5)'
        }}
      >
        <div className="absolute inset-0 rounded-lg backdrop-blur-sm bg-black/20"></div>
        
        {/* Card face with depth layers */}
        <div className="relative w-full h-full preserve-3d">
          {/* Background layer */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-black/40 to-black/10"></div>
          
          {/* Image layer */}
          <Image 
            src={image} 
            alt={`${name} Card`} 
            width={150} 
            height={225}
            className="object-cover relative z-10 rounded-lg w-full h-full"
            priority
          />
          
          {/* Foreground layer */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
        </div>
        
        {/* Enhanced 3D border with depth */}
        <div className="absolute inset-0 rounded-lg border-2 border-white/30 shadow-inner"></div>
        
        {/* Reflective highlight */}
        <div className={`absolute inset-0 rounded-lg bg-gradient-to-br from-white/30 to-transparent transition-opacity duration-300 ${isClient && isHovered ? 'opacity-90' : 'opacity-70'}`}></div>
        
        {/* Card name overlay */}
        <div className="absolute top-0 left-0 right-0 bg-black/50 backdrop-blur-sm py-2 px-2 rounded-t-lg">
          <p className="text-white font-['Cinzel'] text-center text-sm uppercase tracking-wider">{name}</p>
        </div>
        
        {/* Card type/rarity overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm py-2 px-2 rounded-b-lg">
          <p className="text-[var(--secondary)] font-['Cinzel'] text-center text-xs uppercase tracking-wider">
            {name.includes('LEGENDARY') ? 'LEGENDARY' : 'EPIC'}
          </p>
        </div>
        
        {/* Glow effect on hover */}
        <div 
          className={`absolute inset-0 rounded-lg transition-opacity duration-300 ${isClient && isHovered ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background: `radial-gradient(circle at center, ${color.includes('FFD700') ? 'rgba(255, 215, 0, 0.3)' : 'rgba(157, 78, 221, 0.3)'}, transparent 70%)`,
            filter: 'blur(10px)'
          }}
        ></div>
      </div>
    </div>
  );
};

export default ScratchCard;
