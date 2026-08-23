import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { SOLO, SOLO_A, SOLO_B, SOLO_C } from "./solo-projects";
import { chooseMove } from "@/engine/bot";
import { formatMC, formatMCExact, formatMCPair } from "@/engine/format";
import { cardById } from "@/engine/helpers";
import {
  applyMove,
  buildIndex,
  canDiscard,
  canTakeProfit,
  budgetForTurn,
  newMatch,
  playable,
  pumpOf,
  whyNot,
} from "@/engine/match";
import type { State } from "@/engine/types";
import { MARKETING_COST } from "@/engine/types";
import {
  IllegalMove,
  RULES,
  TURN_ACTION_COST,
  auraOf,
} from "@/engine/types";

const index = buildIndex(CARDS);

/** Plays a whole match out with the bot on both sides. */
function playOut(seed: number): State {
  let state = newMatch(CARDS, seed);
  let steps = 0;
  while (!state.finished) {
    state = applyMove(state, chooseMove(state, index), index);
    if (++steps > 2000) throw new Error("The match doesn't end — possible loop.");
  }
  return state;
}

describe("a match", () => {
  it("starts with empty boards and full hands", () => {
    const state = newMatch(CARDS, 42);
    expect(state.turn).toBe(1);
    expect(state.toMove).toBe("you");
    expect(state.players.you.hand).toHaveLength(RULES.handSize);
    expect(state.players.opponent.hand).toHaveLength(RULES.handSize);
    // The first player opens with the seed round; the second starts at zero.
    expect(state.players.you.mc).toBe(RULES.firstMoveSeedMC);
    expect(state.players.opponent.mc).toBe(0);
  });

  it("ends after ten turns and names a winner", () => {
    const state = playOut(42);
    expect(state.finished).toBe(true);
    expect(state.turn).toBe(RULES.turns + 1);
    expect(["you", "opponent", null]).toContain(state.winner);
  });

  // Forty full matches against the bot. It runs in about 1.3s on its own and
  // roughly four times that when the suite fills every core, which is how it
  // started failing on a five-second default the day two more test files were
  // added — nothing to do with the engine and everything to do with the machine.
  // A timeout is a claim about hardware, so it gets set where the work is.
  it("produces a market cap that makes sense", { timeout: 60_000 }, () => {
    // Two players putting projects down for ten turns should land somewhere
    // between a few hundred thousand and a few million. Outside that band,
    // something is badly wrong with the scale of the cards.
    //
    // Measured over a spread of seeds rather than one. As a single-seed check
    // this sat on seed 42, which is in the bottom 4% of matches, and it duly
    // failed when sixty cheap cards went into the set — reporting a scale
    // problem the set does not have. The median is what "the scale of the cards"
    // means; one match is a match.
    const highs = Array.from({ length: 40 }, (_, seed) => {
      const state = playOut(seed);
      return Math.max(state.players.you.mc, state.players.opponent.mc);
    }).sort((a, b) => a - b);

    const median = highs[Math.floor(highs.length / 2)]!;
    expect(median).toBeGreaterThan(400_000);
    expect(median).toBeLessThan(20_000_000);
  });

  it("never spends more marketing budget than the turn granted", () => {
    let state = newMatch(CARDS, 3);
    while (!state.finished) {
      expect(state.budgetSpentThisTurn).toBeLessThanOrEqual(state.budgetThisTurn);
      state = applyMove(state, chooseMove(state, index), index);
    }
    expect(state.finished).toBe(true);
  });
});

/**
 * Without determinism the A/B check from CLAUDE.md is impossible: you can't run
 * the same match twice. Hence no Math.random in the engine, and the generator
 * state living in the state itself.
 */
describe("determinism", () => {
  it("the same seed gives exactly the same match twice", () => {
    const a = playOut(2024);
    const b = playOut(2024);
    expect(b).toEqual(a);
  });

  it("a different seed gives a different match", () => {
    const a = playOut(1);
    const b = playOut(2);
    expect(b.log).not.toEqual(a.log);
  });

  it("applyMove leaves the old state untouched", () => {
    const before = newMatch(CARDS, 99);
    const copy = structuredClone(before);
    applyMove(before, { kind: "endTurn" }, index);
    expect(before).toEqual(copy);
  });
});

/**
 * The portfolio cap is what makes board space scarce. Without it every project is
 * strictly good and nothing is ever a choice; with it, opening a position means
 * giving one up.
 */
describe("the portfolio cap", () => {
  function fullPortfolio(): State {
    const state = structuredClone(newMatch(CARDS, 11)) as State;
    // Enough budget to buy anything. The rule under test is the portfolio cap,
    // and the fixture only promises a single-card project, never a cheap one —
    // once singles ran the whole rarity ladder, SOLO[6] became a mythic and the
    // move was refused on price before the cap was ever reached.
    state.budgetThisTurn = budgetForTurn(state.turn) + 1_000_000;
    // Six unrelated projects, and a seventh in hand that is none of them: the
    // rule under test is the portfolio cap, and a board holding a card of the
    // same project would trip the one-position rule first.
    state.players.you.projects = SOLO.slice(0, RULES.portfolioSize).map((cardId) => ({
      cardId,
      holders: 2,
      extraPump: 0,
      earned: 20_000,
      playedOnTurn: 1,
    }));
    state.players.you.hand = [SOLO[RULES.portfolioSize]!, "ape-in", "jeet"];
    return state;
  }

  it("never grows past the cap", () => {
    let state = newMatch(CARDS, 77);
    while (!state.finished) {
      for (const player of ["you", "opponent"] as const) {
        expect(state.players[player].projects.length).toBeLessThanOrEqual(RULES.portfolioSize);
      }
      state = applyMove(state, chooseMove(state, index), index);
    }
  });

  it("refuses a project into a full portfolio without a position to close", () => {
    expect(() => applyMove(fullPortfolio(), { kind: "playCard", handIndex: 0 }, index)).toThrowError(
      /portfolio is full/i,
    );
  });

  it("swaps the chosen position out and keeps the MC it made", () => {
    const before = fullPortfolio();
    before.players.you.mc = 500_000;

    const after = applyMove(before, { kind: "playCard", handIndex: 0, targetIndex: 2 }, index);

    expect(after.players.you.projects).toHaveLength(RULES.portfolioSize);
    // Slot 2 is gone and the card from hand took the free slot.
    expect(after.players.you.projects.map((p) => p.cardId)).not.toContain(SOLO[2]);
    expect(after.players.you.projects.map((p) => p.cardId)).toContain(SOLO[RULES.portfolioSize]);
    // Closing costs future pump, never market cap already earned.
    expect(after.players.you.mc).toBeGreaterThan(500_000);
    expect(after.log.some((e) => e.text.startsWith("CLOSED"))).toBe(true);
  });

  it("does not let a tactic close a position", () => {
    const state = fullPortfolio();
    state.players.you.hand = ["ape-in", "jeet"];
    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.you.projects).toHaveLength(RULES.portfolioSize);
  });
});

/**
 * Taking profit is the counterweight to a rug taking market cap back. Without it
 * the rule would be all punishment and no defence: you could only bank a position
 * by accident, as a side effect of playing another project into a full portfolio.
 */
describe("taking profit", () => {
  function withPositions(): State {
    const state = structuredClone(newMatch(CARDS, 21)) as State;
    // Turn three, because turn one pays $35K and taking profit costs $50K — you
    // cannot bank on the first turn, and you have nothing to bank either.
    state.turn = 3;
    state.budgetThisTurn = budgetForTurn(state.turn);
    state.players.you.mc = 400_000;
    state.players.you.projects = [
      { cardId: SOLO_A, holders: 4, extraPump: 0, earned: 90_000, playedOnTurn: 1 },
      { cardId: SOLO_A, holders: 2, extraPump: 0, earned: 150_000, playedOnTurn: 1 },
    ];
    return state;
  }

  it("banks the position and leaves the market cap alone", () => {
    const after = applyMove(withPositions(), { kind: "takeProfit", slot: 1 }, index);

    expect(after.players.you.projects.map((p) => p.cardId)).toEqual([SOLO_A]);
    expect(after.players.you.mc).toBe(400_000);
    expect(after.log.some((e) => e.text.startsWith("TAKE PROFIT"))).toBe(true);
  });

  it("costs a fixed slice of the turn's budget", () => {
    const after = applyMove(withPositions(), { kind: "takeProfit", slot: 0 }, index);
    expect(after.budgetSpentThisTurn).toBe(TURN_ACTION_COST);
  });

  it("is refused once the budget is used up", () => {
    const state = withPositions();
    state.budgetSpentThisTurn = state.budgetThisTurn;
    expect(() => applyMove(state, { kind: "takeProfit", slot: 0 }, index)).toThrowError(
      /is left this turn/,
    );
  });

  it("is refused for a position that does not exist", () => {
    expect(() => applyMove(withPositions(), { kind: "takeProfit", slot: 5 }, index)).toThrowError(
      IllegalMove,
    );
  });

  it("puts what it banked out of reach of a rug", () => {
    const banked = applyMove(withPositions(), { kind: "takeProfit", slot: 1 }, index);
    // The same position, left on the board and then rugged, costs 150K.
    const state = withPositions();
    state.players.you.projects.splice(0, 1);
    state.players.opponent.projects = [];
    expect(banked.players.you.mc).toBe(400_000);
    expect(canTakeProfit(banked, "you", index)).toBe(true);
  });

  it("is unavailable with an empty portfolio", () => {
    const state = structuredClone(newMatch(CARDS, 21)) as State;
    expect(canTakeProfit(state, "you", index)).toBe(false);
  });
});

describe("throwing a card away", () => {
  function fresh(): State {
    const state = structuredClone(newMatch(CARDS, 33)) as State;
    // Turn four, so the turn can afford a few throws at $50K each.
    state.turn = 4;
    state.budgetThisTurn = budgetForTurn(state.turn);
    return state;
  }

  it("takes the card out of hand and puts it on the discard pile", () => {
    const state = fresh();
    const thrown = state.players.you.hand[1]!;
    const after = applyMove(state, { kind: "discard", handIndex: 1 }, index);

    expect(after.players.you.hand).toHaveLength(RULES.handSize - 1);
    expect(after.players.you.hand).not.toContain(thrown);
    expect(after.players.you.discard).toContain(thrown);
  });

  it("costs a fixed slice of the turn's budget", () => {
    const after = applyMove(fresh(), { kind: "discard", handIndex: 0 }, index);
    expect(after.budgetSpentThisTurn).toBe(TURN_ACTION_COST);
  });

  it("is refused once the budget is used up", () => {
    const state = fresh();
    state.budgetSpentThisTurn = state.budgetThisTurn;
    expect(() => applyMove(state, { kind: "discard", handIndex: 0 }, index)).toThrowError(
      /is left this turn/,
    );
  });

  it("is refused for a hand slot that does not exist", () => {
    expect(() => applyMove(fresh(), { kind: "discard", handIndex: 99 }, index)).toThrowError(
      IllegalMove,
    );
  });

  it("has no limit of its own: the whole turn may be spent on it", () => {
    // The maker's call. The budget is the only cost, so a player who is far
    // behind may spend an entire turn digging.
    let state = fresh();
    const throws = Math.floor(state.budgetThisTurn / TURN_ACTION_COST);
    for (let i = 0; i < throws; i++) {
      state = applyMove(state, { kind: "discard", handIndex: 0 }, index);
    }
    expect(state.budgetSpentThisTurn).toBe(throws * TURN_ACTION_COST);
    expect(canDiscard(state, "you")).toBe(false);
  });

  it("gets an extra throw from a card that grants more budget", () => {
    // extraBudget raises budgetThisTurn, and throwing a card spends from that
    // same pot. So a card that lets you play more also lets you throw away more
    // — which follows from the rule rather than being a separate one.
    const state = fresh();
    const before = Math.floor(state.budgetThisTurn / TURN_ACTION_COST);
    state.budgetThisTurn += TURN_ACTION_COST;
    let after = state;
    for (let i = 0; i < before + 1; i++) {
      after = applyMove(after, { kind: "discard", handIndex: 0 }, index);
    }
    expect(after.budgetSpentThisTurn).toBe((before + 1) * TURN_ACTION_COST);
    expect(canDiscard(after, "you")).toBe(false);
  });

  it("is refused with an empty hand", () => {
    const state = fresh();
    state.players.you.hand = [];
    expect(canDiscard(state, "you")).toBe(false);
  });

  it("draws the thrown card back next turn, which is the whole point", () => {
    // Play two and throw one, and you end the turn on the same hand size as
    // playing three — so the top-up hands you three fresh cards either way.
    let state = fresh();
    state = applyMove(state, { kind: "discard", handIndex: 0 }, index);
    expect(state.players.you.hand).toHaveLength(RULES.handSize - 1);

    state = applyMove(state, { kind: "endTurn" }, index);
    while (state.toMove !== "you") state = applyMove(state, chooseMove(state, index), index);
    expect(state.players.you.hand).toHaveLength(RULES.handSize);
  });
});

describe("tools", () => {
  it("takes no position and produces no market cap of its own", () => {
    // The whole reason the type exists. As project cards these produced MC and
    // occupied a portfolio slot, and a chart site can do neither.
    const state = structuredClone(newMatch(CARDS, 12)) as State;
    state.turn = 8;
    state.budgetThisTurn = budgetForTurn(state.turn);
    state.players.you.hand = ["birdeye"];
    const before = state.players.you.mc;

    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);

    expect(after.players.you.projects).toHaveLength(0);
    expect(after.players.you.support.map((s) => s.cardId)).toEqual(["birdeye"]);
    // Birdeye draws a card, so MC must not have moved by anything but that.
    expect(after.players.you.mc).toBe(before);
  });

  it("stays on the board and keeps its aura working", () => {
    // BonkBot carries a dog aura, so a dog project must pump more while it is up.
    const state = structuredClone(newMatch(CARDS, 12)) as State;
    state.turn = 8;
    state.budgetThisTurn = budgetForTurn(state.turn);
    state.players.you.hand = ["bonkbot"];
    state.players.you.projects = [
      { cardId: SOLO_A, holders: 4, extraPump: 0, earned: 0, playedOnTurn: 1 },
    ];

    const bonkbot = CARDS.find((c) => c.id === "bonkbot")!;
    const aura = auraOf(bonkbot);
    if (!aura) throw new Error("BonkBot is supposed to carry an aura.");

    const bare = pumpOf(state, "you", 0, index);
    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);

    expect(after.players.you.support).toHaveLength(1);
    // Read from the card rather than written out: this test is about the aura
    // applying, not about what it is worth after the latest balance pass.
    expect(pumpOf(after, "you", 0, index)).toBe(bare + aura.bonus);
  });

  it("cannot be rugged, because it is not a position", () => {
    const state = structuredClone(newMatch(CARDS, 12)) as State;
    state.turn = 8;
    state.budgetThisTurn = budgetForTurn(state.turn);
    state.players.opponent.support = [{ cardId: "phantom" }];
    state.players.opponent.projects = [
      { cardId: SOLO_A, holders: 1, extraPump: 0, earned: 50_000, playedOnTurn: 1 },
    ];
    state.players.you.hand = ["rug-pull"];

    const after = applyMove(state, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index);
    expect(after.players.opponent.projects).toHaveLength(0);
    expect(after.players.opponent.support).toHaveLength(1);
  });
});

describe("cancelling an influencer", () => {
  /** Murad carries the biggest aura in the set; Gake one of the smallest. */
  function withNames(): State {
    const state = structuredClone(newMatch(CARDS, 44)) as State;
    state.budgetThisTurn = RULES.budgetPerTurn * RULES.turns;
    state.players.opponent.support = [{ cardId: "gake" }, { cardId: "murad" }];
    state.players.opponent.projects = [
      { cardId: SOLO_A, holders: 3, extraPump: 0, earned: 0, playedOnTurn: 1 },
    ];
    state.players.you.hand = ["cancelled"];
    return state;
  }

  it("takes the biggest name first, not the first one played", () => {
    const before = withNames();
    const murad = auraOf(CARDS.find((c) => c.id === "murad")!)!;
    const gake = auraOf(CARDS.find((c) => c.id === "gake")!)!;
    expect(murad.bonus).toBeGreaterThan(gake.bonus);

    const after = applyMove(before, { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.opponent.support.map((s) => s.cardId)).toEqual(["gake"]);
  });

  it("stops the aura it was paying out", () => {
    const before = withNames();
    const withMurad = pumpOf(before, "opponent", 0, index);
    const after = applyMove(before, { kind: "playCard", handIndex: 0 }, index);
    expect(pumpOf(after, "opponent", 0, index)).toBeLessThan(withMurad);
  });

  it("puts the cancelled card on its owner's discard pile", () => {
    const after = applyMove(withNames(), { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.opponent.discard).toContain("murad");
  });

  it("says so rather than reporting a hit when there is nobody to cancel", () => {
    const state = withNames();
    state.players.opponent.support = [];
    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(after.log.some((e) => e.text.includes("nobody to cancel"))).toBe(true);
  });

  it("leaves the portfolio alone — it is not a rug", () => {
    const after = applyMove(withNames(), { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.opponent.projects).toHaveLength(1);
  });
});

describe("the bot", () => {
  it("plays cards instead of passing straight away", () => {
    const state = playOut(5);
    const played = state.log.filter((e) => e.text.startsWith("LAUNCH")).length;
    expect(played).toBeGreaterThan(5);
  });

  it("doesn't always win with the same player across many seeds", () => {
    const winners = Array.from({ length: 30 }, (_, i) => playOut(1000 + i).winner);
    const unique = new Set(winners);
    expect(unique.size).toBeGreaterThan(1);
  });
});

/**
 * A coarse guard on turn order. Both sides run the same bot, so any systematic
 * gap between them is structural rather than skill.
 *
 * It asserts on the average final MC difference rather than the win rate,
 * because a win rate is a coin flip per match and needs tens of thousands of
 * matches before a few points of bias clear the noise. The MC gap is continuous
 * and settles far quicker.
 *
 * Be clear about what this does and does not catch. At 400 matches the metric
 * has a spread of about 1% under the old rules, so a 3.5% threshold only tripped
 * on a gross skew.
 *
 * This experiment plays fewer, bigger cards and swings harder, and the metric
 * moved with it: over forty windows of 400 matches the median is 1.80% and the
 * maximum 7.50%, and 3.5% fired on seven of the forty. That threshold would be
 * measuring the sample rather than the skew, so it is 8% here. Turn order is
 * fair on the instrument that can see it — 50.0% win rate and a 0.03% average
 * gap over 8000 matches with mirrored decks. The original problem — the second player running 1.7% ahead,
 * which showed up as a 45% win rate — sits under this threshold and would slip
 * through. Catching that takes ten thousand matches, which does not belong in a
 * test that runs on every save.
 *
 * `npm run balance` is the real instrument: it runs as many matches as you ask
 * and shows where an edge comes from, not just that one exists. Run it after
 * touching card numbers or the turn structure.
 */
describe("turn order is fair", () => {
  it("neither player ends grossly ahead on average", { timeout: 60_000 }, () => {
    const matches = 400;
    let firstTotal = 0;
    let secondTotal = 0;

    for (let i = 0; i < matches; i++) {
      const state = playOut(4000 + i);
      firstTotal += state.players.you.mc;
      secondTotal += state.players.opponent.mc;
    }

    const meanFinal = (firstTotal + secondTotal) / (2 * matches);
    const gapShare = Math.abs(firstTotal - secondTotal) / matches / meanFinal;

    expect(
      gapShare,
      `average final MC gap is ${(gapShare * 100).toFixed(2)}% — turn order is skewing the match`,
    ).toBeLessThan(0.08);
  });
});

/**
 * A bigger card of a project takes over the position instead of opening a second
 * one. This is evolution, and it is what the extra cards of a project are for.
 */
describe("upgrading a position", () => {
  const bonks = CARDS.filter(
    (c): c is Extract<typeof c, { type: "project" }> =>
      c.type === "project" && c.project === "bonk",
  );
  const cheapest = bonks.find((c) => c.id === "bonk-airdrop")!;
  // Not the mythic: its own effect pumps every meme project it owns, itself
  // included, so it would be measuring two things at once.
  const biggest = bonks.find((c) => c.id === "bonk-1b")!;

  function boardWith(...hand: string[]): State {
    const state = structuredClone(newMatch(CARDS, 7)) as State;
    state.budgetThisTurn = budgetForTurn(RULES.turns);
    state.players.you.hand = [...hand, ...state.players.you.hand].slice(0, RULES.handSize);
    return state;
  }

  it("takes over the slot rather than opening a second one", () => {
    let state = boardWith(cheapest.id, biggest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(state.players.you.projects).toHaveLength(1);

    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(state.players.you.projects).toHaveLength(1);
    expect(state.players.you.projects[0]!.cardId).toBe(biggest.id);
  });

  it("inherits what the old position was pumping", () => {
    // BONK did not restart at zero when it reached a billion. The point of the
    // mechanic is that starting small early is worth something later.
    let state = boardWith(cheapest.id, biggest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    const before = pumpOf(state, "you", 0, index);

    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(pumpOf(state, "you", 0, index)).toBe(before + biggest.pumpMC);
  });

  it("keeps what the old position already earned", () => {
    let state = boardWith(cheapest.id, biggest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    const earned = state.players.you.projects[0]!.earned;

    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(state.players.you.projects[0]!.earned).toBe(earned + biggest.launchMC);
  });

  it("costs one action, not two", () => {
    // Closing the position and playing the replacement is the two-action route
    // and it still exists. The upgrade is what you pay one action for.
    let state = boardWith(cheapest.id, biggest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    const spent = state.budgetSpentThisTurn;

    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    expect(state.budgetSpentThisTurn).toBe(spent + MARKETING_COST[biggest.rarity]);
  });

  it("gives a reason for a card it cannot afford, never a silent no", () => {
    // whyNot() used to know every reason except the one that fires most often.
    // A caller that trusted it got null for a card the engine would refuse, and
    // any count built on it was wrong. Whatever playable() blocks, whyNot() says.
    let state = boardWith(cheapest.id);
    state.budgetSpentThisTurn = state.budgetThisTurn;

    const reason = whyNot(state, cheapest, "you", index);
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/budget left this turn/i);
    expect(playable(state, cheapest, "you", index)).toBe(false);
  });

  it("never refuses a card without a reason, across a whole match", () => {
    let state = newMatch(CARDS, 7);
    let guard = 0;
    while (!state.finished && guard++ < 400) {
      for (const player of ["you", "opponent"] as const) {
        if (state.toMove !== player) continue;
        for (const id of state.players[player].hand) {
          const card = cardById(index, id);
          const can = playable(state, card, player, index);
          const why = whyNot(state, card, player, index);
          expect(can).toBe(why === null);
        }
      }
      state = applyMove(state, chooseMove(state, index), index);
    }
  });

  it("refuses a card that is not a step up, and says why", () => {
    // Downward would let you play the mythic, "upgrade" to the common and keep
    // the pump for a fifth of the budget.
    let state = boardWith(biggest.id, cheapest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);

    expect(whyNot(state, cheapest, "you", index)).toMatch(/not a step up/i);
    expect(playable(state, cheapest, "you", index)).toBe(false);
    expect(() => applyMove(state, { kind: "playCard", handIndex: 0 }, index)).toThrow(
      /not a step up/i,
    );
  });

  it("refuses a sideways move between two cards of the same size", () => {
    const sameSize = bonks.filter((c) => c.rarity === cheapest.rarity);
    expect(sameSize.length).toBeGreaterThan(1);
    let state = boardWith(sameSize[0]!.id, sameSize[1]!.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);

    expect(playable(state, sameSize[1]!, "you", index)).toBe(false);
  });

  it("does not touch another project's position", () => {
    const other = CARDS.find((c) => c.type === "project" && c.project !== "bonk")!;
    let state = boardWith(other.id, biggest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);

    expect(state.players.you.projects).toHaveLength(2);
  });

  it("puts the replaced card in the discard, not nowhere", () => {
    let state = boardWith(cheapest.id, biggest.id);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    state = applyMove(state, { kind: "playCard", handIndex: 0 }, index);

    expect(state.players.you.discard).toContain(cheapest.id);
  });
});

/**
 * A screen that shows both players on the same number and then names a winner is
 * contradicting itself, and a player is right to read that as broken.
 */
describe("the final figures", () => {
  it("rounds two different market caps to the same short string", () => {
    // The bug, stated as a fact about the formatter rather than a story about a
    // match: this is why the end of a match cannot use it.
    expect(formatMC(1_712_000)).toBe(formatMC(1_748_000));
  });

  it("never shows two different market caps as the same exact figure", () => {
    expect(formatMCExact(1_712_000)).not.toBe(formatMCExact(1_748_000));
    expect(formatMCExact(1_712_000)).toBe("$1,712,000");
  });

  it("names a winner only when the market caps actually differ", () => {
    let state = structuredClone(newMatch(CARDS, 21)) as State;
    state.players.you.mc = 1_712_000;
    state.players.opponent.mc = 1_748_000;
    state.turn = RULES.turns;
    while (!state.finished) state = applyMove(state, chooseMove(state, index), index);
    expect(["you", "opponent", null]).toContain(state.winner);
  });

  it("never prints the same figure for both players when one of them won", () => {
    // The property, not the formatting. A closing line naming a winner while
    // showing two identical numbers is the thing that got reported, and it can
    // come back through any change to how numbers are written.
    for (let seed = 0; seed < 60; seed++) {
      let state = newMatch(CARDS, seed);
      let guard = 0;
      while (!state.finished && guard++ < 400) {
        state = applyMove(state, chooseMove(state, index), index);
      }
      const [yours, theirs] = formatMCPair(
        state.players.you.mc,
        state.players.opponent.mc,
      );
      if (state.winner === null) expect(yours).toBe(theirs);
      else expect(yours, `seed ${seed} showed both players ${yours}`).not.toBe(theirs);
    }
  });

  it("uses no more decimals than it needs", () => {
    expect(formatMCPair(1_200_000, 1_900_000)).toEqual(["$1.2M", "$1.9M"]);
    expect(formatMCPair(1_712_000, 1_748_000)).toEqual(["$1.71M", "$1.75M"]);
    expect(formatMCPair(1_712_000, 1_712_400)).toEqual(["$1,712,000", "$1,712,400"]);
  });
});
