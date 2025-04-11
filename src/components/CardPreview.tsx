'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface CardPreviewProps {
  name: string;
  description: string;
  cardType: 'Project' | 'Founder' | 'Crofam' | 'Influencer' | 'Event' | 'Roast' | 'Special' | 'Parody' | 'Fusion';
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythical';
  imagePreview: string | null;
  animated?: boolean;
  isLoading?: boolean;
}

// Rarity colors for styling
const rarityColors = {
  Common: 'from-gray-400 to-gray-600',
  Rare: 'from-[#FFD700] to-[#FFA500]',
  Epic: 'from-[#9D4EDD] to-[#6A0DAD]',
  Legendary: 'from-[#FF8C00] to-[#FF4500]',
  Mythical: 'from-[#000000] to-[#333333]'
};

// Card type icons and colors
const cardTypeIcons = {
  Project: '🟩',
  Founder: '🟥',
  Crofam: '🟦',
  Influencer: '🟪',
  Event: '🟨',
  Roast: '🟥',
  Special: '⚫',
  Parody: '🟪',
  Fusion: '🟫'
};

const CardPreview: React.FC<CardPreviewProps> = ({
  name,
  description,
  cardType,
  rarity,
  imagePreview,
  animated = false,
  isLoading = false
}) => {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  // Store card attribute values in state to ensure consistency between renders
  const [cardAttributes, setCardAttributes] = useState({
    power: 80,
    defense: 80,
    magic: 80
  });
  
  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
    // Generate random values only once after component mounts on client
    if (typeof window !== 'undefined') {
      setCardAttributes({
        power: Math.floor(Math.random() * 30) + 70,
        defense: Math.floor(Math.random() * 30) + 70,
        magic: Math.floor(Math.random() * 30) + 70
      });
    }
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
    <div className="w-full max-w-[180px] sm:max-w-[200px] md:max-w-xs mx-auto relative z-[260]" style={{ perspective: '1000px', position: 'relative' }}>
      {isLoading ? (
        // Loading state
        <div className="w-full aspect-[2/3] rounded-lg bg-gradient-to-br from-[var(--cosmic-black)]/70 to-[var(--cosmic-purple)]/50 animate-pulse flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin"></div>
        </div>
      ) : (
        // Card with 3D flip effect
        <div 
          className={`w-full aspect-[2/3] rounded-lg cursor-pointer transition-all duration-500 ${
            isHovered ? 'scale-105' : ''
          } max-h-[300px]`}
          style={{ 
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
          onClick={handleFlip}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Front of card */}
          <div 
            className={`absolute inset-0 rounded-lg bg-gradient-to-br ${rarityColors[rarity as keyof typeof rarityColors]} shadow-xl`}
            style={{ backfaceVisibility: 'hidden' }}
          >
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
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 backdrop-blur-sm rounded-b-lg">
                <h3 className="text-white font-['Cinzel'] text-center text-xs font-bold truncate">
                  {name || 'Card Name'}
                </h3>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-[var(--secondary)]">{rarity}</span>
                  <span className="text-[10px] text-white/70">{cardType}</span>
                </div>
              </div>
              
              {/* Card type icon */}
              <div className="absolute top-1 left-1 w-4 h-4 flex items-center justify-center bg-black/50 rounded-full">
                <span className="text-[10px]">{cardTypeIcons[cardType as keyof typeof cardTypeIcons]}</span>
              </div>
              
              {/* Animated indicator */}
              {animated && (
                <div className="absolute top-1 right-6 w-4 h-4 flex items-center justify-center bg-[#1E90FF]/70 rounded-full animate-pulse">
                  <span className="text-[10px]">🟦</span>
                </div>
              )}
              
              {/* Flip indicator - hidden on small cards */}
              <div className="hidden absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/50 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="animate-pulse">Flip</span>
              </div>
            </div>
          </div>
          
          {/* Back of card */}
          <div 
            className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--cosmic-black)] to-[var(--cosmic-purple)]/70 shadow-xl"
            style={{ 
              backfaceVisibility: 'hidden', 
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="relative w-full h-full p-2 flex flex-col">
              {/* Card border */}
              <div className="absolute inset-0 rounded-lg border-2 border-white/30 shadow-inner"></div>
              
              {/* Arcane symbols */}
              <div className="absolute top-1 left-1 text-[var(--primary-glow)]/30 text-xs">✧</div>
              <div className="absolute bottom-1 right-1 text-[var(--primary-glow)]/30 text-xs">⚜</div>
              
              {/* Card content */}
              <div className="flex-1 flex flex-col justify-center items-center text-center">
                <h3 className="text-sm font-bold font-['Cinzel'] mb-1 text-[var(--secondary)]">
                  {name || 'Card Name'}
                </h3>
                
                <div className="flex gap-1 mb-2">
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary-glow)] text-[10px]">
                    {rarity}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--secondary)]/20 text-[var(--secondary)] text-[10px]">
                    {cardType}
                  </span>
                </div>
                
                <p className="text-white/80 text-[10px] mb-2 px-1">
                  {truncatedDescription || 'No description provided.'}
                </p>
                
                {/* Card attributes */}
                <div className="grid grid-cols-3 gap-1 w-full mt-auto">
                  <div className="p-0.5 bg-[var(--cosmic-black)]/30 rounded text-center">
                    <div className="text-xs font-bold text-[var(--primary-glow)]">
                      {cardAttributes.power}
                    </div>
                    <div className="text-[8px] text-white/70">Power</div>
                  </div>
                  <div className="p-0.5 bg-[var(--cosmic-black)]/30 rounded text-center">
                    <div className="text-xs font-bold text-[var(--primary-glow)]">
                      {cardAttributes.defense}
                    </div>
                    <div className="text-[8px] text-white/70">Defense</div>
                  </div>
                  <div className="p-0.5 bg-[var(--cosmic-black)]/30 rounded text-center">
                    <div className="text-xs font-bold text-[var(--primary-glow)]">
                      {cardAttributes.magic}
                    </div>
                    <div className="text-[8px] text-white/70">Magic</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default CardPreview;
