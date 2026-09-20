// Eighteen mythics that were the card below them, or one bare line.
//
//   npx tsx scripts/mythic-variety.ts            read it
//   npx tsx scripts/mythic-variety.ts --apply    write it into the set
//
// scripts/mythic-check.ts asks three questions of every family's top card: does
// it run the same effect kind as its own legendary, is it a single line of rules,
// and do several other families top out on the same thing. It found that eleven
// families end on scaleMC, eight on scalePump and five on comebackMC — more than
// half the set finishing on one of three effects.
//
// THREE ARE FIXED BY CHANGING WHAT THE CARD DOES, because they were the card
// below them with a bigger number and nothing else:
//
//   Gang Gang    22% -> 27%
//   Mistery      22% -> 27%
//   Wolfswap     lose 2 holders -> lose 3 holders
//
// FIFTEEN KEEP THEIR EFFECT AND GAIN A SECOND HALF. That is the cheaper half and
// the safer one: a payoff or a standing adds a line to read without moving what
// the family is for, and every one of them is written off the flavour already on
// the card.
//
// WHAT IS LEFT ALONE, and it is most of the list mythic-check flags. A single
// line is not a fault when the line is banRoom, takeOver, merge, rug or fork —
// ebisusbay and cronus end on one sentence and that sentence is worth $1696K by
// the engine's own measurement. Clove, Chimp Club, Tectonic and Loaded Lions share
// an effect kind with their legendary and each carries a second line that does
// something the legendary does not, which is the identity of the family rather
// than a failure of the card.

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Effect } from "../engine/types";

interface Change {
  effect?: Effect;
  payoff?: { when: unknown; effect: Effect };
  standing?: Effect;
  restriction?: { kind: string; [k: string]: unknown };
  why: string;
}

const PLAN: Record<string, Change> = {
  // --- the three that were their own legendary ----------------------------
  sloth: {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    why: "a gang is a group that decided to be one, and it brings everybody back whole",
  },
  mery: {
    effect: { kind: "directMC", target: "self", mc: 70_000, per: "table" },
    why: "it handed over the keys, so what it pays is read off the whole table",
  },
  wolfswap: {
    effect: { kind: "takeOver" },
    why: "it bought Ebisu's Bay, which is the one thing in this game takeOver is",
  },

  // --- fifteen that keep what they do and gain a second half ---------------
  boomer: {
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "nft", atLeast: 2 },
      effect: { kind: "directMC", target: "self", mc: 200_000 },
    },
    why: "a company with a collection attached pays more when there is a collection",
  },
  loaf: {
    restriction: { kind: "taxPlays", percent: 14 },
    why: "the more people arrive the more it burns, and arriving costs them",
  },
  bobs: {
    payoff: {
      when: { kind: "turnAtLeast", turn: 8 },
      effect: { kind: "directMC", target: "self", mc: 45_000, per: "holders" },
    },
    why: "it stopped being a collection and became an income, which takes until late",
  },
  bored: {
    payoff: {
      when: { kind: "ownProjectsInSector", sector: "meme", atLeast: 3 },
      effect: { kind: "pumpProject", target: "allOwnProjects", mc: 24_000 },
    },
    why: "a club is worth what turns up to it",
  },
  caw: {
    payoff: {
      when: { kind: "holdersLostAtLeast", holders: 6 },
      effect: { kind: "stealMC", percentage: 12 },
    },
    why: "a real bird stole a real knife, and it does it again once there is blood",
  },
  corgi: {
    standing: { kind: "drawCards", amount: 1 },
    why: "nobody joined for the technology; they joined and stayed and keep turning up",
  },
  pyro: {
    payoff: {
      when: { kind: "playedThisTurnAtLeast", cards: 2 },
      effect: { kind: "directMC", target: "self", mc: 160_000 },
    },
    why: "every trade pays six other things, so the turn you trade twice pays twice",
  },
  vvs: {
    standing: { kind: "extraBudget", target: "self", mc: 40_000 },
    why: "the front door of the chain takes a toll on everything that walks through",
  },
  phenix: {
    payoff: {
      when: { kind: "bankedAtLeast", count: 1 },
      effect: { kind: "directMC", target: "self", mc: 190_000 },
    },
    why: "a picture you can cash in only proves it once you have cashed one in",
  },
  capybara: {
    standing: { kind: "drawCards", amount: 1 },
    why: "a nation with no borders keeps letting people in",
  },
  croginal: {
    payoff: {
      when: { kind: "turnAtLeast", turn: 7 },
      effect: { kind: "directMC", target: "self", mc: 210_000 },
    },
    why: "the draw is every Wednesday and the late ones are the ones worth winning",
  },
  ballz: {
    payoff: {
      when: { kind: "holdersLostAtLeast", holders: 8 },
      effect: { kind: "directMC", target: "self", mc: 200_000 },
    },
    why: "a game of pure chance, and the jackpot lands on the wreckage",
  },
  troll: {
    standing: { kind: "directMC", target: "self", mc: 36_000 },
    why: "it published its own books, and a dashboard that keeps counting keeps paying",
  },
  fulcrom: {
    restriction: { kind: "banTakeProfit" },
    why: "the liquidation price is the only number that matters and nobody closes on their own terms",
  },
  croarmy: {
    payoff: {
      when: { kind: "theirHandAtMost", cards: 3 },
      effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    },
    why: "a war that does not stop when you log off, and it finishes what is left",
  },
};

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

const mythics = new Map(
  CARDS.filter((c) => c.type === "project" && c.rarity === "mythic").map(
    (c) => [(c as { project: string }).project, c] as const,
  ),
);

const problems: string[] = [];
for (const [family, change] of Object.entries(PLAN)) {
  const card = mythics.get(family) as Record<string, unknown> | undefined;
  if (!card) {
    problems.push(`${family} has no mythic`);
    continue;
  }
  for (const field of ["payoff", "standing", "restriction"] as const) {
    if (change[field] !== undefined && card[field] !== undefined) {
      problems.push(`${family} already has a ${field}`);
    }
  }
}
if (problems.length) throw new Error(problems.join("\n  "));

if (!process.argv.includes("--apply")) {
  console.log(`${Object.keys(PLAN).length} mythics\n`);
  for (const [family, change] of Object.entries(PLAN)) {
    const card = mythics.get(family) as { name: string; effect?: Effect };
    const what = change.effect
      ? `effect -> ${render(change.effect)}`
      : change.payoff
        ? `payoff ${render(change.payoff)}`
        : change.standing
          ? `standing ${render(change.standing)}`
          : `restriction ${render(change.restriction)}`;
    console.log(`  ${card.name.padEnd(22)}${what}`);
    console.log(`  ${" ".repeat(22)}${change.why}`);
  }
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");

for (const [family, change] of Object.entries(PLAN)) {
  const card = mythics.get(family)!;
  const at = source.indexOf(`    id: "${card.id}",`);
  if (at < 0) throw new Error(`Could not find ${card.id}.`);
  const start = source.lastIndexOf("  {\n", at);
  const end = source.indexOf("\n  },\n", at) + "\n  },\n".length;
  let block = source.slice(start, end);

  if (change.effect) {
    const line = /^    effect: \{[^\n]*\},\n/m;
    if (!line.test(block)) throw new Error(`${card.id}: effect is not on one line.`);
    block = block.replace(line, `    // ${change.why}\n    effect: ${render(change.effect)},\n`);
  } else {
    const field = change.payoff ? "payoff" : change.standing ? "standing" : "restriction";
    const value = change.payoff ?? change.standing ?? change.restriction;
    block = block.replace(
      "    flavour:",
      `    // ${change.why}\n    ${field}: ${render(value)},\n    flavour:`,
    );
  }
  source = source.slice(0, start) + block + source.slice(end);
}

writeFileSync(path, source);
console.log(`Changed ${Object.keys(PLAN).length} mythics in ${path}.`);
