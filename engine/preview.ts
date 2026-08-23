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
import { projectById } from "./helpers";
import { applyMove, needsPortfolioSlot, upgradesAPosition } from "./match";
import type { Aura, AuraKind, Card, CardIndex, Effect, Player, Sector, State } from "./types";
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
  state: State,
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
  state: State,
  aura: Aura,
  player: Player,
  index: CardIndex,
): PreviewSlot[] {
  const kind: AuraKind = aura.kind;
  switch (kind) {
    case "pumpSector":
      return inSectors(state, "allOwnProjects", player, index, new Set([aura.sector]), "helps");
    default:
      return assertNever(kind, "slotsForAura");
  }
}

function slotsFor(
  state: State,
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
    case "cancel":
    case "extraBudget":
      return [];

    default:
      return assertNever(effect, "slotsFor");
  }
}

function playersFor(
  state: State,
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
        effect.amount >= slot.holders,
      );

    // These leave market cap alone.
    case "pumpProject":
    case "pumpBySector":
    case "healHolders":
    case "drawCards":
    case "cancel":
    case "extraBudget":
      return [];

    default:
      return assertNever(effect, "playersFor");
  }
}

/** Owners who would lose market cap, optionally only when a position actually dies. */
function ownersWithProjects(
  state: State,
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
function inSectors(
  state: State,
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

function collect(
  state: State,
  target: Parameters<typeof ownersOf>[0],
  player: Player,
  impact: Impact,
): PreviewSlot[] {
  const certain = !needsChoice(target);
  const found: PreviewSlot[] = [];
  for (const owner of ownersOf(target, player)) {
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
export function mcDeltaOf(
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
