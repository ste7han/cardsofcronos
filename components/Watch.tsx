"use client";

// Looking in on a match you are not playing.
//
// Neither player's table: no hand, no buttons, nothing to press. What it shows
// is what both of them can already see — the boards, the market caps, whose turn
// it is and what has happened — so it can be opened by anybody with the link.
//
// The redaction is in engine/view.ts and not here. `watchView` has no field a
// hand could go in, so this component could not render one if it tried.

import { useCallback, useEffect, useState } from "react";

import { CardPeek } from "@/components/game/CardPeek";
import { cardById } from "@/engine/helpers";
import { cx } from "@/lib/cx";
import { INDEX } from "@/lib/set";
import { formatMC } from "@/engine/format";
import { RULES, type LogEntry } from "@/engine/types";
import type { OpponentView } from "@/engine/view";

interface Answer {
  id: string;
  mode: "live" | "correspondence";
  stake: number;
  seats: { you: string; opponent: string };
  deadline: number;
  startedAt: number;
  view: {
    turn: number;
    toMove: "you" | "opponent";
    finished: boolean;
    winner: "you" | "opponent" | null;
    log: LogEntry[];
    you: OpponentView;
    opponent: OpponentView;
  };
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * How often to look again.
 *
 * A live match moves every couple of minutes at most and a correspondence one
 * every day, so this is about how long somebody is willing to stare at a board
 * that has not changed rather than about keeping up.
 */
const EVERY = 6_000;

function Side({
  name,
  side,
  toMove,
  won,
}: {
  name: string;
  side: OpponentView;
  toMove: boolean;
  won: boolean | null;
}) {
  return (
    <section
      className={cx(
        "border p-4",
        toMove ? "border-pump/50 bg-pump/5" : "border-line bg-panel",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted">{name}</span>
        {won === true && (
          <span className="text-[9px] tracking-[0.2em] text-gold">WON</span>
        )}
        {won === null && toMove && (
          <span className="text-[9px] tracking-[0.2em] text-pump">TO MOVE</span>
        )}
      </div>

      <p className="display mt-1 text-2xl tabular-nums text-fg">{formatMC(side.mc)}</p>

      <div className="mt-3 flex gap-4 text-[10px] text-faint">
        <span>{side.handCount} in hand</span>
        <span>{side.deckCount} left</span>
        <span>
          {side.projects.length} / {RULES.portfolioSize} positions
        </span>
      </div>

      {side.projects.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {side.projects.map((project, i) => {
            const card = cardById(INDEX, project.cardId);
            return (
              <CardPeek key={`${project.cardId}-${i}`} card={card}>
                <li className="border border-line-strong bg-panel-raised px-2 py-1.5">
                  <span className="block text-[10px] text-fg">{card.name}</span>
                  <span className="block text-[9px] tabular-nums text-pump">
                    +{formatMC(project.pump)}/t
                  </span>
                </li>
              </CardPeek>
            );
          })}
        </ul>
      )}

      {side.support.length > 0 && (
        <p className="mt-2 text-[10px] text-muted">
          {side.support.map((one) => cardById(INDEX, one.cardId).name).join(" · ")}
        </p>
      )}
    </section>
  );
}

export function Watch({ id }: { id: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const response = await fetch(`/api/pvp/watch?id=${encodeURIComponent(id)}`);
      const body = (await response.json()) as Answer & { error?: string };
      if (!response.ok) {
        setProblem(body.error ?? "That match could not be read.");
        return;
      }
      setAnswer(body);
      setProblem(null);
    } catch {
      // Left as it was. A board that blanks on one failed request reads as a
      // match that ended.
    }
  }, [id]);

  useEffect(() => {
    void look();
    const timer = setInterval(() => void look(), EVERY);
    return () => clearInterval(timer);
  }, [look]);

  if (problem !== null) {
    return <p className="mt-6 text-[11px] text-dump">{problem}</p>;
  }
  if (answer === null) {
    return <p className="mt-6 text-[11px] text-muted">Reading the table…</p>;
  }

  const { view } = answer;
  const names = {
    you: short(answer.seats.you),
    opponent: short(answer.seats.opponent),
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[10px] text-faint">
        <span>
          TURN <span className="tabular-nums text-muted">{view.turn}</span> / {RULES.turns}
        </span>
        <span>{answer.mode === "live" ? "LIVE · 2 MIN A TURN" : "A DAY A TURN"}</span>
        {answer.stake > 0 && (
          <span className="text-gold">{answer.stake * 2} CRO IN THE POT</span>
        )}
        {view.finished && <span className="text-gold">FINISHED</span>}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Side
          name={names.you}
          side={view.you}
          toMove={!view.finished && view.toMove === "you"}
          won={view.finished ? view.winner === "you" : null}
        />
        <Side
          name={names.opponent}
          side={view.opponent}
          toMove={!view.finished && view.toMove === "opponent"}
          won={view.finished ? view.winner === "opponent" : null}
        />
      </div>

      {/* Newest first. Somebody arriving mid-match wants what just happened, not
          to scroll through turn one to find it. */}
      <section className="mt-8">
        <h2 className="text-[10px] tracking-[0.22em] text-faint">WHAT HAPPENED</h2>
        <ol className="mt-3 divide-y divide-line border border-line">
          {[...view.log].reverse().slice(0, 40).map((entry, i) => (
            <li key={`${entry.turn}-${i}`} className="flex gap-3 px-3 py-2 text-[10px]">
              <span className="shrink-0 tabular-nums text-faint">T{entry.turn}</span>
              <span className="min-w-0 text-muted">{entry.text}</span>
            </li>
          ))}
          {view.log.length === 0 && (
            <li className="px-3 py-3 text-[10px] text-faint">Nothing yet.</li>
          )}
        </ol>
      </section>
    </div>
  );
}
