// What a card would touch, worked out before it is played.
//
// This lives in the engine rather than the UI on purpose. It is derived from the
// effect, so the switch below is exhaustive and ends on assertNever(): add an
// effect variant and this breaks at compile time instead of quietly showing no
// highlight at all. A preview that silently covers nothing is the same class of
// bug as a card that silently does nothing.
//
// And it happened anyway, to 128 cards, because the guard was pointed at the one
// thing that could not slip past it. This function used to return early on
// `!card.effect`, and an Aura is deliberately not an Effect — so hovering Murad,
// whose whole job is to pump every meme you hold, lit up nothing at all. 32 cards
// carry an aura and no effect and previewed as blank; 7 more carry both and
// previewed only half of themselves.
//
// The exhaustive switch was never going to catch that. It guards the inside of a
// branch those cards never entered.

import { assertNever } from "./effects";
import { otherPlayer, projectById } from "./helpers";
import { applyMove, needsPortfolioSlot, upgradesAPosition } from "./match";
import type { Aura, AuraKind, Boards, Card, CardIndex, Effect, Player, Sector, State } from "./types";

import { IllegalMove, auraOf, needsChoice, ownersOf, playersOf } from "./types";

/** Whether the card makes the thing it touches better or worse. */
export type Impact = "helps" | "hurts";

export interface PreviewSlot {
  owner: Player;
  slot: number;
  impact: Impact;
  /**
   * True when the effect definitely lands here. False when the player will pick
   * one of these — a candidate rather than a certainty, and worth showing
   * differently so the preview doesn't promise more than it knows.
   */
  certain: boolean;
}

export interface Preview {
  /** Positions on the board this card would touch. */
  slots: PreviewSlot[];
  /** Players whose market cap this card would move. */
  players: Array<{ player: Player; impact: Impact }>;
}

export const EMPTY_PREVIEW: Preview = { slots: [], players: [] };

/**
 * Everything the given card would touch if played right now.
 *
 * Takes the card index because a sector-filtered highlight has to read the
 * sector of each position on the board, and a position stores a card id rather
 * than a card.
 */
export function previewOf(
  state: Boards,
  card: Card,
  player: Player,
  index: CardIndex,
): Preview {
  const slots: PreviewSlot[] = [];

  // A project going into a full portfolio asks which position to close first.
  // That is a real consequence of playing it, so it belongs in the preview.
  //
  // Unless it is an upgrade, which needsPortfolioSlot now answers for both of us.
  // A mythic WIF played over a rare WIF replaces that position rather than adding
  // to the count, so nothing is sacrificed and washing all six red says the
  // opposite of what happens.
  if (needsPortfolioSlot(state, card, player, index)) {
    state.players[player].projects.forEach((_, slot) =>
      slots.push({ owner: player, slot, impact: "hurts", certain: false }),
    );
  }

  // The position this card takes over, marked as the help it is. Without this the
  // upgrade previews as nothing at all on the very position it changes.
  if (card.type === "project" && upgradesAPosition(state, card, player, index)) {
    const slot = state.players[player].projects.findIndex(
      (position) => projectById(index, position.cardId).project === card.project,
    );
    if (slot !== -1) slots.push({ owner: player, slot, impact: "helps", certain: true });
  }

  // The aura, which is the half that used to be missing. It is a standing bonus
  // rather than a one-off, so it never moves market cap on the turn it is
  // played — it lights up the board and leaves the counters alone.
  const aura = auraOf(card);
  if (aura) slots.push(...slotsForAura(state, aura, player, index));

  if (!card.effect) return { slots: dedupe(slots), players: [] };

  return {
    slots: dedupe([...slots, ...slotsFor(state, card.effect, player, index)]),
    players: playersFor(state, card.effect, player),
  };
}

/**
 * One highlight per position, chosen deliberately.
 *
 * A slot can be reached twice. Play a project into a full portfolio and every
 * position becomes a candidate to close; if that project also pumps a sector,
 * one of them is both "you might close this" and "this gets pumped". The board
 * paints one colour per position, so something has to win, and the UI was
 * picking whichever landed in the array first — a silent precedence rule nobody
 * chose.
 *
 * The warning wins. Closing a position is a decision the player has to make on
 * this click, and it is shown by washing the whole portfolio in one colour;
 * turning one of those six green would read as "this one is safe" when it is
 * exactly as closable as the others. The pump is a consequence of a choice not
 * yet made, so it waits.
 */
function dedupe(slots: PreviewSlot[]): PreviewSlot[] {
  const best = new Map<string, PreviewSlot>();
  for (const slot of slots) {
    const key = `${slot.owner}:${slot.slot}`;
    const held = best.get(key);
    if (!held || (held.impact === "helps" && slot.impact === "hurts")) best.set(key, slot);
  }
  return [...best.values()];
}

/**
 * The positions an aura would pump: your own board, filtered to its sector.
 *
 * Exhaustive on the aura kind for the same reason the effect switch is — a
 * second kind of aura must not default to highlighting nothing.
 */
function slotsForAura(
  state: Boards,
  aura: Aura,
  player: Player,
  index: CardIndex,
): PreviewSlot[] {
  // Switched on the object rather than on a copied kind. With one variant a copy
  // was the only way to make the default branch `never`; with two, narrowing is
  // what the switch is for, and a copy narrows nothing — every field access in
  // every branch stops compiling. The union having grown is what makes the
  // ordinary pattern work again.
  switch (aura.kind) {
    case "pumpSector":
      return inSectors(state, "allOwnProjects", player, index, new Set([aura.sector]), "helps");
    case "budgetEachTurn":
    case "drawEachTurn":
      // Nothing on the board to point at: these hand the player a resource, not
      // a bonus to a position. An empty list is honest, and the card still reads
      // because its rules text says what it does.
      return [];
    case "bankPays":
      // Its sector, like any flat aura. What it pays happens on a move rather
      // than on a board, so there is nothing extra to point at.
      return inSectors(state, "allOwnProjects", player, index, new Set([aura.sector]), "helps");
    case "healEachTurn":
      // Its sector, and anything damaged. A board with nothing hurt still lights
      // up, because the floor is still paying — which is the point of the floor.
      return [
        ...inSectors(state, "allOwnProjects", player, index, new Set([aura.sector]), "helps"),
        ...state.players[player].projects.flatMap((held, slot) =>
          held.holders < projectById(index, held.cardId).holders
            ? [{ owner: player, slot, impact: "helps" as const, certain: true }]
            : [],
        ),
      ].filter((slot, i, all) => all.findIndex((o) => o.slot === slot.slot) === i);
    case "morePositions":
    case "punishWaste":
      // A rule change and a tax, neither of which points at a position.
      return [];
    case "giftBudget":
      return [];
    case "stripHolders":
      // Every position they hold is a candidate and none is certain, which is
      // exactly what `certain: false` is for — the preview must not promise a
      // slot the dice have not picked yet.
      return state.players[otherPlayer(player)].projects.map((_, slot) => ({
        owner: otherPlayer(player),
        slot,
        impact: "hurts" as const,
        certain: false,
      }));
    case "burnHand":
      // Hands are not slots. Nothing to point at, and the rules text carries it.
      return [];
    case "championProjects": {
      // Both halves. The sector positions get lifted and the family positions
      // get doubled, and a preview that showed only the exciting half would tell
      // the player this card does nothing on a board it is quietly helping.
      //
      // Deduplicated by slot: a family project usually sits in the champion's own
      // sector, so it is caught twice and would otherwise be drawn twice.
      const lit = [
        ...inSectors(state, "allOwnProjects", player, index, new Set([aura.sector]), "helps"),
        ...inFamilies(state, "allOwnProjects", player, index, new Set(aura.tickers), "helps"),
      ];
      const seen = new Set<string>();
      return lit.filter((slot) => {
        const key = `${slot.owner}:${slot.slot}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    default:
      return assertNever(aura, "slotsForAura");
  }
}

function slotsFor(
  state: Boards,
  effect: Effect,
  player: Player,
  index: CardIndex,
): PreviewSlot[] {
  switch (effect.kind) {
    case "pumpProject":
      return collect(state, effect.target, player, effect.mc > 0 ? "helps" : "hurts");
    case "pumpBySector":
      // Only the sectors that actually get something. This used to highlight
      // every targeted slot and say so in a comment — the index was not passed
      // in, so it could not tell. It is passed in now. Highlighting a meme
      // position for a card that pays infra and DeFi is the preview promising
      // something the card does not do, which is the one thing it must never do.
      return inSectors(
        state,
        effect.target,
        player,
        index,
        new Set(Object.keys(effect.bonuses) as Sector[]),
        "helps",
      );
    case "healHolders":
      return collect(state, effect.target, player, "helps");
    case "damageHolders":
    case "rug":
      return collect(state, effect.target, player, "hurts");

    // These never touch a position on the board.
    case "directMC":
    case "scaleMC":
    case "stealMC":
    case "drawCards":
    case "discardCards":
    case "cancel":
    case "extraBudget":
      // Hands and the support row are not slots. Nothing to point at, and the
      // rules text on the card carries it.
      return [];

    // takeOver was in the list above as well as here, and a switch takes the
    // first match — so it pointed at nothing and the branch below never ran.
    // Nothing failed: the preview simply highlighted no position for a card
    // whose whole point is which position it takes. The bundler found it as a
    // duplicate case clause. No test did, because a preview that returns an
    // empty list looks exactly like a card that touches no slots.
    case "takeOver":
      // Their strongest, which is the one this will take. Certain, because the
      // engine picks it rather than the player.
      return bestEnemyPosition(state, player, index);

    case "comebackMC":
      // Market cap only. It points at no position, so nothing on the board
      // lights up for it.
      return [];

    case "mcPerHolderLost":
    case "mcPerPositionGone":
    case "refundMC":
      // Counts what has already happened. There is no position to point at.
      return [];

    case "burnForDamage":
      // Your own board, and one of them is going — or all of them. Marked as a
      // loss because it is one; what it buys happens on the other side of the
      // table.
      return collect(state, effect.target === "allOwnProjects" ? "allOwnProjects" : "ownProject", player, "hurts");

    case "attach":
      return collect(state, effect.target, player, effect.target === "ownProject" ? "helps" : "hurts");

    case "scalePump":
      return collect(state, effect.target, player, effect.percentage > 0 ? "helps" : "hurts");

    case "budgetToMC":
    case "peekAndBurn":
      return [];

    case "peakMC":
      // Market cap only. Nothing on the board to point at.
      return [];

    case "benchmark":
      return collect(state, effect.target, player, "helps");

    case "merge":
      // Every position you hold is about to become one of them.
      return collect(state, "allOwnProjects", player, "helps");

    case "fork":
      // Points at nothing: the copy lands in a slot that does not exist yet.
      return [];

    case "recoverCard":
      // It moves a card between two piles and never touches the board.
      return [];

    case "unbankedMC":
      // It reads the board and pays a market cap; it does not land on a slot.
      return [];

    case "after":
      // The wait is invisible; what it will do to a position is not. Points at
      // whatever the wrapped effect points at, so marking a position lights that
      // position up at the moment you choose it.
      return slotsFor(state, effect.effect, player, index);

    default:
      return assertNever(effect, "slotsFor");
  }
}

function playersFor(
  state: Boards,
  effect: Effect,
  player: Player,
): Array<{ player: Player; impact: Impact }> {
  const other: Player = player === "you" ? "opponent" : "you";

  switch (effect.kind) {
    case "directMC":
      return playersOf(effect.target, player).map((p) => ({
        player: p,
        impact: effect.mc > 0 ? ("helps" as const) : ("hurts" as const),
      }));
    case "scaleMC":
      return playersOf(effect.target, player).map((p) => ({
        player: p,
        impact: effect.percentage > 0 ? ("helps" as const) : ("hurts" as const),
      }));
    case "stealMC":
      // Moves market cap across the table: one side up, the other down.
      return [
        { player, impact: "helps" },
        { player: other, impact: "hurts" },
      ];

    // A rug takes back everything the position produced, so it moves market cap
    // even though it is aimed at the board.
    case "rug":
      return ownersWithProjects(state, effect.target, player);

    // Damage only touches market cap when it is lethal — so work out whether it
    // actually is, rather than warning about it either always or never.
    case "damageHolders":
      return ownersWithProjects(state, effect.target, player, (slot) =>
        effect.amount === "all" ? true : effect.amount >= slot.holders,
      );

    // These leave market cap alone.
    case "comebackMC":
      // Yours, and only when there is a gap to give back. Read off the board
      // rather than assumed, because a preview that lights up your market cap
      // and then adds nothing to it is a preview that lied.
      return state.players[other].mc > state.players[player].mc
        ? [{ player, impact: "helps" as const }]
        : [];

    case "pumpProject":
    case "pumpBySector":
    case "healHolders":
    case "drawCards":
    case "cancel":
    case "extraBudget":
    case "discardCards":
    case "takeOver":
      // takeOver moves a position rather than market cap. The board changes and
      // the totals do not, this turn — which is exactly why it belongs here and
      // not among the market-cap movers.
      return [];

    case "mcPerHolderLost":
    case "mcPerPositionGone":
    case "refundMC":
      return [{ player, impact: "helps" }];

    case "budgetToMC":
    case "merge":
    case "fork":
      return [{ player, impact: "helps" }];

    case "peakMC":
      return [{ player, impact: "helps" }];

    case "benchmark":
      // It changes what a position will pay from next turn, not this one.
      return [];

    case "peekAndBurn":
      // It costs them a card, not market cap. Nothing on the scoreboard moves.
      return [];

    // Neither moves a market cap on the turn it is played: one hangs something
    // up, the other changes what a position will pay from next turn.
    case "attach":
    case "scalePump":
      return [];

    case "burnForDamage":
      // Both sides of the table when something comes back, and the table should
      // show that before the card is played rather than after.
      return effect.keep
        ? [{ player: other, impact: "hurts" }, { player, impact: "helps" }]
        : [{ player: other, impact: "hurts" }];

    case "recoverCard":
      // A card back in hand is worth something and it is not market cap, so no
      // scoreboard moves and the preview says nothing rather than a wrong number.
      return [];

    case "unbankedMC":
      return [{ player, impact: "helps" }];

    case "after":
      // Nothing moves this turn. Saying otherwise would put a number on the card
      // that the scoreboard is about to disagree with.
      return [];

    default:
      return assertNever(effect, "playersFor");
  }
}

/** Owners who would lose market cap, optionally only when a position actually dies. */
function ownersWithProjects(
  state: Boards,
  target: Parameters<typeof ownersOf>[0],
  player: Player,
  lethal?: (slot: { holders: number }) => boolean,
): Array<{ player: Player; impact: Impact }> {
  const hit: Array<{ player: Player; impact: Impact }> = [];
  for (const owner of ownersOf(target, player)) {
    const dies = state.players[owner].projects.some((p) => (lethal ? lethal(p) : true));
    if (dies) hit.push({ player: owner, impact: "hurts" });
  }
  return hit;
}

/** collect, narrowed to positions whose sector is in the set. */
/** The opponent's strongest position — the one takeOver will lift. */
function bestEnemyPosition(state: Boards, player: Player, index: CardIndex): PreviewSlot[] {
  const other = otherPlayer(player);
  const theirs = state.players[other].projects;
  if (theirs.length === 0) return [];
  let best = 0;
  for (let i = 1; i < theirs.length; i++) {
    const a = projectById(index, theirs[i]!.cardId);
    const b = projectById(index, theirs[best]!.cardId);
    if (a.pumpMC + theirs[i]!.extraPump > b.pumpMC + theirs[best]!.extraPump) best = i;
  }
  return [{ owner: other, slot: best, impact: "hurts", certain: true }];
}

function inSectors(
  state: Boards,
  target: Parameters<typeof ownersOf>[0],
  player: Player,
  index: CardIndex,
  sectors: ReadonlySet<Sector>,
  impact: Impact,
): PreviewSlot[] {
  const certain = !needsChoice(target);
  const found: PreviewSlot[] = [];
  for (const owner of ownersOf(target, player)) {
    state.players[owner].projects.forEach((position, slot) => {
      if (sectors.has(projectById(index, position.cardId).sector)) {
        found.push({ owner, slot, impact, certain });
      }
    });
  }
  return found;
}

/** The same as inSectors, by project family — keyed on ticker, as the auras are. */
function inFamilies(
  state: Boards,
  target: Parameters<typeof ownersOf>[0],
  player: Player,
  index: CardIndex,
  families: ReadonlySet<string>,
  impact: Impact,
): PreviewSlot[] {
  const certain = !needsChoice(target);
  const found: PreviewSlot[] = [];
  for (const owner of ownersOf(target, player)) {
    state.players[owner].projects.forEach((position, slot) => {
      if (families.has(projectById(index, position.cardId).ticker)) {
        found.push({ owner, slot, impact, certain });
      }
    });
  }
  return found;
}

/**
 * What a position yields, for picking the biggest in a preview.
 *
 * The preview is handed a Boards and not a State, so it cannot call pumpOf —
 * that needs the card index. Printed pump plus what has been stacked on it is
 * the same ordering in every case the preview can see, and being one place out
 * on a highlight is a smaller wrong than the preview not existing.
 */
function yieldOf(state: Boards, owner: Player, slot: number): number {
  const at = state.players[owner].projects[slot];
  return at ? at.extraPump : 0;
}

function collect(
  state: Boards,
  target: Parameters<typeof ownersOf>[0],
  player: Player,
  impact: Impact,
): PreviewSlot[] {
  const certain = !needsChoice(target);
  const found: PreviewSlot[] = [];
  for (const owner of ownersOf(target, player)) {
    // Aimed by the card at one position, so exactly one lights up — and it is
    // certain, because nobody is going to choose differently.
    if (target === "enemyBest") {
      const board = state.players[owner].projects;
      if (board.length === 0) continue;
      let best = 0;
      for (let slot = 1; slot < board.length; slot++) {
        if (yieldOf(state, owner, slot) > yieldOf(state, owner, best)) best = slot;
      }
      found.push({ owner, slot: best, impact, certain: true });
      continue;
    }
    state.players[owner].projects.forEach((_, slot) =>
      found.push({ owner, slot, impact, certain }),
    );
  }
  return found;
}

/**
 * Exactly what playing this card would do to both market caps, or null when it
 * cannot be known yet.
 *
 * It runs the move through the engine and takes the difference, rather than
 * predicting it a second way. A parallel estimate is a second implementation of
 * the rules that nobody updates, and the day it disagrees with the engine the
 * screen is lying to the player about their own move — the same failure as card
 * text that overstates an effect, in real time.
 *
 * `applyMove` returns a new state and leaves the old one alone, so this costs a
 * throwaway state and nothing else. Null means the card needs a target the player
 * has not picked, or is not playable: both are cases where no honest number
 * exists.
 */
/**
 * What playing this card does to the marketing budget you have left this turn.
 *
 * Answered the way mcDeltaOf answers: by playing the move and looking at the
 * difference. That matters more here than it does for market cap, because the
 * price of a card is not what is printed on it. A tax from the other side of the
 * table raises it, a discount lowers it, a card out of the discard costs half,
 * and a card may hand budget back on the way in. Adding those up by hand in the
 * UI would be a second implementation of priceFor that drifts from the first;
 * playing the move cannot drift.
 *
 * `spendable` is the whole answer and it is signed: -$40K means the card takes
 * that much, +$60K means you end up with more than you started the hover with.
 * `price` is what it cost before anything it gave back, so the two can be shown
 * apart on a card that does both.
 *
 * A free play makes `price` zero, which is the point of a free play.
 */
export function budgetDeltaOf(
  state: State,
  handIndex: number,
  index: CardIndex,
): { spendable: number; price: number } | null {
  const cardId = state.players[state.toMove].hand[handIndex];
  if (cardId === undefined) return null;
  const before = state.budgetThisTurn - state.budgetSpentThisTurn;
  try {
    const after = applyMove(state, { kind: "playCard", handIndex }, index);
    return {
      spendable: after.budgetThisTurn - after.budgetSpentThisTurn - before,
      price: after.budgetSpentThisTurn - state.budgetSpentThisTurn,
    };
  } catch (error) {
    // Same rule as mcDeltaOf: a refused move is an answer, anything else is a
    // fault worth crashing on rather than showing as a blank box.
    if (error instanceof IllegalMove) return null;
    throw error;
  }
}

export function mcDeltaOf(
  // A State, unlike everything above it. This one answers by actually playing
  // the move and looking at the difference, so it needs the deck to draw from
  // and the PRNG to draw with — which is exactly what a PvP client may not
  // hold. The PvP table gets this number off the view instead; see HandCardView.
  state: State,
  handIndex: number,
  index: CardIndex,
): { you: number; opponent: number } | null {
  try {
    const after = applyMove(state, { kind: "playCard", handIndex }, index);
    return {
      you: after.players.you.mc - state.players.you.mc,
      opponent: after.players.opponent.mc - state.players.opponent.mc,
    };
  } catch (error) {
    // Only a move the rules refuse is an answer. Anything else is a fault in the
    // engine, and swallowing it here turns a crash into an empty box on a card —
    // the player sees nothing missing and neither does anyone else.
    if (error instanceof IllegalMove) return null;
    throw error;
  }
}
