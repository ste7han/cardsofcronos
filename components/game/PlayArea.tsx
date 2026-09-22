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
import { useDecks } from "@/lib/use-decks";
import { useSession } from "@/lib/use-session";

export function PlayArea() {
  const { wallet, ready: session } = useSession();
  const { stamp, ready: decksReady } = useDecks();
  // Both, and not either. Signed in with the decks still in flight is exactly
  // the state that used to draw "you have no deck" at somebody who had four.
  const ready = session && decksReady;
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
  }, [ready, wallet, stamp]);

  // Told by the table rather than set when the button is pressed: the table also
  // empties on signing out and on a deck being rejected, and the picker has to
  // come back for those too.
  const onMatch = useCallback((running: boolean) => setPlaying(running), []);

  const hasDeck = deck !== null && deck.cardIds.length > 0;

  if (!started) {
    return (
      <>
        <Opponents chosen={chosen} onChoose={setChosen} />

        {/* Room for the bar below, which is fixed and would otherwise sit on
            top of the last card. */}
        <div className="h-32" />

        {/* ── A BAR THAT DOES NOT SCROLL AWAY ──────────────────────────────
            This was an ordinary block under the two opponents. On a phone they
            stack, so the only thing you could do on the page was below two full
            cards and off the bottom of the screen: you picked an opponent, the
            page did not move, and there was nothing to press.
            Worse in the case that matters most — somebody arriving on a phone
            has no deck, because a deck lives in one browser's storage, and the
            sentence telling them so was off the bottom too. So the whole state
            of the screen now lives where it cannot be scrolled past. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            {!ready ? (
              <p className="text-[10px] tracking-[0.16em] text-faint">READING…</p>
            ) : !hasDeck ? (
              <>
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted">
                  You need a deck of {RULES.deckSize} cards first, and a deck lives in the browser
                  you built it in — so one made on a laptop is not here.
                </p>
                <Link
                  href="/deck"
                  className="glow-pump shrink-0 border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
                >
                  BUILD A DECK →
                </Link>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-faint">
                  {deck!.name.trim() === "" ? "Your deck" : `“${deck!.name.trim()}”`} against{" "}
                  {board.name}. Nothing is staked and nothing moves a rank —{" "}
                  <Link href="/pvp" className="text-pump hover:underline">
                    that is PvP
                  </Link>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => setStarted(true)}
                  className="glow-pump shrink-0 border border-pump bg-pump/10 px-6 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
                >
                  PLAY {board.name}
                </button>
              </>
            )}
          </div>
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
