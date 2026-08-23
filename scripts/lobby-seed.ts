// Sets up one live match between two throwaway wallets and prints their proofs,
// so a browser can be pointed at either side. Companion to lobby-drive.ts.
import { wallet } from "@/scripts/lib/signer";
import { buildDeckPreferring } from "@/engine/deck";
import { SET } from "@/lib/set";

const BASE = `${process.argv[2] ?? "https://trenches.cards"}/api/pvp`;

async function ask(path: string, proof: unknown, body: Record<string, unknown> = {}) {
  const r = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

async function main() {
  const A = wallet("seedA");
  const B = wallet("seedB");
  const offer = await ask("create", A.proof, {
    mode: "correspondence",
    stake: 0,
    deck: buildDeckPreferring(SET, 111, () => true),
  });
  const match = await ask("join", B.proof, {
    id: offer.json.id,
    deck: buildDeckPreferring(SET, 222, () => true),
  });
  console.log(JSON.stringify({ matchId: match.json.id, A, B }, null, 0));
}

main();
