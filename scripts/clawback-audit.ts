// Does a destroyed position actually cost its owner the market cap it made?
//
// ── WHY THIS SCRIPT EXISTS ───────────────────────────────────────────────────
//
// The maker watched somebody lose their positions and saw no market cap come
// off, and asked whether taking profit and banking work at all. The unit tests
// say the clawback is exact — a rug on a position that earned 150K takes 150K —
// so the question this answers is the other one: does it ever FIRE in a real
// match, and by how much.
//
// It plays whole matches with the bot on both sides and watches every position
// that leaves a board. For each one it records what the position had earned and
// what its owner's market cap did on that move.
//
// ── WHAT IT CAN AND CANNOT PROVE ─────────────────────────────────────────────
//
// Market cap moves for several reasons in one move: a pump lands, a launch is
// paid, unspent budget is charged. So a destroyed position and an exact fall of
// its `earned` will not line up move by move, and this does not pretend to
// check that. What it checks is the thing that would answer the maker's
// question: how often positions are destroyed at all, what they were worth, and
// whether the owner's market cap went DOWN on those moves rather than up.
//
//   npm run clawback

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { formatMC } from "../engine/format";
import type { Player, State } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 300);

/** Every position on a side, by the slot it sits in, with what it has earned. */
function snapshot(state: State, player: Player): { earned: number[]; mc: number } {
  return {
    earned: state.players[player].projects.map((p) => p.earned),
    mc: state.players[player].mc,
  };
}

let destroyed = 0;
let destroyedWorth = 0;
let fellOnThatMove = 0;
let roseAnyway = 0;
let banked = 0;
let matchesWithADestruction = 0;
/** What a match ends on, so a clawback can be weighed against it. */
let finalMC = 0;

for (let seed = 1; seed <= MATCHES; seed++) {
  let state = newMatch(CARDS, seed);
  let any = false;

  for (let guard = 0; guard < 400 && !state.finished; guard++) {
    const before = {
      you: snapshot(state, "you"),
      opponent: snapshot(state, "opponent"),
      bankedYou: state.players.you.banked,
      bankedThem: state.players.opponent.banked,
    };

    state = applyMove(state, chooseMove(state, index), index);

    for (const side of ["you", "opponent"] as Player[]) {
      const was = before[side];
      const now = snapshot(state, side);
      // Fewer positions than before, and not because they were banked: taking
      // profit closes one too, and that is the opposite of this.
      const bankedNow =
        side === "you"
          ? state.players.you.banked - before.bankedYou
          : state.players.opponent.banked - before.bankedThem;
      const lost = was.earned.length - now.earned.length - bankedNow;
      if (lost <= 0) {
        banked += bankedNow;
        continue;
      }

      // What left, by difference: the slots that are gone. Approximate when two
      // go at once, and the total is what matters here.
      const goneWorth =
        was.earned.reduce((a, b) => a + b, 0) - now.earned.reduce((a, b) => a + b, 0);

      destroyed += lost;
      destroyedWorth += goneWorth;
      if (now.mc < was.mc) fellOnThatMove += 1;
      else roseAnyway += 1;
      any = true;
    }
  }
  if (any) matchesWithADestruction += 1;
  finalMC += state.players.you.mc + state.players.opponent.mc;
}

const pct = (n: number, of: number) => (of === 0 ? "—" : `${((n / of) * 100).toFixed(1)}%`);

console.log(`\n${MATCHES} matches played out\n`);
console.log(`  matches with a position destroyed : ${matchesWithADestruction} (${pct(matchesWithADestruction, MATCHES)})`);
console.log(`  positions destroyed               : ${destroyed}`);
console.log(`  what they had earned              : ${formatMC(destroyedWorth)}`);
console.log(`  average per position              : ${destroyed ? formatMC(Math.round(destroyedWorth / destroyed)) : "—"}`);
console.log(`  positions banked instead          : ${banked}`);
console.log();
console.log(`  owner's MC fell on that move      : ${fellOnThatMove} (${pct(fellOnThatMove, fellOnThatMove + roseAnyway)})`);
console.log(`  owner's MC rose or held           : ${roseAnyway}`);
const avgWorth = destroyed ? destroyedWorth / destroyed : 0;
const avgFinal = finalMC / (MATCHES * 2);
console.log();
console.log(`  a match ends on, on average        : ${formatMC(Math.round(avgFinal))}`);
console.log(
  `  so one destroyed position is      : ${((avgWorth / avgFinal) * 100).toFixed(1)}% of it`,
);
console.log(
  `\n  A rise is not a fault on its own: a pump for the turn lands in the same\n` +
    `  move. What would be a fault is destruction never happening at all, or\n` +
    `  positions worth nothing when they go.\n`,
);
