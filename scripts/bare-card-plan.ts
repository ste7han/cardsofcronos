// What every bare project card would get, before any of it is written.
//
// Ported from TCG's scripts/night-common-plan.ts, and the reason for its shape
// is the same one: an effect is easy to add and tiresome to argue with once it
// is in the data and the baseline has moved. So this file is the plan and the
// plan is this file. It prints the table to read, and `--apply` writes exactly
// what it printed into data/cards.ts. One map for both, so the document and the
// change cannot drift apart.
//
// THE SHAPE comes from the family's way of playing — see scripts/family-proposal.ts,
// which reads an intent off the flavour already on the cards. Community draws and
// heals, momentum pumps, money pays, takes takes.
//
// THE SIZE comes from what this set already carries at that rarity, measured
// rather than copied: a common pays $7K or $22K of budget, takes 5%, moves one
// holder, draws one card; a rare pays $27K or $45K, takes 8%, draws two. TCG's
// bands are two to three times larger because TCG rebalanced its whole set
// upward and this one has not been through that. Sizing to TCG here would put
// twenty-five cards a rebalance ahead of the hundred and twenty-seven beside
// them, which is the kind of gap nobody can see and everybody feels.
//
// WHICH of the family's two shapes a card gets comes from the card's own
// flavour. That is the only honest source available to somebody who did not
// write it.
//
// LOCKS ARE MISSING ON PURPOSE. Tectonic plays as locks, and a restriction does
// not scale down to a common — a tax on the cheapest tier is not a small lock,
// it is a different card. tectonic-i keeps its bare common and the note beside
// it says so, exactly as TCG left Firedancer, Kamino and Serum.
//
// Cards carrying a payoff are not in here. Fourteen of the forty that read as
// blank already say something; they just say it later. Adding an on-play effect
// to those is a balance change rather than a fill, and it belongs with the
// re-pointing pass, not this one.
//
//   npx tsx scripts/bare-card-plan.ts            # read it
//   npx tsx scripts/bare-card-plan.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Effect, ProjectCard } from "../engine/types";

type Intent = "community" | "momentum" | "money" | "takes" | "locks";

/** Every family's way of playing. From scripts/family-proposal.ts. */
const INTENT: Record<string, Intent> = {
  clove: "community",
  ffs: "community",
  monsters: "takes",
  caw: "momentum",
  dak: "takes",
  crooks: "community",
  obsidian: "money",
  tectonic: "locks",
  ferro: "money",
  wolfswap: "takes",
  vvs: "momentum",
  mmf: "money",
  robots: "momentum",
  howlers: "community",
  lions: "money",
  chimps: "community",
  nova: "momentum",
  cr00ts: "takes",
  minted: "money",
};

/**
 * The plan, card by card. `null` means left bare, with the reason beside it.
 *
 * Typed rather than written as source text. It was strings once and the check
 * further down had to `eval` them to compare what was planned against what is in
 * the set — a plan that can only be verified by running it is not much of a
 * plan, and a typo in one would have surfaced as a runtime error rather than a
 * red squiggle. `render` below turns these back into the line that goes in.
 */
const PLAN: Record<string, { effect: Effect | null; why: string }> = {
  // ---- meme -------------------------------------------------------------
  "clove-first": {
    effect: { kind: "drawCards", amount: 1 },
    why: "a ticker, a chart and a group chat — the chat is the whole of it",
  },
  "clove-listing": {
    effect: { kind: "drawCards", amount: 2 },
    why: "everybody screenshotted it, so everybody found it",
  },
  "ffs-sigh": {
    effect: { kind: "drawCards", amount: 1 },
    why: "named at four in the morning by somebody who was still there",
  },
  "monsters-hatch": {
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    why: "three z's, and it never checked whose side anybody was on",
  },
  "caw-first": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 2_000 },
    why: "somebody checked the address and there they were — the count starts",
  },
  "caw-triple": {
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 14_000 } },
    why: "seven in a row, and nobody could get the count to move past it",
  },
  "dak-first": {
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 1 },
    why: "the first one still sets the floor, and a floor is set by taking",
  },
  // ---- defi -------------------------------------------------------------
  "crooks-alone": {
    effect: { kind: "drawCards", amount: 1 },
    why: "no influencer would touch it, so whoever found it found it themselves",
  },
  "crooks-stack": {
    effect: { kind: "drawCards", amount: 2 },
    why: "a vault, then a router, then a thing nobody could explain quickly",
  },
  "obsidian-quiet": {
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    why: "no thread, no space, no partnership — just a contract that kept paying",
  },
  "tectonic-i": {
    effect: null,
    why: "Tectonic locks, and a restriction does not scale down to a common",
  },
  "ferro-i": {
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    why: "swapped for almost nothing, and almost nothing is still something",
  },
  "ferro-iii": {
    effect: { kind: "extraBudget", target: "self", mc: 45_000 },
    why: "the pool nobody watched, quietly funding the next thing",
  },
  "ferro-v": {
    effect: { kind: "extraBudget", target: "self", mc: 95_000 },
    why: "steady is a strategy — it pays, it just never trends",
  },
  "ferro-viii": {
    effect: { kind: "extraBudget", target: "self", mc: 200_000 },
    why: "nothing dramatic ever happened to it, which is the achievement",
  },
  // ---- dex --------------------------------------------------------------
  "wolfswap-pool": {
    effect: { kind: "stealMC", percentage: 5 },
    why: "eleven percent of slippage, and somebody was on the other side of it",
  },
  "vvs-i": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 2_000 },
    why: "very, very simple, and volume begets volume from there",
  },
  "mmf-i": {
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    why: "one meerkat on a rock, and it took a cut of everything from the start",
  },
  // ---- nft --------------------------------------------------------------
  "robots-bolt": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 2_000 },
    why: "shipped with a bug and shipped anyway, which is how momentum starts",
  },
  "robots-overclock": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 8_000 },
    why: "twice as hot for half as long, and everybody knew",
  },
  "howlers-first": {
    effect: { kind: "drawCards", amount: 1 },
    why: "two in the morning is when the pack is awake, and the pack turns up",
  },
  "lions-i": {
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    why: "a mane tells you which one you got, and which one you got is the money",
  },
  "chimps-ii": {
    effect: { kind: "drawCards", amount: 1 },
    why: "the Discord was busy before the mint and busier after it",
  },
  // ---- infra ------------------------------------------------------------
  "nova-spark": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 2_000 },
    why: "launched quietly on a Sunday, and everything it touched moved after",
  },
  "cr00ts-survive": {
    effect: { kind: "stealMC", percentage: 5 },
    why: "two percent nobody notices, still quoting a spread this morning",
  },
};

/**
 * An effect as it is written in data/cards.ts.
 *
 * JSON.stringify would do everything except the two things that matter: keys go
 * unquoted and thousands carry an underscore, because that is how every other
 * card in the file is written and a diff that does not look like its neighbours
 * is a diff nobody reads properly.
 */
function render(value: unknown): string {
  if (typeof value === "number") {
    return Math.abs(value) >= 1000 ? value.toLocaleString("en-US").replace(/,/g, "_") : String(value);
  }
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(render).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${render(v)}`).join(", ")} }`;
  }
  return String(value);
}

const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const byId = new Map(projects.map((c) => [c.id, c]));

// Every bare card is in the plan and everything in the plan is a bare card.
// Without both directions this drifts: a card that gains an effect elsewhere
// would be silently overwritten, and a renamed id would silently do nothing.
const bare = projects.filter(
  (c) => !c.effect && !c.payoff && !(c as { standing?: unknown }).standing && !c.restriction,
);
const planned = new Set(Object.keys(PLAN));
const missing = bare.filter((c) => !planned.has(c.id)).map((c) => c.id);
if (missing.length) throw new Error(`Bare cards with no plan: ${missing.join(", ")}`);

// A planned card that is no longer bare is either done or somebody else's now.
// Told apart rather than lumped together: this ran once and the set has the
// effects in it, so "not bare any more" is the ordinary state from here on and
// reading it as a failure would make the guard something to route around. What
// is NOT ordinary is a planned card carrying an effect this plan did not write,
// and that is the one that has to stop everything.
const done: string[] = [];
const contested: string[] = [];
for (const id of planned) {
  if (bare.some((c) => c.id === id)) continue;
  const card = byId.get(id);
  const want = PLAN[id]!.effect;
  if (card === undefined) {
    contested.push(`${id} (no longer in the set)`);
  } else if (want === null) {
    contested.push(`${id} (planned to stay bare and does not)`);
  } else if (JSON.stringify(card.effect) === JSON.stringify(want)) {
    done.push(id);
  } else {
    contested.push(`${id} (carries something this plan did not write)`);
  }
}
if (contested.length) {
  throw new Error(`Planned cards that are not bare and not what was planned: ${contested.join(", ")}`);
}

const apply = process.argv.includes("--apply");

if (done.length === planned.size - 1) {
  // Minus one for tectonic-i, which is planned to stay bare and therefore stays
  // in `bare` for ever. Everything else is written.
  console.log(
    `This plan has been applied: all ${done.length} effects are in data/cards.ts,\n` +
      `and tectonic-i is bare on purpose. The file is the record of what was done.\n` +
      `Nothing to do.`,
  );
  process.exit(0);
}

if (!apply) {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `${bare.length} bare project cards, and what each would get. The shape is the\n` +
      `family's way of playing; the size is what this set already carries there.\n`,
  );
  let sector = "";
  for (const card of [...bare].sort(
    (a, b) => a.sector.localeCompare(b.sector) || a.project.localeCompare(b.project),
  )) {
    if (card.sector !== sector) {
      sector = card.sector;
      console.log(`\n--- ${sector} ---`);
    }
    const { effect, why } = PLAN[card.id]!;
    console.log(
      `${pad(card.id, 18)}${pad(card.rarity, 10)}${pad(INTENT[card.project] ?? "?", 11)}` +
        `${effect === null ? "LEFT BARE" : render(effect)}\n${" ".repeat(18)}${why}`,
    );
  }
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

// Writing it in. The anchor is the card's own id line, and the effect goes in
// directly after `holders`, which is where every other card in the file carries
// it — a diff that reads like the rest of the file is a diff somebody can check.
const path = "data/cards.ts";
let source = readFileSync(path, "utf8");
let written = 0;

for (const card of bare) {
  const { effect, why } = PLAN[card.id]!;
  if (effect === null) continue;

  const anchor = `    id: "${card.id}",`;
  const at = source.indexOf(anchor);
  if (at < 0) throw new Error(`Could not find ${card.id} in ${path}.`);

  const holdersLine = `    holders: ${card.holders},\n`;
  const holdersAt = source.indexOf(holdersLine, at);
  if (holdersAt < 0 || holdersAt - at > 900) {
    throw new Error(`Could not find the holders line of ${card.id}.`);
  }
  const after = holdersAt + holdersLine.length;
  source =
    source.slice(0, after) +
    `    // ${why}\n    effect: ${render(effect)},\n` +
    source.slice(after);
  written++;
}

writeFileSync(path, source);
console.log(`Wrote ${written} effects into ${path}.`);
