import { INDEX, SET } from "@/lib/set";
// What a client is allowed to see, and who is allowed to move.
//
// These two are the whole foundation of PvP and both are the kind of thing that
// looks fine until somebody reads the network tab. A leak here is not a bug that
// shows up as a wrong number — it is a match where one player can see the other
// player's hand and nothing anywhere reports a problem.
//
// So the tests do not check that the fields are present. They check that the
// hidden things are absent from the serialised view, by searching the JSON for
// the actual card ids, which is what an opponent would do.

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { chooseMove } from "@/engine/bot";
import { applyMove, applyMoveAs, buildIndex, newMatch, pumpOf } from "@/engine/match";
import { viewFor } from "@/engine/view";
import { IllegalMove } from "@/engine/types";
import type { State } from "@/engine/types";

const index = buildIndex(CARDS);

/** A match a few turns in, so there is something on both boards to hide. */
function midMatch(seed = 99): State {
  let state = newMatch(CARDS, seed);
  let guard = 0;
  while (!state.finished && state.turn < 4 && guard++ < 200) {
    state = applyMove(state, chooseMove(state, index), index);
  }
  return state;
}

describe("what a client is allowed to see", () => {
  it("never carries the opponent's hand, either side's deck, or the seed", () => {
    const state = midMatch();
    const view = viewFor(state, "you", INDEX);
    const wire = JSON.stringify(view);

    // Only the ids that are *exclusively* hidden, which is a distinction the
    // first version of this test did not make and failed on. Both decks are
    // built independently and may hold the same card, so an id in the opponent's
    // hand can also be in yours — where you are entitled to see it. Searching
    // the payload for every hidden id therefore flags a card you are holding
    // yourself, which is a broken test rather than a leak.
    const visible = new Set([
      ...state.players.you.hand,
      ...state.players.you.discard,
      ...state.players.opponent.discard,
      ...state.players.you.projects.map((p) => p.cardId),
      ...state.players.opponent.projects.map((p) => p.cardId),
      ...state.players.you.support.map((x) => x.cardId),
      ...state.players.opponent.support.map((x) => x.cardId),
    ]);
    const secret = [
      ...state.players.opponent.hand,
      ...state.players.opponent.deck,
      // Your own deck too: knowing your next draw is not something the rules
      // give you either.
      ...state.players.you.deck,
    ].filter((id) => !visible.has(id));

    expect(secret.length).toBeGreaterThan(20); // or the loop below proves nothing
    for (const id of secret) {
      expect(wire).not.toContain(`"${id}"`);
    }

    // And the seed, which is worth more than any of it: from it both shuffles
    // are recomputable, so one number hands over every card in the match in
    // order. Checked structurally rather than by searching for its digits —
    // seed 99 makes "99" a substring of half the market caps on the board, which
    // is a test that fails on a payload with nothing wrong with it.
    expect("seed" in view).toBe(false);
    expect("rngState" in view).toBe(false);
    expect("players" in view).toBe(false);
  });

  it("keeps a distinctive seed out of the payload entirely", () => {
    // The structural check above says the field is absent. This says the number
    // is absent, using a seed whose digits cannot turn up in a market cap by
    // accident — the two together are what "not on the wire" means.
    const state = midMatch(918_273_645);
    const wire = JSON.stringify(viewFor(state, "you", INDEX));
    expect(wire).not.toContain("918273645");
  });

  it("still carries everything the player is entitled to", () => {
    const state = midMatch();
    const view = viewFor(state, "you", INDEX);

    // Your own hand in full, or you cannot play.
    expect(view.you.hand).toEqual(state.players.you.hand);
    // Both boards, because both are face up.
    expect(view.them.projects.length).toBe(state.players.opponent.projects.length);
    expect(view.them.mc).toBe(state.players.opponent.mc);
    // Counts rather than contents, which is exactly what a table shows you.
    expect(view.them.handCount).toBe(state.players.opponent.hand.length);
    expect(view.them.deckCount).toBe(state.players.opponent.deck.length);
    // And your own deck is a count too. This is the half that shipped broken.
    expect(view.you.deckCount).toBe(state.players.you.deck.length);
  });

  it("gives each side its own view of the same match", () => {
    const state = midMatch();
    const yours = viewFor(state, "you", INDEX);
    const theirs = viewFor(state, "opponent", INDEX);

    expect(yours.me).toBe("you");
    expect(theirs.me).toBe("opponent");
    expect(yours.you.hand).toEqual(state.players.you.hand);
    expect(theirs.you.hand).toEqual(state.players.opponent.hand);
    // Symmetric: what one holds is the other's count and nothing more.
    expect(theirs.them.handCount).toBe(state.players.you.hand.length);
  });

  it("cannot be used to reach into the match it came from", () => {
    const state = midMatch();
    const view = viewFor(state, "you", INDEX);
    const before = state.players.you.mc;

    view.you.mc = 999_999_999;
    view.them.projects.length = 0;

    // A view that shares objects with the server's state is a view a client can
    // change the match through.
    expect(state.players.you.mc).toBe(before);
    expect(state.players.opponent.projects.length).toBeGreaterThan(0);
  });
});

describe("who is allowed to move", () => {
  it("refuses a move from the player whose turn it is not", () => {
    const state = midMatch();
    const waiting = state.toMove === "you" ? "opponent" : "you";
    const move = chooseMove(state, index);

    expect(() => applyMoveAs(state, waiting, move, index)).toThrow(IllegalMove);
    expect(() => applyMoveAs(state, waiting, move, index)).toThrow(/not .*'s turn/);
  });

  it("lets the player whose turn it is through, unchanged", () => {
    const state = midMatch();
    const move = chooseMove(state, index);

    // Same result as the unchecked reducer: this adds an authority check and
    // nothing else. If it did more, a match played through it would diverge from
    // one replayed from its seed and moves, and the replay is the audit.
    expect(applyMoveAs(state, state.toMove, move, index)).toEqual(applyMove(state, move, index));
  });
});


describe("what the view answers about your own hand", () => {
  it("says of every card whether it can be played, and why not", () => {
    // The client has no State to run the rules against. If it worked any of this
    // out for itself that would be a second implementation of the rules, which
    // is the thing Cards of Cronos was wrecked by: the card check was a UI
    // filter and a direct call could play anything.
    const state = structuredClone(newMatch(SET, 7)) as State;
    // No free play, whatever the first-move rule is paying today. While a seat
    // holds one it may play anything whatever it costs, and then the price never
    // answers — which is what this test is here to see.
    state.freePlays.you = 0;
    const view = viewFor(state, "you", INDEX);

    expect(view.you.playable).toHaveLength(view.you.hand.length);
    view.you.playable.forEach((says, i) => {
      expect(says.id).toBe(view.you.hand[i]);
      // Either it can be played, or there is a sentence saying why not. Never
      // neither: a card at forty percent opacity with no reason is most of
      // "I suddenly could not play".
      expect(says.canPlay || says.reason !== null).toBe(true);
    });

    // On turn one the budget is one card's worth, so something must be refused
    // for the price — the reason that fires most.
    expect(view.you.playable.some((says) => !says.canPlay)).toBe(true);
  });

  it("never dims a card without saying why", () => {
    // Three states where nothing is playable, and each has to give a reason. A
    // card at forty percent with no explanation is the whole of "I suddenly
    // could not play" — it was true on the opponent's turn until this test.
    const state = newMatch(SET, 7);

    // Their turn: every card, one reason.
    const theirs = viewFor(state, "opponent", INDEX);
    expect(state.toMove).not.toBe("opponent");
    expect(theirs.you.playable.length).toBeGreaterThan(0);
    for (const says of theirs.you.playable) {
      expect(says.canPlay).toBe(false);
      expect(says.reason).toBeTruthy();
    }

    // And a finished match says so rather than falling through to the price.
    let over = state;
    while (!over.finished) over = applyMove(over, chooseMove(over, INDEX), INDEX);
    for (const says of viewFor(over, "you", INDEX).you.playable) {
      expect(says.canPlay).toBe(false);
      expect(says.reason).toBeTruthy();
    }
  });

  it("says nothing about the opponent's hand, because it has none to say it about", () => {
    const view = viewFor(newMatch(SET, 7), "you", INDEX);
    expect("playable" in view.them).toBe(false);
    expect("hand" in view.them).toBe(false);
  });

  it("carries the pump each position is about to pay", () => {
    // A rule — it depends on every aura on that side of the table — so the
    // server works it out and the client shows it.
    let state = newMatch(SET, 7);
    while (state.players.you.projects.length === 0 && !state.finished) {
      state = applyMove(state, chooseMove(state, INDEX), INDEX);
    }
    const view = viewFor(state, "you", INDEX);
    view.you.projects.forEach((project, slot) => {
      expect(project.pump).toBe(pumpOf(state, "you", slot, INDEX));
    });
  });
});
