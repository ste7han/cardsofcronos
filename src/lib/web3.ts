'use client';

import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from './appkit';

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

// Connect to provider
export const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.providers.Web3Provider(window.ethereum);
  }
  
  // Fallback to Cronos RPC
  return new ethers.providers.JsonRpcProvider('https://evm.cronos.org');
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

// Check if wallet is connected using AppKit - this function should only be called from within a React component
export const isWalletConnected = (): boolean => {
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

// Get connected wallet address using AppKit - this function should only be called from within a React component
export const getWalletAddress = (): string | undefined => {
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
