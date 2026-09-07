// One style per family was the goal. One SHAPE per family was not.
//
// The pass before this one pointed sixty-six cards at their own family and
// worked: seven or eight of every eight now play the family's way. What it left
// behind is a family saying the same thing in eight prices — Cronos Chimp Club
// drew a card on seven of its eight, Crazzzy Monsters damaged holders on six,
// Cr00ts took a percentage on six.
//
// FIRST, THE BAR, because the obvious one was wrong. Measured across TCG's
// sixty-five families of eight: the most common shape in a family runs to four
// at the median, and seventeen families sit at six, seven or eight of one shape.
// Distinct shapes per family: three at the median. This set was already at four
// and four. So TCG is MORE concentrated than we are and this pass is not catching
// up with anything — it is a deliberate step past it, on the four families where
// the repetition is loudest rather than across the board.
//
// WHAT IS AVAILABLE is not the same per intent, and that is the real constraint.
// A takes family can take with stealMC, damageHolders, discardCards, peekAndBurn,
// burnForDamage, takeOver, rug, cancel or a negative directMC — nine shapes. A
// money family has ten, and the `per` rates multiply them. A community family has
// three: draw, heal, recover. So Chimp Club cannot be spread as thin as Cr00ts
// can, and the numbers below say so rather than pretending otherwise.
//
//   npx tsx scripts/variety-plan.ts            # read it
//   npx tsx scripts/variety-plan.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Effect, ProjectCard } from "../engine/types";
import { effectIntentFor, intentOfEffect } from "./intent";

const PLAN: Record<string, { effect: Effect; why: string }> = {
  // ---- Cronos Chimp Club — community, and it drew on seven of eight -------
  // chimps-ii is NOT in this plan, and the two attempts to put it here are why.
  //
  // recoverCard first: dead 48% of the time over 42 plays, because a common is
  // played on turn one or two and there is nothing in the discard yet. Then
  // healHolders: dead 83%, because that early there are no positions to heal
  // either. A community common has exactly one shape that always does something,
  // and drawCards is it — which is the real reason Chimp Club had seven of them
  // rather than anybody failing to think about it.
  //
  // So the variety moved up the ladder — and then most of it moved back down
  // again, because measuring it a third time said why. Played against four
  // attacking decks over fifty seeds each, per card:
  //
  //   draw               0% dead
  //   recoverCard, epic   13%
  //   healHolders, legendary, full   44%
  //   healHolders, epic    58%
  //   healHolders, rare    70%
  //
  // A heal does nothing unless somebody has hurt you, and TCG's own design note
  // says the same out loud: a match loses 1.53 positions to damage against 20.83
  // closed by their own owner, so "mending is answering a question almost nobody
  // asks". Turning two cards that always do something into two that mostly do
  // not is not variety, it is the thing this whole project was built to avoid.
  //
  // What is left is the two that land: a recover on the epic and the family's
  // one heal-everyone on the legendary. Chimp Club stays draw-heavy, and that is
  // the honest shape of a community family rather than a gap in the work — the
  // intent has three shapes in the engine and two of them are conditional.
  "chimps-vi": {
    effect: { kind: "recoverCard", amount: 1 },
    why: "nobody who was in it early ever quite left it",
  },
  "chimps-vii": {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: "full" },
    why: "the oldest group chat on the chain, and it still moves markets",
  },

  // ---- Crooks Finance — community, and it healed on five of eight ---------
  "crooks-standing": {
    effect: { kind: "recoverCard", amount: 2 },
    why: "outlived three exchanges, two bear markets and everyone who called it",
  },

  // ---- Crazzzy Monsters — takes, and it damaged holders on six of eight ---
  "monsters-bite": {
    effect: { kind: "directMC", target: "opponent", mc: -7_000 },
    why: "the first holder to complain got a monster named after him",
  },
  "monsters-mutate": {
    effect: { kind: "scalePump", target: "allEnemyProjects", percentage: -30 },
    why: "traits nobody drew started showing up in the metadata",
  },
  "monsters-apex": {
    effect: { kind: "takeOver" },
    why: "it ate the thing that was eating everything else",
  },

  // ---- Cr00ts — takes, and it took a percentage on six of eight -----------
  "cr00ts-survive": {
    effect: { kind: "directMC", target: "opponent", mc: -7_000 },
    why: "written off four times, still quoting a spread this morning",
  },
  "cr00ts-vault": {
    effect: { kind: "peekAndBurn", look: 4 },
    why: "somebody had been writing all of it down since the start",
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

// The whole point of this pass is variety WITHIN an intent, so a replacement
// that changes the intent has undone the pass before it. Checked rather than
// trusted: it is the one mistake this file could make that nothing else catches.
const done: string[] = [];
const problems: string[] = [];
for (const [id, entry] of Object.entries(PLAN)) {
  const card = byId.get(id);
  if (card === undefined) {
    problems.push(`${id} is not a project card in this set`);
    continue;
  }
  const want = effectIntentFor(card.project);
  if (intentOfEffect(entry.effect) !== want) {
    problems.push(
      `${id}: the new effect reads as ${intentOfEffect(entry.effect)} and ${card.project} plays as ${want}`,
    );
  }
  if (card.effect && JSON.stringify(card.effect) === JSON.stringify(entry.effect)) done.push(id);
}
if (problems.length) throw new Error(problems.join("\n  "));

/** The most common effect shape in a family, and how many shapes it uses. */
function shapes(cards: readonly ProjectCard[]): Map<string, { top: number; kinds: number }> {
  const fam = new Map<string, ProjectCard[]>();
  for (const c of cards) fam.set(c.project, [...(fam.get(c.project) ?? []), c]);
  const out = new Map<string, { top: number; kinds: number }>();
  for (const [k, list] of fam) {
    const counts = new Map<string, number>();
    for (const c of list) {
      const kind = c.effect?.kind ?? "(none)";
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    out.set(k, { top: Math.max(...counts.values()), kinds: counts.size });
  }
  return out;
}

const apply = process.argv.includes("--apply");

if (done.length === Object.keys(PLAN).length) {
  console.log(
    `This plan has been applied: all ${done.length} cards carry what it printed.\n` +
      `Nothing to do.`,
  );
  process.exit(0);
}

if (!apply) {
  console.log(`${Object.keys(PLAN).length} cards given a different shape, same intent.\n`);
  let family = "";
  for (const [id, entry] of Object.entries(PLAN)) {
    const card = byId.get(id)!;
    if (card.project !== family) {
      family = card.project;
      console.log(`\n--- ${card.name} (${effectIntentFor(family)}) ---`);
    }
    console.log(`${id.padEnd(18)}${card.rarity.padEnd(10)}${render(card.effect)}`);
    console.log(`${" ".repeat(18)}becomes  ${render(entry.effect)}`);
    console.log(`${" ".repeat(18)}${entry.why}`);
  }

  const before = shapes(projects);
  const after = shapes(
    projects.map((c) => (PLAN[c.id] ? ({ ...c, effect: PLAN[c.id]!.effect } as ProjectCard) : c)),
  );
  console.log(`\nmost common shape in a family, before → after (TCG's median is 4):`);
  for (const [k, b] of [...before.entries()].sort((x, y) => y[1].top - x[1].top).slice(0, 8)) {
    const a = after.get(k)!;
    console.log(
      `  ${k.padEnd(10)}${b.top} of 8 → ${a.top} of 8    ` +
        `${b.kinds} shapes → ${a.kinds}${b.top === a.top ? "" : "   <-"}`,
    );
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
  let to = from;
  let depth = 0;
  for (const line of source.slice(from).split("\n")) {
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
console.log(`Reshaped ${written} cards in ${path}.`);
