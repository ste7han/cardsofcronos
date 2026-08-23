// Teaching the game while it is being played.
//
// Only in the demo, and deliberately not a script. A scripted tour has to assume
// what happens next — play a project, now attack, now end your turn — and this
// is a real match against a real bot, so the second the player does something
// else the tour is explaining a board that is not on screen. Every lesson here
// is instead a question asked of the state: is this true right now? The first
// one that is, and that the player has not waved away, is the one showing.
//
// That has a second effect worth having. A lesson cannot appear before it means
// anything: nobody is told what a full portfolio does until they have six
// positions, and nobody is told about upgrades until an upgrade is in their
// hand. The order is the match's, not mine.
//
// Situational lessons come first so they can interrupt the basics. If the
// portfolio has just filled up, that is what the screen should be about.

import { cardById } from "@/engine/helpers";
import { canTakeProfit, targetRequirementOf, upgradesAPosition } from "@/engine/match";
import { formatMC } from "@/engine/format";
import type { CardIndex, State } from "@/engine/types";
import { MARKETING_COST, RULES, TURN_ACTION_COST } from "@/engine/types";

export interface Lesson {
  id: string;
  title: string;
  body: string;
}

interface Step extends Lesson {
  /** Is this worth saying right now? */
  when: (state: State, index: CardIndex) => boolean;
}

/** Your hand, as cards. */
function hand(state: State, index: CardIndex) {
  return state.players.you.hand.map((id) => cardById(index, id));
}

const STEPS: readonly Step[] = [
  {
    id: "full",
    title: "Your portfolio is full",
    body:
      `Six positions is the cap. Full does not block a project — playing one asks you to close ` +
      `a position first. The market cap that position already made is yours to keep; what you ` +
      `give up is everything it would have paid from here.`,
    when: (state) => state.players.you.projects.length >= RULES.portfolioSize,
  },
  {
    id: "upgrade",
    title: "That one takes over",
    body:
      `A stronger card of a project you already hold does not need a free slot and does not cost ` +
      `you a position. It takes over the one you have and inherits its pump. The card says so ` +
      `under its own picture.`,
    when: (state, index) =>
      hand(state, index).some((card) => upgradesAPosition(state, card, "you", index)),
  },
  {
    id: "attack",
    title: "You can go at their board",
    body:
      `Some cards point at a position instead of opening one. Take a position's holders to zero ` +
      `and it rugs: off the board, and its pump stops for good. A damaged position pumps less ` +
      `in the meantime, so half a job is still a job.`,
    when: (state, index) =>
      state.players.opponent.projects.length > 0 &&
      hand(state, index).some((card) => targetRequirementOf(card) === "enemyProject"),
  },
  {
    id: "profit",
    title: "You can close a position on purpose",
    body:
      `Take profit closes one of yours and keeps what it made. It costs ${formatMC(TURN_ACTION_COST)} of this ` +
      `turn's budget, which is the whole decision: protecting what is on the table instead of ` +
      `adding to it. A position you bank cannot be rugged later.`,
    when: (state, index) => canTakeProfit(state, "you", index),
  },
  {
    id: "clock",
    title: "Last turn",
    body:
      `After this one the higher market cap wins. Anything you do not spend comes off your ` +
      `market cap in full when the turn ends, so there is no reason to hold anything back now.`,
    when: (state) => state.turn >= RULES.turns,
  },
  {
    id: "positions",
    title: "Start with a project",
    body:
      `Only a project opens a position, and only a position pumps. Everything else on your side ` +
      `of the table is there to protect those positions or to take theirs apart, so an empty ` +
      `portfolio earns nothing however good the rest of your hand looks.`,
    when: (state) => state.players.you.projects.length === 0,
  },
  {
    id: "budget",
    title: "The budget is the cost",
    body:
      `Cards are free to hold and cost money to play, out of a marketing budget you are given ` +
      `each turn — ${formatMC(MARKETING_COST.common)} for a common up to ${formatMC(MARKETING_COST.mythic)} for a mythic. ` +
      `It does not carry over. The budget grows every turn, so the expensive half of your hand ` +
      `is for later whether you like it or not.`,
    when: () => true,
  },
  {
    id: "unspent",
    title: "Do not sit on it",
    body:
      `Budget you have not spent when the turn ends comes off your market cap, dollar for dollar. ` +
      `Ending a turn with money in hand is not caution, it is a payment. If there is nothing ` +
      `worth playing, throwing a card away costs ${formatMC(TURN_ACTION_COST)} and draws you a fresh one.`,
    when: (state) => state.budgetThisTurn - state.budgetSpentThisTurn > 0,
  },
  {
    id: "pump",
    title: "Ending the turn pays out",
    body:
      `Every position you hold adds its pump to your market cap when your turn ends. That is why ` +
      `a project played on turn two is worth more than the same card on turn nine: it is not what ` +
      `it costs, it is how many payouts are left.`,
    when: (state) => state.players.you.projects.length > 0,
  },
];

/**
 * Every lesson id.
 *
 * Exported so "skip all" can be exactly that rather than a second flag meaning
 * the same thing — one place decides what the lessons are, and dismissing all of
 * them is dismissing all of them.
 */
export const LESSON_IDS: readonly string[] = STEPS.map((step) => step.id);

/**
 * What to say now, if anything.
 *
 * Returns null once the player has waved away everything that currently applies,
 * which is the quiet state the panel disappears in. It comes back on its own
 * when the board reaches something they have not been told about yet.
 */
export function nextLesson(
  state: State,
  index: CardIndex,
  dismissed: ReadonlySet<string>,
): Lesson | null {
  for (const step of STEPS) {
    if (dismissed.has(step.id)) continue;
    if (!step.when(state, index)) continue;
    const { id, title, body } = step;
    return { id, title, body };
  }
  return null;
}
