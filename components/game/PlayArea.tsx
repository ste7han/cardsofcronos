"use client";

// Who you are about to play, and then the table.
//
// A thin wrapper and deliberately so: Game owns the match and Opponents owns the
// choice, and the only thing that has to live between them is which board is
// picked and whether anybody has pressed play.
//
// ── IT USED TO DEAL BEFORE YOU HAD CHOSEN ────────────────────────────────────
//
// Game dealt the moment the session was read, so /play put you in a match
// against the first board in the list before you had seen that there was a list.
// The picker was rendered — above a table that was already running — and the
// rule that hides it during a match hid it immediately. So the choice existed,
// the reasons each opponent exists were written down, and nobody ever saw
// either.
//
// Now nothing is dealt until somebody says so. The cost is one click on the way
// in; what it buys is that the click is a decision.
//
// Changing the board remounts the table by key. The opponent's deck comes from
// the board, and a match that swapped decks halfway through is not a match — the
// server replays from the seed and the board, and would rightly refuse it.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { BOARDS, boardOf } from "@/data/boards";
import { Game } from "@/components/game/Game";
import { Opponents } from "@/components/game/Opponents";
import { RULES } from "@/engine/types";
import { loadDeck } from "@/lib/deck-storage";
import { useSession } from "@/lib/use-session";

export function PlayArea() {
  const { wallet, ready } = useSession();
  const [chosen, setChosen] = useState(BOARDS[0]!.id);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const board = boardOf(chosen) ?? BOARDS[0]!;

  /** The deck that would be dealt, so the way in can say when there is none. */
  const [deck, setDeck] = useState<{ cardIds: string[]; name: string } | null>(null);

  // After mount and keyed on the wallet, the same as everywhere else: the deck
  // lives in localStorage and a server render that guesses at it is a hydration
  // mismatch. Signing in changes whose deck it is.
  useEffect(() => {
    if (!ready) return;
    const stored = loadDeck();
    setDeck({ cardIds: stored.cardIds, name: stored.name });
    // A wallet change puts the choice back: the deck on the table has to be the
    // one belonging to whoever is signed in now.
    setStarted(false);
  }, [ready, wallet]);

  // Told by the table rather than set when the button is pressed: the table also
  // empties on signing out and on a deck being rejected, and the picker has to
  // come back for those too.
  const onMatch = useCallback((running: boolean) => setPlaying(running), []);

  const hasDeck = deck !== null && deck.cardIds.length > 0;

  if (!started) {
    return (
      <>
        <Opponents chosen={chosen} onChoose={setChosen} />

        <div className="mx-auto max-w-4xl px-4 pb-16">
          {!ready ? (
            <p className="text-[10px] tracking-[0.16em] text-faint">READING…</p>
          ) : !hasDeck ? (
            // Said here rather than behind the button. Pressing play to be told
            // you have nothing to play with is a worse way to find out.
            <p className="max-w-xl text-[11px] leading-relaxed text-muted">
              You need a legal deck of {RULES.deckSize} cards first.{" "}
              <Link href="/deck" className="text-pump hover:underline">
                Build one
              </Link>
              {" — "}roll a random one out of what you hold, name it, and it becomes the deck you
              play with.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="glow-pump border border-pump bg-pump/10 px-6 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
              >
                PLAY {board.name}
              </button>
              <p className="mt-2 text-[10px] leading-relaxed text-faint">
                With {deck!.name.trim() === "" ? "your deck" : `“${deck!.name.trim()}”`}. Nothing is
                staked against the bot and nothing moves a rank —{" "}
                <Link href="/pvp" className="text-pump hover:underline">
                  that is PvP
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Back to the choice, but only between matches. Mid-match it would be a
          button that throws away a game somebody is playing. */}
      {!playing && (
        <div className="mx-auto max-w-4xl px-4 pt-6">
          <button
            type="button"
            onClick={() => setStarted(false)}
            className="text-[10px] tracking-[0.18em] text-faint transition-colors hover:text-pump"
          >
            ← PICK ANOTHER OPPONENT
          </button>
        </div>
      )}
      <Game key={board.id} board={board} onMatch={onMatch} begin />
    </>
  );
}
