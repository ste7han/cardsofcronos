// The build side was never rescaled, and that is why attacking wins.
//
// Measured across every family playing every other family: takes 54.0%,
// momentum 48.6%, money 43.8%, community 37.9%, locks 35.4%. One column ahead of
// the field by fifteen points.
//
// THE OBVIOUS LEVER IS NOT THE LEVER. Halving stealMC across the set costs takes
// 2.9 points. Halving damageHolders RAISES it by 4.2 — those cards are worse
// than what the bot would otherwise play. Taking every takes effect down to 35%
// of its printed value still leaves takes on 53.3%. The attack side is not what
// makes attacking strong.
//
// WHAT MAKES IT STRONG is that a rug takes back everything a position earned:
// $344K destroyed per match against a final margin of $774K, so nearly half of
// every result is somebody's board being taken apart. TCG built that on purpose —
// its own design note says attacking did not work and a damaged position paying
// proportionally less is the fix. We inherited that fix. We did not inherit the
// numbers it was balanced against.
//
// TCG's medians per rarity against ours, flat cards only, `per` rates excluded:
//
//   directMC      26/44/82/105/120K    against    7/27/-/-/-K        3.0x
//   extraBudget   50/90/120/-/420K     against    22/45/95/-/200K    1.9x
//   pumpProject   11/22/28/-/-K        against    2/6/15/-/-K        3.7x  <- not used
//   pumpBySector  -/62/7/160/-K        against    -/8/9/14/-K        6.7x  <- not used
//   scaleMC       -/9/13/16/19         against    -/7/13/14/18       1.1x
//
// So this multiplies each kind by what TCG's own set says it should be, and
// scaleMC by 1.5 on top — the one place the bands agree and the outcome does
// not, because a percentage of your own market cap compounds and ours had
// nothing to compound on. Swept rather than picked: 1.0 leaves takes on 53.8%,
// 1.5 on 51.7%, 2.0 on 51.3%, so past 1.5 it buys nothing.
//
// The `per` rates take the same multiplier as the flat cards, and that is
// checked rather than assumed: TCG's sixty-six per-rate directMC cards run to a
// median of $34K against our seven at $12K, which is 2.8x — the flat number
// within rounding, so one multiplier covers both.
//
// Attack effects are untouched. Nothing here is a nerf.
//
//   npx tsx scripts/rescale-build.ts            # read it
//   npx tsx scripts/rescale-build.ts --apply    # write it into the set

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { ProjectCard } from "../engine/types";

/**
 * What each shape is worth, and where the number comes from.
 *
 * directMC, extraBudget and scaleMC are TCG's own medians against ours. The two
 * pump kinds are NOT, and the first version of this file used them — 3.7 and 6.7
 * — which put momentum fifteen points clear of the field and simply moved the
 * problem that takes had.
 *
 * A median cannot price a pump. Measured over 3,760 pump cards actually played:
 * they go down on turn 5.8 with 2.9 positions standing, so the printed number
 * pays out about twelve times before the match ends. A common printing $22K
 * delivers $272K; a rare printing $42K delivers $478K; a legendary, $1.46M. A
 * money card delivers what it prints, once. Matching TCG's median on a shape
 * worth twelve times its face was multiplying the wrong number.
 *
 * So the pumps are swept against the outcome instead: at 3.7 the spread between
 * the five intents is 17.3 points, at 2.0 it is 15.6, at 1.5 it is 14.2 and at
 * 1.0 it is 14.4. 1.5 is the floor of that curve.
 */
const RATIO: Record<string, number> = {
  directMC: 3.0,
  extraBudget: 1.9,
  pumpProject: 1.5,
  pumpBySector: 1.5,
  scaleMC: 1.5,
};

/**
 * Rounded the way the rest of the file is written: nothing in this set prints
 * $171K. Fives above fifty thousand, thousands below it.
 */
const round = (n: number) => {
  if (Math.abs(n) < 1000) return Math.round(n);
  const step = Math.abs(n) >= 50_000 ? 5000 : 1000;
  return Math.round(n / step) * step;
};

/** The rescaled effect, or null when this card is not one of the shapes. */
function rescaled(card: ProjectCard): Record<string, unknown> | null {
  const e = card.effect as (Record<string, unknown> & { kind: string }) | undefined;
  if (!e) return null;
  const f = RATIO[e.kind];
  // Anything aimed across the table is an attack whatever its shape, and this
  // pass does not touch attacks.
  if (f === undefined || e.target === "opponent") return null;
  const out = { ...e };
  if (typeof out.mc === "number") out.mc = round(out.mc * f);
  else if (typeof out.percentage === "number") out.percentage = Math.round(out.percentage * f);
  else if (out.bonuses && typeof out.bonuses === "object") {
    out.bonuses = Object.fromEntries(
      Object.entries(out.bonuses as Record<string, number>).map(([k, v]) => [k, round(v * f)]),
    );
  } else return null;
  return JSON.stringify(out) === JSON.stringify(e) ? null : out;
}

function render(value: unknown): string {
  if (typeof value === "number") {
    return Math.abs(value) >= 1000 ? value.toLocaleString("en-US").replace(/,/g, "_") : String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${render(v)}`).join(", ")} }`;
  }
  return String(value);
}

const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const work = projects.flatMap((c) => {
  const next = rescaled(c);
  return next ? [{ card: c, next }] : [];
});

if (work.length === 0) {
  console.log("Every card is already at these numbers. Nothing to do.");
  process.exit(0);
}

if (!process.argv.includes("--apply")) {
  console.log(`${work.length} of ${projects.length} project cards rescaled.\n`);
  const byKind = new Map<string, number>();
  for (const { card } of work) {
    const k = (card.effect as { kind: string }).kind;
    byKind.set(k, (byKind.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(15)}${String(n).padStart(3)} cards   x${RATIO[k]}`);
  }
  console.log(`\na few, so the sizes can be argued with:`);
  for (const { card, next } of work.slice(0, 6).concat(work.slice(-4))) {
    console.log(`  ${card.id.padEnd(18)}${card.rarity.padEnd(10)}${render(card.effect)}`);
    console.log(`  ${" ".repeat(28)}becomes ${render(next)}`);
  }
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");
let written = 0;
for (const { card, next } of work) {
  const at = source.indexOf(`    id: "${card.id}",`);
  if (at < 0) throw new Error(`Could not find ${card.id} in ${path}.`);
  const from = source.indexOf("    effect:", at);
  if (from < 0 || from - at > 1500) throw new Error(`Could not find the effect of ${card.id}.`);
  let to = from;
  let depth = 0;
  for (const line of source.slice(from).split("\n")) {
    to += line.length + 1;
    depth += (line.match(/[{[]/g) ?? []).length - (line.match(/[}\]]/g) ?? []).length;
    if (depth <= 0) break;
  }
  source = source.slice(0, from) + `    effect: ${render(next)},\n` + source.slice(to);
  written++;
}
writeFileSync(path, source);
console.log(`Rescaled ${written} cards in ${path}.`);
