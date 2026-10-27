// The "take one out" choice, as a piece of React rather than as rules.
//
// test/peek.test.ts checks that the engine burns the card you name. This checks
// what the screen does with a tap, which no match played in a test can see —
// so, like test/live-board.test.ts, it reads the source.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const choice = read("../components/game/BurnChoice.tsx");
const solo = read("../components/game/Game.tsx");
const board = read("../components/pvp/MatchBoard.tsx");

describe("the burn choice", () => {
  it("is one component, used by both tables", () => {
    // It was two copies, and the complaint about it — compact cards you cannot
    // read — applied to both. One copy is one place to fix it.
    for (const table of [solo, board]) {
      expect(table).toContain("<BurnChoice");
      expect(table).not.toContain("TAKE ONE OUT");
    }
  });

  it("is declared at module level", () => {
    // MatchBoard re-renders every second. Declared inside it, the open card
    // would close before it could be read — what happened to `Side`.
    expect(choice).toMatch(/^export function BurnChoice\(/m);
    expect(board).not.toMatch(/^\s+(const|function) BurnChoice\b/m);
    expect(solo).not.toMatch(/^\s+(const|function) BurnChoice\b/m);
  });

  it("reads a card on a tap and burns it only from a button that says so", () => {
    // Tapping the card was the burn, and it cannot be undone. On a phone the
    // thing you do with a card you cannot read is tap it.
    expect(choice).toContain("onClick={() => setReading(at)}");
    const picks = choice.match(/onClick=\{\(\) => onPick\(/g) ?? [];
    expect(picks).toHaveLength(2);
    expect(choice).toContain("TAKE OUT");
    expect(choice).toContain("TAKE THIS ONE OUT");
  });

  it("opens the card at full size", () => {
    // The whole complaint: compact cards do not carry readable rules.
    expect(choice).toContain("<CardView card={open} />");
  });
});
