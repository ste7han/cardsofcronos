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
import { restrictionOf } from "../engine/rules-text";
import type { Card, Effect, ProjectCard } from "../engine/types";

type Intent = "takes" | "momentum" | "money" | "community" | "locks";

/** Why each family plays the way it is proposed to. One line, from its flavour. */
const PROPOSAL: Record<string, { intent: Intent; because: string }> = {
  // ---- meme -------------------------------------------------------------
  clove: { intent: "community", because: "a group chat that never slept, and everyone early stayed early" },
  ffs: { intent: "community", because: "sold its own bag to fund a marketing wallet for everyone else" },
  monsters: { intent: "takes", because: "it did not check whose side anybody was on, and it ate the thing eating everything else" },
  caw: { intent: "momentum", because: "seven in a row, and a week to the hour it did the whole thing again" },
  dak: { intent: "takes", because: "a floor sweep, and whatever the other collection lost turned up in this one's floor" },
  // ---- defi -------------------------------------------------------------
  crooks: { intent: "community", because: "down forty percent in an hour and the deposits went up" },
  obsidian: { intent: "money", because: "everybody counts at the end; it had been counting the whole time" },
  tectonic: { intent: "locks", because: "supply something, borrow against it — everything on the chain ends up posted here" },
  ferro: { intent: "money", because: "underneath the venues, quoting the boring half of every trade" },
  // ---- dex --------------------------------------------------------------
  wolfswap: { intent: "takes", because: "the other pool did not close, it just stopped being quoted" },
  vvs: { intent: "momentum", because: "volume begets volume, and that is the whole business" },
  mmf: { intent: "money", because: "the buyback ran on a timer and the chart knew what time it was" },
  // ---- nft --------------------------------------------------------------
  robots: { intent: "momentum", because: "ran twice as hot for half as long, and everybody knew" },
  howlers: { intent: "community", because: "the pack moves at the speed of its slowest, which is the whole idea" },
  lions: { intent: "money", because: "two cycles in and the floor is still where the floor was" },
  chimps: { intent: "community", because: "the oldest group chat on the chain, and it still moves markets" },
  // ---- infra ------------------------------------------------------------
  nova: { intent: "momentum", because: "nobody voted for it; everybody integrated it" },
  cr00ts: { intent: "takes", because: "two percent nobody notices is a business nobody complains about" },
  minted: { intent: "money", because: "fees on both sides of every sale, quietly, forever" },
};

function intentOf(card: Card): Intent | "none" {
  if (restrictionOf(card)) return "locks";
  const e = (card as any).effect as Effect | undefined;
  if (!e) return "none";
  switch (e.kind) {
    case "stealMC": case "damageHolders": case "rug":
    case "cancel": case "takeOver": case "discardCards":
      return "takes";
    case "directMC": case "scaleMC": case "extraBudget":
      return e.target === "opponent" ? "takes" : "money";
    case "pumpProject": case "pumpBySector":
      return "momentum";
    case "drawCards": case "healHolders":
      return "community";
    default:
      return "none";
  }
}

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
  const p = PROPOSAL[key];
  if (!p) { missing.push(`${cards[0]!.name} (${key})`); continue; }
  const kinds = cards.map(intentOf);
  rows.push({
    key,
    name: cards[0]!.name,
    sector: cards[0]!.sector,
    want: p.intent,
    fits: kinds.filter((k) => k === p.intent).length,
    speaks: kinds.filter((k) => k !== "none").length,
    blank: kinds.filter((k) => k === "none").length,
    because: p.because,
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
