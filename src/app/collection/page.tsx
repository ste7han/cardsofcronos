'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNavigation from '@/components/BottomNavigation';
import { useAppKit, useAppKitAccount } from '@/lib/appkit';
import { useAppKitInitialized } from '@/components/AppKitProvider';

// Card data - in a real app, this would come from an API or database
const cardCollection = [
  {
    id: 'card-001',
    name: 'Cosmic Dragon',
    image: '/sxfdO1IW9tFd2uK7oUg54HWLfM8.png',
    rarity: 'Mythical',
    type: 'Creature',
    description: 'A powerful dragon that harnesses the energy of distant stars.',
    attributes: {
      power: 95,
      defense: 85,
      magic: 90
    }
  },
  {
    id: 'card-002',
    name: 'Astral Mage',
    image: '/TS0ZEQa6LqHIwGwyQsgxIYJVPzc.jpeg',
    rarity: 'Rare',
    type: 'Spellcaster',
    description: 'A wise mage who can manipulate the fabric of space and time.',
    attributes: {
      power: 70,
      defense: 60,
      magic: 95
    }
  },
  {
    id: 'card-003',
    name: 'Nebula Warrior',
    image: '/E8okCphkavy5wOswGJQ1oyw07iI.png',
    rarity: 'Epic',
    type: 'Warrior',
    description: 'A fearless warrior born from the heart of a dying star.',
    attributes: {
      power: 85,
      defense: 80,
      magic: 65
    }
  },
  {
    id: 'card-004',
    name: 'Void Elemental',
    image: '/BGOS4PVp4nxOsRhrupybTvvXMw.jpeg',
    rarity: 'Epic',
    type: 'Elemental',
    description: 'A mysterious entity that draws power from the void between worlds.',
    attributes: {
      power: 80,
      defense: 75,
      magic: 85
    }
  },
  {
    id: 'card-005',
    name: 'Celestial Guardian',
    image: '/ixf80jUKzkQNqTo81qXYh7m4XE.jpeg',
    rarity: 'Rare',
    type: 'Guardian',
    description: 'A protector of cosmic gateways and keeper of ancient knowledge.',
    attributes: {
      power: 75,
      defense: 90,
      magic: 70
    }
  },
  {
    id: 'card-006',
    name: 'Quantum Shifter',
    image: '/0sXAL430bJImcrBP10AovPMtQU8-1.jpeg',
    rarity: 'Mythical',
    type: 'Spellcaster',
    description: 'A being that exists in multiple dimensions simultaneously.',
    attributes: {
      power: 90,
      defense: 70,
      magic: 95
    }
  }
];

// Rarity colors for styling
const rarityColors = {
  Common: 'from-gray-400 to-gray-600',
  Uncommon: 'from-green-400 to-green-600',
  Rare: 'from-[#3A0CA3] to-[#9D4EDD]',
  Epic: 'from-[#F72585] to-[#3A0CA3]',
  Mythical: 'from-[#FFD700] to-[#B14EFF]'
};

export default function CollectionPage() {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [cards, setCards] = useState(cardCollection);
  const [filterRarity, setFilterRarity] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [selectedCard, setSelectedCard] = useState<typeof cardCollection[0] | null>(null);
  
  // Add useRef consistently to maintain hook order
  const pageRef = useRef<HTMLDivElement>(null);
  
  // Check if AppKit is initialized
  const appKitInitialized = useAppKitInitialized();
  
  // Get wallet connection status from AppKit
  const { isConnected = false, address = undefined } = appKitInitialized ? useAppKitAccount() : { isConnected: false, address: undefined };
  const { open = () => console.log('AppKit not initialized') } = appKitInitialized ? useAppKit() : { open: () => console.log('AppKit not initialized') };

  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle wallet connection
  const handleConnectWallet = () => {
    if (appKitInitialized) {
      open();
    } else {
      console.log('AppKit not initialized yet');
    }
  };
  
  // Animation on page load - only run on client side after hydration
  useEffect(() => {
    if (!isClient) return;
    setPageLoaded(true);
  }, [isClient]);
  
  // Apply filters and sorting - only run on client side after hydration
  useEffect(() => {
    if (!isClient) return;
    
    let filteredCards = [...cardCollection];
    
    // Apply rarity filter
    if (filterRarity !== 'All') {
      filteredCards = filteredCards.filter(card => card.rarity === filterRarity);
    }
    
    // Apply type filter
    if (filterType !== 'All') {
      filteredCards = filteredCards.filter(card => card.type === filterType);
    }
    
    // Apply sorting
    filteredCards.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'rarity') {
        const rarityOrder = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Epic': 4, 'Mythical': 5 };
        return rarityOrder[b.rarity as keyof typeof rarityOrder] - rarityOrder[a.rarity as keyof typeof rarityOrder];
      } else if (sortBy === 'power') {
        return b.attributes.power - a.attributes.power;
      }
      return 0;
    });
    
    setCards(filteredCards);
  }, [isClient, filterRarity, filterType, sortBy]);
  
  // Get unique types for filter
  const types = ['All', ...new Set(cardCollection.map(card => card.type))];
  
  // Get unique rarities for filter
  const rarities = ['All', ...new Set(cardCollection.map(card => card.rarity))];
  
  return (
    <div className="min-h-screen" ref={pageRef}>
      <Header 
        onConnectWallet={handleConnectWallet}
        isWalletConnected={isConnected}
        walletAddress={address}
      />
      
      {/* Page content */}
      <main className="relative pt-24 pb-32">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--cosmic-black)] via-[var(--cosmic-purple)]/10 to-[var(--cosmic-black)] -z-10"></div>
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-5 -z-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5.61L7.5 18.8v24.38L30 56.39l22.5-13.2V18.8L30 5.61zm0 2.8l20 11.74v20.52L30 51.8l-20-11.74V20.15L30 8.4z' fill='%239D4EDD' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}
        ></div>
        
        {/* Content container */}
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 transition-all duration-1000 ${isClient && pageLoaded ? 'opacity-100' : 'opacity-0 translate-y-10'}`}>
          {/* Page header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-['Cinzel'] mb-4 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
              CARD COLLECTION
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] mx-auto mb-6"></div>
            <p className="text-lg text-white/80 font-['Spectral'] max-w-3xl mx-auto">
              Explore our complete collection of mystical cards from across the cosmos
            </p>
          </div>
          
          {/* Filters and sorting */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rarity filter */}
            <div className="modern-card p-4">
              <label className="block text-white/80 mb-2 text-sm">Filter by Rarity</label>
              <select 
                className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
              >
                {rarities.map(rarity => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
            </div>
            
            {/* Type filter */}
            <div className="modern-card p-4">
              <label className="block text-white/80 mb-2 text-sm">Filter by Type</label>
              <select 
                className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                {types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* Sort options */}
            <div className="modern-card p-4">
              <label className="block text-white/80 mb-2 text-sm">Sort by</label>
              <select 
                className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Name (A-Z)</option>
                <option value="rarity">Rarity (Highest)</option>
                <option value="power">Power (Highest)</option>
              </select>
            </div>
          </div>
          
          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
            {cards.length > 0 ? (
              cards.map(card => (
                <div 
                  key={card.id} 
                  className="perspective-1000 cursor-pointer transform transition-all duration-300 hover:scale-105"
                  onClick={() => setSelectedCard(card)}
                >
                  <div className={`card-3d w-full aspect-[2/3] rounded-lg bg-gradient-to-br ${rarityColors[card.rarity as keyof typeof rarityColors]} flex items-center justify-center transform transition-all duration-500 preserve-3d rotate-y-5`}>
                    <div className="absolute inset-0 rounded-lg backdrop-blur-sm bg-black/20"></div>
                    
                    {/* Card face */}
                    <div className="relative w-full h-full preserve-3d">
                      {/* Background layer */}
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-black/40 to-black/10"></div>
                      
                      {/* Image layer */}
                      <Image 
                        src={card.image} 
                        alt={card.name}
                        width={300}
                        height={450}
                        className="object-cover relative z-10 rounded-lg w-full h-full"
                      />
                      
                      {/* Foreground layer */}
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/70 to-transparent opacity-60"></div>
                    </div>
                    
                    {/* Card border */}
                    <div className="absolute inset-0 rounded-lg border-2 border-white/30 shadow-inner"></div>
                    
                    {/* Card info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/70 backdrop-blur-sm rounded-b-lg">
                      <h3 className="text-white font-['Cinzel'] text-center text-base font-bold">{card.name}</h3>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-[var(--secondary)]">{card.rarity}</span>
                        <span className="text-xs text-white/70">{card.type}</span>
                      </div>
                    </div>
                    
                    {/* Rarity indicator */}
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] shadow-glow"></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-white/70 text-lg">No cards match your current filters.</p>
                <button 
                  className="mt-4 px-4 py-2 bg-[var(--primary)]/30 hover:bg-[var(--primary)]/50 rounded-full text-sm transition-colors duration-300 border border-[var(--primary)]/50"
                  onClick={() => {
                    setFilterRarity('All');
                    setFilterType('All');
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
          
          {/* Results count */}
          <div className="text-center mb-8">
            <p className="text-white/70">
              Showing {cards.length} of {cardCollection.length} cards
            </p>
          </div>
        </div>
      </main>
      
      {/* Card detail modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedCard(null)}></div>
          <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 bg-[var(--cosmic-black)]/90 backdrop-blur-xl p-6 rounded-xl border border-[var(--primary)]/30">
            {/* Card image */}
            <div className="perspective-1000">
              <div className={`card-3d w-full aspect-[2/3] rounded-lg bg-gradient-to-br ${rarityColors[selectedCard.rarity as keyof typeof rarityColors]} flex items-center justify-center transform transition-all duration-500 preserve-3d rotate-y-5`}>
                <div className="absolute inset-0 rounded-lg backdrop-blur-sm bg-black/20"></div>
                
                {/* Card face */}
                <div className="relative w-full h-full preserve-3d">
                  {/* Background layer */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-black/40 to-black/10"></div>
                  
                  {/* Image layer */}
                  <Image 
                    src={selectedCard.image} 
                    alt={selectedCard.name}
                    width={400}
                    height={600}
                    className="object-cover relative z-10 rounded-lg w-full h-full"
                  />
                  
                  {/* Foreground layer */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
                </div>
                
                {/* Card border */}
                <div className="absolute inset-0 rounded-lg border-2 border-white/30 shadow-inner"></div>
              </div>
            </div>
            
            {/* Card details */}
            <div className="flex flex-col">
              <h2 className="text-2xl md:text-3xl font-bold font-['Cinzel'] mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
                {selectedCard.name}
              </h2>
              
              <div className="flex gap-3 mb-4">
                <span className="px-3 py-1 rounded-full bg-[var(--primary)]/20 text-[var(--primary-glow)] text-sm">
                  {selectedCard.rarity}
                </span>
                <span className="px-3 py-1 rounded-full bg-[var(--secondary)]/20 text-[var(--secondary)] text-sm">
                  {selectedCard.type}
                </span>
              </div>
              
              <p className="text-white/80 mb-6">{selectedCard.description}</p>
              
              <h3 className="text-lg font-bold font-['Cinzel'] mb-3 text-[var(--secondary)]">Attributes</h3>
              
              {/* Attributes */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="modern-card p-3 text-center">
                  <div className="text-2xl font-bold text-[var(--primary-glow)]">{selectedCard.attributes.power}</div>
                  <div className="text-xs text-white/70">Power</div>
                </div>
                <div className="modern-card p-3 text-center">
                  <div className="text-2xl font-bold text-[var(--primary-glow)]">{selectedCard.attributes.defense}</div>
                  <div className="text-xs text-white/70">Defense</div>
                </div>
                <div className="modern-card p-3 text-center">
                  <div className="text-2xl font-bold text-[var(--primary-glow)]">{selectedCard.attributes.magic}</div>
                  <div className="text-xs text-white/70">Magic</div>
                </div>
              </div>
              
              {/* Card ID */}
              <div className="mt-auto text-xs text-white/50">
                Card ID: {selectedCard.id}
              </div>
              
              {/* Close button */}
              <button 
                onClick={() => setSelectedCard(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bottom Navigation */}
      <BottomNavigation 
        isWalletConnected={isConnected}
        onConnectWallet={handleConnectWallet}
      />
      
      <Footer />
    </div>
  );
}
