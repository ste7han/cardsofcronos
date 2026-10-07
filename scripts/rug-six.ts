// Six positions, a million between them, all of it rugged at once.
//
// The maker's own description of how he thought it worked, built exactly: six
// projects on the table, a million in market cap, none of it banked and none of
// it from anywhere else. If every one of them is rugged, is the million gone?
//
//   npm run rug-six

import { CARDS } from "../data/cards";
import { applyMove, buildIndex, budgetForTurn, newMatch } from "../engine/match";
import { formatMC } from "../engine/format";
import { RULES, type Card, type State } from "../engine/types";

const index = buildIndex(CARDS);

/** A project that can sit in a portfolio, taken from the set itself. */
const projects = CARDS.filter((c) => c.type === "project");

/** Every card whose effect rugs a position. */
const ruggers = CARDS.filter((c) => /"kind":"rug"/.test(JSON.stringify(c)));

function table(perPosition: number): State {
  const state = structuredClone(newMatch(CARDS, 4242)) as State;
  state.budgetThisTurn = budgetForTurn(RULES.turns);
  state.budgetSpentThisTurn = 0;

  // Six of theirs, each having earned the same, and their market cap is exactly
  // what those six have paid out. Nothing banked, nothing from anywhere else.
  state.players.opponent.projects = projects.slice(0, RULES.portfolioSize).map((card) => ({
    cardId: card.id,
    holders: 3,
    extraPump: 0,
    earned: perPosition,
    playedOnTurn: 1,
  }));
  state.players.opponent.mc = perPosition * state.players.opponent.projects.length;
  state.players.you.projects = [];
  state.players.you.mc = 0;
  return state;
}

const each = Math.round(1_000_000 / RULES.portfolioSize);
const rug = ruggers[0];
if (rug === undefined) throw new Error("No card in the set rugs anything.");

console.log(`\nportfolio size: ${RULES.portfolioSize}`);
console.log(`each position has earned: ${formatMC(each)}`);
console.log(`so their market cap starts at: ${formatMC(each * RULES.portfolioSize)}\n`);

let state = table(each);
let step = 0;

// One rug at a time, because that is what the card does — six of them in a row
// is the maker's "all at once" without pretending a card exists that does it.
while (state.players.opponent.projects.length > 0 && step < 20) {
  const before = state.players.opponent.mc;
  const positions = state.players.opponent.projects.length;

  state.players.you.hand = [rug.id, ...state.players.you.hand];
  state.toMove = "you";
  // Cleared between rugs: the card doing the rugging is itself a project, and
  // a second copy of it cannot be played over the first. This is a bench test
  // of one rule, not a match — six rugs in a real game come from six cards.
  state.players.you.projects = [];
  state.players.you.support = [];
  state.budgetThisTurn = budgetForTurn(RULES.turns);
  state.budgetSpentThisTurn = 0;

  state = applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index);

  step += 1;
  console.log(
    `  rug ${step}: ${positions} positions -> ${state.players.opponent.projects.length}` +
      `   MC ${formatMC(before)} -> ${formatMC(state.players.opponent.mc)}`,
  );
}

console.log(`\n  market cap left: ${formatMC(state.players.opponent.mc)}`);
console.log(
  state.players.opponent.mc === 0
    ? "  Everything those six made is gone. That is the design.\n"
    : `  NOT nothing. ${formatMC(state.players.opponent.mc)} survived six rugs, which wants explaining.\n`,
);
