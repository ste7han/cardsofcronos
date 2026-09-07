import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { AURA_BIGGEST, FAMILY_CARDS, SOLO, SOLO_A, SOLO_B, SOLO_C } from "./one-per-project";
import { cardById } from "@/engine/helpers";
import { auraSectors } from "@/engine/helpers";
import { applyMove, buildIndex, needsPortfolioSlot, newMatch, playable } from "@/engine/match";
import { mcDeltaOf, previewOf } from "@/engine/preview";
import type { ProjectCard, Sector, State } from "@/engine/types";
import { RULES, auraOf } from "@/engine/types";

const index = buildIndex(CARDS);

/** Two positions each, so both boards have something to point at. */
function board(): State {
  const state = structuredClone(newMatch(CARDS, 5)) as State;
  state.players.you.mc = 200_000;
  state.players.opponent.mc = 150_000;
  state.players.you.projects = [
    { cardId: SOLO_A, holders: 2, extraPump: 0, earned: 40_000, playedOnTurn: 1 },
    { cardId: SOLO_A, holders: 4, extraPump: 0, earned: 40_000, playedOnTurn: 1 },
  ];
  state.players.opponent.projects = [
    { cardId: SOLO_A, holders: 3, extraPump: 0, earned: 40_000, playedOnTurn: 1 },
    { cardId: SOLO_B, holders: 3, extraPump: 0, earned: 40_000, playedOnTurn: 1 },
  ];
  return state;
}

function preview(cardId: string, state = board()) {
  return previewOf(state, cardById(index, cardId), "you", index);
}

describe("the hover preview", () => {
  it("covers the opponent's whole board for a table-wide attack", () => {
    // Found by what it does, not by name. This was `paper-hands` until the day
    // that card stopped damaging positions, and the failure it produced was an
    // empty slot list in a test that is not about any particular card.
    const wide = CARDS.find(
      (c) => c.effect?.kind === "damageHolders" && c.effect.target === "allEnemyProjects",
    )!;
    const { slots } = preview(wide.id);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.owner === "opponent")).toBe(true);
    expect(slots.every((s) => s.impact === "hurts" && s.certain)).toBe(true);
  });

  it("covers both boards for an event", () => {
    const { slots } = preview("volatility");
    expect(slots).toHaveLength(4);
    expect(new Set(slots.map((s) => s.owner))).toEqual(new Set(["you", "opponent"]));
    expect(slots.every((s) => s.impact === "hurts")).toBe(true);
  });

  it("marks a single-target card as a choice rather than a certainty", () => {
    const { slots } = preview("snipe");
    expect(slots).toHaveLength(2);
    // Both are candidates; you will pick one. The preview must not claim to know
    // which, so nothing here is certain.
    expect(slots.every((s) => !s.certain)).toBe(true);
    expect(slots.every((s) => s.owner === "opponent")).toBe(true);
  });

  it("shows a heal as helping your own board", () => {
    const { slots } = preview("diamond-hands");
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.owner === "you" && s.impact === "helps")).toBe(true);
  });

  it("shows nothing on the board for a card that only moves market cap", () => {
    const { slots, players } = preview("ape-in");
    expect(slots).toHaveLength(0);
    expect(players).toEqual([{ player: "you", impact: "helps" }]);
  });

  it("shows both market caps moving for a market-wide swing", () => {
    const { players } = preview("bull-run");
    expect(players).toHaveLength(2);
    expect(players.every((p) => p.impact === "helps")).toBe(true);
  });

  it("shows a steal as one side up and the other down", () => {
    // Any plain steal. MEV Sandwich was the one named here and it is now a steal
    // wrapped in a timer, which previews as the timer rather than as the steal.
    const steal = CARDS.find((c) => c.effect?.kind === "stealMC")!;
    const { players } = preview(steal.id);
    expect(players).toEqual([
      { player: "you", impact: "helps" },
      { player: "opponent", impact: "hurts" },
    ]);
  });

  it("warns that a full portfolio will cost a position", () => {
    const state = board();
    state.players.you.projects = SOLO.slice(0, RULES.portfolioSize).map(
      (cardId) => ({ cardId, holders: 2, extraPump: 0, earned: 20_000, playedOnTurn: 1 }),
    );

    const { slots } = preview(SOLO_A, state);
    expect(slots).toHaveLength(RULES.portfolioSize);
    // Every position is a candidate to close, and none of them is certain.
    expect(slots.every((s) => s.owner === "you" && s.impact === "hurts" && !s.certain)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Auras. These are the cards that previewed as nothing at all: an Aura is
  // deliberately not an Effect, and previewOf returned early on !card.effect, so
  // hovering Murad over five memes lit up none of them.
  // -------------------------------------------------------------------------

  /** A board of one project per sector, so a sector filter has to choose. */
  function sectorBoard(): { state: State; sectorOf: Sector[] } {
    const state = structuredClone(newMatch(CARDS, 5)) as State;
    const projects = CARDS.filter((c): c is ProjectCard => c.type === "project");
    const chosen: ProjectCard[] = [];
    const seen = new Set<Sector>();
    for (const card of projects) {
      if (seen.has(card.sector)) continue;
      seen.add(card.sector);
      chosen.push(card);
      if (chosen.length === RULES.portfolioSize - 1) break;
    }
    state.players.you.projects = chosen.map((c) => ({
      cardId: c.id,
      holders: 3,
      extraPump: 0,
      earned: 0,
      playedOnTurn: 1,
    }));
    state.players.opponent.projects = [];
    return { state, sectorOf: chosen.map((c) => c.sector) };
  }

  it("lights up the projects an aura would pump, and only those", () => {
    const { state, sectorOf } = sectorBoard();
    const biggest = CARDS.find((c) => c.id === AURA_BIGGEST);
    expect(biggest, "the biggest aura is in the set").toBeDefined();
    const aura = auraOf(biggest!);
    expect(aura, "it carries an aura").toBeDefined();
    // Which slots light up is a question only a sector aura answers. Since the
    // aura became a union the others point at nothing on the board, so this test
    // says which kind it is about rather than reading a field half of them lack.
    expect(aura!.kind, "the biggest aura pumps a sector").toBe("pumpSector");
    const sector = auraSectors(aura!, CARDS)[0]!;

    const { slots } = previewOf(state, biggest!, "you", index);
    const lit = slots.filter((s) => s.owner === "you").map((s) => s.slot);
    const expected = sectorOf.flatMap((s, i) => (s === sector ? [i] : []));

    expect(lit.sort()).toEqual(expected.sort());
    expect(lit.length, "the board has something in the aura's sector").toBeGreaterThan(0);
  });

  it("previews every aura card, not only the ones that also carry an effect", () => {
    const withAura = CARDS.filter((c) => auraOf(c));
    // A floor rather than a count. It exists so the loop below cannot pass by
    // iterating over nothing; the number itself is not the claim. It read 30
    // against a set of seven hundred and twenty-five cards and this set is a
    // quarter of that.
    expect(withAura.length).toBeGreaterThan(10);

    // A board entirely of the aura's own sector, so there is always something to
    // point at. A card whose preview is empty here is invisible to the player.
    for (const card of withAura) {
      // auraSectors rather than `.sector`: an aura that helps no sector at all —
      // budget, draw, more positions — has nothing to build a themed board out
      // of, and skipping it is the true answer rather than a field lookup that
      // would not compile.
      const sector = auraSectors(auraOf(card)!, CARDS)[0];
      if (!sector) continue;
      const match = CARDS.find(
        (c): c is ProjectCard => c.type === "project" && c.sector === sector,
      );
      if (!match) continue;
      const state = structuredClone(newMatch(CARDS, 5)) as State;
      state.players.you.projects = [
        { cardId: match.id, holders: 3, extraPump: 0, earned: 0, playedOnTurn: 1 },
      ];
      state.players.opponent.projects = [];

      const { slots } = previewOf(state, card, "you", index);
      expect(
        slots.some((s) => s.owner === "you" && s.slot === 0 && s.impact === "helps"),
        `${card.id} (${card.name}) pumps ${sector} but previews nothing on a board of ${sector}`,
      ).toBe(true);
    }
  });

  it("narrows a sector pump to the sectors that actually get paid", () => {
    const { state, sectorOf } = sectorBoard();
    const card = CARDS.find((c) => c.effect?.kind === "pumpBySector" && !auraOf(c));
    expect(card, "the set has a pumpBySector card").toBeDefined();
    const bonuses = (card!.effect as { bonuses: Partial<Record<Sector, number>> }).bonuses;
    const paid = new Set(Object.keys(bonuses) as Sector[]);

    // Only meaningful if the board holds a sector this card does not pay.
    expect(sectorOf.some((s) => !paid.has(s))).toBe(true);

    const { slots } = previewOf(state, card!, "you", index);
    for (const slot of slots.filter((s) => s.owner === "you")) {
      expect(
        paid.has(sectorOf[slot.slot]!),
        `${card!.id} lights up a ${sectorOf[slot.slot]} position but pays only ${[...paid].join(", ")}`,
      ).toBe(true);
    }
  });

  it("gives a position one highlight, never two", () => {
    // A project into a full portfolio makes every position a close candidate; if
    // it also pumps a sector, one position is reached twice. The board can paint
    // one colour, so the preview has to have already decided which.
    const state = board();
    state.players.you.projects = SOLO.slice(0, RULES.portfolioSize).map((cardId) => ({
      cardId,
      holders: 3,
      extraPump: 0,
      earned: 0,
      playedOnTurn: 1,
    }));

    for (const card of CARDS) {
      const seen = new Set<string>();
      for (const slot of previewOf(state, card, "you", index).slots) {
        const key = `${slot.owner}:${slot.slot}`;
        expect(seen.has(key), `${card.id} previews ${key} twice`).toBe(false);
        seen.add(key);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Upgrades on a full board. applyMove has always handled this — it takes the
  // upgrade branch and returns before asking for a position to close — but the
  // screen asked anyway, so players sacrificed a position they never had to lose.
  // -------------------------------------------------------------------------

  /** A full portfolio: five different families, plus the smaller card of a sixth. */
  function fullBoardHolding(held: ProjectCard): State {
    const state = structuredClone(newMatch(CARDS, 5)) as State;
    const seen = new Set<string>([held.project]);
    const others: ProjectCard[] = [];
    for (const card of CARDS) {
      if (card.type !== "project" || seen.has(card.project)) continue;
      seen.add(card.project);
      others.push(card);
      if (others.length === RULES.portfolioSize - 1) break;
    }
    state.players.you.projects = [...others, held].map((c) => ({
      cardId: c.id,
      holders: 3,
      extraPump: 0,
      earned: 50_000,
      playedOnTurn: 1,
    }));
    state.players.opponent.projects = [];
    return state;
  }

  const wifCards = [...FAMILY_CARDS];

  it("does not ask for a sacrifice when the card upgrades a position it already holds", () => {
    const rare = wifCards.find((c) => c.rarity === "rare")!;
    const mythic = wifCards.find((c) => c.rarity === "mythic")!;
    const state = fullBoardHolding(rare);

    expect(state.players.you.projects).toHaveLength(RULES.portfolioSize);
    expect(needsPortfolioSlot(state, mythic, "you", index)).toBe(false);

    // And the engine agrees, with no target given.
    const played = structuredClone(state) as State;
    played.players.you.hand = [mythic.id];
    played.budgetThisTurn = 500_000;
    played.budgetSpentThisTurn = 0;
    const after = applyMove(played, { kind: "playCard", handIndex: 0 }, index);
    expect(after.players.you.projects).toHaveLength(RULES.portfolioSize);
    expect(after.players.you.projects.at(-1)!.cardId).toBe(mythic.id);
  });

  it("previews an upgrade as taking over its own position, not as costing six", () => {
    const rare = wifCards.find((c) => c.rarity === "rare")!;
    const mythic = wifCards.find((c) => c.rarity === "mythic")!;
    const state = fullBoardHolding(rare);
    const held = state.players.you.projects.findIndex((p) => p.cardId === rare.id);

    const mine = previewOf(state, mythic, "you", index).slots.filter((s) => s.owner === "you");
    expect(mine).toEqual([{ owner: "you", slot: held, impact: "helps", certain: true }]);
  });

  it("still asks for a sacrifice when the project is a family you do not hold", () => {
    const rare = wifCards.find((c) => c.rarity === "rare")!;
    const state = fullBoardHolding(rare);
    const onBoard = new Set(
      state.players.you.projects.map((p) => (cardById(index, p.cardId) as ProjectCard).project),
    );
    const stranger = CARDS.find(
      (c): c is ProjectCard => c.type === "project" && !onBoard.has(c.project),
    )!;

    expect(needsPortfolioSlot(state, stranger, "you", index)).toBe(true);
    const mine = previewOf(state, stranger, "you", index).slots.filter((s) => s.owner === "you");
    expect(mine).toHaveLength(RULES.portfolioSize);
    expect(mine.every((s) => s.impact === "hurts" && !s.certain)).toBe(true);
  });

  it("hides a move the rules refuse, and never hides a fault", () => {
    // The preview swallowed every error, so a crash inside the engine reached
    // the player as a card with no numbers on it and reached nobody else at all.
    const legal = structuredClone(board()) as State;
    legal.toMove = "you";
    legal.budgetThisTurn = 350_000;
    legal.budgetSpentThisTurn = 0;
    const playableIndex = legal.players.you.hand.findIndex((id) =>
      playable(legal, cardById(index, id), "you", index),
    );
    expect(playableIndex, "the test board has nothing playable in hand").toBeGreaterThan(-1);
    expect(mcDeltaOf(legal, playableIndex, index)).not.toBeNull();

    const refused = legal.players.you.hand.findIndex(
      (id) => !playable(legal, cardById(index, id), "you", index),
    );
    if (refused > -1) expect(mcDeltaOf(legal, refused, index)).toBeNull();

    const broken = structuredClone(legal) as State;
    broken.players.you.hand = ["no-such-card-exists", ...broken.players.you.hand];
    expect(() => mcDeltaOf(broken, 0, index)).toThrow(/Unknown card id/);
  });

  it("never points at a slot that does not exist", () => {
    const state = board();
    for (const card of CARDS) {
      for (const slot of previewOf(state, card, "you", index).slots) {
        expect(
          state.players[slot.owner].projects[slot.slot],
          `${card.id} previews ${slot.owner} slot ${slot.slot}, which is empty`,
        ).toBeDefined();
      }
    }
  });
});
