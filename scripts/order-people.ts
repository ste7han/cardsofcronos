// The people who bought a card, and the two that are not people.
//
//   npx tsx scripts/order-people.ts            read it
//   npx tsx scripts/order-people.ts --apply    write it into the set
//
// Twenty-two of the thirty-seven orders were a person. Thaxt ordered twice from
// the same account, so there are twenty-one cards. CompoundR is a tool and the
// CRO roast is an event, which leaves twenty-three cards in this file.
//
// THE LINE ON A PERSON CARD IS HARDER THAN ON A PROJECT and this set already
// says why: a project card that overreaches is wrong about a project, a person
// card that overreaches is wrong about somebody who can read it. These
// twenty-one are the easiest in the set to get right and the worst to get wrong,
// because every one of them wrote their own description on the order form. Where
// that line fits a card it is used, quoted or barely trimmed. Where it was an
// instruction rather than a description — Zwangtun's was order notes, ElderKarl
// asked us to write his — the card says so rather than inventing a personality.
//
// RARITY IS NOT WHAT THEY PAID. Fourteen of the thirty-seven bought Mythical.
// None of these is mythic: a mythic is one per family here and these are single
// cards. Rarity follows how much of this chain a person actually built, which is
// why three are legendary and six are common.
//
// THE AURAS ARE WHERE THE REAL DECISION IS. Nineteen people carried auras before
// this and they sat badly against the families: nft had eleven families and three
// aura cards, infra had seven families and seven. Twenty-one more auras could have
// doubled that skew. They are weighted the other way — eight to nft, six to meme,
// four to defi, two to infra, one that draws — which lands the whole layer at
// roughly one aura per family in every sector.

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Aura, Effect, Rarity } from "../engine/types";

interface Person {
  id: string;
  name: string;
  ticker: string;
  rarity: Rarity;
  aura: Aura;
  flavour: string;
  /** Where the line comes from. Every one of these is a real person. */
  why: string;
}

const sector = (s: "meme" | "nft" | "defi" | "infra", bonus: number): Aura => ({
  kind: "pumpSector",
  sector: s,
  bonus,
});

// CroFam, Cryptik and the CRO roast came out on 2026-09-12 at the maker's request,
// after they were in. This file is the record of what was written, so the three are
// gone from it rather than commented out — but the reason belongs somewhere, and the
// reason is that they were his to keep or drop. Their art went with them: an unused
// file in public/art is reported by npm run art every time it runs.
const PEOPLE: Person[] = [
  // --- legendary: three people who built something this set already contains ---
  {
    id: "angelusbob", name: "AngelusBoB", ticker: "ANGELUS", rarity: "legendary",
    aura: sector("nft", 20_000),
    flavour: "The Howlers, all six hundred and thirty-eight of them, are this artist's.",
    why: "Howlers is a family in this set and credits the artist. Not \"drew\": that card gives the artist\'s own title as master of AI",
  },
  {
    id: "snakeape", name: "SnakeApe", ticker: "SNAKEAPE", rarity: "legendary",
    aura: sector("nft", 19_000),
    flavour: "Herpetologist, medic, gamer. Cordial, not nice.",
    why: "his own description, word for word — it needed nothing",
  },
  {
    id: "ryantroopz", name: "Ryan Troopz", ticker: "TROOPZ", rarity: "legendary",
    aura: sector("infra", 19_000),
    flavour: "He built the lottery, and a quarter of every ticket goes to a fund.",
    why: "CroDraw is his, and it is a family in this set; the 25% is its own figure",
  },

  // --- epic ----------------------------------------------------------------
  {
    id: "kaancronos", name: "KaanCronos", ticker: "KAAN", rarity: "epic",
    aura: { kind: "drawEachTurn", cards: 1 },
    flavour: "Kaan the Tutorialist, who explains it until somebody gets it.",
    why: "his own description: spreading knowledge on this chain in the form of tutorials",
  },
  {
    id: "zwangtun", name: "Zwangtun", ticker: "ZWANG", rarity: "epic",
    aura: sector("meme", 13_000),
    flavour: "The Thread Guy. That is what he asked to have printed.",
    why: "his order was instructions; the only line he wanted on the card was that one",
  },
  {
    id: "elderkarl", name: "ElderKarl", ticker: "ELDER", rarity: "epic",
    aura: sector("defi", 12_000),
    flavour: "This line was written to order, because that is what the order asked for.",
    why: "\"Please create your own description and artwork for me\" — the only honest answer",
  },
  {
    id: "chubz", name: "Chubz", ticker: "CHUBZ", rarity: "epic",
    aura: sector("defi", 12_000),
    flavour: "Master of the charts. Sharer of referral codes.",
    why: "his own description, trimmed of the third clause to fit",
  },
  {
    id: "whitewolf", name: "White Wolf Archangel", ticker: "ZEV", rarity: "epic",
    aura: sector("nft", 11_000),
    flavour: "White flames, the ancient rua life-breath, and a name: Zev.",
    why: "his own description, which ends \"I am Zev!\"",
  },

  // --- rare ----------------------------------------------------------------
  {
    id: "thaxt", name: "Thaxt", ticker: "THAXT", rarity: "rare",
    aura: sector("nft", 8_000),
    flavour: "Prophet of Cr00ts, where luck is filed as a skill.",
    why: "his own description. He ordered this card twice; it is one card",
  },
  {
    id: "feedle", name: "Feedle", ticker: "FEEDLE", rarity: "rare",
    aura: sector("defi", 8_000),
    flavour: "Web3 wonderer, degen farmer, and an admin at Scrap Monsters.",
    why: "his own words, and he is listed on the Timmy Finance team page",
  },
  {
    id: "pieterl", name: "Pieter L", ticker: "PIETER", rarity: "rare",
    aura: sector("defi", 7_000),
    flavour: "Invest, support, achieve. Written in that order.",
    why: "his own description, in his own order",
  },
  {
    id: "darklion", name: "Dark Lion", ticker: "DARKLION", rarity: "rare",
    aura: sector("nft", 7_000),
    flavour: "Lions never back down. That was the whole brief.",
    why: "his entire description was those four words",
  },
  {
    id: "spookypapi", name: "SpookyPapi", ticker: "SPOOKY", rarity: "rare",
    aura: sector("nft", 7_000),
    flavour: "Brick by brick. No more words were needed.",
    why: "his entire description",
  },
  {
    id: "covertplate", name: "Covert Plate", ticker: "COVERT", rarity: "rare",
    aura: sector("infra", 6_000),
    flavour: "A plate, and what it stands for is transparency.",
    why: "his own description: supporting transparency and accountability in web3",
  },
  {
    id: "mirko", name: "Mirko", ticker: "MIRKO", rarity: "rare",
    aura: sector("meme", 7_000),
    flavour: "Turned up late, and said it was to make Cronos great again.",
    why: "\"Just arrived here in time to make cronos great again\"",
  },

  // --- common --------------------------------------------------------------
  {
    id: "betrazen", name: "Betrazen", ticker: "BETRA", rarity: "common",
    aura: sector("meme", 4_000),
    flavour: "The age of freedom begins. No date was given.",
    why: "his entire description was the first half of that",
  },
  {
    id: "dragonsong", name: "DragonSong", ticker: "DRAGON", rarity: "common",
    aura: sector("meme", 3_000),
    flavour: "Gotta go fast. Even in death, which was specified.",
    why: "his own description, and the second half was the part he insisted on",
  },
  {
    id: "jersae", name: "Jersae", ticker: "JERSAE", rarity: "common",
    aura: sector("nft", 3_000),
    flavour: "A smooth sea never made a skilled sailor. That was the reason given.",
    why: "he was asked why he chose CroFam and that was the answer",
  },
  {
    id: "blacksea", name: "Blacksea", ticker: "BLACKSEA", rarity: "common",
    aura: sector("meme", 4_000),
    flavour: "Fuds CRO, claims CroFam. This roast was ordered by its subject.",
    why: "filed as a parody, and it is: he wrote the roast and then bought it",
  },
];

interface Extra {
  id: string;
  type: "tool" | "event";
  name: string;
  ticker: string;
  rarity: Rarity;
  effect: Effect;
  flavour: string;
  why: string;
}

const EXTRAS: Extra[] = [
  {
    id: "compoundr", type: "tool", name: "CompoundR", ticker: "COMPOUNDR", rarity: "rare",
    // A compounder turns what is sitting idle into more of itself, and budgetToMC
    // is the only effect in the engine that does that. No tool carried it.
    effect: { kind: "budgetToMC", percentage: 45 },
    flavour: "It compounded for you. Then its account moved to Wolfswap.",
    why: "\"Maximize your crypto gains\" was the order; its bio now reads \"Profile activity moved on @wolfswapdotapp\"",
  },
];

// ---------------------------------------------------------------------------

const render = (v: unknown): string => {
  if (typeof v === "number")
    return Math.abs(v) >= 1000 ? v.toLocaleString("en-US").replace(/,/g, "_") : String(v);
  if (typeof v === "string") return `"${v}"`;
  if (Array.isArray(v)) return `[${v.map(render).join(", ")}]`;
  if (v && typeof v === "object")
    return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${render(x)}`).join(", ")} }`;
  return String(v);
};

const ids = new Set(CARDS.map((c) => c.id));
const tickers = new Map(CARDS.map((c) => [c.ticker, c.name]));
const problems: string[] = [];
for (const p of [...PEOPLE, ...EXTRAS]) {
  if (ids.has(p.id)) problems.push(`${p.id} is already a card`);
  if (tickers.has(p.ticker)) problems.push(`${p.name} wants ${p.ticker}, which ${tickers.get(p.ticker)} has`);
  if (p.flavour.length > 85) problems.push(`${p.id}: ${p.flavour.length} characters`);
}
const seen = new Set<string>();
for (const p of [...PEOPLE, ...EXTRAS]) {
  if (seen.has(p.ticker)) problems.push(`${p.ticker} is used twice in this file`);
  seen.add(p.ticker);
}
if (problems.length) throw new Error(problems.join("\n  "));

if (!process.argv.includes("--apply")) {
  const byAura: Record<string, number> = {};
  for (const p of PEOPLE) {
    const k = p.aura.kind === "pumpSector" ? p.aura.sector : p.aura.kind;
    byAura[k] = (byAura[k] ?? 0) + 1;
  }
  console.log(`${PEOPLE.length} people, ${EXTRAS.length} others.\n`);
  for (const p of PEOPLE) {
    const a = p.aura.kind === "pumpSector" ? `${p.aura.sector} +${p.aura.bonus / 1000}K` : p.aura.kind;
    console.log(`  ${p.name.padEnd(22)}${p.rarity.padEnd(10)}${a.padEnd(16)}${p.flavour}`);
  }
  for (const e of EXTRAS) console.log(`  ${e.name.padEnd(22)}${e.rarity.padEnd(10)}${e.type.padEnd(16)}${e.flavour}`);
  console.log(`\n  auras added: ${Object.entries(byAura).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");

const personBlock = PEOPLE.map(
  (p) => `  {
    id: "${p.id}",
    type: "person",
    name: "${p.name}",
    ticker: "${p.ticker}",
    rarity: "${p.rarity}",
    aura: ${render(p.aura)},
    // ${p.why}
    flavour: "${p.flavour.replace(/"/g, '\\"')}",
  },`,
).join("\n");

const extraBlocks = EXTRAS.map(
  (e) => `  {
    id: "${e.id}",
    type: "${e.type}",
    name: "${e.name}",
    ticker: "${e.ticker}",
    rarity: "${e.rarity}",
    effect: ${render(e.effect)},
    // ${e.why}
    flavour: "${e.flavour.replace(/"/g, '\\"')}",
  },`,
);

const header = `// ---------------------------------------------------------------------------
// THE PEOPLE WHO BOUGHT A CARD
//
// Written by scripts/order-people.ts, which is also where the reasoning lives.
// Every line comes from what the person wrote on the order form.
// ---------------------------------------------------------------------------

const ORDERED_PEOPLE: PersonCard[] = [
${personBlock}
];

const ORDERED_TOOL: ToolCard[] = [
${extraBlocks[0]}
];

`;

const anchor = source.indexOf(
  "// ---------------------------------------------------------------------------\n// NAMES",
);
if (anchor < 0) throw new Error("Could not find where the projects end.");
source = source.slice(0, anchor) + header + source.slice(anchor);
source = source.replace(
  "  ...MINTED,\n",
  "  ...MINTED,\n  ...ORDERED_PEOPLE,\n  ...ORDERED_TOOL,\n",
);

writeFileSync(path, source);
console.log(`Wrote ${PEOPLE.length} people, ${EXTRAS.length} others into ${path}.`);
