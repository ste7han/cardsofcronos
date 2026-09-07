// A proposed way of playing for each of the nineteen families.
//
// Ported from TCG's scripts/night-family-proposal.ts, which was written for its
// sixty-five. The method is theirs and it is the right one: one intent per
// family, read off what the project actually is rather than off what its cards
// happen to do now.
//
// The intent here is read off the flavour already on the cards in data/cards.ts,
// which is the only honest source available to somebody who did not write them.
// Crooks Finance falls forty percent and the deposits go up, so it is a
// community; Tectonic is collateral and a health factor, so it locks; Cr00ts
// takes two percent nobody notices, so it takes.
//
// What this prints is the work, not the decision: for each family, how many of
// its cards already sit in the proposed intent and how many would have to be
// re-pointed. THE MAKER READS THE LIST AND CORRECTS IT. He knows what these
// projects are known for on this chain and this is read off flavour text.
//
//   npx tsx scripts/family-proposal.ts

import { CARDS } from "../data/cards";
import type { ProjectCard } from "../engine/types";
import { FAMILY_INTENT, type Intent, effectIntentFor, intentOf } from "./intent";


/** Why each family plays the way it does. One line, from its flavour.
 * The intent itself lives in scripts/intent.ts; this is only the reasoning. */
const BECAUSE: Record<string, string> = {
  clove: "a group chat that never slept, and everyone early stayed early",
  ffs: "sold its own bag to fund a marketing wallet for everyone else",
  monsters: "it did not check whose side anybody was on, and it ate the thing eating everything else",
  caw: "seven in a row, and a week to the hour it did the whole thing again",
  dak: "a floor sweep, and whatever the other collection lost turned up in this one's floor",
  crooks: "down forty percent in an hour and the deposits went up",
  obsidian: "everybody counts at the end; it had been counting the whole time",
  tectonic: "supply something, borrow against it — everything on the chain ends up posted here",
  ferro: "underneath the venues, quoting the boring half of every trade",
  wolfswap: "the other pool did not close, it just stopped being quoted",
  vvs: "volume begets volume, and that is the whole business",
  mmf: "the buyback ran on a timer and the chart knew what time it was",
  robots: "ran twice as hot for half as long, and everybody knew",
  howlers: "the pack moves at the speed of its slowest, which is the whole idea",
  lions: "two cycles in and the floor is still where the floor was",
  chimps: "the oldest group chat on the chain, and it still moves markets",
  nova: "nobody voted for it; everybody integrated it",
  cr00ts: "two percent nobody notices is a business nobody complains about",
  minted: "fees on both sides of every sale, quietly, forever",
};


const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
const fams = new Map<string, ProjectCard[]>();
for (const p of projects) fams.set(p.project, [...(fams.get(p.project) ?? []), p]);

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const num = (s: string | number, n: number) => String(s).padStart(n);

interface Row { key: string; name: string; sector: string; want: Intent; fits: number; speaks: number; blank: number; because: string }
const rows: Row[] = [];
const missing: string[] = [];

for (const [key, cards] of fams) {
  if (cards.length < 8) continue;
  const intent = FAMILY_INTENT[key];
  const because = BECAUSE[key];
  if (!intent || !because) { missing.push(`${cards[0]!.name} (${key})`); continue; }
  const kinds = cards.map(intentOf);
  rows.push({
    key,
    name: cards[0]!.name,
    sector: cards[0]!.sector,
    want: intent,
    // Counted against the EFFECT intent, which for a locks family is money —
    // see effectIntentFor. Counting Tectonic's eight money cards as misses
    // reported ten cards to re-point that were already where they belong.
    fits: kinds.filter((k) => k === effectIntentFor(key)).length,
    speaks: kinds.filter((k) => k !== "none").length,
    blank: kinds.filter((k) => k === "none").length,
    because,
  });
}

if (missing.length) console.log(`NOT PROPOSED FOR: ${missing.join(", ")}\n`);

rows.sort((a, b) => a.sector.localeCompare(b.sector) || b.fits - a.fits);

console.log(
  `Nineteen families, one way of playing each. "fits" is how many of the eight\n` +
    `cards already point that way; "to change" is the work.\n`,
);
console.log(
  pad("family", 24) + pad("sector", 10) + pad("plays as", 11) +
    num("fits", 6) + num("to change", 11) + num("blank", 7) + "   why",
);

let totalChange = 0;
let lastSector = "";
for (const r of rows) {
  if (r.sector !== lastSector) { console.log(); lastSector = r.sector; }
  const toChange = r.speaks - r.fits;
  totalChange += toChange;
  console.log(
    pad(r.name.slice(0, 23), 24) + pad(r.sector, 10) + pad(r.want, 11) +
      num(r.fits, 6) + num(toChange, 11) + num(r.blank, 7) + "   " + r.because,
  );
}

console.log("\n### WHAT THE SET WOULD LOOK LIKE");
const now = new Map<Intent | "none", number>();
for (const [, cards] of fams) if (cards.length >= 8) for (const c of cards) {
  const k = intentOf(c); now.set(k, (now.get(k) ?? 0) + 1);
}
const want = new Map<Intent, number>();
for (const r of rows) want.set(r.want, (want.get(r.want) ?? 0) + 1);
// The same tie-break night-family-identity.ts uses, and it has to be: the two
// scripts print a "now" column each and they disagreed by five families until
// this matched, purely on which intent won a draw. Two numbers for one fact is
// one number too many, and the reader has no way to tell which is the real one.
const ORDER: Intent[] = ["takes", "momentum", "money", "community", "locks"];
const nowLead = new Map<Intent, number>();
for (const [, cards] of fams) {
  if (cards.length < 8) continue;
  const counts = Object.fromEntries(ORDER.map((i) => [i, 0])) as Record<Intent, number>;
  let speaks = 0;
  for (const c of cards) {
    const k = intentOf(c);
    if (k !== "none") { counts[k] += 1; speaks += 1; }
  }
  if (speaks === 0) continue;
  let best: Intent = ORDER[0]!;
  for (const i of ORDER) if (counts[i] > counts[best]) best = i;
  nowLead.set(best, (nowLead.get(best) ?? 0) + 1);
}
console.log(pad("intent", 12) + num("families now", 14) + num("proposed", 11));
for (const i of ["takes", "momentum", "money", "community", "locks"] as Intent[]) {
  console.log(pad(i, 12) + num(nowLead.get(i) ?? 0, 14) + num(want.get(i) ?? 0, 11));
}
console.log(`\n${totalChange} cards would have to be re-pointed, out of ${rows.length * 8}.`);
