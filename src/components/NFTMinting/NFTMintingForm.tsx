'use client';

import { useState, useEffect } from 'react';
import {
  mintNFTWithReown,
  getNFTPrice,
  getNFTTotalSupply,
  getNFTMaxSupply,
  getOwnedNFTs,
  prepareProvider,
  checkNFTContract,
  NFT_CONTRACT_ADDRESS,
  useERC721AABI
} from '@/lib/web3';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import LoadingSpinner from '../LoadingSpinner';
import Confetti from './Confetti';

const NFTMintingForm = () => {
  // Initialize with default values to ensure UI shows something
  const [price, setPrice] = useState<string>('0.5');
  const [totalSupply, setTotalSupply] = useState<number>(150);
  const [maxSupply, setMaxSupply] = useState<number>(1000);
  const [mintCount, setMintCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  
  // Get wallet provider and connection status from AppKit
  const { walletProvider } = useAppKitProvider('eip155');
  const { isConnected, address } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();
  
  // Get the ABI from our custom hook
  const abi = useERC721AABI();

  // Fetch NFT data when component mounts or wallet connection changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Force log to console directly
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `NFTMintingForm fetchData started at ${new Date().toISOString()}`
        }));
        
        console.log('NFTMintingForm: Fetching NFT data...');
        console.log('NFTMintingForm: Contract address:', NFT_CONTRACT_ADDRESS);
        console.log('NFTMintingForm: Wallet connected:', isConnected);
        console.log('NFTMintingForm: Wallet provider available:', !!walletProvider);
        console.log('NFTMintingForm: Wallet provider type:', typeof walletProvider);
        console.log('NFTMintingForm: Wallet address:', address || 'Not available');
        console.log('NFTMintingForm: ABI loaded:', abi.length > 0 ? 'Yes' : 'No');
        
        // Ensure we're on the Cronos chain before proceeding
        if (isConnected && walletProvider) {
          console.log('NFTMintingForm: Preparing provider and ensuring Cronos chain...');
          try {
            await prepareProvider();
            console.log('NFTMintingForm: Provider prepared');
            
            document.dispatchEvent(new CustomEvent('debug-log', {
              detail: `Provider prepared, Cronos chain check completed`
            }));
          } catch (chainError) {
            console.error('NFTMintingForm: Error preparing provider:', chainError);
            document.dispatchEvent(new CustomEvent('debug-log', {
              detail: `Error preparing provider: ${chainError instanceof Error ? chainError.message : 'Unknown error'}`
            }));
          }
        }
        
        // First check if the contract exists and has the expected functions
        console.log('NFTMintingForm: Checking contract...');
        const contractCheck = await checkNFTContract();
        console.log('NFTMintingForm: Contract check result:', contractCheck);
        
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `Contract check result: ${JSON.stringify(contractCheck)}`
        }));
        
        if (!contractCheck.exists) {
          console.error('NFTMintingForm: Contract does not exist at address', NFT_CONTRACT_ADDRESS);
          setError(`Contract not found at address ${NFT_CONTRACT_ADDRESS}. Please make sure you're connected to the Cronos chain.`);
          return;
        }
        
        // Check if contract has required functions
        if (!contractCheck.hasCurrentPrice || !contractCheck.hasTotalSupply || !contractCheck.hasMaxSupply) {
          console.warn('NFTMintingForm: Contract missing required functions:', {
            hasCurrentPrice: contractCheck.hasCurrentPrice,
            hasTotalSupply: contractCheck.hasTotalSupply,
            hasMaxSupply: contractCheck.hasMaxSupply
          });
          
          // Continue with fetching, but log the warning
          document.dispatchEvent(new CustomEvent('debug-log', {
            detail: `Contract missing functions: currentPrice=${contractCheck.hasCurrentPrice}, totalSupply=${contractCheck.hasTotalSupply}, MAX_SUPPLY=${contractCheck.hasMaxSupply}`
          }));
        }
        
        // Fetch price first and log the result
        console.log('NFTMintingForm: Fetching price...');
        const priceData = await getNFTPrice();
        console.log('NFTMintingForm: Price fetched:', priceData);
        setPrice(priceData);
        
        // Fetch total supply and log the result
        console.log('NFTMintingForm: Fetching total supply...');
        const totalSupplyData = await getNFTTotalSupply();
        console.log('NFTMintingForm: Total supply fetched:', totalSupplyData);
        setTotalSupply(totalSupplyData);
        
        // Fetch max supply and log the result
        console.log('NFTMintingForm: Fetching max supply...');
        const maxSupplyData = await getNFTMaxSupply();
        console.log('NFTMintingForm: Max supply fetched:', maxSupplyData);
        setMaxSupply(maxSupplyData);
        
        console.log('NFTMintingForm: All data fetched successfully:', {
          price: priceData,
          totalSupply: totalSupplyData,
          maxSupply: maxSupplyData
        });
        
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `Data fetched: price=${priceData}, totalSupply=${totalSupplyData}, maxSupply=${maxSupplyData}`
        }));
        
      } catch (err) {
        console.error('NFTMintingForm: Error fetching data:', err);
        setError('Failed to load NFT data. Please refresh the page.');
        
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `Error fetching NFT data: ${err instanceof Error ? err.message : 'Unknown error'}`
        }));
      }
    };

    console.log('NFTMintingForm: useEffect TRIGGERED with deps:', { isConnected, walletProvider, address, abiLoaded: abi.length > 0 });
    document.dispatchEvent(new CustomEvent('debug-log', {
      detail: `NFTMintingForm useEffect triggered at ${new Date().toISOString()}`
    }));
    
    fetchData();
    
    // Set up an interval to refresh the data every 30 seconds
    console.log('NFTMintingForm: Setting up refresh interval');
    const intervalId = setInterval(() => {
      console.log('NFTMintingForm: Calling fetchData()');
      fetchData();
    }, 30000);
    
    // Clean up the interval when the component unmounts
    return () => {
      console.log('NFTMintingForm: Cleaning up interval');
      clearInterval(intervalId);
    };
  }, [isConnected, walletProvider, address, abi]);

  const handleMint = async () => {
    console.log('NFTMintingForm: handleMint called with mintCount:', mintCount);
    document.dispatchEvent(new CustomEvent('debug-log', {
      detail: `Mint initiated for ${mintCount} NFT(s)`
    }));
    
    if (!isConnected || !walletProvider) {
      console.log('NFTMintingForm: Wallet not connected');
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setTransactionHash(null);
    
    try {
      // Ensure we're on Cronos chain before minting
      console.log('NFTMintingForm: Preparing provider before minting');
      await prepareProvider();
      
      // Check if ABI is loaded
      if (abi.length === 0) {
        console.log('NFTMintingForm: ABI not loaded, cannot proceed with minting');
        setError('Contract ABI not loaded. Please refresh the page and try again.');
        return;
      }
      
      console.log('NFTMintingForm: Calling mintNFTWithReown with amount:', mintCount);
      const result = await mintNFTWithReown(mintCount, walletProvider);
      console.log('NFTMintingForm: Mint result:', result);
      
      document.dispatchEvent(new CustomEvent('debug-log', {
        detail: `Mint result: ${JSON.stringify(result)}`
      }));
      
      if (result.success) {
        console.log('NFTMintingForm: Mint successful');
        setSuccess(true);
        setTransactionHash(result.transactionHash || null);
        
        // Refresh the supply count after successful mint
        console.log('NFTMintingForm: Refreshing total supply');
        const newTotalSupply = await getNFTTotalSupply();
        console.log('NFTMintingForm: New total supply:', newTotalSupply);
        setTotalSupply(newTotalSupply);
        
        // Show confetti effect
        console.log('NFTMintingForm: Showing confetti');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
        
        // Get the minted token ID
        if (address) {
          try {
            console.log('NFTMintingForm: Getting owned NFTs for address:', address);
            const ownedTokens = await getOwnedNFTs(address);
            console.log('NFTMintingForm: Owned tokens:', ownedTokens);
            
            if (ownedTokens.length > 0) {
              const latestToken = ownedTokens[ownedTokens.length - 1];
              console.log('NFTMintingForm: Setting minted token ID:', latestToken);
              setMintedTokenId(latestToken);
            }
          } catch (err) {
            console.warn('NFTMintingForm: Error getting owned tokens:', err);
            // Silently handle error getting token ID
          }
        }
      } else {
        console.error('NFTMintingForm: Mint failed with error:', result.error);
        setError(result.error || 'Minting failed. Please try again.');
        
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `Mint failed: ${result.error || 'Unknown error'}`
        }));
      }
    } catch (err) {
      console.error('NFTMintingForm: Error during minting:', err);
      setError('An error occurred during minting. Please try again.');
      
      document.dispatchEvent(new CustomEvent('debug-log', {
        detail: `Mint error: ${err instanceof Error ? err.message : 'Unknown error'}`
      }));
    } finally {
      console.log('NFTMintingForm: Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const decrementCount = () => {
    if (mintCount > 1) {
      setMintCount(mintCount - 1);
    }
  };

  const incrementCount = () => {
    setMintCount(mintCount + 1);
  };

  return (
    <div className="space-y-8">
      {/* Confetti effect */}
      <Confetti active={showConfetti} />
      
      <div className="arcane-border glass-card p-6 md:p-8 max-w-md mx-auto relative overflow-hidden transition-all duration-500 transform hover:shadow-[0_0_25px_rgba(157,78,221,0.3)] bg-[var(--cosmic-black)]/80 backdrop-blur-md">
        {/* Decorative arcane overlay */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none bg-gradient-to-br from-[var(--cosmic-black)]/90 to-[#3A0CA3]/30">
          {/* Arcane circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full border border-[#9D4EDD]/10 opacity-30"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] rounded-full border border-[#FFD700]/10 opacity-30"></div>
          
          {/* Magical energy lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,100" stroke="rgba(157, 78, 221, 0.1)" strokeWidth="0.2" />
            <path d="M100,0 L0,100" stroke="rgba(157, 78, 221, 0.1)" strokeWidth="0.2" />
          </svg>
        </div>
        
        {/* Magical book binding */}
        <div className="absolute left-0 top-0 bottom-0 w-2 sm:w-4 bg-gradient-to-r from-[#3A0CA3] to-transparent opacity-70"></div>
        
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center font-['Cinzel'] relative inline-block w-full">
          <span className="relative">
            Mint Your NFT
            <div className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--primary-glow)]/70 to-transparent"></div>
          </span>
        </h2>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-4 rounded-md mb-6 shadow-lg animate-fadeIn">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-100 p-4 rounded-md mb-6 shadow-lg animate-fadeIn">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 mr-2 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Successfully minted {mintCount} NFT{mintCount > 1 ? 's' : ''}!</span>
            </div>
            {transactionHash && (
              <div className="mt-2 text-sm bg-black/30 p-3 rounded border border-green-500/30">
                <p className="mb-1 text-green-300/80">Transaction:</p>
                <a
                  href={`https://cronoscan.com/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--secondary)] hover:text-[var(--secondary)]/80 transition-colors break-all"
                >
                  {transactionHash}
                </a>
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-8">
          {/* NFT Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--cosmic-black)]/60 backdrop-blur-sm p-4 rounded-lg border border-[var(--glass-border)] shadow-inner transition-all duration-300 hover:shadow-[0_0_15px_rgba(157,78,221,0.2)]">
              <p className="text-xs text-[var(--secondary)]/80 mb-1 uppercase tracking-wider font-medium">Price</p>
              <p className="text-xl font-bold text-white">{price} <span className="text-[var(--secondary)]">CRO</span></p>
            </div>
            <div className="bg-[var(--cosmic-black)]/60 backdrop-blur-sm p-4 rounded-lg border border-[var(--glass-border)] shadow-inner transition-all duration-300 hover:shadow-[0_0_15px_rgba(157,78,221,0.2)]">
              <p className="text-xs text-[var(--secondary)]/80 mb-1 uppercase tracking-wider font-medium">Supply</p>
              <p className="text-xl font-bold text-white">{totalSupply} / {maxSupply}</p>
            </div>
          </div>
          
          {/* Supply Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/70">
              <span>Total Minted</span>
              <span>{Math.round((totalSupply / maxSupply) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${(totalSupply / maxSupply) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {/* Mint Count Selector */}
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={decrementCount}
              disabled={mintCount <= 1 || isLoading}
              className="w-12 h-12 rounded-full bg-[var(--cosmic-black)]/80 text-white flex items-center justify-center border border-[var(--glass-border)] hover:bg-[var(--cosmic-black)] hover:shadow-[0_0_10px_rgba(157,78,221,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-95"
              aria-label="Decrease mint count"
            >
              <span className="text-2xl">-</span>
            </button>
            
            <div className="text-3xl font-bold text-white w-16 text-center">{mintCount}</div>
            
            <button
              onClick={incrementCount}
              disabled={isLoading}
              className="w-12 h-12 rounded-full bg-[var(--cosmic-black)]/80 text-white flex items-center justify-center border border-[var(--glass-border)] hover:bg-[var(--cosmic-black)] hover:shadow-[0_0_10px_rgba(157,78,221,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-95"
              aria-label="Increase mint count"
            >
              <span className="text-2xl">+</span>
            </button>
          </div>
          
          {/* Total Price */}
          <div className="text-center bg-[var(--cosmic-black)]/40 p-4 rounded-lg border border-[var(--glass-border)]/50">
            <p className="text-sm text-[var(--secondary)]/80 uppercase tracking-wider font-medium mb-1">Total Price</p>
            <p className="text-2xl font-bold text-white">{(parseFloat(price) * mintCount).toFixed(4)} <span className="text-[var(--secondary)]">CRO</span></p>
          </div>
          
          {/* Mint Button */}
          <div className="relative group z-10">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-md opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition duration-1000"></div>
            <button
              onClick={handleMint}
              disabled={isLoading || !isConnected}
              className="relative w-full py-4 px-6 bg-[var(--cosmic-black)]/90 text-white font-bold rounded-md hover:bg-[var(--cosmic-black)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 overflow-hidden group-hover:shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center animate-pulse">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Minting...</span>
                </div>
              ) : !isConnected ? (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Connect Wallet to Mint
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  Mint {mintCount} NFT{mintCount > 1 ? 's' : ''}
                </span>
              )}
            </button>
          </div>
          
          {/* Connect Wallet Message */}
          {!isConnected && (
            <div className="text-center text-sm text-white/70 mt-2 p-3 border border-[var(--glass-border)]/30 rounded-lg bg-[var(--cosmic-black)]/30">
              <p>Please connect your wallet using the button in the header</p>
              <p className="text-xs mt-1 text-[var(--secondary)]/70">Cronos Chain Required</p>
            </div>
          )}
        </div>
        
        {/* Add keyframes for animations */}
        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-out forwards;
          }
        `}</style>
      </div>
    </div>
  );
};

export default NFTMintingForm;