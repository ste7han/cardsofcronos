"use client";

// Which opponent you are about to play, and which ones are shut to you.
//
// It sits above the table and does one thing: pick a board. Changing it starts a
// new match, because the opponent's deck comes from the board and a match that
// swapped decks halfway through is not a match.
//
// ── A SHUT BOARD IS SHOWN, NOT HIDDEN ────────────────────────────────────────
//
// It would be tidier to list only what somebody can play. It would also mean a
// player never finds out the Loaded Lions board exists, and the whole point of
// it is that holding the token opens something — which nobody can want if they
// cannot see it. So a locked board is drawn, greyed, with the reason under it in
// words: what it needs and what this wallet holds.
//
// ── THE LOCK IS NOT HERE ─────────────────────────────────────────────────────
//
// This asks /api/boards, which reads the chain. Nothing on this side decides
// anything: the same question is asked again by the route that takes the score,
// and that one is the one that counts. What this does is stop somebody spending
// ten turns on a prize they were never eligible for.

import { useCallback, useEffect, useState } from "react";

import { proofOf } from "@/lib/session";
import { cx } from "@/lib/cx";

interface Answer {
  id: string;
  name: string;
  blurb: string;
  /** Whole $LION needed, or null when the board is open to everybody. */
  needs: number | null;
  /** Why it is shut, or null when it is open to this wallet. */
  shut: string | null;
}

export function Opponents({
  chosen,
  onChoose,
}: {
  chosen: string;
  onChoose: (board: string) => void;
}) {
  const [boards, setBoards] = useState<Answer[] | null>(null);

  const look = useCallback(async () => {
    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Signed out is a real state here and not an error: every locked board
        // reads as locked, which is the true answer when there is no wallet.
        body: JSON.stringify({ proof: proofOf() }),
      });
      if (!response.ok) return;
      setBoards(((await response.json()) as { boards: Answer[] }).boards);
    } catch {
      // Left null, which draws nothing. A row of opponents that could not be
      // read is worse than no row: it would have to guess at the locks.
    }
  }, []);

  useEffect(() => {
    void look();
  }, [look]);

  // One board is not a choice. This appears when a second one does.
  if (boards === null || boards.length < 2) return null;

  return (
    <div className="mx-auto mb-5 grid max-w-3xl gap-3 px-4 sm:grid-cols-2">
      {boards.map((board) => {
        const shut = board.shut !== null;
        const picked = board.id === chosen;
        return (
          <button
            key={board.id}
            type="button"
            disabled={shut}
            onClick={() => onChoose(board.id)}
            className={cx(
              "border px-4 py-3 text-left transition-colors",
              shut
                ? "cursor-not-allowed border-line bg-panel/40 opacity-60"
                : picked
                  ? "border-pump bg-pump/10"
                  : "border-line bg-panel hover:border-line-strong",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={cx("display text-sm", picked && !shut && "text-pump")}>
                {board.name}
              </span>
              {shut && (
                <span className="text-[8px] tracking-[0.18em] text-gold">
                  {board.needs?.toLocaleString("en-US")} $LION
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">{board.blurb}</p>
            {/* The reason, in the words the server used. Repeating it here in
                our own words is two places to get it wrong. */}
            {shut && <p className="mt-1.5 text-[10px] leading-relaxed text-gold">{board.shut}</p>}
          </button>
        );
      })}
    </div>
  );
}
