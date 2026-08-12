import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// CONFIGURATIE
// Hier stond één hardcoded BlockPI-URL met de API-key erin. Die key zat in de
// repo én was door zijn quota heen: het endpoint gaf HTTP 402 "Payment Required".
// Ethers kreeg daardoor geen JSON terug en maakte er een misleidende
// "transaction reverted"-fout van, wat in de UI landde als "Server Scan Error".
//
// Nu: een eigen endpoint via CRONOS_RPC_URL als je er een hebt, met publieke
// endpoints als achtervang. Valt er één om, dan gaat de scan door met de volgende.
const RPC_ENDPOINTS: string[] = [
  process.env.CRONOS_RPC_URL,
  'https://evm.cronos.org',
  'https://cronos-evm-rpc.publicnode.com',
  'https://cronos.drpc.org',
  'https://evm-cronos.crypto.org',
].filter((u): u is string => typeof u === 'string' && u.length > 0);

const TARGET_NFT_CONTRACT = '0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902';
// Multicall3 Contract op Cronos (Standaard adres)
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const COLLECTION_SIZE = 1894;
const BATCH_SIZE = 500;

// ABI's
const NFT_ABI = ['function ownerOf(uint256 tokenId) view returns (address)'];
const MULTICALL_ABI = [
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[] returnData)',
];

const nftInterface = new ethers.utils.Interface(NFT_ABI);

async function scanWithEndpoint(rpcUrl: string, userAddress: string): Promise<number[]> {
  const provider = new ethers.providers.StaticJsonRpcProvider(
    { url: rpcUrl, skipFetchSetup: true },
    { chainId: 25, name: 'cronos' }
  );
  const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);

  const ownedIds: number[] = [];
  const allIds = Array.from({ length: COLLECTION_SIZE }, (_, i) => i + 1);

  // 500 calls per keer = slechts 4 netwerk requests totaal.
  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batchIds = allIds.slice(i, i + BATCH_SIZE);

    const calls = batchIds.map((id) => ({
      target: TARGET_NFT_CONTRACT,
      callData: nftInterface.encodeFunctionData('ownerOf', [id]),
    }));

    // requireSuccess = false zorgt dat 1 fout niet de hele batch laat crashen
    const results = await multicallContract.tryAggregate(false, calls);

    results.forEach((result: any, index: number) => {
      if (!result.success) return;
      try {
        const [owner] = nftInterface.decodeFunctionResult('ownerOf', result.returnData);
        if (owner.toLowerCase() === userAddress) ownedIds.push(batchIds[index]);
      } catch {
        // Decoding error (kan gebeuren als token burned is)
      }
    });
  }

  return ownedIds;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address || !ethers.utils.isAddress(address)) {
    return NextResponse.json({ error: 'A valid wallet address is required' }, { status: 400 });
  }

  const userAddress = address.toLowerCase();
  const failures: string[] = [];

  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const ownedIds = await scanWithEndpoint(rpcUrl, userAddress);
      return NextResponse.json({ ownedIds });
    } catch (error: any) {
      const host = (() => { try { return new URL(rpcUrl).host; } catch { return rpcUrl; } })();
      const reason = error?.message || String(error);
      console.error(`Scan failed via ${host}:`, reason);
      failures.push(`${host}: ${reason.slice(0, 120)}`);
    }
  }

  return NextResponse.json(
    {
      error: 'Could not reach any Cronos RPC endpoint. Please try again in a moment.',
      attempts: failures,
    },
    { status: 502 }
  );
}
