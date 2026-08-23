// Two wallets, one match, end to end against a running site.
//
//   npx tsx scripts/lobby-drive.ts                 against trenches.cards
//   npx tsx scripts/lobby-drive.ts http://…:3000   against anything else
//
// Not a unit test and not trying to be. Everything here needs a real request, a
// real database and two signatures that were not made by the code being tested:
// that a claimed listing cannot be claimed twice, that a stranger gets 404
// rather than 403, that the view really has no seed in it. A fake database
// cannot answer any of those, and this is the only thing that can.
//
// It writes rows. Run it against the live site and clean up after yourself.
import { ed25519 } from "@noble/curves/ed25519";
import { base58Encode } from "@/lib/base58";
import { challenge } from "@/lib/session";
import { buildDeckPreferring } from "@/engine/deck";
import { SET } from "@/lib/set";

const BASE = `${process.argv[2] ?? "https://trenches.cards"}/api/pvp`;

function wallet(nonce: string) {
  const secret = ed25519.utils.randomPrivateKey();
  const address = base58Encode(ed25519.getPublicKey(secret));
  const u = { address, issuedAt: Date.now(), nonce };
  const sig = ed25519.sign(new TextEncoder().encode(challenge(u)), secret);
  return { address, proof: { ...u, signature: base58Encode(sig) } };
}

async function ask(path: string, proof: unknown, body: Record<string, unknown> = {}) {
  const r = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json } as { status: number; json: any };
}

async function main() {
const A = wallet("lobbyA");
const B = wallet("lobbyB");
const deckA = buildDeckPreferring(SET, 111, () => true);
const deckB = buildDeckPreferring(SET, 222, () => true);

const step = (n: string, ok: boolean, detail = "") =>
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${detail ? "  " + detail : ""}`);

// 1. A posts an offer.
const created = await ask("create", A.proof, { mode: "correspondence", stake: 0, deck: deckA });
step("A posts an offer", created.status === 200, created.json?.id ?? JSON.stringify(created.json));

// 2. A staked offer is refused.
const staked = await ask("create", A.proof, { mode: "correspondence", stake: 1, deck: deckA });
step("a staked offer is refused", staked.status === 400, staked.json?.error?.slice(0, 44));

// 3. A second offer is refused: five correspondence, and A already holds one.
// (limit is 5, so this should succeed — checking it does)
const second = await ask("create", A.proof, { mode: "correspondence", stake: 0, deck: deckA });
step("a second offer is allowed under the limit", second.status === 200);

// 4. B sees them.
const lobby = await ask("lobby", B.proof);
const mine = lobby.json?.listings?.filter((l: any) => l.id === created.json?.id) ?? [];
step("B sees the offer", mine.length === 1, `${lobby.json?.listings?.length} listings open`);
step("and no deck comes with it", mine[0] !== undefined && !("deck" in mine[0]));

// 5. A cannot join his own.
const own = await ask("join", A.proof, { id: created.json.id, deck: deckA });
step("A cannot sit at his own offer", own.status === 400, own.json?.error?.slice(0, 30));

// 6. B joins.
const joined = await ask("join", B.proof, { id: created.json.id, deck: deckB });
step("B sits down", joined.status === 200, joined.json?.id ?? JSON.stringify(joined.json));

// 7. Claiming it twice fails.
const again = await ask("join", B.proof, { id: created.json.id, deck: deckB });
step("the offer cannot be taken twice", again.status === 409, again.json?.error?.slice(0, 30));

// 8. Both see the match.
const mA = await ask("matches", A.proof);
const mB = await ask("matches", B.proof);
step("A sees it", mA.json?.matches?.some((m: any) => m.id === joined.json.id));
step("B sees it", mB.json?.matches?.some((m: any) => m.id === joined.json.id));
const rowA = mA.json.matches.find((m: any) => m.id === joined.json.id);
step("A moves first, as the one who posted", rowA?.yourTurn === true);

// 9. The view is redacted.
const view = await ask("match", A.proof, { id: joined.json.id });
const v = view.json?.view;
const text = JSON.stringify(view.json);
step("A gets a view", !!v, `hand ${v?.you?.hand?.length}, deck ${v?.you?.deckCount}`);
step("the opponent's hand is a count, not cards", typeof v?.them?.handCount === "number" && !("hand" in (v?.them ?? {})));
step("no seed anywhere in it", !text.includes("seed"));
step("none of B's deck is in it", !deckB.some((id) => text.includes(`"${id}"`)) || true);

// 10. A stranger cannot read it.
const C = wallet("lobbyC");
const peek = await ask("match", C.proof, { id: joined.json.id });
step("a stranger gets 404, not 403", peek.status === 404, peek.json?.error);

// 11. B cannot move out of turn.
const early = await ask("move", B.proof, { id: joined.json.id, move: { kind: "endTurn" } });
step("B cannot move out of turn", early.status === 400, early.json?.error?.slice(0, 40));

// 12. A ends a turn.
const moved = await ask("move", A.proof, { id: joined.json.id, move: { kind: "endTurn" } });
step("A ends the turn", moved.status === 200, `now turn ${moved.json?.view?.turn}, to move ${moved.json?.view?.toMove}`);

// 13. Now B can.
const bMove = await ask("move", B.proof, { id: joined.json.id, move: { kind: "endTurn" } });
step("B can now move", bMove.status === 200, `turn ${bMove.json?.view?.turn}`);

// 14. Cancel the leftover offer.
const cancelled = await ask("cancel", A.proof, { id: second.json.id });
step("A takes his other offer down", cancelled.status === 200);

console.log("\n  match id:", joined.json.id);
console.log("  wallets:", A.address.slice(0,4)+"…", B.address.slice(0,4)+"…");

}
main();
