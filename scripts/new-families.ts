// The fifteen project families that were agreed and not built.
//
// Eight cards each — two commons, two rares, two epics, a legendary and a mythic,
// numbered I to VIII — which is 120 cards and takes the set from 234 to 354.
//
// WHAT IS HERE: the name, the ticker, the sector, the rarity and the three
// numbers. That is a card the engine can deal, hold, pump and rug.
//
// WHAT IS NOT, AND WHY.
//
// No flavour. The line on a project card says something about a real project on
// this chain, and `CLAUDE.md` has the rule: sourced or it is not written. Nobody
// writing this file knows what Ballz or Puush or Loaf is known for. The nineteen
// founder cards that just left the set are the worked example — they carried
// invented lines like "Three years of the same avatar and the same two-line
// updates" and it read as true, which is exactly the problem.
//
// No effects. That is the next pass and it was named as the next pass: the list
// first, then what the cards do. A project with a launch and a pump is not an
// empty card; it opens a position and it pays every turn.
//
// THE NUMBERS ARE THE SET'S OWN MEDIANS, per rarity, measured off the nineteen
// families already here: 15/9/3, 26/15/3, 40/25/4, 67/42/5, 110/56/6. Every new
// family gets the same ones. That is deliberate — a family's numbers should move
// when its character is decided, and inventing a spread now would be fake
// precision that later work would have to unpick.
//
// THE TICKERS ARE A GUESS where the project's real one is not simply its name,
// and they are the one thing in here that states a fact. Worth a pass by somebody
// who knows.
//
// CAW777 had to move first. It held both the project key `caw` and the ticker
// `CAW`, and one of the new families is a project actually called CAW. It is
// `caw777` now, with `CAW777` on it, which is its own name either way.
//
//   npx tsx scripts/new-families.ts            # read it
//   npx tsx scripts/new-families.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Rarity, Sector } from "../engine/types";

interface Family {
  /** The project key, and the prefix of all eight card ids. */
  key: string;
  name: string;
  ticker: string;
  sector: Sector;
}

const FAMILIES: Family[] = [
  // ---- meme --------------------------------------------------------------
  { key: "caw", name: "CAW", ticker: "CAW", sector: "meme" },
  // "Mistery on CRO" is its name; Mery is its NFT collection, and the key and
  // ticker follow the collection because the ticker does.
  { key: "mery", name: "Mistery", ticker: "MERY", sector: "meme" },
  { key: "capybara", name: "Capybara Nation", ticker: "CAPY", sector: "meme" },
  { key: "loaf", name: "Loaf", ticker: "LOAF", sector: "meme" },
  { key: "ballz", name: "Ballz", ticker: "BALLZ", sector: "meme" },

  // ---- nft ---------------------------------------------------------------
  { key: "ryoshi", name: "Ryoshi", ticker: "RYOSHI", sector: "nft" },
  { key: "bobs", name: "Bob's Adventures", ticker: "BOB", sector: "nft" },
  { key: "sloth", name: "Sloth Gang", ticker: "SLOTH", sector: "nft" },
  // The collection behind puush.fun, which is already in the set as a meme.
  { key: "boomer", name: "Boomer Squad", ticker: "BOOMER", sector: "nft" },

  // ---- defi --------------------------------------------------------------
  { key: "cronus", name: "Cronus", ticker: "CRONUS", sector: "defi" },
  { key: "fulcrom", name: "Fulcrom", ticker: "FUL", sector: "defi" },
  { key: "single", name: "Single Finance", ticker: "SINGLE", sector: "defi" },
  { key: "corgi", name: "Corgi", ticker: "CORGI", sector: "defi" },
  { key: "puush", name: "Puush", ticker: "PUUSH", sector: "defi" },
  // CA is its own ticker, not the ARMY this file first guessed at, and it is a
  // game with NFT soldiers rather than anything to do with defi.
  { key: "croarmy", name: "CRO Army", ticker: "CA", sector: "nft" },

  // ---- infra -------------------------------------------------------------
  { key: "ebisusbay", name: "Ebisusbay", ticker: "EBISUS", sector: "infra" },
  // The chain itself. TCG carries SOLANA the same way, and this is the one
  // project in the set every player already knows.
  { key: "cro", name: "CRO", ticker: "CRO", sector: "infra" },
];

/** The eight rungs, and what the set already pays at each. */
const LADDER: { moment: string; rarity: Rarity; launch: number; pump: number; holders: number }[] = [
  { moment: "I", rarity: "common", launch: 15_000, pump: 9_000, holders: 3 },
  { moment: "II", rarity: "common", launch: 15_000, pump: 9_000, holders: 3 },
  { moment: "III", rarity: "rare", launch: 26_000, pump: 15_000, holders: 3 },
  { moment: "IV", rarity: "rare", launch: 26_000, pump: 15_000, holders: 3 },
  { moment: "V", rarity: "epic", launch: 40_000, pump: 25_000, holders: 4 },
  { moment: "VI", rarity: "epic", launch: 40_000, pump: 25_000, holders: 4 },
  { moment: "VII", rarity: "legendary", launch: 67_000, pump: 42_000, holders: 5 },
  { moment: "VIII", rarity: "mythic", launch: 110_000, pump: 56_000, holders: 6 },
];

const roman = (m: string) => m.toLowerCase();
const money = (n: number) => n.toLocaleString("en-US").replace(/,/g, "_");

function render(f: Family): string {
  const cards = LADDER.map(
    (rung) => `  {
    id: "${f.key}-${roman(rung.moment)}",
    type: "project",
    project: "${f.key}",
    moment: "${rung.moment}",
    name: "${f.name.replace(/"/g, '\\"')}",
    ticker: "${f.ticker}",
    rarity: "${rung.rarity}",
    sector: "${f.sector}",
    launchMC: ${money(rung.launch)},
    pumpMC: ${money(rung.pump)},
    holders: ${rung.holders},
    flavour: "",
  },`,
  ).join("\n");
  return `const ${f.key.toUpperCase()}: ProjectCard[] = [\n${cards}\n];\n`;
}

// Only what is not in the set yet. This refused to run at all once any family
// was present, which was right for one batch and wrong the moment a sixteenth
// was named — the list grows, and a script that only works once is a script
// somebody copies instead of extends.
const existing = new Set(CARDS.flatMap((c) => (c.type === "project" ? [c.project] : [])));
const TODO = FAMILIES.filter((f) => !existing.has(f.key));

if (TODO.length === 0) {
  console.log(`All ${FAMILIES.length} families are in the set. Nothing to do.`);
  process.exit(0);
}

// Tickers are the one field here that has to be unique across the set, and
// validateSet says so after the fact. Saying it before the fact names the
// culprit instead of the symptom.
const taken = new Map(CARDS.map((c) => [c.ticker, c.name]));
const clashes = TODO.filter((f) => taken.has(f.ticker)).map(
  (f) => `${f.name} wants ${f.ticker}, which ${taken.get(f.ticker)} already has`,
);
if (clashes.length) throw new Error(clashes.join("; "));

if (!process.argv.includes("--apply")) {
  console.log(`${TODO.length} families to write, ${TODO.length * LADDER.length} cards.\n`);
  for (const f of TODO) {
    console.log(`  ${f.name.padEnd(18)}${f.ticker.padEnd(9)}${f.sector.padEnd(7)}${f.key}-i … ${f.key}-viii`);
  }
  console.log(`\nEvery card: name, ticker, sector, rarity and the set's own median`);
  console.log(`numbers for its rung. No flavour, no effect — both are the next pass.`);
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");

// In before the people, which is where the projects stop.
const anchor = source.indexOf("// ---------------------------------------------------------------------------\n// NAMES");
if (anchor < 0) throw new Error("Could not find where the projects end.");

const header = `// ---------------------------------------------------------------------------
// ADDED BY scripts/new-families.ts
//
// Written by scripts/new-families.ts, which is also where the list lives.
//
// Name, ticker, sector, rarity and the set's own median numbers per rung. No
// flavour and no effect: the line on a project card says something about a real
// project and this repository does not write those unsourced, and what a card
// does is the pass after this one.
//
// An empty flavour is allowed here by AWAITING_FLAVOUR_FAMILIES in
// engine/validation.ts, which lists these fifteen by name. A sixteenth family
// with an empty line still fails.
// ---------------------------------------------------------------------------

`;
const block = header + TODO.map(render).join("\n");
source = source.slice(0, anchor) + block + source.slice(anchor);

// And into the export, after the nineteen that were here first.
source = source.replace(
  "  ...MINTED,\n",
  "  ...MINTED,\n" + TODO.map((f) => `  ...${f.key.toUpperCase()},\n`).join(""),
);

writeFileSync(path, source);
console.log(`Wrote ${TODO.length} families — ${TODO.length * LADDER.length} cards — into ${path}.`);
