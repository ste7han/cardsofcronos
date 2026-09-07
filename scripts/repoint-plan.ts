// The cards that play against their own family, re-pointed.
//
// scripts/family-proposal.ts reads one way of playing off each family's flavour
// and then counts how many of its eight cards actually point that way. Sixty-six
// do not. This is the expensive half of that report: the bare cards were free to
// fill, and these already do something — something else.
//
// It is also where the rest of the ported vocabulary finally speaks. Twelve
// effect kinds arrived with the engine and nothing used them; all twelve are in
// here, on the cards whose flavour was already describing them:
//
//   merge          Reckless Robots VIII — every unit back to the workshop
//   fork           Nova VIII — the screenshot that started three hundred copycats
//   benchmark      Nova III — whatever you were building, there was a Nova thing
//   burnForDamage  DAK III — dumped the small one to buy more of the big one
//   attach         Reckless Robots VII — came back online, and kept coming back
//   peekAndBurn    Wolfswap IV — volume was the product, the token was the receipt
//   mcPerHolderLost   Obsidian II — whatever came for the small deposits
//   mcPerPositionGone Tectonic VI — a cascade does not ask which position it liked
//   unbankedMC     Obsidian IV — nine figures locked and the outflow chart is flat
//   peakMC         Obsidian VI — it takes an edge nothing else can hold
//   budgetToMC     Mad Meerkat V — the buyback was bigger than the emissions
//   recoverCard    Clove VII — a group chat that never slept
//   discardCards   Crazzzy Monsters III — it did not check whose side anybody was on
//
// TECTONIC IS NOT ALL RESTRICTIONS, and that is read off TCG rather than
// invented. Its three locks families — Kamino, Serum, Firedancer — carry money
// effects on nearly every card and put the lock in the second layer: a shield, an
// uptime, a ban on one card type. Kamino's eight are budget, market cap, market
// cap, market cap, market cap, a steal and two more, every one of them under a
// standing shield. So Tectonic's effects become money and its character stays in
// the leverage, the shield and the banTakeProfit it already carries.
//
// WHAT THIS COSTS is character, not balance. TCG did the same pass over its own
// set and measured it: about one point per themed deck, against a forty-point
// spread between the strongest theme and the weakest. The reason to do it is that
// a family whose eight cards point five different ways is eight cards that happen
// to share a ticker.
//
// WATCH THE SECTORS. A family that stops playing momentum stops pumping its
// sector, and this game has nineteen families where TCG has sixty-five — defi in
// particular has no momentum family at all, so it can lose its sector synergy
// without anybody noticing. Counted before and after, and the note at the bottom
// of the run prints it.
//
//   npx tsx scripts/repoint-plan.ts            # read it
//   npx tsx scripts/repoint-plan.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Effect, ProjectCard } from "../engine/types";
import { effectIntentFor, intentOfEffect } from "./intent";


const PLAN: Record<string, { effect: Effect; why: string }> = {
  // ---- clove — community -------------------------------------------------
  "clove-season": {
    effect: { kind: "drawCards", amount: 2 },
    why: "for about nine days it was the only chart anybody had open",
  },
  "clove-product": {
    effect: { kind: "recoverCard", amount: 1 },
    why: "there was never a roadmap; there was a group chat that never slept",
  },
  "clove-still": {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    why: "two cycles later the chat is still open and still arguing",
  },

  // ---- crooks — community ------------------------------------------------
  "crooks-audit": {
    effect: { kind: "drawCards", amount: 2 },
    why: "two weeks of silence, then a PDF, then the deposits doubled",
  },
  "crooks-book": {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    why: "everything routed through it eventually, whether it meant to or not",
  },

  // ---- wolfswap — takes --------------------------------------------------
  "wolfswap-fees": {
    effect: { kind: "peekAndBurn", look: 3 },
    why: "volume was the product and the token was the receipt — you see what is coming",
  },

  // ---- robots — momentum -------------------------------------------------
  "robots-coinflip": {
    effect: { kind: "pumpProject", target: "ownProject", mc: 12_000 },
    why: "heads it works, tails it also sort of works",
  },
  "robots-recall": {
    effect: { kind: "benchmark", target: "ownProject", plus: 15_000 },
    why: "every unit, both sides of the table, back to the workshop",
  },
  "robots-selfrepair": {
    effect: {
      kind: "attach",
      target: "ownProject",
      every: { kind: "scalePump", target: "ownProject", percentage: 25 },
    },
    why: "came back online with a different serial number and the same wallet",
  },
  "robots-detonate": {
    effect: { kind: "merge" },
    why: "ten percent chance, they said — and everything ends up in one place",
  },

  // ---- howlers — community -----------------------------------------------
  "howlers-moon": {
    effect: { kind: "drawCards", amount: 2 },
    why: "once a month the floor moved and nobody had a reason for it",
  },
  "howlers-mirror": {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    why: "whatever the other side did, it turned up in the pack a week later",
  },
  "howlers-night": {
    effect: { kind: "drawCards", amount: 2 },
    why: "eight months of nothing and the group chat never went quiet once",
  },
  "howlers-pack": {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    why: "they stopped counting holders and started counting who showed up",
  },
  "howlers-inversion": {
    effect: { kind: "recoverCard", amount: 2 },
    why: "the chart flipped, and for one evening every loser was a genius",
  },

  // ---- ffs — community ---------------------------------------------------
  "ffs-tithe": {
    effect: { kind: "drawCards", amount: 1 },
    why: "sold its own bag to fund a marketing wallet for everyone else",
  },
  "ffs-bleed": {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 2 },
    why: "down eighty percent and still funding the others, on purpose",
  },
  "ffs-martyr": {
    effect: { kind: "drawCards", amount: 4 },
    why: "the wallet hit zero and the token did its best week ever",
  },

  // ---- monsters — takes --------------------------------------------------
  "monsters-loose": {
    // The last effect kind in the engine that nothing spoke. It went here rather
    // than somewhere it would merely fit: "both" is the whole card, and this is
    // the only effect in the set that costs the player holding it something.
    // Monsters had six damageHolders in a row before this; a family of one card
    // at eight prices is what the family work is against.
    effect: { kind: "discardCards", target: "both", amount: 1 },
    why: "it did not check whose side anybody was on, and it never has",
  },
  "monsters-mutate": {
    effect: { kind: "damageHolders", target: "allEnemyProjects", amount: 2 },
    why: "traits nobody drew started showing up in the metadata",
  },

  // ---- nova — momentum ---------------------------------------------------
  "nova-draw": {
    effect: { kind: "benchmark", target: "ownProject" },
    why: "whatever you were building, there was a Nova thing that plugged in",
  },
  "nova-everything": {
    effect: { kind: "fork" },
    why: "the wallet screenshot that started three hundred copycat threads",
  },

  // ---- cr00ts — takes ----------------------------------------------------
  "cr00ts-reflect": {
    effect: { kind: "burnForDamage", target: "ownProject", keep: 130 },
    why: "whatever you sent at it turned up in your own book by Friday",
  },

  // ---- obsidian — money, and it counts -----------------------------------
  "obsidian-guard": {
    effect: { kind: "mcPerHolderLost", mc: 3_000 },
    why: "whatever came for the small deposits had to come through it first",
  },
  "obsidian-nobody": {
    effect: { kind: "unbankedMC", percentage: 20 },
    why: "nine figures locked and the outflow chart is a flat line, proudly",
  },
  "obsidian-glass": {
    effect: { kind: "peakMC", percentage: 12 },
    why: "volcanic, and it takes an edge nothing else on the chain can hold",
  },
  "obsidian-unbroken": {
    effect: { kind: "scaleMC", target: "self", percentage: 16 },
    why: "three years, four bear markets, and the floor never once broke",
  },

  // ---- caw — momentum ----------------------------------------------------
  "caw-lucky": {
    effect: { kind: "pumpProject", target: "ownProject", mc: 12_000 },
    why: "block seven-seven-seven-seven, and the screenshot did numbers",
  },
  "caw-seventh": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    why: "a week to the hour, and it did the whole thing again",
  },
  "caw-counting": {
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { meme: 8_000 } },
    why: "the chat found sevens in the supply, the fee and the founder's age",
  },
  "caw-sevens": {
    effect: { kind: "scalePump", target: "allOwnProjects", percentage: 45 },
    why: "seven sevens on one screen; two people printed it and framed it",
  },

  // ---- dak — takes -------------------------------------------------------
  "dak-trade": {
    effect: { kind: "burnForDamage", target: "ownProject", keep: 45 },
    why: "dumped the small one to buy more of the big one, and it worked twice",
  },

  // ---- vvs — momentum ----------------------------------------------------
  "vvs-ii": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 2_000 },
    why: "emissions on everything; for a while the yield was the product",
  },
  "vvs-iii": {
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { dex: 8_000 } },
    why: "every pair anybody wanted, and a few nobody did",
  },
  "vvs-iv": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    why: "the fees were the moat; nobody undercut it for two years",
  },
  "vvs-vi": {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 15_000 },
    why: "volume begets volume — that is the whole business and it is enough",
  },
  "vvs-viii": {
    effect: { kind: "scalePump", target: "allOwnProjects", percentage: 50 },
    why: "deep enough that size stopped mattering",
  },

  // ---- mmf — money, on a timer -------------------------------------------
  "mmf-ii": {
    effect: { kind: "extraBudget", target: "self", mc: 22_000 },
    why: "it took a cut of everything and told you it was taking it",
  },
  "mmf-iii": {
    effect: { kind: "directMC", target: "self", mc: 27_000 },
    why: "the mob arrived at whatever was moving and left with the spread",
  },
  "mmf-iv": {
    effect: { kind: "extraBudget", target: "self", mc: 45_000 },
    why: "a DEX, a launchpad, an NFT line and a burn — all at once, loudly",
  },
  "mmf-v": {
    effect: { kind: "budgetToMC", percentage: 40 },
    why: "somebody worked out the buyback was bigger than the emissions",
  },
  "mmf-vi": {
    effect: { kind: "scaleMC", target: "self", percentage: 13 },
    why: "half a serious venue and half a meme, and it never picked one",
  },
  "mmf-vii": {
    effect: { kind: "directMC", target: "self", mc: 22_000, per: "turn" },
    why: "the buyback ran on a timer and the chart knew what time it was",
  },
  "mmf-viii": {
    effect: { kind: "scaleMC", target: "self", percentage: 16 },
    why: "the whole mob at once, and nothing else on the chain that loud",
  },

  // ---- tectonic — money under a lock -------------------------------------
  "tectonic-ii": {
    effect: { kind: "extraBudget", target: "self", mc: 22_000 },
    why: "the health factor is a number you check more than you admit",
  },
  "tectonic-iii": {
    effect: { kind: "scaleMC", target: "self", percentage: 7 },
    why: "somebody's collateral goes first when the whole market moves",
  },
  "tectonic-iv": {
    effect: { kind: "directMC", target: "self", mc: 27_000 },
    why: "top it up before it tops you up — that is the whole discipline",
  },
  "tectonic-v": {
    effect: { kind: "directMC", target: "self", mc: 12_000, per: "holders" },
    why: "everything on the chain ended up posted here as collateral",
  },
  "tectonic-vi": {
    effect: { kind: "mcPerPositionGone", mc: 34_000 },
    why: "a cascade does not ask which position it liked best",
  },
  "tectonic-vii": {
    effect: { kind: "scaleMC", target: "self", percentage: 16 },
    why: "the biggest book on the chain, and the quietest one about it",
  },
  "tectonic-viii": {
    effect: { kind: "scaleMC", target: "self", percentage: 20 },
    why: "solvent through every drawdown anybody on this chain remembers",
  },

  // ---- ferro — money, underneath everything ------------------------------
  "ferro-ii": {
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    why: "slippage measured in basis points, and it stayed there",
  },
  "ferro-iv": {
    effect: { kind: "directMC", target: "self", mc: 9_000, per: "any" },
    why: "underneath the venues, quoting the boring half of every trade",
  },
  "ferro-vi": {
    effect: { kind: "refundMC", percentage: 30 },
    why: "it held its peg through the week everything else did not",
  },
  "ferro-vii": {
    effect: { kind: "directMC", target: "self", mc: 20_000, per: "table" },
    why: "every route that mattered had one of its pools in the middle",
  },

  // ---- lions — money, and the floor holds --------------------------------
  "lions-iii": {
    effect: { kind: "scaleMC", target: "self", percentage: 7 },
    why: "holding one got you into rooms, and that was most of the point",
  },
  "lions-iv": {
    effect: { kind: "extraBudget", target: "self", mc: 45_000 },
    why: "the floor moved slowly in both directions, which suited everybody",
  },
  "lions-v": {
    effect: { kind: "peakMC", percentage: 12 },
    why: "the one collection everybody could name without checking",
  },
  "lions-vii": {
    effect: { kind: "scaleMC", target: "self", percentage: 14 },
    why: "blue chip is a thing people call you; nobody applies for it",
  },
  "lions-viii": {
    effect: { kind: "scaleMC", target: "self", percentage: 18 },
    why: "two cycles in and the floor is still where the floor was",
  },

  // ---- chimps — community ------------------------------------------------
  "chimps-iv": {
    effect: { kind: "drawCards", amount: 2 },
    why: "half the projects on this chain started in somebody's chimp chat",
  },

  // ---- minted — money, a cut of everything -------------------------------
  "minted-i": {
    effect: { kind: "directMC", target: "self", mc: 7_000 },
    why: "a list, a filter and a buy button — somebody has to make one",
  },
  "minted-iii": {
    effect: { kind: "extraBudget", target: "self", mc: 45_000 },
    why: "delisted is not destroyed; it is worse — nobody can find it",
  },
  "minted-iv": {
    effect: { kind: "directMC", target: "self", mc: 9_000, per: "any" },
    why: "every collection needed it and none of them owned it",
  },
  "minted-v": {
    effect: { kind: "directMC", target: "self", mc: 12_000, per: "plays" },
    why: "the front page decided what a good week looked like",
  },
  "minted-vii": {
    effect: { kind: "scaleMC", target: "self", percentage: 14 },
    why: "the venue outlasts everything it lists — that is always true",
  },
  "minted-viii": {
    effect: { kind: "directMC", target: "self", mc: 20_000, per: "theirs" },
    why: "two names off the front page and a market that forgets by Friday",
  },
};

/** A value as it is written in data/cards.ts: keys unquoted, thousands with an underscore. */
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

// Everything planned is a card that exists, carries an effect already, and is
// being pointed at its own family. The last one is the check that matters: a
// plan entry that does not move a card into its family's intent is a mistake in
// this file, and it would be invisible the moment it is applied.
const done: string[] = [];
const problems: string[] = [];
for (const [id, entry] of Object.entries(PLAN)) {
  const card = byId.get(id);
  if (card === undefined) {
    problems.push(`${id} is not a project card in this set`);
    continue;
  }
  const want = effectIntentFor(card.project);
  if (want === undefined) problems.push(`${id}: no intent for family ${card.project}`);
  else if (intentOfEffect(entry.effect) !== want) {
    problems.push(
      `${id}: the new effect reads as ${intentOfEffect(entry.effect)} and ${card.project} plays as ${want}`,
    );
  }
  if (card.effect && JSON.stringify(card.effect) === JSON.stringify(entry.effect)) done.push(id);
}
if (problems.length) throw new Error(problems.join("\n  "));

const apply = process.argv.includes("--apply");

if (done.length === Object.keys(PLAN).length) {
  console.log(
    `This plan has been applied: all ${done.length} cards carry what it printed.\n` +
      `The file is the record of what was done. Nothing to do.`,
  );
  process.exit(0);
}

/** How many cards pump each sector — the thing this pass can quietly destroy. */
function sectorPumps(cards: readonly ProjectCard[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of cards) {
    if (c.effect?.kind !== "pumpBySector") continue;
    for (const s of Object.keys(c.effect.bonuses)) out.set(s, (out.get(s) ?? 0) + 1);
  }
  return out;
}

if (!apply) {
  console.log(`${Object.keys(PLAN).length} cards re-pointed at their own family.\n`);
  let family = "";
  for (const [id, entry] of Object.entries(PLAN)) {
    const card = byId.get(id)!;
    if (card.project !== family) {
      family = card.project;
      console.log(`\n--- ${card.name} → ${effectIntentFor(family)} ---`);
    }
    console.log(`${id.padEnd(20)}${card.rarity.padEnd(10)}${render(card.effect)}`);
    console.log(`${" ".repeat(20)}becomes  ${render(entry.effect)}`);
    console.log(`${" ".repeat(20)}${entry.why}`);
  }

  const before = sectorPumps(projects);
  const after = sectorPumps(
    projects.map((c) => (PLAN[c.id] ? { ...c, effect: PLAN[c.id]!.effect } : c)),
  );
  console.log(`\nsector pumps, before → after:`);
  for (const s of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(s) ?? 0;
    const a = after.get(s) ?? 0;
    console.log(`  ${s.padEnd(7)}${String(b).padStart(3)} → ${String(a).padStart(3)}${a === 0 ? "   <- NOTHING PUMPS IT ANY MORE" : ""}`);
  }
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");
let written = 0;

for (const [id, entry] of Object.entries(PLAN)) {
  const card = byId.get(id)!;
  if (JSON.stringify(card.effect) === JSON.stringify(entry.effect)) continue;

  const at = source.indexOf(`    id: "${id}",`);
  if (at < 0) throw new Error(`Could not find ${id} in ${path}.`);

  // The effect line, however many lines it currently spans: from `effect:` to
  // the line whose indent returns to four spaces.
  const from = source.indexOf("    effect:", at);
  if (from < 0 || from - at > 1500) throw new Error(`Could not find the effect of ${id}.`);
  let to = from;
  const lines = source.slice(from).split("\n");
  let depth = 0;
  for (const line of lines) {
    to += line.length + 1;
    depth += (line.match(/[{[]/g) ?? []).length - (line.match(/[}\]]/g) ?? []).length;
    if (depth <= 0) break;
  }
  source =
    source.slice(0, from) +
    `    // ${entry.why}\n    effect: ${render(entry.effect)},\n` +
    source.slice(to);
  written++;
}

writeFileSync(path, source);
console.log(`Re-pointed ${written} cards in ${path}.`);
