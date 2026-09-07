// Does each family of cards play a way, or is it eight prices?
//
// DESIGN.md sets the rule out plainly — "each family plays differently, or eight
// cards is just eight prices" — and then names four: BONK is a community, WIF is
// money and attention arriving, POPCAT is momentum, PNUT takes. That was written
// when there were a handful of families. There are sixty-five now, and the maker
// suspects the rest grew without it.
//
// So this asks each family what it does, in the only terms the engine has: the
// effects its cards carry. Effect kinds are grouped into the intents the design
// note itself uses, because "drawCards and healHolders" is not a tactic and
// "the community moves together" is.
//
// The number that matters is how much of a family sits in its own leading
// intent. A family whose eight cards are spread evenly across four intents is
// not playing a way; it is eight cards that happen to share a ticker.
//
//   npx tsx scripts/night-family-identity.ts [minimum family size]

import { CARDS } from "../data/cards";
import type { ProjectCard } from "../engine/types";
import { type Intent, intentOf } from "./intent";

const MIN = Number(process.argv[2] ?? 4);

/** The intents DESIGN.md already talks in. */

const INTENTS: Intent[] = ["takes", "momentum", "money", "community", "locks"];


const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const families = new Map<string, ProjectCard[]>();
for (const p of projects) families.set(p.project, [...(families.get(p.project) ?? []), p]);

interface Row {
  name: string;
  size: number;
  /** Cards carrying any effect or restriction at all. */
  speaking: number;
  counts: Record<Intent, number>;
  leading: Intent;
  share: number;
}

const rows: Row[] = [];
for (const [key, cards] of families) {
  if (cards.length < MIN) continue;
  const counts = { community: 0, money: 0, momentum: 0, takes: 0, locks: 0, none: 0 } as Record<Intent, number>;
  for (const c of cards) counts[intentOf(c)]++;
  const speaking = cards.length - counts.none;
  // Only over the intents, never over "none". The first version of this seeded
  // `leading` with "none" and then compared every intent against the count of
  // cards that carry nothing at all — so a family of four blanks and three
  // takes kept "none" as its leading intent and divided four by three. Shares
  // of 300% and 700% came out, which is the sort of wrong that announces itself;
  // the sort that does not is a family reported as leaning one way because the
  // blanks outvoted the cards.
  let leading: Intent = INTENTS[0]!;
  for (const i of INTENTS) if (counts[i] > counts[leading]) leading = i;
  rows.push({
    name: cards[0]!.name,
    size: cards.length,
    speaking,
    counts,
    leading: speaking > 0 ? leading : "none",
    share: speaking > 0 ? counts[leading] / speaking : 0,
  });
}

rows.sort((a, b) => a.share - b.share);

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const num = (s: string | number, n: number) => String(s).padStart(n);

console.log(
  `${rows.length} families of ${MIN} cards or more. "speaking" is how many carry an\n` +
    `effect or a restriction at all; the share is how much of that sits in the\n` +
    `family's own leading intent.\n`,
);
console.log(
  pad("family", 24) + num("cards", 6) + num("speaking", 10) +
    INTENTS.map((i) => num(i, 11)).join("") + num("leading", 12) + num("share", 8),
);

for (const r of rows) {
  console.log(
    pad(r.name.slice(0, 23), 24) + num(r.size, 6) + num(r.speaking, 10) +
      INTENTS.map((i) => num(r.counts[i] || "·", 11)).join("") +
      num(r.leading, 12) + num((r.share * 100).toFixed(0) + "%", 8),
  );
}

const clear = rows.filter((r) => r.share >= 0.6).length;
const scattered = rows.filter((r) => r.share < 0.45).length;
console.log(
  `\n${clear} of ${rows.length} families keep 60% or more of what they do in one intent.` +
    `\n${scattered} keep under 45%, which is a family with no way of playing at all.`,
);

console.log("\n### WHICH INTENT EACH FAMILY LEADS WITH");
const leaders = new Map<Intent, number>();
for (const r of rows) leaders.set(r.leading, (leaders.get(r.leading) ?? 0) + 1);
for (const i of [...INTENTS, "none" as Intent]) {
  const n = leaders.get(i) ?? 0;
  if (n > 0) console.log(`  ${pad(i, 12)}${num(n, 4)} families`);
}

console.log("\n### AND WHY, ACROSS EVERY PROJECT CARD IN THE SET");
// The bucket sizes, so the table above can be read honestly. "takes" gathers
// more effect kinds than the others do, and a reader is owed the chance to see
// whether the lean is the set or the grouping.
const totals = new Map<Intent, number>();
for (const p of projects) totals.set(intentOf(p), (totals.get(intentOf(p)) ?? 0) + 1);
const speakingCards = projects.length - (totals.get("none") ?? 0);
for (const i of INTENTS) {
  const n = totals.get(i) ?? 0;
  console.log(
    `  ${pad(i, 12)}${num(n, 5)} cards${num(((n / speakingCards) * 100).toFixed(0) + "%", 7)}`,
  );
}
console.log(`  ${pad("(no effect)", 12)}${num(totals.get("none") ?? 0, 5)} cards`);

// TCG ends here by checking the four families its design note names by hand —
// BONK community, WIF money, POPCAT momentum, PNUT takes — against what they
// actually play as. None of those are on this chain, so the block printed "not
// found" four times: a check that cannot fail is not a check, and four lines of
// it at the bottom of every run teaches the reader to stop reading the bottom.
//
// The same check belongs here once DESIGN.md names families of its own. It does
// not name any yet, and inventing four to have something to compare against
// would be writing the answer and the question in one go.
