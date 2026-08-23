// The safety net CLAUDE.md asks for: a few thousand matches recorded before a
// change, and compared after it.
//
//   npm run baseline -- record            3000 matches into baseline/set.jsonl
//   npm run baseline -- record 5000 out.jsonl
//   npm run baseline -- check             replay and diff against the record
//   npm run baseline -- check out.jsonl --touched bonk-burn,wif-hat
//
// A win rate tells you something is wrong and never what. This tells you which
// matches moved, and — with --touched — which of them moved without any of the
// cards you actually changed being anywhere near them. That second group is the
// whole point: a match that changed and never saw the card you edited is a
// regression, and it is invisible to every other measurement in this repo.
//
// Deliberately not a test. It takes minutes, it is run against a change rather
// than on every save, and its answer is a list to read rather than a pass or a
// fail.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { State } from "../engine/types";
import { validateSet } from "../engine/validation";

const index = buildIndex(CARDS);
validateSet(CARDS);

/** One match, small enough that three thousand of them stay readable. */
interface Record {
  seed: number;
  /** "you", "opponent" or "draw". */
  winner: string;
  you: number;
  them: number;
  /** Every distinct card that hit the table, sorted. What --touched looks in. */
  cards: string[];
}

function play(seed: number): Record {
  let state: State = newMatch(CARDS, seed);
  const seen = new Set<string>();
  let steps = 0;
  while (!state.finished) {
    const move = chooseMove(state, index);
    if (move.kind === "playCard") {
      const id = state.players[state.toMove].hand[move.handIndex];
      if (id) seen.add(id);
    }
    state = applyMove(state, move, index);
    if (++steps > 2000) throw new Error(`Seed ${seed} does not finish — possible loop.`);
  }
  return {
    seed,
    winner: state.winner ?? "draw",
    you: state.players.you.mc,
    them: state.players.opponent.mc,
    cards: [...seen].sort(),
  };
}

function record(count: number, file: string): void {
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const lines: string[] = [];
  for (let seed = 0; seed < count; seed++) {
    lines.push(JSON.stringify(play(seed)));
    if (seed % 500 === 0) console.log(`  ${seed}/${count}`);
  }
  writeFileSync(path.resolve(file), lines.join("\n") + "\n");
  const bytes = readFileSync(path.resolve(file)).length;
  console.log(`\nrecorded ${count} matches into ${file}  (${(bytes / 1e6).toFixed(1)} MB)`);
}

function check(file: string, touched: Set<string>): void {
  const before = readFileSync(path.resolve(file), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record);

  let moved = 0;
  const innocent: Record[] = [];
  for (const was of before) {
    const now = play(was.seed);
    const same = now.winner === was.winner && now.you === was.you && now.them === was.them;
    if (same) continue;
    moved++;
    // Did anything the change touched appear on either side of this match? A
    // union of both records, because a card can have left the match as easily
    // as arrived in it.
    const involved = new Set([...was.cards, ...now.cards]);
    if (touched.size > 0 && ![...touched].some((id) => involved.has(id))) innocent.push(was);
  }

  const pct = ((100 * moved) / before.length).toFixed(1);
  console.log(`\n${before.length} matches replayed`);
  console.log(`  outcome moved : ${moved} (${pct}%)`);

  if (touched.size === 0) {
    console.log(`\n  no --touched given, so nothing can be called a regression.`);
    console.log(`  Pass the ids you changed and this will separate the two groups.`);
    return;
  }

  console.log(`  of those, without any touched card in them: ${innocent.length}`);
  if (innocent.length === 0) {
    console.log(`\n  Every match that moved had one of your cards in it. That is what you want.`);
    return;
  }
  console.log(`\n  These changed and never saw ${[...touched].join(", ")} — look at them:\n`);
  for (const r of innocent.slice(0, 20)) {
    console.log(`    seed ${String(r.seed).padStart(5)}  was ${r.winner.padEnd(9)} ${formatMC(r.you)} v ${formatMC(r.them)}`);
  }
  if (innocent.length > 20) console.log(`    … and ${innocent.length - 20} more`);
}

function main(): void {
  const mode = process.argv[2];
  const rest = process.argv.slice(3).filter((a) => !a.startsWith("--"));
  const touchedArg = process.argv.find((a) => a.startsWith("--touched="));
  const touched = new Set(
    (touchedArg?.slice("--touched=".length) ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (mode === "record") {
    const count = Number(rest[0] ?? 3000);
    record(count, rest[1] ?? "baseline/set.jsonl");
    return;
  }
  if (mode === "check") {
    const file = rest[0] ?? "baseline/set.jsonl";
    if (!existsSync(path.resolve(file))) {
      // Loud, because the quiet version of this is comparing against nothing and
      // reporting that nothing changed.
      throw new Error(`No baseline at ${file}. Run \`npm run baseline -- record\` first.`);
    }
    check(file, touched);
    return;
  }
  throw new Error(`Usage: npm run baseline -- record [count] [file] | check [file] [--touched=a,b]`);
}

main();
