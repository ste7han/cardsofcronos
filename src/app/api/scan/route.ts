import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// CONFIGURATIE
const CUSTOM_RPC = "https://cronos.blockpi.network/v1/rpc/34c5e0d5f0f75aea0a4ef7256b334f531b5357de";
const TARGET_NFT_CONTRACT = "0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902";
// Multicall3 Contract op Cronos (Standaard adres)
const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const COLLECTION_SIZE = 1894; 

// ABI's
const NFT_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];
const MULTICALL_ABI = [
  "function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[] returnData)"
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    // Setup Provider
    const provider = new ethers.providers.StaticJsonRpcProvider({
        url: CUSTOM_RPC,
        skipFetchSetup: true 
    }, { chainId: 25, name: 'cronos' });

    // Interfaces voor encoding/decoding
    const nftInterface = new ethers.utils.Interface(NFT_ABI);
    const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);

    const userAddress = address.toLowerCase();
    const ownedIds: number[] = [];
    const allIds = Array.from({ length: COLLECTION_SIZE }, (_, i) => i + 1);

    // We doen dit in grotere batches omdat Multicall dit aankan
    // 500 calls per keer = slechts 4 netwerk requests totaal!
    const BATCH_SIZE = 500; 

    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batchIds = allIds.slice(i, i + BATCH_SIZE);
        
        // 1. Bereid de 'calls' voor (encode de data)
        const calls = batchIds.map(id => ({
            target: TARGET_NFT_CONTRACT,
            callData: nftInterface.encodeFunctionData("ownerOf", [id])
        }));

        // 2. Voer de Multicall uit (1 RPC request)
        // requireSuccess = false zorgt dat 1 fout niet de hele batch laat crashen
        const results = await multicallContract.tryAggregate(false, calls);

        // 3. Decodeer de resultaten
        results.forEach((result: any, index: number) => {
            if (result.success) {
                try {
                    // Decode het adres dat terugkomt
                    const [owner] = nftInterface.decodeFunctionResult("ownerOf", result.returnData);
                    if (owner.toLowerCase() === userAddress) {
                        ownedIds.push(batchIds[index]);
                    }
                } catch (e) {
                    // Decoding error (kan gebeuren als token burned is)
                }
            }
        });
    }

    return NextResponse.json({ ownedIds });

  } catch (error: any) {
    console.error("Multicall Error:", error);
    return NextResponse.json({ 
        error: error.message || "Unknown Server Error",
        details: error.code 
    }, { status: 500 });
  }
}