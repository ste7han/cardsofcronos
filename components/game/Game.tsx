"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CardBack } from "@/components/CardBack";
import { CardView } from "@/components/CardView";
import { Icon } from "@/components/Icon";
import { BoardProject } from "@/components/game/BoardProject";
import { CardPeek } from "@/components/game/CardPeek";
import { PeekButton } from "@/components/game/PeekButton";
import { EMPTY_FLASH, FLASH_MS, key, makeFlash, type Flash } from "@/components/game/diff";
import { SoundToggle } from "@/components/game/SoundToggle";
import { cuesFor, endCue } from "@/lib/audio/cues";
import { play, playAll } from "@/lib/audio/sfx";
import { musicOn, start as startMusic, stop as stopMusic } from "@/lib/audio/music";
import { Log } from "@/components/game/Log";
import { MCCounter } from "@/components/game/MCCounter";
import { chooseMove } from "@/engine/bot";
import { BOARDS, opponentDeck, type Board } from "@/data/boards";
import { cardLabel, formatMC, formatMCExact, formatMCPair, plural } from "@/engine/format";
import { cardById } from "@/engine/helpers";
import {
  FIRST_MOVER,
  applyMove,
  discardRequirementOf,
  withinFreeCap,
  needsPortfolioSlot,
  newMatch,
  playable,
  pumpOf,
  targetRequirementOf,
  upgradesAPosition,
  whyNoDiscard,
  whyNoProfit,
  whyNot,
  priceFor,
} from "@/engine/match";
import { EMPTY_PREVIEW, budgetDeltaOf, mcDeltaOf, previewOf, type Preview } from "@/engine/preview";
import { budgetNote, freePlayNote } from "@/engine/rules-text";
import { snapshotOfState } from "@/engine/snapshot";
import { DiscardButton } from "@/components/game/DiscardButton";
import { TakeProfitButton } from "@/components/game/TakeProfitButton";
import type { Refusal } from "@/engine/match";
import type { Card, ChoiceTarget, Move, Player, State } from "@/engine/types";

/**
 * Does the free play cover this card, right now?
 *
 * The badge has to answer the same question the engine does. It used to ask only
 * whether a free play was left, which was right while the play covered anything
 * and became a lie the day it stopped covering mythics. At module level because
 * the hand and the two previews all need it and they are three components.
 */
function freeFor(state: State, card: Card): boolean {
  return (
    state.freePlays[FIRST_MOVER] > 0 && state.toMove === FIRST_MOVER && withinFreeCap(card)
  );
}
import { RULES, TURN_ACTION_COST, auraOf, boardOf } from "@/engine/types";
import { MINT_OPEN } from "@/lib/collection";
import { proofOf } from "@/lib/session";
import { DEMO_DECK_NAME, demoDeck, demoDecks, demoOpponentTheme } from "@/lib/demo";
import { deckKey, record as recordOutcome } from "@/lib/history";
import { LESSON_IDS, nextLesson } from "@/lib/tutorial";
import { cx } from "@/lib/cx";
import { useSession } from "@/lib/use-session";
import { loadDeck, type LoadedDeck } from "@/lib/deck-storage";
import { RARITY } from "@/lib/rarity";
import { INDEX, SET } from "@/lib/set";

/** How long the bot takes per move. Purely for the viewer; the engine is instant. */
const BOT_TEMPO_MS = 1150;

interface Aiming {
  target: ChoiceTarget;
  /** Aiming an effect, closing for a full portfolio, or banking on purpose. */
  reason: "effect" | "close" | "profit";
  /** Set for "profit": banking uses no card from hand. */
  handIndex: number | null;
  /**
   * The position already picked to close, when a card asks both questions.
   *
   * A project with an effect that aims at a single position, played into a full
   * portfolio, needs two answers: which of yours goes, and which of theirs gets
   * hit. They are asked one after the other and this carries the first one into
   * the second.
   */
  closed?: number;
}

export function Game({
  board = BOARDS[0]!,
  onMatch,
  begin = true,
}: {
  board?: Board;
  /**
   * Told when a match starts and when there is none.
   *
   * So the page above can put the opponent picker away: leaving it over the
   * table while somebody is playing says the choice is still open when it is
   * not, and the table is sized to the viewport with no room to spare.
   */
  onMatch?: (playing: boolean) => void;
  /**
   * Whether to deal at all. Default true, so anything that mounts this without
   * an opinion still gets a match.
   */
  begin?: boolean;
}) {
  // Whose deck this is. Signing in or out mid-visit has to restart the table:
  // the deck it dealt from belongs to an address, and carrying on with the last
  // one would be playing somebody else's cards.
  const { wallet, admin, ready: sessionReady } = useSession();
  const [state, setState] = useState<State | null>(null);
  const [aiming, setAiming] = useState<Aiming | null>(null);
  const [flash, setFlash] = useState<Flash>(EMPTY_FLASH);
  const [hovered, setHovered] = useState<number | null>(null);
  // The log opens on a click rather than sitting in the way of the table.
  const [logOpen, setLogOpen] = useState(false);
  /**
   * Which of the opponent's positions is being pointed at as the reason a
   * control of yours is switched off.
   *
   * Here rather than inside the button, because the button and the board it
   * points at are siblings. Cleared on every state change below — a highlight
   * that outlives the rule it explains is worse than none: it points at a card
   * that is no longer stopping anything, with exactly the same confidence.
   */
  const [blaming, setBlaming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The end screen has been dismissed so the board and the log can be read. */
  const [reviewing, setReviewing] = useState(false);
  const [deckInfo, setDeckInfo] = useState<LoadedDeck | null>(null);
  /** The board answered that this is the week's best for this wallet. */
  const [onBoard, setOnBoard] = useState(false);
  /**
   * Playing the borrowed deck rather than one of your own.
   *
   * Kept as state and not derived from `wallet === null`, because signing in
   * mid-demo has to end the demo rather than leave a signed-in player on a deck
   * that is not theirs.
   */
  const [demo, setDemo] = useState(false);
  /**
   * Lessons the player has waved away.
   *
   * Kept across matches on purpose: somebody pressing ONE MORE has just played a
   * whole match and does not need telling what a position is again.
   */
  const [taught, setTaught] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * Has this match already gone on the record?
   *
   * A ref and not state: writing it must not cause a render, and the effect that
   * writes it runs on every render where the match is finished — which is every
   * hover, every log toggle, every frame the end screen spends fading in.
   * Without this the same match is filed a few hundred times.
   *
   * Cleared by start() rather than keyed on the seed. A key would have to be
   * unique per match, and the one honest key available — the seed — is a random
   * number, so two matches could share it and the second would go unrecorded.
   */
  const filed = useRef(false);
  /**
   * The seed and every move, for a demo that is going to be submitted.
   *
   * A match is a seed and a list of moves — the same thing the PvP record is —
   * so this is what the server needs to replay it and see for itself that a
   * whole match was played. Kept in a ref because none of it is drawn.
   */
  const played = useRef<{ seed: number; moves: Move[] }>({ seed: 0, moves: [] });
  /** This match has been handed to the weekly board. One entry per match. */
  const entered = useRef(false);
  const stateRef = useRef<State | null>(null);
  const boards = {
    you: useRef<HTMLDivElement>(null),
    opponent: useRef<HTMLDivElement>(null),
  };
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  stateRef.current = state;

  /**
   * Deals a match, from the server when the board charges for one.
   *
   * `dealt` is the seed /api/boards/deal handed out, or null on a free board
   * where the browser picks as it always has. It matters that it is not picked
   * here for a paid board: a browser that chooses the shuffle can keep choosing
   * until one goes its way, and then a fee buys a win rather than a go.
   */
  const start = useCallback((asDemo: boolean, dealt: number | null = null) => {
    // The seed lives outside the engine: there is no Math.random in there, so a
    // match stays replayable from { seed, moves }.
    const seed = dealt ?? Math.floor(Math.random() * 2_147_483_647);
    // Your saved deck, or the starter one if you have not built anything yet.
    //
    // The opponent used to get forty cards off a shuffle, which is not a deck —
    // it lost to everything by 65% to 80% because it had no theme and so no aura
    // ever landed twice. It builds to one of the ready-made themes now, picked by
    // the seed and built from it, so the cards vary every match while the shape
    // holds. A rematch on the same seed still plays out identically.
    // The demo deck is handed over, not loaded: there is nothing of this
    // visitor's to load, and nothing about the match gets written back.
    const yours: LoadedDeck = asDemo
      ? { cardIds: demoDeck(), name: DEMO_DECK_NAME, rejected: [] }
      : loadDeck();
    setDemo(asDemo);
    setDeckInfo(yours);
    filed.current = false;
    // Nothing to play with. There is no free deck underneath this any more, so
    // this is a state the table has to have an answer for rather than a case
    // that used to be impossible.
    if (yours.cardIds.length === 0) {
      stateRef.current = null;
      setState(null);
      return;
    }
    const fresh = newMatch(
      SET,
      seed,
      asDemo
        ? demoDecks(seed, board)
        : {
            you: yours.cardIds,
            // From data/boards.ts, which is also what the server replays the
            // match with. Two copies of this rule would refuse every honest
            // score and say nothing about why.
            opponent: opponentDeck(SET, board, seed),
          },
    );
    played.current = { seed, moves: [] };
    entered.current = false;
    setOnBoard(false);
    stateRef.current = fresh;
    setState(fresh);
    setAiming(null);
    setFlash(EMPTY_FLASH);
    setError(null);
    setReviewing(false);
  }, []);

  useEffect(() => {
    // Not before the session has been read. Starting first would deal from an
    // empty collection and show NOTHING TO PLAY WITH to somebody who is signed
    // in, for as long as it takes the effect to run.
    // Always as yourself. A demo that survived a sign-in would leave somebody
    // playing a deck they do not hold, and the whole point of the wallet is that
    // the deck on the table is yours.
    //
    // `begin` is what /play sets once somebody has chosen who to play. It used
    // to deal the moment the page loaded, which meant the choice of opponent —
    // and the reason each one exists — was never on screen: you arrived already
    // playing the first board in the list.
    if (!sessionReady || !begin) return;

    // Ask for a match before dealing one. On a free board this answers with
    // null straight away and nothing changes; on a paid one it is where the go
    // is spent, and asking again after a reconnection hands back the same seed
    // rather than costing another ten CRO.
    let current = true;
    const proof = proofOf();
    void (async () => {
      let dealt: number | null = null;
      if (proof !== null) {
        try {
          const answer = await fetch("/api/boards/deal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ proof, board: board.id }),
          });
          if (answer.ok) dealt = ((await answer.json()) as { seed: number | null }).seed;
        } catch {
          // A free board does not need it, and a paid one will be refused at
          // the score instead — which says the same thing with the real reason.
        }
      }
      if (current) start(false, dealt);
    })();
    return () => {
      current = false;
    };
  }, [start, sessionReady, wallet, begin, board.id]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  /**
   * One move to the engine, plus whatever of it should become visible.
   *
   * If the engine throws, the error comes on screen instead of vanishing — a
   * rejected move has to be seen, even when the game carries on fine.
   */
  const doMove = useCallback((move: Move) => {
    const current = stateRef.current;
    if (!current) return;
    try {
      const next = applyMove(current, move, INDEX);
      stateRef.current = next;
      setState(next);
      setError(null);
      // After the engine accepted it, never before. A list that held refused
      // moves would not replay, and the server would blame the player.
      played.current.moves.push(move);

      const was = snapshotOfState(current, INDEX);
      const is = snapshotOfState(next, INDEX);
      setFlash(makeFlash(was, is));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(EMPTY_FLASH), FLASH_MS);

      // The same two moments the markers are read from, so the table cannot
      // show one thing and say another. A card arriving in hand is the one cue
      // a board diff cannot carry — a hand is not on a board — so it is counted
      // here, where both hands are in reach.
      const cues = cuesFor(was, is, move);
      const drew = next.players.you.hand.length > current.players.you.hand.length;
      playAll(drew ? [...cues, "draw"] : cues);

      // The end, from the state rather than from the diff. cues.ts refuses to
      // guess at this and says why.
      if (next.finished && !current.finished) {
        play(endCue(next.winner), 0.45);
      }
    } catch (e) {
      // A refused move has to be heard as well as seen. This is the one sound
      // that fires for something that did NOT happen.
      play("deny");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // A highlight is about one moment. Cleared whenever the match moves rather
  // than in each of the handlers that move it — doMove, the bot's own timer and
  // starting a fresh match are three paths, and the fourth one somebody adds
  // later would not know it had to clear this.
  useEffect(() => setBlaming(null), [state]);

  // The bot plays its turn move by move, so you can follow what happens.
  useEffect(() => {
    if (!state || state.finished || state.toMove !== "opponent") return;
    const timer = setTimeout(() => {
      const current = stateRef.current;
      if (!current || current.finished || current.toMove !== "opponent") return;
      try {
        doMove(chooseMove(current, INDEX));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, BOT_TEMPO_MS);
    return () => clearTimeout(timer);
  }, [state, doMove]);

  /* Which board is being pointed at, and how it should look while you do.
     Above the early return below, because the effect that follows is a hook and
     reads them — the file's own comments have been saying this for a while. */
  const aimBoard: Player | null = aiming ? boardOf(aiming.target, "you") : null;
  const aimKind: "attack" | "bank" = aiming?.reason === "profit" ? "bank" : "attack";

  /**
   * Bring the board you are being asked to point at into view.
   *
   * Only when it is not already there, which makes this do nothing at all on a
   * screen wide enough to hold the whole table — and everything on a phone,
   * where the board you must tap is above the hand you tapped from.
   */
  useEffect(() => {
    if (aimBoard === null) return;
    const el = boards[aimBoard].current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= window.innerHeight) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimBoard, aiming]);

  /**
   * What the coach is saying, if anything.
   *
   * Only in the demo, only on your turn, and never while you are pointing at
   * something — a panel explaining the game over the top of a decision you are
   * halfway through is in the way, not helpful.
   */
  const lesson =
    demo && state !== null && !state.finished && state.toMove === "you" && aiming === null
      ? nextLesson(state, INDEX, taught)
      : null;

  /**
   * File a finished match.
   *
   * Never the demo: a borrowed deck is nobody's record, and letting it count
   * would make the first number a new player sees a number about a deck they did
   * not choose. Never signed out either — record() checks that itself, and this
   * is the second lock rather than the only one.
   */
  useEffect(() => {
    if (!state?.finished || demo || deckInfo === null) return;

    if (filed.current) return;
    filed.current = true;

    recordOutcome({
      at: Date.now(),
      deckKey: deckKey(deckInfo.cardIds),
      deckName: deckInfo.name.trim() || "Unnamed",
      yourMC: state.players.you.mc,
      theirMC: state.players.opponent.mc,
      won: state.winner === null ? null : state.winner === "you",
    });

    // And up to /api/solo, where the server replays it and announces the
    // result. The line above is a private note this browser wrote to itself;
    // this is the version somebody else reads, and the difference is that the
    // server plays the moves through its own engine before saying anything.
    //
    // A win and a loss both go. The weekly board refuses anything but a win
    // because that is a competition; a result is a result.
    //
    // Fire and forget, and deliberately: the record above is already written,
    // the match is over, and a channel that did not hear about it is not a
    // reason to show anybody an error about a game they have just finished.
    const proof = proofOf();
    if (proof !== null && played.current !== null) {
      void fetch("/api/solo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proof,
          board: board.id,
          seed: played.current.seed,
          deck: deckInfo.cardIds,
          deckName: deckInfo.name,
          moves: played.current.moves,
        }),
      })
        .then(async (answer) => {
          // Said out loud, in the console, and nowhere else. There is nothing
          // for the player to do about it and the match is already recorded —
          // but this failed silently for its whole first hour, with a route
          // answering 401 and a `.catch` that only ever sees a network error.
          if (!answer.ok) {
            console.error(`[solo] ${answer.status}: ${await answer.text()}`);
          }
        })
        .catch((error: unknown) => {
          console.error("[solo] the result could not be sent", error);
        });
    }
  }, [state, demo, deckInfo, board.id]);


  /**
   * Hand a won match to the weekly board.
   *
   * The seed, the deck and the moves. The server rebuilds the bot's deck from
   * the seed and replays the match itself, so what lands on the board is what
   * its own engine produced rather than a number this browser reported.
   *
   * Only a win, because beating the bot is the entry requirement, and never a
   * demo: a demo plays fixed decks that are not the player's, so it is not an
   * entry in a competition about the deck you built. Signed out there is nobody
   * to put on the board.
   *
   * `entered` holds what came back — whether this became the week's best for
   * this wallet — so the end screen can say so. A failure is quiet on purpose:
   * nothing the player did has gone wrong, they won a match, and the next one
   * they win sends again.
   */
  useEffect(() => {
    if (demo || state?.winner !== "you" || wallet === null || entered.current) return;
    entered.current = true;

    const proof = proofOf();
    if (proof === null) return;

    void fetch("/api/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proof,
        board: board.id,
        seed: played.current.seed,
        deck: deckInfo?.cardIds ?? [],
        moves: played.current.moves,
      }),
    })
      .then(async (answer) => {
        if (!answer.ok) return;
        const said = (await answer.json().catch(() => null)) as { best?: boolean } | null;
        if (said?.best) setOnBoard(true);
      })
      .catch(() => {
        entered.current = false;
      });
  }, [demo, state?.winner, wallet, deckInfo]);


  /**
   * The music runs with the table and stops with it.
   *
   * Started here rather than in the toggle because the toggle can be thrown
   * before a match exists, and because leaving a drone running under the end
   * screen was the first thing that felt wrong.
   */
  useEffect(() => {
    if (!musicOn()) return;
    startMusic();
    return () => stopMusic();
  }, []);

  // Escape cancels aiming.
  useEffect(() => {
    if (!aiming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAiming(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiming]);

  // Reported from the render rather than from start(), because the table also
  // empties on signing out and on a deck being rejected — and the picker has to
  // come back for those too.
  useEffect(() => {
    onMatch?.(state !== null);
  }, [state, onMatch]);

  if (!state) {
    if (deckInfo && deckInfo.cardIds.length === 0) {
      return (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          {/* A REJECTED DECK IS NOT AN EMPTY COLLECTION, and this screen said it
              was. It headed both cases NOTHING TO PLAY WITH, which is a plain
              untruth told to somebody holding sixty-seven cards whose saved deck
              happens to hold cards from another wallet — and the way out of that
              is /deck, which the page did not offer because it thought there was
              nothing to build from. */}
          <p className="text-[10px] tracking-[0.28em] text-faint">
            {deckInfo.rejected.length > 0 ? "SAVED DECK" : "NO DECK"}
          </p>
          <h1 className="display mt-3 text-3xl">
            {deckInfo.rejected.length > 0 ? "THIS DECK NEEDS REBUILDING" : "NOTHING TO PLAY WITH"}
          </h1>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            {deckInfo.rejected.length > 0
              ? deckInfo.rejected.join(" ")
              : wallet === null
                // TCG says "rather than to a browser" here, because over there a
                // deck moved into the database. Here it is still keyed by wallet
                // in localStorage — lib/deck-storage.ts — so it belongs to a
                // wallet and lives in this browser, and the sentence says only
                // the half that is true. Say the other half once it is.
                ? `A deck belongs to a wallet. Sign in with the button at the top right, and whatever that address holds comes with it.`
                : `A deck is ${RULES.deckSize} cards out of the cards you hold, and this wallet holds none yet.`}
          </p>

          {deckInfo.rejected.length > 0 && wallet !== null && (
            <Link
              href="/deck"
              className="glow-pump mt-6 inline-block border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
            >
              REBUILD IT
            </Link>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-faint">
            Or borrow a deck and play a match right now. It is the whole game — same ten turns,
            same bot — and it is nobody&rsquo;s collection: nothing is saved and nothing is yours
            at the end of it.
          </p>
          <div className="mt-8 flex justify-center gap-2">
            <button
                type="button"
                onClick={() => start(true)}
                className="glow-pump border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
              >
                PLAY A DEMO MATCH
            </button>
            {wallet !== null && (MINT_OPEN || admin) && (
              <Link
                href="/mint"
                className="glow-pump border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
              >
                MINT SOME CARDS
              </Link>
            )}
            {wallet !== null && (
              <Link
                href="/deck"
                className={cx(
                  "px-5 py-3 text-[10px] tracking-[0.18em] transition-colors",
                  MINT_OPEN || admin
                    ? "border border-line-strong text-muted hover:border-fg hover:text-fg"
                    : "glow-pump border border-pump bg-pump/10 text-pump hover:bg-pump hover:text-ground",
                )}
              >
                BUILD A DECK
              </Link>
            )}
          </div>
        </div>
      );
    }
    return <p className="px-4 py-20 text-center text-[11px] text-muted">Setting up the match…</p>;
  }

  const yourTurn = state.toMove === "you" && !state.finished;

  // What the hovered hand card would touch. Suppressed while aiming, because then
  // the board is already showing what you can click.
  const hoveredCard =
    hovered !== null && !aiming && state.players.you.hand[hovered] !== undefined
      ? cardById(INDEX, state.players.you.hand[hovered]!)
      : null;
  const preview =
    hoveredCard && playable(state, hoveredCard, "you", INDEX)
      ? previewOf(state, hoveredCard, "you", INDEX)
      : EMPTY_PREVIEW;

  // What the hovered card would actually do to both market caps, taken by
  // running the move through the engine rather than predicting it a second way.
  const mcDelta =
    hovered !== null && hoveredCard && playable(state, hoveredCard, "you", INDEX)
      ? mcDeltaOf(state, hovered, INDEX)
      : null;

  // What the hovered card does to the budget. Separate from mcDelta because a
  // card can leave the market caps alone and still change what you can afford
  // next — and because the number nobody can do in their head is this one: a
  // card that costs $280K and hands $420K back reads as unaffordable right up
  // until you play it.
  const budgetDelta =
    hovered !== null && hoveredCard && playable(state, hoveredCard, "you", INDEX)
      ? budgetDeltaOf(state, hovered, INDEX)
      : null;

  /** The card being hovered, so the hand can lift it out of the row. */
  const lifted = hovered !== null ? state.players.you.hand[hovered] : undefined;

  /** What the hovered card asks of the discard, read off the card itself. */
  const wantsDiscard = hoveredCard ? discardRequirementOf(hoveredCard) : null;


  function clickHandCard(handIndex: number) {
    const current = stateRef.current;
    if (!current) return;
    // The hand re-indexes the moment a card leaves it, so a hover held over slot
    // three starts describing whatever moved into slot three. Let go of it here
    // rather than in every branch below.
    setHovered(null);
    const card = cardById(INDEX, current.players.you.hand[handIndex]!);
    if (!playable(current, card, "you", INDEX)) return;

    // A full portfolio doesn't block the card, it asks which position to close.
    if (needsPortfolioSlot(current, card, "you", INDEX)) {
      setAiming({ handIndex, target: "ownProject", reason: "close" });
      return;
    }

    const requirement = targetRequirementOf(card);
    if (requirement) {
      play("select");
      setAiming({ handIndex, target: requirement, reason: "effect" });
      return;
    }
    doMove({ kind: "playCard", handIndex });
  }

  function clickTarget(slot: number) {
    if (!aiming) return;
    if (aiming.reason === "profit") {
      doMove({ kind: "takeProfit", slot });
    } else if (aiming.handIndex !== null) {
      const card = cardById(INDEX, stateRef.current!.players.you.hand[aiming.handIndex]!);
      const requirement = targetRequirementOf(card);
      // Closing was only the first half. If the card also aims at something, ask
      // that now and keep the position just picked.
      if (aiming.reason === "close" && requirement) {
        setAiming({ handIndex: aiming.handIndex, target: requirement, reason: "effect", closed: slot });
        return;
      }
      doMove({
        kind: "playCard",
        handIndex: aiming.handIndex,
        ...(aiming.reason === "close" ? { closeIndex: slot } : { targetIndex: slot }),
        ...(aiming.closed === undefined ? {} : { closeIndex: aiming.closed }),
      });
    }
    setAiming(null);
  }

  function throwAway(handIndex: number) {
    setAiming(null);
    doMove({ kind: "discard", handIndex });
  }

  function startTakeProfit() {
    play("select");
    setAiming({ handIndex: null, target: "ownProject", reason: "profit" });
  }

  function endTurn() {
    setAiming(null);
    doMove({ kind: "endTurn" });
  }

  return (
    <div className="relative mx-auto max-w-4xl overflow-hidden px-4 py-1 lg:h-[calc(100dvh-4.5rem)]">
      {/* Red flash over the whole screen when something gets rugged. */}
      {flash.rug && (
        <div
          key={state.log.length}
          aria-hidden
          className="rug-flash pointer-events-none fixed inset-0 z-30"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 35%, rgba(255,77,77,0.28) 100%)",
          }}
        />
      )}

      {/* A table, laid out the way a table is: their hand at the top, their
          board, the divider you act on, your board, your hand. Everything is on
          screen at once and nothing scrolls — the heights below are chosen so
          that a full board on both sides still fits a 700px laptop.

          The log is beside it and can be folded away. When it is folded the
          table centres, which is what it should have been doing all along. */}
      {/* The table is one width and one place, always. It used to give up a
          column to the log and shrink whenever the log was open, which is the
          wrong way round — the table is the thing, and on a wide screen there is
          margin either side of it doing nothing. So the log lives in the left
          margin and the card you are pointing at in the right, both fixed, and
          neither of them ever moves the board.

          Below xl there is no margin to put them in, so the log falls back to a
          block under the table and the card preview simply waits. */}
      <div className="flex flex-col gap-1.5 lg:h-[calc(100dvh-5.5rem)]">
          <div className="shrink-0">
            <HandBacks count={state.players.opponent.hand.length} />
          </div>

          <div ref={boards.opponent} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <SidePanel
              state={state}
              player="opponent"
              targetable={aimBoard === "opponent" && aimKind}
              flash={flash}
              preview={preview}
              mcDelta={mcDelta?.opponent ?? null}
              blaming={blaming}
              wantsDiscard={null}
              onTarget={clickTarget}
            />
          </div>

          {/* The divider carries the controls and the caption for what just
              happened. Both used to be rows of their own; between the two boards
              is where you are looking anyway. */}
          <TurnBar
            state={state}
            budgetDelta={budgetDelta}
            yourTurn={yourTurn}
            aiming={aiming}
            flash={flash}
            deck={deckInfo}
            demo={demo}
            logOpen={logOpen}
            onToggleLog={() => setLogOpen((open) => !open)}
            onEnd={endTurn}
            onCancel={() => setAiming(null)}
            onTakeProfit={startTakeProfit}
            onBlame={setBlaming}
            onNew={() => start(demo)}
          />

          {/* Both boards can give; the divider between them cannot. It carries
              END TURN, and a control that wanders under the fold once the boards
              fill up is the whole complaint. */}
          <div ref={boards.you} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <SidePanel
              state={state}
              player="you"
              targetable={aimBoard === "you" && aimKind}
              flash={flash}
              preview={preview}
              mcDelta={mcDelta?.you ?? null}
              // Only ever the opponent's board: every standing rule in the set
              // is carried by a position on the other side of the table.
              blaming={null}
              wantsDiscard={wantsDiscard}
              onTarget={clickTarget}
            />
          </div>

          {error && (
            <p className="shrink-0 border border-dump bg-dump/10 px-3 py-1.5 text-[10px] leading-relaxed text-dump">
              The engine rejected that move: {error}
            </p>
          )}

          {/* The coach, in the same slot as the ask below and for the same
              reason: this is where you are looking. It costs a row of the two
              board panels, which scroll, and only ever in the demo — a
              signed-in player never renders it, so the height-tuned table is
              untouched for real play. */}
          {lesson && (
            <div className="flex shrink-0 items-start justify-between gap-3 border border-pump/40 bg-pump/5 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[9px] tracking-[0.18em] text-pump">
                  {lesson.title.toUpperCase()}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">{lesson.body}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => setTaught((seen) => new Set([...seen, lesson.id]))}
                  className="border border-pump/60 px-2.5 py-1.5 text-[9px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground"
                >
                  GOT IT
                </button>
                <button
                  type="button"
                  onClick={() => setTaught(new Set(LESSON_IDS))}
                  className="text-[9px] tracking-[0.16em] text-faint transition-colors hover:text-fg"
                >
                  SKIP ALL
                </button>
              </div>
            </div>
          )}

          {/* The ask, next to the thumb.
              Below lg the table is a tall scrolling column — their board, the
              turn bar, your board, then your hand — so tapping a card that needs
              a target starts aiming somewhere off the top of the screen. From
              where the hand is, nothing happened. This says what is being asked
              and offers the way out; the effect below brings the board itself
              into view. Above lg the whole table is on screen and the turn bar
              already says it. */}
          {aiming && (
            <div className="flex shrink-0 items-center justify-between gap-2 border border-dump bg-dump/10 px-3 py-2 lg:hidden">
              <span className="text-[10px] leading-snug text-dump">{askOf(aiming)}</span>
              <button
                type="button"
                onClick={() => setAiming(null)}
                className="shrink-0 border border-line-strong px-2.5 py-1.5 text-[9px] tracking-[0.16em] text-muted"
              >
                CANCEL
              </button>
            </div>
          )}

          <Hand
            state={state}
            yourTurn={yourTurn}
            chosen={aiming?.handIndex ?? null}
            hovered={hovered}
            onHover={setHovered}
            onClick={clickHandCard}
            onDiscard={throwAway}
            offerDiscard={yourTurn && aiming === null}
            noDiscard={whyNoDiscard(state, "you")}
          />

          {/* The log, in the flow, under the hand — you scroll to it.
              It was a fixed panel over the board, which is the wrong shape for
              the screen with the least board on it: a phone had the log covering
              the thing the log is about.

              In the flow the page grows and scrolls, and the note above the
              desktop panel is right that this once broke things — a fixed panel
              against a scrolling page comes away from the header. That applied
              at 1440, where the card preview beside the table is fixed. Below lg
              nothing is: the preview there is absolute and scrolls with the
              page, and the only fixed things left are two full-screen overlays
              that do not care.

              No toggle here either. The LOG button folds a margin panel away to
              centre the table, and there is no margin to fold on a phone —
              scrolling past it is the same gesture as not scrolling to it. */}
          <div className="mt-3 border-t border-line pt-3 lg:hidden">
            <p className="mb-1.5 text-[9px] tracking-[0.2em] text-faint">THE LOG</p>
            <div className="h-64 border border-line">
              <Log entries={state.log} />
            </div>
            <div className="mt-2">
              <StakeBar deck={deckInfo} demo={demo} />
            </div>
          </div>
      </div>

      {/* In the left margin, beside the table rather than instead of part of it. */}
      {/* One log, one place: the left margin when there is one, and over the
          left of the table when there is not.
          
          It used to drop to a block underneath the table below 1440px, which was
          worse than it sounds. That layout grows the page, the page starts
          scrolling again, and a fixed panel against a scrolling page comes away
          from the header — the bug that was just fixed, reintroduced by a
          breakpoint. Worse, a vertical scrollbar appearing takes about fifteen
          pixels off the viewport, so a window sitting near 1440 could cross the
          line on its own and the log would appear to move by itself. Overlaying
          costs nothing: it is behind a toggle, so covering the board is a thing
          you asked for and can undo. */}
      {/* Desktop only, and it is a margin panel because there is a margin. The
          narrow screens get the log under the hand instead — see below the Hand.
          It was briefly this same overlay at every width, which put a panel over
          the board on the screen with the least of it. */}
      {logOpen && (
        <div className="fixed top-[4.5rem] left-4 z-30 hidden h-[calc(100dvh-5.5rem)] w-[16rem] flex-col gap-2 lg:flex">
          <div className="min-h-0 flex-1">
            <Log entries={state.log} />
          </div>
          <StakeBar deck={deckInfo} demo={demo} />
        </div>
      )}

      {/* In the right margin. Fixed rather than in flow, so the table does not
          shift sideways every time the mouse crosses a card.

          The width is the smaller of 248px and whatever height is left, times
          5/7 — the card's own ratio. Pinning it to the top of the viewport and
          giving it a fixed width meant that on a short window the bottom of the
          card was simply below the fold, and a card you can only read two thirds
          of is the problem this was built to solve. Now it shrinks instead. */}
      {lifted !== undefined && (
        <motion.div
          key={lifted}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 34 }}
          className="pointer-events-none fixed top-[4.5rem] right-4 z-40 hidden w-[min(248px,calc((100dvh-6rem)*5/7))] min-[1440px]:block"
        >
          <CardView
            card={cardById(INDEX, lifted)}
            free={freeFor(state, cardById(INDEX, lifted))}
          />
        </motion.div>
      )}

      {/* Below 1440px there is no clear margin beside the table — at 1280 it is
          160px against a card that needs 248. So the card overlaps instead,
          anchored right, where the panels carry pump and position counts rather
          than the market cap. Covering a stat you can re-read in a second is
          fine; covering the number the card is explaining is not. */}
      {lifted !== undefined && (
        <motion.div
          key={`inline-${lifted}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 34 }}
          // One stacked variant rather than a block and a hidden fighting each
          // other: `lg:block` and `min-[1440px]:hidden` have the same weight, so
          // which one won came down to the order Tailwind happened to emit them
          // in — and it emitted them the wrong way round, showing both previews
          // at once. This says the condition instead of overriding it.
          // Every width below 1440, not just down to 1024. It used to stop at
          // `lg`, which left phones and any narrow window with no preview at
          // all — and the hand card clamps its rules text to two lines, so
          // below 1024 there was no way to read the rest of a card. The width
          // gives way rather than the card being cut off.
          className="pointer-events-none absolute top-[4.5rem] right-4 z-40 hidden w-[min(248px,calc(100vw-2rem))] max-[1439px]:block"
        >
          <CardView
            card={cardById(INDEX, lifted)}
            free={freeFor(state, cardById(INDEX, lifted))}
          />
        </motion.div>
      )}

      <AnimatePresence>
        {state.finished && !reviewing && (
          <EndScreen
            state={state}
            demo={demo}
            onBoard={onBoard}
            onNew={() => start(demo)}
            onReview={() => setReviewing(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The opponent's hand, face down.
 *
 * "HAND 3" in the corner was the whole of it before, which is a fact rather than
 * a table. Seeing three backs across from you is how a card game tells you what
 * you are up against, and it costs one short row.
 *
 * Backs only, obviously — and only ever theirs. The moment there is a real
 * opponent this is the same component and the same information: how many, and
 * nothing else.
 */
function HandBacks({ count }: { count: number }) {
  return (
    <div
      className="flex h-[58px] shrink-0 items-center gap-1 px-0.5"
      title={`The market is holding ${plural(count, "card", "cards")}.`}
    >
      <AnimatePresence mode="popLayout">
        {Array.from({ length: count }, (_, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, y: -8, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: (i - (count - 1) / 2) * 1.5 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="h-[54px] w-[39px] shrink-0 overflow-hidden rounded-[4px]"
          >
            <CardBack size="tiny" />
          </motion.div>
        ))}
      </AnimatePresence>
      {count === 0 && <span className="text-[9px] tracking-[0.16em] text-faint">EMPTY HAND</span>}
    </div>
  );
}

/** Folds the log away, which centres the table. */
function LogToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? "Fold the log away and centre the table" : "Show the log"}
      className={cx(
        "border px-2.5 py-2 text-[9px] tracking-[0.16em] transition-colors",
        open
          ? "border-line-strong text-muted hover:border-fg hover:text-fg"
          : "border-gold/60 text-gold hover:bg-gold hover:text-ground",
      )}
    >
      LOG
    </button>
  );
}

/** The caption for what just happened. It sits in the turn bar, between the boards. */
function Beat({ flash }: { flash: Flash }) {
  const colour = {
    pump: "text-pump",
    dump: "text-dump",
    neutral: "text-muted",
    system: "text-gold",
  }[flash.beatTone];

  return (
    <div className="hidden min-w-0 flex-1 items-center justify-center overflow-hidden px-2 lg:flex">
      <AnimatePresence mode="wait">
        {flash.beat && (
          <motion.p
            key={flash.beat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            // Nowrap and truncate, both required. In the turn bar this sits in a
            // flex-1 slot that collapsed to 45px, and the caption stacked itself
            // one word per line into a 149px column inside a bar clipped at 26px
            // — which hid the turn, the budget and END TURN along with it.
            className={cx("truncate text-center text-[11px] tracking-wide whitespace-nowrap", colour)}
          >
            {flash.beat}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * What this match is being played for, under the log.
 *
 * It was a strip of its own across the bottom of the table and got folded into
 * the turn bar, which kept the deck name and quietly lost the stake, the burn
 * and the fact that none of it is on-chain yet. Losing the deck name would have
 * been an annoyance; losing "this is not real money" is the kind of thing that
 * has to be said on every screen where a match happens.
 *
 * It sits in the margin because it never changes during a match — the turn bar
 * is for what is changing.
 */
function StakeBar({ deck, demo }: { deck: LoadedDeck | null; demo: boolean }) {
  return (
    <div className="panel shrink-0 space-y-1 border border-line px-3 py-2 text-[9px] tracking-[0.16em] text-faint">
      {/* Yours only. A deck name is a note to yourself, not information about
          the match, so the opponent's is never shown even when there is one. */}
      <div className="flex items-baseline justify-between gap-2">
        <span>DECK</span>
        {demo ? (
          // Not a link. /deck is locked to anyone playing the demo, and sending
          // somebody to a door they cannot open is worse than not offering.
          <span className="truncate text-gold" title="Borrowed for this match.">
            {deck?.name?.trim() || "DEMO"}
          </span>
        ) : (
          <Link
            href="/deck"
            className="truncate text-fg underline-offset-2 hover:underline"
            title="The deck you are playing. Only you see this."
          >
            {deck?.name?.trim() || "UNNAMED"}
          </Link>
        )}
      </div>
      {demo && (
        <p className="pt-1 leading-relaxed text-gold">
          BORROWED DECK — NOTHING HERE IS SAVED. SIGN IN WITH A WALLET TO HOLD CARDS OF YOUR OWN.
        </p>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <span>STAKE</span>
        <span className="text-fg">0 TCG</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span>BURN</span>
        <span className="text-fg">0 TCG</span>
      </div>
      <p className="pt-1 leading-relaxed text-dump">
        NOT ON-CHAIN YET — THIS MATCH RUNS IN YOUR BROWSER
      </p>
      {/* The site footer is not rendered on this page, so the line it carries
          lives here. It is not decoration: the cards name real projects and real
          people. */}
      <p className="pt-1 leading-relaxed normal-case tracking-normal">
        Not financial advice. Cards reference existing projects and people; this game is not
        affiliated with any of them.
      </p>
      {deck && deck.rejected.length > 0 && (
        <p className="leading-relaxed text-gold">
          SAVED DECK WAS NOT LEGAL — PLAYING THE STARTER
        </p>
      )}
    </div>
  );
}

function SidePanel({
  state,
  player,
  targetable,
  flash,
  preview,
  mcDelta,
  blaming,
  wantsDiscard,
  onTarget,
}: {
  state: State;
  player: Player;
  targetable: false | "attack" | "bank";
  flash: Flash;
  preview: Preview;
  /** What the hovered card would do to this player's market cap, or null. */
  mcDelta: number | null;
  /** Which of this side's positions is the reason a control of yours is off. */
  blaming: number | null;
  /** How many cards the hovered card wants in the discard, or null. */
  wantsDiscard: number | null;
  onTarget: (slot: number) => void;
}) {
  const side = state.players[player];
  const isYou = player === "you";
  const toMove = state.toMove === player && !state.finished;
  const pumpTotal = side.projects.reduce((sum, _, i) => sum + pumpOf(state, player, i, INDEX), 0);
  const mcPreview = preview.players.find((p) => p.player === player);

  return (
    <section
      className={cx("panel relative border px-3 py-2", toMove ? "border-line-strong" : "border-line")}
      style={
        toMove
          ? {
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 0 34px -14px ${
                isYou ? "rgba(0,224,138,0.55)" : "rgba(255,77,77,0.4)"
              }`,
            }
          : undefined
      }
    >
      {toMove && (
        <span className={cx("breathe absolute inset-x-0 top-0 h-px", isYou ? "bg-pump" : "bg-dump")} />
      )}

      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[9px] tracking-[0.2em] text-faint">
            {isYou ? "YOU" : "THE MARKET"}
          </span>
          <MCCounter
            value={side.mc}
            label="MC"
            large={isYou}
            delta={flash.mc[player]}
            preview={mcPreview?.impact}
            projected={mcDelta}
          />
        </div>
        {/* The portfolio count used to have a row of its own, under a rule. It
            is three words and a number, and a row of chrome here comes straight
            off the part of the screen the player is choosing from. */}
        <div className="flex items-center gap-4 text-[9px] tracking-[0.16em] text-faint">
          <span className="flex items-center gap-1 text-pump">
            <Icon name="pump" className="h-3 w-3" />+{formatMC(pumpTotal)}/TURN
          </span>
          <span
            className={cx(
              side.projects.length >= RULES.portfolioSize ? "text-gold" : "text-faint",
            )}
          >
            {side.projects.length}/{RULES.portfolioSize} POSITIONS
          </span>
          <span>DECK {side.deck.length}</span>
          {/* Two families are paid off this pile and nothing used to show it, so
              a player had a condition they could not check. Hovering a card that
              asks about it says whether the answer is yes yet. */}
          <span
            className={cx(
              wantsDiscard === null
                ? undefined
                : side.discard.length >= wantsDiscard
                  ? "glow-pump text-pump"
                  : "text-dump",
            )}
            title={
              wantsDiscard === null
                ? undefined
                : `${side.discard.length} in the discard, and this card wants ${wantsDiscard}`
            }
          >
            DISCARD {side.discard.length}
            {wantsDiscard !== null && ` / ${wantsDiscard}`}
          </span>
        </div>
      </header>

      {side.support.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {side.support.map((entry, i) => {
            const card = cardById(INDEX, entry.cardId);
            // Influencers and tools both sit here. Returning null for anything
            // else would put a card on the board and draw nothing — so it throws
            // instead, because a card you cannot see is a card you cannot play
            // around.
            if (card.type !== "person" && card.type !== "tool") {
              throw new Error(`A ${card.type} card ("${card.id}") is sitting in support.`);
            }
            const aura = auraOf(card);
            return (
              // The title attribute is gone with the peek. It was plain text,
              // arrived half a second late, and on a phone it did not exist —
              // which is most of why you could not tell what was on the table.
              <CardPeek key={`${entry.cardId}-${i}`} card={card}>
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex cursor-help items-center gap-1 border px-1.5 py-0.5 text-[8px] tracking-[0.12em]"
                style={{
                  borderColor: `${RARITY[card.rarity].colour}66`,
                  color: RARITY[card.rarity].colour,
                  background: `${RARITY[card.rarity].colour}14`,
                }}
              >
                <Icon name={aura ? "aura" : "effect"} className="h-2.5 w-2.5" />
                {card.ticker}
              </motion.span>
              </CardPeek>
            );
          })}
        </div>
      )}

      {/* overflow-y explicitly off: with only overflow-x-auto the browser sets
          overflow-y to auto too and a vertical scrollbar appears. The pt-5 is the
          room the rising numbers need. */}
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden pt-4 pb-0.5">
        {/* The empty state sits outside AnimatePresence on purpose. As a keyless
            child it never finished exiting, so it stayed behind the tiles and
            shoved them sideways. It has no reason to animate anyway. */}
        {side.projects.length === 0 && (
          <p className="self-center px-1 text-[10px] text-faint">
            {isYou
              ? "Your portfolio is empty. Play a project from your hand to open a position."
              : "No positions."}
          </p>
        )}

        <AnimatePresence mode="popLayout">
          {side.projects.map((onBoard, i) => {
              const card = cardById(INDEX, onBoard.cardId);
              if (card.type !== "project") return null;
              return (
                // Wrapped rather than folded into BoardProject: the same
                // component draws both boards and both games, so the peek is
                // written once here instead of four times inside it.
                <CardPeek key={onBoard.cardId} card={card} disabled={Boolean(targetable)}>
                <BoardProject
                  card={card}
                  onBoard={onBoard}
                  pump={pumpOf(state, player, i, INDEX)}
                  targetable={targetable}
                  preview={preview.slots.find((s) => s.owner === player && s.slot === i)}
                  blocking={blaming === i}
                  marker={flash.projects[key(player, onBoard.cardId)]}
                  onClick={() => onTarget(i)}
                />
                </CardPeek>
              );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** What aiming is asking for. Two bars show it, so it is written once. */
function askOf(aiming: Aiming): string {
  if (aiming.reason === "profit") return "Pick a position to close and bank";
  if (aiming.reason === "close") {
    return `Portfolio full at ${RULES.portfolioSize} — pick a position to close`;
  }
  return aiming.target === "enemyProject"
    ? "Pick a project on the opponent's board"
    : "Pick one of your own projects";
}

function TurnBar({
  state,
  budgetDelta,
  yourTurn,
  aiming,
  flash,
  deck,
  demo,
  logOpen,
  onToggleLog,
  onEnd,
  onCancel,
  onTakeProfit,
  onBlame,
  onNew,
}: {
  state: State;
  /** What the hovered hand card would do to the budget, or null while nothing is hovered. */
  budgetDelta: { spendable: number; price: number } | null;
  yourTurn: boolean;
  aiming: Aiming | null;
  flash: Flash;
  deck: LoadedDeck | null;
  demo: boolean;
  logOpen: boolean;
  onToggleLog: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onTakeProfit: () => void;
  /** Point at the opponent's position holding a rule up, or at nothing. */
  onBlame: (slot: number | null) => void;
  onNew: () => void;
}) {
  const left = state.budgetThisTurn - state.budgetSpentThisTurn;
  const progress = Math.min(state.turn, RULES.turns) / RULES.turns;

  return (
    <div className="panel-raised relative flex flex-wrap items-center justify-between gap-3 overflow-hidden border border-line px-3 py-2">
      {/* Progress across the whole match. You see how much is left without counting. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-gold/60 transition-transform duration-700"
        style={{ transform: `scaleX(${progress})` }}
      />

      {/* min-w-0 so this group is what gives when the bar is tight, and the
          controls on the right are shrink-0 so they never are. Losing END TURN
          and the budget off the edge of the bar is worse than losing a deck
          name, and that is exactly what happened. */}
      <div className="flex min-w-0 items-center gap-4">
        {/* Your deck's name, at the table and only for you. It had a strip of
            its own under the hand; it is four words and belongs with the rest of
            the state. */}
        {demo ? (
          // Not a link: /deck is locked to anyone playing the demo. Shown from
          // sm up rather than xl, because this is the one label on the table
          // that says these cards are not yours and it should not be the first
          // thing a narrow window drops.
          <span
            className="hidden truncate text-[9px] tracking-[0.16em] text-gold sm:block"
            title="Borrowed for this match. Nothing here is saved."
          >
            {deck?.name?.trim() || "DEMO"} · DEMO, NOT SAVED
          </span>
        ) : (
          <Link
            href="/deck"
            className="hidden truncate text-[9px] tracking-[0.16em] text-faint underline-offset-2 hover:text-fg hover:underline xl:block"
            title="The deck you are playing. Only you see this."
          >
            {deck?.name?.trim() || "UNNAMED"}
          </Link>
        )}

        <span className="text-[10px] tracking-[0.18em] text-faint">
          TURN{" "}
          <span className="display ml-1 text-base text-fg">{Math.min(state.turn, RULES.turns)}</span>
          <span className="text-faint">/{RULES.turns}</span>
        </span>

        {/* The budget, as money rather than as pips.
            This showed dots labelled CARDS, left over from when a turn was three
            cards, driven by budget divided by the cost of an action — which on
            turn one rounds to a single dot and means nothing. What a player needs
            is the number they are spending against, and the warning that whatever
            is left comes off their market cap when the turn ends. */}
        <div
          className="flex items-center gap-2"
          title={budgetNote(left, state.toMove === FIRST_MOVER)}
        >
          <span className="text-[10px] tracking-[0.18em] text-faint">BUDGET</span>
          <span className={cx("display text-base", left > 0 ? "text-gold" : "text-pump")}>
            {formatMC(left)}
          </span>
          {/* Where the budget lands if the hovered card is played. The resulting
              amount rather than the delta, because "you will have $80K" is the
              thing being decided and "-$200K" still has to be subtracted. Both
              are shown when the card hands budget back, since a card that costs
              $280K and leaves you richer is otherwise unreadable. */}
          {budgetDelta !== null && budgetDelta.spendable !== 0 ? (
            <span
              className={cx(
                "display text-base",
                budgetDelta.spendable > 0 ? "text-pump" : "text-dump",
              )}
            >
              → {formatMC(left + budgetDelta.spendable)}
              {budgetDelta.price > 0 && budgetDelta.spendable > 0 && (
                <span className="ml-1 text-[9px] tracking-normal text-faint">
                  (costs {formatMC(budgetDelta.price)}, gives more back)
                </span>
              )}
            </span>
          ) : (
            <span className="text-[9px] text-faint">/ {formatMC(state.budgetThisTurn)}</span>
          )}
          <span className="h-1 w-14 shrink-0 bg-line">
            <span
              className="block h-full bg-pump transition-[width]"
              style={{
                width: `${Math.round((state.budgetSpentThisTurn / Math.max(1, state.budgetThisTurn)) * 100)}%`,
              }}
            />
          </span>
        </div>

        {/* The free card for moving first. Shown while it is unspent and gone
            once it is, because a marker that never changes is scenery. */}
        {state.freePlays[FIRST_MOVER] > 0 && (
          <div
            className="flex items-center gap-1.5"
            title={freePlayNote(
              state.freePlays[FIRST_MOVER],
              0,
              state.toMove === FIRST_MOVER,
            )}
          >
            <span className="text-[10px] tracking-[0.18em] text-faint">FREE CARD</span>
            <span className="display border border-gold px-1.5 text-[10px] text-gold">1</span>
          </div>
        )}

        {/* Last, deliberately. This group is the one that gives when the bar is
            tight, and within it these are the least important things on the
            table — so if anything is ever pushed onto a second line, it is the
            mute button rather than END TURN. */}
        <SoundToggle />
      </div>

      <Beat flash={flash} />

      {/* ml-auto, and it is not decoration. The bar wraps on purpose — it has to,
          because a long deck name plus the budget plus these controls does not
          fit 864px at every width. What was wrong is where they landed when it
          did: under justify-between a wrapped group is alone on its line and
          goes to the START of it, so take profit, the log and END TURN dropped
          to the bottom LEFT. A margin that eats the free space keeps them on the
          right whether they wrapped or not. */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {aiming ? (
          <>
            <span className={cx("text-[10px]", aiming.reason === "profit" ? "text-gold" : "text-dump")}>
              {askOf(aiming)}
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="border border-line-strong px-2.5 py-1.5 text-[9px] tracking-[0.16em] text-muted hover:text-fg"
            >
              ESC
            </button>
          </>
        ) : state.finished ? (
          <>
            <span
              className={cx(
                "text-[10px] tracking-[0.16em]",
                state.winner === null
                  ? "text-fg"
                  : state.winner === "you"
                    ? "text-pump"
                    : "text-dump",
              )}
            >
              {state.winner === null
                ? "DRAW"
                : state.winner === "you"
                  ? "YOU WON"
                  : "THE MARKET WON"}
            </span>
            <button
              type="button"
              onClick={onNew}
              className="glow-pump border border-pump bg-pump/10 px-4 py-2 text-[9px] tracking-[0.18em] text-pump hover:bg-pump hover:text-ground"
            >
              NEW MATCH
            </button>
          </>
        ) : yourTurn ? (
          <>
            {/* Always drawn, never conditional. It was `canTakeProfit && …`
                and the button disappeared, which is the complaint that started
                this: no way to bank, and nothing on screen willing to say why. */}
            <TakeProfitButton
              noProfit={whyNoProfit(state, "you", INDEX)}
              onTakeProfit={onTakeProfit}
              onBlame={onBlame}
            />
            {/* Folds the margin panel away. There is no margin below lg and the
                log lives under the hand there, so the control has nothing to do
                on a phone. */}
            <span className="hidden lg:block">
              <LogToggle open={logOpen} onToggle={onToggleLog} />
            </span>
            {/* What ending the turn costs, on the button that does it.
                Unspent marketing budget comes off your market cap in full, and
                that is the largest swing in the game — a cheap hand on turn six
                leaves 130K on the table and takes 130K off your score. The bar
                shows the budget, but nothing said what pressing this would do,
                so the number goes here and the button stops looking safe. */}
            <button
              type="button"
              onClick={onEnd}
              title={
                left > 0
                  ? `${formatMC(left)} of marketing budget is unspent. Ending the turn takes it off your market cap.`
                  : "The whole budget is spent. Ending the turn costs nothing."
              }
              className={cx(
                "border px-4 py-2 text-[9px] tracking-[0.18em] transition-colors",
                left > 0
                  ? "border-gold bg-gold/10 text-gold hover:bg-gold hover:text-ground"
                  : "glow-pump border-pump bg-pump/10 text-pump hover:bg-pump hover:text-ground",
              )}
            >
              END TURN
              {left > 0 && <span className="ml-1.5 text-gold/80">−{formatMC(left)}</span>}
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2 px-3 py-2 text-[9px] tracking-[0.18em] text-muted">
            <span className="breathe h-1.5 w-1.5 bg-dump" />
            THE MARKET IS MOVING
          </span>
        )}
      </div>
    </div>
  );
}

function Hand({
  state,
  yourTurn,
  chosen,
  hovered,
  onHover,
  onClick,
  onDiscard,
  offerDiscard,
  noDiscard,
}: {
  state: State;
  yourTurn: boolean;
  chosen: number | null;
  hovered: number | null;
  onHover: (handIndex: number | null) => void;
  onClick: (handIndex: number) => void;
  onDiscard: (handIndex: number) => void;
  /**
   * Should the × be on the cards at all?
   *
   * Not the same question as whether the move is legal, which is what this used
   * to be and is why a short budget made the mechanic vanish. This is only "is
   * the hand yours to act on right now" — your turn, and not in the middle of
   * choosing a target, where a row of × answers a different question.
   */
  offerDiscard: boolean;
  /** Why the move is refused, or null. The × greys itself and says so. */
  noDiscard: Refusal | null;
}) {
  return (
    <section className="shrink-0">
      {/* The card you are pointing at, at a size you can actually read.
          A hand row big enough to read five cards at once does not fit next to
          two boards on a laptop — the arithmetic simply does not close — and
          shrinking the board to make it fit was the thing that got rejected. So
          the row stays small and the one card you are considering comes up over
          the table for as long as you are considering it. */}
      <h2 className="mb-1 shrink-0 text-[9px] tracking-[0.2em] text-faint">
        YOUR HAND — {state.players.you.hand.length} CARDS
        <span className="ml-3 text-faint/60">PLAY A PROJECT TO ADD IT TO YOUR PORTFOLIO</span>
        <span className="ml-3 text-faint/60">
          · × THROWS ONE AWAY FOR {formatMC(TURN_ACTION_COST)} AND DRAWS A FRESH ONE NEXT TURN
        </span>
      </h2>

      {/* The row's height follows its content: pt-4 for the hover lift, the card
          height, and pb-3. Nothing is cut off, and because it never shrinks below
          its content overflow-y-hidden clips nothing either. */}
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden px-0.5 pt-4 pb-2">
        <AnimatePresence mode="popLayout">
          {state.players.you.hand.map((id, i) => {
            const card = cardById(INDEX, id);
            const canPlay = playable(state, card, "you", INDEX);
            const upgrade = upgradesAPosition(state, card, "you", INDEX);
            const reason = !yourTurn
              ? "The market is moving."
              : (whyNot(state, card, "you", INDEX) ??
                (needsPortfolioSlot(state, card, "you", INDEX)
                  ? "Portfolio is full — playing this asks you to close a position first."
                  : ""));

            /**
             * The short version, printed under the card.
             *
             * Three different things and only one of them is bad news. A card
             * that upgrades a position and a card that will ask you to close one
             * are both playable, and telling those two apart is the difference
             * between giving up a position you had to and one you did not.
             */
            const note: string | null = !canPlay
              ? reason || null
              : upgrade
                ? `Takes over your ${card.ticker} position`
                : needsPortfolioSlot(state, card, "you", INDEX)
                  ? "Asks you to close a position"
                  : null;

            return (
              <motion.div
                key={`${id}-${i}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                // pointerType, not a media query. A finger fires mouseenter
                // too and never fires mouseleave, so a tap meant to PLAY a card
                // opened the big preview and left it open — over the board, on
                // the smallest screen, showing whichever card slid into that
                // index after the hand re-shuffled. Asking the event what kind
                // of pointer it is answers per touch instead of per device, so a
                // laptop with a touchscreen still hovers with its mouse.
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") onHover(i);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") onHover(null);
                }}
                whileHover={canPlay ? { y: -10, scale: 1.03 } : undefined}
                // Width only. The card is aspect-[5/7], so giving it a height —
                // which this did, h-[232px] inside a 128px slot — makes it 166px
                // wide and it laps over its neighbour. Set the width and let the
                // ratio pick the height, and the slot cannot disagree with the
                // card it holds.
                // `group` so the × on this card reveals on hover. Without it
                // the × is invisible on every pointer that can hover, which is
                // most of them — see DiscardButton.
                // A board tile is 104px on a phone. At 196px a hand card was
                // nearly twice that and the table stopped looking like one
                // table. It was 196 because the card's type was a fixed pixel
                // size and would not fit in anything smaller — that is sized in
                // cqw now, so the card can be small and still be a card.
                // @container so the note below can size itself against the
                // card the way the card's own type does. The card frame is a
                // container too, but the note is a sibling of it rather than a
                // child, so it needs one here or its cqw resolves against
                // whatever ancestor happens to be one.
                className="group @container relative w-[132px] shrink-0 self-start sm:w-[160px]"
              >
                <button
                  type="button"
                  disabled={!canPlay}
                  onClick={() => onClick(i)}
                  // Keyboard focus, not the focus a tap leaves behind. Tapping
                  // a button focuses it, so this opened the preview on touch
                  // even after the pointer handlers stopped doing it.
                  // :focus-visible is exactly the distinction the browser
                  // already draws.
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) onHover(i);
                  }}
                  onBlur={() => onHover(null)}
                  title={
                    reason ||
                    (upgrade
                      ? `${card.name} takes over your ${card.ticker} position and inherits its pump.`
                      : card.name)
                  }
                  className={cx(
                    "block w-full text-left transition-opacity",
                    canPlay ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-40",
                    chosen === i && "ring-1 ring-dump",
                    hovered === i && canPlay && chosen === null && "ring-1 ring-gold/60",
                  )}
                >
                  <CardView
                    card={card}
                    compact
                    free={freeFor(state, card)}
                    // The engine's number, not the rarity's. See CardView.price.
                    price={priceFor(state, card, "you", INDEX)}
                    className="w-full"
                  />
                </button>

                {/* The reason, on the card.
                    It lived in `title` alone, which is a tooltip, which is a
                    hover, which a phone does not have — so a card at 40% opacity
                    said nothing at all about why. That is most of "I suddenly
                    could not play". It is worth having on a desktop too: reading
                    it should not cost a wait. */}
                {note !== null && (
                  // Over the card, not under it. The table is height-tuned to put
                  // everything on one screen with nothing scrolling, and a line
                  // of text beneath each card grows the hand and pushes it under
                  // the fold — which is a new bug in place of the old one.
                  <p
                    className={cx(
                      // Sized against the card, like everything on it. At a
                      // fixed 9px this was larger than the rules text it was
                      // covering on a phone, which is the wrong way round: the
                      // note explains the card, it is not the card.
                      "pointer-events-none absolute inset-x-0 bottom-0 line-clamp-3 border-t px-1.5 py-1 text-[5.6cqw] leading-snug @[150px]:text-[9px]",
                      canPlay
                        ? "border-gold/40 bg-ground/95 text-gold"
                        : "border-line-strong bg-ground/95 text-muted",
                    )}
                  >
                    {note}
                  </p>
                )}

                {/* Drawn whenever it is your turn, refused or not — the same
                    component the PvP table draws, reading the same sentence out
                    of the same engine call. It was `discardable && …` here too,
                    so a short budget took the × away rather than explaining it. */}
                {/* Reading a card is not a move, so this is not behind
                    offerDiscard: it is there on the opponent's turn too, which
                    is when you most want to look. */}
                <PeekButton
                  open={hovered === i}
                  onToggle={() => onHover(hovered === i ? null : i)}
                />

                {offerDiscard && (
                  <DiscardButton
                    cardName={cardLabel(card)}
                    noDiscard={noDiscard}
                    onDiscard={() => onDiscard(i)}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

/**
 * The weekly board, on the end screen, after the server has checked the match.
 *
 * Three states and they say different things on purpose. Top of the board is a
 * position to defend. Second by a margin is a number to chase, and the margin is
 * printed because "you are second" is a fact while "you are second by $40K" is a
 * reason to press ONE MORE. A win that did not beat your own best says so rather
 * than going quiet, because silence there reads as a submission that failed.
 */
function EndScreen({
  state,
  demo,
  onBoard,
  onNew,
  onReview,
}: {
  state: State;
  demo: boolean;
  /** The server took this as the week's best for this wallet. */
  onBoard: boolean;
  onNew: () => void;
  onReview: () => void;
}) {
  const yours = state.players.you.mc;
  const theirs = state.players.opponent.mc;
  const won = state.winner === "you";
  const [yoursText, theirsText] = formatMCPair(yours, theirs);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-ground/90 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ y: 20, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="panel w-full max-w-sm border border-line p-8 text-center"
        style={{
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 60px -20px ${
            won ? "rgba(0,224,138,0.6)" : "rgba(255,77,77,0.5)"
          }`,
        }}
      >
        <p className="text-[9px] tracking-[0.24em] text-faint">AFTER {RULES.turns} TURNS</p>
        <h2
          className={cx(
            "display mt-3 text-3xl",
            state.winner === null ? "text-fg" : won ? "green-gradient" : "text-dump",
          )}
        >
          {state.winner === null ? "DRAW" : won ? "YOU WIN" : "THE MARKET WINS"}
        </h2>

        {/* Written with as many decimals as it takes to tell the two apart, and
            no more. Both players reading "$1.7M" with a winner named underneath
            was the screen contradicting itself; spelling both out to the dollar
            fixed that and read like a bank statement. */}
        <dl className="mt-6 grid grid-cols-2 border border-line">
          <div className="border-r border-line px-3 py-4">
            <dt className="text-[8px] tracking-[0.16em] text-faint">YOUR MC</dt>
            <dd className="display mt-1.5 text-xl tabular-nums">{yoursText}</dd>
          </div>
          <div className="px-3 py-4">
            <dt className="text-[8px] tracking-[0.16em] text-faint">THE MARKET</dt>
            <dd className="display mt-1.5 text-xl tabular-nums">{theirsText}</dd>
          </div>
        </dl>

        <p className="mt-2 text-center text-[10px] text-muted">
          {state.winner === null
            ? "Level to the dollar."
            : `${won ? "Won" : "Lost"} by ${formatMCExact(Math.abs(yours - theirs))}.`}
        </p>

        {/* Only when the server said so. A win that did not beat your own best
            this week changes nothing on the board, and saying otherwise would
            be this screen reporting a result it did not get. */}
        {onBoard && (
          <p className="mt-3 text-center text-[10px] text-pump">
            Your best of the week.{" "}
            <Link href="/tournament" className="underline hover:text-fg">
              See the board
            </Link>
            .
          </p>
        )}

        {demo && (
          // The moment somebody decides whether this was worth coming back for.
          // Saying it here rather than only mid-match: a result feels like
          // something you earned, and this one is not on anybody's record.
          <p className="mt-5 border border-gold/40 bg-gold/5 px-3 py-2 text-[10px] leading-relaxed text-gold">
            That was a borrowed deck and nothing was kept — no cards, no record, no rank. Sign in
            with a wallet to hold a collection of your own.
          </p>
        )}

        <button
          type="button"
          onClick={onNew}
          className="glow-pump mt-6 w-full border border-pump bg-pump/10 px-4 py-3 text-[10px] tracking-[0.2em] text-pump transition-colors hover:bg-pump hover:text-ground"
        >
          ONE MORE
        </button>

        {/* The log is the most interesting thing on screen the moment a match
            ends — a match that turned on the last turn is a match you want to
            read back — and this panel was sitting on top of it. */}
        <button
          type="button"
          onClick={onReview}
          className="mt-2 w-full border border-line-strong px-4 py-2.5 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-fg hover:text-fg"
        >
          READ THE LOG
        </button>
      </motion.div>
    </motion.div>
  );
}
