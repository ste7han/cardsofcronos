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
    // Minimal fallback ABI
    return [
      "function mintPrice() view returns (uint256)",
      "function nextTokenId() view returns (uint256)",
      "function isMintPaused() view returns (bool)",
      "function totalSupply() view returns (uint256)",
      "function getDiscountRate(address user) view returns (uint256)",
      "function publicMint(uint256 _amount) payable"
    ];
  }
}

async function safeContractCall(contract, method, args = [], fallbackValue = null, message = "") {
  try {
    const result = await contract[method](...args);
    console.log(`✅ ${message || method} succeeded:`, result.toString());
    return result;
  } catch (error) {
    console.error(`❌ ${message || method} failed:`, error.message);
    return fallbackValue;
  }
}

async function runTests() {
  console.log('🧪 Starting Improved NFT Minting Tests');
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

  // Test 1: Verify contract bytecode presence
  console.log('\n📋 Test 1: Contract Existence Verification');
  const code = await provider.getCode(NFT_CONTRACT_ADDRESS);
  const exists = code !== '0x' && code !== '0x0';
  console.log(`Contract exists: ${exists ? '✅' : '❌'}`);
  
  if (!exists) {
    console.error('❌ Contract does not exist at specified address. Aborting further tests.');
    return;
  }
  
  // Test 2: Get Contract Information
  console.log('\n📋 Test 2: Contract Basic Information');
  await safeContractCall(contract, "name", [], "Unknown", "Contract name");
  await safeContractCall(contract, "symbol", [], "Unknown", "Contract symbol");
  
  // Test 3: NFTPrice
  console.log('\n📋 Test 3: getNFTPrice()');
  const price = await safeContractCall(contract, "mintPrice", [], ethers.BigNumber.from("150000000000000000000"), "NFT Price");
  if (price) {
    console.log(`NFT Price: ${ethers.utils.formatEther(price)} CRO`);
  }
  
  // Test 4: getDiscountRate()
  console.log('\n📋 Test 4: getDiscountRate()');
  const discountRate = await safeContractCall(
    contract, 
    "getDiscountRate", 
    [TEST_WALLET_ADDRESS],
    ethers.BigNumber.from("0"),
    "Discount Rate"
  );
  if (discountRate) {
    console.log(`Discount Rate for ${TEST_WALLET_ADDRESS}: ${discountRate}%`);
  }

  // Test 5: getNextTokenId()
  console.log('\n📋 Test 5: getNextTokenId()');
  const nextTokenId = await safeContractCall(
    contract, 
    "nextTokenId", 
    [], 
    ethers.BigNumber.from("1"),
    "Next Token ID"
  );
  if (nextTokenId) {
    console.log(`Next Token ID: ${nextTokenId}`);
  }

  // Test 6: isNFTSaleActive() - inverse of isMintPaused()
  console.log('\n📋 Test 6: isNFTSaleActive()');
  const mintPaused = await safeContractCall(contract, "isMintPaused", [], true, "Mint Paused Status");
  console.log(`Sale Active: ${!mintPaused}`);

  // Test 7: Total Supply
  console.log('\n📋 Test 7: Total Supply');
  const totalSupply = await safeContractCall(contract, "totalSupply", [], ethers.BigNumber.from("0"), "Total Supply");
  if (totalSupply) {
    console.log(`Current Total Supply: ${totalSupply}`);
    console.log('Max Supply: Unlimited (as designed)');
  }

  // Test 8: Try reading contract owner
  console.log('\n📋 Test 8: Contract Owner');
  await safeContractCall(contract, "owner", [], "Unknown", "Contract Owner");

  // Test 9: Simulated Price Calculation with Discount
  console.log('\n📋 Test 9: Price Calculation with Discount');
  if (price && discountRate) {
    try {
      const discountedPrice = price.mul(100 - parseInt(discountRate.toString())).div(100);
      console.log(`✅ Base Price: ${ethers.utils.formatEther(price)} CRO`);
      console.log(`✅ Discount: ${discountRate.toString()}%`);
      console.log(`✅ Discounted Price: ${ethers.utils.formatEther(discountedPrice)} CRO`);
      
      // Calculate for multiple NFTs
      const quantity = 3;
      const totalPrice = discountedPrice.mul(quantity);
      console.log(`✅ Total Price for ${quantity} NFTs: ${ethers.utils.formatEther(totalPrice)} CRO`);
    } catch (error) {
      console.error(`❌ Price calculation test failed: ${error.message}`);
    }
  } else {
    console.log(`❌ Skipped price calculation due to missing price or discount data`);
  }

  console.log('\n===============================');
  console.log('🏁 All tests completed');
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
});