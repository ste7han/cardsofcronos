// Are the ready-made decks worth handing to a player?
//
// A preset that loses two matches in three is a bad gift, and a themed deck can
// easily be one — a bias towards a sector is a bias away from everything else.
// This plays every preset against every other, sides swapped each match, and
// against a plain generated deck as a reference point.
//
//   npx tsx scripts/preset-duel.ts
import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck, buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { PRESET_DECKS } from "../data/preset-decks";

const index = buildIndex(CARDS);
const count = Number(process.argv[2] ?? 2000);

// The reference used to be one generated deck on a fixed seed, which made it
// worthless: after ten cards were added that seed produced a different and worse
// deck, and every preset appeared to jump to 95%+ overnight. A generated deck is
// worth what the average one is worth, so the reference is spread over many
// seeds — a different one for each match.
const REFERENCE_SEEDS = 60;
const referenceDecks = Array.from({ length: REFERENCE_SEEDS }, (_, i) =>
  buildDeck(CARDS, 40_000 + i * 97),
);
const referenceFor = (match: number) => referenceDecks[match % REFERENCE_SEEDS]!;

const decks = [
  ...PRESET_DECKS.map((p) => ({
    name: p.name,
    deck: buildDeckPreferring(CARDS, p.seed, p.prefer),
  })),
];

function play(seed: number, a: string[], b: string[], aFirst: boolean): boolean | null {
  let state = newMatch(CARDS, seed, aFirst ? { you: a, opponent: b } : { you: b, opponent: a });
  let steps = 0;
  while (!state.finished) {
    state = applyMove(state, chooseMove(state, index), index);
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  if (state.winner === null) return null;
  return (state.winner === "you") === aFirst;
}

const rows: string[] = [];
const overall = new Map<string, { wins: number; played: number }>();
for (const d of decks) overall.set(d.name, { wins: 0, played: 0 });
overall.set("generated", { wins: 0, played: 0 });

for (let i = 0; i < decks.length; i++) {
  for (let j = i + 1; j < decks.length; j++) {
    const a = decks[i]!;
    const b = decks[j]!;
    let aWins = 0;
    let played = 0;
    for (let s = 0; s < count; s++) {
      const result = play(s, a.deck, b.deck, s % 2 === 0);
      if (result === null) continue;
      played++;
      if (result) aWins++;
    }
    rows.push(`  ${a.name.padEnd(13)} ${((aWins / played) * 100).toFixed(1).padStart(5)}%  vs  ${b.name}`);
    overall.get(a.name)!.wins += aWins;
    overall.get(a.name)!.played += played;
    overall.get(b.name)!.wins += played - aWins;
    overall.get(b.name)!.played += played;
  }
}

// Every preset against the spread of generated decks, which is what a player
// actually faces: the bot builds a fresh deck each match.
for (const d of decks) {
  let wins = 0;
  let played = 0;
  for (let s = 0; s < count; s++) {
    const result = play(s, d.deck, referenceFor(s), s % 2 === 0);
    if (result === null) continue;
    played++;
    if (result) wins++;
  }
  rows.push(`  ${d.name.padEnd(13)} ${((wins / played) * 100).toFixed(1).padStart(5)}%  vs  generated`);
  overall.get(d.name)!.wins += wins;
  overall.get(d.name)!.played += played;
  overall.get("generated")!.wins += played - wins;
  overall.get("generated")!.played += played;
}

console.log(`${count} matches per pairing, sides swapped, ${REFERENCE_SEEDS} reference decks\n`);
console.log(rows.join("\n"));
console.log("\noverall win rate across every pairing:");
for (const [name, r] of [...overall.entries()].sort((a, b) => b[1].wins / b[1].played - a[1].wins / a[1].played)) {
  console.log(`  ${name.padEnd(13)} ${((r.wins / r.played) * 100).toFixed(1).padStart(5)}%`);
}
