// Drawing a card is not a winning move in this game, and now there is a number.
//
// The question was whether "draw a card" can pay for itself here at all, and the
// engine answers before any simulation does: drawToFull refills a hand to five at
// the start of your turn, so a card you draw now is a card you do not draw next
// turn. Measured over 10,260 turns:
//
//   cards in hand when a turn ends   3.26   against a top-up to 5
//   turns ending above five in hand    5%   the only case a draw is not refunded
//   plays used per turn              2.24   out of three
//   budget left when a turn ends     $52K
//
// So the binding constraint is not cards. It is not actions either. Ninety-five
// percent of the time a drawn card is borrowed against your own next turn, and
// you paid an action and a price to borrow it.
//
// Confirmed on the outcome rather than the mechanism: deleting every drawCards
// effect from the set — leaving those cards doing literally nothing — moves the
// community families from 38.6% to 39.7%. The cards are worth less than blank.
//
// HEALING AND RECOVERING ARE NOT MUCH BETTER. A heal is dead 45-70% of the time
// depending on who is across the table, because nothing is damaged until somebody
// attacks; a recover on a common finds an empty discard half the time. All three
// of community's shapes cost an action and mostly return nothing.
//
// THIS WAS TRIED ONCE AND FAILED, and the reason is worth keeping. The same swap
// was made earlier and cost nine points, so it was reverted. It was made against
// the money numbers as they were then — before scripts/rescale-build.ts put
// directMC, extraBudget and scaleMC on TCG's bands, which tripled them. Measured
// again now:
//
//   as it stands                       38.6%
//   only drawCards replaced            38.0%
//   draw, heal and recover replaced    45.7%
//
// Replacing the draws alone is still not worth it — a weak money card is worse
// than a card the bot leaves alone, because it plays the weak one. All three
// together is what moves it, and it moves it seven points.
//
// What makes these families a community is untouched: the payoffs, the standings,
// the loyalty on Clove, the freePlays on FFS, the morePositions on Howlers and
// Chimp Club. That is where TCG keeps it too — 57 payoffs and 20 standings across
// its own 152 community cards, against 23 that draw, heal or recover.
//
//   npx tsx scripts/community-pays.ts            # read it
//   npx tsx scripts/community-pays.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Effect, ProjectCard } from "../engine/types";

const PLAN: Record<string, { effect: Effect; why: string }> = {
  // ---- clove — the group chat --------------------------------------------
  "clove-first": { effect: { kind: "directMC", target: "self", mc: 21_000 }, why: "a ticker, a chart and a group chat, and that was the whole of it" },
  "clove-nobody": { effect: { kind: "extraBudget", target: "self", mc: 42_000 }, why: "no team to rug you, and also no team to fix anything" },
  "clove-listing": { effect: { kind: "directMC", target: "self", mc: 81_000 }, why: "one exchange nobody had heard of, and everybody screenshotted it" },
  "clove-season": { effect: { kind: "scaleMC", target: "self", percentage: 20 }, why: "for about nine days it was the only chart anybody had open" },
  "clove-carried": { effect: { kind: "directMC", target: "self", mc: 30_000, per: "spent" }, why: "everyone who was early stayed early, and it pays for every one of them" },
  "clove-product": { effect: { kind: "scaleMC", target: "self", percentage: 21 }, why: "there was never a roadmap; there was a group chat that never slept" },
  "clove-still": { effect: { kind: "scaleMC", target: "self", percentage: 27 }, why: "two cycles later the chat is still open and still arguing" },

  // ---- crooks — the deposits went up -------------------------------------
  "crooks-alone": { effect: { kind: "directMC", target: "self", mc: 21_000 }, why: "no influencer would touch it, which turned out to be the point" },
  "crooks-holds": { effect: { kind: "extraBudget", target: "self", mc: 42_000 }, why: "the contract did exactly what it said, and nobody wrote a thread" },
  "crooks-stack": { effect: { kind: "extraBudget", target: "self", mc: 86_000 }, why: "a vault, then a router, then a thing nobody could explain quickly" },
  "crooks-hit": { effect: { kind: "comebackMC", percentage: 20 }, why: "down forty percent in an hour and the deposits went up" },
  "crooks-cover": { effect: { kind: "mcPerHolderLost", mc: 12_000 }, why: "whatever came for you, it came for the whole book at once" },
  "crooks-audit": { effect: { kind: "scaleMC", target: "self", percentage: 20 }, why: "two weeks of silence, then a PDF, then the deposits doubled" },
  "crooks-book": { effect: { kind: "directMC", target: "self", mc: 45_000, per: "any" }, why: "everything routed through it eventually, whether it meant to or not" },
  "crooks-standing": { effect: { kind: "scaleMC", target: "self", percentage: 27 }, why: "outlived three exchanges, two bear markets and everyone who called it" },

  // ---- ffs — it funded everybody else ------------------------------------
  "ffs-sigh": { effect: { kind: "directMC", target: "self", mc: 21_000 }, why: "named in frustration at four in the morning and never renamed" },
  "ffs-tithe": { effect: { kind: "extraBudget", target: "both", mc: 42_000 }, why: "sold its own bag to fund a marketing wallet for everyone else" },
  "ffs-bleed": { effect: { kind: "comebackMC", percentage: 22 }, why: "down eighty percent and still funding the others, on purpose" },
  "ffs-damage": { effect: { kind: "mcPerHolderLost", mc: 14_000 }, why: "whatever came in, it stood in front of it, every single time" },
  "ffs-martyr": { effect: { kind: "budgetToMC", percentage: 60 }, why: "the wallet hit zero and the token did its best week ever" },
  "ffs-comeback": { effect: { kind: "comebackMC", percentage: 45 }, why: "everybody who laughed at the name owned some by the end" },

  // ---- howlers — the pack ------------------------------------------------
  "howlers-first": { effect: { kind: "directMC", target: "self", mc: 21_000 }, why: "minted at two in the morning, because that is when the pack is awake" },
  "howlers-moon": { effect: { kind: "directMC", target: "self", mc: 81_000 }, why: "once a month the floor moved and nobody had a reason for it" },
  "howlers-mirror": { effect: { kind: "scaleMC", target: "self", percentage: 11 }, why: "whatever the other side did, it turned up in the pack a week later" },
  "howlers-lowest": { effect: { kind: "directMC", target: "self", mc: 30_000, per: "holders" }, why: "the pack moves at the speed of its slowest, so every one of them counts" },
  "howlers-night": { effect: { kind: "scaleMC", target: "self", percentage: 20 }, why: "eight months of nothing and the group chat never went quiet once" },
  "howlers-pack": { effect: { kind: "directMC", target: "self", mc: 55_000, per: "any" }, why: "they stopped counting holders and started counting who showed up" },
  "howlers-inversion": { effect: { kind: "comebackMC", percentage: 45 }, why: "the chart flipped, and for one evening every loser was a genius" },

  // ---- chimps — the room -------------------------------------------------
  "chimps-i": { effect: { kind: "directMC", target: "self", mc: 21_000 }, why: "early enough that being early was the whole story" },
  "chimps-ii": { effect: { kind: "extraBudget", target: "self", mc: 42_000 }, why: "the Discord was busy before the mint and busier after it" },
  "chimps-iii": { effect: { kind: "directMC", target: "self", mc: 81_000 }, why: "somebody in there knew somebody who knew about everything" },
  "chimps-iv": { effect: { kind: "extraBudget", target: "self", mc: 86_000 }, why: "half the projects on this chain started in somebody's chimp chat" },
  "chimps-v": { effect: { kind: "scaleMC", target: "self", percentage: 20 }, why: "a club is only worth anything when there are people in the room" },
  "chimps-vi": { effect: { kind: "directMC", target: "self", mc: 35_000, per: "spent" }, why: "nobody who was in it early ever quite left it" },
  "chimps-vii": { effect: { kind: "scaleMC", target: "self", percentage: 21 }, why: "the oldest group chat on the chain, and it still moves markets" },
  "chimps-viii": { effect: { kind: "scaleMC", target: "self", percentage: 27 }, why: "everybody who is anybody here was in that room in the first month" },
};

function render(value: unknown): string {
  if (typeof value === "number") return Math.abs(value) >= 1000 ? value.toLocaleString("en-US").replace(/,/g, "_") : String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (value && typeof value === "object") return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${render(v)}`).join(", ")} }`;
  return String(value);
}

const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const byId = new Map(projects.map((c) => [c.id, c]));

// Every card that draws, heals or recovers in a community family is in here, and
// nothing else is. Both directions, because a card left behind is the whole
// point of this pass missed on one card, and a card from elsewhere is a family
// being rebuilt that nobody asked to rebuild.
const COMMUNITY = new Set(["clove", "crooks", "ffs", "howlers", "chimps"]);
const SOFT = ["drawCards", "healHolders", "recoverCard"];
const shouldHave = projects.filter((c) => COMMUNITY.has(c.project) && SOFT.includes(c.effect?.kind ?? ""));
const done: string[] = [];
const problems: string[] = [];
for (const [id, entry] of Object.entries(PLAN)) {
  const card = byId.get(id);
  if (card === undefined) problems.push(`${id} is not a project card`);
  else if (!COMMUNITY.has(card.project)) problems.push(`${id} is not in a community family`);
  else if (JSON.stringify(card.effect) === JSON.stringify(entry.effect)) done.push(id);
}
const missed = shouldHave.filter((c) => !PLAN[c.id]).map((c) => c.id);
if (missed.length && done.length === 0) problems.push(`still drawing or healing, with no plan: ${missed.join(", ")}`);
if (problems.length) throw new Error(problems.join("\n  "));

if (done.length === Object.keys(PLAN).length) {
  console.log(`This plan has been applied: all ${done.length} cards carry what it printed.`);
  process.exit(0);
}

if (!process.argv.includes("--apply")) {
  console.log(`${Object.keys(PLAN).length} community cards moved off draw, heal and recover.\n`);
  let family = "";
  for (const [id, entry] of Object.entries(PLAN)) {
    const card = byId.get(id)!;
    if (card.project !== family) { family = card.project; console.log(`\n--- ${card.name} ---`); }
    console.log(`${id.padEnd(18)}${card.rarity.padEnd(10)}${render(card.effect)}`);
    console.log(`${" ".repeat(18)}becomes  ${render(entry.effect)}`);
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
  const from = source.indexOf("    effect:", at);
  if (from < 0 || from - at > 1500) throw new Error(`Could not find the effect of ${id}.`);
  let to = from; let depth = 0;
  for (const line of source.slice(from).split("\n")) {
    to += line.length + 1;
    depth += (line.match(/[{[]/g) ?? []).length - (line.match(/[}\]]/g) ?? []).length;
    if (depth <= 0) break;
  }
  source = source.slice(0, from) + `    // ${entry.why}\n    effect: ${render(entry.effect)},\n` + source.slice(to);
  written++;
}
writeFileSync(path, source);
console.log(`Rebuilt ${written} community cards in ${path}.`);
