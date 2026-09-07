import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { applyEffect, assertNever } from "@/engine/effects";
import { applyMove, buildIndex, budgetForTurn, newMatch } from "@/engine/match";
import type { Card, Effect, State } from "@/engine/types";
import { IllegalMove, RULES } from "@/engine/types";
import { SetError, validateSet } from "@/engine/validation";
import { SOLO, SOLO_A, SOLO_B, SOLO_C, soloOfSector, solosOfSector } from "./one-per-project";

const NFT_PROJECT = soloOfSector("nft");
const DEFI_PROJECT = soloOfSector("defi");
// Two of them, and different projects: the cross-board test needs a meme on each
// side, and the first two cards of the set are not both memes.
const [MEME_A, MEME_B] = solosOfSector("meme", 2) as [string, string];
const index = buildIndex(CARDS);
const source = CARDS.find((c) => c.id === "fud")!;

/**
 * Lesson one from Cards of Cronos: a name the engine didn't recognise silently
 * fell through to "do nothing" while the log reported "triggered". These tests
 * pin down that every unknown case throws here.
 */
describe("unknown values fail loudly", () => {
  it("an effect kind that doesn't exist throws when applied", () => {
    const state = newMatch(CARDS, 1);
    const invented = { kind: "pumpTheWholeChain", mc: 999 } as unknown as Effect;

    expect(() => applyEffect(state, invented, "you", source, undefined, index)).toThrowError(
      /Unknown case in applyEffect/,
    );
  });

  it("assertNever always throws, with the value included", () => {
    expect(() => assertNever("something" as never, "test")).toThrowError(/Unknown case in test/);
  });

  it("an unknown card id throws on lookup", () => {
    const state = newMatch(CARDS, 1);
    state.players.you.hand[0] = "card-that-does-not-exist";

    expect(() => applyMove(state, { kind: "playCard", handIndex: 0 }, index)).toThrowError(
      /Unknown card id/,
    );
  });

  it("a card that can't do anything is rejected by validateSet", () => {
    const dead: Card = {
      id: "dead-card",
      type: "tactic",
      name: "Dead Card",
      ticker: "DEAD",
      rarity: "common",
      effect: { kind: "directMC", target: "self", mc: 0 },
      flavour: "Does nothing, and that isn't allowed.",
    };

    expect(() => validateSet([...CARDS, dead])).toThrowError(SetError);
    expect(() => validateSet([...CARDS, dead])).toThrowError(/does nothing/);
  });

  it("an aura on a sector with no projects is rejected", () => {
    const pointless: Card = {
      id: "pointless-influencer",
      type: "influencer",
      name: "Pointless Influencer",
      ticker: "NOTHING",
      rarity: "common",
      aura: { kind: "pumpSector", sector: "dex", bonus: 5_000 },
      flavour: "Pumps a sector with nothing in it.",
    };

    // DEX does exist in the real set, so we test against a set with every
    // dex project stripped out — otherwise the test would prove nothing.
    const withoutDex = CARDS.filter((c) => c.type !== "project" || c.sector !== "dex");
    expect(withoutDex.length).toBeLessThan(CARDS.length);
    expect(() => validateSet([...withoutDex, pointless])).toThrowError(/This card does nothing/);
  });
});

describe("illegal moves throw instead of being ignored", () => {
  it("a hand slot that doesn't exist", () => {
    const state = newMatch(CARDS, 1);
    expect(() => applyMove(state, { kind: "playCard", handIndex: 99 }, index)).toThrowError(
      IllegalMove,
    );
  });

  it("a card the turn's marketing budget cannot cover", () => {
    let state = newMatch(CARDS, 1);
    state = structuredClone(state);
    // Everything is spent, so nothing is affordable however cheap it is.
    state.budgetSpentThisTurn = state.budgetThisTurn;
    // And no free play, whatever the first-move rule is paying today. A card
    // played for nothing is affordable however empty the budget is, so leaving
    // this in the fixture's hands would let a rule change quietly answer the
    // question this test is asking about the price.
    state.freePlays[state.toMove] = 0;
    expect(() => applyMove(state, { kind: "playCard", handIndex: 0 }, index)).toThrowError(
      /is left this turn/,
    );
  });

  it("an attack card with no target", () => {
    const state = withHand("snipe", (s) => {
      s.players.opponent.projects = [
        { cardId: SOLO_A, holders: 3, extraPump: 0, earned: 40_000, playedOnTurn: 1 },
      ];
    });
    expect(() => applyMove(state, { kind: "playCard", handIndex: 0 }, index)).toThrowError(
      /has to point at a project/,
    );
  });

  it("an attack card aimed at a target that isn't there", () => {
    const state = withHand("snipe", (s) => {
      s.players.opponent.projects = [
        { cardId: SOLO_A, holders: 3, extraPump: 0, earned: 40_000, playedOnTurn: 1 },
      ];
    });
    expect(() =>
      applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 7 }, index),
    ).toThrowError(IllegalMove);
  });

  it("an attack card while the opponent's board is empty", () => {
    const state = withHand("rug-pull");
    expect(() =>
      applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index),
    ).toThrowError(/board is empty/);
  });
});

describe("market cap can't go below zero", () => {
  it("a dump card on an empty position reports there was nothing to take", () => {
    const state = withHand("whale-dump", (s) => {
      s.players.opponent.mc = 0;
    });

    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.opponent.mc).toBe(0);

    const last = after.log[after.log.length - 1]!;
    expect(last.text).toMatch(/nothing to take/);
    // Not green: nothing was pumped.
    expect(last.tone).toBe("neutral");
  });

  it("never takes more than is there", () => {
    const state = withHand("whale-dump", (s) => {
      s.players.opponent.mc = 30_000;
    });

    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.opponent.mc).toBe(0);
    expect(after.log[after.log.length - 1]!.text).toContain("-$30K");
  });
});

/**
 * A rug takes back everything the position produced.
 *
 * That is what makes market cap mean what its name says: the value of what you
 * are holding, not a running total of everything you ever earned. Closing a
 * position yourself banks the same amount — realised against unrealised is the
 * decision the whole game turns on.
 */
describe("rug", () => {
  it("takes the project off the board and the MC it produced with it", () => {
    const state = withHand("rug-pull", (s) => {
      s.players.opponent.mc = 300_000;
      s.players.opponent.projects = [
        { cardId: SOLO_C, holders: 5, extraPump: 0, earned: 185_000, playedOnTurn: 1 },
      ];
    });

    const after = applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index);
    expect(after.players.opponent.projects).toHaveLength(0);
    expect(after.players.opponent.mc).toBe(300_000 - 185_000);
    // The line has to open with the card that did it. It used to open with the
    // word RUG, which reads as the Rug Pull card whatever actually caused it —
    // the maker watched three positions go to a PNUT and reported a rug.
    const line = after.log.find((e) => e.text.includes("-$185K"))!;
    expect(line.text.startsWith("Rug Pull rugs")).toBe(true);
  });

  it("also happens when damage brings holders to zero", () => {
    const state = withHand("snipe", (s) => {
      s.players.opponent.mc = 200_000;
      s.players.opponent.projects = [
        { cardId: SOLO_A, holders: 2, extraPump: 0, earned: 90_000, playedOnTurn: 1 },
      ];
    });

    const after = applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index);
    expect(after.players.opponent.projects).toHaveLength(0);
    expect(after.players.opponent.mc).toBe(110_000);

    // And it says holders rather than claiming a rug card was played, because
    // this is the case that had the maker looking for a Rug Pull that was never
    // in the opponent's hand.
    const line = after.log.find((e) => e.text.includes("no holders") || e.text.includes("last holders"))!;
    expect(line, "a project dying of damage says so").toBeDefined();
    expect(line.text.startsWith("Snipe takes the last holders off")).toBe(true);
  });

  it("never drags market cap below zero", () => {
    const state = withHand("rug-pull", (s) => {
      s.players.opponent.mc = 20_000;
      s.players.opponent.projects = [
        { cardId: SOLO_C, holders: 5, extraPump: 0, earned: 500_000, playedOnTurn: 1 },
      ];
    });

    const after = applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index);
    expect(after.players.opponent.mc).toBe(0);
  });

  it("a position you close yourself keeps its market cap", () => {
    const state = structuredClone(newMatch(CARDS, 3)) as State;
    state.budgetThisTurn = budgetForTurn(RULES.turns);
    state.players.you.mc = 400_000;
    // Six unrelated projects, and the card in hand is a seventh, so the portfolio
    // cap is what this hits rather than the one-position rule.
    state.players.you.projects = SOLO.slice(0, RULES.portfolioSize).map((cardId) => ({
      cardId,
      holders: 2,
      extraPump: 0,
      earned: 60_000,
      playedOnTurn: 1,
    }));
    const played = CARDS.find((c) => c.id === SOLO[RULES.portfolioSize])!;
    state.players.you.hand = [played.id, "ape-in"];

    // closeIndex, not targetIndex. TCG split the two so one number could not be
    // counted against two different lists; choosing a position to close is its
    // own field, and targetIndex is counted against the board being attacked.
    const after = applyMove(state, { kind: "playCard", handIndex: 0, closeIndex: 0 }, index);

    // Closing banked the 60K; only the new card's launch was added. Nothing lost.
    expect(played.type).toBe("project");
    expect(after.players.you.mc).toBe(
      400_000 + (played.type === "project" ? played.launchMC : 0),
    );
    expect(after.log.some((e) => e.text.includes("realised and banked"))).toBe(true);
  });
});

describe("a pump that reads the sector", () => {
  /**
   * A card made up for the test rather than one from the set.
   *
   * The two-sector case used to be tested through Elon Posts, which then carried
   * a meme tier and a dog tier. Folding dog into meme left that card with one
   * sector and broke a test about a mechanic — so the mechanic gets a card of its
   * own, and the set card gets tested for what it actually does.
   */
  const TWO_SECTORS: Card = {
    id: "test-two-sectors",
    type: "event",
    name: "Two Sectors",
    ticker: "TWO",
    rarity: "epic",
    effect: {
      kind: "pumpBySector",
      target: "allProjects",
      bonuses: { meme: 11_000, nft: 3_000 },
    },
    flavour: "",
  };
  const withTest = buildIndex([...CARDS, TWO_SECTORS]);

  /** Three of our own projects, one per sector, plus a meme on the far board. */
  function mixedTable(handCard: string): State {
    const state = structuredClone(newMatch(CARDS, 7)) as State;
    state.budgetThisTurn = budgetForTurn(RULES.turns);
    state.players.you.hand = [handCard];
    state.players.you.projects = [
      { cardId: MEME_A, holders: 4, extraPump: 0, earned: 0, playedOnTurn: 1 },
      { cardId: NFT_PROJECT, holders: 3, extraPump: 0, earned: 0, playedOnTurn: 1 },
      { cardId: DEFI_PROJECT, holders: 3, extraPump: 0, earned: 0, playedOnTurn: 1 },
    ];
    state.players.opponent.projects = [
      { cardId: MEME_B, holders: 2, extraPump: 0, earned: 0, playedOnTurn: 1 },
    ];
    return state;
  }

  it("pays each sector its own amount and leaves the rest alone", () => {
    const after = applyMove(mixedTable("test-two-sectors"), { kind: "playCard", handIndex: 0 }, withTest);
    const [meme, machine, memetility] = after.players.you.projects;

    expect(meme!.extraPump).toBe(11_000);
    expect(machine!.extraPump).toBe(3_000);
    expect(memetility!.extraPump).toBe(0); // defi is not listed
  });

  it("reaches both boards, which is what makes it an event", () => {
    const state = mixedTable("elon-posts");
    const elon = CARDS.find((c) => c.id === "elon-posts")!;
    if (elon.effect?.kind !== "pumpBySector") throw new Error("Elon Posts should pump by sector.");
    const meme = elon.effect.bonuses.meme;
    if (meme === undefined) throw new Error("Elon Posts should pump memes.");

    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    // Read from the card: this is about the effect crossing the table, not about
    // what the card is worth after the latest balance pass.
    expect(after.players.opponent.projects[0]!.extraPump).toBe(meme);
    expect(after.players.you.projects[0]!.extraPump).toBe(meme);
  });

  it("says so in the log when it touched nothing", () => {
    // The whole Cards of Cronos lesson in one test: a card that finds no valid
    // target must say that, not write a line implying it worked.
    const state = structuredClone(newMatch(CARDS, 7)) as State;
    state.budgetThisTurn = budgetForTurn(RULES.turns);
    state.players.you.hand = ["elon-posts"];
    state.players.you.projects = [
      { cardId: DEFI_PROJECT, holders: 3, extraPump: 0, earned: 0, playedOnTurn: 1 },
    ];
    state.players.opponent.projects = [];

    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.you.projects[0]!.extraPump).toBe(0);
    expect(after.log.some((e) => e.text.includes("nothing on the table is in a sector"))).toBe(true);
  });

  it("refuses a card that lists no sectors at all", () => {
    const dead: Card = { ...TWO_SECTORS, id: "test-empty", effect: { kind: "pumpBySector", target: "allProjects", bonuses: {} } };
    expect(() => validateSet([dead])).toThrowError(/lists no sectors/);
  });

  it("refuses a sector listed at zero", () => {
    const dead: Card = { ...TWO_SECTORS, id: "test-zero", effect: { kind: "pumpBySector", target: "allProjects", bonuses: { meme: 0 } } };
    expect(() => validateSet([dead])).toThrowError(/amount of zero/);
  });
});

function withHand(cardId: string, tweak?: (s: State) => void): State {
  const state = structuredClone(newMatch(CARDS, 7)) as State;
  // These setups are about effects rather than about the economy, so they get
  // the last turn's budget, which pays for anything in the set.
  state.budgetThisTurn = budgetForTurn(RULES.turns);
  state.players.you.hand = [cardId, "ape-in", "jeet"];
  tweak?.(state);
  return state;
}
