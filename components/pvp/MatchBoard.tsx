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
import { useCallback, useEffect, useState } from "react";

import { CardView } from "@/components/CardView";
import { BoardProject } from "@/components/game/BoardProject";
import { Log } from "@/components/game/Log";
import { cardById } from "@/engine/helpers";
import { formatMC, formatMCExact } from "@/engine/format";
import type { ChoiceTarget, Move, Player } from "@/engine/types";
import { RULES, TURN_ACTION_COST } from "@/engine/types";
import type { PlayerView, ViewProject } from "@/engine/view";
import { ask } from "@/lib/pvp-client";
import { cx } from "@/lib/cx";
import { INDEX } from "@/lib/set";

interface Answer {
  id: string;
  opponent: string;
  deadline: number;
  view: PlayerView;
}

interface Aiming {
  handIndex: number | null;
  target: ChoiceTarget;
  reason: "effect" | "close" | "profit";
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

function timeLeft(deadline: number, now: number): string {
  const ms = deadline - now;
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 1 ? `${hours}h` : `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/** Which side of the table a target requirement points at, from where you sit. */
function boardFor(target: ChoiceTarget, me: Player): Player {
  const wantsMine = target === "ownProject";
  return wantsMine ? me : me === "you" ? "opponent" : "you";
}

export function MatchBoard({ id }: { id: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [aiming, setAiming] = useState<Aiming | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

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
      const quick = Date.now() - startedAt < STAYS_QUICK;
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
  }, [waiting, load]);

  async function send(move: Move) {
    setBusy(true);
    setProblem(null);
    try {
      const played = await ask<{ view: PlayerView; deadline: number }>("move", { id, move });
      setAnswer((was) => (was ? { ...was, view: played.view, deadline: played.deadline } : was));
      setAiming(null);
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
  const mine = view.toMove === view.me && !view.finished;
  const aimingAt = aiming ? boardFor(aiming.target, view.me) : null;
  const budgetLeft = view.budgetThisTurn - view.budgetSpentThisTurn;

  function clickCard(handIndex: number) {
    if (!mine || busy) return;
    const card = view.you.playable[handIndex];
    if (!card?.canPlay) return;

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
    if (aiming.reason === "profit") void send({ kind: "takeProfit", slot });
    else if (aiming.handIndex !== null)
      void send({ kind: "playCard", handIndex: aiming.handIndex, targetIndex: slot });
  }

  const Side = ({ side, projects, mc, label }: {
    side: Player;
    projects: ViewProject[];
    mc: number;
    label: string;
  }) => (
    <section className="panel border border-line px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] tracking-[0.18em] text-faint">{label}</span>
        <span className="display text-xl tabular-nums">{formatMC(mc)}</span>
      </div>
      {projects.length === 0 ? (
        <p className="mt-3 text-[10px] text-faint">No positions.</p>
      ) : (
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {projects.map((project, slot) => {
            const card = cardById(INDEX, project.cardId);
            if (card.type !== "project") return null;
            return (
              <BoardProject
                key={`${project.cardId}-${slot}`}
                card={card}
                onBoard={project}
                pump={project.pump}
                targetable={aimingAt === side && (aiming?.reason === "profit" ? "bank" : "attack")}
                onClick={() => clickTarget(side, slot)}
              />
            );
          })}
        </div>
      )}
    </section>
  );

  const them = view.me === "you" ? "opponent" : "you";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 text-[10px] tracking-[0.16em] text-faint">
        <span className="min-w-0 truncate">
          VS {short(answer.opponent)} · {view.them.handCount} IN HAND · {view.them.deckCount} IN
          DECK
        </span>
        <Link href="/pvp" className="shrink-0 transition-colors hover:text-fg">
          ALL MATCHES
        </Link>
      </div>

      <Side side={them} projects={view.them.projects} mc={view.them.mc} label="THEM" />

      <div className="panel-raised flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2">
        <span className="text-[10px] tracking-[0.18em] text-faint">
          TURN <span className="display ml-1 text-base text-fg">{Math.min(view.turn, RULES.turns)}</span>
          <span className="text-faint">/{RULES.turns}</span>
          <span className="ml-4">BUDGET </span>
          <span className="display text-base text-gold tabular-nums">{formatMC(budgetLeft)}</span>
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
            {view.you.canTakeProfit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAiming({ handIndex: null, target: "ownProject", reason: "profit" })}
                className="border border-gold/60 bg-gold/10 px-3 py-2 text-[9px] tracking-[0.18em] text-gold disabled:opacity-50"
              >
                TAKE PROFIT {formatMC(TURN_ACTION_COST)}
              </button>
            )}
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
            THEIR TURN · {timeLeft(answer.deadline, now)} LEFT
          </span>
        )}
      </div>

      <Side side={view.me} projects={view.you.projects} mc={view.you.mc} label="YOU" />

      {problem && (
        <p className="border border-dump bg-dump/10 px-3 py-1.5 text-[10px] leading-relaxed text-dump">
          {problem}
        </p>
      )}

      <section>
        <p className="text-[10px] leading-relaxed tracking-[0.16em] text-faint">
          YOUR HAND — {view.you.hand.length} CARDS · {view.you.deckCount} LEFT IN DECK
          {view.you.canDiscard && (
            <span className="ml-2 normal-case tracking-normal text-muted">
              · × throws one away for {formatMC(TURN_ACTION_COST)} and draws a fresh one next turn
            </span>
          )}
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
              <div key={`${cardId}-${i}`} className="relative w-[132px] shrink-0 sm:w-[150px]">
                <button
                  type="button"
                  disabled={!mine || !says?.canPlay || busy}
                  onClick={() => clickCard(i)}
                  className={cx(
                    "block w-full text-left transition-opacity",
                    mine && says?.canPlay ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-40",
                    aiming?.handIndex === i && "ring-1 ring-dump",
                  )}
                >
                  <CardView card={card} compact className="w-full" />
                </button>
                {/* Its own button rather than a mode on the card: the card you
                    cannot play is exactly the one you most want to throw away,
                    so the two must not share a disabled state. Always visible on
                    a touch screen — hidden-until-hover took this whole mechanic
                    off every phone once already. */}
                {view.you.canDiscard && !aiming && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send({ kind: "discard", handIndex: i })}
                    title={`Throw away ${card.name} — costs ${formatMC(TURN_ACTION_COST)} of this turn's budget, and you draw back up next turn.`}
                    className={cx(
                      "absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center",
                      "border border-line-strong bg-ground text-[11px] leading-none text-muted",
                      "transition-colors hover:border-dump hover:bg-dump hover:text-ground",
                      "disabled:opacity-40",
                    )}
                  >
                    ×
                  </button>
                )}

                {/* A badge, not a paragraph. Three words of good news do not
                    need a block of text across the card they are about. */}
                {says?.canPlay && says.upgrades && (
                  <span className="pointer-events-none absolute top-1 left-1 z-10 border border-gold bg-ground/90 px-1 py-0.5 text-[8px] tracking-[0.14em] text-gold">
                    TAKES OVER
                  </span>
                )}

                {note && (
                  <p className="mt-1 line-clamp-3 text-[9px] leading-snug text-muted">{note}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {view.finished && (
        <p className="border border-line bg-panel px-4 py-3 text-[11px] leading-relaxed text-muted">
          Final: {formatMCExact(view.you.mc)} against {formatMCExact(view.them.mc)}. Friendly
          matches do not move a rank.
        </p>
      )}

      <details className="border border-line">
        <summary className="cursor-pointer px-3 py-2 text-[10px] tracking-[0.18em] text-faint">
          THE LOG
        </summary>
        <div className="h-64 border-t border-line">
          <Log entries={view.log} />
        </div>
      </details>
    </div>
  );
}
