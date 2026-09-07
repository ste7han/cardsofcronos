// What a position on the table actually yields, every turn.
//
// Its own module because two things need it and they cannot import each other.
// match.ts runs the pump phase; effects.ts has a condition that asks how big a
// position has grown, and match already imports effects. Rather than a second
// copy of the arithmetic — one name, two meanings, which is the lesson this
// project was built around — the arithmetic moved to where both can reach it.
//
// match.ts re-exports pumpOf, so every existing caller is untouched.

import { cardById, projectById } from "./helpers";
import type { Aura, CardIndex, Player, ProjectCard, State } from "./types";
import { assertNever } from "./effects";

export interface AuraOn {
  /** Added to the position's pump. Zero when this aura does not touch it. */
  add: number;
  /** Multiplies the position's own pump. One when this aura does not touch it. */
  times: number;
}

/**
 * One switch answering both questions, deliberately, rather than two switches
 * answering one each.
 *
 * Split in two, a new aura kind that neither adds nor multiplies would return
 * the identity from both — nought and one — and do nothing at all, in two
 * separate places that each looked complete. That is the silent branch this
 * codebase exists to refuse. Here a new variant cannot be written without
 * saying, in one object, what it does on both axes.
 */
export function auraOn(aura: Aura, project: ProjectCard): AuraOn {
  // Switched on the object rather than on a copied kind. With one variant a copy
  // was the only way to make the default branch `never`; with two, narrowing is
  // what the switch is for, and a copy narrows nothing — every field access in
  // every branch stops compiling. The union having grown is what makes the
  // ordinary pattern work again.
  switch (aura.kind) {
    case "pumpSector":
      return { add: aura.sector === project.sector ? aura.bonus : 0, times: 1 };
    case "healEachTurn":
    case "bankPays":
      // The floor half. What each of them does on top happens elsewhere — the
      // mending in auraUpkeep, the payment at the moment a position is closed.
      return { add: aura.sector === project.sector ? aura.bonus : 0, times: 1 };

    case "budgetEachTurn":
    case "drawEachTurn":
    case "morePositions":
    case "giftBudget":
    case "punishWaste":
    case "stripHolders":
    case "burnHand":
      // These pay at the top of the turn rather than into a position. Not a
      // silent skip: auraUpkeep below is exhaustive over the same union, so
      // every kind has to answer in one place or the other, and adding a kind
      // stops both functions compiling until it answers in both.
      return { add: 0, times: 1 };

    case "championProjects":
      // Both halves, and the compiler could not have insisted on the first one:
      // the fields exist, so leaving `add` at nought would have compiled and
      // quietly dropped the floor that makes the card playable at all.
      return {
        add: aura.sector === project.sector ? aura.bonus : 0,
        times: aura.tickers.includes(project.ticker) ? aura.times : 1,
      };
    default:
      return assertNever(aura, "auraOn");
  }
}

/** What this project yields this turn, including built-up pump and influencer auras. */
export function pumpOf(state: State, player: Player, slot: number, index: CardIndex): number {
  const onBoard = state.players[player].projects[slot];
  if (!onBoard) throw new Error(`No project in slot ${slot} for ${player}.`);
  const card = projectById(index, onBoard.cardId);

  let bonus = 0;
  // Multipliers compound. Two champions of the same family cannot happen with
  // the set as it stands — there is one such card — but a rule that is only
  // correct because nothing exercises it is a rule that is wrong the day
  // something does.
  let times = 1;
  for (const entry of state.players[player].support) {
    const supporter = cardById(index, entry.cardId);
    if (supporter.type !== "influencer" && supporter.type !== "tool") {
      throw new Error(
        `Card "${entry.cardId}" sits in support but is a ${supporter.type}, which cannot be there.`,
      );
    }
    // A tool need not carry an aura; an influencer always does.
    if (supporter.aura) {
      const on = auraOn(supporter.aura, card);
      bonus += on.add;
      times *= on.times;
    }
  }
  // Floored at zero. pumpProject takes a negative amount, which is how a card
  // makes a position worth less every turn instead of removing it — but past
  // zero it would start draining market cap, which is a rug paid in
  // instalments and is not what any card printed on it says.
  // The multiplier lands on the position's own pump, then sector auras are
  // added. The other order lets a champion reach through into every other
  // supporter on the table, so two players with identical boards would score
  // differently depending on the order things were played.
  // Tenure, before anything else touches it. A position that has been standing
  // pays more for having stood, and it is read off the turn it was played rather
  // than banked anywhere — so a position that changes hands keeps its age, and a
  // position that is closed and replayed starts again at nothing.
  const held = card.loyalty ? Math.max(0, state.turn - onBoard.playedOnTurn) : 0;
  const loyal = card.loyalty ? 1 + (card.loyalty * held) / 100 : 1;

  const full = Math.max(0, (card.pumpMC * loyal + onBoard.extraPump) * times + bonus);

  // A damaged position pays in proportion to the holders it has left.
  //
  // Measured before this existed: attacking cost 26% more margin per dollar than
  // building and took seven cards to remove one position. The damage landed —
  // 5.84 net holders a match — it just never finished anything, because eleven
  // of the eighteen cards that strip holders hit the whole enemy board for one
  // and six positions chipped by one each is six positions still paying in full.
  // 63.6% of every position that died was killed outright by a table-wide event
  // rather than by damage adding up.
  //
  // So damage counts on its way to a kill instead of only at the end of one. No
  // number on any card changes and no new field exists: holders already mean
  // "how much this survives", and now they also mean "how much of it is left".
  // Healing puts the pump back with the holders, which is the same rule read
  // backwards rather than a second one.
  return Math.round((full * onBoard.holders) / card.holders);
}
