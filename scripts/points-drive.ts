// The points ladder, end to end against a running site.
//
//   npm run points                      against a local dev server
//   npm run points -- http://…:3000     against anything else
//
// Only what needs a real database and a real request: that a task pays once,
// that a referrer is paid for every task their referral does, and that the two
// tasks a player asks for behave differently — one checked, one taken on trust.
//
// It writes rows. Clean up after yourself.
import { wallet } from "@/scripts/lib/signer";
import { CARDS } from "@/data/cards";
import { INDEX } from "@/lib/set";
import { newMatch, applyMove } from "@/engine/match";
import { chooseMove } from "@/engine/bot";
import { demoDecks } from "@/lib/demo";

const BASE = process.argv[2] ?? "http://localhost:3000";

async function ask(path: string, proof: unknown, body: Record<string, unknown> = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

const say = (n: string, ok: boolean, detail = "") =>
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${detail ? "  " + detail : ""}`);

function playADemo() {
  const seed = 4242;
  let state = newMatch(CARDS, seed, demoDecks(seed));
  const moves = [];
  while (!state.finished) {
    const move = chooseMove(state, INDEX);
    moves.push(move);
    state = applyMove(state, move, INDEX);
  }
  return { seed, moves };
}

async function main() {
  const A = wallet("ptsA");
  const B = wallet("ptsB");

  const code = (await ask("/api/ref/me", A.proof)).json?.code;
  say("A has a code", typeof code === "string", code);

  const start = await ask("/api/tasks/list", A.proof);
  say("five tasks, none done", start.json?.tasks?.length === 5 && start.json.ledger.balance === 0);
  say("and the page is told how each is known",
    start.json.tasks.every((t: any) => typeof t.how === "string" && t.how.length > 20));

  await ask("/api/ref/claim", B.proof, { code });

  const demo = playADemo();
  const played = await ask("/api/ref/demo", B.proof, demo);
  say("B plays a demo through", played.status === 200, `${demo.moves.length} moves`);

  const bAfter = await ask("/api/tasks/list", B.proof);
  say("B earns a point for it", bAfter.json?.ledger?.balance === 1);
  say("and it shows as done", bAfter.json.tasks.find((t: any) => t.id === "demo")?.done === true);

  const aAfter = await ask("/api/tasks/list", A.proof);
  // The whole shape of the design in one number.
  say("A earns one too, for B's task", aAfter.json?.ledger?.balance === 1);

  const twice = await ask("/api/ref/demo", B.proof, demo);
  const bTwice = await ask("/api/tasks/list", B.proof);
  say("replaying the same demo pays nothing more", twice.status === 200 && bTwice.json.ledger.balance === 1);

  const follow = await ask("/api/tasks/do", B.proof, { task: "follow_x" });
  say("following X is taken on trust", follow.json?.proof === "declared");

  const group = await ask("/api/tasks/do", B.proof, { task: "join_telegram" });
  // B has no Telegram linked, so this is refused rather than believed.
  say("joining the group is not", group.status === 400, group.json?.error?.slice(0, 44));

  const nonsense = await ask("/api/tasks/do", B.proof, { task: "be_cool" });
  say("an unknown task fails loudly", nonsense.status === 400, nonsense.json?.error);

  const elsewhere = await ask("/api/tasks/do", B.proof, { task: "demo" });
  say("and one you cannot simply declare is refused", elsewhere.status === 400);

  const final = await ask("/api/tasks/list", A.proof);
  say("A is now on two, from B alone", final.json?.ledger?.balance === 2);

  console.log("\n  wallets:", A.address, B.address);
}

main();
