// The card set. This is the only source: the board, the gallery and the bot all
// read from here.
//
// In the first version of this game the card data lived in two files, one for
// the engine and one for the frontend, and the frontend failed to ship eight
// times before anybody noticed. One file, one truth.
//
// ---------------------------------------------------------------------------
// How a project family is built
//
// A project is a thing that exists on Cronos; a card is one moment of it. Twelve
// families, eight moments each: two commons, two rares, two epics, a legendary
// and a mythic. The first version had ten project cards per faction and five
// founders; the two weakest projects of each are gone, and the founder is one
// card rather than a ladder of five, because a founder is a person and a person
// is not a rarity.
//
// Which two went is not a coin toss. game-engine/AUDIT.md and VOORWAARDEN.md
// measured every card in the old engine over twenty-five thousand matches, and
// the ones that fired in nothing like a real match are the ones that are not
// here.
//
// The numbers sit inside the bands the engine was balanced against — common
// launches around 15K and pumps 9K, a mythic launches around 112K and pumps 57K
// — because the balance work behind those bands is worth more than any single
// card in this file.
// ---------------------------------------------------------------------------

import type {
  Card,
  EventCard,
  InfluencerCard,
  ProjectCard,
  TacticCard,
  ToolCard,
} from "@/engine/types";

// ---------------------------------------------------------------------------
// CLOVE — meme
//
// The one that lifted the small holders. Every Clove card in the old set asked
// what else was on your side of the table, and paid out for the answer.
// ---------------------------------------------------------------------------

const CLOVE: ProjectCard[] = [
  {
    id: "clove-first",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "Somebody Had To Be First",
    ticker: "CLOVE",
    rarity: "common",
    sector: "meme",
    launchMC: 14_000,
    pumpMC: 8_000,
    holders: 3,
    flavour: "A ticker, a chart and a group chat. That was the whole of it.",
  },
  {
    id: "clove-nobody",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "Nobody Was In Charge",
    ticker: "CLOVE",
    rarity: "common",
    sector: "meme",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 3,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "No team to rug you. Also no team to fix anything.",
  },
  {
    id: "clove-voted",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "The Holders Voted",
    ticker: "CLOVE",
    rarity: "rare",
    sector: "meme",
    launchMC: 24_000,
    pumpMC: 14_000,
    holders: 3,
    // The old COC_Clove_C1 paid out for having community on the field. A
    // portfolio you have actually built is the closest thing this engine has to
    // that, and unlike the original it cannot be satisfied by one card.
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 3 },
      effect: { kind: "directMC", target: "self", mc: 70_000 },
    },
    flavour: "Turnout was four people and a bot. It still counted.",
  },
  {
    id: "clove-listing",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "It Got A Listing",
    ticker: "CLOVE",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 16_000,
    holders: 3,
    flavour: "One exchange nobody had heard of, and everybody screenshotted it.",
  },
  {
    id: "clove-season",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "Clove Season",
    ticker: "CLOVE",
    rarity: "epic",
    sector: "meme",
    launchMC: 38_000,
    pumpMC: 23_000,
    holders: 4,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 6_000 },
    },
    flavour: "For about nine days it was the only chart anybody had open.",
  },
  {
    id: "clove-carried",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "It Carried The Small Ones",
    ticker: "CLOVE",
    rarity: "epic",
    sector: "meme",
    launchMC: 41_000,
    pumpMC: 25_000,
    holders: 4,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "Everyone who was early stayed early. That was the trick.",
  },
  {
    id: "clove-product",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "The Community Was The Product",
    ticker: "CLOVE",
    rarity: "legendary",
    sector: "meme",
    launchMC: 66_000,
    pumpMC: 40_000,
    holders: 5,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 9_000 },
    },
    flavour: "There was never a roadmap. There was a group chat that never slept.",
  },
  {
    id: "clove-still",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "Still Nobody's",
    ticker: "CLOVE",
    rarity: "mythic",
    sector: "meme",
    launchMC: 108_000,
    pumpMC: 55_000,
    holders: 6,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 12_000, memetility: 5_000 },
    },
    flavour: "Two cycles later the chat is still open and still arguing.",
  },
];

// ---------------------------------------------------------------------------
// CROOKS — memetility
//
// The one that took the hit and stood up. Half of the old Crooks set was about
// what happens *after* somebody attacks you, which in this engine is holders:
// the ones that come back are the ones that keep paying.
// ---------------------------------------------------------------------------

const CROOKS: ProjectCard[] = [
  {
    id: "crooks-alone",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "No Names Attached",
    ticker: "CF",
    rarity: "common",
    sector: "memetility",
    launchMC: 15_000,
    pumpMC: 8_000,
    holders: 4,
    flavour: "No influencer would touch it, which turned out to be the point.",
  },
  {
    id: "crooks-holds",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "It Held",
    ticker: "CF",
    rarity: "common",
    sector: "memetility",
    launchMC: 17_000,
    pumpMC: 9_000,
    holders: 4,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "The contract did exactly what it said. Nobody wrote a thread about it.",
  },
  {
    id: "crooks-stack",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "The Stack Grew",
    ticker: "CF",
    rarity: "rare",
    sector: "memetility",
    launchMC: 25_000,
    pumpMC: 14_000,
    holders: 4,
    flavour: "A vault, then a router, then a thing nobody could explain quickly.",
  },
  {
    id: "crooks-hit",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "It Took The Hit",
    ticker: "CF",
    rarity: "rare",
    sector: "memetility",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 5,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    // The old COC_CF_R2 gained MC when one of your projects was debuffed. The
    // engine has no "when attacked" hook, and inventing one for a single card is
    // how the last engine grew to eighty branches — so the card pays out for
    // being behind instead, which is when you have been attacked.
    payoff: {
      when: { kind: "behindBy", mc: 400_000 },
      effect: { kind: "directMC", target: "self", mc: 200_000 },
    },
    flavour: "Down forty percent in an hour and the deposits went up.",
  },
  {
    id: "crooks-cover",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "Everyone Under One Roof",
    ticker: "CF",
    rarity: "epic",
    sector: "memetility",
    launchMC: 39_000,
    pumpMC: 23_000,
    holders: 5,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Whatever came for you, it came for the whole book at once.",
  },
  {
    id: "crooks-audit",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "The Audit Came Back Clean",
    ticker: "CF",
    rarity: "epic",
    sector: "memetility",
    launchMC: 42_000,
    pumpMC: 26_000,
    holders: 5,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { memetility: 8_000 },
    },
    flavour: "Two weeks of silence, then a PDF, then the deposits doubled.",
  },
  {
    id: "crooks-book",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "The Deepest Book On Cronos",
    ticker: "CF",
    rarity: "legendary",
    sector: "memetility",
    launchMC: 70_000,
    pumpMC: 42_000,
    holders: 6,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { memetility: 11_000, meme: 5_000 },
    },
    flavour: "Everything routed through it eventually, whether it meant to or not.",
  },
  {
    id: "crooks-standing",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "Still Standing",
    ticker: "CF",
    rarity: "mythic",
    sector: "memetility",
    launchMC: 112_000,
    pumpMC: 54_000,
    holders: 7,
    // A lock that any single point of damage lifts. At seven holders it is a
    // real wall, and the answer to it is the cheapest attack in the game — which
    // is the shape a lock has to have to be fair.
    restriction: { kind: "banType", cardType: "tactic" },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Outlived three exchanges, two bear markets and everyone who called it.",
  },
];

// ---------------------------------------------------------------------------
// WOLFSWAP — memetility
//
// The one that ate the others. Nearly every Wolfswap card in the old set
// destroyed something, and the ones that did not were about what you got for it.
// ---------------------------------------------------------------------------

const WOLFSWAP: ProjectCard[] = [
  {
    id: "wolfswap-pool",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "One Pool, One Pair",
    ticker: "WOLF",
    rarity: "common",
    sector: "memetility",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 2,
    flavour: "Slippage of eleven percent and everybody used it anyway.",
  },
  {
    id: "wolfswap-teeth",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "It Showed Teeth",
    ticker: "WOLF",
    rarity: "common",
    sector: "memetility",
    launchMC: 17_000,
    pumpMC: 9_000,
    holders: 2,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "The first competitor lasted a fortnight.",
  },
  {
    id: "wolfswap-hunt",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "It Hunted The Small Ones",
    ticker: "WOLF",
    rarity: "rare",
    sector: "memetility",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    effect: { kind: "stealMC", percentage: 8 },
    flavour: "Anything thinner than its own book got quoted out of existence.",
  },
  {
    id: "wolfswap-fees",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "Fee Season",
    ticker: "WOLF",
    rarity: "rare",
    sector: "memetility",
    launchMC: 27_000,
    pumpMC: 16_000,
    holders: 3,
    effect: { kind: "extraBudget", target: "self", mc: 40_000 },
    flavour: "Volume was the product. The token was the receipt.",
  },
  {
    id: "wolfswap-pack",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "The Pack Arrived",
    ticker: "WOLF",
    rarity: "epic",
    sector: "memetility",
    launchMC: 38_000,
    pumpMC: 24_000,
    holders: 3,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Not one whale. Forty wallets moving at the same minute.",
  },
  {
    id: "wolfswap-liquidity",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "It Took Their Liquidity",
    ticker: "WOLF",
    rarity: "epic",
    sector: "memetility",
    launchMC: 41_000,
    pumpMC: 25_000,
    holders: 4,
    effect: { kind: "stealMC", percentage: 12 },
    flavour: "The other pool did not close. It just stopped being quoted.",
  },
  {
    id: "wolfswap-lowest",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "The Weakest Pair Went First",
    ticker: "WOLF",
    rarity: "legendary",
    sector: "memetility",
    launchMC: 68_000,
    pumpMC: 40_000,
    holders: 4,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "It never went for the big one. It never had to.",
  },
  {
    id: "wolfswap-two",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "Two At Once",
    ticker: "WOLF",
    rarity: "mythic",
    sector: "memetility",
    launchMC: 115_000,
    pumpMC: 52_000,
    holders: 5,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 3 },
    flavour: "The screenshot everybody still posts is from that afternoon.",
  },
];

// ---------------------------------------------------------------------------
// RECKLESS ROBOTS — machine
//
// The one that might blow up. The old set had a mythic with a one-in-ten chance
// of destroying five random cards, and a founder that paid out only if it did.
// The engine here is seeded and deterministic on purpose, so the gamble is not a
// dice roll — it is a card that hits everything, yours included.
// ---------------------------------------------------------------------------

const ROBOTS: ProjectCard[] = [
  {
    id: "robots-bolt",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "One Loose Bolt",
    ticker: "RR",
    rarity: "common",
    sector: "machine",
    launchMC: 13_000,
    pumpMC: 8_000,
    holders: 2,
    flavour: "Shipped with a bug in the mint and shipped anyway.",
  },
  {
    id: "robots-coinflip",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "Fifty-Fifty",
    ticker: "RR",
    rarity: "common",
    sector: "machine",
    launchMC: 18_000,
    pumpMC: 10_000,
    holders: 2,
    // The original was a literal coin flip for plus or minus five. A seeded
    // engine can do that, but a card whose text says "50% chance" and whose
    // outcome is fixed by the seed is a card that lies twice a match. It costs
    // itself something and gains more instead — the same trade, said honestly.
    effect: { kind: "directMC", target: "self", mc: -6_000 },
    flavour: "Heads it works. Tails it also sort of works.",
  },
  {
    id: "robots-fleet",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "A Fleet Of Them",
    ticker: "RR",
    rarity: "rare",
    sector: "machine",
    launchMC: 24_000,
    pumpMC: 15_000,
    holders: 3,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { machine: 9_000 },
    },
    flavour: "One is a toy. Four hundred is an argument.",
  },
  {
    id: "robots-scrap",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "Stripped For Parts",
    ticker: "RR",
    rarity: "rare",
    sector: "machine",
    launchMC: 28_000,
    pumpMC: 14_000,
    holders: 3,
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    flavour: "They took one apart on stream and the floor went up.",
  },
  {
    id: "robots-overclock",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "Overclocked",
    ticker: "RR",
    rarity: "epic",
    sector: "machine",
    launchMC: 36_000,
    pumpMC: 28_000,
    holders: 2,
    flavour: "Ran twice as hot for half as long. Everybody knew and nobody left.",
  },
  {
    id: "robots-recall",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "The Recall",
    ticker: "RR",
    rarity: "epic",
    sector: "machine",
    launchMC: 44_000,
    pumpMC: 22_000,
    holders: 4,
    effect: { kind: "damageHolders", target: "allProjects", amount: 1 },
    flavour: "Every unit, both sides of the table, back to the workshop.",
  },
  {
    id: "robots-selfrepair",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "It Rebuilt Itself",
    ticker: "RR",
    rarity: "legendary",
    sector: "machine",
    launchMC: 64_000,
    pumpMC: 43_000,
    holders: 5,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Came back online with a different serial number and the same wallet.",
  },
  {
    id: "robots-detonate",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "It Went Off",
    ticker: "RR",
    rarity: "mythic",
    sector: "machine",
    launchMC: 120_000,
    pumpMC: 50_000,
    holders: 4,
    effect: { kind: "damageHolders", target: "allProjects", amount: 3 },
    flavour: "Ten percent chance, they said. It was a Tuesday.",
  },
];

// ---------------------------------------------------------------------------
// HOWLERS — lunar
//
// The pack that came out at night. The old Howlers cards swapped things: your
// lowest for your highest, yours for theirs, buffs into debuffs. This engine has
// no swap and is not getting one for a single family, so the family took the
// half of that idea it can keep — the cards are worth most when you are behind.
// ---------------------------------------------------------------------------

const HOWLERS: ProjectCard[] = [
  {
    id: "howlers-first",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "The First Howl",
    ticker: "HOWL",
    rarity: "common",
    sector: "lunar",
    launchMC: 14_000,
    pumpMC: 8_000,
    holders: 3,
    flavour: "Minted at two in the morning because that is when the pack is awake.",
  },
  {
    id: "howlers-behind",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "Down And Loud About It",
    ticker: "HOWL",
    rarity: "common",
    sector: "lunar",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 3,
    payoff: {
      when: { kind: "behindBy", mc: 250_000 },
      effect: { kind: "directMC", target: "self", mc: 90_000 },
    },
    flavour: "Nobody howls on the way up. That is not what howling is for.",
  },
  {
    id: "howlers-moon",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "Full Moon",
    ticker: "HOWL",
    rarity: "rare",
    sector: "lunar",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { lunar: 12_000 },
    },
    flavour: "Once a month the floor moved and nobody had a reason for it.",
  },
  {
    id: "howlers-mirror",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "It Copied Them Back",
    ticker: "HOWL",
    rarity: "rare",
    sector: "lunar",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 3,
    effect: { kind: "stealMC", percentage: 8 },
    flavour: "Whatever the other side did, it turned up in the pack a week later.",
  },
  {
    id: "howlers-lowest",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "It Carried The Runt",
    ticker: "HOWL",
    rarity: "epic",
    sector: "lunar",
    launchMC: 37_000,
    pumpMC: 24_000,
    holders: 4,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "The pack moves at the speed of its slowest, which is the whole idea.",
  },
  {
    id: "howlers-night",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "The Long Night",
    ticker: "HOWL",
    rarity: "epic",
    sector: "lunar",
    launchMC: 43_000,
    pumpMC: 25_000,
    holders: 4,
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { lunar: 10_000 } },
    flavour: "Eight months of nothing and the group chat never went quiet once.",
  },
  {
    id: "howlers-pack",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "The Whole Pack",
    ticker: "HOWL",
    rarity: "legendary",
    sector: "lunar",
    launchMC: 67_000,
    pumpMC: 41_000,
    holders: 5,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { lunar: 20_000, meme: 6_000 },
    },
    flavour: "They stopped counting holders and started counting who showed up.",
  },
  {
    id: "howlers-inversion",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "Everything Turned Over",
    ticker: "HOWL",
    rarity: "mythic",
    sector: "lunar",
    launchMC: 106_000,
    pumpMC: 56_000,
    holders: 6,
    // The old mythic inverted every buff and debuff on the field. Inversion is
    // not a thing this engine can express, and the nearest honest version is a
    // scale on both sides: it widens whoever is ahead and narrows whoever is
    // not, so it is a decision rather than a wash.
    effect: { kind: "scaleMC", target: "both", percentage: -22 },
    payoff: {
      when: { kind: "behindBy", mc: 600_000 },
      effect: { kind: "directMC", target: "self", mc: 320_000 },
    },
    flavour: "The chart flipped, and for one evening every loser was a genius.",
  },
];

// ---------------------------------------------------------------------------
// FFS — meme
//
// The one that fed itself to the others. Half the old FFS set took MC off itself
// to give it away, and the other half paid out for having done so. That is a
// real archetype and it survives the translation intact.
// ---------------------------------------------------------------------------

const FFS: ProjectCard[] = [
  {
    id: "ffs-sigh",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "The Name Says It",
    ticker: "FFS",
    rarity: "common",
    sector: "meme",
    launchMC: 12_000,
    pumpMC: 9_000,
    holders: 2,
    flavour: "Named in frustration at four in the morning and never renamed.",
  },
  {
    id: "ffs-tithe",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "It Gave It Away",
    ticker: "FFS",
    rarity: "common",
    sector: "meme",
    launchMC: 20_000,
    pumpMC: 7_000,
    holders: 2,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 5_000 },
    },
    flavour: "Sold its own bag to fund a marketing wallet for everyone else.",
  },
  {
    id: "ffs-bleed",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "It Bled For The Rest",
    ticker: "FFS",
    rarity: "rare",
    sector: "meme",
    launchMC: 30_000,
    pumpMC: 12_000,
    holders: 2,
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    flavour: "Down eighty percent and still funding the others. On purpose.",
  },
  {
    id: "ffs-behind",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "Worst Entry On The Chart",
    ticker: "FFS",
    rarity: "rare",
    sector: "meme",
    launchMC: 22_000,
    pumpMC: 16_000,
    holders: 3,
    payoff: {
      when: { kind: "behindBy", mc: 350_000 },
      effect: { kind: "directMC", target: "self", mc: 180_000 },
    },
    flavour: "Bought the top, held the bottom, told everybody about both.",
  },
  {
    id: "ffs-damage",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "It Took The Damage",
    ticker: "FFS",
    rarity: "epic",
    sector: "meme",
    launchMC: 46_000,
    pumpMC: 21_000,
    holders: 5,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Whatever came in, it stood in front of it. Every single time.",
  },
  {
    id: "ffs-payoff",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "It Was Worth It",
    ticker: "FFS",
    rarity: "epic",
    sector: "meme",
    launchMC: 34_000,
    pumpMC: 27_000,
    holders: 3,
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 4 },
      effect: { kind: "directMC", target: "self", mc: 130_000 },
    },
    flavour: "Everything it gave away came back wearing somebody else's ticker.",
  },
  {
    id: "ffs-martyr",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "Nothing Left To Give",
    ticker: "FFS",
    rarity: "legendary",
    sector: "meme",
    launchMC: 58_000,
    pumpMC: 44_000,
    holders: 4,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 14_000 },
    },
    flavour: "The wallet hit zero and the token did its best week ever.",
  },
  {
    id: "ffs-comeback",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "For Fork's Sake",
    ticker: "FFS",
    rarity: "mythic",
    sector: "meme",
    launchMC: 96_000,
    pumpMC: 60_000,
    holders: 5,
    effect: { kind: "healHolders", target: "allProjects", amount: 2 },
    // Heals both sides, and is still a mythic. Everything it ever did was for
    // other people, and a mythic that finally does it for the whole table is the
    // only ending that card has.
    payoff: {
      when: { kind: "behindBy", mc: 500_000 },
      effect: { kind: "scaleMC", target: "self", percentage: 45 },
    },
    flavour: "Everybody who laughed at the name owned some by the end.",
  },
];

// ---------------------------------------------------------------------------
// CRAZZZY MONSTERS — meme
//
// The one that hurt everybody, itself included. The old set is full of cards
// that deal damage to the field without checking whose it is, and then pay out
// for the wreckage.
// ---------------------------------------------------------------------------

const MONSTERS: ProjectCard[] = [
  {
    id: "monsters-hatch",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "Something Hatched",
    ticker: "CRZY",
    rarity: "common",
    sector: "meme",
    launchMC: 15_000,
    pumpMC: 8_000,
    holders: 2,
    flavour: "Three z's, because two did not look unhinged enough.",
  },
  {
    id: "monsters-bite",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "It Bit Somebody",
    ticker: "CRZY",
    rarity: "common",
    sector: "meme",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 2,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "The first holder to complain got a monster named after him.",
  },
  {
    id: "monsters-loose",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "One Got Loose",
    ticker: "CRZY",
    rarity: "rare",
    sector: "meme",
    launchMC: 24_000,
    pumpMC: 15_000,
    holders: 3,
    effect: { kind: "damageHolders", target: "allProjects", amount: 1 },
    flavour: "It did not check whose side anybody was on. It never has.",
  },
  {
    id: "monsters-feed",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "It Fed On The Mess",
    ticker: "CRZY",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 16_000,
    holders: 3,
    payoff: {
      when: { kind: "behindBy", mc: 300_000 },
      effect: { kind: "directMC", target: "self", mc: 150_000 },
    },
    flavour: "The worse the chart got, the more of them turned up.",
  },
  {
    id: "monsters-swarm",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "The Whole Swarm",
    ticker: "CRZY",
    rarity: "epic",
    sector: "meme",
    launchMC: 38_000,
    pumpMC: 24_000,
    holders: 4,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "Ten thousand of them and every single one is somebody's favourite.",
  },
  {
    id: "monsters-mutate",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "It Mutated",
    ticker: "CRZY",
    rarity: "epic",
    sector: "meme",
    launchMC: 40_000,
    pumpMC: 26_000,
    holders: 3,
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 8_000 },
    flavour: "Traits nobody drew started showing up in the metadata.",
  },
  {
    id: "monsters-carnage",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "Everybody Lost Something",
    ticker: "CRZY",
    rarity: "legendary",
    sector: "meme",
    launchMC: 69_000,
    pumpMC: 41_000,
    holders: 4,
    effect: { kind: "damageHolders", target: "allProjects", amount: 2 },
    flavour: "Both floors halved in a night and the Discord had never been busier.",
  },
  {
    id: "monsters-apex",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "The One At The Top",
    ticker: "CRZY",
    rarity: "mythic",
    sector: "meme",
    launchMC: 118_000,
    pumpMC: 58_000,
    holders: 5,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 3 },
    flavour: "It ate the thing that was eating everything else.",
  },
];

// ---------------------------------------------------------------------------
// NOVA — memetility
//
// The one that paid for a full shelf. Every Nova card in the old set asked how
// many different things you were holding, which in this engine is the portfolio.
// ---------------------------------------------------------------------------

const NOVA: ProjectCard[] = [
  {
    id: "nova-spark",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "First Light",
    ticker: "NOVA",
    rarity: "common",
    sector: "memetility",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 3,
    flavour: "Launched quietly on a Sunday, which is not how anybody does it.",
  },
  {
    id: "nova-second",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "It Was Not Alone",
    ticker: "NOVA",
    rarity: "common",
    sector: "memetility",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 3,
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 2 },
      effect: { kind: "directMC", target: "self", mc: 45_000 },
    },
    flavour: "It never worked on its own and never pretended to.",
  },
  {
    id: "nova-draw",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "It Kept Finding Things",
    ticker: "NOVA",
    rarity: "rare",
    sector: "memetility",
    launchMC: 26_000,
    pumpMC: 14_000,
    holders: 3,
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Whatever you were building, there was a Nova thing that plugged in.",
  },
  {
    id: "nova-shelf",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "A Full Shelf",
    ticker: "NOVA",
    rarity: "rare",
    sector: "memetility",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 4 },
      effect: { kind: "directMC", target: "self", mc: 110_000 },
    },
    flavour: "Four different tickers and one wallet. That was the whole thesis.",
  },
  {
    id: "nova-suite",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "The Suite",
    ticker: "NOVA",
    rarity: "epic",
    sector: "memetility",
    launchMC: 39_000,
    pumpMC: 24_000,
    holders: 4,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { memetility: 9_000, meme: 4_000 },
    },
    flavour: "Six products, one login, and a roadmap that actually shipped.",
  },
  {
    id: "nova-sector",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "It Ran The Sector",
    ticker: "NOVA",
    rarity: "epic",
    sector: "memetility",
    launchMC: 42_000,
    pumpMC: 25_000,
    holders: 4,
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "memetility", atLeast: 3 },
      effect: { kind: "directMC", target: "self", mc: 160_000 },
    },
    flavour: "By the end you could not build on Cronos without touching it.",
  },
  {
    id: "nova-standard",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "It Became The Standard",
    ticker: "NOVA",
    rarity: "legendary",
    sector: "memetility",
    launchMC: 68_000,
    pumpMC: 42_000,
    holders: 5,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { memetility: 13_000 },
    },
    flavour: "Nobody voted for it. Everybody integrated it.",
  },
  {
    id: "nova-everything",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "One Of Everything",
    ticker: "NOVA",
    rarity: "mythic",
    sector: "memetility",
    launchMC: 110_000,
    pumpMC: 57_000,
    holders: 6,
    effect: { kind: "drawCards", amount: 3 },
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 5 },
      effect: { kind: "directMC", target: "self", mc: 300_000 },
    },
    flavour: "The wallet screenshot that started three hundred copycat threads.",
  },
];

// ---------------------------------------------------------------------------
// CR00TS — memetility
//
// The one that took a little from everybody. The old set stole MC from enemy
// projects below a threshold, over and over, in small amounts. Here that is one
// effect — stealMC — and the family is the ladder of how much.
// ---------------------------------------------------------------------------

const CR00TS: ProjectCard[] = [
  {
    id: "cr00ts-skim",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "A Little Off The Top",
    ticker: "CR00",
    rarity: "common",
    sector: "memetility",
    launchMC: 14_000,
    pumpMC: 8_000,
    holders: 3,
    effect: { kind: "stealMC", percentage: 4 },
    flavour: "Two percent nobody notices is a business nobody complains about.",
  },
  {
    id: "cr00ts-survive",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "It Kept Surviving",
    ticker: "CR00",
    rarity: "common",
    sector: "memetility",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 4,
    flavour: "Written off four times. Still quoting a spread this morning.",
  },
  {
    id: "cr00ts-toll",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "Everybody Paid The Toll",
    ticker: "CR00",
    rarity: "rare",
    sector: "memetility",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    effect: { kind: "stealMC", percentage: 6 },
    flavour: "You did not have to use it. You just could not get past it.",
  },
  {
    id: "cr00ts-small",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "It Went For The Thin Ones",
    ticker: "CR00",
    rarity: "rare",
    sector: "memetility",
    launchMC: 27_000,
    pumpMC: 14_000,
    holders: 3,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Never the whale. Always the forty wallets nobody was watching.",
  },
  {
    id: "cr00ts-spread",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "The Spread Widened",
    ticker: "CR00",
    rarity: "epic",
    sector: "memetility",
    launchMC: 38_000,
    pumpMC: 23_000,
    holders: 4,
    effect: { kind: "stealMC", percentage: 16 },
    flavour: "Same screen, same button, four percent worse. For eleven months.",
  },
  {
    id: "cr00ts-reflect",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "It Sent It Back",
    ticker: "CR00",
    rarity: "epic",
    sector: "memetility",
    launchMC: 41_000,
    pumpMC: 25_000,
    holders: 5,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Whatever you sent at it turned up in your own book by Friday.",
  },
  {
    id: "cr00ts-vault",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "It Had Been Counting",
    ticker: "CR00",
    rarity: "legendary",
    sector: "memetility",
    launchMC: 66_000,
    pumpMC: 42_000,
    holders: 5,
    effect: { kind: "stealMC", percentage: 16 },
    flavour: "Turned out somebody had been writing all of it down since the start.",
  },
  {
    id: "cr00ts-clearing",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "It Cleared The Board",
    ticker: "CR00",
    rarity: "mythic",
    sector: "memetility",
    launchMC: 112_000,
    pumpMC: 55_000,
    holders: 6,
    effect: { kind: "stealMC", percentage: 22 },
    payoff: {
      when: { kind: "turnAtLeast", turn: 8 },
      effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    },
    flavour: "One address, one afternoon, and a third of the chain's float.",
  },
];

// ---------------------------------------------------------------------------
// LIONEL — meme
//
// The one that was still there at the end. Everything the old Lionel set did was
// about surviving to Final Calculation, and this engine has a turn number, so
// that idea keeps its shape exactly: the cards are worth more late.
// ---------------------------------------------------------------------------

const LIONEL: ProjectCard[] = [
  {
    id: "lionel-quiet",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "It Kept Its Head Down",
    ticker: "LION",
    rarity: "common",
    sector: "meme",
    launchMC: 13_000,
    pumpMC: 9_000,
    holders: 4,
    flavour: "No thread, no space, no partnership. Just a chart that would not die.",
  },
  {
    id: "lionel-guard",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "It Stood In Front",
    ticker: "LION",
    rarity: "common",
    sector: "meme",
    launchMC: 16_000,
    pumpMC: 8_000,
    holders: 4,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "Whatever came for the small holders had to come through it first.",
  },
  {
    id: "lionel-late",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "Still Here In Month Nine",
    ticker: "LION",
    rarity: "rare",
    sector: "meme",
    launchMC: 24_000,
    pumpMC: 15_000,
    holders: 4,
    payoff: {
      when: { kind: "turnAtLeast", turn: 6 },
      effect: { kind: "directMC", target: "self", mc: 100_000 },
    },
    flavour: "The others got faster. It got older, which turned out to be better.",
  },
  {
    id: "lionel-hold",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "Nobody Sold",
    ticker: "LION",
    rarity: "rare",
    sector: "meme",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 5,
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 5_000 },
    flavour: "The float never moved. Every wallet chart was a flat line and proud.",
  },
  {
    id: "lionel-survivors",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "Four Of Them Made It",
    ticker: "LION",
    rarity: "epic",
    sector: "meme",
    launchMC: 37_000,
    pumpMC: 24_000,
    holders: 5,
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 4 },
      effect: { kind: "directMC", target: "self", mc: 170_000 },
    },
    flavour: "Half the collection was gone by then. This half was not.",
  },
  {
    id: "lionel-pride",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "The Pride",
    ticker: "LION",
    rarity: "epic",
    sector: "meme",
    launchMC: 40_000,
    pumpMC: 25_000,
    holders: 5,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 8_000 },
    },
    flavour: "Not the loudest group on the chain. Comfortably the oldest.",
  },
  {
    id: "lionel-endgame",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "Final Calculation",
    ticker: "LION",
    rarity: "legendary",
    sector: "meme",
    launchMC: 64_000,
    pumpMC: 43_000,
    holders: 6,
    payoff: {
      when: { kind: "turnAtLeast", turn: 8 },
      effect: { kind: "scaleMC", target: "self", percentage: 30 },
    },
    flavour: "Everybody counts at the end. It had been counting the whole time.",
  },
  {
    id: "lionel-untouched",
    type: "project",
    project: "lionel",
    name: "Lionel",
    moment: "Not One Of Them Fell",
    ticker: "LION",
    rarity: "mythic",
    sector: "meme",
    launchMC: 104_000,
    pumpMC: 56_000,
    holders: 8,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 3 },
    flavour: "Three years, four bear markets, and the floor never once broke.",
  },
];

// ---------------------------------------------------------------------------
// CAW777 — meme
//
// The one about the number. Every card in the old set counted sevens, and most
// of them counted something this engine has no idea about — a market cap ending
// in seven, a total that is a multiple of seven. What survives is the number
// itself: every figure on every one of these eight cards is sevens.
// ---------------------------------------------------------------------------

const CAW: ProjectCard[] = [
  {
    id: "caw-first",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "Three Sevens",
    ticker: "CAW",
    rarity: "common",
    sector: "meme",
    launchMC: 17_000,
    pumpMC: 7_000,
    holders: 2,
    flavour: "Somebody checked the contract address and there they were.",
  },
  {
    id: "caw-lucky",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "It Kept Happening",
    ticker: "CAW",
    rarity: "common",
    sector: "meme",
    launchMC: 17_000,
    pumpMC: 7_000,
    holders: 3,
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    flavour: "Block seven-seven-seven-seven. The screenshot did numbers.",
  },
  {
    id: "caw-seventh",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "The Seventh Day",
    ticker: "CAW",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 17_000,
    holders: 3,
    effect: { kind: "directMC", target: "self", mc: 27_000 },
    flavour: "A week to the hour, and it did the whole thing again.",
  },
  {
    id: "caw-counting",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "Everybody Started Counting",
    ticker: "CAW",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 17_000,
    holders: 3,
    effect: { kind: "drawCards", amount: 2 },
    flavour: "The chat found sevens in the supply, the fee and the founder's age.",
  },
  {
    id: "caw-streak",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "Seven Green Days",
    ticker: "CAW",
    rarity: "epic",
    sector: "meme",
    launchMC: 37_000,
    pumpMC: 27_000,
    holders: 4,
    effect: {
      kind: "pumpBySector",
      target: "allOwnProjects",
      bonuses: { meme: 7_000 },
    },
    flavour: "Seven in a row. On the eighth everybody was watching, so it stopped.",
  },
  {
    id: "caw-jackpot",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "It Paid Out",
    ticker: "CAW",
    rarity: "epic",
    sector: "meme",
    launchMC: 47_000,
    pumpMC: 27_000,
    holders: 4,
    payoff: {
      when: { kind: "turnAtLeast", turn: 7 },
      effect: { kind: "directMC", target: "self", mc: 177_000 },
    },
    flavour: "Three reels, one number, and a chart that agreed with it.",
  },
  {
    id: "caw-triple",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "Seventy-Seven Thousand Holders",
    ticker: "CAW",
    rarity: "legendary",
    sector: "meme",
    launchMC: 77_000,
    pumpMC: 47_000,
    holders: 7,
    flavour: "It stopped there. Nobody could get the count to move past it.",
  },
  {
    id: "caw-sevens",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "All Of Them At Once",
    ticker: "CAW",
    rarity: "mythic",
    sector: "meme",
    launchMC: 107_000,
    pumpMC: 57_000,
    holders: 7,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "meme", atLeast: 3 },
      effect: { kind: "directMC", target: "self", mc: 277_000 },
    },
    flavour: "Seven sevens on one screen. Two people printed it and framed it.",
  },
];

// ---------------------------------------------------------------------------
// DAK — meme
//
// The apes. The old set destroyed enemy projects and then paid out for having
// destroyed them, which is the cleanest archetype in the whole first version and
// the one that needed the least translation.
// ---------------------------------------------------------------------------

const DAK: ProjectCard[] = [
  {
    id: "dak-first",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "The First Ape",
    ticker: "DAK",
    rarity: "common",
    sector: "meme",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 2,
    flavour: "Ten thousand of them, and the first one still sets the floor.",
  },
  {
    id: "dak-swing",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "It Swung First",
    ticker: "DAK",
    rarity: "common",
    sector: "meme",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 2,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "No warning, no thread, no negotiation. Just a floor sweep.",
  },
  {
    id: "dak-trade",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "It Sold Its Own",
    ticker: "DAK",
    rarity: "rare",
    sector: "meme",
    launchMC: 28_000,
    pumpMC: 15_000,
    holders: 2,
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    flavour: "Dumped the small one to buy more of the big one. It worked twice.",
  },
  {
    id: "dak-payoff",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "It Collected",
    ticker: "DAK",
    rarity: "rare",
    sector: "meme",
    launchMC: 24_000,
    pumpMC: 16_000,
    holders: 3,
    payoff: {
      when: { kind: "turnAtLeast", turn: 5 },
      effect: { kind: "directMC", target: "self", mc: 120_000 },
    },
    flavour: "Every floor it broke, somebody had to buy back in higher.",
  },
  {
    id: "dak-sweep",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "The Sweep",
    ticker: "DAK",
    rarity: "epic",
    sector: "meme",
    launchMC: 39_000,
    pumpMC: 24_000,
    holders: 3,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "Four hundred listings gone in nine minutes and one wallet did it.",
  },
  {
    id: "dak-spoils",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "The Spoils",
    ticker: "DAK",
    rarity: "epic",
    sector: "meme",
    launchMC: 43_000,
    pumpMC: 25_000,
    holders: 4,
    effect: { kind: "stealMC", percentage: 15 },
    flavour: "Whatever the other collection lost turned up in this one's floor.",
  },
  {
    id: "dak-troop",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "The Whole Troop",
    ticker: "DAK",
    rarity: "legendary",
    sector: "meme",
    launchMC: 70_000,
    pumpMC: 40_000,
    holders: 4,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "They came down the timeline together and something stopped existing.",
  },
  {
    id: "dak-again",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "And Then Another",
    ticker: "DAK",
    rarity: "mythic",
    sector: "meme",
    launchMC: 116_000,
    pumpMC: 53_000,
    holders: 5,
    effect: { kind: "stealMC", percentage: 20 },
    payoff: {
      when: { kind: "turnAtLeast", turn: 6 },
      effect: { kind: "directMC", target: "self", mc: 220_000 },
    },
    flavour: "It never stopped at one. That was the thing everybody got wrong.",
  },
];

// ---------------------------------------------------------------------------
// THE FOUNDERS
//
// One card each, and not five. In the first version a founder was a ladder —
// the same person at common, rare, epic, legendary and mythic — which is how a
// project's moments work but not how a person does. Sixty founder cards for
// twelve people is fifty-eight cards of the same face.
//
// An influencer must carry an aura, and a founder's aura is their own sector.
// That is the whole of what a founder was in the old engine anyway: a standing
// bonus to your side for as long as they were at the table.
//
// ── ON THE NAMES ────────────────────────────────────────────────────────────
// These are called "The <project> Founder" because the first version never wrote
// their names down — the cards were ids like COC_Clove_Founder_M1 and nothing
// else. The maker knows who each of them is; an outsider inventing a handle for
// a real person is the one thing that is worse than a placeholder. Renaming one
// is two fields and no mechanics.
// ---------------------------------------------------------------------------

const FOUNDERS: InfluencerCard[] = [
  {
    id: "founder-clove",
    type: "influencer",
    name: "The Clove Founder",
    ticker: "CLOVEDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "meme", bonus: 12_000 },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "Handed the keys to the chat and never asked for them back.",
  },
  {
    id: "founder-crooks",
    type: "influencer",
    name: "The Crooks Founder",
    ticker: "CFDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 22_000 },
    flavour: "Answered every accusation with a commit and nothing else.",
  },
  {
    id: "founder-wolfswap",
    type: "influencer",
    name: "The Wolfswap Founder",
    ticker: "WOLFDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 20_000 },
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Shipped the fork on a Sunday and told the other team on Monday.",
  },
  {
    id: "founder-robots",
    type: "influencer",
    name: "The Reckless Robots Founder",
    ticker: "RRDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "machine", bonus: 15_000 },
    flavour: "Builds the thing, then finds out what it does. In that order.",
  },
  {
    id: "founder-howlers",
    type: "influencer",
    name: "The Howlers Founder",
    ticker: "HOWLDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "lunar", bonus: 16_000 },
    flavour: "Posts at three in the morning and the whole pack is awake for it.",
  },
  {
    id: "founder-ffs",
    type: "influencer",
    name: "The FFS Founder",
    ticker: "FFSDEV",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "meme", bonus: 7_000 },
    effect: { kind: "directMC", target: "self", mc: -8_000 },
    flavour: "Funded four other projects and never once mentioned his own.",
  },
  {
    id: "founder-monsters",
    type: "influencer",
    name: "The Crazzzy Monsters Founder",
    ticker: "CRZYDEV",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "meme", bonus: 8_000 },
    // The enemy board and not the whole table. Crazzzy Monsters projects hurt
    // everybody and that is their character, but an influencer that damages the
    // side that played it is a drawback nobody can see coming — engine/types.ts
    // says drawbacks belong in the numbers, not in a hidden rule. The preview
    // caught this: it painted the founder's own board red, correctly.
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Drew all ten thousand by hand and has the wrist to prove it.",
  },
  {
    id: "founder-nova",
    type: "influencer",
    name: "The Nova Founder",
    ticker: "NOVADEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 13_000 },
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Shipped six things nobody asked for. Four of them are load-bearing.",
  },
  {
    id: "founder-cr00ts",
    type: "influencer",
    name: "The Cr00ts Founder",
    ticker: "CR00DEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 14_000 },
    effect: { kind: "stealMC", percentage: 7 },
    flavour: "Has never announced anything. The volume announces it for him.",
  },
  {
    id: "founder-lionel",
    type: "influencer",
    name: "The Lionel Founder",
    ticker: "LIONDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "meme", bonus: 21_000 },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Three years of the same avatar and the same two-line updates.",
  },
  {
    id: "founder-caw",
    type: "influencer",
    name: "The CAW777 Founder",
    ticker: "CAWDEV",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "meme", bonus: 7_000 },
    effect: { kind: "directMC", target: "self", mc: 77_000 },
    flavour: "Will not ship anything on a day whose digits do not add up.",
  },
  {
    id: "founder-dak",
    type: "influencer",
    name: "The DAK Founder",
    ticker: "DAKDEV",
    rarity: "mythic",
    aura: { kind: "pumpSector", sector: "meme", bonus: 38_000 },
    effect: { kind: "rug", target: "enemyProject" },
    flavour: "Swept a rival floor to zero and posted the receipt, nothing else.",
  },
];

// ---------------------------------------------------------------------------
// THE VOICES
//
// Five people the first version already named, kept under the names it gave
// them. Where the founders are a placeholder, these are not: these cards shipped
// with these names on them and people hold them.
//
// The two the old set filed under "Community" are here too. Community was a
// separate card type over there because a founder had its own deck slot; under
// this engine there is no slot to protect, and a person who pumps your side by
// being present is an influencer whatever the old file called them.
// ---------------------------------------------------------------------------

const VOICES: InfluencerCard[] = [
  {
    id: "pampa",
    type: "influencer",
    name: "Pampa",
    ticker: "PAMPA",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "meme", bonus: 11_000 },
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Says the thing everybody was thinking, an hour before they think it.",
  },
  {
    id: "twentyone",
    type: "influencer",
    name: "21Million",
    ticker: "21M",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "meme", bonus: 20_000 },
    flavour: "Has held through two cycles and will tell you the entry price.",
  },
  {
    id: "francis",
    type: "influencer",
    name: "Francis",
    ticker: "FRANCIS",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 12_000 },
    effect: { kind: "stealMC", percentage: 9 },
    flavour: "Turns up in the replies of whatever is about to move. Every time.",
  },
  {
    id: "curry",
    type: "influencer",
    name: "Curry",
    ticker: "CURRY",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "meme", bonus: 19_000 },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Runs the room. Has never once posted a chart.",
  },
  {
    id: "vinz",
    type: "influencer",
    name: "Vinz",
    ticker: "VINZ",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "lunar", bonus: 8_000 },
    effect: { kind: "healHolders", target: "ownProject", amount: 2 },
    flavour: "Finds whoever is quietly down bad and gets them back in the chat.",
  },
];

// ---------------------------------------------------------------------------
// THE ARCHETYPES
//
// Nobody in particular, and that is the point: these are the roles the trenches
// are made of rather than the people filling them this month. They came over
// from the maker's other card game, which is his own work — the difference is
// that a named Solana account does not travel and a role does.
//
// Their sectors have been remapped to the four this game has, and the ones whose
// sector went with the chain went with it: the guild leader, the pollster and
// the prompt engineer have nothing to pump here.
// ---------------------------------------------------------------------------

const ARCHETYPES: InfluencerCard[] = [
  {
    id: "caller",
    type: "influencer",
    name: "The Caller",
    ticker: "CALLER",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "meme", bonus: 7_000 },
    flavour: "Says it with the size on screen. Wins and losses both.",
  },
  {
    id: "copytarget",
    type: "influencer",
    name: "The Copy Target",
    ticker: "COPYTARGET",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "meme", bonus: 7_000 },
    flavour: "Does not post. Four thousand wallets watch the address anyway.",
  },
  {
    id: "sweeper",
    type: "influencer",
    name: "The Floor Sweeper",
    ticker: "SWEEP",
    rarity: "common",
    aura: { kind: "pumpSector", sector: "lunar", bonus: 3_000 },
    flavour: "Buys the cheapest twenty of anything the moment it moves.",
  },
  {
    id: "whitelist",
    type: "influencer",
    name: "The Whitelist Hunter",
    ticker: "WHITELIST",
    rarity: "common",
    aura: { kind: "pumpSector", sector: "lunar", bonus: 3_000 },
    flavour: "In nine Discords, active in none, on the list for all of them.",
  },
  {
    id: "validator",
    type: "influencer",
    name: "The Validator",
    ticker: "VALIDATOR",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 6_000 },
    flavour: "Keeps a machine in a rack running so everybody else can trade.",
  },
  {
    id: "farmer",
    type: "influencer",
    name: "The Airdrop Farmer",
    ticker: "FARMER",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "memetility", bonus: 6_000 },
    flavour: "Forty wallets, every protocol, and a calendar of snapshot dates.",
  },
  {
    id: "nodeguy",
    type: "influencer",
    name: "The Node Runner",
    ticker: "NODE",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "machine", bonus: 7_000 },
    flavour: "Six boxes on the roof and a spreadsheet of what each one earns.",
  },
  {
    id: "mintbot",
    type: "influencer",
    name: "The Mint Bot",
    ticker: "MINTBOT",
    rarity: "common",
    aura: { kind: "pumpSector", sector: "machine", bonus: 4_000 },
    flavour: "Sat on the contract for eleven hours and took forty of them.",
  },
];

// ---------------------------------------------------------------------------
// TOOLS
//
// Something you use rather than something you hold. A block explorer has no
// token and you cannot take a position in a wallet, so none of these belongs in
// a portfolio — they sit beside it and make it work better.
//
// Half of them are chain-agnostic and came over unchanged; the other half are
// the ones a Cronos wallet actually has open.
// ---------------------------------------------------------------------------

const TOOLS: ToolCard[] = [
  {
    id: "cronoscan",
    type: "tool",
    name: "Cronoscan",
    ticker: "CRONOSCAN",
    rarity: "common",
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Every answer is already in there. Nobody wants to read it.",
  },
  {
    id: "metamask",
    type: "tool",
    name: "MetaMask",
    ticker: "METAMASK",
    rarity: "common",
    effect: { kind: "healHolders", target: "ownProject", amount: 1 },
    flavour: "The fox everybody complains about and nobody uninstalls.",
  },
  {
    id: "debank",
    type: "tool",
    name: "DeBank",
    ticker: "DEBANK",
    rarity: "common",
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Shows you a number you already knew, in a font you trust more.",
  },
  {
    id: "dexscreener",
    type: "tool",
    name: "DexScreener",
    ticker: "DEXSCREENER",
    rarity: "rare",
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    flavour: "Nine tabs of it, and the one you needed was the tenth.",
  },
  {
    id: "defi-wallet",
    type: "tool",
    name: "Crypto.com Wallet",
    ticker: "DEFIWALLET",
    rarity: "rare",
    effect: { kind: "extraBudget", target: "self", mc: 35_000 },
    aura: { kind: "pumpSector", sector: "memetility", bonus: 5_000 },
    flavour: "The on-ramp most of this chain arrived through, whatever they say now.",
  },
  {
    id: "bubblemaps",
    type: "tool",
    name: "Bubblemaps",
    ticker: "BUBBLEMAPS",
    rarity: "epic",
    effect: { kind: "cancel", target: "opponent", count: 1 },
    flavour: "Eleven wallets, one cluster, and a founder with nothing to say.",
  },
  {
    id: "gas-tracker",
    type: "tool",
    name: "The Gas Tracker",
    ticker: "GASTRACKER",
    rarity: "epic",
    effect: { kind: "extraBudget", target: "self", mc: 90_000 },
    flavour: "Cheap at four in the morning, which is when everything gets minted.",
  },
  {
    id: "ledger",
    type: "tool",
    name: "Ledger",
    ticker: "LEDGER",
    rarity: "legendary",
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "The one thing in this entire folder that has never lost anybody money.",
  },
];

// ---------------------------------------------------------------------------
// TACTICS
//
// Things you do rather than things you hold. These came over from the maker's
// other card game and needed almost nothing: buying a dip, getting jeeted on and
// paper-handing a bottom are not facts about a chain.
//
// One line changed. "Graduation" said a bonding curve moved to Raydium, which is
// a Solana venue; the card is about the moment a launch stops being private, and
// it says that instead.
// ---------------------------------------------------------------------------

const TACTICS: TacticCard[] = [
  // --- common ---
  {
    id: "ape-in",
    type: "tactic",
    name: "Ape In",
    ticker: "APE",
    rarity: "common",
    effect: { kind: "directMC", target: "self", mc: 25_000 },
    flavour: "Chart's green. Questions come later.",
  },
  {
    id: "copy-trade",
    type: "tactic",
    name: "Copy Trade",
    ticker: "COPY",
    rarity: "common",
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Opening his wallet is faster than thinking for yourself.",
  },
  {
    id: "buy-the-dip",
    type: "tactic",
    name: "Buy The Dip",
    ticker: "DIP",
    rarity: "common",
    effect: { kind: "healHolders", target: "ownProject", amount: 2 },
    // Twenty percent off is only a discount if it fell. A common, so the amount
    // is small and the moment is the point.
    payoff: {
      when: { kind: "behindBy", mc: 300_000 },
      effect: { kind: "directMC", target: "self", mc: 120_000 },
    },
    flavour: "Twenty percent off is a discount, you tell yourself.",
  },
  {
    id: "fud",
    type: "tactic",
    name: "FUD",
    ticker: "FUD",
    rarity: "common",
    effect: { kind: "damageHolders", target: "enemyProject", amount: 1 },
    flavour: "One reply under the announcement and the holders start doubting.",
  },
  {
    id: "jeet",
    type: "tactic",
    name: "Jeet",
    ticker: "JEET",
    rarity: "common",
    effect: { kind: "directMC", target: "opponent", mc: -20_000 },
    flavour: "He sold at forty thousand. It went to four million.",
  },
  {
    id: "paper-hands",
    type: "tactic",
    name: "Paper Hands",
    ticker: "PAPER",
    rarity: "common",
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "The whole group chat at once. Nobody admits it afterwards.",
  },
  {
    id: "diamond-hands",
    type: "tactic",
    name: "Diamond Hands",
    ticker: "DIAMOND",
    rarity: "common",
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    // You have watched it go to zero three times. Holding is worth nothing while
    // you are winning.
    payoff: {
      when: { kind: "behindBy", mc: 500_000 },
      effect: { kind: "directMC", target: "self", mc: 150_000 },
    },
    flavour: "You've watched it go to zero three times. You're still here.",
  },
  {
    id: "take-profit",
    type: "tactic",
    name: "Take Profit",
    ticker: "PROFIT",
    rarity: "common",
    effect: { kind: "scaleMC", target: "self", percentage: 10 },
    flavour: "Nobody ever went broke, and so on. You still feel sick about it.",
  },
  {
    id: "shill",
    type: "tactic",
    name: "Shill",
    ticker: "SHILL",
    rarity: "common",
    effect: { kind: "pumpProject", target: "ownProject", mc: 8_000 },
    flavour:
      "Three replies, a chart screenshot and a rocket. It works every time.",
  },
  {
    id: "slippage",
    type: "tactic",
    name: "Slippage",
    ticker: "SLIP",
    rarity: "common",
    effect: { kind: "directMC", target: "opponent", mc: -15_000 },
    flavour: "He set it to twenty percent to be safe. It took all twenty.",
  },
  {
    id: "exit-liquidity",
    type: "tactic",
    name: "Exit Liquidity",
    ticker: "EXIT",
    rarity: "common",
    effect: { kind: "stealMC", percentage: 6 },
    flavour: "Somebody has to be on the other side. Today it isn't you.",
  },
  {
    id: "rebrand",
    type: "tactic",
    name: "Rebrand",
    ticker: "REBRAND",
    rarity: "common",
    effect: { kind: "pumpProject", target: "ownProject", mc: 7_000 },
    flavour: "New logo, new ticker, same dev. Somehow that fixes it.",
  },

  // --- rare ---
  {
    id: "snipe",
    type: "tactic",
    name: "Snipe",
    ticker: "SNIPE",
    rarity: "rare",
    effect: { kind: "damageHolders", target: "enemyProject", amount: 2 },
    flavour: "In on block one. Before the tweet was even posted.",
  },
  {
    id: "cabal-call",
    type: "tactic",
    name: "Cabal Call",
    ticker: "CABAL",
    rarity: "rare",
    effect: { kind: "pumpProject", target: "ownProject", mc: 15_000 },
    flavour: "Forty guys in a chat, and this time you're in it.",
  },
  {
    id: "mev-sandwich",
    type: "tactic",
    name: "MEV Sandwich",
    ticker: "MEV",
    rarity: "rare",
    effect: { kind: "stealMC", percentage: 10 },
    flavour:
      "Your transaction sat right between two others. Coincidence, obviously.",
  },
  {
    id: "cto",
    type: "tactic",
    name: "Community Takeover",
    ticker: "CTO",
    rarity: "rare",
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    // The dev is gone and the community picks it up — which nobody does while
    // the chart is fine.
    payoff: {
      when: { kind: "behindBy", mc: 350_000 },
      effect: { kind: "pumpProject", target: "allOwnProjects", mc: 9_000 },
    },
    flavour:
      "The dev is gone. The community picks it up. Sometimes that works.",
  },
  {
    id: "dev-sells",
    type: "tactic",
    name: "Dev Sells",
    ticker: "DEVSELL",
    rarity: "rare",
    effect: { kind: "directMC", target: "opponent", mc: -35_000 },
    flavour: "The wallet that deployed it just moved. Everyone saw it at once.",
  },
  {
    id: "bundle",
    type: "tactic",
    name: "Bundle",
    ticker: "BUNDLE",
    rarity: "rare",
    effect: { kind: "extraBudget", target: "self", mc: 70_000 },
    flavour: "Eight wallets, one block, one owner. Check the bubble map.",
  },
  {
    id: "wallet-tracker",
    type: "tactic",
    name: "Wallet Tracker",
    ticker: "TRACK",
    rarity: "rare",
    effect: { kind: "drawCards", amount: 3 },
    flavour: "You don't need an edge if you can watch someone who has one.",
  },
  {
    id: "fomo",
    type: "tactic",
    name: "FOMO",
    ticker: "FOMO",
    rarity: "rare",
    effect: { kind: "scaleMC", target: "self", percentage: 18 },
    flavour: "You said you'd wait for the retrace. There was no retrace.",
  },
  {
    id: "gas-war",
    type: "tactic",
    name: "Gas War",
    ticker: "GAS",
    rarity: "rare",
    effect: { kind: "directMC", target: "opponent", mc: -30_000 },
    flavour: "Nine failed transactions and a filled one at the top.",
  },
  {
    id: "second-wind",
    type: "tactic",
    name: "Second Wind",
    ticker: "SECOND",
    rarity: "rare",
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    // Left for dead on Tuesday. The card is the comeback, so it is worth most
    // when there is something to come back from.
    payoff: {
      when: { kind: "behindBy", mc: 400_000 },
      effect: { kind: "directMC", target: "self", mc: 300_000 },
    },
    flavour: "Left for dead on Tuesday, back on the front page by Friday.",
  },

  // --- epic ---
  {
    id: "whale-dump",
    type: "tactic",
    name: "Whale Dump",
    ticker: "WHALE",
    rarity: "epic",
    effect: { kind: "directMC", target: "opponent", mc: -80_000 },
    flavour: "One wallet. Four percent of supply. Eleven seconds.",
  },
  {
    id: "trench-warfare",
    type: "tactic",
    name: "Trench Warfare",
    ticker: "TRENCH",
    rarity: "epic",
    effect: { kind: "extraBudget", target: "self", mc: 140_000 },
    flavour: "Sleep is for people with a job.",
  },
  {
    id: "insider-wallet",
    type: "tactic",
    name: "Insider Wallet",
    ticker: "LEAK",
    rarity: "epic",
    effect: { kind: "stealMC", percentage: 18 },
    flavour:
      "Funded from the same exchange address nine minutes before launch.",
  },
  {
    id: "supply-shock",
    type: "tactic",
    name: "Supply Shock",
    ticker: "SHOCK",
    rarity: "epic",
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 12_000 },
    // Nothing left on the book. A sweep is worth more the more of the book you
    // already hold.
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 5 },
      effect: { kind: "pumpProject", target: "allOwnProjects", mc: 8_000 },
    },
    flavour: "Nothing left on the book under a dollar. Somebody swept it all.",
  },
  {
    id: "coordinated-dump",
    type: "tactic",
    name: "Coordinated Dump",
    ticker: "COORD",
    rarity: "epic",
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "Same minute, same size, forty different wallets.",
  },
  {
    id: "profit-taking",
    type: "tactic",
    name: "Profit Taking",
    ticker: "REALISE",
    rarity: "epic",
    effect: { kind: "scaleMC", target: "self", percentage: 30 },
    flavour:
      "Realised, sitting in stables, and it still doesn't feel like enough.",
  },

  // --- legendary ---
  {
    id: "rug-pull",
    type: "tactic",
    name: "Rug Pull",
    ticker: "RUG",
    rarity: "legendary",
    effect: { kind: "rug", target: "enemyProject" },
    flavour: "The liquidity was there. Then it wasn't. It's that simple.",
  },
  {
    id: "cancelled",
    type: "tactic",
    name: "Cancelled",
    ticker: "CANCEL",
    rarity: "rare",
    effect: { kind: "cancel", target: "opponent", count: 1 },
    flavour: "Somebody found the old posts. That was the whole career.",
  },
  {
    id: "unfollowed",
    type: "tactic",
    name: "Mass Unfollow",
    ticker: "UNFOLLOW",
    rarity: "legendary",
    effect: { kind: "cancel", target: "opponent", count: 2 },
    flavour: "Two hundred thousand followers on Monday. Nobody on Friday.",
  },
  {
    id: "graduation",
    type: "tactic",
    name: "Graduation",
    ticker: "GRAD",
    rarity: "epic",
    effect: { kind: "pumpProject", target: "ownProject", mc: 22_000 },
    flavour:
      "The curve filled and it opened on a real book. From here it is in public.",
  },
  {
    id: "cex-listing",
    type: "tactic",
    name: "CEX Listing",
    ticker: "LISTING",
    rarity: "legendary",
    effect: { kind: "directMC", target: "self", mc: 110_000 },
    // The announcement half the timeline front-ran for a week. Late is when a
    // listing lands.
    payoff: {
      when: { kind: "turnAtLeast", turn: 7 },
      effect: { kind: "directMC", target: "self", mc: 90_000 },
    },
    flavour:
      "The announcement half the timeline had been front-running for a week.",
  },
  {
    id: "cabal-exit",
    type: "tactic",
    name: "Cabal Exit",
    ticker: "CABALEX",
    rarity: "legendary",
    effect: { kind: "stealMC", percentage: 30 },
    flavour:
      "They were never going to tell you when. You were the reason it worked.",
  },
];

// ---------------------------------------------------------------------------
// EVENTS
//
// Something that happened to the market rather than something you did, which is
// why an event has to hit the whole table — validation enforces it, so the type
// means something instead of being flavour on a tactic.
//
// Twenty of them, and deliberately not more. The first version had thirty, but
// two thirds of those are already here under other names: its Bull Market, Bear
// Market, Buy the Dip, Diamond Hands, Paper Hands, FOMO, FUD and Gas War are all
// cards in this file or in TACTICS above. Adding near-duplicates of cards that
// exist would make the set bigger and the game smaller.
// ---------------------------------------------------------------------------

const EVENTS: EventCard[] = [
  // --- common ---
  {
    id: "volatility",
    type: "event",
    name: "Volatility",
    ticker: "VOL",
    rarity: "common",
    effect: { kind: "damageHolders", target: "allProjects", amount: 1 },
    flavour: "Nothing happened. Everything moved twenty percent anyway.",
  },
  {
    id: "retail-arrives",
    type: "event",
    name: "Retail Arrives",
    ticker: "RETAIL",
    rarity: "common",
    effect: { kind: "pumpProject", target: "allProjects", mc: 4_000 },
    flavour:
      "Your uncle asks which app to download. Historically this is the top.",
  },
  {
    id: "green-day",
    type: "event",
    name: "Green Day",
    ticker: "GREEN",
    rarity: "common",
    effect: { kind: "scaleMC", target: "both", percentage: 8 },
    flavour: "Everything up. No reason given, none asked for.",
  },
  {
    id: "sideways",
    type: "event",
    name: "Sideways",
    ticker: "CHOP",
    rarity: "common",
    effect: { kind: "scaleMC", target: "both", percentage: -8 },
    flavour:
      "Three days of nothing. The chop takes more people than the crash.",
  },

  // --- rare ---
  {
    id: "bull-run",
    type: "event",
    name: "Bull Run",
    ticker: "BULL",
    rarity: "rare",
    effect: { kind: "scaleMC", target: "both", percentage: 20 },
    flavour: "Everything works. This is when you think you're good at this.",
  },
  {
    id: "bear-market",
    type: "event",
    name: "Bear Market",
    ticker: "BEAR",
    rarity: "rare",
    effect: { kind: "scaleMC", target: "both", percentage: -20 },
    flavour: "The timeline goes quiet. The ones still posting are lying.",
  },
  {
    id: "airdrop-season",
    type: "event",
    name: "Airdrop Season",
    ticker: "AIRDROP",
    rarity: "rare",
    effect: { kind: "pumpProject", target: "allProjects", mc: 7_000 },
    flavour:
      "Six months of farming, one morning of claiming, one afternoon of selling.",
  },
  {
    id: "rotation",
    type: "event",
    name: "Rotation",
    ticker: "ROTATE",
    rarity: "rare",
    effect: { kind: "healHolders", target: "allProjects", amount: 1 },
    flavour: "The money didn't leave. It just moved one narrative to the left.",
  },
  {
    id: "network-outage",
    type: "event",
    name: "Network Outage",
    ticker: "OUTAGE",
    rarity: "rare",
    effect: { kind: "damageHolders", target: "allProjects", amount: 1 },
    flavour:
      "Seventeen hours. Everybody learned what a validator was that week.",
  },

  // --- epic ---
  {
    // Replaces "Nation State Meta", which pumped a politics sector this game
    // does not have. The slot is the same shape — one epic that lifts a single
    // sector across the whole table — and DeFi Summer is the first version's own
    // card for exactly that season.
    id: "defi-summer",
    type: "event",
    name: "DeFi Summer",
    ticker: "SUMMER",
    rarity: "epic",
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { memetility: 30_000 },
    },
    flavour:
      "Four months where every chart was a vault and nobody read a contract.",
  },
  {
    id: "supercycle",
    type: "event",
    name: "Supercycle",
    ticker: "SUPER",
    rarity: "epic",
    effect: { kind: "scaleMC", target: "both", percentage: 35 },
    flavour: "The word nobody says out loud in case it stops.",
  },
  {
    id: "liquidation-cascade",
    type: "event",
    name: "Liquidation Cascade",
    ticker: "LIQ",
    rarity: "epic",
    effect: { kind: "scaleMC", target: "both", percentage: -35 },
    flavour: "One wick took eight hundred million in leverage with it.",
  },
  {
    id: "exchange-hack",
    type: "event",
    name: "Exchange Hack",
    ticker: "HACK",
    rarity: "epic",
    effect: { kind: "damageHolders", target: "allProjects", amount: 2 },
    flavour:
      "Withdrawals paused pending maintenance. You know what that means.",
  },
  {
    id: "etf-approval",
    type: "event",
    name: "ETF Approval",
    ticker: "ETF",
    rarity: "epic",
    effect: { kind: "pumpProject", target: "allProjects", mc: 14_000 },
    flavour:
      "The suits are in. Everyone who called them idiots is now very quiet.",
  },

  // --- legendary ---
  {
    id: "the-purge",
    type: "event",
    name: "The Purge",
    ticker: "PURGE",
    rarity: "legendary",
    effect: { kind: "cancel", target: "both", count: 1 },
    flavour: "The platform woke up one morning and decided nobody was famous.",
  },
  {
    id: "the-bottom",
    type: "event",
    name: "The Bottom",
    ticker: "BOTTOM",
    rarity: "legendary",
    effect: { kind: "pumpProject", target: "allProjects", mc: 20_000 },
    // The turn. A bottom is only a bottom if you were down, and the whole card
    // is about the moment nobody wanted it.
    payoff: {
      when: { kind: "behindBy", mc: 700_000 },
      effect: { kind: "scaleMC", target: "self", percentage: 35 },
    },
    flavour:
      "Nothing left but the people who could not sell. That was the turn.",
  },
  {
    id: "ftx-collapse",
    type: "event",
    name: "FTX Collapse",
    ticker: "FTX",
    rarity: "legendary",
    effect: { kind: "damageHolders", target: "allProjects", amount: 3 },
    flavour:
      "Every chain was declared dead by people who had never used one.",
  },
  {
    id: "the-flippening",
    type: "event",
    name: "The Flippening",
    ticker: "FLIP",
    rarity: "legendary",
    effect: { kind: "scaleMC", target: "both", percentage: 50 },
    flavour:
      "The chart everybody has been posting since 2021, finally doing the thing.",
  },

  // --- mythic ---
  {
    // The one event named after a real person. The influencer block is kept
    // together so a name can be pulled in one place; this card sits outside it,
    // so it is flagged here rather than being easy to miss.
    //
    // An influencer would have been the wrong type anyway: an aura buffs one
    // sector every turn, and the whole point of this one is that it moves the
    // market from outside it — both boards at once.
    //
    // It pumped memes and dog memes harder until dog was folded into meme. The
    // dogs are memes now, so the card still lifts BONK and WIF; it just does it
    // in one tier.
    id: "elon-posts",
    type: "event",
    name: "Elon Posts",
    ticker: "ELON",
    rarity: "legendary",
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { meme: 25_000 },
    },
    flavour:
      "One post at three in the morning, and every dog on the timeline doubles.",
  },
  {
    id: "black-swan",
    type: "event",
    name: "Black Swan",
    ticker: "SWAN",
    rarity: "mythic",
    effect: { kind: "rug", target: "allProjects" },
    flavour: "Nobody saw it coming, and afterwards everybody had.",
  },
];

// ---------------------------------------------------------------------------

export const CARDS: readonly Card[] = [
  ...CLOVE,
  ...CROOKS,
  ...WOLFSWAP,
  ...ROBOTS,
  ...HOWLERS,
  ...FFS,
  ...MONSTERS,
  ...NOVA,
  ...CR00TS,
  ...LIONEL,
  ...CAW,
  ...DAK,
  ...FOUNDERS,
  ...VOICES,
  ...ARCHETYPES,
  ...TOOLS,
  ...TACTICS,
  ...EVENTS,
];

/** The spread the set is supposed to keep to. The test guards this. */
export const EXPECTED_DISTRIBUTION = {
  common: 46,
  rare: 51,
  epic: 45,
  legendary: 27,
  mythic: 14,
} as const;
