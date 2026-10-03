"use client";

// The table, for a match against a person.
//
// It works from a PlayerView and never from a State, which is the whole reason
// this is a separate screen from the solo table rather than a mode on it. A
// State holds both hands and the seed; a client given one knows every card the
// opponent is about to draw. Two different things, two different types, two
// different screens — a shared component would have to take the union and would
// end up reaching for a field that is not there.
//
// Nothing here decides what is legal. Every "can I play this" comes down in the
// view, answered by the engine on the server, and pressing a card the screen
// thinks is fine still goes through applyMoveAs. In Cards of Cronos the card
// check was a UI filter and a direct call could play anything; the fix was not a
// better filter, it was that the screen stopped deciding.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CardView } from "@/components/CardView";
import { BoardProject } from "@/components/game/BoardProject";
import { CardPeek } from "@/components/game/CardPeek";
import { DiscardButton } from "@/components/game/DiscardButton";
import { PeekButton } from "@/components/game/PeekButton";
import { MCCounter } from "@/components/game/MCCounter";
import { EMPTY_FLASH, FLASH_MS, key as flashKey, makeFlash, type Flash } from "@/components/game/diff";
import { TakeProfitButton } from "@/components/game/TakeProfitButton";
import { Icon } from "@/components/Icon";
import { Log } from "@/components/game/Log";
import { cardById } from "@/engine/helpers";
import { formatMC } from "@/engine/format";
import { EMPTY_PREVIEW, previewOf, type Preview } from "@/engine/preview";
import { FIRST_MOVER, withinFreeCap, discardRequirementOf} from "@/engine/match";
import { budgetNote, freePlayNote } from "@/engine/rules-text";
import { snapshotOfView, type Snapshot } from "@/engine/snapshot";
import type { BoardSupport, ChoiceTarget, Move, Player } from "@/engine/types";
import { RULES, TURN_ACTION_COST, auraOf } from "@/engine/types";
import type { PlayerView, ViewProject } from "@/engine/view";
import { ask } from "@/lib/pvp-client";
import { EndScreen } from "@/components/pvp/EndScreen";
import { cx } from "@/lib/cx";
import { INDEX } from "@/lib/set";

interface Answer {
  id: string;
  opponent: string;
  /** A live clock, or a day. It changes how this screen behaves. */
  mode: "live" | "correspondence";
  deadline: number;
  /**
   * Whether that deadline is a turn or only how long the match will wait.
   *
   * A match starts when the second player sits down, which can be long after
   * the first one offered the seat — so the opening deadline is a grace window
   * and counting it down as a turn would be a lie told once a second.
   */
  armed: boolean;
  view: PlayerView;
  /** CRO a side, or zero for a friendly match. Held by contracts/MatchEscrow.sol. */
  stake: number;
}

interface Aiming {
  handIndex: number | null;
  target: ChoiceTarget;
  reason: "effect" | "close" | "profit";
  /** The position already picked to close, when a card asks both questions. */
  closed?: number;
}

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

/**
 * How often to look for the opponent's move, and for how long that stays quick.
 *
 * Correspondence is a day a turn, but two people sitting at it together want it
 * to feel like a game rather than a mailbox — and the first minute is when they
 * are both actually there. So: quick while somebody is plainly watching, then
 * slower, because a tab left open all afternoon should not be asking every three
 * seconds for a board that changes once.
 *
 * Only ever while it is *their* turn. Nothing can change on yours: the opponent
 * cannot move, and the clock is drawn from a number already on screen. Polling
 * then would be asking a question whose answer is already known.
 */
const POLL_QUICK = 3_000;
const POLL_SLOW = 20_000;
const STAYS_QUICK = 90_000;

/**
 * How long is left, in units somebody can act on.
 *
 * Seconds below ten minutes. This read `${minutes}m` at every size, with a
 * floor of one — so a live match's whole clock was "2m", then "1m", then "1m"
 * again, then "expired". On a day-long clock that is fine; on a clock measured
 * in minutes it is a countdown that never counts.
 */
function timeLeft(deadline: number, now: number): string {
  const ms = deadline - now;
  if (ms <= 0) return "expired";
  if (ms >= 3_600_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms >= 600_000) return `${Math.floor(ms / 60_000)}m`;
  const seconds = Math.ceil(ms / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Which side of the table a target requirement points at, from where you sit. */
function boardFor(target: ChoiceTarget, me: Player): Player {
  const wantsMine = target === "ownProject";
  return wantsMine ? me : me === "you" ? "opponent" : "you";
}

/**
 * The shared half of a side's props.
 *
 * ── WHY THIS IS A PROP AND NOT A CLOSURE ─────────────────────────────────────
 *
 * `Side` used to be declared inside MatchBoard, which read fine and was a real
 * bug: a function declared in a render body is a NEW function on every render,
 * so React saw a different component type in that slot each time, threw the
 * whole subtree away and built a fresh one. Every piece of state underneath
 * went with it — including every CardPeek's open flag, which is how a magnified
 * card closed on its own. A live match re-renders once a second to tick the
 * clock, so a card held up to be read was gone before it had been read.
 *
 * None of the markup changed to fix that. It only had to stop being born again,
 * and the eleven things it used to read off the enclosing scope are named here
 * instead — which also makes them impossible to capture by accident.
 */
interface SideTable {
  me: Player;
  them: Player;
  toMove: Player;
  finished: boolean;
  flash: Flash;
  preview: Preview;
  mcDelta: { you: number; opponent: number } | null;
  aimingAt: Player | null;
  aiming: Aiming | null;
  blaming: number | null;
  clickTarget: (side: Player, slot: number) => void;
}

function Side({ side, projects, support, mc, deckCount, finishedCount, wantsDiscard, label, shared }: {
  side: Player;
  projects: ViewProject[];
  support: BoardSupport[];
  mc: number;
  deckCount: number;
  finishedCount: number;
  /** How many cards the hovered card wants in the discard, or null. */
  wantsDiscard: number | null;
  label: string;
  /** Everything about the table that is the same for both sides. */
  shared: SideTable;
}) {
  // The pump is already worked out per position by the server. Adding four
  // numbers up is not a rule, and the total is the figure a player actually
  // steers by — it was the one thing missing that you cannot play without.
  const { me, them, toMove, finished, flash, preview, mcDelta, aimingAt, aiming, blaming,
    clickTarget } = shared;
  const pumpTotal = projects.reduce((sum, project) => sum + project.pump, 0);
  const theirs = toMove === side && !finished;

  return (
  <section
    className={cx(
      "panel relative border px-3 py-3",
      theirs ? "border-line-strong" : "border-line",
    )}
  >
    {theirs && (
      <span
        className={cx(
          "breathe absolute inset-x-0 top-0 h-px",
          side === me ? "bg-pump" : "bg-dump",
        )}
      />
    )}

    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex items-baseline gap-3">
        <span className="text-[9px] tracking-[0.2em] text-faint">{label}</span>
        {/* The same counter the solo table uses. It was a plain span here, so
            the market cap jumped where it counts on the other screen, and
            nothing on it flashed, glowed or said what a hovered card would
            do — four differences on the number the whole game is about. */}
        <MCCounter
          value={mc}
          label="MC"
          large={side === me}
          delta={flash.mc[side]}
          preview={preview.players.find((p) => p.player === side)?.impact}
          projected={mcDelta === null ? null : mcDelta[side]}
        />
      </div>
      <div className="flex items-center gap-4 text-[9px] tracking-[0.16em] text-faint">
        <span className="flex items-center gap-1 text-pump">
          <Icon name="pump" className="h-3 w-3" />+{formatMC(pumpTotal)}/TURN
        </span>
        <span className={cx(projects.length >= RULES.portfolioSize ? "text-gold" : "text-faint")}>
          {projects.length}/{RULES.portfolioSize} POSITIONS
        </span>
        <span>DECK {deckCount}</span>
        {/* The same rule the solo table shows, read off the same function, so
            the two tables cannot disagree about what a card is asking for. */}
        <span
          className={cx(
            wantsDiscard === null
              ? undefined
              : finishedCount >= wantsDiscard
                ? "glow-pump text-pump"
                : "text-dump",
          )}
          title={
            wantsDiscard === null
              ? undefined
              : `${finishedCount} in the discard, and this card wants ${wantsDiscard}`
          }
        >
          DISCARD {finishedCount}
          {wantsDiscard !== null && ` / ${wantsDiscard}`}
        </span>
      </div>
    </header>

    {/* Influencers and tools, which were not drawn here at all — so an aura
        doubling somebody's pump was invisible on both sides of the table.
        A card you cannot see is a card you cannot play around. */}
    {support.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {support.map((entry, i) => {
          const card = cardById(INDEX, entry.cardId);
          if (card.type !== "person" && card.type !== "tool") {
            throw new Error(`A ${card.type} card ("${card.id}") is sitting in support.`);
          }
          const aura = auraOf(card);
          return (
            // Same peek as the solo board, from the same component. Two boards
            // that answer "what is that card" two different ways is how one of
            // them quietly stops answering it.
            <CardPeek key={`${entry.cardId}-${i}`} card={card}>
              <span className="block cursor-help border border-line-strong px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-muted">
                {card.ticker}
              </span>
            </CardPeek>
          );
        })}
      </div>
    )}

    {projects.length === 0 ? (
      <p className="mt-3 text-[10px] text-faint">No positions.</p>
    ) : (
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {projects.map((project, slot) => {
          const card = cardById(INDEX, project.cardId);
          if (card.type !== "project") return null;
          return (
            <CardPeek
              key={`${project.cardId}-${slot}`}
              card={card}
              disabled={aimingAt === side}
            >
            <BoardProject
              card={card}
              onBoard={project}
              pump={project.pump}
              targetable={aimingAt === side && (aiming?.reason === "profit" ? "bank" : "attack")}
              blocking={side === them && blaming === slot}
              preview={preview.slots.find((s) => s.owner === side && s.slot === slot)}
              marker={flash.projects[flashKey(side, project.cardId)]}
              onClick={() => clickTarget(side, slot)}
            />
            </CardPeek>
          );
        })}
      </div>
    )}
  </section>
  );
}

export function MatchBoard({ id }: { id: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [aiming, setAiming] = useState<Aiming | null>(null);
  /**
   * Which of the opponent's positions is being pointed at as the reason a
   * control of yours is switched off. The solo table holds the same thing for
   * the same reason — see Game.tsx.
   */
  const [blaming, setBlaming] = useState<number | null>(null);
  /** Which card in the hand the pointer is over, so the board can show what it does. */
  const [hovered, setHovered] = useState<number | null>(null);
  /**
   * What visibly changed since the last view.
   *
   * The solo table diffs two States around its own move. This one cannot: it
   * polls, and a new view arrives without the move that caused it. So it keeps
   * the previous snapshot and diffs against that — which also covers the case
   * the solo table never has, where the other side made several moves between
   * two looks.
   */
  const [flash, setFlash] = useState<Flash>(EMPTY_FLASH);
  const lastSeen = useRef<Snapshot | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Two moments, diffed. Runs on every answer, including the first — where
  // there is no previous snapshot and so nothing to compare, which is not the
  // same as nothing having happened and must not flash as though it were.
  useEffect(() => {
    if (answer === null) return;
    const now = snapshotOfView(answer.view);
    const before = lastSeen.current;
    lastSeen.current = now;
    if (before === null) return;

    const next = makeFlash(before, now);
    // Nothing changed: leave whatever is on screen alone rather than clearing
    // it. A poll that finds no news should not cut a number short mid-rise.
    const moved =
      Object.keys(next.projects).length > 0 || Object.keys(next.mc).length > 0 || next.rug;
    if (!moved) return;

    setFlash(next);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(EMPTY_FLASH), FLASH_MS);
  }, [answer]);

  // Cleared on the way out. A timer that fires into an unmounted tree is a
  // React warning today and a leak in any case.
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // A highlight is about one moment, so it goes when the match moves. Keyed on
  // the whole answer rather than on the view inside it: the view is unwrapped
  // after an early return, and a hook cannot live there.
  useEffect(() => setBlaming(null), [answer]);

  const load = useCallback(async () => {
    try {
      setAnswer(await ask<Answer>("match", { id }));
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not read that match.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * The clock, ticking at the speed the clock actually moves.
   *
   * A minute was right while every match was a day long and is useless at two
   * minutes: it would redraw twice in the whole window. So it follows the
   * match, and a live one ticks every second.
   */
  const live = answer?.mode === "live";
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), live ? 1_000 : 60_000);
    return () => clearInterval(timer);
  }, [live]);

  const waiting = answer !== null && !answer.view.finished && answer.view.toMove !== answer.view.me;

  /**
   * Watch for the opponent's move while it is theirs to make.
   *
   * Stops dead when the tab is hidden and asks again the moment it comes back,
   * which is both the polite thing and the useful one: coming back to a stale
   * board is exactly the complaint this is fixing, and a hidden tab that keeps
   * polling is a battery nobody agreed to spend.
   */
  useEffect(() => {
    if (!waiting) return;

    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (document.visibilityState === "visible") void load();
      // A live match never slows down. Twenty seconds of a two-minute turn is
      // a sixth of it spent not knowing it had started, and the turn is lost at
      // the end of that window rather than merely late.
      const quick = live || Date.now() - startedAt < STAYS_QUICK;
      timer = setTimeout(tick, quick ? POLL_QUICK : POLL_SLOW);
    };
    timer = setTimeout(tick, POLL_QUICK);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waiting, load, live]);

  async function send(move: Move) {
    setBusy(true);
    setProblem(null);
    try {
      const played = await ask<{ view: PlayerView; deadline: number }>("move", { id, move });
      setAnswer((was) => (was ? { ...was, view: played.view, deadline: played.deadline } : was));
      setAiming(null);

      // A move that ends the match has to be followed by a real read. /move
      // returns the board and nothing else, so whoever plays the last card is
      // looking at a match record from before it was over. Nothing rides on that
      // yet — every match here is friendly — but it will the moment a stake can
      // be held, and the player who finishes a staked match is exactly the one
      // who must not be told it was played for nothing.
      if (played.view.finished) await load();
    } catch (error) {
      // The engine's own sentence. It knows what happened and this does not.
      setProblem(error instanceof Error ? error.message : "That move was refused.");
      // And re-read, because a refusal often means the board is not what this
      // screen thought — the opponent moved, or the clock ran out.
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (problem && answer === null) {
    return (
      <div className="panel border border-line px-6 py-16 text-center">
        <p className="text-[10px] tracking-[0.28em] text-faint">NOT HERE</p>
        <h2 className="display mt-3 text-2xl">NO SUCH MATCH</h2>
        <p className="mx-auto mt-4 max-w-md text-[11px] leading-relaxed text-muted">{problem}</p>
        <Link
          href="/pvp"
          className="mt-8 inline-block border border-line-strong px-5 py-3 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-fg hover:text-fg"
        >
          BACK TO THE LOBBY
        </Link>
      </div>
    );
  }

  if (answer === null) {
    return <p className="text-[10px] tracking-[0.16em] text-faint">READING…</p>;
  }

  const { view } = answer;
  // Above Side rather than below it. It was under it, and Side reads it — which
  // worked only because Side happens to be called further down still. A closure
  // depending on the order of two things that look unrelated is a trap for
  // whoever moves either of them next.
  const them: Player = view.me === "you" ? "opponent" : "you";
  const mine = view.toMove === view.me && !view.finished;

  // The same three lines the solo table runs, against the same functions. The
  // only difference is where the board comes from: a Snapshot built from this
  // view instead of one built from a State.
  const table = snapshotOfView(view);
  /**
   * The card being read, drawn big over the table.
   *
   * This table tracked `hovered`, drew the magnifier, and then drew nothing.
   * So the button worked — the budget and the preview numbers moved with it —
   * and the one thing it is named after never happened. On a phone, where the
   * magnifier is the only way to read a card at all and the hand row clamps
   * the rules text to two lines, that left no way to read a card during a
   * match.
   *
   * Taken from the solo table, which has had it the whole time. Both render it
   * from the same CardView; what differs is only where the free play comes
   * from, because this side has a view and not a State.
   */
  const lifted = hovered !== null ? view.you.hand[hovered] : undefined;
  const liftedCard = lifted !== undefined ? cardById(INDEX, lifted) : null;
  // The same sentence the hand row uses, so the big card and the small one
  // cannot disagree about whether this play is free.
  const liftedFree =
    liftedCard !== null && view.you.freePlays > 0 && mine && withinFreeCap(liftedCard);

  const hoveredCard =
    hovered !== null && !aiming && view.you.hand[hovered] !== undefined
      ? cardById(INDEX, view.you.hand[hovered]!)
      : null;
  /** What the hovered card asks of the discard, read off the card itself. */
  const wantsDiscard = hoveredCard ? discardRequirementOf(hoveredCard) : null;

  const preview =
    hoveredCard && view.you.playable[hovered!]?.canPlay
      ? previewOf(table, hoveredCard, view.me, INDEX)
      : EMPTY_PREVIEW;
  // Worked out on the server, because answering it means playing the move and
  // that needs the deck. See HandCardView.mcDelta.
  const mcDelta =
    hovered !== null && view.you.playable[hovered]?.canPlay
      ? (view.you.playable[hovered]!.mcDelta ?? null)
      : null;
  const aimingAt = aiming ? boardFor(aiming.target, view.me) : null;
  const budgetLeft = view.budgetThisTurn - view.budgetSpentThisTurn;

  // Rebuilt every render, and that is not the thing that used to be wrong. A new
  // OBJECT is just new props; a new COMPONENT is a new type, and React answers
  // the two completely differently — it diffs the first and remounts the second.
  // See SideTable.
  const shared: SideTable = {
    me: view.me,
    them,
    toMove: view.toMove,
    finished: view.finished,
    flash,
    preview,
    mcDelta,
    aiming,
    aimingAt,
    blaming,
    clickTarget,
  };

  // Where the budget lands if the hovered card is played. Off the view rather
  // than worked out here: this table cannot play a move, and subtracting the
  // card's price would get every card that hands budget back exactly backwards.
  const budgetDelta =
    hovered !== null && !aiming && view.you.playable[hovered]?.canPlay
      ? (view.you.playable[hovered]!.budgetDelta ?? null)
      : null;

  function clickCard(handIndex: number) {
    if (!mine || busy) return;
    const card = view.you.playable[handIndex];
    if (!card?.canPlay) return;
    // The hand re-indexes when a card leaves it, so a held hover starts
    // describing whatever moved into that slot.
    setHovered(null);

    if (card.needsSlot) {
      setAiming({ handIndex, target: "ownProject", reason: "close" });
      return;
    }
    if (card.needsTarget) {
      setAiming({ handIndex, target: card.needsTarget, reason: "effect" });
      return;
    }
    void send({ kind: "playCard", handIndex });
  }

  function clickTarget(side: Player, slot: number) {
    if (!aiming || aimingAt !== side) return;
    if (aiming.reason === "profit") {
      void send({ kind: "takeProfit", slot });
      return;
    }
    if (aiming.handIndex === null) return;

    // A card can ask twice: which of yours to close, then which of theirs to
    // hit. The first answer is carried into the second rather than sent.
    const needsTarget = view.you.playable[aiming.handIndex]?.needsTarget;
    if (aiming.reason === "close" && needsTarget) {
      setAiming({ handIndex: aiming.handIndex, target: needsTarget, reason: "effect", closed: slot });
      return;
    }
    void send({
      kind: "playCard",
      handIndex: aiming.handIndex,
      ...(aiming.reason === "close" ? { closeIndex: slot } : { targetIndex: slot }),
      ...(aiming.closed === undefined ? {} : { closeIndex: aiming.closed }),
    });
  }


  return (
    // `dense` opts this table out of the small-type floor in globals.css, the
    // same way PlayArea does for the solo one — which is where that exemption
    // was added and where it stopped. The floor is right for a page somebody
    // reads; this is a screen somebody plays, where every pixel the labels grow
    // comes off the budget that keeps the board and your hand visible together.
    // The card type is where legibility was wanted, and the cards are exempt
    // separately via .card-frame.
    <div className="dense space-y-3">
      <div className="flex items-baseline justify-between gap-3 text-[10px] tracking-[0.16em] text-faint">
        <span className="min-w-0 truncate">
          VS {short(answer.opponent)} · {view.them.handCount} IN HAND
        </span>
        <Link href="/pvp" className="shrink-0 transition-colors hover:text-fg">
          ALL MATCHES
        </Link>
      </div>

      <Side
        side={them}
        projects={view.them.projects}
        support={view.them.support}
        mc={view.them.mc}
        deckCount={view.them.deckCount}
        finishedCount={view.them.finishedCount}
        wantsDiscard={null}
        label="THEM"
        shared={shared}
      />

      <div className="panel-raised flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2">
        <span className="text-[10px] tracking-[0.18em] text-faint">
          TURN <span className="display ml-1 text-base text-fg">{Math.min(view.turn, RULES.turns)}</span>
          <span className="text-faint">/{RULES.turns}</span>
          <span className="ml-4" title={budgetNote(budgetLeft, view.me === FIRST_MOVER)}>
            BUDGET{" "}
            <span className="display text-base text-gold tabular-nums">{formatMC(budgetLeft)}</span>
            {budgetDelta !== null && budgetDelta.spendable !== 0 && (
              <span
                className={cx(
                  "display ml-1 text-base tabular-nums",
                  budgetDelta.spendable > 0 ? "text-pump" : "text-dump",
                )}
              >
                → {formatMC(budgetLeft + budgetDelta.spendable)}
              </span>
            )}
          </span>
          {(view.you.freePlays > 0 || view.theirFreePlays > 0) && (
            <span
              className="ml-4"
              title={freePlayNote(view.you.freePlays, view.theirFreePlays, view.me === FIRST_MOVER)}
            >
              {view.you.freePlays > 0 ? "FREE CARD " : "THEIR FREE CARD "}
              <span className="display border border-gold px-1.5 text-[10px] text-gold">
                {view.you.freePlays > 0 ? view.you.freePlays : view.theirFreePlays}
              </span>
            </span>
          )}
        </span>

        {view.finished ? (
          <span
            className={cx(
              "display text-sm",
              view.winner === null ? "text-fg" : view.winner === view.me ? "text-pump" : "text-dump",
            )}
          >
            {view.winner === null ? "DRAW" : view.winner === view.me ? "YOU WON" : "YOU LOST"}
          </span>
        ) : aiming ? (
          <span className="flex items-center gap-2">
            <span className="text-[10px] text-dump">
              {aiming.reason === "profit"
                ? "Pick a position to close and bank"
                : aiming.reason === "close"
                  ? `Portfolio full at ${RULES.portfolioSize} — pick a position to close`
                  : aiming.target === "enemyProject"
                    ? "Pick one of theirs"
                    : "Pick one of yours"}
            </span>
            <button
              type="button"
              onClick={() => setAiming(null)}
              className="border border-line-strong px-2.5 py-1.5 text-[9px] tracking-[0.16em] text-muted"
            >
              CANCEL
            </button>
          </span>
        ) : mine ? (
          <span className="flex items-center gap-2">
            {/* The same component the solo table draws, reading the same
                sentence out of the same engine call. This was a second button
                with a second set of conditions behind it, which is how the two
                tables ended up disagreeing about this rule once already. */}
            <TakeProfitButton
              noProfit={view.you.noProfit}
              busy={busy}
              onTakeProfit={() =>
                setAiming({ handIndex: null, target: "ownProject", reason: "profit" })
              }
              onBlame={setBlaming}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void send({ kind: "endTurn" })}
              className="glow-pump border border-pump bg-pump/10 px-4 py-2 text-[9px] tracking-[0.18em] text-pump disabled:opacity-50"
            >
              {busy ? "…" : `END TURN −${formatMC(budgetLeft)}`}
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[10px] tracking-[0.18em] text-faint">
            {/* A quiet sign that this screen is watching. Without it, waiting and
                broken look identical — which is what sent somebody back to the
                lobby to click the match again. */}
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pump" aria-hidden="true" />
            {answer.armed
              ? `THEIR TURN · ${timeLeft(answer.deadline, now)} LEFT`
              : `WAITING FOR THEM TO SIT DOWN · ${timeLeft(answer.deadline, now)}`}
          </span>
        )}
      </div>

      <Side
        side={view.me}
        projects={view.you.projects}
        support={view.you.support}
        mc={view.you.mc}
        deckCount={view.you.deckCount}
        finishedCount={view.you.finishedCount}
        wantsDiscard={wantsDiscard}
        label="YOU"
        shared={shared}
      />

      {view.finished && (
        <EndScreen view={view} opponent={answer.opponent} />
      )}

      {problem && (
        <p className="border border-dump bg-dump/10 px-3 py-1.5 text-[10px] leading-relaxed text-dump">
          {problem}
        </p>
      )}

      <section>
        <p className="text-[10px] leading-relaxed tracking-[0.16em] text-faint">
          YOUR HAND — {view.you.hand.length} CARDS
          {/* Not conditional on being able to discard. It was, so the line
              explaining the × vanished at exactly the moment somebody would be
              wondering why the × had gone grey. It describes the mechanic, and
              the mechanic is always true. */}
          <span className="ml-3 text-faint/60">
            · × THROWS ONE AWAY FOR {formatMC(TURN_ACTION_COST)} AND DRAWS A FRESH ONE NEXT TURN
          </span>
        </p>

        {/* Said once, here, because it is true of the board rather than of a
            card. It was printed on every project in the hand, which meant three
            copies of the same sentence covering the three cards they were
            printed on. A note that applies to everything belongs above
            everything. */}
        {view.you.playable.some((says) => says.needsSlot) && (
          <p className="mt-1 text-[10px] leading-relaxed text-gold">
            Your portfolio is full at {RULES.portfolioSize}. Playing a project asks you to close a
            position first — what it already made is yours to keep.
          </p>
        )}
        {/* One sideways strip on a phone, wrapping only where there is width to
            wrap into. Six cards at 150px is two per row on a 390px screen, which
            makes the hand taller than the rest of the table put together. The
            negative margin lets a card's discard button hang outside the
            scroller without being clipped by it. */}
        <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pt-3 pb-2 lg:flex-wrap lg:overflow-visible lg:pt-2">
          {view.you.hand.map((cardId, i) => {
            const card = cardById(INDEX, cardId);
            const says = view.you.playable[i];
            // Only what is true of this card. The portfolio being full is true
            // of the board and is said above, once.
            const note = says?.canPlay ? null : (says?.reason ?? null);

            return (
              <div
                key={`${cardId}-${i}`}
                // The same width the solo hand uses, and for the reason in
                // b043e26: a card sets its own type in cqw against its width,
                // so a narrower card is a card with smaller letters on it —
                // which handed the smallest screen the smallest text in the
                // game. The row already scrolls sideways, so the only cost is
                // how many cards you see at once.
                className="group @container relative w-[160px] shrink-0"
              >
                <button
                  type="button"
                  disabled={!mine || !says?.canPlay || busy}
                  onClick={() => clickCard(i)}
                  // Mouse only. A finger fires pointerenter and never fires
                  // pointerleave, so a tap meant to play a card opened the big
                  // preview and left it there — see the same fix on the solo
                  // table's hand.
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setHovered(i);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") {
                      setHovered((was) => (was === i ? null : was));
                    }
                  }}
                  className={cx(
                    "block w-full text-left transition-opacity",
                    mine && says?.canPlay ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-40",
                    aiming?.handIndex === i && "ring-1 ring-dump",
                  )}
                >
                  <CardView
                    card={card}
                    compact
                    free={view.you.freePlays > 0 && mine && withinFreeCap(card)}
                    // Off the view, because this table has no State to ask. That
                    // is what HandCardView.price is for.
                    price={says?.price}
                    className="w-full"
                  />
                </button>
                {/* Drawn whenever it is your turn, refused or not. It was
                    `canDiscard && …`, so the × disappeared and the mechanic
                    looked like something the game does not have.

                    Still suppressed while aiming: then the board is asking for
                    a target and a row of × on the hand is answering a different
                    question. */}
                {/* Reading a card is not a move, so it is offered on their turn
                    too — which is when you most want to look. */}
                <PeekButton
                  open={hovered === i}
                  onToggle={() => setHovered(hovered === i ? null : i)}
                />

                {mine && !aiming && (
                  <DiscardButton
                    cardName={card.name}
                    noDiscard={view.you.noDiscard}
                    busy={busy}
                    onDiscard={() => void send({ kind: "discard", handIndex: i })}
                  />
                )}

                {/* A badge, not a paragraph. Three words of good news do not
                    need a block of text across the card they are about. */}
                {says?.canPlay && says.upgrades && (
                  <span className="pointer-events-none absolute top-1 left-1 z-10 border border-gold bg-ground/90 px-1 py-0.5 text-[8px] tracking-[0.14em] text-gold">
                    TAKES OVER
                  </span>
                )}

                {note && (
                  // Sized against the card, like the solo table's note: at a
                  // fixed 9px it was bigger than the rules text it explains.
                  <p className="mt-1 line-clamp-3 text-[5.6cqw] leading-snug text-muted @[150px]:text-[9px]">
                    {note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>



      <details className="border border-line">
        <summary className="cursor-pointer px-3 py-2 text-[10px] tracking-[0.18em] text-faint">
          THE LOG
        </summary>
        <div className="h-64 border-t border-line">
          <Log entries={view.log} />
        </div>
      </details>

      {/* In the right margin, where there is one. Fixed rather than in flow, so
          the table does not shift sideways every time the mouse crosses a card.
          The width gives way on a short window instead of the bottom of the
          card going below the fold — a card you can read two thirds of is the
          problem this exists to solve. */}
      {liftedCard !== null && (
        <div className="pointer-events-none fixed top-[4.5rem] right-4 z-40 hidden w-[min(248px,calc((100dvh-6rem)*5/7))] min-[1440px]:block">
          <CardView card={liftedCard} free={liftedFree} />
        </div>
      )}

      {/* Below 1440 there is no clear margin beside the table, so the card
          overlaps instead. Fixed here too, and not absolute: this table is not
          the positioned ancestor the solo one is, and an absolute card would
          hang off the bottom of the log rather than sit over the board. */}
      {liftedCard !== null && (
        // One stacked variant rather than a block and a hidden of equal weight
        // fighting each other — which on the solo table came down to the order
        // Tailwind happened to emit them in, and it emitted them the wrong way
        // round and showed both at once.
        <div className="pointer-events-none fixed top-[4.5rem] right-4 z-40 hidden w-[min(248px,calc(100vw-2rem))] max-[1439px]:block">
          <CardView card={liftedCard} free={liftedFree} />
        </div>
      )}
    </div>
  );
}
