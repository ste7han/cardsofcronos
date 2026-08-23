"use client";

// The lobby: your matches, and what is on offer.
//
// Matches first. A player arriving here usually has somewhere to be — it is
// their turn in something — and offers are what you read when they do not.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatMC } from "@/engine/format";
import { RULES } from "@/engine/types";
import { ask, type LobbyListing, type MatchSummary } from "@/lib/pvp-client";
import { loadDeck } from "@/lib/deck-storage";
import { useSession } from "@/lib/use-session";

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

/**
 * How long is left, in words.
 *
 * Rounded down and never below a minute: "0 hours left" on something with fifty
 * minutes in it is the kind of true-but-useless number that makes people rush.
 */
function timeLeft(deadline: number, now: number): string {
  const ms = deadline - now;
  if (ms <= 0) return "turn expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

export function Lobby() {
  const { wallet, ready } = useSession();
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [listings, setListings] = useState<LobbyListing[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const [mine, lobby] = await Promise.all([
        ask<{ matches: MatchSummary[] }>("matches"),
        ask<{ listings: LobbyListing[] }>("lobby"),
      ]);
      setMatches(mine.matches);
      setListings(lobby.listings);
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not read the lobby.");
    }
  }, []);

  useEffect(() => {
    if (!ready || wallet === null) return;
    void refresh();
  }, [ready, wallet, refresh]);

  // The clock is shown, so it has to move. A minute is plenty for a deadline
  // measured in days, and it means nothing here polls the server.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function run(what: string, action: () => Promise<unknown>) {
    setBusy(what);
    setProblem(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  if (ready && wallet === null) {
    return (
      <div className="panel border border-line px-6 py-16 text-center">
        <p className="text-[10px] tracking-[0.28em] text-faint">NOT SIGNED IN</p>
        <h2 className="display mt-3 text-2xl">A SEAT NEEDS A NAME</h2>
        <p className="mx-auto mt-4 max-w-md text-[11px] leading-relaxed text-muted">
          A match runs for days and has two sides, so both of them have to be somebody. Sign in with
          a wallet and the lobby is here.
        </p>
        <p className="mt-8 text-[10px] tracking-[0.18em] text-pump">
          USE THE WALLET BUTTON, TOP RIGHT
        </p>
      </div>
    );
  }

  const deck = typeof window === "undefined" ? null : loadDeck();
  const hasDeck = (deck?.cardIds.length ?? 0) === RULES.deckSize;

  return (
    <div className="space-y-10">
      {problem && (
        <p className="border border-dump/40 bg-dump/5 px-4 py-3 text-[11px] leading-relaxed text-dump">
          {problem}
        </p>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-xl">YOUR MATCHES</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-[9px] tracking-[0.18em] text-faint transition-colors hover:text-fg"
          >
            REFRESH
          </button>
        </div>

        {matches === null ? (
          <p className="mt-4 text-[10px] tracking-[0.16em] text-faint">READING…</p>
        ) : matches.length === 0 ? (
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            None yet. Post an offer below, or take one that is already there.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line">
            {matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/pvp/${match.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-panel"
                >
                  <span className="min-w-0">
                    <span className="text-[11px] text-fg">vs {short(match.opponent)}</span>
                    <span className="ml-3 text-[10px] text-faint">
                      turn {Math.min(match.turn, RULES.turns)}/{RULES.turns}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-[10px] tabular-nums">
                    <span className="text-muted">
                      {formatMC(match.yourMC)} · {formatMC(match.theirMC)}
                    </span>
                    {match.finished ? (
                      <span
                        className={
                          match.drawn ? "text-fg" : match.won ? "text-pump" : "text-dump"
                        }
                      >
                        {match.drawn ? "DRAW" : match.won ? "WON" : "LOST"}
                      </span>
                    ) : match.yourTurn ? (
                      <span className="border border-pump px-2 py-1 tracking-[0.16em] text-pump">
                        YOUR TURN · {timeLeft(match.deadline, now)}
                      </span>
                    ) : (
                      <span className="text-faint tracking-[0.16em]">
                        THEIR TURN · {timeLeft(match.deadline, now)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="display text-xl">OPEN OFFERS</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          A day a turn, so a match runs over a week and nobody has to be anywhere. Friendly only for
          now: nothing is staked, and nothing moves a rank.
        </p>

        {!hasDeck ? (
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            You need a legal deck of {RULES.deckSize} first.{" "}
            <Link href="/deck" className="text-pump hover:underline">
              Build one
            </Link>
            .
          </p>
        ) : (
          <button
            type="button"
            onClick={() =>
              void run("create", () =>
                ask("create", { mode: "correspondence", stake: 0, deck: deck!.cardIds }),
              )
            }
            disabled={busy !== null}
            className="glow-pump mt-4 border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none"
          >
            {busy === "create" ? "POSTING…" : "POST AN OFFER"}
          </button>
        )}

        {listings === null ? (
          <p className="mt-4 text-[10px] tracking-[0.16em] text-faint">READING…</p>
        ) : listings.length === 0 ? (
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Nothing on offer. Post one and it sits here for an hour.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-[11px] text-fg">
                  {listing.mine ? "Your offer" : `Rank ${listing.rank}`}
                  <span className="ml-3 text-[10px] text-faint">
                    {timeLeft(listing.expiresAt, now)}
                  </span>
                </span>
                {listing.mine ? (
                  <button
                    type="button"
                    onClick={() => void run(listing.id, () => ask("cancel", { id: listing.id }))}
                    disabled={busy !== null}
                    className="border border-line-strong px-3 py-1.5 text-[9px] tracking-[0.16em] text-muted transition-colors hover:border-dump hover:text-dump disabled:opacity-50"
                  >
                    {busy === listing.id ? "…" : "TAKE IT DOWN"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void run(listing.id, () =>
                        ask("join", { id: listing.id, deck: deck!.cardIds }),
                      )
                    }
                    disabled={busy !== null || !hasDeck}
                    className="border border-pump px-3 py-1.5 text-[9px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:text-muted"
                  >
                    {busy === listing.id ? "…" : "SIT DOWN"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
