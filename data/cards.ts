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
    moment: "I",
    ticker: "CLOVE",
    rarity: "common",
    sector: "meme",
    launchMC: 14_000,
    pumpMC: 8_000,
    holders: 3,
    // a ticker, a chart and a group chat — the chat is the whole of it
    effect: { kind: "drawCards", amount: 1 },
    flavour: "A ticker, a chart and a group chat. That was the whole of it.",
  },
  {
    id: "clove-nobody",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "II",
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
    moment: "III",
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
    moment: "IV",
    ticker: "CLOVE",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 16_000,
    holders: 3,
    // one exchange nobody had heard of, and everybody screenshotted it — later
    payoff: { when: { kind: "turnAtLeast", turn: 5 }, effect: { kind: "directMC", target: "self", mc: 70_000 } },
    // everybody screenshotted it, so everybody found it
    effect: { kind: "drawCards", amount: 2 },
    flavour: "One exchange nobody had heard of, and everybody screenshotted it.",
  },
  {
    id: "clove-season",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "V",
    ticker: "CLOVE",
    rarity: "epic",
    sector: "meme",
    launchMC: 38_000,
    pumpMC: 23_000,
    holders: 4,
    // for about nine days it was the only chart anybody had open
    effect: { kind: "drawCards", amount: 2 },
    flavour: "For about nine days it was the only chart anybody had open.",
  },
  {
    id: "clove-carried",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "VI",
    ticker: "CLOVE",
    rarity: "epic",
    sector: "meme",
    launchMC: 41_000,
    pumpMC: 25_000,
    holders: 4,
    // everyone who was early stayed early, and that was the trick
    loyalty: 34,
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "Everyone who was early stayed early. That was the trick.",
  },
  {
    id: "clove-product",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "VII",
    ticker: "CLOVE",
    rarity: "legendary",
    sector: "meme",
    launchMC: 66_000,
    pumpMC: 40_000,
    holders: 5,
    // there was never a roadmap; there was a group chat that never slept
    effect: { kind: "recoverCard", amount: 1 },
    flavour: "There was never a roadmap. There was a group chat that never slept.",
  },
  {
    id: "clove-still",
    type: "project",
    project: "clove",
    name: "Clove",
    moment: "VIII",
    ticker: "CLOVE",
    rarity: "mythic",
    sector: "meme",
    launchMC: 108_000,
    pumpMC: 55_000,
    holders: 6,
    // two cycles later the chat is still open, and it still keeps people in
    standing: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    // two cycles later the chat is still open and still arguing
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    flavour: "Two cycles later the chat is still open and still arguing.",
  },
];

// ---------------------------------------------------------------------------
// CROOKS FINANCE — defi
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
    moment: "I",
    ticker: "CF",
    rarity: "common",
    sector: "defi",
    launchMC: 15_000,
    pumpMC: 8_000,
    holders: 4,
    // no influencer would touch it, so whoever found it found it themselves
    effect: { kind: "drawCards", amount: 1 },
    flavour: "No influencer would touch it, which turned out to be the point.",
  },
  {
    id: "crooks-holds",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "II",
    ticker: "CF",
    rarity: "common",
    sector: "defi",
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
    moment: "III",
    ticker: "CF",
    rarity: "rare",
    sector: "defi",
    launchMC: 25_000,
    pumpMC: 14_000,
    holders: 4,
    // a vault, then a router, then a thing nobody could explain quickly
    effect: { kind: "drawCards", amount: 2 },
    flavour: "A vault, then a router, then a thing nobody could explain quickly.",
  },
  {
    id: "crooks-hit",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "IV",
    ticker: "CF",
    rarity: "rare",
    sector: "defi",
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
    moment: "V",
    ticker: "CF",
    rarity: "epic",
    sector: "defi",
    launchMC: 39_000,
    pumpMC: 23_000,
    holders: 5,
    // whatever came for you, it came for the whole book at once
    payoff: { when: { kind: "holdersLostAtLeast", holders: 3 }, effect: { kind: "directMC", target: "self", mc: 120_000 } },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Whatever came for you, it came for the whole book at once.",
  },
  {
    id: "crooks-audit",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "VI",
    ticker: "CF",
    rarity: "epic",
    sector: "defi",
    launchMC: 42_000,
    pumpMC: 26_000,
    holders: 5,
    // two weeks of silence, then a PDF, then the deposits doubled
    onTheirPlay: { cardType: "project", mc: 34_000 },
    // two weeks of silence, then a PDF, then the deposits doubled
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Two weeks of silence, then a PDF, then the deposits doubled.",
  },
  {
    id: "crooks-book",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "VII",
    ticker: "CF",
    rarity: "legendary",
    sector: "defi",
    launchMC: 70_000,
    pumpMC: 42_000,
    holders: 6,
    // everything routed through it eventually, whether it meant to or not
    standing: { kind: "directMC", target: "self", mc: 105_000 },
    // everything routed through it eventually, whether it meant to or not
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    flavour: "Everything routed through it eventually, whether it meant to or not.",
  },
  {
    id: "crooks-standing",
    type: "project",
    project: "crooks",
    name: "Crooks Finance",
    moment: "VIII",
    ticker: "CF",
    rarity: "mythic",
    sector: "defi",
    launchMC: 112_000,
    pumpMC: 54_000,
    holders: 7,
    // A lock that any single point of damage lifts. At seven holders it is a
    // real wall, and the answer to it is the cheapest attack in the game — which
    // is the shape a lock has to have to be fair.
    restriction: { kind: "banType", cardType: "tactic" },
    // outlived three exchanges, two bear markets and everyone who called it
    effect: { kind: "recoverCard", amount: 2 },
    flavour: "Outlived three exchanges, two bear markets and everyone who called it.",
  },
];

// ---------------------------------------------------------------------------
// WOLFSWAP — dex
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
    moment: "I",
    ticker: "WOLF",
    rarity: "common",
    sector: "dex",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 2,
    // eleven percent of slippage, and somebody was on the other side of it
    effect: { kind: "stealMC", percentage: 5 },
    flavour: "Slippage of eleven percent and everybody used it anyway.",
  },
  {
    id: "wolfswap-teeth",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "II",
    ticker: "WOLF",
    rarity: "common",
    sector: "dex",
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
    moment: "III",
    ticker: "WOLF",
    rarity: "rare",
    sector: "dex",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    // anything thinner than its own book got quoted out of existence
    standing: { kind: "damageHolders", target: "enemyBest", amount: 1 },
    effect: { kind: "stealMC", percentage: 8 },
    flavour: "Anything thinner than its own book got quoted out of existence.",
  },
  {
    id: "wolfswap-fees",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "IV",
    ticker: "WOLF",
    rarity: "rare",
    sector: "dex",
    launchMC: 27_000,
    pumpMC: 16_000,
    holders: 3,
    // volume was the product and the token was the receipt — a cut of what they spend
    tip: 20,
    // volume was the product and the token was the receipt — you see what is coming
    effect: { kind: "peekAndBurn", look: 3 },
    flavour: "Volume was the product. The token was the receipt.",
  },
  {
    id: "wolfswap-pack",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "V",
    ticker: "WOLF",
    rarity: "epic",
    sector: "dex",
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
    moment: "VI",
    ticker: "WOLF",
    rarity: "epic",
    sector: "dex",
    launchMC: 41_000,
    pumpMC: 25_000,
    holders: 4,
    // the other pool did not close; it just stopped being quoted
    restriction: { kind: "taxPlays", percent: 13 },
    effect: { kind: "stealMC", percentage: 12 },
    flavour: "The other pool did not close. It just stopped being quoted.",
  },
  {
    id: "wolfswap-lowest",
    type: "project",
    project: "wolfswap",
    name: "Wolfswap",
    moment: "VII",
    ticker: "WOLF",
    rarity: "legendary",
    sector: "dex",
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
    moment: "VIII",
    ticker: "WOLF",
    rarity: "mythic",
    sector: "dex",
    launchMC: 115_000,
    pumpMC: 52_000,
    holders: 5,
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 3 },
    flavour: "The screenshot everybody still posts is from that afternoon.",
  },
];

// ---------------------------------------------------------------------------
// RECKLESS ROBOTS — nft
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
    moment: "I",
    ticker: "RR",
    rarity: "common",
    sector: "nft",
    launchMC: 13_000,
    pumpMC: 8_000,
    holders: 2,
    // shipped with a bug and shipped anyway, which is how momentum starts
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 7_000 },
    flavour: "Shipped with a bug in the mint and shipped anyway.",
  },
  {
    id: "robots-coinflip",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "II",
    ticker: "RR",
    rarity: "common",
    sector: "nft",
    launchMC: 18_000,
    pumpMC: 10_000,
    holders: 2,
    // The original was a literal coin flip for plus or minus five. A seeded
    // engine can do that, but a card whose text says "50% chance" and whose
    // outcome is fixed by the seed is a card that lies twice a match. It costs
    // itself something and gains more instead — the same trade, said honestly.
    // heads it works, tails it also sort of works
    effect: { kind: "pumpProject", target: "ownProject", mc: 44_000 },
    flavour: "Heads it works. Tails it also sort of works.",
  },
  {
    id: "robots-fleet",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "III",
    ticker: "RR",
    rarity: "rare",
    sector: "nft",
    launchMC: 24_000,
    pumpMC: 15_000,
    holders: 3,
    // one is a toy, four hundred is an argument
    payoff: { when: { kind: "ownProjectCount", atLeast: 4 }, effect: { kind: "directMC", target: "self", mc: 60_000 } },
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { nft: 60_000 } },
    flavour: "One is a toy. Four hundred is an argument.",
  },
  {
    id: "robots-scrap",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "IV",
    ticker: "RR",
    rarity: "rare",
    sector: "nft",
    launchMC: 28_000,
    pumpMC: 14_000,
    holders: 3,
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 22_000 },
    flavour: "They took one apart on stream and the floor went up.",
  },
  {
    id: "robots-overclock",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "V",
    ticker: "RR",
    rarity: "epic",
    sector: "nft",
    launchMC: 36_000,
    pumpMC: 28_000,
    holders: 2,
    // twice as hot for half as long, and everybody knew
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 30_000 },
    flavour: "Ran twice as hot for half as long. Everybody knew and nobody left.",
  },
  {
    id: "robots-recall",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "VI",
    ticker: "RR",
    rarity: "epic",
    sector: "nft",
    launchMC: 44_000,
    pumpMC: 22_000,
    holders: 4,
    // every unit, both sides of the table, back to the workshop
    effect: { kind: "benchmark", target: "ownProject", plus: 15_000 },
    flavour: "Every unit, both sides of the table, back to the workshop.",
  },
  {
    id: "robots-selfrepair",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "VII",
    ticker: "RR",
    rarity: "legendary",
    sector: "nft",
    launchMC: 64_000,
    pumpMC: 43_000,
    holders: 5,
    // came back online with a different serial number and the same wallet
    shield: 38,
    // came back online with a different serial number and the same wallet
    effect: { kind: "attach", target: "ownProject", every: { kind: "scalePump", target: "ownProject", percentage: 25 } },
    flavour: "Came back online with a different serial number and the same wallet.",
  },
  {
    id: "robots-detonate",
    type: "project",
    project: "robots",
    name: "Reckless Robots",
    moment: "VIII",
    ticker: "RR",
    rarity: "mythic",
    sector: "nft",
    launchMC: 120_000,
    pumpMC: 50_000,
    holders: 4,
    // ten percent chance, they said — and everything ends up in one place
    effect: { kind: "merge" },
    flavour: "Ten percent chance, they said. It was a Tuesday.",
  },
];

// ---------------------------------------------------------------------------
// HOWLERS — nft
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
    moment: "I",
    ticker: "HOWL",
    rarity: "common",
    sector: "nft",
    launchMC: 14_000,
    pumpMC: 8_000,
    holders: 3,
    // two in the morning is when the pack is awake, and the pack turns up
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Minted at two in the morning because that is when the pack is awake.",
  },
  {
    id: "howlers-behind",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "II",
    ticker: "HOWL",
    rarity: "common",
    sector: "nft",
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
    moment: "III",
    ticker: "HOWL",
    rarity: "rare",
    sector: "nft",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    // once a month the floor moved and nobody had a reason for it
    payoff: { when: { kind: "turnAtLeast", turn: 6 }, effect: { kind: "directMC", target: "self", mc: 55_000 } },
    // once a month the floor moved and nobody had a reason for it
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Once a month the floor moved and nobody had a reason for it.",
  },
  {
    id: "howlers-mirror",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "IV",
    ticker: "HOWL",
    rarity: "rare",
    sector: "nft",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 3,
    // whatever the other side did, it turned up in the pack a week later
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Whatever the other side did, it turned up in the pack a week later.",
  },
  {
    id: "howlers-lowest",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "V",
    ticker: "HOWL",
    rarity: "epic",
    sector: "nft",
    launchMC: 37_000,
    pumpMC: 24_000,
    holders: 4,
    // the pack moves at the speed of its slowest, which is the whole idea
    standing: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "The pack moves at the speed of its slowest, which is the whole idea.",
  },
  {
    id: "howlers-night",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "VI",
    ticker: "HOWL",
    rarity: "epic",
    sector: "nft",
    launchMC: 43_000,
    pumpMC: 25_000,
    holders: 4,
    // eight months of nothing and the group chat never went quiet once
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Eight months of nothing and the group chat never went quiet once.",
  },
  {
    id: "howlers-pack",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "VII",
    ticker: "HOWL",
    rarity: "legendary",
    sector: "nft",
    launchMC: 67_000,
    pumpMC: 41_000,
    holders: 5,
    // they stopped counting holders and started counting who showed up
    morePositions: 3,
    // they stopped counting holders and started counting who showed up
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    flavour: "They stopped counting holders and started counting who showed up.",
  },
  {
    id: "howlers-inversion",
    type: "project",
    project: "howlers",
    name: "Howlers",
    moment: "VIII",
    ticker: "HOWL",
    rarity: "mythic",
    sector: "nft",
    launchMC: 106_000,
    pumpMC: 56_000,
    holders: 6,
    // The old mythic inverted every buff and debuff on the field. Inversion is
    // not a thing this engine can express, and the nearest honest version is a
    // scale on both sides: it widens whoever is ahead and narrows whoever is
    // not, so it is a decision rather than a wash.
    // the chart flipped, and for one evening every loser was a genius
    effect: { kind: "recoverCard", amount: 2 },
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
    moment: "I",
    ticker: "FFS",
    rarity: "common",
    sector: "meme",
    launchMC: 12_000,
    pumpMC: 9_000,
    holders: 2,
    // named at four in the morning by somebody who was still there
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Named in frustration at four in the morning and never renamed.",
  },
  {
    id: "ffs-tithe",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "II",
    ticker: "FFS",
    rarity: "common",
    sector: "meme",
    launchMC: 20_000,
    pumpMC: 7_000,
    holders: 2,
    // sold its own bag to fund a marketing wallet for everyone else
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Sold its own bag to fund a marketing wallet for everyone else.",
  },
  {
    id: "ffs-bleed",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "III",
    ticker: "FFS",
    rarity: "rare",
    sector: "meme",
    launchMC: 30_000,
    pumpMC: 12_000,
    holders: 2,
    // down eighty percent and still funding the others, on purpose
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Down eighty percent and still funding the others. On purpose.",
  },
  {
    id: "ffs-behind",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "IV",
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
    moment: "V",
    ticker: "FFS",
    rarity: "epic",
    sector: "meme",
    launchMC: 46_000,
    pumpMC: 21_000,
    holders: 5,
    // whatever came in, it stood in front of it, every single time
    payoff: { when: { kind: "holdersLostAtLeast", holders: 2 }, effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 } },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    flavour: "Whatever came in, it stood in front of it. Every single time.",
  },
  {
    id: "ffs-payoff",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "VI",
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
    moment: "VII",
    ticker: "FFS",
    rarity: "legendary",
    sector: "meme",
    launchMC: 58_000,
    pumpMC: 44_000,
    holders: 4,
    // the wallet hit zero and the token did its best week ever — it pays for yours
    freePlays: 2,
    // the wallet hit zero and the token did its best week ever
    effect: { kind: "drawCards", amount: 4 },
    flavour: "The wallet hit zero and the token did its best week ever.",
  },
  {
    id: "ffs-comeback",
    type: "project",
    project: "ffs",
    name: "FFS",
    moment: "VIII",
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
    moment: "I",
    ticker: "CRZY",
    rarity: "common",
    sector: "meme",
    launchMC: 15_000,
    pumpMC: 8_000,
    holders: 2,
    // three z's, and it never checked whose side anybody was on
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Three z's, because two did not look unhinged enough.",
  },
  {
    id: "monsters-bite",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "II",
    ticker: "CRZY",
    rarity: "common",
    sector: "meme",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 2,
    // the first holder to complain got a monster named after him
    effect: { kind: "directMC", target: "opponent", mc: -7_000 },
    flavour: "The first holder to complain got a monster named after him.",
  },
  {
    id: "monsters-loose",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "III",
    ticker: "CRZY",
    rarity: "rare",
    sector: "meme",
    launchMC: 24_000,
    pumpMC: 15_000,
    holders: 3,
    // it did not check whose side anybody was on, and it never has
    effect: { kind: "discardCards", target: "both", amount: 1 },
    flavour: "It did not check whose side anybody was on. It never has.",
  },
  {
    id: "monsters-feed",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "IV",
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
    moment: "V",
    ticker: "CRZY",
    rarity: "epic",
    sector: "meme",
    launchMC: 38_000,
    pumpMC: 24_000,
    holders: 4,
    // ten thousand of them and every single one is somebody's favourite
    payoff: { when: { kind: "theirHandAtMost", cards: 3 }, effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 } },
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "Ten thousand of them and every single one is somebody's favourite.",
  },
  {
    id: "monsters-mutate",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "VI",
    ticker: "CRZY",
    rarity: "epic",
    sector: "meme",
    launchMC: 40_000,
    pumpMC: 26_000,
    holders: 3,
    // traits nobody drew started showing up in the metadata
    standing: { kind: "damageHolders", target: "enemyBest", amount: 1 },
    // traits nobody drew started showing up in the metadata
    // traits nobody drew started showing up in the metadata
    effect: { kind: "scalePump", target: "allEnemyProjects", percentage: -30 },
    flavour: "Traits nobody drew started showing up in the metadata.",
  },
  {
    id: "monsters-carnage",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "VII",
    ticker: "CRZY",
    rarity: "legendary",
    sector: "meme",
    launchMC: 69_000,
    pumpMC: 41_000,
    holders: 4,
    // both floors halved in a night and the Discord had never been busier
    oracle: 7,
    effect: { kind: "damageHolders", target: "allProjects", amount: 2 },
    flavour: "Both floors halved in a night and the Discord had never been busier.",
  },
  {
    id: "monsters-apex",
    type: "project",
    project: "monsters",
    name: "Crazzzy Monsters",
    moment: "VIII",
    ticker: "CRZY",
    rarity: "mythic",
    sector: "meme",
    launchMC: 118_000,
    pumpMC: 58_000,
    holders: 5,
    // it ate the thing that was eating everything else
    effect: { kind: "takeOver" },
    flavour: "It ate the thing that was eating everything else.",
  },
];

// ---------------------------------------------------------------------------
// NOVA — infra
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
    moment: "I",
    ticker: "NOVA",
    rarity: "common",
    sector: "infra",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 3,
    // launched quietly on a Sunday, and everything it touched moved after
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 7_000 },
    flavour: "Launched quietly on a Sunday, which is not how anybody does it.",
  },
  {
    id: "nova-second",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "II",
    ticker: "NOVA",
    rarity: "common",
    sector: "infra",
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
    moment: "III",
    ticker: "NOVA",
    rarity: "rare",
    sector: "infra",
    launchMC: 26_000,
    pumpMC: 14_000,
    holders: 3,
    // whatever you were building, there was a Nova thing that plugged in
    payoff: { when: { kind: "ownProjectsInSector", sector: "infra", atLeast: 2 }, effect: { kind: "pumpProject", target: "allOwnProjects", mc: 8_000 } },
    // whatever you were building, there was a Nova thing that plugged in
    effect: { kind: "benchmark", target: "ownProject" },
    flavour: "Whatever you were building, there was a Nova thing that plugged in.",
  },
  {
    id: "nova-shelf",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "IV",
    ticker: "NOVA",
    rarity: "rare",
    sector: "infra",
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
    moment: "V",
    ticker: "NOVA",
    rarity: "epic",
    sector: "infra",
    launchMC: 39_000,
    pumpMC: 24_000,
    holders: 4,
    // six products, one login, and a roadmap that actually shipped
    morePositions: 2,
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { infra: 60_000, meme: 27_000 } },
    flavour: "Six products, one login, and a roadmap that actually shipped.",
  },
  {
    id: "nova-sector",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "VI",
    ticker: "NOVA",
    rarity: "epic",
    sector: "infra",
    launchMC: 42_000,
    pumpMC: 25_000,
    holders: 4,
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "infra", atLeast: 3 },
      effect: { kind: "directMC", target: "self", mc: 160_000 },
    },
    flavour: "By the end you could not build on Cronos without touching it.",
  },
  {
    id: "nova-standard",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "VII",
    ticker: "NOVA",
    rarity: "legendary",
    sector: "infra",
    launchMC: 68_000,
    pumpMC: 42_000,
    holders: 5,
    // nobody voted for it; everybody integrated it
    standing: { kind: "directMC", target: "self", mc: 105_000 },
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { infra: 85_000 } },
    flavour: "Nobody voted for it. Everybody integrated it.",
  },
  {
    id: "nova-everything",
    type: "project",
    project: "nova",
    name: "Nova",
    moment: "VIII",
    ticker: "NOVA",
    rarity: "mythic",
    sector: "infra",
    launchMC: 110_000,
    pumpMC: 57_000,
    holders: 6,
    // the wallet screenshot that started three hundred copycat threads
    effect: { kind: "fork" },
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 5 },
      effect: { kind: "directMC", target: "self", mc: 300_000 },
    },
    flavour: "The wallet screenshot that started three hundred copycat threads.",
  },
];

// ---------------------------------------------------------------------------
// CR00TS — infra
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
    moment: "I",
    ticker: "CR00",
    rarity: "common",
    sector: "infra",
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
    moment: "II",
    ticker: "CR00",
    rarity: "common",
    sector: "infra",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 4,
    // two percent nobody notices, still quoting a spread this morning
    // written off four times, still quoting a spread this morning
    effect: { kind: "directMC", target: "opponent", mc: -7_000 },
    flavour: "Written off four times. Still quoting a spread this morning.",
  },
  {
    id: "cr00ts-toll",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "III",
    ticker: "CR00",
    rarity: "rare",
    sector: "infra",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    // two percent nobody notices is a business nobody complains about
    toll: { percentage: 5 },
    effect: { kind: "stealMC", percentage: 6 },
    flavour: "You did not have to use it. You just could not get past it.",
  },
  {
    id: "cr00ts-small",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "IV",
    ticker: "CR00",
    rarity: "rare",
    sector: "infra",
    launchMC: 27_000,
    pumpMC: 14_000,
    holders: 3,
    // never the whale, always the forty wallets nobody was watching
    payoff: { when: { kind: "aheadBy", mc: 200_000 }, effect: { kind: "stealMC", percentage: 8 } },
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Never the whale. Always the forty wallets nobody was watching.",
  },
  {
    id: "cr00ts-spread",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "V",
    ticker: "CR00",
    rarity: "epic",
    sector: "infra",
    launchMC: 38_000,
    pumpMC: 23_000,
    holders: 4,
    // same screen, same button, four percent worse, for eleven months
    restriction: { kind: "taxPlays", percent: 12 },
    effect: { kind: "stealMC", percentage: 16 },
    flavour: "Same screen, same button, four percent worse. For eleven months.",
  },
  {
    id: "cr00ts-reflect",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "VI",
    ticker: "CR00",
    rarity: "epic",
    sector: "infra",
    launchMC: 41_000,
    pumpMC: 25_000,
    holders: 5,
    // whatever you sent at it turned up in your own book by Friday
    effect: { kind: "burnForDamage", target: "ownProject", keep: 130 },
    flavour: "Whatever you sent at it turned up in your own book by Friday.",
  },
  {
    id: "cr00ts-vault",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "VII",
    ticker: "CR00",
    rarity: "legendary",
    sector: "infra",
    launchMC: 66_000,
    pumpMC: 42_000,
    holders: 5,
    // somebody had been writing all of it down since the start
    effect: { kind: "peekAndBurn", look: 4 },
    flavour: "Turned out somebody had been writing all of it down since the start.",
  },
  {
    id: "cr00ts-clearing",
    type: "project",
    project: "cr00ts",
    name: "Cr00ts",
    moment: "VIII",
    ticker: "CR00",
    rarity: "mythic",
    sector: "infra",
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
// OBSIDIAN FINANCE — defi
//
// The one that was still there at the end. Everything the old set did was about
// surviving to Final Calculation, and this engine has a turn number, so that
// idea keeps its shape exactly: the cards are worth more late.
//
// This was Lionel, and the family was written with lions in it — a pride, a
// runt, a troop. Obsidian Finance is a different thing entirely, so the moments
// are rewritten rather than renamed. What survives is the character, which came
// out of the old engine's cards rather than out of the name: this is the family
// that does not break.
//
// DeFi and not meme, because a finance protocol belongs beside Crooks and
// Tectonic rather than beside DAK.
// ---------------------------------------------------------------------------

const OBSIDIAN: ProjectCard[] = [
  {
    id: "obsidian-quiet",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "I",
    ticker: "OBS",
    rarity: "common",
    sector: "defi",
    launchMC: 13_000,
    pumpMC: 9_000,
    holders: 4,
    // no thread, no space, no partnership — just a contract that kept paying
    effect: { kind: "directMC", target: "self", mc: 21_000 },
    flavour: "No thread, no space, no partnership. Just a contract that kept working.",
  },
  {
    id: "obsidian-guard",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "II",
    ticker: "OBS",
    rarity: "common",
    sector: "defi",
    launchMC: 16_000,
    pumpMC: 8_000,
    holders: 4,
    // whatever came for the small deposits had to come through it first
    effect: { kind: "mcPerHolderLost", mc: 3_000 },
    flavour: "Whatever came for the small deposits had to come through it first.",
  },
  {
    id: "obsidian-ninth",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "III",
    ticker: "OBS",
    rarity: "rare",
    sector: "defi",
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
    id: "obsidian-nobody",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "IV",
    ticker: "OBS",
    rarity: "rare",
    sector: "defi",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 5,
    // nine figures locked and the outflow chart is a flat line, proudly
    payoff: { when: { kind: "bankedAtMost", count: 1 }, effect: { kind: "directMC", target: "self", mc: 90_000 } },
    // nine figures locked and the outflow chart is a flat line, proudly
    effect: { kind: "unbankedMC", percentage: 20 },
    flavour: "Nine figures locked and the outflow chart is a flat line. Proudly.",
  },
  {
    id: "obsidian-standing",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "V",
    ticker: "OBS",
    rarity: "epic",
    sector: "defi",
    launchMC: 37_000,
    pumpMC: 24_000,
    holders: 5,
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 4 },
      effect: { kind: "directMC", target: "self", mc: 170_000 },
    },
    flavour: "Half the protocols on this chain were gone by then. This half was not.",
  },
  {
    id: "obsidian-glass",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "VI",
    ticker: "OBS",
    rarity: "epic",
    sector: "defi",
    launchMC: 40_000,
    pumpMC: 25_000,
    holders: 5,
    // volcanic, and it takes an edge nothing else on the chain can hold
    standing: { kind: "directMC", target: "self", mc: 74_000 },
    // volcanic, and it takes an edge nothing else on the chain can hold
    effect: { kind: "peakMC", percentage: 12 },
    flavour: "Volcanic, and it takes an edge nothing else on the chain can hold.",
  },
  {
    id: "obsidian-final",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "VII",
    ticker: "OBS",
    rarity: "legendary",
    sector: "defi",
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
    id: "obsidian-unbroken",
    type: "project",
    project: "obsidian",
    name: "Obsidian Finance",
    moment: "VIII",
    ticker: "OBS",
    rarity: "mythic",
    sector: "defi",
    launchMC: 104_000,
    pumpMC: 56_000,
    holders: 8,
    // three years, four bear markets, and the floor never once broke
    shield: 50,
    // three years, four bear markets, and the floor never once broke
    effect: { kind: "scaleMC", target: "self", percentage: 24 },
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
    moment: "I",
    ticker: "CAW",
    rarity: "common",
    sector: "meme",
    launchMC: 17_000,
    pumpMC: 7_000,
    holders: 2,
    // somebody checked the address and there they were — the count starts
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 7_000 },
    flavour: "Somebody checked the contract address and there they were.",
  },
  {
    id: "caw-lucky",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "II",
    ticker: "CAW",
    rarity: "common",
    sector: "meme",
    launchMC: 17_000,
    pumpMC: 7_000,
    holders: 3,
    // block seven-seven-seven-seven, and the screenshot did numbers
    effect: { kind: "pumpProject", target: "ownProject", mc: 44_000 },
    flavour: "Block seven-seven-seven-seven. The screenshot did numbers.",
  },
  {
    id: "caw-seventh",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "III",
    ticker: "CAW",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 17_000,
    holders: 3,
    // a week to the hour, and it did the whole thing again
    payoff: { when: { kind: "turnAtLeast", turn: 7 }, effect: { kind: "pumpProject", target: "allOwnProjects", mc: 9_000 } },
    // a week to the hour, and it did the whole thing again
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 22_000 },
    flavour: "A week to the hour, and it did the whole thing again.",
  },
  {
    id: "caw-counting",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "IV",
    ticker: "CAW",
    rarity: "rare",
    sector: "meme",
    launchMC: 27_000,
    pumpMC: 17_000,
    holders: 3,
    // the chat found sevens in the supply, the fee and the founder's age
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 55_000 } },
    flavour: "The chat found sevens in the supply, the fee and the founder's age.",
  },
  {
    id: "caw-streak",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "V",
    ticker: "CAW",
    rarity: "epic",
    sector: "meme",
    launchMC: 37_000,
    pumpMC: 27_000,
    holders: 4,
    // seven in a row — every one of them counted
    onYourPlay: { mc: 30_000 },
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 47_000 } },
    flavour: "Seven in a row. On the eighth everybody was watching, so it stopped.",
  },
  {
    id: "caw-jackpot",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "VI",
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
    moment: "VII",
    ticker: "CAW",
    rarity: "legendary",
    sector: "meme",
    launchMC: 77_000,
    pumpMC: 47_000,
    holders: 7,
    // it stopped there, and nobody could get the count to move past it
    standing: { kind: "directMC", target: "self", mc: 105_000 },
    // seven in a row, and nobody could get the count to move past it
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 95_000 } },
    flavour: "It stopped there. Nobody could get the count to move past it.",
  },
  {
    id: "caw-sevens",
    type: "project",
    project: "caw",
    name: "CAW777",
    moment: "VIII",
    ticker: "CAW",
    rarity: "mythic",
    sector: "meme",
    launchMC: 107_000,
    pumpMC: 57_000,
    holders: 7,
    // seven sevens on one screen; two people printed it and framed it
    effect: { kind: "scalePump", target: "allOwnProjects", percentage: 45 },
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
    moment: "I",
    ticker: "DAK",
    rarity: "common",
    sector: "meme",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 2,
    // the first one still sets the floor, and a floor is set by taking
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Ten thousand of them, and the first one still sets the floor.",
  },
  {
    id: "dak-swing",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "II",
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
    moment: "III",
    ticker: "DAK",
    rarity: "rare",
    sector: "meme",
    launchMC: 28_000,
    pumpMC: 15_000,
    holders: 2,
    // dumped the small one to buy more of the big one, and it worked twice
    payoff: { when: { kind: "bankedAtLeast", count: 2 }, effect: { kind: "stealMC", percentage: 10 } },
    // dumped the small one to buy more of the big one, and it worked twice
    effect: { kind: "burnForDamage", target: "ownProject", keep: 45 },
    flavour: "Dumped the small one to buy more of the big one. It worked twice.",
  },
  {
    id: "dak-payoff",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "IV",
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
    moment: "V",
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
    moment: "VI",
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
    moment: "VII",
    ticker: "DAK",
    rarity: "legendary",
    sector: "meme",
    launchMC: 70_000,
    pumpMC: 40_000,
    holders: 4,
    // they came down the timeline together and something stopped existing
    severance: { percentage: 55, from: "theirs" },
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    flavour: "They came down the timeline together and something stopped existing.",
  },
  {
    id: "dak-again",
    type: "project",
    project: "dak",
    name: "DAK",
    moment: "VIII",
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
// VVS FINANCE — dex
//
// The one everybody arrived through. A DEX whose whole shape is volume and
// emissions, so this family is about the budget: it hands you money to spend and
// cards to spend it on, and it is worth most in a turn where your hand can
// absorb both.
// ---------------------------------------------------------------------------

const VVS: ProjectCard[] = [
  {
    id: "vvs-i",
    type: "project",
    project: "vvs",
    moment: "I",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "common",
    sector: "dex",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 3,
    // very, very simple, and volume begets volume from there
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 7_000 },
    flavour: "Very, very simple. That was the entire pitch and it worked.",
  },
  {
    id: "vvs-ii",
    type: "project",
    project: "vvs",
    moment: "II",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "common",
    sector: "dex",
    launchMC: 14_000,
    pumpMC: 8_000,
    holders: 3,
    // emissions on everything; for a while the yield was the product
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 7_000 },
    flavour: "Emissions on everything. For a while the yield was the product.",
  },
  {
    id: "vvs-iii",
    type: "project",
    project: "vvs",
    moment: "III",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "rare",
    sector: "dex",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    // every pair anybody wanted, and a few nobody did
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { dex: 55_000 } },
    flavour: "Every pair anybody wanted, and a few nobody did.",
  },
  {
    id: "vvs-iv",
    type: "project",
    project: "vvs",
    moment: "IV",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "rare",
    sector: "dex",
    launchMC: 27_000,
    pumpMC: 16_000,
    holders: 4,
    // the fees were the moat and nobody undercut it for two years
    payoff: { when: { kind: "turnAtMost", turn: 4 }, effect: { kind: "extraBudget", target: "self", mc: 60_000 } },
    // the fees were the moat; nobody undercut it for two years
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 22_000 },
    flavour: "The fees were the moat. Nobody undercut it for two years.",
  },
  {
    id: "vvs-v",
    type: "project",
    project: "vvs",
    moment: "V",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "epic",
    sector: "dex",
    launchMC: 39_000,
    pumpMC: 24_000,
    holders: 4,
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { dex: 60_000, defi: 34_000 } },
    flavour: "If it did not route through here it probably did not route.",
  },
  {
    id: "vvs-vi",
    type: "project",
    project: "vvs",
    moment: "VI",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "epic",
    sector: "dex",
    launchMC: 42_000,
    pumpMC: 25_000,
    holders: 4,
    // volume begets volume — that is the whole business and it is enough
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 55_000 },
    flavour: "Volume begets volume. That is the whole business and it is enough.",
  },
  {
    id: "vvs-vii",
    type: "project",
    project: "vvs",
    moment: "VII",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "legendary",
    sector: "dex",
    launchMC: 68_000,
    pumpMC: 42_000,
    holders: 5,
    // the front door of the chain, whether or not it meant to be
    discount: 32,
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { dex: 100_000, defi: 55_000 } },
    flavour: "The front door of the chain, whether or not it meant to be.",
  },
  {
    id: "vvs-viii",
    type: "project",
    project: "vvs",
    moment: "VIII",
    name: "VVS Finance",
    ticker: "VVS",
    rarity: "mythic",
    sector: "dex",
    launchMC: 110_000,
    pumpMC: 55_000,
    holders: 6,
    // deep enough that size stopped mattering
    effect: { kind: "scalePump", target: "allOwnProjects", percentage: 50 },
    flavour: "Deep enough that size stopped mattering. That is rare anywhere.",
  },
];

// ---------------------------------------------------------------------------
// MAD MEERKAT FINANCE — dex
//
// The loud one. Where VVS hands you money, MMF takes theirs: this family is the
// aggressive half of the DEX pair, and it reads as a meerkat mob rather than a
// venue.
// ---------------------------------------------------------------------------

const MMF: ProjectCard[] = [
  {
    id: "mmf-i",
    type: "project",
    project: "mmf",
    moment: "I",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "common",
    sector: "dex",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 2,
    // one meerkat on a rock, and it took a cut of everything from the start
    effect: { kind: "directMC", target: "self", mc: 21_000 },
    flavour: "One meerkat standing on a rock, shouting. It caught on.",
  },
  {
    id: "mmf-ii",
    type: "project",
    project: "mmf",
    moment: "II",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "common",
    sector: "dex",
    launchMC: 14_000,
    pumpMC: 10_000,
    holders: 2,
    // it took a cut of everything and told you it was taking it
    effect: { kind: "extraBudget", target: "self", mc: 42_000 },
    flavour: "It took a cut of everything and told you it was taking it.",
  },
  {
    id: "mmf-iii",
    type: "project",
    project: "mmf",
    moment: "III",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "rare",
    sector: "dex",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 3,
    // the mob arrived at whatever was moving and left with the spread
    effect: { kind: "directMC", target: "self", mc: 80_000 },
    flavour: "The mob arrived at whatever was moving and left with the spread.",
  },
  {
    id: "mmf-iv",
    type: "project",
    project: "mmf",
    moment: "IV",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "rare",
    sector: "dex",
    launchMC: 24_000,
    pumpMC: 16_000,
    holders: 3,
    // a DEX, a launchpad, an NFT line and a burn — all at once, loudly
    effect: { kind: "extraBudget", target: "self", mc: 85_000 },
    flavour: "A DEX, a launchpad, an NFT line and a burn. All at once, loudly.",
  },
  {
    id: "mmf-v",
    type: "project",
    project: "mmf",
    moment: "V",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "epic",
    sector: "dex",
    launchMC: 40_000,
    pumpMC: 24_000,
    holders: 3,
    // somebody worked out the buyback was bigger than the emissions
    payoff: { when: { kind: "discardAtLeast", count: 4 }, effect: { kind: "directMC", target: "self", mc: 80_000 } },
    // somebody worked out the buyback was bigger than the emissions
    effect: { kind: "budgetToMC", percentage: 40 },
    flavour: "Somebody worked out the buyback was bigger than the emissions.",
  },
  {
    id: "mmf-vi",
    type: "project",
    project: "mmf",
    moment: "VI",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "epic",
    sector: "dex",
    launchMC: 37_000,
    pumpMC: 26_000,
    holders: 4,
    // half a serious venue and half a meme, and it never picked one
    effect: { kind: "scaleMC", target: "self", percentage: 20 },
    flavour: "Half a serious venue and half a meme, and it never picked one.",
  },
  {
    id: "mmf-vii",
    type: "project",
    project: "mmf",
    moment: "VII",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "legendary",
    sector: "dex",
    launchMC: 66_000,
    pumpMC: 41_000,
    holders: 4,
    // the buyback ran on a timer and the chart knew what time it was
    toll: { percentage: 12 },
    // the buyback ran on a timer and the chart knew what time it was
    effect: { kind: "directMC", target: "self", mc: 65_000, per: "turn" },
    flavour: "The buyback ran on a timer and the chart knew what time it was.",
  },
  {
    id: "mmf-viii",
    type: "project",
    project: "mmf",
    moment: "VIII",
    name: "Mad Meerkat Finance",
    ticker: "MMF",
    rarity: "mythic",
    sector: "dex",
    launchMC: 105_000,
    pumpMC: 57_000,
    holders: 5,
    // the whole mob at once, and nothing else on the chain that loud
    effect: { kind: "scaleMC", target: "self", percentage: 24 },
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "dex", atLeast: 2 },
      effect: { kind: "stealMC", percentage: 15 },
    },
    flavour: "The whole mob at once, and nothing else on the chain that loud.",
  },
];

// ---------------------------------------------------------------------------
// TECTONIC — defi
//
// Lending. You put collateral in and borrow against it, and the thing that can
// go wrong is the thing that decides the match: this family is about holders —
// how many a position has left and whether it gets them back.
// ---------------------------------------------------------------------------

const TECTONIC: ProjectCard[] = [
  {
    id: "tectonic-i",
    type: "project",
    project: "tectonic",
    moment: "I",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "common",
    sector: "defi",
    launchMC: 14_000,
    pumpMC: 9_000,
    holders: 4,
    flavour: "Supply something, borrow against it, try not to think about it.",
  },
  {
    id: "tectonic-ii",
    type: "project",
    project: "tectonic",
    moment: "II",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "common",
    sector: "defi",
    launchMC: 16_000,
    pumpMC: 8_000,
    holders: 4,
    // the health factor is a number you check more than you admit
    effect: { kind: "extraBudget", target: "self", mc: 42_000 },
    flavour: "The health factor is a number you check more than you admit.",
  },
  {
    id: "tectonic-iii",
    type: "project",
    project: "tectonic",
    moment: "III",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "rare",
    sector: "defi",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 4,
    // somebody's collateral goes first when the whole market moves
    effect: { kind: "scaleMC", target: "self", percentage: 11 },
    flavour: "Somebody's collateral goes first when the whole market moves.",
  },
  {
    id: "tectonic-iv",
    type: "project",
    project: "tectonic",
    moment: "IV",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "rare",
    sector: "defi",
    launchMC: 27_000,
    pumpMC: 14_000,
    holders: 5,
    // top it up before it tops you up — that is the whole discipline
    effect: { kind: "directMC", target: "self", mc: 80_000 },
    flavour: "Top it up before it tops you up. That is the whole discipline.",
  },
  {
    id: "tectonic-v",
    type: "project",
    project: "tectonic",
    moment: "V",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "epic",
    sector: "defi",
    launchMC: 38_000,
    pumpMC: 23_000,
    holders: 5,
    // everything on the chain ended up posted here as collateral
    standing: { kind: "directMC", target: "self", mc: 74_000 },
    // everything on the chain ended up posted here as collateral
    effect: { kind: "directMC", target: "self", mc: 36_000, per: "holders" },
    flavour: "Everything on the chain ended up posted here as collateral.",
  },
  {
    id: "tectonic-vi",
    type: "project",
    project: "tectonic",
    moment: "VI",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "epic",
    sector: "defi",
    launchMC: 43_000,
    pumpMC: 25_000,
    holders: 4,
    // supply something, borrow against it, try not to think about it
    leverage: 24,
    // a cascade does not ask which position it liked best
    effect: { kind: "mcPerPositionGone", mc: 34_000 },
    flavour: "A cascade does not ask which position it liked best.",
  },
  {
    id: "tectonic-vii",
    type: "project",
    project: "tectonic",
    moment: "VII",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "legendary",
    sector: "defi",
    launchMC: 65_000,
    pumpMC: 43_000,
    holders: 6,
    // the biggest book on the chain, and the quietest one about it
    effect: { kind: "scaleMC", target: "self", percentage: 24 },
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "defi", atLeast: 2 },
      effect: { kind: "directMC", target: "self", mc: 180_000 },
    },
    flavour: "The biggest book on the chain, and the quietest one about it.",
  },
  {
    id: "tectonic-viii",
    type: "project",
    project: "tectonic",
    moment: "VIII",
    name: "Tectonic",
    ticker: "TONIC",
    rarity: "mythic",
    sector: "defi",
    launchMC: 112_000,
    pumpMC: 54_000,
    holders: 7,
    // solvent through every drawdown anybody on this chain remembers
    restriction: { kind: "banTakeProfit" },
    // solvent through every drawdown anybody on this chain remembers
    effect: { kind: "scaleMC", target: "self", percentage: 30 },
    flavour: "Solvent through every drawdown anybody on this chain remembers.",
  },
];

// ---------------------------------------------------------------------------
// FERRO — defi
//
// Stableswap. The whole point is that nothing moves much, which in this engine
// is a project that pumps steadily and is very hard to knock over. It is the
// least dramatic family in the set and that is what it is for.
// ---------------------------------------------------------------------------

const FERRO: ProjectCard[] = [
  {
    id: "ferro-i",
    type: "project",
    project: "ferro",
    moment: "I",
    name: "Ferro",
    ticker: "FER",
    rarity: "common",
    sector: "defi",
    launchMC: 13_000,
    pumpMC: 10_000,
    holders: 4,
    // swapped for almost nothing, and almost nothing is still something
    effect: { kind: "directMC", target: "self", mc: 21_000 },
    flavour: "Two things worth the same, swapped for almost nothing. Boring.",
  },
  {
    id: "ferro-ii",
    type: "project",
    project: "ferro",
    moment: "II",
    name: "Ferro",
    ticker: "FER",
    rarity: "common",
    sector: "defi",
    launchMC: 17_000,
    pumpMC: 9_000,
    holders: 4,
    // slippage measured in basis points, and it stayed there
    effect: { kind: "directMC", target: "self", mc: 21_000 },
    flavour: "Slippage measured in basis points, and it stayed there.",
  },
  {
    id: "ferro-iii",
    type: "project",
    project: "ferro",
    moment: "III",
    name: "Ferro",
    ticker: "FER",
    rarity: "rare",
    sector: "defi",
    launchMC: 24_000,
    pumpMC: 17_000,
    holders: 4,
    // the pool nobody watched, quietly funding the next thing
    effect: { kind: "extraBudget", target: "self", mc: 85_000 },
    flavour: "The pool nobody watched because it never did anything.",
  },
  {
    id: "ferro-iv",
    type: "project",
    project: "ferro",
    moment: "IV",
    name: "Ferro",
    ticker: "FER",
    rarity: "rare",
    sector: "defi",
    launchMC: 26_000,
    pumpMC: 16_000,
    holders: 5,
    // underneath the venues, quoting the boring half of every trade
    payoff: { when: { kind: "playedThisTurnAtLeast", cards: 2 }, effect: { kind: "extraBudget", target: "self", mc: 50_000 } },
    // underneath the venues, quoting the boring half of every trade
    effect: { kind: "directMC", target: "self", mc: 27_000, per: "any" },
    flavour: "Underneath the venues, quoting the boring half of every trade.",
  },
  {
    id: "ferro-v",
    type: "project",
    project: "ferro",
    moment: "V",
    name: "Ferro",
    ticker: "FER",
    rarity: "epic",
    sector: "defi",
    launchMC: 36_000,
    pumpMC: 27_000,
    holders: 5,
    // steady is a strategy — it pays, it just never trends
    effect: { kind: "extraBudget", target: "self", mc: 180_000 },
    flavour: "Steady is a strategy. It just never trends anywhere.",
  },
  {
    id: "ferro-vi",
    type: "project",
    project: "ferro",
    moment: "VI",
    name: "Ferro",
    ticker: "FER",
    rarity: "epic",
    sector: "defi",
    launchMC: 41_000,
    pumpMC: 24_000,
    holders: 6,
    // it held its peg through the week everything else did not
    standing: { kind: "directMC", target: "self", mc: 74_000 },
    // it held its peg through the week everything else did not
    effect: { kind: "refundMC", percentage: 30 },
    flavour: "It held its peg through the week everything else did not.",
  },
  {
    id: "ferro-vii",
    type: "project",
    project: "ferro",
    moment: "VII",
    name: "Ferro",
    ticker: "FER",
    rarity: "legendary",
    sector: "defi",
    launchMC: 62_000,
    pumpMC: 44_000,
    holders: 6,
    // every route that mattered had one of its pools in the middle
    uptime: true,
    // every route that mattered had one of its pools in the middle
    effect: { kind: "directMC", target: "self", mc: 60_000, per: "table" },
    flavour: "Every route that mattered had one of its pools in the middle.",
  },
  {
    id: "ferro-viii",
    type: "project",
    project: "ferro",
    moment: "VIII",
    name: "Ferro",
    ticker: "FER",
    rarity: "mythic",
    sector: "defi",
    launchMC: 102_000,
    pumpMC: 58_000,
    holders: 8,
    // nothing dramatic ever happened to it, which is the achievement
    effect: { kind: "extraBudget", target: "self", mc: 380_000 },
    flavour: "Nothing dramatic ever happened to it, which is the achievement.",
  },
];

// ---------------------------------------------------------------------------
// LOADED LIONS — nft
//
// The blue chip. Where the meme families spike and fall over, this one is worth
// more the more of its own kind you are holding: the family pays for a board
// built out of collections rather than for any one card on it.
// ---------------------------------------------------------------------------

const LIONS: ProjectCard[] = [
  {
    id: "lions-i",
    type: "project",
    project: "lions",
    moment: "I",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "common",
    sector: "nft",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 4,
    // a mane tells you which one you got, and which one you got is the money
    effect: { kind: "directMC", target: "self", mc: 21_000 },
    flavour: "Ten thousand lions and a mane that tells you which one you got.",
  },
  {
    id: "lions-ii",
    type: "project",
    project: "lions",
    moment: "II",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "common",
    sector: "nft",
    launchMC: 17_000,
    pumpMC: 8_000,
    holders: 4,
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "nft", atLeast: 2 },
      effect: { kind: "directMC", target: "self", mc: 40_000 },
    },
    flavour: "A pride is a group noun. The collection took that literally.",
  },
  {
    id: "lions-iii",
    type: "project",
    project: "lions",
    moment: "III",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "rare",
    sector: "nft",
    launchMC: 26_000,
    pumpMC: 15_000,
    holders: 4,
    // holding one got you into rooms, and that was most of the point
    effect: { kind: "scaleMC", target: "self", percentage: 11 },
    flavour: "Holding one got you into rooms. That was most of the point.",
  },
  {
    id: "lions-iv",
    type: "project",
    project: "lions",
    moment: "IV",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "rare",
    sector: "nft",
    launchMC: 24_000,
    pumpMC: 16_000,
    holders: 5,
    // the floor moved slowly in both directions, which suited everybody
    payoff: { when: { kind: "bankedAtMost", count: 1 }, effect: { kind: "directMC", target: "self", mc: 65_000 } },
    // the floor moved slowly in both directions, which suited everybody
    effect: { kind: "extraBudget", target: "self", mc: 85_000 },
    flavour: "The floor moved slowly in both directions, which suited everybody.",
  },
  {
    id: "lions-v",
    type: "project",
    project: "lions",
    moment: "V",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "epic",
    sector: "nft",
    launchMC: 38_000,
    pumpMC: 24_000,
    holders: 5,
    // the one collection everybody could name without checking
    standing: { kind: "directMC", target: "self", mc: 74_000 },
    // the one collection everybody could name without checking
    effect: { kind: "peakMC", percentage: 12 },
    flavour: "The one collection everybody could name without checking.",
  },
  {
    id: "lions-vi",
    type: "project",
    project: "lions",
    moment: "VI",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "epic",
    sector: "nft",
    launchMC: 44_000,
    pumpMC: 23_000,
    holders: 5,
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "nft", atLeast: 3 },
      effect: { kind: "directMC", target: "self", mc: 175_000 },
    },
    flavour: "Three on the wall and the wall was the flex, not any of them.",
  },
  {
    id: "lions-vii",
    type: "project",
    project: "lions",
    moment: "VII",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "legendary",
    sector: "nft",
    launchMC: 69_000,
    pumpMC: 41_000,
    holders: 6,
    // blue chip is a thing people call you; nobody applies for it
    loyalty: 40,
    // blue chip is a thing people call you; nobody applies for it
    effect: { kind: "scaleMC", target: "self", percentage: 21 },
    flavour: "Blue chip is a thing people call you. Nobody applies for it.",
  },
  {
    id: "lions-viii",
    type: "project",
    project: "lions",
    moment: "VIII",
    name: "Loaded Lions",
    ticker: "LION",
    rarity: "mythic",
    sector: "nft",
    launchMC: 108_000,
    pumpMC: 56_000,
    holders: 7,
    // two cycles in and the floor is still where the floor was
    effect: { kind: "scaleMC", target: "self", percentage: 27 },
    flavour: "Two cycles in and the floor is still where the floor was.",
  },
];

// ---------------------------------------------------------------------------
// CRONOS CHIMP CLUB — nft
//
// One of the first, and the one that was a group before it was a collection.
// This family draws: the cards put more cards in your hand, which is what a
// crowd does for you and what nothing else in nft does.
// ---------------------------------------------------------------------------

const CHIMPS: ProjectCard[] = [
  {
    id: "chimps-i",
    type: "project",
    project: "chimps",
    moment: "I",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "common",
    sector: "nft",
    launchMC: 14_000,
    pumpMC: 9_000,
    holders: 3,
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Early enough that being early was the whole story.",
  },
  {
    id: "chimps-ii",
    type: "project",
    project: "chimps",
    moment: "II",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "common",
    sector: "nft",
    launchMC: 16_000,
    pumpMC: 9_000,
    holders: 3,
    // the Discord was busy before the mint and busier after it
    effect: { kind: "drawCards", amount: 1 },
    flavour: "The Discord was busy before the mint and busier after it.",
  },
  {
    id: "chimps-iii",
    type: "project",
    project: "chimps",
    moment: "III",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "rare",
    sector: "nft",
    launchMC: 25_000,
    pumpMC: 15_000,
    holders: 3,
    // somebody in there knew somebody who knew about everything
    payoff: { when: { kind: "yourHandAtLeast", cards: 4 }, effect: { kind: "drawCards", amount: 2 } },
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Somebody in there knew somebody who knew about everything.",
  },
  {
    id: "chimps-iv",
    type: "project",
    project: "chimps",
    moment: "IV",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "rare",
    sector: "nft",
    launchMC: 28_000,
    pumpMC: 14_000,
    holders: 4,
    // half the projects on this chain started in somebody's chimp chat
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Half the projects on this chain started in somebody's chimp chat.",
  },
  {
    id: "chimps-v",
    type: "project",
    project: "chimps",
    moment: "V",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "epic",
    sector: "nft",
    launchMC: 37_000,
    pumpMC: 25_000,
    holders: 4,
    effect: { kind: "drawCards", amount: 2 },
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 3 },
      effect: { kind: "directMC", target: "self", mc: 90_000 },
    },
    flavour: "A club is only worth anything when there are people in the room.",
  },
  {
    id: "chimps-vi",
    type: "project",
    project: "chimps",
    moment: "VI",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "epic",
    sector: "nft",
    launchMC: 42_000,
    pumpMC: 24_000,
    holders: 5,
    // nobody who was in it early ever quite left it
    effect: { kind: "recoverCard", amount: 1 },
    flavour: "Nobody who was in it early ever quite left it.",
  },
  {
    id: "chimps-vii",
    type: "project",
    project: "chimps",
    moment: "VII",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "legendary",
    sector: "nft",
    launchMC: 64_000,
    pumpMC: 42_000,
    holders: 5,
    // the oldest group chat on the chain, and it still moves markets
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    flavour: "The oldest group chat on the chain and it still moves markets.",
  },
  {
    id: "chimps-viii",
    type: "project",
    project: "chimps",
    moment: "VIII",
    name: "Cronos Chimp Club",
    ticker: "CHIMP",
    rarity: "mythic",
    sector: "nft",
    launchMC: 100_000,
    pumpMC: 58_000,
    holders: 6,
    // everybody who is anybody here was in that room in the first month
    morePositions: 3,
    effect: { kind: "drawCards", amount: 3 },
    payoff: {
      when: { kind: "ownProjectCount", atLeast: 5 },
      effect: { kind: "directMC", target: "self", mc: 260_000 },
    },
    flavour: "Everybody who is anybody here was in that room in the first month.",
  },
];

// ---------------------------------------------------------------------------
// MINTED — infra
//
// The marketplace. It does not hold a floor, it decides whose floor you can see,
// and that is the mechanic: this is the only project family that can take a name
// off the opponent's support row.
// ---------------------------------------------------------------------------

const MINTED: ProjectCard[] = [
  {
    id: "minted-i",
    type: "project",
    project: "minted",
    moment: "I",
    name: "Minted",
    ticker: "MINTED",
    rarity: "common",
    sector: "infra",
    launchMC: 15_000,
    pumpMC: 9_000,
    holders: 3,
    // a list, a filter and a buy button — somebody has to make one
    effect: { kind: "directMC", target: "self", mc: 21_000 },
    flavour: "A list, a filter and a buy button. Somebody has to make one.",
  },
  {
    id: "minted-ii",
    type: "project",
    project: "minted",
    moment: "II",
    name: "Minted",
    ticker: "MINTED",
    rarity: "common",
    sector: "infra",
    launchMC: 13_000,
    pumpMC: 10_000,
    holders: 3,
    effect: { kind: "extraBudget", target: "self", mc: 42_000 },
    flavour: "Fees on both sides of every sale, quietly, forever.",
  },
  {
    id: "minted-iii",
    type: "project",
    project: "minted",
    moment: "III",
    name: "Minted",
    ticker: "MINTED",
    rarity: "rare",
    sector: "infra",
    launchMC: 27_000,
    pumpMC: 15_000,
    holders: 3,
    // delisted is not destroyed; it is worse — nobody can find it
    effect: { kind: "extraBudget", target: "self", mc: 85_000 },
    flavour: "Delisted is not destroyed. It is worse: nobody can find it.",
  },
  {
    id: "minted-iv",
    type: "project",
    project: "minted",
    moment: "IV",
    name: "Minted",
    ticker: "MINTED",
    rarity: "rare",
    sector: "infra",
    launchMC: 25_000,
    pumpMC: 16_000,
    holders: 4,
    // every collection needed it and none of them owned it
    payoff: { when: { kind: "ownProjectCount", atLeast: 4 }, effect: { kind: "directMC", target: "self", mc: 70_000 } },
    // every collection needed it and none of them owned it
    effect: { kind: "directMC", target: "self", mc: 27_000, per: "any" },
    flavour: "Every collection needed it and none of them owned it.",
  },
  {
    id: "minted-v",
    type: "project",
    project: "minted",
    moment: "V",
    name: "Minted",
    ticker: "MINTED",
    rarity: "epic",
    sector: "infra",
    launchMC: 39_000,
    pumpMC: 24_000,
    holders: 4,
    // the front page decided what a good week looked like
    standing: { kind: "directMC", target: "self", mc: 74_000 },
    // the front page decided what a good week looked like
    effect: { kind: "directMC", target: "self", mc: 36_000, per: "plays" },
    flavour: "The front page decided what a good week looked like.",
  },
  {
    id: "minted-vi",
    type: "project",
    project: "minted",
    moment: "VI",
    name: "Minted",
    ticker: "MINTED",
    rarity: "epic",
    sector: "infra",
    launchMC: 41_000,
    pumpMC: 26_000,
    holders: 4,
    // royalties were optional and it kept collecting them anyway
    severance: { percentage: 26, from: "both" },
    effect: { kind: "extraBudget", target: "self", mc: 170_000 },
    flavour: "Royalties were optional and it kept collecting them anyway.",
  },
  {
    id: "minted-vii",
    type: "project",
    project: "minted",
    moment: "VII",
    name: "Minted",
    ticker: "MINTED",
    rarity: "legendary",
    sector: "infra",
    launchMC: 67_000,
    pumpMC: 42_000,
    holders: 5,
    // the venue outlasts everything it lists — that is always true
    effect: { kind: "scaleMC", target: "self", percentage: 21 },
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "infra", atLeast: 2 },
      effect: { kind: "directMC", target: "self", mc: 150_000 },
    },
    flavour: "The venue outlasts everything it lists. That is always true.",
  },
  {
    id: "minted-viii",
    type: "project",
    project: "minted",
    moment: "VIII",
    name: "Minted",
    ticker: "MINTED",
    rarity: "mythic",
    sector: "infra",
    launchMC: 115_000,
    pumpMC: 53_000,
    holders: 6,
    // two names off the front page and a market that forgets by Friday
    restriction: { kind: "banType", cardType: "tool" },
    // two names off the front page and a market that forgets by Friday
    effect: { kind: "directMC", target: "self", mc: 60_000, per: "theirs" },
    flavour: "Two names off the front page and a market that forgets by Friday.",
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
    aura: { kind: "pumpSector", sector: "defi", bonus: 22_000 },
    flavour: "Answered every accusation with a commit and nothing else.",
  },
  {
    id: "founder-wolfswap",
    type: "influencer",
    name: "The Wolfswap Founder",
    ticker: "WOLFDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "dex", bonus: 20_000 },
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    flavour: "Shipped the fork on a Sunday and told the other team on Monday.",
  },
  {
    id: "founder-robots",
    type: "influencer",
    name: "The Reckless Robots Founder",
    ticker: "RRDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "nft", bonus: 15_000 },
    flavour: "Builds the thing, then finds out what it does. In that order.",
  },
  {
    id: "founder-howlers",
    type: "influencer",
    name: "The Howlers Founder",
    ticker: "HOWLDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "nft", bonus: 16_000 },
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
    aura: { kind: "pumpSector", sector: "infra", bonus: 13_000 },
    effect: { kind: "drawCards", amount: 1 },
    flavour: "Shipped six things nobody asked for. Four of them are load-bearing.",
  },
  {
    id: "founder-cr00ts",
    type: "influencer",
    name: "The Cr00ts Founder",
    ticker: "CR00DEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "infra", bonus: 14_000 },
    effect: { kind: "stealMC", percentage: 7 },
    flavour: "Has never announced anything. The volume announces it for him.",
  },
  {
    id: "founder-obsidian",
    type: "influencer",
    name: "The Obsidian Finance Founder",
    ticker: "OBSDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "defi", bonus: 21_000 },
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
  {
    id: "founder-vvs",
    type: "influencer",
    name: "The VVS Founder",
    ticker: "VVSDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "dex", bonus: 21_000 },
    effect: { kind: "extraBudget", target: "self", mc: 60_000 },
    flavour: "Shipped the simplest possible thing and never complicated it.",
  },
  {
    id: "founder-mmf",
    type: "influencer",
    name: "The Mad Meerkat Founder",
    ticker: "MMFDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "dex", bonus: 14_000 },
    effect: { kind: "stealMC", percentage: 8 },
    flavour: "Announces everything at once and ships most of it.",
  },
  {
    id: "founder-tectonic",
    type: "influencer",
    name: "The Tectonic Founder",
    ticker: "TONICDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "defi", bonus: 15_000 },
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    flavour: "Talks about risk parameters at parties. Nobody has ever minded.",
  },
  {
    id: "founder-ferro",
    type: "influencer",
    name: "The Ferro Founder",
    ticker: "FERDEV",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "defi", bonus: 7_000 },
    flavour: "Has never posted a chart. There would be nothing on it.",
  },
  {
    id: "founder-lions",
    type: "influencer",
    name: "The Loaded Lions Founder",
    ticker: "LIONDEV",
    rarity: "legendary",
    aura: { kind: "pumpSector", sector: "nft", bonus: 22_000 },
    flavour: "Built the room first and sold the tickets afterwards.",
  },
  {
    id: "founder-chimps",
    type: "influencer",
    name: "The Chimp Club Founder",
    ticker: "CHIMPDEV",
    rarity: "epic",
    aura: { kind: "pumpSector", sector: "nft", bonus: 13_000 },
    effect: { kind: "drawCards", amount: 2 },
    flavour: "Knows everybody, which on this chain is the only real moat.",
  },
  {
    id: "founder-minted",
    type: "influencer",
    name: "The Minted Founder",
    ticker: "MINTEDDEV",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "infra", bonus: 8_000 },
    effect: { kind: "cancel", target: "opponent", count: 1 },
    flavour: "Decides what the front page says and never says who asked.",
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
    aura: { kind: "pumpSector", sector: "dex", bonus: 12_000 },
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
    aura: { kind: "pumpSector", sector: "nft", bonus: 8_000 },
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
    aura: { kind: "pumpSector", sector: "nft", bonus: 3_000 },
    flavour: "Buys the cheapest twenty of anything the moment it moves.",
  },
  {
    id: "whitelist",
    type: "influencer",
    name: "The Whitelist Hunter",
    ticker: "WHITELIST",
    rarity: "common",
    aura: { kind: "pumpSector", sector: "nft", bonus: 3_000 },
    flavour: "In nine Discords, active in none, on the list for all of them.",
  },
  {
    id: "validator",
    type: "influencer",
    name: "The Validator",
    ticker: "VALIDATOR",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "infra", bonus: 6_000 },
    flavour: "Keeps a machine in a rack running so everybody else can trade.",
  },
  {
    id: "farmer",
    type: "influencer",
    name: "The Airdrop Farmer",
    ticker: "FARMER",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "defi", bonus: 6_000 },
    flavour: "Forty wallets, every protocol, and a calendar of snapshot dates.",
  },
  {
    id: "nodeguy",
    type: "influencer",
    name: "The Node Runner",
    ticker: "NODE",
    rarity: "rare",
    aura: { kind: "pumpSector", sector: "infra", bonus: 7_000 },
    flavour: "Six boxes on the roof and a spreadsheet of what each one earns.",
  },
  {
    id: "mintbot",
    type: "influencer",
    name: "The Mint Bot",
    ticker: "MINTBOT",
    rarity: "common",
    aura: { kind: "pumpSector", sector: "nft", bonus: 4_000 },
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
    aura: { kind: "pumpSector", sector: "infra", bonus: 5_000 },
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
    // The common tactics ran from $8.8K to $255.1K, and the band they were pulled
    // to is the high end rather than the median. A tactic costs what a common
    // project costs and is pure effect — no position, no pump — while a common
    // project's effect alone measures $51.7K and hands you a board slot on top.
    // $35K for the same price was the tier being underpaid, not the top being
    // overpaid.
    //
    // Chart's green, questions come later: the plainest card in the set, and the
    // set wants one. $35.2K.
    effect: { kind: "directMC", target: "self", mc: 60_000 },
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
    // Twenty percent off is a discount, you tell yourself — so it is the comeback
    // card, and comebackMC is a share of the gap rather than a gate: nothing when
    // the scores are level, more the further under you are. There is no better
    // card in the set to be named after, and the version with a behindBy threshold
    // on top of two heals measured $8.8K, the lowest common tactic there was.
    effect: { kind: "comebackMC", percentage: 26 },
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
    // The common tactics ran from $8.8K to $255.1K, and the band they were pulled
    // to is the high end rather than the median. A tactic costs what a common
    // project costs and is pure effect — no position, no pump — while a common
    // project's effect alone measures $51.7K and hands you a board slot on top.
    // $35K for the same price was the tier being underpaid, not the top being
    // overpaid. $22.3K.
    effect: { kind: "directMC", target: "opponent", mc: -55_000 },
    flavour: "He sold at forty thousand. It went to four million.",
  },
  {
    id: "paper-hands",
    type: "tactic",
    name: "Paper Hands",
    ticker: "PAPER",
    rarity: "common",
    // The whole group chat at once, which was a holder off every position they own
    // — the effect taken off GIGA's epic and ZEREBRO's legendary the same day for
    // being two rarities too strong, sitting here on a common at $255.1K against a
    // tier running $8.8K to $148.9K.
    //
    // damageHolders has no unit below one, so the size had to come from a
    // different shape. Everybody selling at once still scales with how much they
    // have; it takes market cap instead of holders now.
    effect: {
      kind: "directMC",
      target: "opponent",
      mc: -14_000,
      per: "theirs",
    },
    flavour: "The whole group chat at once. Nobody admits it afterwards.",
  },
  {
    id: "diamond-hands",
    type: "tactic",
    name: "Diamond Hands",
    ticker: "DIAMOND",
    rarity: "common",
    // You have watched it go to zero three times and you are still here, so
    // everything comes back — "full" rather than one holder, which is the variant
    // worth most on a board that has been taken apart, and not the one that
    // measured nothing on Switchboard, Grape, Boryoku and Sanctum. The payoff below
    // stays: being behind is when still being here means something. $34.5K.
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    // You have watched it go to zero three times. Holding is worth nothing while
    // you are winning.
    payoff: {
      when: { kind: "behindBy", mc: 250_000 },
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
    // A single-position pump under about $20K is under the floor and does nothing:
    // this read -$1.1K at $7K, Shill read $24 at $8K and Cabal Call -$36.6K at
    // $15K, while Graduation does the same thing at $22K and reads $104K.
    //
    // Three replies, a chart screenshot and a rocket — it is marketing that costs
    // nothing, so it hands back a share of the marketing that did cost something.
    effect: { kind: "refundMC", percentage: 8 },
    flavour:
      "Three replies, a chart screenshot and a rocket. It works every time.",
  },
  {
    id: "slippage",
    type: "tactic",
    name: "Slippage",
    ticker: "SLIP",
    rarity: "common",
    // He set it to twenty percent to be safe and it took all twenty — so it takes a
    // percentage, which is what slippage is. It was a flat $15K, which made it Jeet
    // at a smaller size on the same rarity, and measured $29.5K.
    effect: { kind: "scaleMC", target: "opponent", percentage: -5 },
    flavour: "He set it to twenty percent to be safe. It took all twenty.",
  },
  {
    id: "exit-liquidity",
    type: "tactic",
    name: "Exit Liquidity",
    ticker: "EXIT",
    rarity: "common",
    effect: { kind: "stealMC", percentage: 4 },
    flavour: "Somebody has to be on the other side. Today it isn't you.",
  },
  {
    id: "rebrand",
    type: "tactic",
    name: "Rebrand",
    ticker: "REBRAND",
    rarity: "common",
    // A single-position pump under about $20K is under the floor and does nothing:
    // this read -$1.1K at $7K, Shill read $24 at $8K and Cabal Call -$36.6K at
    // $15K, while Graduation does the same thing at $22K and reads $104K.
    //
    // Rebrand and Shill were also the same card twice — one common pumping $7K and
    // another pumping $8K. New logo, new ticker, same dev: nothing underneath
    // changed and the rate went up anyway, which is what scalePump is. It
    // multiplies what the position already pays instead of adding to it.
    //
    // 22% read $4.1K and 45% reads $22K, which is where it stays: scalePump is
    // capped at 50 by validation, so there is almost no room above this, and $22K
    // is where Jeet and Slippage sit. A common tactic that lands one notch under
    // the median is a common tactic; the alternative is a different effect, and
    // this one is the only reading of "new logo, new ticker, same dev" the set
    // can express.
    effect: { kind: "scalePump", target: "ownProject", percentage: 45 },
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
    // A single-position pump under about $20K is under the floor and does nothing:
    // this read -$1.1K at $7K, Shill read $24 at $8K and Cabal Call -$36.6K at
    // $15K, while Graduation does the same thing at $22K and reads $104K.
    //
    // Forty guys in a chat, and this time you are in it. The chat is the holders,
    // so the card counts them.
    effect: { kind: "directMC", target: "self", mc: 5_000, per: "holders" },
    flavour: "Forty guys in a chat, and this time you're in it.",
  },
  {
    id: "mev-sandwich",
    type: "tactic",
    name: "MEV Sandwich",
    ticker: "MEV",
    rarity: "rare",
    // The steal ladder was priced as though a percentage of their market cap were
    // an ordinary rate. It is not: a steal moves the margin twice, taking from one
    // side and adding to the other, and it measures about $30K per percentage
    // point. Four percent on a common already read $87.9K.
    //
    //     Exit Liquidity   common       4%   $87.9K
    //     MEV Sandwich     rare        10%  $321.4K
    //     Insider Wallet   epic        18%  $546.6K
    //     Cabal Exit       legendary   30%  $998.5K
    //
    // Against medians of $68K, $106K, $156K and $395K, every rung above the common
    // was three times its tier.
    //
    // And compressing the ladder alone would have left four cards doing one thing
    // at four sizes, with the rare and the common a percentage point apart. A
    // sandwich is not one trade — it is a trade in front and a trade behind, with
    // theirs in the middle. So this one takes twice, which is the only card in the
    // set shaped like what it is named after.
    //
    // Two turns rather than one because validation refuses one: under two is not a
    // wait at all in a ten-turn match, and it is right — a timer nobody can answer
    // is not a timer.
    effect: {
      kind: "after",
      turns: 2,
      now: { kind: "stealMC", percentage: 2 },
      effect: { kind: "stealMC", percentage: 2 },
    },
    flavour:
      "Your transaction sat right between two others. Coincidence, obviously.",
  },
  {
    id: "cto",
    type: "tactic",
    name: "Community Takeover",
    ticker: "CTO",
    rarity: "rare",
    // The card the effect was written for. It said 'each of your projects pumps' for as long as the engine had no way to say what a community takeover is.
    effect: { kind: "takeOver" },
    // The dev is gone and the community picks it up — which nobody does while
    // the chart is fine.
    payoff: {
      when: { kind: "behindBy", mc: 350_000 },
      effect: { kind: "stealMC", percentage: 11 },
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
    // Marketing budget on a card that costs a card and budget to play is a card
    // that loses money — it measured -$24.4K, the same way six tools did.
    //
    // Eight wallets, one block, one owner: everything on the table is still yours,
    // which is the number unbankedMC reads.
    effect: { kind: "unbankedMC", percentage: 14 },
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
    // Pays for having already taken money off the table, which is what this
    // moment is about and what nothing in the set used to reward.
    payoff: {
      when: { kind: "bankedAtLeast", count: 1 },
      effect: { kind: "extraBudget", target: "self", mc: 60_000 },
    },
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
      when: { kind: "behindBy", mc: 350_000 },
      effect: { kind: "directMC", target: "self", mc: 210_000 },
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
    // The steal ladder was priced as though a percentage of their market cap were
    // an ordinary rate. It is not: a steal moves the margin twice, taking from one
    // side and adding to the other, and it measures about $30K per percentage
    // point. Four percent on a common already read $87.9K.
    //
    //     Exit Liquidity   common       4%   $87.9K
    //     MEV Sandwich     rare        10%  $321.4K
    //     Insider Wallet   epic        18%  $546.6K
    //     Cabal Exit       legendary   30%  $998.5K
    //
    // Against medians of $68K, $106K, $156K and $395K, every rung above the common
    // was three times its tier.
    effect: { kind: "stealMC", percentage: 5 },
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
    // Two holders off every position they own is the heaviest damage in the set and
    // it was on an epic, at $556.3K against a $156.1K median. damageHolders has no
    // unit below one, and one would still have read about $255K — the figure Paper
    // Hands had before the same problem was fixed there.
    //
    // Everybody selling at the same moment is a price move, and a percentage is
    // the shape of a price move.
    effect: { kind: "scaleMC", target: "opponent", percentage: -8 },
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
    // cancel is not a card on its own. The set has five cards carrying it and the
    // three that work are epics where it sits beside something else; the two that
    // measured nothing are these, where it is the whole card.
    //
    // It is not that there was nothing to cancel — the opponent has a tool or an
    // influencer on the table in 49% of your turns and at some point in 82% of
    // matches. It is that trading a card for a card builds nothing, and the bot
    // agreed: Cancelled was played 29 times and thrown away 112.
    //
    // So the takedown happens now and the fallout lands later, which is also how
    // this actually goes.
    effect: {
      kind: "after",
      turns: 2,
      now: { kind: "cancel", target: "opponent", count: 1 },
      effect: { kind: "directMC", target: "self", mc: 100_000 },
    },
    flavour: "Somebody found the old posts. That was the whole career.",
  },
  {
    id: "unfollowed",
    type: "tactic",
    name: "Mass Unfollow",
    ticker: "UNFOLLOW",
    rarity: "legendary",
    // cancel is not a card on its own. The set has five cards carrying it and the
    // three that work are epics where it sits beside something else; the two that
    // measured nothing are these, where it is the whole card.
    //
    // It is not that there was nothing to cancel — the opponent has a tool or an
    // influencer on the table in 49% of your turns and at some point in 82% of
    // matches. It is that trading a card for a card builds nothing, and the bot
    // agreed: Cancelled was played 29 times and thrown away 112.
    //
    // So the takedown happens now and the fallout lands later, which is also how
    // this actually goes.
    effect: {
      kind: "after",
      turns: 2,
      now: { kind: "cancel", target: "opponent", count: 2 },
      effect: { kind: "directMC", target: "self", mc: 320_000 },
    },
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
      "The curve filled and it moved to Raydium. From here it happens in public.",
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
      effect: { kind: "scaleMC", target: "self", percentage: 13 },
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
    // The steal ladder was priced as though a percentage of their market cap were
    // an ordinary rate. It is not: a steal moves the margin twice, taking from one
    // side and adding to the other, and it measures about $30K per percentage
    // point. Four percent on a common already read $87.9K.
    //
    //     Exit Liquidity   common       4%   $87.9K
    //     MEV Sandwich     rare        10%  $321.4K
    //     Insider Wallet   epic        18%  $546.6K
    //     Cabal Exit       legendary   30%  $998.5K
    //
    // Against medians of $68K, $106K, $156K and $395K, every rung above the common
    // was three times its tier.
    //
    // This rung sits above that band on purpose. Compressed to 10% it read $469.4K
    // and the maker called it too weak for a legendary, which is a judgement the
    // median cannot make: the top of a rarity is meant to be the card you build a
    // deck to reach, and a measured median is the middle of a tier rather than a
    // ceiling for it. 20%, and it reads what it reads.
    effect: { kind: "stealMC", percentage: 20 },
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
    // $175.9K on a common against about $74K for the tier, and it stays there.
    // damageHolders has no unit below one and an event has to hit the whole table
    // by rule, so there is no smaller version of this card to write. The set wants
    // a cheap board-wide shake-out and this is the only size one can be.
    effect: { kind: "damageHolders", target: "allProjects", amount: 1 },
    flavour: "Nothing happened. Everything moved twenty percent anyway.",
  },
  {
    // TCG aims this at gaming, which this game does not have. It lands on nft
    // here: retail arriving is the floor moving, and a floor is the one number
    // in this set that a newcomer can read without being told what it means.
    id: "retail-arrives",
    type: "event",
    name: "Retail Arrives",
    ticker: "RETAIL",
    rarity: "common",
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement, and the attempt is the part worth
    // keeping. Read with the ordinary deck builder they look weak — and worse,
    // they read WORSE as the number goes up. Airdrop Season went $71.7K at $16K a
    // head, $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus
    // lands on both boards, so a bigger one helps whoever is heavier in that
    // sector, and in a deck not built for it that is as likely to be the opponent.
    //
    // Measured again in a deck that leans the sector they read three to eight
    // times higher — ETF Approval $159.6K generic against $1.2M in an infra deck.
    // Six of these had already been raised two to five times on the strength of
    // the generic reading; all six are back at the sizes they shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns. Neither is a
    // number to tune against.
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { nft: 10_000 },
    },
    flavour:
      "Your uncle asks which app to download. Historically this is the top.",
  },
  {
    id: "green-day",
    type: "event",
    name: "Green Day",
    ticker: "GREEN",
    rarity: "common",
    effect: { kind: "scaleMC", target: "both", percentage: 14 },
    flavour: "Everything up. No reason given, none asked for.",
  },
  {
    id: "sideways",
    type: "event",
    name: "Sideways",
    ticker: "CHOP",
    rarity: "common",
    // $38.5K, and it stays there. A percentage handed to both players scales with
    // each player's own market cap, so a bigger number helps whoever is already
    // ahead — which is why The Flippening measured LOWER at 72% than at 50%. The
    // seven both-players percentages in this set are not tunable in the direction
    // they look tunable in, and this is the smallest of them.
    effect: { kind: "scaleMC", target: "both", percentage: -18 },
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
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement, and the attempt is the part worth
    // keeping. Read with the ordinary deck builder they look weak — and worse,
    // they read WORSE as the number goes up. Airdrop Season went $71.7K at $16K a
    // head, $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus
    // lands on both boards, so a bigger one helps whoever is heavier in that
    // sector, and in a deck not built for it that is as likely to be the opponent.
    //
    // Measured again in a deck that leans the sector they read three to eight
    // times higher — ETF Approval $159.6K generic against $1.2M in an infra deck.
    // Six of these had already been raised two to five times on the strength of
    // the generic reading; all six are back at the sizes they shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns. Neither is a
    // number to tune against.
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { defi: 16_000 },
    },
    flavour:
      "Six months of farming, one morning of claiming, one afternoon of selling.",
  },
  {
    id: "rotation",
    type: "event",
    name: "Rotation",
    ticker: "ROTATE",
    rarity: "rare",
    // A holder back on every position, both sides, measured MINUS $13.2K — the
    // symmetric version of the effect that already measured nothing on four
    // project cards. Handing both players the same small mend is the one shape
    // that genuinely cannot move a margin.
    //
    // "Full" was tried and read $7K. Healing is thin whichever way it is written:
    // a match loses 1.53 positions to damage against 20.83 closed by their own
    // owner, so mending is answering a question almost nobody asks — and doing it
    // for both players at once answers it for nobody.
    //
    // The money did not leave, it moved one narrative to the left. That is a
    // sector rotating, and TCG rotates it into AI — a sector this game does not
    // have. Here it lands on dex, because a rotation is not a narrative you can
    // see, it is volume, and volume turns up where people swap. Like every sector
    // event this favours whoever holds more of it, and says nothing about which
    // deck that is.
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement and the attempt is worth recording.
    // Read with the ordinary deck builder they look weak, and worse, they read
    // WORSE as the number goes up — Airdrop Season went $71.7K at $16K a head,
    // $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus lands
    // on both boards, so a bigger one helps whoever is heavier in that sector, and
    // in a deck not built for it that is as likely to be the other player.
    //
    // So they were measured again in a deck that leans the sector, where they read
    // three to eight times higher — ETF Approval $159.6K generic against $1.2M in
    // an infra deck. On the strength of the generic reading six of these had
    // already been raised two to five times; all six are back at the sizes they
    // shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns; neither is a
    // number to tune against, and these six are left where the maker set them.
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { dex: 30_000 },
    },
    flavour: "The money didn't leave. It just moved one narrative to the left.",
  },
  {
    id: "network-outage",
    type: "event",
    name: "Network Outage",
    ticker: "OUTAGE",
    rarity: "rare",
    // Volatility is a holder off every position on a common and measured $142.5K;
    // this was the same card on a rare at $159.2K. One effect, two rarities, twelve
    // percent apart.
    //
    // A permanent rate cut on every position was tried first and measured MINUS
    // $40K. An event hits both boards by rule, so a penalty lands on yours too —
    // and it is worse than a wash, because the player holding the card is usually
    // the one who has built something to lose.
    //
    // perHolder is the way out and the only one an event has: the damage stays
    // symmetric and the payment does not. Everyone learned what a validator was
    // that week, and you are paid for every holder the lesson cost anybody.
    effect: {
      kind: "damageHolders",
      target: "allProjects",
      amount: 1,
      perHolder: { kind: "directMC", target: "self", mc: 3_000 },
    },
    flavour:
      "Seventeen hours. Everyone learned what a validator was that week.",
  },

  // --- epic ---
  {
    // TCG's card is "Nation State Meta" and it pumps politics, a sector this game
    // does not have. Cards of Cronos put DeFi Summer in that slot at the fork and
    // it goes back there: same type, same rarity, same $30K, aimed at a sector
    // that exists here.
    id: "defi-summer",
    type: "event",
    name: "DeFi Summer",
    ticker: "SUMMER",
    rarity: "epic",
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement, and the attempt is the part worth
    // keeping. Read with the ordinary deck builder they look weak — and worse,
    // they read WORSE as the number goes up. Airdrop Season went $71.7K at $16K a
    // head, $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus
    // lands on both boards, so a bigger one helps whoever is heavier in that
    // sector, and in a deck not built for it that is as likely to be the opponent.
    //
    // Measured again in a deck that leans the sector they read three to eight
    // times higher — ETF Approval $159.6K generic against $1.2M in an infra deck.
    // Six of these had already been raised two to five times on the strength of
    // the generic reading; all six are back at the sizes they shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns. Neither is a
    // number to tune against.
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { defi: 30_000 },
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
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement, and the attempt is the part worth
    // keeping. Read with the ordinary deck builder they look weak — and worse,
    // they read WORSE as the number goes up. Airdrop Season went $71.7K at $16K a
    // head, $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus
    // lands on both boards, so a bigger one helps whoever is heavier in that
    // sector, and in a deck not built for it that is as likely to be the opponent.
    //
    // Measured again in a deck that leans the sector they read three to eight
    // times higher — ETF Approval $159.6K generic against $1.2M in an infra deck.
    // Six of these had already been raised two to five times on the strength of
    // the generic reading; all six are back at the sizes they shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns. Neither is a
    // number to tune against.
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { infra: 36_000 },
    },
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
    // Symmetric on the face and not in effect: it takes the biggest name off each
    // side, so it pays whoever was behind on support. $66.9K on a legendary against
    // $395K, and it only reached the table in 76 matches of 180 — it is expensive
    // and the bot often had better things to do with the turn. Going from one name
    // to two moved it to $57.1K, which is to say it did not move.
    //
    // Left as it is and flagged. cancel is documented as weak on its own — trading
    // a card for a card builds nothing — and the two tactics carrying it were
    // fixed by pairing it with a timer, which an event cannot use: validation
    // requires an event's effect to name allProjects or both, and `after` names
    // neither. Whether a symmetric cancel is worth a legendary slot is a design
    // question rather than a number.
    effect: { kind: "cancel", target: "both", count: 2 },
    flavour: "The platform woke up one morning and decided nobody was famous.",
  },
  {
    id: "the-bottom",
    type: "event",
    name: "The Bottom",
    ticker: "BOTTOM",
    rarity: "legendary",
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement, and the attempt is the part worth
    // keeping. Read with the ordinary deck builder they look weak — and worse,
    // they read WORSE as the number goes up. Airdrop Season went $71.7K at $16K a
    // head, $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus
    // lands on both boards, so a bigger one helps whoever is heavier in that
    // sector, and in a deck not built for it that is as likely to be the opponent.
    //
    // Measured again in a deck that leans the sector they read three to eight
    // times higher — ETF Approval $159.6K generic against $1.2M in an infra deck.
    // Six of these had already been raised two to five times on the strength of
    // the generic reading; all six are back at the sizes they shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns. Neither is a
    // number to tune against.
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { infra: 25_000, defi: 25_000 },
    },
    // The turn. A bottom is only a bottom if you were down, and the whole card
    // is about the moment nobody wanted it.
    payoff: {
      when: { kind: "behindBy", mc: 600_000 },
      effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    },
    flavour:
      "Solana at eight dollars and a dog token nobody asked for. That was the turn.",
  },
  {
    id: "ftx-collapse",
    type: "event",
    name: "FTX Collapse",
    ticker: "FTX",
    rarity: "legendary",
    effect: { kind: "damageHolders", target: "allProjects", amount: 3 },
    flavour:
      "Eight dollars. The chain was declared dead by people who had never used it.",
  },
  {
    id: "sol-flips-eth",
    type: "event",
    name: "The Flippening",
    ticker: "FLIP",
    rarity: "legendary",
    // Back to 50 after 72 measured LOWER — $220.4K against $283.8K. A percentage
    // handed to both players scales with each player's own market cap, so making
    // it bigger helps whoever is already ahead, and the player holding the card is
    // not reliably that player. The seven both-players percentages in this set are
    // not tunable in the direction they look tunable in.
    effect: { kind: "scaleMC", target: "both", percentage: 50 },
    flavour:
      "The chart everyone has been posting since 2021, finally doing the thing.",
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
    // A sector bonus on the whole table is the set's best implicit synergy: the
    // card never says which deck it favours, and it favours whoever holds more of
    // that sector than the other player does.
    //
    // These numbers are not set by measurement, and the attempt is the part worth
    // keeping. Read with the ordinary deck builder they look weak — and worse,
    // they read WORSE as the number goes up. Airdrop Season went $71.7K at $16K a
    // head, $59.9K at $28K and $42.6K at $55K. That is the card working: the bonus
    // lands on both boards, so a bigger one helps whoever is heavier in that
    // sector, and in a deck not built for it that is as likely to be the opponent.
    //
    // Measured again in a deck that leans the sector they read three to eight
    // times higher — ETF Approval $159.6K generic against $1.2M in an infra deck.
    // Six of these had already been raised two to five times on the strength of
    // the generic reading; all six are back at the sizes they shipped with.
    //
    // The second instrument is not stable either. On the original numbers Airdrop
    // Season reads $70.4K generic and $58.1K in a defi deck, and The Bottom $115.9K
    // and $30.1K — lower in the deck built for them. Leaning a deck into one sector
    // changes every other card in it, so that reading moves for reasons that are
    // not this card. scripts/sector-events.ts holds both columns. Neither is a
    // number to tune against.
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
  ...OBSIDIAN,
  ...CAW,
  ...DAK,
  ...VVS,
  ...MMF,
  ...TECTONIC,
  ...FERRO,
  ...LIONS,
  ...CHIMPS,
  ...MINTED,
  ...FOUNDERS,
  ...VOICES,
  ...ARCHETYPES,
  ...TOOLS,
  ...TACTICS,
  ...EVENTS,
];

/** The spread the set is supposed to keep to. The test guards this. */
export const EXPECTED_DISTRIBUTION = {
  common: 60,
  rare: 67,
  epic: 62,
  legendary: 36,
  mythic: 21,
} as const;
