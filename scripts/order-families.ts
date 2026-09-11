// The seven projects people bought a card of, as seven families of eight.
//
//   npx tsx scripts/order-families.ts            read it
//   npx tsx scripts/order-families.ts --apply    write it into the set
//
// Thirty-seven custom cards were sold through the first version and made by hand.
// docs/the-orders.md is the decision about all thirty-seven; this file is the
// seven that are projects. A project here is eight cards, so a project card only
// exists as a family — that is why twelve orders became seven families and five
// became nothing.
//
// EVERY LINE IS SOURCED, the same rule the rest of the set is held to. What the
// buyer wrote on the order form is quoted where it earns a card: it is the only
// place in this set where the subject of a card wrote a line for it. Everything
// else was looked up, and where the project has moved since the order, the card
// says what it is now rather than what was bought — $PYROSTR was BurnIt when it
// was paid for.
//
// THE NUMBERS vary by family rather than repeating one ladder, which is what
// scripts/new-families.ts deliberately did not do when it had nothing to go on.
// These have characters now: a burn token grows into its pump, a lottery starts
// small and swells, an empire is expensive to build. All of it stays inside the
// bands the set already uses per rarity.
//
// WHAT IS NOT HERE: contract addresses for Pyro and $ELMO. The maker is sending
// Pyro's; $ELMO's was not findable. Nothing on their cards depends on one.

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Effect, Rarity, Sector } from "../engine/types";

interface Card {
  moment: string;
  rarity: Rarity;
  launch: number;
  pump: number;
  holders: number;
  flavour: string;
  effect: Effect;
  why: string;
}

interface Family {
  key: string;
  name: string;
  ticker: string;
  sector: Sector;
  /** Why this sector and this way of playing, in one line each. */
  sectorWhy: string;
  intentWhy: string;
  cards: Card[];
}

const LADDER: [string, Rarity, number][] = [
  ["I", "common", 3],
  ["II", "common", 3],
  ["III", "rare", 3],
  ["IV", "rare", 3],
  ["V", "epic", 4],
  ["VI", "epic", 4],
  ["VII", "legendary", 5],
  ["VIII", "mythic", 6],
];

/** launch and pump per rung, so a family's economy can have a shape. */
const shape = (l: number[], p: number[]): [number, number][] =>
  LADDER.map((_, i) => [l[i]! * 1000, p[i]! * 1000]);

const FAMILIES: Family[] = [
  // =========================================================================
  {
    key: "pyro",
    name: "Pyro",
    ticker: "PYROSTR",
    sector: "meme",
    sectorWhy: "a memecoin lineage — BurnIt was play, burn, win — with a jackpot in it",
    intentWhy:
      "momentum: the whole design is deflation, and deflation is what you hold becoming worth more. Momentum was the weakest style at 44.0% and this adds to it rather than to locks, which leads at 58.0%.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 13_000, pump: 11_000, holders: 3,
        flavour: "It was called BurnIt, and the pitch was play, burn, win.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 3_000 },
        why: "what the buyer paid for, in his own words on the order form",
      },
      {
        moment: "II", rarity: "common", launch: 13_000, pump: 11_000, holders: 3,
        flavour: "Then it was PYRO. Then it was PYROSTR. Same fire.",
        effect: { kind: "pumpProject", target: "ownProject", mc: 18_000 },
        why: "two renames, and the project announced the second one itself",
      },
      {
        moment: "III", rarity: "rare", launch: 22_000, pump: 18_000, holders: 3,
        flavour: "Seven and a half percent on every trade, split seven ways.",
        effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 12_000 } },
        why: "the tax is the project, and it is the only one in the set with seven destinations",
      },
      {
        moment: "IV", rarity: "rare", launch: 22_000, pump: 18_000, holders: 3,
        flavour: "One percent of that burns. Every buy, every sell.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 9_000 },
        why: "the deflationary slice, which is where the name comes from",
      },
      {
        moment: "V", rarity: "epic", launch: 34_000, pump: 30_000, holders: 4,
        flavour: "Two and a half goes to a jackpot. Ten dollars buys you a ticket.",
        effect: { kind: "scalePump", target: "ownProject", percentage: 25 },
        why: "the jackpot pool, and the ten-dollar trade that qualifies for it",
      },
      {
        moment: "VI", rarity: "epic", launch: 34_000, pump: 30_000, holders: 4,
        flavour: "Another one and a half holds up a collection that is not even this one.",
        effect: { kind: "pumpToMC", times: 3 },
        why: "1.5% props up the Crazy Critters NFTs, which the same person runs",
      },
      {
        moment: "VII", rarity: "legendary", launch: 57_000, pump: 50_000, holders: 5,
        flavour: "Half a percent to Wolfswap's vault. If they do well, everyone does.",
        effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 21_000 } },
        why: "the Wolfies Cache Vault, and PACK's fourth appearance across this set",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 94_000, pump: 67_000, holders: 6,
        flavour: "Every trade pays six other things before it pays the team.",
        effect: { kind: "scalePump", target: "ownProject", percentage: 45 },
        why: "7% of the 7.5% goes elsewhere; the team takes half a percent",
      },
    ],
  },
  // =========================================================================
  {
    key: "bored",
    name: "Bored Catz Club",
    ticker: "BORED",
    sector: "meme",
    sectorWhy: "a memecoin off a launchpad, whatever the collection heritage in the name",
    intentWhy:
      "momentum, and pointed at the whole board where Pyro points at one position — a club spreads, a burn concentrates.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 17_000, pump: 8_000, holders: 3,
        flavour: "On the contract it is called Bored Cat Wif Couch.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 3_000 },
        why: "read off the chain; the ticker is $BORED and the name is not",
      },
      {
        moment: "II", rarity: "common", launch: 17_000, pump: 8_000, holders: 3,
        flavour: "A billion of them, and not one burned.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
        why: "supply and the dead address, both read on-chain",
      },
      {
        moment: "III", rarity: "rare", launch: 30_000, pump: 13_000, holders: 3,
        flavour: "It set the record for getting off puush.fun quickest.",
        effect: { kind: "benchmark", target: "ownProject", plus: 12_000 },
        why: "its own account calls it the fastest Puush graduate",
      },
      {
        moment: "IV", rarity: "rare", launch: 30_000, pump: 13_000, holders: 3,
        flavour: "Too cool to care, too iconic to ignore. Their words, not mine.",
        effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 12_000 } },
        why: "quoted from the order form — the buyer wrote this line himself",
      },
      {
        moment: "V", rarity: "epic", launch: 46_000, pump: 21_000, holders: 4,
        flavour: "Four-oh-four is the joke and the token standard at the same time.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 12_000 },
        why: "the 404 in its name is both a missing page and ERC-404",
      },
      {
        moment: "VI", rarity: "epic", launch: 46_000, pump: 21_000, holders: 4,
        flavour: "The same person made this and made ELMO. Both graduated.",
        effect: { kind: "pumpToMC", times: 3 },
        why: "one founder, two puush.fun graduates, two families in this set",
      },
      {
        moment: "VII", rarity: "legendary", launch: 77_000, pump: 36_000, holders: 5,
        flavour: "A cat. A couch. That was enough.",
        effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 21_000 } },
        why: "the whole product, stated at the size it deserves",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 126_000, pump: 48_000, holders: 6,
        flavour: "It was a picture of a cat on a couch, and the chain agreed.",
        effect: { kind: "scalePump", target: "allOwnProjects", percentage: 40 },
        why: "the mythic says the quiet part: it worked",
      },
    ],
  },
  // =========================================================================
  {
    key: "elmo",
    name: "ELMO",
    ticker: "ELMO",
    sector: "meme",
    sectorWhy: "its own account calls it a Cronos meme token",
    intentWhy:
      "money, and built on the effects that read the board — peakMC and unbankedMC — because this is the family that published its own books.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 15_000, pump: 9_000, holders: 3,
        flavour: "It got off the launchpad in thirty hours.",
        effect: { kind: "directMC", target: "self", mc: 21_000 },
        why: "graduated puush.fun in thirty hours",
      },
      {
        moment: "II", rarity: "common", launch: 15_000, pump: 9_000, holders: 3,
        flavour: "DegenStreet.fun, where a token goes to be seen.",
        effect: { kind: "extraBudget", target: "self", mc: 24_000 },
        why: "the same people built a listing platform",
      },
      {
        moment: "III", rarity: "rare", launch: 26_000, pump: 15_000, holders: 3,
        flavour: "It built a dashboard so you could watch its own wallets.",
        effect: { kind: "unbankedMC", percentage: 20 },
        why: "elmo-cro.com tracks project wallets, holders, transactions and treasury",
      },
      {
        moment: "IV", rarity: "rare", launch: 26_000, pump: 15_000, holders: 3,
        flavour: "Top holders, transactions, treasury. All of it in the open.",
        effect: { kind: "directMC", target: "self", mc: 85_000 },
        why: "what the dashboard shows, listed as it lists it",
      },
      {
        moment: "V", rarity: "epic", launch: 40_000, pump: 25_000, holders: 4,
        flavour: "The landlord of a street it built itself.",
        effect: { kind: "peakMC", percentage: 14 },
        why: "the order form called it the DegenStreet.Fun Landlord",
      },
      {
        moment: "VI", rarity: "epic", launch: 40_000, pump: 25_000, holders: 4,
        flavour: "Same founder as Bored Catz. Twice is a habit.",
        effect: { kind: "extraBudget", target: "self", mc: 170_000 },
        why: "one person, two families in this set",
      },
      {
        moment: "VII", rarity: "legendary", launch: 67_000, pump: 42_000, holders: 5,
        flavour: "Transparency at the forefront, which is easy to say and rare to build.",
        effect: { kind: "scaleMC", target: "self", percentage: 22 },
        why: "their own phrase, and they did build the thing",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 110_000, pump: 56_000, holders: 6,
        flavour: "A meme token that published its own books.",
        effect: { kind: "peakMC", percentage: 30 },
        why: "the whole family in one line",
      },
    ],
  },
  // =========================================================================
  {
    key: "ganggang",
    name: "Gang Gang",
    ticker: "GG",
    sector: "meme",
    sectorWhy: "a CroFam memecoin and nothing else, by its own description",
    intentWhy:
      "community, which the measurement has at 56.7% and does not need help — but a gang that renounced ownership and burned its liquidity is not a takes deck or a money deck, and filing it anywhere else would be a lie for the sake of a number.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 15_000, pump: 9_000, holders: 4,
        flavour: "The supply reads sixty-nine four-twenty, twice over.",
        effect: { kind: "drawCards", amount: 1 },
        why: "694,206,942,069 on-chain, which is 69420 written twice and then some",
      },
      {
        moment: "II", rarity: "common", launch: 15_000, pump: 9_000, holders: 4,
        flavour: "Ownership renounced. LP burned. No airdrops. In that order.",
        effect: { kind: "directMC", target: "self", mc: 21_000 },
        why: "their pinned post, listed exactly as they list it",
      },
      {
        moment: "III", rarity: "rare", launch: 26_000, pump: 15_000, holders: 4,
        flavour: "Five percent of it is already at a dead address.",
        effect: { kind: "extraBudget", target: "self", mc: 26_000 },
        why: "34,710,555,362 of 694,206,942,069 burned, read on-chain",
      },
      {
        moment: "IV", rarity: "rare", launch: 26_000, pump: 15_000, holders: 4,
        flavour: "Are you Gang Gang? That is the entire entry requirement.",
        effect: { kind: "recoverCard", amount: 1 },
        why: "quoted from the order form",
      },
      {
        moment: "V", rarity: "epic", launch: 40_000, pump: 25_000, holders: 5,
        flavour: "Two hundred and twelve, which on this chain means something.",
        effect: { kind: "comebackMC", percentage: 30 },
        why: "the 212 in its name is a Cronos community movement, not a number",
      },
      {
        moment: "VI", rarity: "epic", launch: 40_000, pump: 25_000, holders: 5,
        flavour: "It arrived in October 2024 and never explained itself.",
        effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
        why: "account created October 2024; there is no whitepaper to find",
      },
      {
        moment: "VII", rarity: "legendary", launch: 67_000, pump: 42_000, holders: 6,
        flavour: "A gang is a group that decided to be one.",
        effect: { kind: "scaleMC", target: "self", percentage: 22 },
        why: "no claim in it, which is the shape that survives on a card",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 110_000, pump: 56_000, holders: 7,
        flavour: "$GG behavior is the way. Nobody has ever defined it.",
        effect: { kind: "scaleMC", target: "self", percentage: 27 },
        why: "quoted from the order form, and still undefined",
      },
    ],
  },
  // =========================================================================
  {
    key: "imperium",
    name: "Imperium",
    ticker: "SEST",
    sector: "nft",
    sectorWhy:
      "a game with NFT collections behind it, filed the way CRO Army and Crazzzy Monsters are",
    intentWhy:
      "takes. It is a strategy MMO whose own headline is conquer rivals and whose game loop is raiding other people's cities. Takes sits at 44.7%, second-weakest, so this helps there too.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 18_000, pump: 8_000, holders: 3,
        flavour: "Build Rome. Conquer rivals. Win rewards. In that order.",
        effect: { kind: "directMC", target: "opponent", mc: -7_000 },
        why: "the three lines across the top of its own site",
      },
      {
        moment: "II", rarity: "common", launch: 18_000, pump: 8_000, holders: 3,
        flavour: "A thousand legionaries, and fifteen of them are legendary.",
        effect: { kind: "stealMC", percentage: 4 },
        why: "LEGION I: 1000 NFTs, 15 legendary",
      },
      {
        moment: "III", rarity: "rare", launch: 31_000, pump: 13_000, holders: 3,
        flavour: "Minted in May 2025 at a hundred CRO. Buy three, get one back.",
        effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
        why: "mint date 16/05/2025, 100 CRO, and the 3x2 refund",
      },
      {
        moment: "IV", rarity: "rare", launch: 31_000, pump: 13_000, holders: 3,
        flavour: "A second collection, and it is nothing but weapons and armour.",
        effect: { kind: "stealMC", percentage: 7 },
        why: "Armamentarium, the equipment layer",
      },
      {
        moment: "V", rarity: "epic", launch: 48_000, pump: 21_000, holders: 4,
        flavour: "Marco Aurelio, Giulio Cesare, Cleopatra, Giove, Giunone.",
        effect: { kind: "stealMC", percentage: 16 },
        why: "five of the legendaries, named on the site",
      },
      {
        moment: "VI", rarity: "epic", launch: 48_000, pump: 21_000, holders: 4,
        flavour: "Raid somebody else's city and climb the seasonal table.",
        effect: { kind: "discardCards", target: "opponent", amount: 1 },
        why: "the game loop, in the site's own words",
      },
      {
        moment: "VII", rarity: "legendary", launch: 80_000, pump: 36_000, holders: 5,
        flavour: "Some rewards only unlocked once the collection had sold out.",
        effect: { kind: "burnForDamage", target: "ownProject", keep: 130 },
        why: "promotions gated at 80% and 100% of sales",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 132_000, pump: 48_000, holders: 7,
        flavour: "The Roman Empire is back. That was the whole pitch, and it worked.",
        effect: { kind: "rug", target: "enemyProject" },
        why: "quoted from the order form. First rug on a project card in the set: an empire takes a city",
      },
    ],
  },
  // =========================================================================
  {
    key: "crodraw",
    name: "CroDraw",
    ticker: "CRODRAW",
    sector: "infra",
    sectorWhy: "a venue. You pass through a lottery, you do not hold a position in it",
    intentWhy: "money: it is a machine for paying out, and it says what share goes where.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 11_000, pump: 12_000, holders: 3,
        flavour: "Every Wednesday at six in the evening, New York time.",
        effect: { kind: "directMC", target: "self", mc: 21_000 },
        why: "draws run weekly at 18:00 EST",
      },
      {
        moment: "II", rarity: "common", launch: 11_000, pump: 12_000, holders: 3,
        flavour: "Seventy percent of the tickets go straight back out as the prize.",
        effect: { kind: "directMC", target: "self", mc: 7_000, per: "holders" },
        why: "70% of ticket sales to the winner",
      },
      {
        moment: "III", rarity: "rare", launch: 19_000, pump: 20_000, holders: 3,
        flavour: "A hundred and one tickets, or it rolls over to next week.",
        effect: { kind: "extraBudget", target: "self", mc: 26_000 },
        why: "a minimum of 101 sales or the draw rolls",
      },
      {
        moment: "IV", rarity: "rare", launch: 19_000, pump: 20_000, holders: 3,
        flavour: "The randomness comes from an oracle, so nobody has to be trusted.",
        effect: { kind: "refundMC", percentage: 35 },
        why: "Witnet supplies on-chain randomness",
      },
      {
        moment: "V", rarity: "epic", launch: 29_000, pump: 33_000, holders: 4,
        flavour: "Twenty-five percent goes to a fund called Hearts of Gold.",
        effect: { kind: "directMC", target: "self", mc: 85_000 },
        why: "a quarter of every ticket, to a community fund by that name",
      },
      {
        moment: "VI", rarity: "epic", launch: 29_000, pump: 33_000, holders: 4,
        flavour: "It raises money for mental health, and says so out loud.",
        effect: { kind: "budgetToMC", percentage: 60 },
        why: "the fund's stated purpose, with a focus on men's health",
      },
      {
        moment: "VII", rarity: "legendary", launch: 49_000, pump: 55_000, holders: 5,
        flavour: "Burn a hundred of another project's token and the ticket is cheaper.",
        effect: { kind: "extraBudget", target: "self", mc: 200_000 },
        why: "100 $TRPZ burned per ticket buys 10% off",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 80_000, pump: 74_000, holders: 6,
        flavour: "Winners make their own luck. The oracle disagrees.",
        effect: { kind: "comebackMC", percentage: 45 },
        why: "the buyer's own line on the order form, against the machine he built",
      },
    ],
  },
  // =========================================================================
  {
    key: "scrap",
    name: "Scrap Monsters",
    ticker: "SCRAP",
    sector: "nft",
    sectorWhy: "three thousand NFTs; the recycling is what backs them",
    intentWhy:
      "momentum, and shaped around attach — something that goes on working every turn, which is what recycling is.",
    cards: [
      {
        moment: "I", rarity: "common", launch: 15_000, pump: 9_000, holders: 4,
        flavour: "Three thousand of them, at twenty-five CRO each.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 3_000 },
        why: "supply and mint price, off the Timmy Finance mint page",
      },
      {
        moment: "II", rarity: "common", launch: 15_000, pump: 9_000, holders: 4,
        flavour: "Cans, bottles and scrap metal, turned into staking rewards.",
        effect: { kind: "pumpProject", target: "ownProject", mc: 18_000 },
        why: "their own description of what backs the collection",
      },
      {
        moment: "III", rarity: "rare", launch: 26_000, pump: 15_000, holders: 4,
        flavour: "Somebody actually goes out and collects the metal.",
        effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { nft: 14_000 } },
        why: "the collection rounds they post about, with photos of the haul",
      },
      {
        moment: "IV", rarity: "rare", launch: 26_000, pump: 15_000, holders: 4,
        flavour: "Trash to treasure, and they mean the first half literally.",
        effect: { kind: "benchmark", target: "ownProject", plus: 11_000 },
        why: "their own hashtag",
      },
      {
        moment: "V", rarity: "epic", launch: 40_000, pump: 25_000, holders: 5,
        flavour: "It shares a house with fifty Degen Donkeys at three fifty each.",
        effect: { kind: "pumpProject", target: "allOwnProjects", mc: 12_000 },
        why: "Timmy Finance mints both; the Donkeys are 50 at 350 CRO",
      },
      {
        moment: "VI", rarity: "epic", launch: 40_000, pump: 25_000, holders: 5,
        flavour: "The staking pays whether or not anybody is looking.",
        effect: { kind: "pumpToMC", times: 3 },
        why: "the rewards accrue on their own, which is the point of the design",
      },
      {
        moment: "VII", rarity: "legendary", launch: 67_000, pump: 42_000, holders: 6,
        flavour: "Recycling is slow, and so is this. That is the point.",
        effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { nft: 23_000 } },
        why: "no claim in it; the shape that survives",
      },
      {
        moment: "VIII", rarity: "mythic", launch: 110_000, pump: 56_000, holders: 7,
        flavour: "Real rubbish, weighed and sold, behind a picture of a monster.",
        // pumpProject cannot be attached — validateSet keeps a whitelist for
        // standing effects, because this fires up to nine times and a flat pump
        // does not survive being repeated. scalePump does, and compounding is
        // what recycling is. 15% against Ryoshi's 20 and Reckless Robots' 25.
        effect: {
          kind: "attach",
          target: "ownProject",
          every: { kind: "scalePump", target: "ownProject", percentage: 15 },
        },
        why: "the only NFT in this set backed by something you can put on a scale",
      },
    ],
  },
];

// ---------------------------------------------------------------------------

const render = (v: unknown): string => {
  if (typeof v === "number")
    return Math.abs(v) >= 1000 ? v.toLocaleString("en-US").replace(/,/g, "_") : String(v);
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(render).join(", ")}]`;
  if (v && typeof v === "object")
    return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${render(x)}`).join(", ")} }`;
  return String(v);
};

const existing = new Set(CARDS.flatMap((c) => (c.type === "project" ? [c.project] : [])));
const TODO = FAMILIES.filter((f) => !existing.has(f.key));

if (TODO.length === 0) {
  console.log(`All ${FAMILIES.length} families are in the set. Nothing to do.`);
  process.exit(0);
}

// Tickers are unique across the set and validateSet says so after the fact.
// Saying it here names the family rather than the symptom.
const taken = new Map(CARDS.map((c) => [c.ticker, c.name]));
const clash = TODO.filter((f) => taken.has(f.ticker));
if (clash.length) {
  throw new Error(
    clash.map((f) => `${f.name} wants ${f.ticker}, which ${taken.get(f.ticker)} has`).join("; "),
  );
}

for (const f of TODO) {
  const moments = f.cards.map((c) => c.moment).join(",");
  if (moments !== "I,II,III,IV,V,VI,VII,VIII") throw new Error(`${f.name}: ${moments}`);
  const rar = f.cards.map((c) => c.rarity).join(",");
  if (rar !== "common,common,rare,rare,epic,epic,legendary,mythic")
    throw new Error(`${f.name}: ${rar}`);
  for (const c of f.cards) {
    if (c.flavour.length > 85) throw new Error(`${f.key}-${c.moment}: ${c.flavour.length} chars`);
  }
}

if (!process.argv.includes("--apply")) {
  console.log(`${TODO.length} families, ${TODO.length * 8} cards.\n`);
  for (const f of TODO) {
    console.log(`--- ${f.name} (${f.ticker}, ${f.sector})`);
    console.log(`    sector: ${f.sectorWhy}`);
    console.log(`    play:   ${f.intentWhy}`);
    for (const c of f.cards) {
      console.log(
        `  ${c.moment.padEnd(5)}${c.rarity.padEnd(10)}` +
          `${String(c.launch / 1000).padStart(4)}K/${String(c.pump / 1000).padStart(3)}K/h${c.holders}  ${c.flavour}`,
      );
      console.log(`${" ".repeat(15)}${render(c.effect)}`);
    }
    console.log();
  }
  console.log(`Run again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");

const block = (f: Family) =>
  `// ${f.name} — ${f.sectorWhy}.\n// Plays as ${f.intentWhy}\nconst ${f.key.toUpperCase()}: ProjectCard[] = [\n` +
  f.cards
    .map(
      (c) => `  {
    id: "${f.key}-${c.moment.toLowerCase()}",
    type: "project",
    project: "${f.key}",
    moment: "${c.moment}",
    name: "${f.name}",
    ticker: "${f.ticker}",
    rarity: "${c.rarity}",
    sector: "${f.sector}",
    launchMC: ${render(c.launch)},
    pumpMC: ${render(c.pump)},
    holders: ${c.holders},
    // ${c.why}
    effect: ${render(c.effect)},
    flavour: "${c.flavour.replace(/"/g, '\\"')}",
  },`,
    )
    .join("\n") +
  `\n];\n`;

const anchor = source.indexOf(
  "// ---------------------------------------------------------------------------\n// NAMES",
);
if (anchor < 0) throw new Error("Could not find where the projects end.");

const header = `// ---------------------------------------------------------------------------
// THE PROJECTS PEOPLE BOUGHT A CARD OF
//
// Written by scripts/order-families.ts, which is also where the reasoning lives.
// docs/the-orders.md is the decision about all thirty-seven orders.
// ---------------------------------------------------------------------------

`;

source =
  source.slice(0, anchor) + header + TODO.map(block).join("\n") + "\n" + source.slice(anchor);
source = source.replace(
  "  ...MINTED,\n",
  "  ...MINTED,\n" + TODO.map((f) => `  ...${f.key.toUpperCase()},\n`).join(""),
);

writeFileSync(path, source);
console.log(`Wrote ${TODO.length} families — ${TODO.length * 8} cards — into ${path}.`);
