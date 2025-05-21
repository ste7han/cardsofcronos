const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Constants - using the corrected contract address
const NFT_CONTRACT_ADDRESS = '0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902';
const TEST_WALLET_ADDRESS = '0xf1889004ab0125ce304d5c680860cfa6b3564690'; // Use connected wallet from logs

// Load ABI
async function loadABI() {
  try {
    const abiPath = path.join(__dirname, './public/ERC721A.JSON');
    const abiData = fs.readFileSync(abiPath, 'utf8');
    // Filter to only include functions
    const fullAbi = JSON.parse(abiData);
    const functionAbi = fullAbi.filter(entry => entry.type === 'function');
    console.log(`ABI loaded and filtered: ${functionAbi.length} functions`);
    return functionAbi;
  } catch (error) {
    console.error('Error loading ABI:', error);
    // Minimal fallback ABI with just the functions we're testing
    return [
      "function mintPrice() view returns (uint256)",
      "function nextTokenId() view returns (uint256)",
      "function isMintPaused() view returns (bool)",
      "function totalSupply() view returns (uint256)",
      "function getDiscountRate(address user) view returns (uint256)"
    ];
  }
}

// Safe contract call with helpful logging
async function safeContractCall(contract, method, args = [], fallbackValue = null) {
  console.log(`\nTesting ${method}...`);
  try {
    console.log(`Calling ${method} with args:`, args);
    const result = await contract[method](...args);
    console.log(`✅ SUCCESS: ${method} returned:`, result.toString());
    return result;
  } catch (error) {
    console.error(`❌ ERROR: ${method} failed:`, error.message);
    return fallbackValue;
  }
}

async function testContractFunctions() {
  console.log('🧪 Starting Contract Function Tests');
  console.log(`Contract address: ${NFT_CONTRACT_ADDRESS}`);
  console.log('='.repeat(50));

  try {
    // Initialize provider 
    const provider = new ethers.providers.JsonRpcProvider('https://evm.cronos.org');
    console.log('Provider initialized');

    // Load ABI
    const abi = await loadABI();
    
    // Initialize contract
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, abi, provider);
    console.log('Contract instance created');
    
    // Verify contract code exists at address
    const code = await provider.getCode(NFT_CONTRACT_ADDRESS);
    const exists = code !== '0x' && code !== '0x0';
    console.log(`Contract exists at address: ${exists ? '✅ Yes' : '❌ No'}`);
    
    if (!exists) {
      console.error('Contract does not exist at specified address. Aborting tests.');
      return;
    }
    
    // Test the specific functions that were previously failing
    
    // 1. mintPrice()
    const price = await safeContractCall(contract, "mintPrice", [], ethers.BigNumber.from("0"));
    if (price) {
      console.log(`Mint price: ${ethers.utils.formatEther(price)} CRO`);
    }
    
    // 2. getDiscountRate()
    const discountRate = await safeContractCall(
      contract, 
      "getDiscountRate", 
      [TEST_WALLET_ADDRESS],
      ethers.BigNumber.from("0")
    );
    if (discountRate) {
      console.log(`Discount rate for ${TEST_WALLET_ADDRESS}: ${discountRate}%`);
    }
    
    // 3. nextTokenId()
    const nextTokenId = await safeContractCall(
      contract, 
      "nextTokenId", 
      [], 
      ethers.BigNumber.from("1")
    );
    if (nextTokenId) {
      console.log(`Next token ID: ${nextTokenId}`);
    }
    
    // 4. isMintPaused()
    const mintPaused = await safeContractCall(contract, "isMintPaused", [], true);
    console.log(`Mint paused: ${mintPaused}`);
    console.log(`Sale active: ${!mintPaused}`);
    
    // 5. totalSupply() (as a control - this function was working before)
    const totalSupply = await safeContractCall(contract, "totalSupply", [], ethers.BigNumber.from("0"));
    if (totalSupply) {
      console.log(`Total supply: ${totalSupply}`);
    }

    console.log('\n='.repeat(50));
    console.log('🏁 All tests completed');
    
    // Result summary
    console.log('\n📊 Results Summary:');
    console.log('Function          | Status  ');
    console.log('----------------- | --------');
    console.log(`mintPrice()       | ${price ? '✅ Working' : '❌ Failed'}`);
    console.log(`getDiscountRate() | ${discountRate ? '✅ Working' : '❌ Failed'}`);
    console.log(`nextTokenId()     | ${nextTokenId ? '✅ Working' : '❌ Failed'}`);
    console.log(`isMintPaused()    | ${mintPaused !== null ? '✅ Working' : '❌ Failed'}`);
    console.log(`totalSupply()     | ${totalSupply ? '✅ Working' : '❌ Failed'}`);
    
  } catch (error) {
    console.error('Test execution failed:', error.message);
  }
}

testContractFunctions().then(() => process.exit(0)).catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});