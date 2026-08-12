'use client';

import React from 'react';

// Helper om effect tekst te vinden in je JSON data
const getCardEffect = (card: any) => {
  if (card.power && card.power !== "None") return <><strong className="text-amber-400">Power:</strong> {card.power}</>;
  if (card.effect) return card.effect;
  if (card.ability) return card.ability;
  if (card.passive) return <><strong className="text-blue-400">Passive:</strong> {card.passive}</>;
  if (card.description) return <span className="italic text-gray-400">{card.description}</span>;
  return <span className="text-gray-600 italic">No effect data.</span>;
};

interface DeckCardProps {
  card: any;
  isSelected: boolean;
  onToggle: (card: any) => void;
  colorTheme?: 'blue' | 'amber'; // 'blue' voor training, 'amber' voor PvP
}

export const DeckCard = ({ card, isSelected, onToggle, colorTheme = 'blue' }: DeckCardProps) => {
  
  // Bepaal kleuren op basis van thema
  const activeBorder = colorTheme === 'amber' ? 'border-amber-500' : 'border-blue-400';
  const activeBg = colorTheme === 'amber' ? 'bg-amber-600/30' : 'bg-blue-600/30';
  const activeText = colorTheme === 'amber' ? 'text-amber-500/80' : 'text-blue-400';

  return (
    <div 
      onClick={() => onToggle(card)} 
      className={`group relative cursor-pointer p-4 rounded-2xl border transition-all duration-300 overflow-hidden h-[120px] flex flex-col justify-between
        ${isSelected 
          ? `${activeBg} ${activeBorder} scale-105 shadow-lg` 
          : 'bg-black/40 border-gray-800 opacity-90 hover:opacity-100 hover:border-gray-600'
        }`}
    >
      {/* BASIS INFO (Zichtbaar als je niet hovert) */}
      <div className="relative z-10">
        <p className={`text-[8px] font-black uppercase mb-1 ${isSelected ? 'text-white' : activeText}`}>
          {card.card_type}
        </p>
        <p className="text-[10px] font-bold truncate mb-2 text-white">
          {card.card_id.replace('COC_', '').replace(/_/g, ' ')}
        </p>
      </div>

      <div className="flex justify-between text-[10px] text-gray-500 font-mono relative z-10">
        <span>MC: {card.base_mc}</span>
        <span>{card.rarity ? card.rarity[0] : '?'}</span>
      </div>

      {/* HOVER OVERLAY (Schuift omhoog bij hover) */}
      <div className="absolute inset-0 bg-[#0a0a0a] bg-opacity-95 p-3 flex flex-col justify-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20 border-t border-white/10">
        <p className="text-[9px] text-gray-300 leading-relaxed overflow-y-auto max-h-full scrollbar-hide text-center">
          {getCardEffect(card)}
        </p>
      </div>
    </div>
  );
};