// Art: what exists, what it covers, and what to draw next.
//
//   npm run art
//
// Writes lib/art-manifest.ts and prints the coverage. Run it after dropping
// files into public/art.
//
// The manifest exists because the pages that render hundreds of cards at once
// cannot afford to find out by asking. Probing with <img onError> is one failed
// request per missing file, which on /cards is a thousand 404s before anything
// appears. A generated list is a few hundred bytes and the answer is instant.
//
// Counting is by project rather than by card, because a project's eight cards
// are eight moments of one subject — BONK is the same dog on all of them. One
// file per project covers 419 project cards. Without that, this is 535 separate
// commissions; with it, 153 and then as many refinements as anybody has patience
// for.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CARDS } from "../data/cards";

const DIR = path.join(process.cwd(), "public", "art");
const onDisk = readdirSync(DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

/**
 * A filename, reduced to the part a person would have typed on purpose.
 *
 * "Solana Monkey Business.png" and "chillguy.png" both arrived in the folder and
 * both matched nothing, because the id is `smb` and `chill-guy`. Neither is a
 * mistake — they are what the project is called. Nobody dropping a picture of a
 * monkey into a folder is going to remember it was filed under three letters.
 */
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The same, with a leading "the" taken off.
 *
 * Half the archetypes are called "The Something", and a file arrives named
 * either way round — thestudiohead.png and studio-head.png are the same
 * intention. Four files sat in the folder doing nothing over that one word.
 * Claimed as a second key rather than replacing the first, so both land.
 */
const stripThe = (key: string) => (key.startsWith("the") && key.length > 5 ? key.slice(3) : key);

/**
 * Names that are not the project's name, ticker or id, and never will be.
 *
 * Kept tiny and explicit. Anything that can be resolved by rule is resolved by
 * rule below; this is only for the cases where the trenches call a thing one
 * name and the set files it under another.
 */
const ALIASES: Record<string, string> = {
  // What the trenches call it, where the set files it under something else.
  gamestop: "gme",
  rendernetwork: "render",
  bertram: "bert", // the card is Bertram The Pomeranian
  yoots: "y00ts", // spelled with zeroes, said with an oo

  // Filename slips, kept here rather than renaming files in public/art. Rename
  // the file and delete the line whenever you like; the rule below will then
  // resolve it on the name and this entry stops being needed.
  cestoncreck: "cets", // Cets on Creck
  cetsoncrack: "cets", // and the way it is usually typed — the card spells it Creck
  actoneprophecy: "act-i", // the card is Act I The AI Prophecy
  elonpost: "elon-posts", // the card is plural — he does it more than once
  switchblade: "switchboard", // the file is the Switchboard S
  sandwich: "mev-sandwich", // everyone calls it a sandwich; the card spells out the MEV
  nationmeta: "nation-state-meta", // the card spells out Nation State
};

// Every way a file is allowed to name a project, resolved to the project id.
// Built as a map to a Set so a name claimed by two projects can be caught rather
// than silently handed to whichever came first.
const byName = new Map<string, Set<string>>();
const claim = (key: string, project: string) => {
  if (!key) return;
  const held = byName.get(key) ?? new Set<string>();
  held.add(project);
  byName.set(key, held);
};
for (const card of CARDS) {
  if (card.type === "project") {
    claim(slug(card.project), card.project);
    claim(slug(card.name), card.project);
    claim(slug(card.ticker), card.project);
    continue;
  }
  // Tactics, tools, events and influencers were matched on their exact card id
  // and nothing else, so paperhands.png sat in the folder doing nothing while
  // the card is paper-hands. A file named after the thing on it should land,
  // whichever punctuation the id happens to use.
  claim(slug(card.id), card.id);
  claim(slug(card.name), card.id);
  claim(slug(card.ticker), card.id);
  claim(stripThe(slug(card.name)), card.id);
}
for (const [from, to] of Object.entries(ALIASES)) claim(slug(from), to);

const cardIds = new Set(CARDS.map((c) => c.id));

/** What a file covers: an exact card, a whole project, or nothing. */
function resolve(base: string): string | null {
  if (cardIds.has(base)) return base;
  const held = byName.get(slug(base)) ?? byName.get(stripThe(slug(base)));
  if (!held || held.size === 0) return null;
  if (held.size > 1) {
    throw new Error(
      `The file "${base}" could mean ${[...held].join(" or ")}. Rename it to the project id.`,
    );
  }
  return [...held][0]!;
}

/** filename without extension -> what it covers, for the files that resolve. */
const resolved = new Map<string, string>();
/** Two files claiming one card. Reported, because it used to be silent. */
const collisions = new Map<string, string[]>();
for (const file of onDisk) {
  const base = file.replace(/\.[^.]+$/, "");
  const target = resolve(base);
  if (!target) continue;
  resolved.set(file, target);
  collisions.set(target, [...(collisions.get(target) ?? []), file]);
}

const files = new Set(resolved.values());

/** filename -> sha1 of its bytes. Read once; used for the URL and the check below. */
const digests = new Map<string, string>();
for (const file of resolved.keys()) {
  digests.set(file, createHash("sha1").update(readFileSync(path.join(DIR, file))).digest("hex"));
}

const manifestPath = path.join(process.cwd(), "lib", "art-manifest.ts");
const manifest =
  `// Generated by scripts/art.ts — run \`npm run art\` after adding files.\n` +
  `// Names, not paths: the extension is resolved from ART_FILES.\n` +
  `//\n` +
  `// The ?v= is the first eight characters of the file's sha1, and it is the\n` +
  `// reason replacing a picture under its own name reaches anybody. Same name\n` +
  `// means same URL means every browser and every CDN keeps serving the copy it\n` +
  `// already has — locally that is one hard refresh, in production it is every\n` +
  `// visitor who ever opened the card, and the maker is the last person to see\n` +
  `// it because his own browser refetched days ago. New bytes, new URL.\n` +
  `//\n` +
  `// It also gives a swapped picture somewhere to show up: public/art is\n` +
  `// gitignored, so without this a replaced image changes nothing under version\n` +
  `// control at all.\n\n` +
  `export const ART_FILES: Record<string, string> = ${JSON.stringify(
    Object.fromEntries(
      [...resolved].map(([file, target]) => [
        target,
        `/art/${file}?v=${digests.get(file)!.slice(0, 8)}`,
      ]),
    ),
    null,
    2,
  )};\n`;

// Only written when it actually changes, and that matters more than it looks.
// render-cards --stale asks whether a card's picture predates its art, and it
// reads this file's timestamp to answer. Rewriting identical bytes on every run
// would bump that timestamp and declare all five hundred art-backed cards stale
// every time anybody ran `npm run art`.
if (!existsSync(manifestPath) || readFileSync(manifestPath, "utf8") !== manifest) {
  writeFileSync(manifestPath, manifest);
  console.log("art-manifest.ts updated\n");
} else {
  console.log("art-manifest.ts unchanged\n");
}

const projects = new Map<string, { name: string; cards: number; moments: number }>();
for (const card of CARDS) {
  if (card.type !== "project") continue;
  const seen = projects.get(card.project) ?? { name: card.name, cards: 0, moments: 0 };
  seen.cards += 1;
  if (files.has(card.id)) seen.moments += 1;
  projects.set(card.project, seen);
}

const projectCards = CARDS.filter((c) => c.type === "project").length;
const covered = [...projects].reduce(
  (n, [id, p]) => n + (files.has(id) ? p.cards : p.moments),
  0,
);
const other = CARDS.filter((c) => c.type !== "project");

console.log("art coverage\n");
console.log(`  projects with a family image   ${[...projects].filter(([id]) => files.has(id)).length} of ${projects.size}`);
console.log(`  project cards covered          ${covered} of ${projectCards}`);
console.log(`  tools, tactics, events, people ${other.filter((c) => files.has(c.id)).length} of ${other.length}`);

// A file that matches nothing is worse than a missing one: it looks like work
// that is done. theblackbull.png sat in the folder doing nothing because the
// card is black-bull, and nothing would ever have said so.
const wanted = new Set<string>();
for (const card of CARDS) {
  wanted.add(card.id);
  if (card.type === "project") wanted.add(card.project);
}
// Two files resolving to the same card is how a picture disappears without a
// word: whichever loses the race is simply never used, and nothing says so. It
// cost this project bonk.png for an afternoon, so it is reported now.
const doubled = [...collisions].filter(([, files]) => files.length > 1);
if (doubled.length > 0) {
  console.log(`\ntwo files for one card — only one of each pair is used:\n`);
  for (const [target, files] of doubled) {
    console.log(`  ${target}: ${files.join(", ")}`);
  }
}

// The same picture under two names, sitting on two different cards. The
// collision check above cannot see this — those files resolve to different
// cards, so nothing is being overridden — but it is almost always a mistake.
// The Bottom and Bear Market both got the same descending chart this way,
// because I read the maker's thebottom.png as a Bear Market and copied it.
const byContent = new Map<string, string[]>();
for (const [file, target] of resolved) {
  const digest = digests.get(file)!;
  byContent.set(digest, [...(byContent.get(digest) ?? []), `${target} (${file})`]);
}
const sameImage = [...byContent.values()].filter((names) => names.length > 1);
if (sameImage.length > 0) {
  console.log(`\none picture on more than one card — check which of these is wrong:\n`);
  for (const names of sameImage) console.log(`  ${names.join("  =  ")}`);
}

const orphans = onDisk
  .map((f) => f.replace(/\.[^.]+$/, ""))
  .filter((base) => !wanted.has(base) && !resolve(base));
if (orphans.length > 0) {
  console.log(`\nfiles that match no card — check the name:\n`);
  for (const f of orphans) console.log(`  ${f}`);
}

const missing = [...projects].filter(([id]) => !files.has(id)).sort((a, b) => b[1].cards - a[1].cards);
console.log(`\nbiggest wins first — one file each, and the cards it covers:\n`);
for (const [id, p] of missing.slice(0, 15)) {
  console.log(`  ${`${id}.png`.padEnd(22)} ${String(p.cards).padStart(2)} cards   ${p.name}`);
}
if (missing.length > 15) console.log(`  … and ${missing.length - 15} more projects`);
