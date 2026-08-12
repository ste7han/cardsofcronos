import * as functions from "firebase-functions/v2";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { ethers } from "ethers";

// Modernere manier van initialiseren voor ESM
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// CONFIGURATIE
const CROCARD_ADDRESS = "0xECf3361441512c1e9F6A6e8734D86614D8e795BC";
const TOTAL_SUPPLY_CROCARD = 1000000000;

// Hier stond `startBattle`: een tweede, onvolledige TypeScript-implementatie van
// het spel (simulator.ts/actions.ts/conditions.ts/targeting.ts). Niets riep hem
// aan, maar hij werd wel gedeployed, en hij week af van de Python-engine:
// een gelijkspel telde als winst voor speler 2, onbekende condities vuurden
// juist wél af, en van de 77 action_types waren er 3 geïmplementeerd.
// De echte engine is game-engine/ (start_battle_python + on_lobby_ready).

// --- JE BESTAANDE CLAIM FUNCTIE ---
const REWARDS = [
  { name: "PACK", address: "0x46E2B5423F6ff46A8A35861EC9DAfF26af77AB9A", per01Percent: 10 },
  { name: "CRY", address: "0xB770074eA2A8325440798fDF1c29B235b31922Ae", per01Percent: 1500 },
  { name: "CAW777", address: "0x86948F9C2AD4BF5EeF10c7CB6434C9d75EC9Bb9a", per01Percent: 500 },
  { name: "NFX", address: "0xe1f864aE527d3646c222fe1b65460dB2D6E62228", per01Percent: 0.1 },
  { name: "CLOVE", address: "0x8A795f3801AC51A8099724D3265F6Cc0Fd76F40B", per01Percent: 500 },
  { name: "OBS", address: "0x0AEBa21655185583367f19D0C882dfc654C6Dd54", per01Percent: 100 },
];

const MIN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

export const claimWeeklyTokens = functions.https.onCall({ secrets: ["GAME_WALLET_PKEY"] }, async (request) => {
  const address = request.data?.address?.toLowerCase();
  if (!address) throw new functions.https.HttpsError("invalid-argument", "Geen wallet adres opgegeven.");

  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekId = `${d.getUTCFullYear()}-W${weekNumber}`;

  const claimRef = db.collection("claims").doc(`${address}_${weekId}`);
  const doc = await claimRef.get();
  if (doc.exists) throw new functions.https.HttpsError("already-exists", "Je hebt deze week al geclaimd!");

  const provider = new ethers.JsonRpcProvider("https://evm.cronos.org");
  const crocardContract = new ethers.Contract(CROCARD_ADDRESS, MIN_ABI, provider);
  const balanceBN = await crocardContract.balanceOf(address);
  const balance = Number(ethers.formatUnits(balanceBN, 18));

  if (balance === 0) throw new functions.https.HttpsError("permission-denied", "Je bezit geen $CROCARD.");

  const multiplier = (balance / TOTAL_SUPPLY_CROCARD) * 100 / 0.1;
  const privateKey = process.env.GAME_WALLET_PKEY;
  if (!privateKey) throw new functions.https.HttpsError("internal", "Server configuratie fout (PKEY).");

  const wallet = new ethers.Wallet(privateKey, provider);
  const results = [];
  let currentNonce = await wallet.getNonce("pending");

  for (const reward of REWARDS) {
    const amountToCalc = multiplier * reward.per01Percent;
    if (amountToCalc > 0) {
      try {
        const tokenContract = new ethers.Contract(reward.address, MIN_ABI, wallet);
        const tx = await tokenContract.transfer(address, ethers.parseUnits(amountToCalc.toFixed(6), 18), { nonce: currentNonce });
        currentNonce++;
        await tx.wait(); 
        results.push(`${reward.name}: success`);
      } catch (e: any) {
        results.push(`${reward.name}: failed (${e.message})`);
        currentNonce = await wallet.getNonce("pending");
      }
    }
  }

  await claimRef.set({ 
      address, 
      weekId, 
      timestamp: FieldValue.serverTimestamp(), // AANGEPAST: Geen admin. meer nodig
      results 
  });
  
  return { message: "Claim proces voltooid!", details: results };
});