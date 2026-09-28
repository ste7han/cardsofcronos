// The boards, the opponents they field, and the call that pays them.
//
// Three things here would break silently. An opponent deck the browser and the
// server build differently refuses every honest score and says nothing. A
// hand-encoded call with a wrong offset is a transaction that reverts for a
// reason no message explains. And a board id the contract cannot hold fails once
// a week, after everybody has already played.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { BOARDS, boardOf, opponentDeck } from "@/data/boards";
import { deckProblems } from "@/engine/deck";
import { RULES } from "@/engine/types";
import { demoDecks } from "@/lib/demo";
import { asWord, closeWeekData } from "@/lib/publisher";
import { selector } from "@/lib/evm-tx";
import { INDEX } from "@/lib/set";

describe("the boards", () => {
  it("all field a legal deck", () => {
    // A deck the engine refuses is an opponent nobody can play, and it would
    // only show up when somebody tried.
    for (const board of BOARDS) {
      for (const seed of [0, 1, 2, 9_999]) {
        const deck = opponentDeck(CARDS, board, seed);
        expect(deckProblems(deck, INDEX), `${board.id} on seed ${seed}`).toEqual([]);
      }
    }
  });

  it("gives the Loaded Lions opponent every lion, which a preset cannot", () => {
    // The generator caps a deck at two cards of any one project, so a preset
    // biased towards the lions would field two of the eight. That cap is the
    // whole reason this board builds a family deck instead.
    const lions = boardOf("lions")!;
    const deck = opponentDeck(CARDS, lions, 1);
    const inIt = deck.filter((id) => id.startsWith("lions-"));
    expect(inIt).toHaveLength(8);
  });

  it("fields the same Loaded Lions deck whatever the match seed is", () => {
    // The seed it was measured on is worth forty points. Letting the match seed
    // reshuffle it would hand back exactly the variance the measurement removed,
    // and the difficulty would swing per match with nothing saying so.
    const lions = boardOf("lions")!;
    const first = opponentDeck(CARDS, lions, 1);
    const later = opponentDeck(CARDS, lions, 812_004);
    expect(later).toEqual(first);
  });

  it("varies the ordinary opponent with the seed, which is what it always did", () => {
    const bot = boardOf("bot")!;
    const decks = [1, 2, 3].map((seed) => opponentDeck(CARDS, bot, seed).join(","));
    expect(new Set(decks).size).toBeGreaterThan(1);
  });

  it("has ids the chain can hold", () => {
    // bytes32 is 32 bytes. An id that does not fit is a week that cannot be
    // closed, discovered once a week and after everybody has played.
    for (const board of BOARDS) {
      expect(new TextEncoder().encode(board.id).length).toBeLessThanOrEqual(32);
      expect(asWord(board.id)).toHaveLength(64);
    }
  });

  it("shares out less than the whole pot, so it never runs dry", () => {
    // The contract refuses more than 10,000 between them, and refusing is the
    // wrong place to find out: setShare reverts on the second of two and leaves
    // the shares half moved. What is not shared out stays in the pot and grows,
    // which is the point rather than a leftover.
    const out = BOARDS.reduce((sum, board) => sum + board.shareBps, 0);
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThanOrEqual(10_000);
  });

  it("never lets a paid board outrank a free one for the shared pot", () => {
    // This asked for STRICTLY less, on the reasoning that a board charging to
    // play and taking as much of the shared pot as a free board is paid for
    // twice — the second time out of the free board's share.
    //
    // What changed is where the second payment comes from. Loaded Lions has a
    // pot of its own now, filled by its own entry fees and paid in its own
    // token: charging buys that, not a bigger slice of what everybody plays
    // for. So equal shares of the shared pot is the honest arrangement, and it
    // is what the market board dropping from 25% to 10% in September 2026 made
    // true of both boards.
    //
    // MORE is still wrong, and that is what this holds. A paid board taking a
    // bigger cut than the board anybody can walk up to would be charging for
    // the privilege of being charged.
    for (const board of BOARDS) {
      if (board.entry === null) continue;
      const free = BOARDS.filter((other) => other.entry === null);
      for (const other of free) {
        expect(board.shareBps, `${board.id} charges and takes more than ${other.id}`)
          .toBeLessThanOrEqual(other.shareBps);
      }
    }
  });

  it("leaves most of the pot in the pot, so next week is worth more", () => {
    // The point of the September 2026 cut. What is not shared out stays and
    // grows, so the prize somebody plays for next week is bigger than the one
    // they played for this week — which is the direction a pot wants to move
    // while a game is finding its players. Said as a number here so that adding
    // a third board cannot quietly give the whole pot away.
    const out = BOARDS.reduce((sum, board) => sum + board.shareBps, 0);
    expect(out).toBeLessThanOrEqual(3_000);
  });

  it("gives a board with its own pot a reason to have one", () => {
    // Its own pot is all of it — one board in it, nothing to divide — so a
    // board that charges has somewhere for the money to land that is not the
    // pot everybody else is already playing for.
    for (const board of BOARDS) {
      if (board.entry === null) continue;
      expect(board.alsoPays, `${board.id} charges but pays nothing extra`).not.toBeNull();
    }
  });

  it("gives a board with its own pot its own channel", () => {
    // A board with an entry fee and a prize of its own is its own competition.
    // Its results went to the channel named after the free board, where every
    // line had to be read twice to see which one it was about — the same thing
    // lib/pve.ts warns about for leaderboards, one room instead of one table.
    for (const board of BOARDS) {
      if (board.alsoPays === null) continue;
      expect(board.channel, `${board.id} shares a channel with the free board`)
        .not.toBe("DISCORD_SOLO");
    }
  });

  it("names a secret rather than carrying a webhook", () => {
    // A webhook is a password: anybody holding one can post into that channel
    // as that webhook, for ever. This file is in the repository.
    for (const board of BOARDS) {
      expect(board.channel).toMatch(/^DISCORD_[A-Z_]+$/);
      expect(board.channel).not.toMatch(/https?:/);
    }
  });

  it("keeps the plain board called what every existing score is filed under", () => {
    // db/schema.sql defaults the column to 'bot' so the rows written before
    // boards existed stay where they are. Renaming it here orphans all of them.
    expect(boardOf("bot")).toBeDefined();
    expect(BOARDS[0]!.id).toBe("bot");
    expect(boardOf("bot")!.needs).toBeNull();
  });
});

describe("closing a week on chain", () => {
  /**
   * The encoding, checked piece by piece.
   *
   * Two dynamic arrays in one call, encoded by hand. The second array's offset
   * depends on how long the first one is, and getting it wrong produces a
   * transaction that reverts with nothing useful in it — which is why this is
   * pulled apart rather than compared against one long string somebody pasted.
   */
  it("puts both arrays where the head says they are", () => {
    const data = closeWeekData("2026-W38", ["bot", "lions"], [
      "0x" + "1".repeat(40),
      "0x" + "2".repeat(40),
    ]);

    expect(data.slice(0, 10)).toBe(selector("closeWeek(bytes32,bytes32[],address[])"));

    const body = data.slice(10);
    const wordAt = (i: number) => body.slice(i * 64, (i + 1) * 64);
    const at = (i: number) => Number(BigInt("0x" + wordAt(i)));

    expect(wordAt(0)).toBe(asWord("2026-W38"));
    // Offsets are counted in bytes from the start of the body, so a word is 32.
    expect(at(1)).toBe(96);
    expect(at(1) / 32).toBe(3);
    expect(at(2)).toBe(96 + 32 + 2 * 32);

    // The boards array: its length, then its elements.
    expect(at(at(1) / 32)).toBe(2);
    expect(wordAt(at(1) / 32 + 1)).toBe(asWord("bot"));
    expect(wordAt(at(1) / 32 + 2)).toBe(asWord("lions"));

    // The winners array, in the same shape.
    expect(at(at(2) / 32)).toBe(2);
    expect(wordAt(at(2) / 32 + 1).slice(24)).toBe("1".repeat(40));
    expect(wordAt(at(2) / 32 + 2).slice(24)).toBe("2".repeat(40));
  });

  it("moves the second array when the first one grows", () => {
    // The bug this catches: an offset written as a constant. One board and three
    // boards must not put the winners in the same place.
    const one = closeWeekData("2026-W38", ["bot"], ["0x" + "1".repeat(40)]);
    const three = closeWeekData("2026-W38", ["a", "b", "c"], [
      "0x" + "1".repeat(40),
      "0x" + "2".repeat(40),
      "0x" + "3".repeat(40),
    ]);
    const offset = (data: string) => Number(BigInt("0x" + data.slice(10).slice(128, 192)));
    expect(offset(one)).toBe(96 + 32 + 32);
    expect(offset(three)).toBe(96 + 32 + 96);
    expect(offset(three)).toBeGreaterThan(offset(one));
  });

  it("is a whole number of words, always", () => {
    for (const boards of [["bot"], ["bot", "lions"], ["a", "b", "c", "d"]]) {
      const data = closeWeekData("2026-W38", boards, boards.map(() => "0x" + "1".repeat(40)));
      expect((data.length - 10) % 64).toBe(0);
    }
  });

  it("writes a label as readable bytes rather than a hash", () => {
    // So a board name in a transaction on an explorer is a word somebody can
    // read. "bot" is 0x626f74 followed by zeroes.
    expect(asWord("bot").slice(0, 6)).toBe("626f74");
    expect(asWord("bot").slice(6)).toBe("0".repeat(58));
  });

  it("refuses a label too long to be a word", () => {
    expect(() => asWord("x".repeat(33))).toThrow(/fit in a word/i);
  });
});

describe("the contract and the boards agree", () => {
  it("keys a prize by week and board, the way this file writes it", () => {
    // Two files holding one shape. If the contract went back to one key, every
    // call built here would be malformed and the revert would say nothing about
    // which side was wrong.
    const source = readFileSync(new URL("../contracts/PrizePot.sol", import.meta.url), "utf8");
    expect(source).toMatch(/mapping\(bytes32 => mapping\(bytes32 => Prize\)\) public prizes/);
    expect(source).toMatch(/function closeWeek\(\s*bytes32 week,\s*bytes32\[\] calldata boards,\s*address\[\] calldata winners\s*\)/);
    expect(source).toMatch(/function claim\(bytes32 week, bytes32 board\)/);
  });

  it("lets the owner set a share and nobody else", () => {
    const source = readFileSync(new URL("../contracts/PrizePot.sol", import.meta.url), "utf8");
    expect(source).toMatch(/function setShare\(bytes32 board, uint256 bps\) external onlyOwner/);
    // The publisher is what lives on a server. A key that could also decide how
    // the money is divided is a key worth stealing.
    expect(source).not.toMatch(/setShare[^}]*msg\.sender != publisher/);
  });
});

describe("a demo match", () => {
  it("faces the opponent that was picked, not one of its own", () => {
    // It built its own opponent regardless of the board, so somebody who chose
    // Loaded Lions and pressed the demo button played something else with
    // nothing on the page saying so.
    const lions = boardOf("lions")!;
    const { opponent } = demoDecks(1, lions);
    expect(opponent.filter((id) => id.startsWith("lions-"))).toHaveLength(8);
    expect(opponent).toEqual(opponentDeck(CARDS, lions, 1));
  });

  it("still refuses to be a mirror match on the plain board", () => {
    // The reason demoDecks existed at all: the borrowed deck has a theme, and
    // the opponent is drawn from the themes that are not it. A family board has
    // one deck by design and that rule does not apply to it.
    const bot = boardOf("bot")!;
    const { you, opponent } = demoDecks(3, bot);
    expect(you.length).toBe(RULES.deckSize);
    expect(opponent.length).toBe(RULES.deckSize);
    expect(opponent).not.toEqual(you);
  });

  it("deals two legal decks either way", () => {
    for (const board of BOARDS) {
      for (const seed of [0, 5, 77]) {
        const { you, opponent } = demoDecks(seed, board);
        expect(deckProblems(you, INDEX), `${board.id} your deck`).toEqual([]);
        expect(deckProblems(opponent, INDEX), `${board.id} the opponent`).toEqual([]);
      }
    }
  });
});
