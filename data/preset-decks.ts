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
// not a shuffle of forty cards. That distinction is worth 20 points: against a
// random forty these read 69% to 80%, and against a real deck they read 52% to
// 68%. Benchmarking a deck against an opponent the game no longer fields is how
// you convince yourself everything is fine.
//
// Themes are dropped rather than shipped when they cannot reach that. A deck
// spread across every sector managed 21%: an aura is worth its bonus times the
// number of that sector you hold, so spreading divides exactly what focusing
// multiplies. NFT-only and AI-only both came in around 55% and were left out.
//
// Blue Chips and Toolbox were dropped when the marketing budget arrived. Blue
// Chips is the top-heavy shape by definition, which is the shape this system
// exists to punish: its median seed won 33% and even its best only 56%, against
// 62% to 72% for the three that remain. Toolbox was the same story at 40%. A
// preset that loses two matches in three is a trap however good the name is.
//
// Five themes that were impossible at 177 cards are shipping now. Politics once
// held six projects and one aura card, so a politics deck came out seven cards on
// theme and thirty-three of filler; it holds thirty-three projects and two auras
// today. NFT and AI were both dropped at around 55% and are now 73% and 61%. The
// set growing is what changed, not the idea.
//
// THE TERMINAL was written and cut in the same hour: every tool and influencer in
// the set, and it won 9% on its median seed and 18% on its best. The reason is
// structural rather than a matter of tuning. A deck is forty cards with a floor of
// twelve projects, so a theme built on support cards takes exactly twelve projects
// as filler and twenty-eight cards that do nothing on their own. Auras stack on a
// board with almost nothing to pump, and six positions is the cap regardless. A
// preset that loses nine matches in ten is a trap however good the name is —
// which is the same reason Blue Chips and Toolbox went.
//
// ── THREE, AND NOT FIVE ─────────────────────────────────────────────────────
// This set has four sectors and two of them hold one project family each. A
// preset built on `lunar` or `machine` would be eight cards on theme and
// thirty-two of filler, which is precisely the failure the paragraph above
// describes: it does not lean anywhere, it just picks worse cards than a random
// forty would. They come back when those sectors have company, and the honest
// signal for that is `npx tsx scripts/sector-presence.ts`.
//
// ── THE SEEDS ARE INHERITED AND UNMEASURED ──────────────────────────────────
// Every number in this file was measured against a different set of cards. They
// are kept only because a fixed seed makes a preset the same deck twice, which
// is the other half of what they are for. What they are NOT, today, is chosen —
// so the paragraph above about a seed being worth 8 to 34 points of win rate is
// a warning about this file rather than a description of it.
//
// `npx tsx scripts/preset-seeds.ts` is the thing that fixes that, and it has to
// run before anybody is handed one of these as "the deck to start with".

import { auraOf } from "@/engine/types";
import type { Card } from "@/engine/types";

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
    seed: 7_274,
    prefer: (c) =>
      (c.type === "project" && c.sector === "meme") || auraOf(c)?.sector === "meme",
  },
  {
    id: "memetility",
    name: "MEMETILITY",
    blurb: "Jokes that grew something you can use. Slower, and it compounds.",
    seed: 8_507,
    prefer: (c) =>
      (c.type === "project" && c.sector === "memetility") ||
      auraOf(c)?.sector === "memetility",
  },
  {
    id: "full-contact",
    name: "FULL CONTACT",
    blurb: "Tactics and events over a meme engine. Take their board apart.",
    seed: 8_781,
    prefer: (c) =>
      c.type === "tactic" ||
      c.type === "event" ||
      (c.type === "project" && c.sector === "meme") ||
      auraOf(c)?.sector === "meme",
  },
];
