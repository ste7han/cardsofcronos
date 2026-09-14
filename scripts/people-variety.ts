// The people all did the same thing.
//
//   npx tsx scripts/people-variety.ts            read it
//   npx tsx scripts/people-variety.ts --apply    write it into the set
//
// Forty person cards. Thirty-eight of them carried pumpSector and two carried
// drawEachTurn, against eleven aura kinds the engine has and nine it had never
// once been asked for. The support layer of the game was one card printed forty
// times at different prices.
//
// PersonCard has carried `effect?: Effect` since it was written — "an optional
// one-off when played, on top of the standing aura" — and four cards used it.
// The shape the fix needed was already there and unused.
//
// TWO THINGS ARE DONE HERE, and the split matters because only one of them
// touches the balance.
//
// Four auras change kind. Each is a person whose own line asks for it and whose
// sector can spare the support: the node runner with six boxes on the roof gets
// the aura that hands you a portfolio slot, the validator who keeps a machine
// running so everybody else can trade gets the one that heals, the account that
// fuds CRO while claiming CroFam makes idle money hurt, and the sharer of
// referral codes gets giftBudget — which the engine calls "a gift and an attack
// in one", and is the only person in this set it describes.
//
// Fourteen get a one-off effect and nothing else changes. That is the safe half:
// the aura layer was weighted deliberately against the families, and a one-off
// adds character without taking a single point of sector support away.
//
// WHAT IS DELIBERATELY NOT DONE: the commons stay plain. A common person is
// three thousand of a sector and a line of flavour, and that is the floor the
// rest is read against — if every card has a second half then none of them do.

import { readFileSync, writeFileSync } from "node:fs";

import { CARDS } from "../data/cards";
import type { Aura, Effect } from "../engine/types";

/** A person whose aura becomes a different kind of thing. */
const AURAS: Record<string, { aura: Aura; why: string }> = {
  nodeguy: {
    aura: { kind: "morePositions", positions: 1 },
    why: "six boxes on the roof; the only aura that changes a rule rather than a number",
  },
  validator: {
    aura: { kind: "healEachTurn", sector: "infra", bonus: 6_000, holders: 1 },
    why: "keeps a machine in a rack running so everybody else can trade",
  },
  blacksea: {
    aura: { kind: "punishWaste", times: 2 },
    why: "fuds CRO and claims CroFam — the budget you leave idle costs you double",
  },
  chubz: {
    aura: { kind: "giftBudget", budget: 24_000, times: 2 },
    why: "sharer of referral codes, which the engine already calls a gift and an attack in one",
  },
};

/** A person who keeps their aura and gains a one-off when played. */
const EFFECTS: Record<string, { effect: Effect; why: string }> = {
  kris: {
    effect: { kind: "extraBudget", target: "self", mc: 60_000 },
    why: "it began as a card you topped up, so it hands you something to spend",
  },
  kaancronos: {
    effect: { kind: "recoverCard", amount: 1 },
    why: "the tutorialist explains the thing you threw away until you want it back",
  },
  artik: {
    effect: { kind: "peekAndBurn", look: 3 },
    why: "he built a dashboard for the whole chain, so he sees what is coming",
  },
  angelusbob: {
    effect: { kind: "pumpProject", target: "allOwnProjects", mc: 6_000 },
    why: "the artist lifts everything he has drawn",
  },
  snakeape: {
    effect: { kind: "damageHolders", target: "enemyBest", amount: 1 },
    why: "cordial, not nice — his own four words",
  },
  ryantroopz: {
    effect: { kind: "directMC", target: "self", mc: 45_000 },
    why: "he built the lottery and it pays out",
  },
  dreamqc: {
    effect: { kind: "recoverCard", amount: 1 },
    why: "he took over a project its founder had walked away from",
  },
  alex: {
    effect: { kind: "stealMC", percentage: 8 },
    why: "built one venue and then bought the other",
  },
  haten: {
    effect: { kind: "refundMC", percentage: 25 },
    why: "main stakeholder: a share of it comes back to him",
  },
  twentyone: {
    effect: { kind: "healHolders", target: "allOwnProjects", amount: 1 },
    why: "held through two cycles and will tell you the entire story",
  },
  schwiz: {
    effect: { kind: "drawCards", amount: 1 },
    why: "he opened the marketplace, so something new turns up",
  },
  jkcrypto: {
    effect: { kind: "pumpBySector", target: "allOwnProjects", bonuses: { nft: 7_000 } },
    why: "ten thousand monsters in twenty families, and he lifts the pictures rather than the money",
  },
  copytarget: {
    effect: { kind: "drawCards", amount: 1 },
    why: "four thousand wallets watch the address, and what he holds arrives in your hand",
  },
  sweeper: {
    effect: { kind: "directMC", target: "self", mc: 14_000 },
    why: "buys the cheapest twenty of anything the moment it moves",
  },
};

// ---------------------------------------------------------------------------

const render = (v: unknown): string => {
  if (typeof v === "number")
    return Math.abs(v) >= 1000 ? v.toLocaleString("en-US").replace(/,/g, "_") : String(v);
  if (typeof v === "string") return `"${v}"`;
  if (Array.isArray(v)) return `[${v.map(render).join(", ")}]`;
  if (v && typeof v === "object")
    return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${render(x)}`).join(", ")} }`;
  return String(v);
};

const people = new Map(
  CARDS.filter((c) => c.type === "person").map((c) => [c.id, c] as const),
);
const problems: string[] = [];
for (const id of [...Object.keys(AURAS), ...Object.keys(EFFECTS)]) {
  if (!people.has(id)) problems.push(`${id} is not a person card in this set`);
}
for (const id of Object.keys(EFFECTS)) {
  if ((people.get(id) as { effect?: unknown } | undefined)?.effect) {
    problems.push(`${id} already has a one-off effect`);
  }
}
if (problems.length) throw new Error(problems.join("\n  "));

if (!process.argv.includes("--apply")) {
  console.log(`${Object.keys(AURAS).length} auras change kind:\n`);
  for (const [id, { aura, why }] of Object.entries(AURAS)) {
    const was = people.get(id) as { name: string; aura: Aura };
    const from = was.aura.kind === "pumpSector" ? `${was.aura.sector} +${was.aura.bonus / 1000}K` : was.aura.kind;
    console.log(`  ${was.name.padEnd(22)}${from.padEnd(14)} -> ${render(aura)}`);
    console.log(`  ${" ".repeat(22)}${why}`);
  }
  console.log(`\n${Object.keys(EFFECTS).length} gain a one-off, aura untouched:\n`);
  for (const [id, { effect, why }] of Object.entries(EFFECTS)) {
    const p = people.get(id) as { name: string; rarity: string };
    console.log(`  ${p.rarity.padEnd(10)}${p.name.padEnd(22)}${render(effect)}`);
    console.log(`  ${" ".repeat(32)}${why}`);
  }
  console.log(`\nRun again with --apply to write it into data/cards.ts.`);
  process.exit(0);
}

const path = "data/cards.ts";
let source = readFileSync(path, "utf8");

function edit(id: string, field: "aura" | "effect", value: unknown, why: string): void {
  const at = source.indexOf(`    id: "${id}",`);
  if (at < 0) throw new Error(`Could not find ${id}.`);
  const start = source.lastIndexOf("  {\n", at);
  const end = source.indexOf("\n  },\n", at) + "\n  },\n".length;
  const card = source.slice(start, end);

  let next: string;
  if (field === "aura") {
    // The aura is one line on every person card in this file.
    const line = /^    aura: \{[^\n]*\},\n/m;
    if (!line.test(card)) throw new Error(`${id}: aura is not on one line.`);
    next = card.replace(line, `    // ${why}\n    aura: ${render(value)},\n`);
  } else {
    // In before the flavour, which every person card ends with.
    next = card.replace("    flavour:", `    // ${why}\n    effect: ${render(value)},\n    flavour:`);
  }
  source = source.slice(0, start) + next + source.slice(end);
}

for (const [id, { aura, why }] of Object.entries(AURAS)) edit(id, "aura", aura, why);
for (const [id, { effect, why }] of Object.entries(EFFECTS)) edit(id, "effect", effect, why);

writeFileSync(path, source);
console.log(
  `Changed ${Object.keys(AURAS).length} auras and added ${Object.keys(EFFECTS).length} one-offs in ${path}.`,
);
