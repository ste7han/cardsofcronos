// Web3.ts Patch for NFT Minting Implementation
// Apply these changes to make the code more resilient to contract call failures

/**
 * SUMMARY OF FINDINGS:
 * 
 * 1. Contract exists at 0x2AcC3076Fc002C7B077bbEC8AC9B991C191BF5D3
 * 2. Contract name and symbol are both "test"
 * 3. Contract owner is 0x4d6451b26168104b3FfE8F55CE104168F9F5BeD2
 * 4. Total supply is 100
 * 5. Several key functions revert when called directly:
 *    - mintPrice()
 *    - getDiscountRate()
 *    - nextTokenId()
 *    - isMintPaused()
 * 
 * RECOMMENDED CHANGES:
 * - Add fallback values for critical functions
 * - Implement try-catch blocks around all contract calls
 * - Add caching mechanisms for frequently used values
 * - Add logging for troubleshooting
 */

import { ethers } from 'ethers';
import { TOKEN_ADDRESS, ERC20_ABI, getProvider, getNFTContract } from './web3';

// Apply these changes to the getNFTPrice function
// Original:
// export const getNFTPrice = async (): Promise<string> => {
//   try {
//     const provider = getProvider();
//     const contract = getNFTContract(provider);
//     // New contract uses mintPrice variable instead of currentPrice() function
//     const price = await contract.mintPrice();
//     return ethers.utils.formatEther(price);
//   } catch (error) {
//     console.error('Error getting NFT price:', error);
//     return '0';
//   }
// };

// Replace with:
export const getNFTPrice = async (): Promise<string> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Try to get price from contract
    try {
      const price = await contract.mintPrice();
      console.log('NFT Price fetched from contract:', ethers.utils.formatEther(price));
      return ethers.utils.formatEther(price);
    } catch (contractError) {
      console.warn('Could not fetch price from contract directly:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Fallback to hardcoded price - 150 CRO based on contract deployment
      const fallbackPrice = '150';
      console.log('Using fallback NFT price:', fallbackPrice);
      return fallbackPrice;
    }
  } catch (error) {
    console.error('Error in getNFTPrice:', error instanceof Error ? error.message : 'Unknown error');
    return '150'; // Default fallback price
  }
};

// Apply these changes to the getDiscountRate function
// Original:
// export const getDiscountRate = async (address: string): Promise<number> => {
//   try {
//     const provider = getProvider();
//     const contract = getNFTContract(provider);
//     const discount = await contract.getDiscountRate(address);
//     return parseInt(discount.toString());
//   } catch (error) {
//     console.error('Error getting discount rate:', error);
//     return 0;
//   }
// };

// Replace with:
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
      console.warn('Could not fetch token balance:', tokenError instanceof Error ? tokenError.message : 'Unknown error');
    }
    
    // Try direct discount rate call
    try {
      const discount = await contract.getDiscountRate(address);
      console.log('Discount rate fetched from contract:', discount.toString());
      return parseInt(discount.toString());
    } catch (contractError) {
      console.warn('Could not fetch discount from contract directly:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Calculate discount based on token balance (same algorithm as in contract)
      // 1M tokens = 1% discount, max 30%
      if (tokenBalance && tokenBalance.gt(0)) {
        let tokenDecimals = 18;
        try {
          tokenDecimals = await tokenContract.decimals();
        } catch (e) {
          console.warn('Could not get token decimals, using default 18');
        }
        
        const tokenBalanceFormatted = parseFloat(ethers.utils.formatUnits(tokenBalance, tokenDecimals));
        const calculatedDiscount = Math.floor(tokenBalanceFormatted / 1000000);
        const cappedDiscount = Math.min(calculatedDiscount, 30);
        
        console.log('Calculated discount from token balance:', cappedDiscount);
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

// Apply these changes to the getNextTokenId function
// Original:
// export const getNextTokenId = async (): Promise<number> => {
//   try {
//     const provider = getProvider();
//     const contract = getNFTContract(provider);
//     const nextTokenId = await contract.nextTokenId();
//     return parseInt(nextTokenId.toString());
//   } catch (error) {
//     console.error('Error getting next token ID:', error);
//     return 0;
//   }
// };

// Replace with:
export const getNextTokenId = async (): Promise<number> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Try to get next token ID
    try {
      const nextTokenId = await contract.nextTokenId();
      console.log('Next token ID fetched from contract:', nextTokenId.toString());
      return parseInt(nextTokenId.toString());
    } catch (contractError) {
      console.warn('Could not fetch next token ID from contract:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Alternative: use totalSupply + 1 as a reasonable approximation
      try {
        const totalSupply = await contract.totalSupply();
        const estimatedNextId = parseInt(totalSupply.toString()) + 1;
        console.log('Estimated next token ID from totalSupply:', estimatedNextId);
        return estimatedNextId;
      } catch (supplyError) {
        console.warn('Could not estimate from totalSupply:', supplyError instanceof Error ? supplyError.message : 'Unknown error');
        return 1; // Default fallback
      }
    }
  } catch (error) {
    console.error('Error in getNextTokenId:', error instanceof Error ? error.message : 'Unknown error');
    return 1; // Default fallback
  }
};

// Apply these changes to the isNFTSaleActive function
// Original:
// export const isNFTSaleActive = async (): Promise<boolean> => {
//   try {
//     const provider = getProvider();
//     const contract = getNFTContract(provider);
//     // New contract uses isMintPaused (inverse of saleIsActive)
//     const isPaused = await contract.isMintPaused();
//     return !isPaused; // Return the inverse to maintain the same function meaning
//   } catch (error) {
//     console.error('Error checking if NFT sale is active:', error);
//     return false;
//   }
// };

// Replace with:
export const isNFTSaleActive = async (): Promise<boolean> => {
  try {
    const provider = getProvider();
    const contract = getNFTContract(provider);
    
    // Try to check if mint is paused
    try {
      const isPaused = await contract.isMintPaused();
      console.log('Mint paused status fetched from contract:', isPaused);
      return !isPaused;
    } catch (contractError) {
      console.warn('Could not fetch mint paused status:', contractError instanceof Error ? contractError.message : 'Unknown error');
      
      // Try getting owner and asking them directly via an off-chain api
      try {
        // This is a placeholder for an actual implementation that might
        // involve querying a backend API or other data source
        // In a real implementation, you would replace this with an actual check
        const owner = await contract.owner();
        console.log('Contract owner:', owner);
        
        // For now, assume sale is active as a failsafe
        // In a real-world scenario, you might want to implement a more robust
        // fallback mechanism, such as checking a backend API
        return true;
      } catch (ownerError) {
        console.warn('Could not get owner:', ownerError instanceof Error ? ownerError.message : 'Unknown error');
        // Default to true to allow users to attempt minting
        // The contract will reject the transaction if minting is actually paused
        return true;
      }
    }
  } catch (error) {
    console.error('Error checking if NFT sale is active:', error instanceof Error ? error.message : 'Unknown error');
    // Default to false as a safety measure if everything fails
    return false;
  }
};

// Modify the mintNFTWithReown function for more robust error handling
// Add this section to the mintNFTWithReown function:

/* Example usage in mintNFTWithReown:

  // Get discount rate using our enhanced function
  console.log('mintNFTWithReown: Getting discount rate...');
  let discountRate;
  try {
    discountRate = await contract.getDiscountRate(signerAddress);
    console.log('mintNFTWithReown: Discount rate from contract:', discountRate.toString(), '%');
  } catch (discountError) {
    console.warn('mintNFTWithReown: Error getting discount from contract:', discountError instanceof Error ? discountError.message : 'Unknown error');
    // Use our enhanced function that has fallbacks built in
    discountRate = await getDiscountRate(signerAddress);
    console.log('mintNFTWithReown: Calculated discount rate:', discountRate, '%');
    // Convert to BigNumber for consistency
    discountRate = ethers.BigNumber.from(discountRate.toString());
  }
  
  // Get price using our enhanced function
  console.log('mintNFTWithReown: Getting price...');
  let basePrice;
  try {
    basePrice = await contract.mintPrice();
    console.log('mintNFTWithReown: Base price from contract:', basePrice.toString());
  } catch (priceError) {
    console.warn('mintNFTWithReown: Error getting price from contract:', priceError instanceof Error ? priceError.message : 'Unknown error');
    // Use our enhanced function that has fallbacks built in
    const priceString = await getNFTPrice();
    basePrice = ethers.utils.parseEther(priceString);
    console.log('mintNFTWithReown: Using fallback price:', basePrice.toString());
  }
  
  // Calculate discounted price safely
  const discountPercent = parseInt(discountRate.toString());
  const discountedPrice = basePrice.mul(100 - discountPercent).div(100);
  console.log('mintNFTWithReown: Discounted price:', discountedPrice.toString());

*/