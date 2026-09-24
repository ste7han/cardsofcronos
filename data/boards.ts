// The opponents you can play for a prize, and what it takes to face them.
//
// One list, because four things have to agree about what a board is: the table
// that stores scores, the route that accepts them, the page that shows them, and
// the contract that pays them. A board added in three of those and forgotten in
// the fourth is a leaderboard nobody can win.
//
// ── THE ID IS ON CHAIN ───────────────────────────────────────────────────────
//
// contracts/PrizePot.sol keys a board by `bytes32`, which is eight bytes of
// ASCII here rather than a hash: "bot", "lions". Short on purpose, so a name in
// a transaction on an explorer is readable rather than a digest. The owner sets
// each board's share of the pot against exactly this string, so changing an id
// after a share is set orphans the share — which is why the ids are checked at
// load for the shape the contract can hold.
//
// ── WHAT LOCKS A BOARD ───────────────────────────────────────────────────────
//
// `needs` is a $LION balance, in whole tokens. Null means anyone may play it.
//
// The lock is real rather than cosmetic: app/api/tournament reads the balance
// off the chain before it accepts a score. engine/deck.ts already says why,
// about a different rule — "in Cards of Cronos the card check was a UI filter,
// so a direct call could play anything; a rule that only the screen enforces is
// not a rule".
//
// ── WHY THE LIONS DECK IS BUILT DIFFERENTLY ──────────────────────────────────
//
// The ordinary bot picks one of the player presets, which are a bias towards a
// sector. The Loaded Lions opponent is a family deck: every one of the eight
// lion cards, and support chosen by what those cards actually do — see
// engine/affinity.ts. A preset cannot do that, because the generator it uses
// caps a deck at two cards of any one project.

import type { Card } from "@/engine/types";
import { buildDeckPreferring, buildFamilyDeck } from "@/engine/deck";
import { CARDS } from "@/data/cards";
import { PRESET_DECKS } from "@/data/preset-decks";
import { LION } from "@/lib/revenue";

export interface Board {
  /** Eight bytes of ASCII at most: it is a bytes32 on chain. */
  id: string;
  name: string;
  /** One line, shown under the name. Says who you are up against. */
  blurb: string;
  /**
   * How the opponent's deck is built.
   *
   * "preset" is the ordinary bot, which picks a themed deck from the seed the
   * way it always has. "family" builds a deck around one project family.
   */
  opponent: { kind: "preset" } | { kind: "family"; family: string; seed: number };
  /** Whole $LION needed to play for this board's prize, or null for open. */
  needs: { token: string; whole: number } | null;
  /**
   * The card whose art is this board's face.
   *
   * A portrait rather than a name in a box. This is a card game and the page
   * that starts one was showing no cards at all — two bordered rectangles of
   * text, which told you what you were choosing between and nothing about why
   * you would want either.
   *
   * A card id and not a file, so the picture is one this set already ships and
   * cannot go missing: /api/boards resolves it the same way a card does.
   */
  face: string;
}

export const BOARDS: readonly Board[] = [
  {
    id: "bot",
    name: "THE MARKET",
    blurb: "The ordinary opponent, playing one of the themed decks.",
    opponent: { kind: "preset" },
    needs: null,
    // The market itself, as a card. It plays the themed decks, so no single
    // project stands for it — an event does.
    face: "supercycle",
  },
  {
    id: "lions",
    name: "LOADED LIONS",
    blurb: "All eight lions and a board built to hold them. Held back for holders.",
    /**
     * Seed 21275, measured rather than chosen — see scripts/lions-seed.ts.
     *
     * The seed is worth forty points here, wider than the 8 to 34 that
     * data/preset-decks.ts documents for the player presets. 21275 is not the
     * strongest seed found; it is the flattest, reading 48/40/50/48 against the
     * three presets and a generated deck where the strongest swings from 37 to
     * 57. An opponent should be the same fight whatever somebody brings.
     */
    opponent: { kind: "family", family: "lions", seed: 21_275 },
    /**
     * A hundred thousand $LION of a hundred billion: a millionth of the supply.
     *
     * A starting position and not a settled one. It is low on purpose — the
     * point is that holding the token opens something, not that only whales
     * play. Raising it later locks people out of a board they have been
     * playing, so it is easier to start low and mean it.
     */
    needs: { token: LION, whole: 100_000 },
    // Their mythic: the one card the deck is built around, and the one somebody
    // will remember losing to.
    face: "lions-viii",
  },
];

/** A board by id, or undefined. The routes turn that into a 404. */
export function boardOf(id: string): Board | undefined {
  return BOARDS.find((board) => board.id === id);
}

/**
 * Checked at load, because every one of these is a mistake that looks fine.
 *
 * A duplicate id silently merges two leaderboards. An id the contract cannot
 * hold fails at the moment a week is closed, which is once a week and after
 * everybody has already played. Both are cheaper to find here.
 */
{
  const seen = new Set<string>();
  for (const board of BOARDS) {
    if (!/^[a-z0-9-]{1,31}$/.test(board.id)) {
      throw new Error(
        `Board id "${board.id}" is not up to 31 lowercase bytes, which is what a bytes32 holds.`,
      );
    }
    // A face that is not a card draws nothing, and draws nothing quietly: the
    // picker would fall back to a bordered rectangle of text and look exactly
    // like it did before the faces existed. data/cards.ts rather than lib/set,
    // which imports this file back.
    if (!CARDS.some((card) => card.id === board.face)) {
      throw new Error(`Board "${board.id}" has face "${board.face}", which is not a card.`);
    }
    if (seen.has(board.id)) throw new Error(`Two boards share the id "${board.id}".`);
    seen.add(board.id);

    if (board.needs !== null && board.needs.whole <= 0) {
      throw new Error(`Board "${board.id}" needs ${board.needs.whole} tokens, which locks nobody out.`);
    }
  }
  if (BOARDS.find((board) => board.id === "bot") === undefined) {
    // Everything that existed before boards did is on this one, including every
    // score already in the table.
    throw new Error('The "bot" board is what the plain opponent is called and it has to exist.');
  }
}

/**
 * The deck the opponent plays, for a board and a seed.
 *
 * ONE PLACE, because two have to agree exactly. The browser builds this deck to
 * play against and the server builds it again to replay the match and check the
 * score — and if they build forty different cards, every honest submission is
 * refused and nothing says why. It was written out twice before boards existed,
 * in components/game/Game.tsx and in app/api/tournament, with a comment in the
 * route asking the next person to keep them in step by hand.
 *
 * The offset of 7919 is what the bot's deck has always been seeded with: far
 * enough from the match seed that the two decks are not related, and fixed so a
 * match replays.
 */
export function opponentDeck(cards: readonly Card[], board: Board, seed: number): string[] {
  if (board.opponent.kind === "family") {
    // A family deck ignores the match seed. The whole point of this opponent is
    // that it is the SAME measured deck every time — the seed it was chosen on
    // is worth forty points, so letting the match reshuffle it would hand back
    // exactly the variance the measurement removed.
    return buildFamilyDeck(cards, board.opponent.family, board.opponent.seed);
  }
  const theme = PRESET_DECKS[seed % PRESET_DECKS.length]!;
  return buildDeckPreferring(cards, seed + 7919, theme.prefer);
}
