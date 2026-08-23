// The referral chain, end to end against a running site.
//
//   npx tsx scripts/ref-drive.ts                 against a local dev server
//   npx tsx scripts/ref-drive.ts http://…:3000   against anything else
//
// Only what needs a real database: that a code is stable, that a referral can be
// claimed once, that your own code is refused, and — the one that matters — that
// claiming on its own counts for nothing. Wallets are free, so if a claim ever
// qualified by itself the whole thing is a wallet-generating machine.
//
// It writes rows. Clean up after yourself.
import { wallet } from "@/scripts/lib/signer";

const BASE = process.argv[2] ?? "http://localhost:3000";

async function ask(path: string, proof: unknown, body: Record<string, unknown> = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

const step = (n: string, ok: boolean, detail = "") =>
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${detail ? "  " + detail : ""}`);

async function main() {
  const A = wallet("refA");
  const B = wallet("refB");

  const mine = await ask("/api/ref/me", A.proof);
  const code = mine.json?.code;
  step("a wallet gets a code", mine.status === 200 && /^[2-9A-HJ-NP-Z]{8}$/.test(code ?? ""), code);

  const again = await ask("/api/ref/me", A.proof);
  step("and keeps the same one", again.json?.code === code);

  const self = await ask("/api/ref/claim", A.proof, { code });
  step("your own code is refused", self.json?.outcome === "self");

  const nonsense = await ask("/api/ref/claim", B.proof, { code: "ZZZZZZZZ" });
  step("a code that is not one is refused", nonsense.json?.outcome === "unknown");

  const claimed = await ask("/api/ref/claim", B.proof, { code: code.toLowerCase() });
  step("lower case works, because nobody types it as printed", claimed.json?.outcome === "claimed");

  const twice = await ask("/api/ref/claim", B.proof, { code });
  step("it can only happen once", twice.json?.outcome === "already");

  const after = await ask("/api/ref/me", A.proof);
  const brought = after.json?.brought ?? [];
  step("A sees B", brought.length === 1 && brought[0].wallet === B.address);
  // The one that matters. A claim is free; if it counted, so would a script.
  step("and it counts for nothing yet", brought[0]?.qualified === false);

  const bSide = await ask("/api/ref/me", B.proof);
  step("B is told who brought them", bSide.json?.broughtBy?.code === code);
  step("B's own code is not A's", bSide.json?.code !== code);

  console.log("\n  wallets:", A.address, B.address);
}


// The demo half of the bar, checked separately because it is the half a farmer
// would attack: if a claim of "I finished the demo" were taken at its word, the
// bar would be one request.
async function demoChecks() {
  console.log("\n  the demo half:");
  const C = wallet("refC");
  const say = (n: string, ok: boolean, detail = "") =>
    console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${detail ? "  " + detail : ""}`);

  const empty = await ask("/api/ref/demo", C.proof, { seed: 12345, moves: [] });
  say("an empty match is refused", empty.status === 400, empty.json?.error?.slice(0, 40));

  const nonsense = await ask("/api/ref/demo", C.proof, { seed: 12345, moves: [{ kind: "nope" }] });
  say("a move the engine does not know is refused", nonsense.status === 400, nonsense.json?.error?.slice(0, 46));

  const short = await ask("/api/ref/demo", C.proof, {
    seed: 12345,
    moves: [{ kind: "endTurn" }, { kind: "endTurn" }],
  });
  say("two turns is not a match", short.status === 400, short.json?.error?.slice(0, 40));

  const noSeed = await ask("/api/ref/demo", C.proof, { moves: [] });
  say("a demo without a seed is refused", noSeed.status === 400);

  console.log("\n  and one that really was played:");
  const { CARDS } = await import("@/data/cards");
  const { INDEX } = await import("@/lib/set");
  const { newMatch, applyMove } = await import("@/engine/match");
  const { chooseMove } = await import("@/engine/bot");
  const { demoDecks } = await import("@/lib/demo");

  const seed = 4242;
  let state = newMatch(CARDS, seed, demoDecks(seed));
  const moves = [];
  while (!state.finished) {
    const move = chooseMove(state, INDEX);
    moves.push(move);
    state = applyMove(state, move, INDEX);
  }
  const real = await ask("/api/ref/demo", C.proof, { seed, moves });
  say("a real ten-turn match is accepted", real.status === 200, `${moves.length} moves`);

  console.log("  wallet:", C.address);
}
async function all() {
  await main();
  await demoChecks();
}
all();
