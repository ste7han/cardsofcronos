import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { FAMILY, FAMILY_CARDS, SOLO_A } from "./one-per-project";
import { PRESET_DECKS } from "@/data/preset-decks";
import {
  buildDeck,
  buildDeckPreferring,
  countProjects,
  deckProblems,
  isLegalDeck,
} from "@/engine/deck";
import { buildIndex } from "@/engine/match";
import { MARKETING_COST, RULES } from "@/engine/types";

const index = buildIndex(CARDS);

/** Enough non-project cards to fill a deck, for testing the project floor. */
const SET_WITHOUT_PROJECTS = CARDS.filter((c) => c.type !== "project").map((c) => c.id);

describe("deck rules", () => {
  it("every deck the generator builds is legal", () => {
    // This used to check one hand-built starter deck. There is no starter any
    // more, and one fixed deck was never the interesting claim: what has to hold
    // is that the thing which produces decks cannot produce an illegal one.
    for (let seed = 0; seed < 200; seed++) {
      const deck = buildDeck(CARDS, seed * 97 + 1);
      expect(deckProblems(deck, index), `seed ${seed}`).toEqual([]);
      expect(deck).toHaveLength(RULES.deckSize);
    }
  });



  it("allows a deck of the most expensive cards, because the table charges for it", () => {
    // The deck budget is gone in this experiment. A deck of the biggest cards is
    // legal now and pays at the table instead: measured at 51.7% against a random
    // forty, where the deck budget had it at 97.2%, and it loses to a deck built
    // to a curve.
    const expensive = [...CARDS]
      .sort((a, b) => MARKETING_COST[b.rarity] - MARKETING_COST[a.rarity])
      .filter((c) => c.type === "project")
      .slice(0, RULES.deckSize)
      .map((c) => c.id);

    expect(isLegalDeck(expensive, index)).toBe(true);
  });

  it("rejects the wrong size, duplicates and unknown cards, all at once", () => {
    const broken = [SOLO_A, SOLO_A, "not-a-card"];
    const problems = deckProblems(broken, index).join(" ");
    expect(problems).toMatch(/40 cards/);
    expect(problems).toMatch(/more than once/);
    expect(problems).toMatch(/not a card in this set/);
  });

  it("rejects a deck that cannot hold enough positions", () => {
    // Twelve projects is the floor. Below it a deck measurably cannot play, and
    // nothing else in the rules would stop you building one.
    const noProjects = SET_WITHOUT_PROJECTS.slice(0, RULES.deckSize);
    const problems = deckProblems(noProjects, index).join(" ");
    expect(problems).toMatch(/at least 12 projects/);
  });

  it("a generated deck clears the project floor comfortably", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(countProjects(buildDeck(CARDS, seed * 131 + 7), index)).toBeGreaterThanOrEqual(
        RULES.minProjects,
      );
    }
  });


});

describe("the deck generator", () => {
  it("always produces a legal deck", () => {
    for (let seed = 0; seed < 300; seed++) {
      const deck = buildDeck(CARDS, seed);
      expect(deckProblems(deck, index), `seed ${seed} produced an illegal deck`).toEqual([]);
      expect(countProjects(deck, index)).toBeGreaterThanOrEqual(RULES.minProjects);
    }
  });

  it("is deterministic", () => {
    expect(buildDeck(CARDS, 1234)).toEqual(buildDeck(CARDS, 1234));
    expect(buildDeck(CARDS, 1234)).not.toEqual(buildDeck(CARDS, 1235));
  });


});

describe("the ready-made decks", () => {
  const built = PRESET_DECKS.map((preset) => ({
    preset,
    deck: buildDeckPreferring(CARDS, preset.seed, preset.prefer),
  }));

  it("every preset is legal", () => {
    for (const { preset, deck } of built) {
      expect(deckProblems(deck, index), `${preset.name} is not a legal deck`).toEqual([]);
    }
  });



  it("every preset actually leans on its theme", () => {
    // Otherwise a preset is a themed name on a deck that is nothing of the sort,
    // which is worse than having no presets at all.
    for (const { preset, deck } of built) {
      const onTheme = deck.filter((id) => preset.prefer(INDEX_CARD(id))).length;
      expect(onTheme, `${preset.name} has only ${onTheme} of 40 cards on theme`).toBeGreaterThan(14);
    }
  });

  it("the presets are different decks from each other", () => {
    for (let i = 0; i < built.length; i++) {
      for (let j = i + 1; j < built.length; j++) {
        const a = new Set(built[i]!.deck);
        const shared = built[j]!.deck.filter((id) => a.has(id)).length;
        expect(
          shared,
          `${built[i]!.preset.name} and ${built[j]!.preset.name} share ${shared} of 40 cards`,
        ).toBeLessThan(32);
      }
    }
  });

  it("preferring a theme never breaks the rules, on any seed", () => {
    for (const preset of PRESET_DECKS) {
      for (let seed = 0; seed < 60; seed++) {
        const deck = buildDeckPreferring(CARDS, seed, preset.prefer);
        expect(
          deckProblems(deck, index),
          `${preset.name} on seed ${seed} produced an illegal deck`,
        ).toEqual([]);
      }
    }
  });
});

function INDEX_CARD(id: string) {
  const card = index.get(id);
  if (!card) throw new Error(`Unknown card id "${id}" in a preset deck.`);
  return card;
}

/**
 * Owning a card is now a deck rule rather than something the screen declines to
 * offer. In Cards of Cronos the card check was a UI filter and a direct call
 * could play anything, so this is the test that the rule lives in the engine.
 */
describe("decking cards you own", () => {
  const legal = buildDeck(CARDS, 99);

  it("says nothing when the rule is not in play", () => {
    // Every script, the bot and the whole-set tests build from the set, so
    // leaving the collection out has to mean "this question does not arise"
    // rather than "nobody owns anything".
    expect(deckProblems(legal, index)).toEqual([]);
  });

  it("accepts a deck made only of cards owned", () => {
    expect(deckProblems(legal, index, new Set(legal))).toEqual([]);
  });

  it("names every card the player does not own", () => {
    const owned = new Set(legal.slice(2));
    const problems = deckProblems(legal, index, owned);
    expect(problems).toHaveLength(2);
    for (const id of legal.slice(0, 2)) {
      const name = index.get(id)!.name;
      expect(problems.some((p) => p.includes(name))).toBe(true);
    }
  });

  it("refuses a deck of cards owned by nobody", () => {
    // The failure that matters: a deck posted straight at the storage layer,
    // bypassing the builder entirely. It must not go quiet.
    expect(deckProblems(legal, index, new Set())).toHaveLength(RULES.deckSize);
  });

  it("still reports the other rules alongside it", () => {
    const short = legal.slice(0, 39);
    const problems = deckProblems(short, index, new Set(short.slice(1)));
    expect(problems.some((p) => p.includes("40 cards"))).toBe(true);
    expect(problems.some((p) => p.includes("do not own"))).toBe(true);
  });
});

/**
 * BONK is eight cards. What stops that being a deck of eight BONKs is not a
 * rule, it is that such a deck loses — see scripts/project-stacking.ts. These
 * check the shape the cards have to keep for that to stay true.
 */
describe("a project across several cards", () => {
  const bonks = [...FAMILY_CARDS];

  it("has more than one card, or none of this means anything", () => {
    expect(bonks.length).toBeGreaterThan(1);
  });

  it("agrees with itself about sector and ticker", () => {
    expect(new Set(bonks.map((c) => (c.type === "project" ? c.sector : ""))).size).toBe(1);
    expect(new Set(bonks.map((c) => c.ticker)).size).toBe(1);
  });

  it("spreads across rarities, which is the point of the whole idea", () => {
    // A project in one rarity is a project you cannot play early or cannot play
    // late. Eight cards at one price would be eight of the same problem.
    expect(new Set(bonks.map((c) => c.rarity)).size).toBeGreaterThanOrEqual(4);
  });

  it("lets a deck hold every one of them", () => {
    // Deliberately legal. A cap went in and came back out: stacking is already
    // punished by one position per project, so forbidding it would only forbid
    // a mistake a player is welcome to make.
    const deck = bonks.map((c) => c.id);
    const rest = CARDS.filter(
      (c) => !deck.includes(c.id) && (c.type !== "project" || c.project !== FAMILY),
    );
    deck.push(...rest.filter((c) => c.type === "project").slice(0, 8).map((c) => c.id));
    deck.push(
      ...rest
        .filter((c) => c.type !== "project")
        .slice(0, RULES.deckSize - deck.length)
        .map((c) => c.id),
    );

    expect(deck).toHaveLength(RULES.deckSize);
    expect(deckProblems(deck, index)).toEqual([]);
  });

  it("is not what the generator builds, though", () => {
    // The rule permits it; the generator declines to hand it to anybody. Presets,
    // bot opponents and starter packs all come through here.
    for (let seed = 0; seed < 300; seed++) {
      const held = new Map<string, number>();
      for (const id of buildDeck(CARDS, seed)) {
        const card = index.get(id)!;
        if (card.type !== "project") continue;
        held.set(card.project, (held.get(card.project) ?? 0) + 1);
      }
      for (const [project, n] of held) {
        expect(n, `seed ${seed} stacked ${n} cards of ${project}`).toBeLessThanOrEqual(2);
      }
    }
  });
});
