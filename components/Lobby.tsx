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
import { useDecks } from "@/lib/use-decks";
import { STAKES } from "@/lib/pvp";
import { CONTRACTS } from "@/lib/revenue";
import { openData, joinData, stakeWei } from "@/lib/escrow";
import { tierFor } from "@/data/holder-tiers";
import { sendCall } from "@/lib/wallet";
import { cx } from "@/lib/cx";
import { proofOf } from "@/lib/session";
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
  // Called for the effect rather than the value: it fetches this wallet's decks
  // and re-renders when they land, which is what lets the read further down
  // stay a plain synchronous one.
  useDecks();
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [listings, setListings] = useState<LobbyListing[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /** What the next offer plays for. Zero is friendly. */
  const [stake, setStake] = useState(0);
  /** A typed amount, separate so the buttons can tell "10" from "chose 10". */
  const [own, setOwn] = useState("");
  /** What this wallet holds, so the cut can be quoted before anybody commits. */
  const [held, setHeld] = useState(0);

  const cut = tierFor(held).cut;

  // What this wallet holds, so the cut can be quoted before anybody commits to
  // an amount. A balance that cannot be read leaves it at retail, which is the
  // safe direction to be wrong in: it quotes the worst rate rather than one
  // somebody would be disappointed by afterwards.
  useEffect(() => {
    if (wallet === null) return;
    let current = true;
    void (async () => {
      try {
        const answer = await fetch("/api/profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proof: proofOf() }),
        });
        if (!answer.ok) return;
        const { held: base } = (await answer.json()) as { held: string | null };
        if (current && base !== null) setHeld(Math.floor(Number(BigInt(base) / 10n ** 18n)));
      } catch {
        // Left at retail.
      }
    })();
    return () => {
      current = false;
    };
  }, [wallet]);

  /**
   * Matches the stake, then joins.
   *
   * In that order, and the other way round cannot work: /api/pvp/join asks the
   * chain whether both deposits are in before it will start a match, so joining
   * first is joining with a refusal.
   *
   * If the deposit lands and the join then fails — a deck that stopped being
   * legal, somebody else taking the seat in the same second — the stake is not
   * lost. It is in the escrow against an offer that still exists, and the seat
   * can be taken again; if the offer is gone, its own opener can cancel and this
   * deposit was never accepted, because `join` refuses a wager that is not Open.
   */
  async function sitDown(listing: LobbyListing) {
    await run(listing.id, async () => {
      if (listing.stake > 0) {
        if (wallet === null || !CONTRACTS.escrow) throw new Error("No wallet.");
        await sendCall(
          wallet,
          CONTRACTS.escrow,
          joinData(listing.id),
          stakeWei(listing.stake),
        );
      }
      return ask("join", { id: listing.id, deck: deck!.cardIds });
    });
  }

  /**
   * Posts the offer, and then asks the wallet for the stake.
   *
   * In that order, and it matters: the escrow is keyed on the offer's id, so
   * there is nothing to deposit against until the offer exists. An offer whose
   * deposit is never signed simply sits there unfunded — the lobby marks it,
   * nobody can take it, and it expires in an hour like any other.
   */
  async function postOffer() {
    const amount = own === "" ? stake : Number(own);
    await run("create", async () => {
      const made = (await ask("create", {
        mode: "correspondence",
        stake: amount,
        deck: deck!.cardIds,
      })) as { id?: string } | undefined;

      if (amount > 0 && made?.id && wallet !== null && CONTRACTS.escrow) {
        await sendCall(wallet, CONTRACTS.escrow, openData(made.id), stakeWei(amount));
      }
    });
  }

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

  // Read during render, which is fine because useDecks re-renders when the
  // answer lands. Without it this said "no deck" on any browser the deck was
  // not built in, which since the decks moved to the server is a lie.
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
          A day a turn, so a match runs over a week and nobody has to be anywhere. Play for nothing,
          or put CRO up: both sides stake the same and the winner takes the pot, less a cut that
          falls the more $CROCARD you hold. It is held by a contract neither of you can reach —
          not us either, beyond CRO that belongs to no match.
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
          <div className="mt-4">
            <p className="text-[8px] tracking-[0.18em] text-faint">PLAYING FOR</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAKES.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setStake(amount);
                    setOwn("");
                  }}
                  className={cx(
                    "border px-3 py-2 text-[10px] tracking-[0.14em] tabular-nums transition-colors",
                    stake === amount && own === ""
                      ? "border-pump bg-pump/10 text-pump"
                      : "border-line text-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  {amount === 0 ? "FRIENDLY" : `${amount} CRO`}
                </button>
              ))}
              {/* A free amount on top of the buttons. The five are a
                  convenience — a lobby where twenty people wait on twenty
                  different numbers is twenty people waiting — and anybody who
                  wants their own may have it and find their own opponent. */}
              <input
                value={own}
                onChange={(event) => {
                  const typed = event.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  setOwn(typed);
                  if (typed !== "") setStake(Number(typed));
                }}
                inputMode="numeric"
                placeholder="or type one"
                className="w-28 border border-line bg-ground px-2 py-2 text-[10px] tabular-nums text-fg placeholder:text-faint focus:border-pump focus:outline-none"
              />
            </div>

            {stake > 0 && (
              <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-gold">
                Posting this asks your wallet for {stake} CRO, held by the escrow until the match
                ends. Nobody can take it out but you, until somebody sits down opposite. The winner
                takes both, less {Math.round(cut * 100)}% at your holding — and that cut is read
                when the pot is paid, so buying more $CROCARD before then counts.
              </p>
            )}

            <button
              type="button"
              onClick={() => void postOffer()}
              disabled={busy !== null}
              className="glow-pump mt-3 border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none"
            >
              {busy === "create"
                ? "POSTING…"
                : stake > 0
                  ? `POST AN OFFER · ${stake} CRO`
                  : "POST A FRIENDLY OFFER"}
            </button>
          </div>
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
                <span className="min-w-0 text-[11px] text-fg">
                  {listing.mine ? "Your offer" : `Rank ${listing.rank}`}
                  <span
                    className={cx(
                      "ml-3 text-[10px] tabular-nums",
                      listing.stake > 0 ? "text-gold" : "text-faint",
                    )}
                  >
                    {listing.stake > 0 ? `${listing.stake} CRO` : "friendly"}
                  </span>
                  <span className="ml-3 text-[10px] text-faint">
                    {timeLeft(listing.expiresAt, now)}
                  </span>
                  {/* Not yet, rather than broken. Posting an offer and signing
                      the deposit are two steps; this is the gap between them,
                      and without saying so the seat would simply refuse anybody
                      who tried it after choosing a deck. */}
                  {!listing.funded && (
                    <span className="mt-1 block text-[10px] leading-relaxed text-gold">
                      {listing.mine
                        ? "Your stake has not arrived yet. Put it up below, or take the offer down."
                        : "Waiting on the poster's stake. It cannot be taken until that lands."}
                    </span>
                  )}
                </span>
                {listing.mine ? (
                  <span className="flex shrink-0 flex-wrap gap-2">
                  {!listing.funded && listing.stake > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(listing.id, async () => {
                          if (wallet === null || !CONTRACTS.escrow) return;
                          await sendCall(
                            wallet,
                            CONTRACTS.escrow,
                            openData(listing.id),
                            stakeWei(listing.stake),
                          );
                        })
                      }
                      disabled={busy !== null}
                      className="border border-gold px-3 py-1.5 text-[9px] tracking-[0.16em] text-gold transition-colors hover:bg-gold hover:text-ground disabled:opacity-50"
                    >
                      {busy === listing.id ? "…" : `PUT UP ${listing.stake} CRO`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void run(listing.id, () => ask("cancel", { id: listing.id }))}
                    disabled={busy !== null}
                    className="border border-line-strong px-3 py-1.5 text-[9px] tracking-[0.16em] text-muted transition-colors hover:border-dump hover:text-dump disabled:opacity-50"
                  >
                    {busy === listing.id ? "…" : "TAKE IT DOWN"}
                  </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void sitDown(listing)}
                    disabled={busy !== null || !hasDeck || !listing.funded}
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
