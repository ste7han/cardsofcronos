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
  useERC721AABI,
  getDiscountRate,
  getDiscountedPrice,
  getNextTokenId,
  getProvider,
  getNFTContract,
  ensureABILoaded,
  isWalletConnected,
  getWalletAddress,
  useWalletConnectionStatus,
  useWalletAddress
} from '@/lib/web3';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import LoadingSpinner from '../LoadingSpinner';
import Confetti from './Confetti';

const NFTMintingForm = () => {
  // Initialize with loading state values
  const [price, setPrice] = useState<string>('...');
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [discountedPrice, setDiscountedPrice] = useState<string>('...');
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [nextTokenId, setNextTokenId] = useState<number>(0);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [mintCount, setMintCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  
  // New state variables for tracking fallback usage
  const [usingFallbackPrice, setUsingFallbackPrice] = useState<boolean>(false);
  const [usingFallbackDiscount, setUsingFallbackDiscount] = useState<boolean>(false);
  const [usingFallbackNextId, setUsingFallbackNextId] = useState<boolean>(false);
  const [contractWarning, setContractWarning] = useState<string | null>(null);
  
  // Get wallet provider and connection status from AppKit
  const { walletProvider } = useAppKitProvider('eip155');
  const { open: openAppKit } = useAppKit();
  
  // Use our custom hooks that safely wrap the AppKit hooks
  const isConnected = useWalletConnectionStatus();
  const address = useWalletAddress();
  
  // Get the ABI from our custom hook
  const abi = useERC721AABI();

  // Fetch NFT data when component mounts or wallet connection changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // First ensure ABI is loaded
        console.log('NFTMintingForm: Ensuring ABI is loaded before proceeding');
        try {
          const abi = await ensureABILoaded();
          console.log('NFTMintingForm: ABI loaded successfully, length:', abi.length);
        } catch (abiError) {
          console.error('NFTMintingForm: Error loading ABI:', abiError);
          setError('Failed to load contract ABI. Please refresh the page.');
          return;
        }
        
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
        
        // Check if contract has required functions - updated for new contract
        if (!contractCheck.hasMintPrice || !contractCheck.hasTotalSupply ||
            !contractCheck.hasIsMintPaused || !contractCheck.hasGetDiscountRate) {
          console.warn('NFTMintingForm: Contract missing required functions:', {
            hasMintPrice: contractCheck.hasMintPrice,
            hasTotalSupply: contractCheck.hasTotalSupply,
            hasIsMintPaused: contractCheck.hasIsMintPaused,
            hasGetDiscountRate: contractCheck.hasGetDiscountRate
          });
          
          // Continue with fetching, but log the warning
          document.dispatchEvent(new CustomEvent('debug-log', {
            detail: `Contract missing functions: mintPrice=${contractCheck.hasMintPrice}, totalSupply=${contractCheck.hasTotalSupply}, isMintPaused=${contractCheck.hasIsMintPaused}, getDiscountRate=${contractCheck.hasGetDiscountRate}`
          }));
        }
        
        // Fetch price first and log the result
        console.log('NFTMintingForm: Fetching price...');
        let fetchedPrice;
        try {
          const provider = getProvider();
          const contract = getNFTContract(provider);
          const contractPrice = await contract.mintPrice();
          fetchedPrice = ethers.utils.formatEther(contractPrice);
          console.log('NFTMintingForm: Price fetched from contract directly:', fetchedPrice);
          setPrice(fetchedPrice);
          setUsingFallbackPrice(false);
        } catch (priceError) {
          console.warn('NFTMintingForm: Could not fetch price directly, using fallback:', priceError);
          fetchedPrice = await getNFTPrice();
          console.log('NFTMintingForm: Fallback price:', fetchedPrice);
          setPrice(fetchedPrice);
          setUsingFallbackPrice(true);
          setContractWarning('Some contract functions are not directly accessible. Using fallback values where needed.');
        }
        
        // Fetch total supply and log the result
        console.log('NFTMintingForm: Fetching total supply...');
        const totalSupplyData = await getNFTTotalSupply();
        console.log('NFTMintingForm: Total supply fetched:', totalSupplyData);
        setTotalSupply(totalSupplyData);
        
        // Fetch next token ID (replaces max supply)
        console.log('NFTMintingForm: Fetching next token ID...');
        let fetchedNextId;
        try {
          const provider = getProvider();
          const contract = getNFTContract(provider);
          const directNextId = await contract.nextTokenId();
          console.log('NFTMintingForm: Next token ID fetched directly:', directNextId.toString());
          fetchedNextId = parseInt(directNextId.toString());
          setNextTokenId(fetchedNextId);
          setUsingFallbackNextId(false);
        } catch (tokenIdError) {
          console.warn('NFTMintingForm: Could not fetch next token ID directly, using fallback:', tokenIdError);
          fetchedNextId = await getNextTokenId();
          console.log('NFTMintingForm: Fallback next token ID:', fetchedNextId);
          setNextTokenId(fetchedNextId);
          setUsingFallbackNextId(true);
          setContractWarning('Some contract functions are not directly accessible. Using fallback values where needed.');
        }
        
        // If user is connected, get discount rate and discounted price
        if (isConnected && address) {
          console.log('NFTMintingForm: Fetching discount rate for address:', address);
          try {
            const provider = getProvider();
            const contract = getNFTContract(provider);
            const directDiscount = await contract.getDiscountRate(address);
            console.log('NFTMintingForm: Discount rate fetched directly:', directDiscount.toString());
            setDiscountRate(parseInt(directDiscount.toString()));
            setUsingFallbackDiscount(false);
          } catch (discountError) {
            console.warn('NFTMintingForm: Could not fetch discount directly, using fallback:', discountError);
            const discountRateData = await getDiscountRate(address);
            console.log('NFTMintingForm: Fallback discount rate:', discountRateData);
            setDiscountRate(discountRateData);
            setUsingFallbackDiscount(true);
            setContractWarning('Some contract functions are not directly accessible. Using fallback values where needed.');
          }
          
          console.log('NFTMintingForm: Calculating discounted price...');
          const discountedPriceData = await getDiscountedPrice(address);
          console.log('NFTMintingForm: Discounted price calculated:', discountedPriceData);
          setDiscountedPrice(discountedPriceData);
        }
        console.log('NFTMintingForm: All data fetched successfully:', {
          price: fetchedPrice,
          totalSupply: totalSupplyData,
          nextTokenId: fetchedNextId,
          discountRate: isConnected ? discountRate : 'not connected',
          discountedPrice: isConnected ? discountedPrice : 'not connected'
        });
        
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `Data fetched: price=${fetchedPrice}, totalSupply=${totalSupplyData}, nextTokenId=${fetchedNextId}${isConnected ? ', discountRate=' + discountRate + ', discountedPrice=' + discountedPrice : ''}`
        }));

        // Mark data as loaded
        setDataLoaded(true);
        
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
  }, [isConnected, walletProvider, address, abi, discountRate, discountedPrice]);

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
        
        {contractWarning && !error && (
          <div className="bg-amber-500/20 border border-amber-500/50 text-amber-100 p-4 rounded-md mb-6 shadow-lg animate-fadeIn">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                <span className="font-medium block mb-1">Note: Using Fallback Data</span>
                <p className="text-sm">
                  {contractWarning}
                  {(usingFallbackPrice || usingFallbackDiscount || usingFallbackNextId) && (
                    <span className="block mt-1 text-xs opacity-80">
                      Using fallback for:
                      {usingFallbackPrice ? ' Price' : ''}
                      {usingFallbackDiscount ? ' Discount' : ''}
                      {usingFallbackNextId ? ' TokenID' : ''}
                    </span>
                  )}
                </p>
              </span>
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
        
        {!dataLoaded ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <LoadingSpinner />
            <p className="mt-4 text-white/70">Loading contract data...</p>
            <p className="text-xs mt-2 text-[var(--secondary)]/60">Connecting to contract at {NFT_CONTRACT_ADDRESS.slice(0, 6)}...{NFT_CONTRACT_ADDRESS.slice(-4)}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* NFT Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--cosmic-black)]/60 backdrop-blur-sm p-4 rounded-lg border border-[var(--glass-border)] shadow-inner transition-all duration-300 hover:shadow-[0_0_15px_rgba(157,78,221,0.2)]">
                <p className="text-xs text-[var(--secondary)]/80 mb-1 uppercase tracking-wider font-medium">
                  Price {usingFallbackPrice && <span className="text-amber-400 ml-1">(Estimated)</span>}
                </p>
                <p className="text-xl font-bold text-white">
                  {price} <span className="text-[var(--secondary)]">CRO</span>
                  {discountRate > 0 && (
                    <span className="ml-2 text-sm text-green-400">
                      ({discountRate}% discount {usingFallbackDiscount ? 'est.' : ''})
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-[var(--cosmic-black)]/60 backdrop-blur-sm p-4 rounded-lg border border-[var(--glass-border)] shadow-inner transition-all duration-300 hover:shadow-[0_0_15px_rgba(157,78,221,0.2)]">
                <p className="text-xs text-[var(--secondary)]/80 mb-1 uppercase tracking-wider font-medium">Supply</p>
                <p className="text-xl font-bold text-white">{totalSupply} / 1894</p>
              </div>
            </div>
            
            {/* Supply Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/70">
                <span>
                  Current Token ID
                  {usingFallbackNextId && <span className="text-amber-400 ml-1">(Est.)</span>}
                </span>
                <span>{nextTokenId}</span>
              </div>
              <div className="flex justify-between text-xs text-white/70">
                <span>Total Minted</span>
                <span>{totalSupply}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-full transition-all duration-1000 ease-out"
                  style={{ width: '100%' }}
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
              <p className="text-2xl font-bold text-white">
                {(parseFloat(isConnected && discountRate > 0 ? discountedPrice : price) * mintCount).toFixed(4)}
                <span className="text-[var(--secondary)]">CRO</span>
                {discountRate > 0 && (
                  <span className="ml-2 text-sm text-green-400">({discountRate}% discount applied)</span>
                )}
              </p>
            </div>
            
            {/* Mint Button */}
            <div className="relative group z-10">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-glow)] rounded-md opacity-75 group-hover:opacity-100 blur group-hover:blur-md transition duration-1000"></div>
              {isConnected ? (
                <button
                  onClick={handleMint}
                  disabled={isLoading}
                  className="relative w-full py-4 px-6 bg-[var(--cosmic-black)]/90 text-white font-bold rounded-md hover:bg-[var(--cosmic-black)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 overflow-hidden group-hover:shadow-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center animate-pulse">
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Minting...</span>
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                      Mint {mintCount} NFT{mintCount > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => openAppKit()}
                  className="relative w-full py-4 px-6 bg-[var(--cosmic-black)]/90 text-white font-bold rounded-md hover:bg-[var(--cosmic-black)] transition-all duration-500 overflow-hidden group-hover:shadow-lg"
                >
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect Wallet to Mint
                  </span>
                </button>
              )}
            </div>
            
            {/* Connect Wallet Message */}
            {!isConnected && (
              <div className="text-center text-sm text-white/70 mt-2 p-3 border border-[var(--glass-border)]/30 rounded-lg bg-[var(--cosmic-black)]/30">
                <p className="text-xs mt-1 text-[var(--secondary)]/70">Cronos Chain Required</p>
                <p className="text-xs mt-1 text-green-400">Connect to earn discounts based on your token holdings!</p>
              </div>
            )}
          </div>
        )}
        
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
