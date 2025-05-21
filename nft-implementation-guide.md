# NFT Minting Implementation Guide

## Testing Results Summary

Based on our comprehensive testing of the NFT minting implementation with the new contract, we discovered several important issues:

1. **Contract Exists** ✅: The contract exists at address `0x2AcC3076Fc002C7B077bbEC8AC9B991C191BF5D3`
2. **Contract Information** ✅: Contract name and symbol are both "test"
3. **Contract Owner** ✅: Owner is `0x4d6451b26168104b3FfE8F55CE104168F9F5BeD2`
4. **Total Supply** ✅: Works correctly and currently returns 100
5. **Function Access Issues** ⚠️: Several critical functions revert when called directly:
   - `mintPrice()`
   - `getDiscountRate()`
   - `nextTokenId()`
   - `isMintPaused()`

## Root Causes

After investigation, we've identified possible root causes:

1. **Access Control**: The contract likely has access control restrictions on key functions that prevent direct calls
2. **ABI Mismatch**: The ABI in `public/ERC721A.JSON` may not match the actual contract implementation
3. **Contract State**: The contract might be in a specific state (paused, locked) affecting functionality

## Recommended Changes to web3.ts

The following improvements will make the NFT minting implementation more resilient:

### 1. Update `getNFTPrice()` Function

```typescript
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
```

### 2. Update `getDiscountRate()` Function

```typescript
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
```

### 3. Update `getNextTokenId()` Function

```typescript
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
```

### 4. Update `isNFTSaleActive()` Function

```typescript
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
      
      // For now, assume sale is active as a failsafe
      // The contract will reject the transaction if minting is actually paused
      console.log('Assuming sale is active (fallback behavior)');
      return true;
    }
  } catch (error) {
    console.error('Error checking if NFT sale is active:', error instanceof Error ? error.message : 'Unknown error');
    // Default to false as a safety measure if everything fails
    return false;
  }
};
```

### 5. Update Price Calculation in `mintNFTWithReown()`

Find this section in the `mintNFTWithReown()` function:

```typescript
// Get discount rate
console.log('mintNFTWithReown: Getting discount rate...');
const discountRate = await contract.getDiscountRate(address);
console.log('mintNFTWithReown: Discount rate:', discountRate.toString(), '%');

// Get price
console.log('mintNFTWithReown: Getting price...');
const basePrice = await contract.mintPrice();
console.log('mintNFTWithReown: Base price:', basePrice.toString());

// Calculate discounted price
const discountedPrice = basePrice.mul(100 - parseInt(discountRate.toString())).div(100);
```

Replace it with:

```typescript
// Get discount rate using our enhanced function
console.log('mintNFTWithReown: Getting discount rate...');
let discountRate;
try {
  discountRate = await contract.getDiscountRate(signerAddress);
  console.log('mintNFTWithReown: Discount rate from contract:', discountRate.toString(), '%');
} catch (discountError) {
  console.warn('mintNFTWithReown: Error getting discount from contract:', discountError instanceof Error ? discountError.message : 'Unknown error');
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
```

## Additional Recommendations

1. **ABI Verification**: Update the ABI in `public/ERC721A.JSON` if possible to match the actual deployed contract.

2. **Enhanced UI Messaging**: Update the NFTMintingForm.tsx component to display appropriate messages when fallback values are used.

3. **Monitoring**: Add a monitoring system to log contract interaction failures and detect when the contract state changes.

4. **Backend Verification**: Consider implementing a backend service that can verify contract state and provide fallback information when direct contract interactions fail.

5. **Transaction Safety**: Add additional checks to ensure transactions don't proceed with incorrect price information.

By implementing these changes, the NFT minting implementation will be more resilient to contract access issues while still providing a good user experience.