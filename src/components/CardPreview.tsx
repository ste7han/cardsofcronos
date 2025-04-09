'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface CardPreviewProps {
  name: string;
  description: string;
  cardType: 'Project' | 'Roast' | 'Influencer' | 'Special';
  rarity: 'Epic' | 'Rare' | 'Mythical';
  imagePreview: string | null;
  isLoading?: boolean;
}

// Rarity colors for styling
const rarityColors = {
  Common: 'from-gray-400 to-gray-600',
  Uncommon: 'from-green-400 to-green-600',
  Rare: 'from-[#3A0CA3] to-[#9D4EDD]',
  Epic: 'from-[#F72585] to-[#3A0CA3]',
  Mythical: 'from-[#FFD700] to-[#B14EFF]'
};

// Card type icons
const cardTypeIcons = {
  Project: '🏗️',
  Roast: '🔥',
  Influencer: '🌟',
  Special: '✨'
};

const CardPreview: React.FC<CardPreviewProps> = ({
  name,
  description,
  cardType,
  rarity,
  imagePreview,
  isLoading = false
}) => {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Default image if no preview is provided
  const defaultImage = `/sxfdO1IW9tFd2uK7oUg54HWLfM8.png`;
  
  // Truncate description if it's too long
  const truncatedDescription = description.length > 100 
    ? `${description.substring(0, 100)}...` 
    : description;
  
  // Handle card flip
  const handleFlip = () => {
    if (isClient) {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto perspective-1000">
      {isLoading ? (
        // Loading state
        <div className="w-full aspect-[2/3] rounded-lg bg-gradient-to-br from-[var(--cosmic-black)]/70 to-[var(--cosmic-purple)]/50 animate-pulse flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin"></div>
        </div>
      ) : (
        // Card with 3D flip effect
        <div 
          className={`card-3d w-full aspect-[2/3] rounded-lg cursor-pointer transition-all duration-500 preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          } ${isHovered ? 'scale-105' : ''}`}
          onClick={handleFlip}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Front of card */}
          <div className={`absolute inset-0 backface-hidden rounded-lg bg-gradient-to-br ${rarityColors[rarity as keyof typeof rarityColors]} shadow-xl`}>
            {/* Card image */}
            <div className="relative w-full h-full">
              {/* Background layer */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-black/40 to-black/10"></div>
              
              {/* Image layer */}
              <Image 
                src={imagePreview || defaultImage} 
                alt={name || 'Card Preview'}
                fill
                className="object-cover rounded-lg"
              />
              
              {/* Foreground layer with gradient overlay */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/70 to-transparent opacity-60"></div>
              
              {/* Card border */}
              <div className="absolute inset-0 rounded-lg border-2 border-white/30 shadow-inner"></div>
              
              {/* Card info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/70 backdrop-blur-sm rounded-b-lg">
                <h3 className="text-white font-['Cinzel'] text-center text-base font-bold truncate">
                  {name || 'Card Name'}
                </h3>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-[var(--secondary)]">{rarity}</span>
                  <span className="text-xs text-white/70">{cardType}</span>
                </div>
              </div>
              
              {/* Rarity indicator */}
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] shadow-glow"></div>
              
              {/* Card type icon */}
              <div className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center bg-black/50 rounded-full">
                <span className="text-sm">{cardTypeIcons[cardType as keyof typeof cardTypeIcons]}</span>
              </div>
              
              {/* Flip indicator */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/50 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="animate-pulse">Click to flip</span>
              </div>
            </div>
          </div>
          
          {/* Back of card */}
          <div className="absolute inset-0 backface-hidden rounded-lg bg-gradient-to-br from-[var(--cosmic-black)] to-[var(--cosmic-purple)]/70 shadow-xl rotate-y-180">
            <div className="relative w-full h-full p-4 flex flex-col">
              {/* Card border */}
              <div className="absolute inset-0 rounded-lg border-2 border-white/30 shadow-inner"></div>
              
              {/* Arcane symbols */}
              <div className="absolute top-2 left-2 text-[var(--primary-glow)]/30 text-lg">✧</div>
              <div className="absolute bottom-2 right-2 text-[var(--primary-glow)]/30 text-lg">⚜</div>
              
              {/* Card content */}
              <div className="flex-1 flex flex-col justify-center items-center text-center">
                <h3 className="text-lg font-bold font-['Cinzel'] mb-2 text-[var(--secondary)]">
                  {name || 'Card Name'}
                </h3>
                
                <div className="flex gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary-glow)] text-xs">
                    {rarity}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--secondary)]/20 text-[var(--secondary)] text-xs">
                    {cardType}
                  </span>
                </div>
                
                <p className="text-white/80 text-sm mb-4">
                  {truncatedDescription || 'No description provided.'}
                </p>
                
                {/* Card attributes */}
                <div className="grid grid-cols-3 gap-2 w-full mt-auto">
                  <div className="p-1 bg-[var(--cosmic-black)]/30 rounded text-center">
                    <div className="text-sm font-bold text-[var(--primary-glow)]">
                      {Math.floor(Math.random() * 30) + 70}
                    </div>
                    <div className="text-xs text-white/70">Power</div>
                  </div>
                  <div className="p-1 bg-[var(--cosmic-black)]/30 rounded text-center">
                    <div className="text-sm font-bold text-[var(--primary-glow)]">
                      {Math.floor(Math.random() * 30) + 70}
                    </div>
                    <div className="text-xs text-white/70">Defense</div>
                  </div>
                  <div className="p-1 bg-[var(--cosmic-black)]/30 rounded text-center">
                    <div className="text-sm font-bold text-[var(--primary-glow)]">
                      {Math.floor(Math.random() * 30) + 70}
                    </div>
                    <div className="text-xs text-white/70">Magic</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add styles for 3D card effect */}
      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        
        .preserve-3d {
          transform-style: preserve-3d;
        }
        
        .backface-hidden {
          backface-visibility: hidden;
        }
        
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
};

export default CardPreview;
