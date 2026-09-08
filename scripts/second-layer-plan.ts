// The second thing every project card is missing.
//
// Measured, not guessed. Events, tactics and influencers already carry what
// TCG's do — 1.05, 1.18 and 1.56 rules a card against its 1.05, 1.18 and 1.32.
// The projects do not: 1.08 against 1.53, and that gap over 152 cards is about
// sixty rules. It is what makes a card read as empty on screen. One thin line
// and then a hand's width of nothing before the flavour.
//
// The engine that came over knows far more than the set says. Fifteen of the
// eighteen things a project card can carry are unused here — toll, tip, oracle,
// leverage, shield, uptime, discount, severance, loyalty, morePositions,
// freePlays, onTheirPlay, onYourPlay, mutual, standing — along with twelve of
// the twenty-nine effect kinds, twelve of the seventeen conditions and three of
// the four restrictions. The vocabulary arrived with the port and nothing spoke
// it.
//
// WHAT GOES WHERE comes from the flavour already on the card, which keeps being
// the only honest source. Some of it is uncanny: Tectonic is "supply something,
// borrow against it" and `leverage` multiplies every move of your own market cap
// both ways; Cr00ts is "two percent nobody notices" and `toll` takes a cut of
// everything they gain; Loaded Lions is "two cycles in and the floor is still
// where the floor was" and `loyalty` pays more for every turn a position has
// stood. Those three wrote themselves.
//
// THE SIZES ARE TCG'S, unchanged. The two sets run on the same card economy —
// median launch and pump per rarity are 15/25/39/68/112K there and 15/26/40/67/110K
// here — so a toll of 5% or a shield of 38 means the same thing in both. That is
// not true of the effect layer, where TCG's numbers are two to three times
// larger; that is a separate gap and this plan does not touch it.
//
// HOW MANY, per family of eight, is TCG's own spread rather than a target picked
// to look full: one exotic, roughly one payoff, half a standing, half a
// restriction. Nineteen exotics, seventeen payoffs, twelve standings and four
// restrictions is what that comes to, and it takes the projects from 1.08 to
// about 1.42.
//
//   npx tsx scripts/second-layer-plan.ts            # read it
//   npx tsx scripts/second-layer-plan.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Condition, Effect, ProjectCard, Restriction } from "../engine/types";

/** One added field, and why that card. */
interface Addition {
  field:
    | "standing"
    | "payoff"
    | "restriction"
    | "toll"
    | "onTheirPlay"
    | "onYourPlay"
    | "tip"
    | "oracle"
    | "morePositions"
    | "leverage"
    | "shield"
    | "uptime"
    | "discount"
    | "severance"
    | "freePlays"
    | "loyalty";
  value: unknown;
  why: string;
}

const pay = (when: Condition, effect: Effect) => ({ when, effect });

const PLAN: Record<string, Addition> = {
  // ---- clove — community ------------------------------------------------
  "clove-listing": {
    field: "payoff",
    value: pay({ kind: "turnAtLeast", turn: 5 }, { kind: "directMC", target: "self", mc: 70_000 }),
    why: "one exchange nobody had heard of, and everybody screenshotted it — later",
  },
  "clove-carried": {
    field: "loyalty",
    value: 34,
    why: "everyone who was early stayed early, and that was the trick",
  },
  "clove-still": {
    field: "standing",
    value: { kind: "healHolders", target: "allOwnProjects", amount: 1 } as Effect,
    why: "two cycles later the chat is still open, and it still keeps people in",
  },

  // ---- crooks — community -----------------------------------------------
  "crooks-cover": {
    field: "payoff",
    value: pay(
      { kind: "holdersLostAtLeast", holders: 3 },
      { kind: "directMC", target: "self", mc: 120_000 },
    ),
    why: "whatever came for you, it came for the whole book at once",
  },
  "crooks-audit": {
    field: "onTheirPlay",
    value: { cardType: "project", mc: 34_000 },
    why: "two weeks of silence, then a PDF, then the deposits doubled",
  },
  "crooks-book": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 105_000 } as Effect,
    why: "everything routed through it eventually, whether it meant to or not",
  },

  // ---- wolfswap — takes --------------------------------------------------
  "wolfswap-hunt": {
    field: "standing",
    value: { kind: "damageHolders", target: "enemyBest", amount: 1 } as Effect,
    why: "anything thinner than its own book got quoted out of existence",
  },
  "wolfswap-fees": {
    field: "tip",
    value: 20,
    why: "volume was the product and the token was the receipt — a cut of what they spend",
  },
  "wolfswap-liquidity": {
    field: "restriction",
    // A restriction sat on the rare above until TCG's own spread was checked:
    // it has thirteen of them and not one below epic. A standing rule on the
    // other side of the table is the heaviest thing a card can carry, and the
    // cheap tiers are not where it goes.
    value: { kind: "taxPlays", percent: 13 } as Restriction,
    why: "the other pool did not close; it just stopped being quoted",
  },

  // ---- robots — momentum -------------------------------------------------
  "robots-fleet": {
    field: "payoff",
    value: pay({ kind: "ownProjectCount", atLeast: 4 }, { kind: "directMC", target: "self", mc: 60_000 }),
    why: "one is a toy, four hundred is an argument",
  },
  "robots-selfrepair": {
    field: "shield",
    value: 38,
    why: "came back online with a different serial number and the same wallet",
  },

  // ---- howlers — community -----------------------------------------------
  "howlers-moon": {
    field: "payoff",
    value: pay({ kind: "turnAtLeast", turn: 6 }, { kind: "directMC", target: "self", mc: 55_000 }),
    why: "once a month the floor moved and nobody had a reason for it",
  },
  "howlers-lowest": {
    field: "standing",
    value: { kind: "healHolders", target: "allOwnProjects", amount: 1 } as Effect,
    why: "the pack moves at the speed of its slowest, which is the whole idea",
  },
  "howlers-pack": {
    field: "morePositions",
    value: 3,
    why: "they stopped counting holders and started counting who showed up",
  },

  // ---- ffs — community ---------------------------------------------------
  "ffs-damage": {
    field: "payoff",
    value: pay({ kind: "holdersLostAtLeast", holders: 2 }, { kind: "healHolders", target: "allOwnProjects", amount: 2 }),
    why: "whatever came in, it stood in front of it, every single time",
  },
  "ffs-martyr": {
    field: "freePlays",
    value: 2,
    why: "the wallet hit zero and the token did its best week ever — it pays for yours",
  },

  // ---- monsters — takes --------------------------------------------------
  "monsters-swarm": {
    field: "payoff",
    value: pay({ kind: "theirHandAtMost", cards: 3 }, { kind: "damageHolders", target: "allEnemyProjects", amount: 1 }),
    why: "ten thousand of them and every single one is somebody's favourite",
  },
  "monsters-mutate": {
    field: "standing",
    value: { kind: "damageHolders", target: "enemyBest", amount: 1 } as Effect,
    why: "traits nobody drew started showing up in the metadata",
  },
  "monsters-carnage": {
    field: "oracle",
    value: 7,
    why: "both floors halved in a night and the Discord had never been busier",
  },

  // ---- nova — momentum ---------------------------------------------------
  "nova-draw": {
    field: "payoff",
    value: pay({ kind: "ownProjectsInSector", sector: "infra", atLeast: 2 }, { kind: "pumpProject", target: "allOwnProjects", mc: 8_000 }),
    why: "whatever you were building, there was a Nova thing that plugged in",
  },
  "nova-suite": {
    field: "morePositions",
    value: 2,
    why: "six products, one login, and a roadmap that actually shipped",
  },
  "nova-standard": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 105_000 } as Effect,
    why: "nobody voted for it; everybody integrated it",
  },

  // ---- cr00ts — takes ----------------------------------------------------
  "cr00ts-toll": {
    field: "toll",
    value: { percentage: 5 },
    why: "two percent nobody notices is a business nobody complains about",
  },
  "cr00ts-small": {
    field: "payoff",
    value: pay({ kind: "aheadBy", mc: 200_000 }, { kind: "stealMC", percentage: 8 }),
    why: "never the whale, always the forty wallets nobody was watching",
  },
  "cr00ts-spread": {
    field: "restriction",
    value: { kind: "taxPlays", percent: 12 } as Restriction,
    why: "same screen, same button, four percent worse, for eleven months",
  },

  // ---- obsidian — money --------------------------------------------------
  "obsidian-nobody": {
    field: "payoff",
    value: pay({ kind: "bankedAtMost", count: 1 }, { kind: "directMC", target: "self", mc: 90_000 }),
    why: "nine figures locked and the outflow chart is a flat line, proudly",
  },
  "obsidian-glass": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 74_000 } as Effect,
    why: "volcanic, and it takes an edge nothing else on the chain can hold",
  },
  "obsidian-unbroken": {
    field: "shield",
    value: 50,
    why: "three years, four bear markets, and the floor never once broke",
  },

  // ---- caw — momentum ----------------------------------------------------
  "caw777-seventh": {
    field: "payoff",
    value: pay({ kind: "turnAtLeast", turn: 7 }, { kind: "pumpProject", target: "allOwnProjects", mc: 9_000 }),
    why: "a week to the hour, and it did the whole thing again",
  },
  "caw777-streak": {
    field: "onYourPlay",
    value: { mc: 30_000 },
    why: "seven in a row — every one of them counted",
  },
  "caw777-triple": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 105_000 } as Effect,
    why: "it stopped there, and nobody could get the count to move past it",
  },

  // ---- dak — takes -------------------------------------------------------
  "dak-trade": {
    field: "payoff",
    value: pay({ kind: "bankedAtLeast", count: 2 }, { kind: "stealMC", percentage: 10 }),
    why: "dumped the small one to buy more of the big one, and it worked twice",
  },
  "dak-troop": {
    field: "severance",
    value: { percentage: 55, from: "theirs" },
    why: "they came down the timeline together and something stopped existing",
  },

  // ---- vvs — momentum ----------------------------------------------------
  "vvs-iv": {
    field: "payoff",
    value: pay({ kind: "turnAtMost", turn: 4 }, { kind: "extraBudget", target: "self", mc: 60_000 }),
    why: "the fees were the moat and nobody undercut it for two years",
  },
  "vvs-vii": {
    field: "discount",
    value: 32,
    why: "the front door of the chain, whether or not it meant to be",
  },

  // ---- mmf — money -------------------------------------------------------
  "mmf-v": {
    field: "payoff",
    value: pay({ kind: "discardAtLeast", count: 4 }, { kind: "directMC", target: "self", mc: 80_000 }),
    why: "somebody worked out the buyback was bigger than the emissions",
  },
  "mmf-vii": {
    field: "toll",
    value: { percentage: 12 },
    why: "the buyback ran on a timer and the chart knew what time it was",
  },

  // ---- tectonic — locks --------------------------------------------------
  "tectonic-vi": {
    field: "leverage",
    value: 24,
    why: "supply something, borrow against it, try not to think about it",
  },
  "tectonic-v": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 74_000 } as Effect,
    why: "everything on the chain ended up posted here as collateral",
  },
  "tectonic-viii": {
    field: "restriction",
    value: { kind: "banTakeProfit" } as Restriction,
    why: "solvent through every drawdown anybody on this chain remembers",
  },

  // ---- ferro — money -----------------------------------------------------
  "ferro-iv": {
    field: "payoff",
    value: pay({ kind: "playedThisTurnAtLeast", cards: 2 }, { kind: "extraBudget", target: "self", mc: 50_000 }),
    why: "underneath the venues, quoting the boring half of every trade",
  },
  "ferro-vi": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 74_000 } as Effect,
    why: "it held its peg through the week everything else did not",
  },
  "ferro-vii": {
    field: "uptime",
    value: true,
    why: "every route that mattered had one of its pools in the middle",
  },

  // ---- lions — money -----------------------------------------------------
  "lions-iv": {
    field: "payoff",
    // targetHeldFor was the first answer and validateSet refused it: that
    // condition asks about "that project" and this payoff aims at nobody, so
    // there is no project to ask about and it could never have fired. Not
    // holding is the same idea said in terms the card can actually check.
    value: pay({ kind: "bankedAtMost", count: 1 }, { kind: "directMC", target: "self", mc: 65_000 }),
    why: "the floor moved slowly in both directions, which suited everybody",
  },
  "lions-v": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 74_000 } as Effect,
    why: "the one collection everybody could name without checking",
  },
  "lions-vii": {
    field: "loyalty",
    value: 40,
    why: "blue chip is a thing people call you; nobody applies for it",
  },

  // ---- chimps — community ------------------------------------------------
  "chimps-iii": {
    field: "payoff",
    value: pay({ kind: "yourHandAtLeast", cards: 4 }, { kind: "drawCards", amount: 2 }),
    why: "somebody in there knew somebody who knew about everything",
  },
  "chimps-viii": {
    field: "morePositions",
    value: 3,
    why: "everybody who is anybody here was in that room in the first month",
  },

  // ---- minted — money ----------------------------------------------------
  "minted-iv": {
    field: "payoff",
    value: pay({ kind: "ownProjectCount", atLeast: 4 }, { kind: "directMC", target: "self", mc: 70_000 }),
    why: "every collection needed it and none of them owned it",
  },
  "minted-v": {
    field: "standing",
    value: { kind: "directMC", target: "self", mc: 74_000 } as Effect,
    why: "the front page decided what a good week looked like",
  },
  "minted-vi": {
    field: "severance",
    value: { percentage: 26, from: "both" },
    why: "royalties were optional and it kept collecting them anyway",
  },
  "minted-viii": {
    field: "restriction",
    // Banning projects was the first answer and validateSet refused it: a player
    // who cannot play a project cannot score, so that card is not a card, it is
    // the end of the match with extra steps. Tools are what people find things
    // with, and this card is about a thing nobody can find.
    value: { kind: "banType", cardType: "tool" } as Restriction,
    why: "two names off the front page and a market that forgets by Friday",
  },
};

/**
 * A value as it is written in data/cards.ts.
 *
 * Keys unquoted and thousands with an underscore, because that is how every
 * other card in the file is written and a diff that does not look like its
 * neighbours is a diff nobody reads properly.
 */
function render(value: unknown): string {
  if (typeof value === "number") {
    return Math.abs(value) >= 1000
      ? value.toLocaleString("en-US").replace(/,/g, "_")
      : String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(render).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${render(v)}`)
      .join(", ")} }`;
  }
  return String(value);
}

const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const byId = new Map(projects.map((c) => [c.id, c]));

// Every planned card exists and does not already carry the field. Both
// directions, because a renamed id would silently do nothing and a field that
// arrived some other way would be silently doubled.
const done: string[] = [];
const problems: string[] = [];
for (const [id, add] of Object.entries(PLAN)) {
  const card = byId.get(id) as (ProjectCard & Record<string, unknown>) | undefined;
  if (card === undefined) {
    problems.push(`${id} is not a project card in this set`);
  } else if (card[add.field] !== undefined) {
    done.push(id);
  }
}
if (problems.length) throw new Error(problems.join("; "));

const apply = process.argv.includes("--apply");

if (done.length === Object.keys(PLAN).length) {
  console.log(
    `This plan has been applied: all ${done.length} additions are in data/cards.ts.\n` +
      `The file is the record of what was done. Nothing to do.`,
  );
  process.exit(0);
}
if (done.length > 0 && !apply) {
  console.log(`Already applied to ${done.length} of ${Object.keys(PLAN).length}. The rest:\n`);
}

if (!apply) {
  const counts = new Map<string, number>();
  for (const a of Object.values(PLAN)) counts.set(a.field, (counts.get(a.field) ?? 0) + 1);
  console.log(
    `${Object.keys(PLAN).length} additions across ${
      new Set(Object.keys(PLAN).map((id) => byId.get(id)!.project)).size
    } families.\n`,
  );
  let family = "";
  for (const [id, add] of Object.entries(PLAN)) {
    const card = byId.get(id)!;
    if (card.project !== family) {
      family = card.project;
      console.log(`\n--- ${card.name} (${card.sector}) ---`);
    }
    console.log(
      `${id.padEnd(20)}${card.rarity.padEnd(10)}${add.field.padEnd(14)}${render(add.value)}`,
    );
    console.log(`${" ".repeat(20)}${add.why}`);
  }
  console.log(`\nby mechanic:`);
  for (const [f, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f.padEnd(16)}${n}`);
  }
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

// The field goes in after `holders`, where every other card carries its extras.
const path = "data/cards.ts";
let source = readFileSync(path, "utf8");
let written = 0;

for (const [id, add] of Object.entries(PLAN)) {
  const card = byId.get(id)! as ProjectCard & Record<string, unknown>;
  if (card[add.field] !== undefined) continue;

  const anchor = `    id: "${id}",`;
  const at = source.indexOf(anchor);
  if (at < 0) throw new Error(`Could not find ${id} in ${path}.`);

  const holdersLine = `    holders: ${card.holders},\n`;
  const holdersAt = source.indexOf(holdersLine, at);
  if (holdersAt < 0 || holdersAt - at > 900) {
    throw new Error(`Could not find the holders line of ${id}.`);
  }
  const after = holdersAt + holdersLine.length;
  source =
    source.slice(0, after) +
    `    // ${add.why}\n    ${add.field}: ${render(add.value)},\n` +
    source.slice(after);
  written++;
}

writeFileSync(path, source);
console.log(`Wrote ${written} additions into ${path}.`);
