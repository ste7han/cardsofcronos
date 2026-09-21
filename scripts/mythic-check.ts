// Does a family's mythic do anything its own legendary does not?
//
//   npx tsx scripts/mythic-check.ts
//
// The maker asked this twice, about two different families, and was right both
// times. Loaded Lions was scaleMC 21 on the legendary and scaleMC 27 on the
// mythic; Fortune Favours The Brave was 22 and 27. In both cases the top card of
// the family was the card below it with a bigger number, and in both cases the
// mythic measured fine — the fault was never power, it was that there was nothing
// to read.
//
// So this asks it of all of them at once, on three counts:
//
//   ECHO      the mythic runs an effect kind that already appears lower down in
//             its own family
//   THIN      one line of rules and nothing else: no payoff, no standing, no
//             restriction, no loyalty
//   COMMON    the effect kind is shared with several other families' mythics,
//             so the top card of this family is the top card of those too
//
// ECHO ORIGINALLY LOOKED AT THE LEGENDARY ALONE, and that is how Puush got past
// it: the mythic was extraBudget 380K and the *epic* was extraBudget 170K, the
// same card with a bigger number, one rung further down than this was looking.
// It scored one count and fell below the shortlist. The maker found it by reading
// the family. ECHO now reads the whole family, which is what the fault always was.
//
// RUN ON 2026-09-14 IT FLAGGED TWENTY-TWO FAMILIES WITH TWO COUNTS OR MORE, and
// scripts/mythic-variety.ts answered eighteen of them. One-line mythics went from
// twenty-eight of forty-three to twelve, and the four still carrying two counts are
// Clove, Chimp Club, Loaded Lions and Tectonic — each shares an effect kind with its
// own legendary and each has a second line the legendary does not, which is the
// family having an identity rather than the card having a fault.
//
// None of the three is a fault on its own. A family whose whole identity is one
// effect may well want its mythic to be the biggest version of it, and a single
// clean line can be the strongest card in the set — ebisusbay-viii is one line
// and that line is banRoom, worth $1696K. Two or three counts together is where
// it is worth looking.

import { CARDS } from "../data/cards";
import { rulesText } from "../engine/rules-text";
import type { Card, ProjectCard } from "../engine/types";

const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const byFamily = new Map<string, ProjectCard[]>();
for (const c of projects) byFamily.set(c.project, [...(byFamily.get(c.project) ?? []), c]);

/** Rules lines that are not the launch and pump every project card prints. */
const bodyLines = (card: Card) =>
  rulesText(card).filter((l) => !/^(Launch|Pump):/.test(l.text));

const kindOf = (c: ProjectCard) => (c as { effect?: { kind: string } }).effect?.kind ?? "—";

/**
 * A rules line with its numbers taken out, so two cards that differ only in how
 * big they are read as the same line.
 *
 * ECHO compares effect kinds, which is coarser than the fault it was built for.
 * Loaf's mythic was `scaleMC 27%` over `While undamaged, every card costs your
 * opponent 14% more` and its own rare was the same two lines at 12% and 10% —
 * one flag, below the shortlist, and nothing to read on the top card of the
 * family. The kind was never the thing that was wrong; the shape was.
 */
const shapeOf = (c: Card) =>
  bodyLines(c)
    .map((l) => l.text.replace(/[\d.,]+/g, "#"))
    .join(" | ");

// How many families' mythics run each effect kind.
const mythicKinds = new Map<string, string[]>();
for (const [family, cards] of byFamily) {
  const m = cards.find((c) => c.rarity === "mythic");
  if (m) mythicKinds.set(kindOf(m), [...(mythicKinds.get(kindOf(m)) ?? []), family]);
}

interface Row {
  family: string;
  name: string;
  kind: string;
  lines: number;
  echo: boolean;
  echoes: string[];
  thin: boolean;
  common: number;
  /** A lower card in the same family whose rules read the same but smaller. */
  sameShapeAs: string | null;
  flags: number;
}

const rows: Row[] = [];
for (const [family, cards] of byFamily) {
  const mythic = cards.find((c) => c.rarity === "mythic");
  const legendary = cards.find((c) => c.rarity === "legendary");
  if (!mythic || !legendary) continue;

  const kind = kindOf(mythic);
  // Any rung, not just the one below: a mythic that repeats its family's epic is
  // the same fault as one that repeats its legendary.
  const echoes = cards
    .filter((c) => c.id !== mythic.id && kind !== "—" && kindOf(c) === kind)
    .map((c) => c.rarity);
  const echo = echoes.length > 0;
  const lines = bodyLines(mythic).length;
  const thin = lines <= 1;
  const shape = shapeOf(mythic);
  const twin = cards.find((c) => c.id !== mythic.id && shapeOf(c) === shape);
  const sameShapeAs = twin ? twin.rarity : null;
  const shared = (mythicKinds.get(kind) ?? []).length;
  // Three or more families topping out on the same effect is where a kind stops
  // being an identity and starts being a default.
  const common = shared >= 3 ? shared : 0;

  rows.push({
    family,
    name: mythic.name,
    kind,
    lines,
    echo,
    echoes,
    thin,
    common,
    sameShapeAs,
    // SHAPE counts double. The other three are worth a look; this one is the
    // card saying nothing the family has not already said, which is the fault
    // this script exists for.
    flags: (echo ? 1 : 0) + (thin ? 1 : 0) + (common ? 1 : 0) + (sameShapeAs ? 2 : 0),
  });
}

rows.sort((a, b) => b.flags - a.flags || a.name.localeCompare(b.name));

console.log(`${rows.length} families with both a legendary and a mythic\n`);
console.log("  flags  family              mythic effect        lines  notes");
for (const r of rows) {
  const notes = [
    r.echo ? `ECHO: same kind as its own ${[...new Set(r.echoes)].join(", ")}` : "",
    r.thin ? "THIN: one line" : "",
    r.common ? `COMMON: ${r.common} families top out on this` : "",
    r.sameShapeAs ? `SHAPE: reads the same as its own ${r.sameShapeAs}, only bigger` : "",
  ].filter(Boolean);
  console.log(
    `  ${String(r.flags).padStart(3)}    ${r.family.padEnd(20)}${r.kind.padEnd(20)}${String(r.lines).padStart(3)}    ${notes.join("; ")}`,
  );
}

const worst = rows.filter((r) => r.flags >= 2);
console.log(`\n${worst.length} carry two or more:`);
for (const r of worst) console.log(`  ${r.name}`);
console.log(
  `\nECHO, THIN and COMMON are none of them a fault on their own — read those as\n` +
    `the shortlist, and check each against what the family is for before changing\n` +
    `it. SHAPE is different: it means the top card of the family is a card you\n` +
    `already have with bigger numbers, and there is nothing to read.`,
);
