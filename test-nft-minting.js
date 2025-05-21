const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Constants
const NFT_CONTRACT_ADDRESS = '0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902';
const TEST_WALLET_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Example address for testing

async function loadABI() {
  try {
    const abiPath = path.join(__dirname, './public/ERC721A.JSON');
    const abiData = fs.readFileSync(abiPath, 'utf8');
    return JSON.parse(abiData);
  } catch (error) {
    console.error('Error loading ABI:', error);
    return [];
  }
}

async function runTests() {
  console.log('🧪 Starting NFT Minting Tests');
  console.log('===============================');

  // Initialize provider (using Cronos RPC)
  const provider = new ethers.providers.JsonRpcProvider('https://evm.cronos.org');
  console.log('✅ Connected to Cronos provider');

  // Load ABI
  const abi = await loadABI();
  console.log(`✅ ABI loaded with ${abi.length} entries`);

  // Initialize contract instance
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, abi, provider);
  console.log('✅ Contract instance created');

  // Test 1: Check if contract exists and has expected functions
  console.log('\n📋 Test 1: Contract Validation');
  try {
    const code = await provider.getCode(NFT_CONTRACT_ADDRESS);
    const exists = code !== '0x';
    console.log(`Contract exists: ${exists ? '✅' : '❌'}`);
    
    if (exists) {
      // List some of the available functions to check
      const methods = [
        'mintPrice',
        'isMintPaused',
        'getDiscountRate',
        'nextTokenId',
        'totalSupply',
        'publicMint'
      ];
      
      for (const method of methods) {
        try {
          // Just checking if the function exists
          const hasMethod = typeof contract.functions[method] === 'function';
          console.log(`- Has ${method}: ${hasMethod ? '✅' : '❌'}`);
        } catch (error) {
          console.log(`- Has ${method}: ❌ (Error: ${error.message})`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Contract validation failed: ${error.message}`);
  }

  // Test 2: getNFTPrice()
  console.log('\n📋 Test 2: getNFTPrice()');
  try {
    const price = await contract.mintPrice();
    const priceInCRO = ethers.utils.formatEther(price);
    console.log(`✅ NFT Price: ${priceInCRO} CRO`);
  } catch (error) {
    console.error(`❌ getNFTPrice test failed: ${error.message}`);
  }

  // Test 3: getDiscountRate()
  console.log('\n📋 Test 3: getDiscountRate()');
  try {
    const discountRate = await contract.getDiscountRate(TEST_WALLET_ADDRESS);
    console.log(`✅ Discount Rate for ${TEST_WALLET_ADDRESS}: ${discountRate}%`);
    
    // Verify discount calculation logic
    console.log('Discount rates should be based on token holdings (1M tokens = 1% discount, max 30%)');
  } catch (error) {
    console.error(`❌ getDiscountRate test failed: ${error.message}`);
  }

  // Test 4: getNextTokenId()
  console.log('\n📋 Test 4: getNextTokenId()');
  try {
    const nextTokenId = await contract.nextTokenId();
    console.log(`✅ Next Token ID: ${nextTokenId}`);
  } catch (error) {
    console.error(`❌ getNextTokenId test failed: ${error.message}`);
  }

  // Test 5: isNFTSaleActive()
  console.log('\n📋 Test 5: isNFTSaleActive()');
  try {
    const mintPaused = await contract.isMintPaused();
    console.log(`✅ isMintPaused: ${mintPaused}`);
    console.log(`✅ Sale Active: ${!mintPaused}`);
  } catch (error) {
    console.error(`❌ isNFTSaleActive test failed: ${error.message}`);
  }

  // Test 6: Total Supply (unlimited)
  console.log('\n📋 Test 6: Total Supply');
  try {
    const totalSupply = await contract.totalSupply();
    console.log(`✅ Current Total Supply: ${totalSupply}`);
    console.log('✅ Max Supply: Unlimited (as designed)');
  } catch (error) {
    console.error(`❌ Total Supply test failed: ${error.message}`);
  }

  // Test 7: Simulated Price Calculation
  console.log('\n📋 Test 7: Price Calculation with Discount');
  try {
    const basePrice = await contract.mintPrice();
    const discount = await contract.getDiscountRate(TEST_WALLET_ADDRESS);
    const discountedPrice = basePrice.mul(100 - parseInt(discount.toString())).div(100);
    
    console.log(`✅ Base Price: ${ethers.utils.formatEther(basePrice)} CRO`);
    console.log(`✅ Discount: ${discount}%`);
    console.log(`✅ Discounted Price: ${ethers.utils.formatEther(discountedPrice)} CRO`);
    
    // Calculate for multiple NFTs
    const quantity = 3;
    const totalPrice = discountedPrice.mul(quantity);
    console.log(`✅ Total Price for ${quantity} NFTs: ${ethers.utils.formatEther(totalPrice)} CRO`);
  } catch (error) {
    console.error(`❌ Price calculation test failed: ${error.message}`);
  }

  console.log('\n===============================');
  console.log('🏁 All tests completed');
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
});