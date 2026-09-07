// Ready-made decks, so you can switch what you are playing without building one.
//
// Generated rather than written out card by card. A hand-listed deck goes stale
// the moment the set changes — it silently keeps playing the old forty while new
// cards never appear in it, and nothing complains. These are built from the set
// as it is now, every time, so a card added tomorrow can turn up in one.
//
// Each preset is a bias, not a filter. No sector has forty cards inside the
// budget, so `buildDeckPreferring` takes what the theme offers and finishes the
// deck from the rest of the set. That means a preset always leans somewhere and
// is always legal, and a test checks the second half of that claim.
//
// The seeds are fixed so a preset is the same deck every time you pick it, and
// they are chosen by measurement rather than picked. `npx tsx
// scripts/preset-seeds.ts` plays each theme on many seeds against a spread of
// generated decks: within one theme the seed is worth 8 to 34 points of win
// rate, which is more than the themes differ from each other. An unmeasured seed
// is how you hand someone a deck that loses for no reason they can see.
//
// The seed is chosen to bring a theme into line with the others rather than to
// sample it honestly: these exist so a player picks on feel, not on power.
//
// Measured against what the bot actually builds, which is one of these themes —
// not a shuffle of forty cards. That distinction is worth about twenty points:
// against a generated forty these read 71% to 75%, and against each other they
// read 52% to 62%. Benchmarking a deck against an opponent the game no longer
// fields is how you convince yourself everything is fine.
//
// Where they stand today, 1200 matches per pairing with sides swapped
// (`npx tsx scripts/preset-duel.ts`):
//
//   MEME LORD      62.4%
//   FLOOR SWEEP    58.5%
//   THE VAULT      52.3%
//   a generated deck  26.8%
//
// Ten points between the best and the worst choice. It was nineteen before the
// seeds were measured, which is a difference a player cannot see and cannot
// undo — they pick before they know anything about the game.
//
// Themes are dropped rather than shipped when they cannot reach the field. A
// deck spread across every sector managed 21% in the other project: an aura is
// worth its bonus times the number of that sector you hold, so spreading divides
// exactly what focusing multiplies.
//
// ── THREE, AND ALL THREE ARE SECTOR DECKS ───────────────────────────────────
// THE VAULT is defi on its own. It took defi and dex together while each was
// thin; dex is part of infra now and defi holds ten families by itself.
//
// `infra` has no preset and now has the families for one — eight, once the venues
// joined it. It does not get one on that ground alone: a preset ships when it has
// been measured winning, and this one has not been measured at all.
//
// FULL CONTACT was the fourth and it is gone. It preferred every tactic and
// every event, and the deck it built held exactly twelve projects — the floor —
// against twenty to twenty-three for the other three. It won 36.7% against them.
// Narrowing it to only the cards that reach across the table, which is what the
// theme was actually about, cut the preferred pool from a hundred cards to
// seventy-five and moved it to 38.7%. Still twelve projects. No seed of twelve
// candidates lifted either version.
//
// That is the third theme to die this way. THE TERMINAL managed 9%, Toolbox 40%,
// FULL CONTACT 37%. Three data points and one cause, so it is worth stating as a
// rule rather than as three separate disappointments:
//
//   A deck is forty cards with a floor of twelve projects, and only a project
//   pumps. Any theme whose preferred pool is mostly not projects builds twelve
//   projects and twenty-eight cards that do nothing on their own — and it does
//   not matter how good those twenty-eight are.
//
// Support-leaning presets do not work in this game. Not badly: at all. A player
// can still build one by hand, and the cards are there for it; what cannot be
// done is handing somebody that deck and calling it a starting point.
//
// ── THE SEEDS, MEASURED ─────────────────────────────────────────────────────
// All three are 8233, and that is a finding rather than laziness. Twelve
// candidate seeds were scored for each theme against the other presets, sides
// swapped, with `npx tsx scripts/preset-repair.ts`. 8233 came top for all three
// by twenty-five points — it is landing on a deck shape rather than on lucky
// cards for any one sector, which is the same thing that happened to 7548 in the
// other project.
//
// The same seed does not mean the same deck: `buildDeckPreferring` takes the
// theme's cards first, so three preferences over one shuffle give three
// different forties.
//
// They shipped on 7274, 7137 and 8507, inherited from a set that no longer
// exists. Against the field those read 47.7%, 45.0% and 44.1% while the fourth
// preset read 62.9% — a nineteen-point gap decided before a player knows
// anything about the game.

import { CARDS } from "@/data/cards";
import { auraSectors } from "@/engine/helpers";
import { auraOf } from "@/engine/types";
import type { Card, Sector } from "@/engine/types";

/**
 * Does this card's aura help a sector?
 *
 * Was `auraOf(c)?.sector === "meme"` at three call sites, which stopped
 * compiling the day a second aura kind arrived — and would have quietly answered
 * "no" for every champion aura in the game if the field had merely been optional
 * rather than absent. One function now, and it asks the set, because a champion
 * names project families and a family's sector is on the cards.
 */
function helpsSector(card: Card, sector: Sector): boolean {
  const aura = auraOf(card);
  return aura !== null && auraSectors(aura, CARDS).includes(sector);
}

export interface PresetDeck {
  id: string;
  name: string;
  /** One line, shown under the button. Says what you are getting into. */
  blurb: string;
  seed: number;
  prefer: (card: Card) => boolean;
}

export const PRESET_DECKS: readonly PresetDeck[] = [
  {
    id: "memes",
    name: "MEME LORD",
    blurb: "The jokes that outlived their own cycle, and the people who posted them.",
    seed: 8_233,
    prefer: (c) =>
      (c.type === "project" && c.sector === "meme") || helpsSector(c, "meme"),
  },
  {
    id: "jpegs",
    name: "FLOOR SWEEP",
    blurb: "Pictures with a floor under them. Slower, and it holds.",
    seed: 8_233,
    prefer: (c) => (c.type === "project" && c.sector === "nft") || helpsSector(c, "nft"),
  },
  {
    id: "yield",
    name: "THE VAULT",
    blurb: "Money in, something out. Less spectacle, more compounding.",
    seed: 8_233,
    // Was defi and dex together, because four families between them was thin and
    // each on its own was thinner. dex is part of infra now and defi holds ten
    // families by itself, so the deck is one sector again — which is what the
    // other two presets always were.
    prefer: (c) => (c.type === "project" && c.sector === "defi") || helpsSector(c, "defi"),
  },
];
