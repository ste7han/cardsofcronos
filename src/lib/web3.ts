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

// Get signer using AppKit - this function should only be called from within a React component
export const getSigner = async () => {
  // Check if we're in a client component
  if (typeof window === 'undefined') {
    throw new Error('Cannot get signer in server component');
  }
  
  try {
    // Get the wallet provider from AppKit - passing 'eip155' as the chainNamespace parameter
    const { walletProvider } = useAppKitProvider('eip155');
    const { address } = useAppKitAccount();
    
    if (!walletProvider || !address) {
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

// Burn tokens (transfer to burn address)
export const burnTokens = async (amount: number) => {
  try {
    const signer = await getSigner();
    const contract = getTokenContract(signer);
    const decimals = await contract.decimals();
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    
    // Send transaction
    const tx = await contract.transfer(BURN_ADDRESS, amountInWei);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error burning tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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

// Calculate token amount based on card type and rarity
export const calculateTokenAmount = (
  cardType: 'Project' | 'Roast' | 'Influencer' | 'Special',
  rarity: 'Epic' | 'Rare' | 'Mythical'
): number => {
  let baseAmount = 0;
  
  // Base amount from card type
  switch (cardType) {
    case 'Project':
      baseAmount = 100000;
      break;
    case 'Roast':
      baseAmount = 250000;
      break;
    case 'Influencer':
      baseAmount = 100000;
      break;
    case 'Special':
      baseAmount = 500000;
      break;
  }
  
  // Additional amount from rarity
  switch (rarity) {
    case 'Epic':
      baseAmount += 50000;
      break;
    case 'Rare':
      baseAmount += 20000;
      break;
    case 'Mythical':
      baseAmount += 250000;
      break;
  }
  
  return baseAmount;
};
