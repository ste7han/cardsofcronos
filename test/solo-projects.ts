// Project ids that are a single card, picked at run time.
//
// The tests used to name "bonk", then "wif", then "popcat" as their stand-in
// project, and each of those broke the moment that project became eight cards.
// Hardcoding a card id in a fixture is a bet that the card stays one card, and
// that bet has now lost three times.
//
// So the fixtures ask for a project with exactly one card instead. When the last
// single-card project eventually becomes a family this throws, loudly, rather
// than quietly testing something else.

import { CARDS } from "@/data/cards";

const perProject = new Map<string, string[]>();
for (const card of CARDS) {
  if (card.type !== "project") continue;
  perProject.set(card.project, [...(perProject.get(card.project) ?? []), card.id]);
}

const solo = [...perProject.values()].filter((ids) => ids.length === 1).map((ids) => ids[0]!);

if (solo.length < 8) {
  throw new Error(
    `Test fixtures need at least eight single-card projects and the set has ${solo.length}. ` +
      "Give the fixtures explicit cards of a family instead, and mind the one-position rule.",
  );
}

/**
 * Unrelated single-card projects, in a stable order.
 *
 * Unrelated matters as much as single: only one card of a project may hold a
 * position, so a board built out of the same id twice is a board the engine will
 * not let you build.
 */
export const SOLO = solo;

export const [SOLO_A, SOLO_B, SOLO_C] = solo as [string, string, string];

/**
 * A single-card project in a given sector.
 *
 * Same reason as the rest of this file: tests that need "an ai project" were
 * naming `goat`, and `goat` became eight cards. Ask for the shape, not the card.
 */
export function soloOfSector(sector: string): string {
  const found = CARDS.find(
    (c) => c.type === "project" && c.sector === sector && solo.includes(c.id),
  );
  if (!found) {
    throw new Error(
      `No single-card ${sector} project left for the test fixtures. ` +
        "Name a card of a family instead, and mind the one-position rule.",
    );
  }
  return found.id;
}
