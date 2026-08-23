// Card value by rarity reverses sign over a match: a common returns $39.6K per
// $10K on turn two and *minus* $15.4K on turn eight (scripts/rarity-value.ts).
// If that holds, then late in a match playing a common is worse than letting the
// budget go to waste — and the bot plays them anyway, because it credits itself
// the full price for not wasting it.
//
// That was an inference from a still-life board. This tests the decision where it
// actually happens: every time the bot plays a common from the given turn on, the
// match is forked. One fork plays it, the other skips that one card and carries
// on as normal — waste and all. Both forks then run to the end with the same bot
// on both sides, so the only difference is the one decision.
//
//   npx tsx scripts/late-common.ts [matches] [from turn]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Move, Rarity, State } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 400);
const FROM_TURN = Number(process.argv[3] ?? 8);

/** Run to the end with the bot on both sides, and return the mover's margin. */
function playOut(state: State, side: "you" | "opponent"): number {
  let s = state;
  let guard = 0;
  while (!s.finished && guard++ < 600) s = applyMove(s, chooseMove(s, index), index);
  return s.players[side].mc - s.players[side === "you" ? "opponent" : "you"].mc;
}

/** The turn continues without this one card: skip it, take whatever comes next. */
function skipping(state: State, handIndex: number): State {
  const s = structuredClone(state) as State;
  // Lifting the card out of the hand is the only way to make the bot choose
  // again without asking it to reconsider a decision it has already made.
  s.players[s.toMove].hand.splice(handIndex, 1);
  return s;
}

const byRarity = new Map<Rarity, { n: number; delta: number; better: number }>();

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;

  while (!state.finished && guard++ < 600) {
    const move: Move = chooseMove(state, index);

    if (move.kind === "playCard" && state.turn >= FROM_TURN) {
      const mover = state.toMove;
      const card = cardById(index, state.players[mover].hand[move.handIndex]!);
      const played = playOut(applyMove(state, move, index), mover);
      const skipped = playOut(skipping(state, move.handIndex), mover);

      const tally = byRarity.get(card.rarity) ?? { n: 0, delta: 0, better: 0 };
      tally.n += 1;
      tally.delta += played - skipped;
      if (played > skipped) tally.better += 1;
      byRarity.set(card.rarity, tally);
    }

    state = applyMove(state, move, index);
  }
}

console.log(
  `${MATCHES} matches — every card the bot played from turn ${FROM_TURN} on,\n` +
    `forked against not playing that one card\n`,
);
console.log(`  rarity       decisions   playing it was better   margin gained by playing`);
for (const [rarity, t] of [...byRarity.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const share = ((t.better / t.n) * 100).toFixed(0) + "%";
  console.log(
    `  ${rarity.padEnd(10)} ${String(t.n).padStart(11)}   ${share.padStart(21)}   ` +
      `${formatMC(t.delta / t.n).padStart(22)}`,
  );
}
console.log(
  `\n  Below 50% and below zero means the bot is making the play worse by making it.` +
    `\n  The comparison is against skipping that card and eating whatever waste follows,` +
    `\n  which is the choice a player actually has.`,
);
