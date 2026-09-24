"use client";

// Who you are about to play, what it pays, and whether your score will count.
//
// It sits above the table before a match and is gone during one — see PlayArea.
// Leaving it over the board says the choice is still open when it is not, and
// the table is sized to the viewport with nothing to spare.
//
// ── A LOCKED BOARD IS PICKABLE ───────────────────────────────────────────────
//
// Holding $LION buys a place on the Loaded Lions leaderboard, not permission to
// face the deck. So a locked board can be chosen and played, and what it says is
// that the score will not count rather than that the door is shut.
//
// That is the better shape for both sides. Somebody who has never held the token
// can find out whether they enjoy the matchup before being asked to buy
// anything, and what is being sold is the prize rather than the game. Greying
// the whole thing out would have sold neither.
//
// ── NOTHING HERE DECIDES ANYTHING ────────────────────────────────────────────
//
// /api/boards reads the chain. The same question is asked again by the route
// that takes the score, and that one is the one that counts. This exists so
// nobody spends ten turns on a prize they were never eligible for.

import { useCallback, useEffect, useState } from "react";

import { CardArt } from "@/components/CardArt";
import { cardById } from "@/engine/helpers";
import { INDEX } from "@/lib/set";
import { proofOf } from "@/lib/session";
import { toTokens } from "@/lib/units";
import { cx } from "@/lib/cx";

interface Answer {
  id: string;
  name: string;
  blurb: string;
  /** The card whose art is this board's face. See data/boards.ts. */
  face: string;
  /** Whole $LION needed for a score to count, or null when anyone's counts. */
  needs: number | null;
  /** This board's share of the pot, in base units, or null when unreadable. */
  prize: string | null;
  /** Why a score would not count, or null when it would. */
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
        // Signed out is a real state here and not an error.
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
    <section className="mx-auto max-w-4xl px-4 pt-10 pb-6">
      <p className="text-[10px] tracking-[0.28em] text-faint">WHO YOU ARE PLAYING</p>
      <h2 className="display mt-2 text-2xl">PICK AN OPPONENT</h2>
      <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted">
        Each one has its own weekly leaderboard and its own share of the prize pot. Beat it, and
        your best market cap of the week goes on that board.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {boards.map((board) => {
          const picked = board.id === chosen;
          const counts = board.shut === null;
          return (
            <button
              key={board.id}
              type="button"
              onClick={() => onChoose(board.id)}
              className={cx(
                "group relative overflow-hidden border text-left transition-colors",
                picked
                  ? "border-pump bg-pump/10"
                  : "border-line bg-panel hover:border-line-strong",
              )}
            >
              {/* The face. Two bordered rectangles of text told you what you
                  were choosing between and nothing about why you would want
                  either — on the page that starts a card game, showing no
                  cards at all. */}
              <div className="relative h-32 w-full overflow-hidden">
                <CardArt
                  card={cardById(INDEX, board.face)}
                  className={cx(
                    "h-full w-full transition-transform duration-500",
                    picked ? "scale-105" : "group-hover:scale-105",
                  )}
                />
                {/* The panel colour poured back over the bottom, so the words
                    sit on the card's own ground rather than on a hard edge
                    between a picture and a box. */}
                <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/40 to-transparent" />
                {picked && <div className="absolute inset-0 bg-pump/15" />}
              </div>

              <div className="p-5 pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={cx("display text-lg", picked && "text-pump")}>{board.name}</span>
                {picked && (
                  <span className="text-[8px] tracking-[0.18em] text-pump">PLAYING</span>
                )}
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{board.blurb}</p>

              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3">
                <div>
                  <dt className="text-[8px] tracking-[0.18em] text-faint">PLAYS FOR</dt>
                  <dd className="display mt-0.5 text-sm tabular-nums">
                    {board.prize === null
                      ? "—"
                      : `${Math.round(toTokens(board.prize)).toLocaleString("en-US")} $CROCARD`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[8px] tracking-[0.18em] text-faint">TO COUNT</dt>
                  <dd
                    className={cx(
                      "display mt-0.5 text-sm tabular-nums",
                      counts ? "text-pump" : "text-gold",
                    )}
                  >
                    {board.needs === null
                      ? "ANYONE"
                      : `${board.needs.toLocaleString("en-US")} $LION`}
                  </dd>
                </div>
              </dl>

              {/* The reason, in the words the server used. Saying it again in
                  our own would be two places to get it wrong — and it is the
                  sentence that has to be exactly right, because it is the one
                  about somebody's own wallet. */}
              {!counts && (
                <p className="mt-2.5 text-[10px] leading-relaxed text-gold">{board.shut}</p>
              )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
