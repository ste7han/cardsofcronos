// The match you can play without a wallet.
//
// Nothing on this site is for sale yet, so a visitor arriving before the mint
// gets a locked deck builder and a table with nothing on it — correct, and a
// poor way to find out what the game is. The demo is one deck, handed over for
// the length of a match and kept by nobody.
//
// It is a real match: same engine, same bot, same ten turns. What it is not is a
// collection. Nothing is written, nothing is saved, and the table says so while
// you play, because a free deck that looks like cards you own is the exact
// confusion the mint page spends three paragraphs avoiding.
//
// One of the ready-made themes rather than a deck written out here. A
// hand-listed forty goes stale the moment the set changes — it keeps playing the
// old cards while new ones never appear, and nothing complains. See
// data/preset-decks.ts, where the seeds are measured rather than picked.

import { PRESET_DECKS } from "@/data/preset-decks";
import { BOARDS, opponentDeck, type Board } from "@/data/boards";
import { buildDeckPreferring } from "@/engine/deck";
import { SET } from "@/lib/set";

/** Which theme a stranger meets first. The most recognisable one. */
const THEME_ID = "memes";

export const DEMO_THEME = (() => {
  const theme = PRESET_DECKS.find((deck) => deck.id === THEME_ID);
  if (!theme) {
    // Loud, at import. A missing preset would otherwise leave the demo button
    // dealing an empty deck into a table that reports "nothing to play with" —
    // which reads as a rule rather than as a broken lookup.
    throw new Error(
      `No preset deck with id "${THEME_ID}". lib/demo.ts needs one that exists; ` +
        `data/preset-decks.ts has ${PRESET_DECKS.map((d) => d.id).join(", ")}.`,
    );
  }
  return theme;
})();

/**
 * Just the theme's name.
 *
 * The screens that show it add their own "demo" wherever it belongs, and baking
 * it in here made the turn bar read "MEME LORD · DEMO · NOT SAVED" — three
 * separators saying two things.
 */
export const DEMO_DECK_NAME = DEMO_THEME.name;

/** The forty cards, built from the set as it is now. */
export function demoDeck(): string[] {
  return buildDeckPreferring(SET, DEMO_THEME.seed, DEMO_THEME.prefer);
}

/**
 * A theme for the opponent that is not the one being demonstrated.
 *
 * A mirror match is fair and dull, and this is the one match some people will
 * ever see. Falls back to the demo's own theme rather than throwing, because a
 * set with a single preset is a strange state but not a broken one.
 */
export function demoOpponentTheme(seed: number) {
  const others = PRESET_DECKS.filter((deck) => deck.id !== THEME_ID);
  return others[seed % others.length] ?? DEMO_THEME;
}

/**
 * Both decks of a demo match, from the seed alone.
 *
 * One definition, used by the table that deals it and by the server that checks
 * it afterwards. Two copies would be two ways to build the same match, and the
 * day they drifted every submitted demo would fail to replay with nothing to
 * point at.
 */
export function demoDecks(
  seed: number,
  board: Board = BOARDS[0]!,
): { you: string[]; opponent: string[] } {
  return {
    you: demoDeck(),
    // THE BOARD DECIDES THE OPPONENT, even in a demo. It did not, and a player
    // who picked Loaded Lions and pressed the demo button faced something else
    // entirely with nothing saying so.
    //
    // The plain board keeps its own rule, which is the reason this function
    // existed in the first place: the opponent is drawn from the themes that are
    // NOT the borrowed deck's, so a demo is never a mirror match. A family
    // board has one deck by design and that does not apply to it.
    //
    // The same +7919 the table has always used. It is here rather than there
    // because the server has to reproduce it exactly.
    opponent:
      board.opponent.kind === "family"
        ? opponentDeck(SET, board, seed)
        : buildDeckPreferring(SET, seed + 7919, demoOpponentTheme(seed).prefer),
  };
}
