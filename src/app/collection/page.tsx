'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNavigation from '@/components/BottomNavigation';
import { useAppKitInitialized } from '@/components/AppKitProvider';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Define card interface
interface Card {
  id: string;
  name: string;
  image: string;
  rarity: string;
  type: string;
  description: string;
  attributes: {
    power: number;
    defense: number;
    magic: number;
  };
}

// Default cards as fallback
const defaultCards = [
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
  }
];

// Rarity colors for styling
const rarityColors = {
  Common: 'from-gray-400 to-gray-600',
  Rare: 'from-yellow-400 to-yellow-600',
  Epic: 'from-purple-400 to-purple-600',
  Legendary: 'from-orange-400 to-orange-600',
  Mythical: 'from-gray-900 to-gray-700'
};

// Card type colors for styling
const typeColors = {
  Project: 'from-green-400 to-green-600',
  Founder: 'from-red-400 to-red-600',
  Crofam: 'from-blue-400 to-blue-600',
  Influencer: 'from-purple-400 to-purple-600',
  Event: 'from-yellow-400 to-yellow-600',
  Roast: 'from-red-400 to-red-600',
  Special: 'from-gray-900 to-gray-700',
  Parody: 'from-purple-400 to-purple-600',
  Fusion: 'from-amber-800 to-amber-600'
};

// Card types with fire costs
const cardTypes = [
  { name: 'Project', emoji: '🟩', cost: '100k 🔥' },
  { name: 'Founder', emoji: '🟥', cost: '100k 🔥' },
  { name: 'Crofam', emoji: '🟦', cost: '100k 🔥' },
  { name: 'Influencer', emoji: '🟪', cost: '100k 🔥' },
  { name: 'Event', emoji: '🟨', cost: '100k 🔥' },
  { name: 'Roast', emoji: '🟥', cost: '250k 🔥' },
  { name: 'Special', emoji: '⚫', cost: '500k 🔥' },
  { name: 'Parody', emoji: '🟪', cost: '250k 🔥' },
  { name: 'Fusion', emoji: '🟫', cost: '250k 🔥' }
];

// Rarity levels with fire costs
const rarityLevels = [
  { name: 'Common', emoji: '⚪', cost: '10k 🔥' },
  { name: 'Rare', emoji: '🟨', cost: '20k 🔥' },
  { name: 'Epic', emoji: '🟪', cost: '50k 🔥' },
  { name: 'Legendary', emoji: '🟧', cost: '100k 🔥' },
  { name: 'Mythical', emoji: '⚫', cost: '250k 🔥' }
];

export default function CollectionPage() {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [cardCollection, setCardCollection] = useState<Card[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRarity, setFilterRarity] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCard, setSelectedCard] = useState<typeof cardCollection[0] | null>(null);
  
  // Add useRef consistently to maintain hook order
  const pageRef = useRef<HTMLDivElement>(null);
  
  // Check if AppKit is initialized
  const appKitInitialized = useAppKitInitialized();
  
  // Default values if not connected
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [openAppKit, setOpenAppKit] = useState<() => void>(() => () => {
    console.warn('AppKit not initialized yet');
  });
  
  // Initialize wallet connection once on client
  useEffect(() => {
    if (!isClient || !appKitInitialized) return;
    
    // Wait a moment for AppKit to be fully initialized
    const timer = setTimeout(() => {
      try {
        // Use the global window AppKit instance that was initialized in the provider
        if (window.AppKitInstance) {
          const walletInfo = window.AppKitInstance.getWalletInfo?.();
          
          if (walletInfo) {
            setIsConnected(!!walletInfo.isConnected);
            setAddress(walletInfo.address);
          }
          
          // Set the open function
          setOpenAppKit(() => () => {
            window.AppKitInstance?.open?.();
          });
        }
      } catch (error) {
        console.error('Error accessing AppKit instance:', error);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [isClient, appKitInitialized]);

  // Fetch cards from Firestore
  const fetchCards = useCallback(async () => {
    try {
      setIsLoading(true);
      const cardsCollection = collection(db, 'cards');
      const cardsQuery = query(cardsCollection, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(cardsQuery);
      
      if (querySnapshot.empty) {
        // Use default cards if no cards in database
        setCardCollection(defaultCards);
        setCards(defaultCards);
      } else {
        const fetchedCards = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unnamed Card',
            image: data.imageUrl || '/sxfdO1IW9tFd2uK7oUg54HWLfM8.png',
            rarity: data.rarity || 'Common',
            type: data.type || 'Unknown',
            description: data.description || 'No description available.',
            attributes: {
              power: data.attributes?.power || Math.floor(Math.random() * 30) + 70,
              defense: data.attributes?.defense || Math.floor(Math.random() * 30) + 70,
              magic: data.attributes?.magic || Math.floor(Math.random() * 30) + 70
            }
          };
        });
        
        setCardCollection(fetchedCards);
        setCards(fetchedCards);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      // Fallback to default cards on error
      setCardCollection(defaultCards);
      setCards(defaultCards);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
    if (isClient) {
      fetchCards();
    }
  }, [isClient, fetchCards]);
  
  // Handle wallet connection
  const handleConnectWallet = () => {
    if (appKitInitialized) {
      openAppKit();
    } else {
      console.log('AppKit not initialized yet');
    }
  };
  
  // Animation on page load - only run on client side after hydration
  useEffect(() => {
    if (!isClient) return;
    setPageLoaded(true);
  }, [isClient]);
  
  // Add keyboard support to close modal with ESC key
  useEffect(() => {
    if (!isClient) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCard) {
        setSelectedCard(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClient, selectedCard]);
  
  // Apply filters and sorting - only run on client side after hydration
  useEffect(() => {
    if (!isClient || cardCollection.length === 0) return;
    
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
      if (sortBy === 'newest') {
        // Assuming newer cards have higher IDs or would be sorted in reverse order
        return b.id.localeCompare(a.id);
      } else if (sortBy === 'oldest') {
        // Assuming older cards have lower IDs
        return a.id.localeCompare(b.id);
      }
      return 0;
    });
    
    setCards(filteredCards);
  }, [isClient, filterRarity, filterType, sortBy, cardCollection]);
  
  // Predefined types and rarities for filter
  const types = ['All', ...cardTypes.map(type => type.name)];
  
  // Predefined rarities for filter
  const rarities = ['All', ...rarityLevels.map(rarity => rarity.name)];
  
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
          
          {/* Filters and sorting - Improved mobile layout */}
          <div className="mb-8">
            {/* Filter toggle for mobile */}
            <div className="md:hidden mb-4">
              <button 
                className="w-full py-3 px-4 bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30 rounded-lg text-white flex items-center justify-between"
                onClick={() => {
                  const filterSection = document.getElementById('filter-section');
                  if (filterSection) {
                    filterSection.classList.toggle('hidden');
                  }
                }}
              >
                <span>Filters & Sorting</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* Filter controls - hidden by default on mobile */}
            <div id="filter-section" className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rarity filter */}
              <div className="modern-card p-4">
                <label className="block text-white/80 mb-2 text-sm">Filter by Rarity</label>
                <select 
                  className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-3 text-white"
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                >
                  <option value="All">All Rarities</option>
                  {rarityLevels.map(rarity => (
                    <option key={rarity.name} value={rarity.name}>
                      {rarity.emoji} {rarity.name} ({rarity.cost})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Type filter */}
              <div className="modern-card p-4">
                <label className="block text-white/80 mb-2 text-sm">Filter by Type</label>
                <select 
                  className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-3 text-white"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="All">All Types</option>
                  {cardTypes.map(type => (
                    <option key={type.name} value={type.name}>
                      {type.emoji} {type.name} ({type.cost})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Sort options */}
              <div className="modern-card p-4">
                <label className="block text-white/80 mb-2 text-sm">Sort by</label>
                <select 
                  className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-3 text-white"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
              
              {/* Active filters display and reset button */}
              <div className="md:col-span-3 flex flex-wrap items-center justify-between mt-2 px-2">
                <div className="flex flex-wrap gap-2">
                  {filterRarity !== 'All' && (
                    <div className="bg-[var(--primary)]/20 px-3 py-1 rounded-full text-xs flex items-center">
                      <span>Rarity: {filterRarity}</span>
                      <button 
                        className="ml-2 text-white/70 hover:text-white"
                        onClick={() => setFilterRarity('All')}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {filterType !== 'All' && (
                    <div className="bg-[var(--primary)]/20 px-3 py-1 rounded-full text-xs flex items-center">
                      <span>Type: {filterType}</span>
                      <button 
                        className="ml-2 text-white/70 hover:text-white"
                        onClick={() => setFilterType('All')}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                
                {(filterRarity !== 'All' || filterType !== 'All') && (
                  <button 
                    className="text-xs text-[var(--primary)] hover:text-[var(--primary-glow)]"
                    onClick={() => {
                      setFilterRarity('All');
                      setFilterType('All');
                    }}
                  >
                    Reset All
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Cards grid - Improved mobile layout with better spacing */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="animate-pulse">
                  <div className="w-full aspect-[2/3] rounded-lg bg-[var(--cosmic-black)]/50"></div>
                </div>
              ))
            ) : cards.length > 0 ? (
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
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 backdrop-blur-sm rounded-b-lg">
                      <h3 className="text-white font-['Cinzel'] text-center text-xs font-bold truncate">{card.name}</h3>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-[10px] text-[var(--secondary)]">{card.rarity}</span>
                        <span className="text-[10px] text-white/70">{card.type}</span>
                      </div>
                    </div>
                    
                    {/* Rarity indicator */}
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] shadow-glow"></div>
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
            <Link href="/admin" className="text-[var(--primary)] hover:text-[var(--primary-glow)] text-sm mt-2 inline-block">
              Admin Panel
            </Link>
          </div>
        </div>
      </main>
      
      {/* Card detail modal - Improved for mobile */}
      {selectedCard && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          {/* Backdrop - clicking anywhere outside the modal closes it */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={() => setSelectedCard(null)}
          ></div>
          
          {/* Modal container with max height and scrolling */}
          <div className="relative z-[310] w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-[var(--cosmic-black)]/90 backdrop-blur-xl p-3 sm:p-6 rounded-xl border border-[var(--primary)]/30">
            {/* No close button - Modal can be closed by clicking outside or pressing ESC */}
            
            {/* Card image - reduced size on mobile */}
            <div className="perspective-1000 mx-auto md:mx-0 mt-4 md:mt-0" style={{ maxWidth: '240px', width: '100%' }}>
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
                    width={300}
                    height={450}
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
              

            </div>
            
            {/* Close instructions text */}
            <div className="col-span-1 md:col-span-2 text-center mt-2 text-white/60 text-sm">
              Click outside or press the X button to close
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
