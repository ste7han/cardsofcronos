'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getBurnStats } from '@/firebase/firestore';
import { getDeadWalletBalance } from '@/lib/web3';

// Total supply of the token
const TOTAL_SUPPLY = 1000000000; // 1 billion

const BurnCounter: React.FC = () => {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [deadWalletBalance, setDeadWalletBalance] = useState<string>("0");
  const [burnPercentage, setBurnPercentage] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [animateCounter, setAnimateCounter] = useState<boolean>(false);
  const [orbEnergy, setOrbEnergy] = useState<number>(20); // Start with a consistent value for SSR
  const orbRef = useRef<HTMLDivElement>(null);
  
  // Arcane rune symbols for decoration with fixed positions for SSR consistency
  const runeSymbols = [
    { symbol: '✧', top: '10%', left: '5%', rotate: '0deg', fontSize: '16.10317928933285px' },
    { symbol: '⚝', top: '25%', left: '90%', rotate: '30deg', fontSize: '12.85842654066597px' },
    { symbol: '⚜', top: '40%', left: '5%', rotate: '60deg', fontSize: '13.79610951105109px' },
    { symbol: '✦', top: '55%', left: '90%', rotate: '90deg', fontSize: '16.712786910853307px' },
    { symbol: '✴', top: '70%', left: '5%', rotate: '120deg', fontSize: '10.347707243860073px' },
    { symbol: '❈', top: '85%', left: '90%', rotate: '150deg', fontSize: '10.6182131272435px' }
  ];

  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only fetch data and set up animations on the client side after hydration
  useEffect(() => {
    if (!isClient) return;
    
    const fetchBurnStats = async () => {
      try {
        setIsLoading(true);
        
        // Get dead wallet balance using the helper function from web3.ts
        try {
          const formattedBalance = await getDeadWalletBalance();
          setDeadWalletBalance(formattedBalance);
          
          // Convert to number for animation and percentage calculation
          const balanceNum = parseFloat(formattedBalance);
          
          // Calculate percentage of total supply
          const percentage = (balanceNum / TOTAL_SUPPLY) * 100;
          setBurnPercentage(percentage);
          
          // If we already had a value and got a new one, animate the counter
          if (parseFloat(deadWalletBalance) > 0 && balanceNum > parseFloat(deadWalletBalance)) {
            setAnimateCounter(true);
            setOrbEnergy(100); // Full energy on update
            setTimeout(() => {
              setAnimateCounter(false);
              setOrbEnergy(prev => Math.max(prev - 30, 20)); // Reduce energy after animation
            }, 2000);
          } else {
            // Set initial energy level based on percentage burned
            const initialEnergy = Math.min(Math.max(percentage * 1.2, 20), 80);
            setOrbEnergy(initialEnergy);
          }
        } catch (error) {
          console.error('Error fetching dead wallet balance:', error);
          
          // Fallback to Firebase stats if blockchain query fails
          const stats = await getBurnStats();
          const newTotal = stats?.totalBurned || 0;
          setDeadWalletBalance(newTotal.toString());
          setBurnPercentage((newTotal / TOTAL_SUPPLY) * 100);
        }
      } catch (error) {
        console.error('Error fetching burn stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBurnStats();

    // Set up a refresh interval
    const intervalId = setInterval(fetchBurnStats, 60000); // Refresh every minute
    
    // Subtle energy fluctuation - using a deterministic pattern instead of random
    let direction = 1;
    const energyFluctuationId = setInterval(() => {
      if (!animateCounter) {
        setOrbEnergy(prev => {
          // Change direction if reaching bounds
          if (prev >= 80) direction = -1;
          if (prev <= 20) direction = 1;
          return prev + (direction * 0.5);
        });
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
      clearInterval(energyFluctuationId);
    };
  }, [isClient, deadWalletBalance, animateCounter]);

  // Format the dead wallet balance
  const formattedDeadWalletBalance = isClient
    ? parseFloat(deadWalletBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : deadWalletBalance.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  
  // Format the burn percentage
  const formattedPercentage = isClient
    ? burnPercentage.toFixed(4)
    : burnPercentage.toString();
  
  // Handle mouse interaction with the orb - only on client side
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isClient || !orbRef.current) return;
    
    const orb = orbRef.current;
    const rect = orb.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Calculate distance from center (0-1)
    const distance = Math.min(1, Math.sqrt(x*x + y*y) / (rect.width / 2));
    
    // Apply subtle transform based on mouse position
    orb.style.transform = `translateX(${x * 0.05}px) translateY(${y * 0.05}px)`;
    
    // Increase glow based on proximity to center
    const glowIntensity = 15 + (1 - distance) * 10;
    orb.style.boxShadow = `0 0 ${glowIntensity}px ${glowIntensity/2}px rgba(177, 78, 255, 0.5)`;
  };
  
  const handleMouseLeave = () => {
    if (!isClient || !orbRef.current) return;
    
    // Reset transform and glow
    orbRef.current.style.transform = 'translateX(0) translateY(0)';
    orbRef.current.style.boxShadow = '0 0 15px 7.5px rgba(177, 78, 255, 0.5)';
  };

  return (
    <div className="arcane-border glass-card p-4 md:p-8 text-center max-w-md mx-auto relative overflow-hidden group hexagon-bg">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#9D4EDD]/10 to-[#6A0DAD]/10 opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
      
      {/* Arcane rune decorations with fixed positions for SSR consistency */}
      {runeSymbols.map((rune, index) => (
        <div 
          key={index}
          className="absolute text-[#FFD700] opacity-20 group-hover:opacity-40 transition-opacity duration-500"
          style={{
            top: rune.top,
            left: rune.left,
            transform: `rotate(${rune.rotate})`,
            fontSize: rune.fontSize
          }}
        >
          {rune.symbol}
        </div>
      ))}
      
      <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 tracking-wider relative z-10 font-['Cinzel'] text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FFEA80]">
        TOKENS BURNED IN DEAD WALLET
      </h2>
      
      <div className="relative z-10 py-4 flex flex-col items-center">
        {isLoading ? (
          <div className="animate-pulse flex justify-center items-center h-40 w-40">
            <div className="h-32 w-32 bg-[#9D4EDD]/30 rounded-full"></div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            {/* Magical orb - responsive size */}
            <div 
              ref={orbRef}
              className="relative w-32 h-32 md:w-40 md:h-40 rounded-full mb-4 md:mb-6 magical-orb transition-all duration-300"
              onMouseMove={isClient ? handleMouseMove : undefined}
              onMouseLeave={isClient ? handleMouseLeave : undefined}
              style={{
                background: `radial-gradient(circle at 30% 30%, rgba(177, 78, 255, 0.8), rgba(58, 12, 163, 0.6) 60%, rgba(10, 8, 24, 0.8))`,
                boxShadow: '0 0 15px 7.5px rgba(177, 78, 255, 0.5)'
              }}
            >
              {/* Inner energy */}
              <div 
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 40% 40%, rgba(255, 215, 0, 0.15), transparent 70%)`,
                }}
              >
                {/* Energy waves - only animate on client side */}
                {isClient && (
                  <div 
                    className="absolute inset-0 opacity-70"
                    style={{
                      background: `repeating-radial-gradient(circle at 50% 50%, transparent, transparent 15px, rgba(177, 78, 255, 0.1) 15px, rgba(177, 78, 255, 0.1) 20px)`,
                      animation: 'pulse-glow 4s infinite'
                    }}
                  ></div>
                )}
                
                {/* Energy core */}
                <div 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: `${orbEnergy}%`,
                    height: `${orbEnergy}%`,
                    background: 'radial-gradient(circle at 40% 40%, rgba(255, 215, 0, 0.7), rgba(177, 78, 255, 0.7) 70%)',
                    filter: 'blur(5px)',
                    transition: 'all 0.5s ease-in-out'
                  }}
                ></div>
                
                {/* Floating number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span 
                    className={`text-2xl md:text-4xl font-bold text-white tracking-wider ${isClient && animateCounter ? 'scale-110 transition-transform duration-300' : ''}`}
                    style={{
                      textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 215, 0, 0.6)'
                    }}
                  >
                    {formattedPercentage}%
                  </span>
                </div>
                
                {/* Orbiting flame - only show on client side */}
                {isClient && (
                  <div 
                    className="absolute w-6 h-6 flex items-center justify-center"
                    style={{
                      left: '50%',
                      top: '10%',
                      transform: 'translateX(-50%)',
                      animation: 'orbit 10s linear infinite'
                    }}
                  >
                    <span className="text-xl">🔥</span>
                  </div>
                )}
              </div>
              
              {/* Particle effects removed to prevent hydration mismatch */}
              
              {/* Hexagonal energy lines - only animate on client side */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <polygon 
                  points="50,3 100,28 100,72 50,97 3,72 3,28" 
                  fill="none" 
                  stroke="rgba(177, 78, 255, 0.3)" 
                  strokeWidth="0.5"
                  className={isClient ? "energy-flow" : ""}
                />
                <polygon 
                  points="50,15 85,35 85,65 50,85 15,65 15,35" 
                  fill="none" 
                  stroke="rgba(255, 215, 0, 0.3)" 
                  strokeWidth="0.5"
                  className={isClient ? "energy-flow" : ""}
                  style={isClient ? { animationDelay: '0.5s' } : {}}
                />
              </svg>
            </div>
            
            {/* Animated counter below orb */}
            <div className={`text-xl md:text-2xl font-bold text-[#FFD700] tracking-wider ${isClient && animateCounter ? 'scale-110 transition-transform duration-300' : ''}`}>
              {formattedDeadWalletBalance} <span className="text-lg md:text-xl text-orange-500">🔥</span>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-xs md:text-sm mt-4 md:mt-6 text-white/80 relative z-10 font-medium tracking-wide font-['Spectral']">
        Join the Cronos Cards community and contribute to the eternal flame!
      </p>
      
      {/* Keyframes for orbit animation */}
      <style jsx>{`
        @keyframes orbit {
          0% { transform: translateX(-50%) rotate(0deg) translateY(-120%) rotate(0deg); }
          100% { transform: translateX(-50%) rotate(360deg) translateY(-120%) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
};

export default BurnCounter;
