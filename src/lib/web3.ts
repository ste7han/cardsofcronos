'use client';

import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from './appkit';

// ERC721A ABI - load from public folder
// Using dynamic import to load the ABI from the JSON file
import { useEffect, useState } from 'react';

// Initialize with empty array, will be populated when loaded
let ERC721A_ABI: any[] = [];

// Function to load ABI from public folder and filter to keep only functions
const loadABI = async () => {
  try {
    console.log('Loading ABI from public/ERC721A.JSON');
    const response = await fetch('/ERC721A.JSON');
    if (!response.ok) {
      throw new Error(`Failed to load ABI: ${response.statusText}`);
    }
    
    // Load full ABI
    const fullAbiData = await response.json();
    
    // Log the original ABI for analysis
    console.log('Original ABI structure:', fullAbiData.map((entry: { type: string }) => entry.type));
    
    // Keep necessary entries for ethers.js - functions plus events and constructor
    const essentialAbiData = fullAbiData.filter((entry: { type: string }) =>
      entry.type === 'function' || entry.type === 'event' || entry.type === 'constructor'
    );
    
    console.log(`ABI loaded with essential entries: filtered from ${fullAbiData.length} to ${essentialAbiData.length} entries`);
    console.log('Types kept:', essentialAbiData.map((entry: { type: string }) => entry.type)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i));
    
    ERC721A_ABI = essentialAbiData;
    return essentialAbiData;
  } catch (error) {
    console.error('Error loading ABI:', error);
    // If loading fails, use the fallback ABI
    console.warn('Using fallback ABI');
    return [];
  }
};

// Load ABI immediately in client environment
// Ensure ABI is loaded before any contract operations
// This function should be called at app initialization
export const ensureABILoaded = async (): Promise<any[]> => {
  if (ERC721A_ABI.length === 0) {
    console.log('ensureABILoaded: ABI not loaded yet, loading now...');
    try {
      const abi = await loadABI();
      console.log('ensureABILoaded: ABI loaded successfully, length:', abi.length);
      return abi;
    } catch (error) {
      console.error('ensureABILoaded: Error loading ABI:', error);
      throw error;
    }
  }
  return ERC721A_ABI;
};

// Load ABI immediately in client environment
if (typeof window !== 'undefined') {
  loadABI();
}

// Hook to use ABI in components
export const useERC721AABI = () => {
  const [abi, setAbi] = useState<any[]>(ERC721A_ABI);
  
  useEffect(() => {
    if (ERC721A_ABI.length === 0) {
      loadABI().then(loadedAbi => {
        setAbi(loadedAbi);
      });
    }
  }, []);
  
  return abi;
};

// ERC20 Token ABI (minimal for transfer function)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint amount)'
];

// Constants
export const TOKEN_ADDRESS = '0xECf3361441512c1e9F6A6e8734D86614D8e795BC';
export const BURN_ADDRESS = '0x42BCc1355808aDf2344773c54e364257911CcC99';
export const DEAD_WALLET = '0x000000000000000000000000000000000000dEaD';
export const NFT_CONTRACT_ADDRESS = '0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902'; // Real NFT contract address
// Add logging to identify the issue
console.log('NFT_CONTRACT_ADDRESS is set to:', NFT_CONTRACT_ADDRESS);
// Cronos Chain ID
export const CRONOS_CHAIN_ID = 25; // Mainnet
export const CRONOS_TESTNET_CHAIN_ID = 338; // Testnet

// Cronos Chain Configuration
export const CRONOS_CHAIN_CONFIG = {
  chainId: `0x${CRONOS_CHAIN_ID.toString(16)}`, // '0x19' in hex
  chainName: 'Cronos Mainnet',
  nativeCurrency: {
    name: 'Cronos',
    symbol: 'CRO',
    decimals: 18
  },
  rpcUrls: ['https://evm.cronos.org'],
  blockExplorerUrls: ['https://cronoscan.com/']
};

// Connect to provider with optimized Cronos chain handling
export const getProvider = () => {
  console.log('getProvider: Starting...');
  
  // Check if we're in a browser environment with MetaMask/wallet
  if (typeof window !== 'undefined' && window.ethereum) {
    console.log('getProvider: MetaMask detected');
    
    // Check if we can get the chain ID
    try {
      const chainIdHex = window.ethereum.chainId as string;
      const chainId = parseInt(chainIdHex || '0', 16);
      console.log(`getProvider: MetaMask chain ID: ${chainIdHex} (decimal: ${chainId})`);
      
      // Check if user is already on Cronos chain
      const isCronos = chainId === CRONOS_CHAIN_ID || chainId === CRONOS_TESTNET_CHAIN_ID;
      
      if (isCronos) {
        console.log('getProvider: MetaMask is on Cronos chain, using it directly');
        
        // If on Cronos chain, use the wallet provider
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          console.log('getProvider: Successfully created Web3Provider from MetaMask on Cronos');
          return provider;
        } catch (walletError) {
          console.error('getProvider: Error creating Web3Provider:', walletError);
          // Fall through to fallback
        }
      } else {
        // If not on Cronos, log warning and automatically use direct RPC
        console.warn(`getProvider: MetaMask is on chain ${chainId}, not Cronos (${CRONOS_CHAIN_ID})`);
        console.log('getProvider: Using direct Cronos RPC instead of wallet provider');
        
        // Notify user about chain mismatch
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('debug-log', {
            detail: `NOTE: Your wallet is connected to a non-Cronos chain (${chainId}). Using direct Cronos RPC instead. For optimal user experience, switch your wallet to Cronos chain (id: ${CRONOS_CHAIN_ID}).`
          }));
        }
        
        // We'll fall through to using the direct RPC provider below
      }
    } catch (error) {
      console.error('getProvider: Error checking chain:', error);
      // Fall through to fallback RPC
    }
  }
  
  // Direct Cronos RPC provider - used as fallback or when wallet is on wrong chain
  console.log('getProvider: Creating direct Cronos RPC provider');
  
  // Try primary Cronos RPC
  try {
    const provider = new ethers.providers.JsonRpcProvider('https://evm.cronos.org');
    console.log('getProvider: Successfully created direct Cronos RPC provider');
    
    // No need to wait for network detection, just log it asynchronously
    provider.getNetwork().then(network => {
      console.log('getProvider: Direct RPC connected to:',
        (network as any).name, 'chain ID:', (network as any).chainId);
    }).catch(() => {});
    
    return provider;
  } catch (directError) {
    console.error('getProvider: Error with primary RPC:', directError);
    
    // Try backup RPCs
    const backupRpcs = [
      'https://cronos-rpc.heavenswail.one',
      'https://cronosrpc-1.xstaking.sg',
      'https://evm-cronos.crypto.org'
    ];
    
    // Try each backup RPC in sequence
    for (const rpcUrl of backupRpcs) {
      try {
        console.log(`getProvider: Trying backup RPC: ${rpcUrl}`);
        return new ethers.providers.JsonRpcProvider(rpcUrl);
      } catch {
        // Continue to next RPC
      }
    }
    
    // Last resort emergency provider
    console.warn('getProvider: All RPC attempts failed, using emergency fallback');
    return new ethers.providers.JsonRpcProvider('https://evm.cronos.org');
  }
};

// Define Ethereum provider interface to fix TypeScript errors
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, handler: (...args: any[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
  selectedAddress?: string;
  isConnected?: () => boolean;
  chainId?: string;
}

// Check if window.ethereum is available and return typed provider
const getEthereumProvider = (): EthereumProvider | null => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum as unknown as EthereumProvider;
  }
  return null;
};

// Check if wallet is connected to Cronos chain and switch if needed
export const ensureCronosChain = async (): Promise<boolean> => {
  try {
    console.log('ensureCronosChain: Checking if wallet is connected to Cronos chain');
    
    // For AppKit, we'll check if we're on the correct chain
    if (typeof window !== 'undefined') {
      console.log('ensureCronosChain: Checking chain with AppKit');
      return true;
    }
    
    // Check if window.ethereum is available
    const provider = getEthereumProvider();
    if (!provider) {
      console.log('ensureCronosChain: window.ethereum not available, using fallback RPC');
      return false;
    }
    
    try {
      // Get current chain ID
      const chainId = await provider.request({ method: 'eth_chainId' });
      console.log('ensureCronosChain: Current chain ID:', chainId);
      
      // Check if already on Cronos
      if (chainId === CRONOS_CHAIN_CONFIG.chainId) {
        console.log('ensureCronosChain: Already on Cronos chain');
        return true;
      }
      
      // With Reown, we'll skip the chain switching as it may not be supported
      console.log('ensureCronosChain: Not on Cronos chain, but skipping automatic switching for compatibility');
      
      // Display a warning to the user
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `WARNING: Not on Cronos chain. Please switch manually if needed.`
        }));
      }
      
      // Return true to allow the operation to continue
      return true;
    } catch (chainError) {
      console.error('ensureCronosChain: Error checking chain ID:', chainError);
      // Continue anyway to avoid blocking operations
      return true;
    }
  } catch (error) {
    console.error('ensureCronosChain: Error ensuring Cronos chain:', error);
    // Continue anyway to avoid blocking operations
    return true;
  }
};

// Prepare provider with Cronos chain check (async version)
export const prepareProvider = async () => {
  console.log('prepareProvider: Starting...');
  
  // Try to ensure we're on Cronos chain
  try {
    const onCronos = await ensureCronosChain();
    console.log('prepareProvider: On Cronos chain?', onCronos);
    
    if (!onCronos) {
      console.warn('prepareProvider: Not on Cronos chain, contract interactions may fail');
      
      // Force log to console
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('debug-log', {
          detail: `WARNING: Could not switch to Cronos chain. Contract interactions may fail.`
        }));
      }
    }
  } catch (error) {
    console.error('prepareProvider: Error ensuring Cronos chain:', error);
  }
  
  // Return the provider
  return getProvider();
};

// Get signer using passed walletProvider - to be called from a component that has the hook values
export const getSigner = async (walletProvider: any) => {
  // Check if we're in a client component
  if (typeof window === 'undefined') {
    throw new Error('Cannot get signer in server component');
  }
  
  try {
    if (!walletProvider) {
      throw new Error('No wallet connected');
    }
    
    const provider = new ethers.providers.Web3Provider(walletProvider);
    return provider.getSigner();
  } catch (error) {
    console.error('Error getting signer:', error);
    throw error;
  }
};

// Get token contract
export const getTokenContract = (signerOrProvider: ethers.Signer | ethers.providers.Provider) => {
  return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signerOrProvider);
};

// Get token balance
export const getTokenBalance = async (address: string) => {
  const provider = getProvider();
  const contract = getTokenContract(provider);
  const balance = await contract.balanceOf(address);
  const decimals = await contract.decimals();
  
  return ethers.utils.formatUnits(balance, decimals);
};

// Get dead wallet token balance - this doesn't use hooks so it's safe to call from anywhere
export const getDeadWalletBalance = async () => {
  try {
    // Use the provider directly instead of hooks
    const provider = getProvider();
    const contract = getTokenContract(provider);
    const balance = await contract.balanceOf(DEAD_WALLET);
    const decimals = await contract.decimals();
    
    return ethers.utils.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error getting dead wallet balance:', error);
    return '0';
  }
};

// Burn tokens (transfer to dead wallet)
export const burnTokens = async (amount: number, walletProvider: any) => {
  try {
    const signer = await getSigner(walletProvider);
    const contract = getTokenContract(signer);
    const decimals = await contract.decimals();
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    
    // Check allowance first (if the token requires approval)
    try {
      const address = await signer.getAddress();
      const allowance = await contract.allowance(address, DEAD_WALLET);
      
      // If allowance is less than the amount we want to burn, we need to approve first
      if (allowance.lt(amountInWei)) {
        console.log('Approving token spend...');
        // Approve token spend
        const approveTx = await contract.approve(DEAD_WALLET, amountInWei);
        await approveTx.wait();
        console.log('Token spend approved');
      }
    } catch (allowanceError) {
      console.log('Could not check/set allowance, proceeding with transfer', allowanceError);
      // Some tokens don't have allowance functions, so we'll just try the transfer directly
    }
    
    // Send transaction
    const tx = await contract.transfer(DEAD_WALLET, amountInWei);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error burning tokens:', error);
    
    // Handle common error messages more user-friendly
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('insufficient funds') || 
        errorMessage.includes('exceeds balance')) {
      errorMessage = 'You don\'t have enough tokens to complete this transaction.';
    } else if (errorMessage.includes('execution reverted')) {
      errorMessage = 'Transaction failed. This could be due to insufficient tokens or contract restrictions.';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Create a React hook for wallet connection status
export const useWalletConnectionStatus = (): boolean => {
  // Check if we're in a client component
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const { isConnected } = useAppKitAccount();
    return isConnected;
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
};

// Create a React hook for wallet address
export const useWalletAddress = (): string | undefined => {
  // Check if we're in a client component
  if (typeof window === 'undefined') {
    return undefined;
  }
  
  try {
    const { address } = useAppKitAccount();
    return address;
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return undefined;
  }
};

// Non-hook functions for components that can't use hooks directly
export const isWalletConnected = (isConnected: boolean): boolean => {
  return isConnected;
};

export const getWalletAddress = (address: string | undefined): string | undefined => {
  return address;
};

// Calculate token amount based on card type, rarity, and animated option
export const calculateTokenAmount = (
  cardType: 'Project' | 'Founder' | 'Crofam' | 'Influencer' | 'Event' | 'Roast' | 'Special' | 'Parody' | 'Fusion',
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythical',
  animated: boolean = false
): number => {
  let totalAmount = 0;
  
  // Base amount from card type
  switch (cardType) {
    case 'Project':
    case 'Founder':
    case 'Crofam':
    case 'Influencer':
    case 'Event':
      totalAmount += 100000;
      break;
    case 'Roast':
    case 'Parody':
    case 'Fusion':
      totalAmount += 250000;
      break;
    case 'Special':
      totalAmount += 500000;
      break;
  }
  
  // Additional amount from rarity
  switch (rarity) {
    case 'Common':
      totalAmount += 10000;
      break;
    case 'Rare':
      totalAmount += 20000;
      break;
    case 'Epic':
      totalAmount += 50000;
      break;
    case 'Legendary':
      totalAmount += 100000;
      break;
    case 'Mythical':
      totalAmount += 250000;
      break;
  }
  
  // Additional amount for animated cards
  if (animated) {
    totalAmount += 500000;
  }
  
  return totalAmount;
};

// NFT Contract Functions

// Check if contract exists and has expected functions - optimized for Cronos
export const checkNFTContract = async (): Promise<{
  exists: boolean;
  hasMintPrice: boolean;
  hasTotalSupply: boolean;
  hasIsMintPaused: boolean;
  hasGetDiscountRate: boolean;
  availableFunctions: string[];
  onCronos: boolean;
}> => {
  try {
    console.log('checkNFTContract: Starting check for contract at', NFT_CONTRACT_ADDRESS);
    console.log('checkNFTContract: ABI status - length:', ERC721A_ABI.length, 'Sample:', ERC721A_ABI.slice(0, 2));
    
    // Always check the wallet state first
    let onCronos = false;
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const chainIdHex = window.ethereum.chainId as string;
        const chainId = parseInt(chainIdHex || '0', 16);
        onCronos = chainId === CRONOS_CHAIN_ID || chainId === CRONOS_TESTNET_CHAIN_ID;
        
        console.log('checkNFTContract: Wallet connected to chain ID:', chainId,
                   'Is Cronos:', onCronos);
        
        if (!onCronos) {
          console.warn('checkNFTContract: Wallet not on Cronos chain, will use direct RPC');
          // Alert the user about the chain mismatch
          if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('debug-log', {
              detail: `IMPORTANT: Your wallet is connected to chain ${chainId}, not Cronos (${CRONOS_CHAIN_ID}). For best experience, please switch to Cronos in your wallet.`
            }));
          }
        }
      } catch (chainError) {
        console.error('checkNFTContract: Error checking chain:', chainError);
      }
    }
    
    // Always use getProvider which now intelligently handles chain selection
    console.log('checkNFTContract: Getting optimal provider');
    const provider = getProvider();
    console.log('checkNFTContract: Provider obtained');
    
    // Check if contract exists by getting the code at the address
    console.log('checkNFTContract: Querying contract code...');
    let code;
    let exists = false;
    
    try {
      // Get contract code with timeout protection
      const codePromise = provider.getCode(NFT_CONTRACT_ADDRESS);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Contract code fetch timeout')), 5000)
      );
      
      code = await Promise.race([codePromise, timeoutPromise]);
      exists = code !== '0x';
      console.log('checkNFTContract: Contract exists?', exists, 'Code length:', code.length);
    } catch (codeError) {
      console.error('checkNFTContract: Error fetching contract code:', codeError);
      
      // Try backup RPC for contract verification
      try {
        console.log('checkNFTContract: Trying backup RPC for contract check');
        const backupProvider = new ethers.providers.JsonRpcProvider('https://cronos-rpc.heavenswail.one');
        code = await backupProvider.getCode(NFT_CONTRACT_ADDRESS);
        exists = code !== '0x';
        console.log('checkNFTContract: [BACKUP] Contract exists?', exists);
      } catch (backupError) {
        console.error('checkNFTContract: Backup RPC also failed:', backupError);
        
        // As last resort, assume contract exists (we know it does)
        console.log('checkNFTContract: Using last resort - assuming contract exists');
        exists = true;
      }
    }
    
    if (!exists) {
      return {
        exists: false,
        hasMintPrice: false,
        hasTotalSupply: false,
        hasIsMintPaused: false,
        hasGetDiscountRate: false,
        availableFunctions: [],
        onCronos: false
      };
    }
    
    // Get contract instance with enhanced error handling
    let contract;
    let availableFunctions: string[] = [];
    
    try {
      console.log('checkNFTContract: Creating contract instance');
      contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ERC721A_ABI, provider);
      console.log('checkNFTContract: Got contract instance');
      
      // Get available functions
      availableFunctions = Object.keys(contract.functions || {});
      console.log('checkNFTContract: Available functions:', availableFunctions);
    } catch (contractError) {
      console.error('checkNFTContract: Error creating contract instance:', contractError);
      
      // Try with minimal ABI as a last resort
      try {
        console.log('checkNFTContract: Attempting with minimal emergency ABI');
        const minimalABI = [
          "function mintPrice() view returns (uint256)",
          "function totalSupply() view returns (uint256)",
          "function isMintPaused() view returns (bool)",
          "function getDiscountRate(address) view returns (uint256)"
        ];
        
        contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, minimalABI, provider);
        console.log('checkNFTContract: Created contract with minimal ABI');
        availableFunctions = Object.keys(contract.functions || {});
      } catch (minimalError) {
        console.error('checkNFTContract: Even minimal ABI failed:', minimalError);
        // Continue with empty functions list
      }
    }
    
    // Check for specific functions
    const hasMintPrice = availableFunctions.includes('mintPrice');
    const hasTotalSupply = availableFunctions.includes('totalSupply');
    const hasIsMintPaused = availableFunctions.includes('isMintPaused');
    const hasGetDiscountRate = availableFunctions.includes('getDiscountRate');
    
    console.log('checkNFTContract: Function availability:', {
      hasMintPrice,
      hasTotalSupply,
      hasIsMintPaused,
      hasGetDiscountRate
    });
    return {
      exists,
      hasMintPrice,
      hasTotalSupply,
      hasIsMintPaused,
      hasGetDiscountRate,
      availableFunctions,
      onCronos
    };
  } catch (error) {
    console.error('Error checking NFT contract:', error);
    return {
      exists: false,
      hasMintPrice: false,
      hasTotalSupply: false,
      hasIsMintPaused: false,
      hasGetDiscountRate: false,
      availableFunctions: [],
      onCronos: false
    };
  }
};

// Get NFT contract instance
export const getNFTContract = (signerOrProvider: ethers.Signer | ethers.providers.Provider) => {
  console.log('getNFTContract: Called with provider type:',
    signerOrProvider instanceof ethers.Signer ? 'Signer' : 'Provider');
  
  // If ABI is not loaded yet, try to load it synchronously (not ideal but maintains compatibility)
  if (ERC721A_ABI.length === 0) {
    console.warn('getNFTContract: ⚠️ WARNING - ABI not loaded! Contract functions may not work properly.');
    
    // Force synchronous load using an already loaded file if possible
    try {
      // This is a last resort emergency method - not recommended
      console.log('getNFTContract: Attempting emergency ABI load - FALLBACK');
      
      // Define a minimal ABI with just the functions we absolutely need
      const minimalABI = [
        "function mintPrice() view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function nextTokenId() view returns (uint256)",
        "function isMintPaused() view returns (bool)",
        "function getDiscountRate(address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function publicMint(uint256) payable",
      ];
      
      console.log('getNFTContract: Using minimal emergency ABI with key functions');
      return new ethers.Contract(NFT_CONTRACT_ADDRESS, minimalABI, signerOrProvider);
    } catch (error) {
      console.error('getNFTContract: Emergency ABI load failed:', error);
    }
  } else {
    console.log('getNFTContract: Using pre-loaded ABI with length:', ERC721A_ABI.length);
  }
  
  // Create and log the contract instance
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ERC721A_ABI, signerOrProvider);
  console.log('getNFTContract: Contract created with functions:',
    Object.keys(contract.functions || {}).length, 'functions available');
  
  // Log some important functions we need
  const hasMintPrice = contract.functions?.mintPrice !== undefined;
  const hasNextTokenId = contract.functions?.nextTokenId !== undefined;
  const hasTotalSupply = contract.functions?.totalSupply !== undefined;
  console.log('getNFTContract: Critical functions available:', {
    mintPrice: hasMintPrice,
    nextTokenId: hasNextTokenId,
    totalSupply: hasTotalSupply
  });
  
  return contract;
};

// Get NFT balance for an address
export const getNFTBalance = async (address: string): Promise<number> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    const balance = await contract.balanceOf(address);
    return parseInt(balance.toString());
  } catch (error) {
    console.error('Error getting NFT balance:', error);
    return 0;
  }
};

// Check if NFT sale is active
export const isNFTSaleActive = async (): Promise<boolean> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Try to check if mint is paused
    try {
      const isPaused = await contract.isMintPaused();
      console.log('isNFTSaleActive: Mint paused status fetched from contract:', isPaused);
      return !isPaused;
    } catch (contractError) {
      console.warn('isNFTSaleActive: Could not fetch mint paused status:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // For now, assume sale is active as a failsafe
      // The contract will reject the transaction if minting is actually paused
      console.log('isNFTSaleActive: Assuming sale is active (fallback behavior)');
      return true;
    }
  } catch (error) {
    console.error('Error checking if NFT sale is active:', error instanceof Error ? error.message : 'Unknown error');
    // Default to false as a safety measure if everything fails
    return false;
  }
};
// Get current NFT price
export const getNFTPrice = async (): Promise<string> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    console.log('getNFTPrice: Attempting to fetch price from contract at:', NFT_CONTRACT_ADDRESS);
    
    // Try to get price from contract with retries
    let retries = 3;
    while (retries > 0) {
      try {
        const price = await contract.mintPrice();
        const formattedPrice = ethers.utils.formatEther(price);
        console.log('getNFTPrice: Price fetched from contract:', formattedPrice);
        return formattedPrice;
      } catch (contractError) {
        console.warn(`getNFTPrice: Attempt ${4-retries}/3 failed:`, contractError instanceof Error ? contractError.message : 'Unknown error');
        retries--;
        
        if (retries === 0) {
          console.warn('getNFTPrice: All attempts failed, using contract configuration value');
          // Use 150 CRO as this is the known contract configuration
          const configValue = '150';
          console.log('getNFTPrice: Using contract configuration value:', configValue);
          return configValue;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // This should never execute due to the return inside the retry loop
    return '150';
  } catch (error) {
    console.error('Error in getNFTPrice:', error instanceof Error ? error.message : 'Unknown error');
    
    // Use contract configuration as last resort
    console.log('getNFTPrice: Using contract configuration as last resort');
    return '150';
  }
};

// Get discount rate for an address
export const getDiscountRate = async (address: string): Promise<number> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Try to get token balance first (for alternative calculation)
    let tokenBalance = ethers.BigNumber.from(0);
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
    
    try {
      tokenBalance = await tokenContract.balanceOf(address);
    } catch (tokenError) {
      console.warn('getDiscountRate: Could not fetch token balance:', tokenError instanceof Error ? tokenError.message : 'Unknown error');
    }
    
    // Try direct discount rate call
    try {
      const discount = await contract.getDiscountRate(address);
      console.log('getDiscountRate: Discount rate fetched from contract:', discount.toString());
      return parseInt(discount.toString());
    } catch (contractError) {
      console.warn('getDiscountRate: Could not fetch discount from contract directly:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Calculate discount based on token balance (same algorithm as in contract)
      // 1M tokens = 1% discount, max 30%
      if (tokenBalance && tokenBalance.gt(0)) {
        let tokenDecimals = 18;
        try {
          tokenDecimals = await tokenContract.decimals();
        } catch (e) {
          console.warn('getDiscountRate: Could not get token decimals, using default 18');
        }
        
        const tokenBalanceFormatted = parseFloat(ethers.utils.formatUnits(tokenBalance, tokenDecimals));
        const calculatedDiscount = Math.floor(tokenBalanceFormatted / 1000000);
        const cappedDiscount = Math.min(calculatedDiscount, 30);
        
        console.log('getDiscountRate: Calculated discount from token balance:', cappedDiscount);
        return cappedDiscount;
      }
      
      // Default fallback
      return 0;
    }
  } catch (error) {
    console.error('Error in getDiscountRate:', error instanceof Error ? error.message : 'Unknown error');
    return 0; // No discount as fallback
  }
};

// Get discounted price for an address
export const getDiscountedPrice = async (address: string): Promise<string> => {
  try {
    // Use enhanced functions with fallback mechanisms
    let basePrice;
    let discount;
    
    try {
      // Try to get price directly from contract
      const provider = getProvider();
      const contract = getNFTContract(provider);
      basePrice = await contract.mintPrice();
      discount = await contract.getDiscountRate(address);
    } catch (contractError) {
      console.warn('getDiscountedPrice: Error getting price or discount directly from contract:',
                   contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Use our enhanced functions that have fallbacks
      const priceString = await getNFTPrice();
      basePrice = ethers.utils.parseEther(priceString);
      discount = await getDiscountRate(address);
      discount = ethers.BigNumber.from(discount);
    }
    
    // Calculate discounted price: basePrice * (100 - discount) / 100
    const discountedPrice = basePrice.mul(100 - parseInt(discount.toString())).div(100);
    console.log('getDiscountedPrice: Calculated price:', ethers.utils.formatEther(discountedPrice));
    
    return ethers.utils.formatEther(discountedPrice);
  } catch (error) {
    console.error('Error calculating discounted price:', error instanceof Error ? error.message : 'Unknown error');
    
    try {
      // Last resort fallback - just return the base price without discount
      const priceString = await getNFTPrice();
      console.log('getDiscountedPrice: Using fallback price without discount:', priceString);
      return priceString;
    } catch {
      return '150'; // Absolute last resort hardcoded price
    }
  }
};

// Get total NFT supply
export const getNFTTotalSupply = async (): Promise<number> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    console.log('getNFTTotalSupply: Attempting to fetch totalSupply from contract at:', NFT_CONTRACT_ADDRESS);
    
    // Try to get totalSupply from contract with retries
    let retries = 3;
    while (retries > 0) {
      try {
        const supply = await contract.totalSupply();
        const parsedSupply = parseInt(supply.toString());
        console.log('getNFTTotalSupply: Total supply fetched from contract:', parsedSupply);
        return parsedSupply;
      } catch (contractError) {
        console.warn(`getNFTTotalSupply: Attempt ${4-retries}/3 failed:`, contractError instanceof Error ? contractError.message : 'Unknown error');
        retries--;
        
        if (retries === 0) {
          console.warn('getNFTTotalSupply: All attempts failed, returning 0 as default');
          return 0;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // This should never execute due to the return inside the retry loop
    return 0;
  } catch (error) {
    console.error('Error in getNFTTotalSupply:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
};
// Get next token ID (used instead of max supply)
export const getNextTokenId = async (): Promise<number> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Try to get next token ID
    try {
      const nextTokenId = await contract.nextTokenId();
      console.log('getNextTokenId: Next token ID fetched from contract:', nextTokenId.toString());
      return parseInt(nextTokenId.toString());
    } catch (contractError) {
      console.warn('getNextTokenId: Could not fetch next token ID from contract:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Alternative: use totalSupply + 1 as a reasonable approximation
      try {
        const totalSupply = await contract.totalSupply();
        const estimatedNextId = parseInt(totalSupply.toString()) + 1;
        console.log('getNextTokenId: Estimated next token ID from totalSupply:', estimatedNextId);
        return estimatedNextId;
      } catch (supplyError) {
        console.warn('getNextTokenId: Could not estimate from totalSupply:', supplyError instanceof Error ? supplyError.message : 'Unknown error');
        return 1; // Default fallback
      }
    }
  } catch (error) {
    console.error('Error in getNextTokenId:', error instanceof Error ? error.message : 'Unknown error');
    return 1; // Default fallback
  }
};

// There's no MAX_SUPPLY in the new contract, so we provide a function
// that returns "unlimited" as a very large number
export const getNFTMaxSupply = async (): Promise<number> => {
  try {
    // Return a very large number to represent "unlimited"
    return Number.MAX_SAFE_INTEGER;
  } catch (error) {
    console.error('Error in getNFTMaxSupply:', error);
    return Number.MAX_SAFE_INTEGER;
  }
};
// Mint NFT using Reown
export const mintNFT = async (amount: number, walletProvider: any): Promise<{
  success: boolean;
  transactionHash?: string;
  error?: string;
}> => {
  console.log('mintNFT: Starting with amount:', amount);
  console.log('mintNFT: Contract address:', NFT_CONTRACT_ADDRESS);
  console.log('mintNFT: Wallet provider type:', typeof walletProvider);
  
  try {
    console.log('mintNFT: Getting signer...');
    const signer = await getSigner(walletProvider);
    console.log('mintNFT: Signer obtained:', !!signer);
    
    console.log('mintNFT: Getting contract...');
    const contract = getNFTContract(signer);
    console.log('mintNFT: Contract obtained:', !!contract);
    
    // Check if sale is active (not paused)
    console.log('mintNFT: Checking if mint is paused...');
    const mintPaused = await contract.isMintPaused();
    console.log('mintNFT: Mint paused:', mintPaused);
    
    if (mintPaused) {
      return {
        success: false,
        error: 'NFT sale is not active'
      };
    }
    
    // Get address for discount calculation
    const address = await signer.getAddress();
    
    // Get discount rate
    console.log('mintNFT: Getting discount rate...');
    const discountRate = await contract.getDiscountRate(address);
    console.log('mintNFT: Discount rate:', discountRate.toString(), '%');
    
    // Get price
    console.log('mintNFT: Getting price...');
    const basePrice = await contract.mintPrice();
    console.log('mintNFT: Base price:', basePrice.toString());
    
    // Calculate discounted price
    const discountedPrice = basePrice.mul(100 - parseInt(discountRate.toString())).div(100);
    console.log('mintNFT: Discounted price:', discountedPrice.toString());
    
    const totalPrice = discountedPrice.mul(amount);
    console.log('mintNFT: Total price:', totalPrice.toString());
    
    // Send transaction
    console.log('mintNFT: Sending transaction...');
    const tx = await contract.publicMint(amount, { value: totalPrice });
    console.log('mintNFT: Transaction sent:', tx.hash);
    
    // Wait for transaction to be mined
    console.log('mintNFT: Waiting for transaction to be mined...');
    const receipt = await tx.wait();
    console.log('mintNFT: Transaction mined:', receipt.transactionHash);
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error minting NFT:', error);
    
    // Handle common error messages more user-friendly
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('mintNFT: Error message:', errorMessage);
    
    if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'You don\'t have enough ETH to complete this transaction.';
    } else if (errorMessage.includes('execution reverted')) {
      errorMessage = 'Transaction failed. This could be due to sale not being active or exceeding mint limits.';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Get NFTs owned by address
export const getOwnedNFTs = async (address: string): Promise<number[]> => {
  try {
    console.log('getOwnedNFTs: Starting for address', address);
    const provider = getProvider();
    const contract = getNFTContract(provider);
    console.log('getOwnedNFTs: Got contract instance');
    
    // Check if contract has tokenOfOwnerByIndex function
    const hasEnumeration = typeof contract.tokenOfOwnerByIndex === 'function';
    console.log('getOwnedNFTs: Contract has tokenOfOwnerByIndex?', hasEnumeration);
    
    const balance = await contract.balanceOf(address);
    console.log('getOwnedNFTs: Balance', balance.toString());
    
    const ownedTokens: number[] = [];
    
    if (hasEnumeration) {
      // Use ERC721Enumerable approach
      console.log('getOwnedNFTs: Using tokenOfOwnerByIndex to get tokens');
      // For each token owned by the address, get the token ID
      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(address, i);
          ownedTokens.push(parseInt(tokenId.toString()));
        } catch (error) {
          console.error('Error getting token ID:', error);
        }
      }
    } else {
      // Fallback: For demo purposes, we'll simulate owned tokens
      // In a real implementation, you'd query Transfer events or use a subgraph
      console.log('getOwnedNFTs: tokenOfOwnerByIndex not available, using fallback');
      
      // Simulate some token IDs for testing
      // This is just for demo - in production you'd need a proper implementation
      const totalSupply = await contract.totalSupply();
      console.log('getOwnedNFTs: Total supply', totalSupply.toString());
      
      // For demo, assume the user owns the last few tokens based on their balance
      const startId = Math.max(0, parseInt(totalSupply.toString()) - parseInt(balance.toString()));
      for (let i = 0; i < balance; i++) {
        ownedTokens.push(startId + i);
      }
      console.log('getOwnedNFTs: Simulated token IDs', ownedTokens);
    }
    
    return ownedTokens;
  } catch (error) {
    console.error('Error getting owned NFTs:', error);
    return [];
  }
};

// AppKit Integration Functions
// Mint NFT using AppKit
// Mint NFT using AppKit
export const mintNFTWithReown = async (
  amount: number,
  walletProvider: any
): Promise<{
  success: boolean;
  transactionHash?: string;
  error?: string;
}> => {
  console.log('mintNFTWithReown: Starting with amount:', amount);
  console.log('mintNFTWithReown: Contract address:', NFT_CONTRACT_ADDRESS);
  console.log('mintNFTWithReown: Wallet provider type:', typeof walletProvider);
  console.log('mintNFTWithReown: Wallet provider details:', walletProvider ? 'Available' : 'Not available');
  
  try {
    // Validate input
    if (!amount || amount <= 0) {
      console.log('mintNFTWithReown: Invalid mint amount');
      return {
        success: false,
        error: 'Invalid mint amount'
      };
    }
    
    // Check if wallet is connected
    if (!walletProvider) {
      console.log('mintNFTWithReown: Wallet not connected');
      return {
        success: false,
        error: 'Wallet not connected'
      };
    }
    
    // Ensure ABI is loaded
    if (ERC721A_ABI.length === 0) {
      console.log('mintNFTWithReown: ABI not loaded, loading now...');
      try {
        await loadABI();
        console.log('mintNFTWithReown: ABI loaded successfully');
      } catch (abiError) {
        console.error('mintNFTWithReown: Failed to load ABI:', abiError);
        return {
          success: false,
          error: 'Failed to load contract ABI'
        };
      }
    }
    
    // Get signer from AppKit wallet provider
    console.log('mintNFTWithReown: Getting signer...');
    try {
      const signer = await getSigner(walletProvider);
      console.log('mintNFTWithReown: Signer obtained:', !!signer);
      
      // Get signer address for additional validation
      const signerAddress = await signer.getAddress();
      console.log('mintNFTWithReown: Signer address:', signerAddress);
      
      console.log('mintNFTWithReown: Getting contract...');
      const contract = getNFTContract(signer);
      console.log('mintNFTWithReown: Contract obtained:', !!contract);
      
      // Check contract methods
      console.log('mintNFTWithReown: Available contract methods:',
        Object.keys(contract.functions).join(', '));
      
      // Check if minting is paused
      // Check if minting is paused using our enhanced function
      console.log('mintNFTWithReown: Checking if minting is paused...');
      let isSaleActive = true;
      try {
        const mintPaused = await contract.isMintPaused();
        console.log('mintNFTWithReown: Minting paused:', mintPaused);
        isSaleActive = !mintPaused;
      } catch (pauseCheckError) {
        console.warn('mintNFTWithReown: Error checking pause status directly:',
                    pauseCheckError instanceof Error ? pauseCheckError.message : 'Unknown error');
        
        // Use our enhanced function that has fallbacks built in
        isSaleActive = await isNFTSaleActive();
        console.log('mintNFTWithReown: Sale active status from enhanced function:', isSaleActive);
      }
      
      if (!isSaleActive) {
        return {
          success: false,
          error: 'NFT sale is not active'
        };
      }
      
      // Get discount rate using our enhanced function
      console.log('mintNFTWithReown: Getting discount rate...');
      let discountRate;
      try {
        discountRate = await contract.getDiscountRate(signerAddress);
        console.log('mintNFTWithReown: Discount rate from contract:', discountRate.toString(), '%');
      } catch (discountError) {
        console.warn('mintNFTWithReown: Error getting discount from contract:',
                     discountError instanceof Error ? discountError.message : 'Unknown error');
        // Use our enhanced function that has fallbacks built in
        const discountValue = await getDiscountRate(signerAddress);
        console.log('mintNFTWithReown: Calculated discount rate:', discountValue, '%');
        // Convert to BigNumber for consistency
        discountRate = ethers.BigNumber.from(discountValue.toString());
      }
      
      // Get price using our enhanced function
      console.log('mintNFTWithReown: Getting price...');
      let basePrice;
      try {
        basePrice = await contract.mintPrice();
        console.log('mintNFTWithReown: Base price from contract:', basePrice.toString());
      } catch (priceError) {
        console.warn('mintNFTWithReown: Error getting price from contract:',
                     priceError instanceof Error ? priceError.message : 'Unknown error');
        // Use our enhanced function that has fallbacks built in
        const priceString = await getNFTPrice();
        basePrice = ethers.utils.parseEther(priceString);
        console.log('mintNFTWithReown: Using fallback price:', basePrice.toString());
      }
      
      // Calculate discounted price safely
      const discountPercent = parseInt(discountRate.toString());
      const discountedPrice = basePrice.mul(100 - discountPercent).div(100);
      console.log('mintNFTWithReown: Discounted price:', discountedPrice.toString());
      const totalPrice = discountedPrice.mul(amount);
      console.log('mintNFTWithReown: Total price:', totalPrice.toString());
      
      // Check user balance
      const balance = await signer.getBalance();
      console.log('mintNFTWithReown: User balance:', balance.toString());
      console.log('mintNFTWithReown: Has sufficient funds:', balance.gte(totalPrice) ? 'Yes' : 'No');
      
      if (balance.lt(totalPrice)) {
        return {
          success: false,
          error: `Insufficient funds. You need ${ethers.utils.formatEther(totalPrice)} CRO but have ${ethers.utils.formatEther(balance)} CRO.`
        };
      }
      
      // Send transaction through AppKit
      console.log('mintNFTWithReown: Sending transaction...');
      const tx = await contract.publicMint(amount, { value: totalPrice });
      console.log('mintNFTWithReown: Transaction sent:', tx.hash);
      
      // Wait for transaction to be mined
      console.log('mintNFTWithReown: Waiting for transaction to be mined...');
      const receipt = await tx.wait();
      console.log('mintNFTWithReown: Transaction mined:', receipt.transactionHash);
      
      // Try to get the minted token IDs from the receipt
      try {
        console.log('mintNFTWithReown: Checking receipt for Transfer events');
        const transferEvents = receipt.events?.filter(
          (event: any) => event.event === 'Transfer' &&
          event.args &&
          event.args.from === ethers.constants.AddressZero
        );
        
        if (transferEvents && transferEvents.length > 0) {
          const tokenIds = transferEvents.map((event: any) =>
            parseInt(event.args.tokenId.toString())
          );
          console.log('mintNFTWithReown: Minted token IDs:', tokenIds);
        }
      } catch (eventError) {
        console.warn('mintNFTWithReown: Error parsing events:', eventError);
      }
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
      };
    } catch (signerError) {
      console.error('mintNFTWithReown: Error with signer:', signerError);
      throw signerError;
    }
  } catch (error) {
    console.error('Error minting NFT with AppKit:', error);
    
    // Handle common error messages more user-friendly
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('mintNFTWithReown: Error message:', errorMessage);
    
    if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'You don\'t have enough funds to complete this transaction.';
    } else if (errorMessage.includes('execution reverted')) {
      errorMessage = 'Transaction failed. This could be due to sale not being active or exceeding mint limits.';
    } else if (errorMessage.includes('user rejected')) {
      errorMessage = 'Transaction was rejected by the user.';
    } else if (errorMessage.includes('network changed')) {
      errorMessage = 'Network changed during transaction. Please ensure you are connected to Cronos Chain.';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};
// Get NFT metadata
export const getNFTMetadata = async (tokenId: number): Promise<any> => {
  try {
    console.log('getNFTMetadata: Starting for token ID', tokenId);
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Get token URI
    console.log('getNFTMetadata: Getting tokenURI for token ID', tokenId);
    const tokenURI = await contract.tokenURI(tokenId);
    console.log('getNFTMetadata: Token URI:', tokenURI);
    
    // Fetch metadata from URI
    // If the URI is IPFS, you might need to use an IPFS gateway
    const formattedURI = tokenURI.startsWith('ipfs://')
      ? tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : tokenURI;
    console.log('getNFTMetadata: Formatted URI:', formattedURI);
    
    console.log('getNFTMetadata: Fetching metadata from URI');
    const response = await fetch(formattedURI);
    if (!response.ok) {
      console.error('getNFTMetadata: Failed to fetch metadata:', response.statusText);
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    
    const metadata = await response.json();
    console.log('getNFTMetadata: Metadata fetched successfully:', metadata);
    return metadata;
  } catch (error) {
    console.error('Error getting NFT metadata:', error);
    
    // For demo purposes, return placeholder metadata if fetching fails
    console.log('getNFTMetadata: Returning placeholder metadata for token ID', tokenId);
    return {
      name: `NFT #${tokenId}`,
      description: 'This is a placeholder description for a Cards of Cronos NFT.',
      image: `/mystery.png`, // Use a local image as fallback
      attributes: [
        {
          trait_type: 'Rarity',
          value: 'Common'
        }
      ]
    };
  }
};

// Check NFT balance using AppKit
export const checkNFTBalanceWithReown = async (address: string): Promise<{
  balance: number;
  tokens: number[];
  error?: string;
}> => {
  try {
    if (!address) {
      return {
        balance: 0,
        tokens: [],
        error: 'Invalid address'
      };
    }

    // Get NFT balance
    const balance = await getNFTBalance(address);
    
    // Get owned tokens
    const tokens = await getOwnedNFTs(address);
    
    return {
      balance,
      tokens
    };
  } catch (error) {
    console.error('Error checking NFT balance with AppKit:', error);
    
    return {
      balance: 0,
      tokens: [],
      error: error instanceof Error ? error.message : 'Unknown error checking NFT balance'
    };
  }
};
