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
import { CONCURRENT } from "@/lib/store";
import type { MatchMode } from "@/engine/record";
import { CONTRACTS } from "@/lib/revenue";
import { openData, joinData, stakeWei } from "@/lib/escrow";
import { tierFor } from "@/data/holder-tiers";
import { sendCall, waitForTx } from "@/lib/wallet";
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
  if (ms >= 3_600_000) return `${Math.floor(ms / 3_600_000)}h left`;
  // Seconds below ten minutes, because a live turn is two of them. The floor of
  // one minute this used to have made the whole of a live window read "1m left".
  if (ms >= 600_000) return `${Math.floor(ms / 60_000)}m left`;
  const seconds = Math.ceil(ms / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left`;
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

  /**
   * How long a turn gives you on the next offer.
   *
   * Slow by default, and deliberately: a live match is one you have to be at.
   * Somebody who posts one and walks away loses turns to a clock they are not
   * watching, and the default should not be the one that punishes leaving.
   */
  const [mode, setMode] = useState<MatchMode>("correspondence");

  /** What the next offer plays for. Zero is friendly. */
  const [stake, setStake] = useState(0);
  /** A typed amount, separate so the buttons can tell "10" from "chose 10". */
  const [own, setOwn] = useState("");
  /** What this wallet holds, so the cut can be quoted before anybody commits. */
  const [held, setHeld] = useState(0);

  /**
   * The offer somebody was sent here for, from /pvp?offer=<id>.
   *
   * The Discord challenge links straight to one seat, and arriving at a list of
   * six rows with no idea which one the message meant is the same as arriving
   * at the lobby. So it is marked and scrolled to.
   *
   * Read from the location rather than with useSearchParams, which needs a
   * Suspense boundary to render statically and would buy nothing here. Read once
   * after mount, because the server has no location.
   */
  const [wanted, setWanted] = useState<string | null>(null);
  const [found, setFound] = useState(false);

  useEffect(() => {
    setWanted(new URLSearchParams(window.location.search).get("offer"));
  }, []);

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
        const hash = await sendCall(
          wallet,
          CONTRACTS.escrow,
          joinData(listing.id),
          stakeWei(listing.stake),
        );
        // ── WAITED FOR, AND THAT IS THE WHOLE FIX ─────────────────────────
        //
        // The server reads the escrow to check both stakes are in before it
        // makes the match. `sendCall` returns as soon as the wallet submits,
        // and the round trip to the server is faster than a Cronos block — so
        // the server looked, saw only the poster's side, and refused with "only
        // one side has put its stake up". The deposit landed a second later,
        // with no match behind it and the offer put back on the board.
        //
        // One wallet took ten CRO that way on 3 October 2026.
        if (!(await waitForTx(hash))) {
          throw new Error(
            "The deposit did not go through. Nothing was taken — try the seat again.",
          );
        }
      }
      try {
        return await ask("join", { id: listing.id, deck: deck!.cardIds });
      } catch (error) {
        // The money is in by this point. Saying only what the server said would
        // leave somebody staring at a refusal with no idea where their stake
        // went — which is the state this whole fix is about.
        if (listing.stake > 0) {
          throw new Error(
            `${error instanceof Error ? error.message : "The seat could not be taken."} ` +
              `Your ${listing.stake} CRO is in the escrow and is not lost — press the seat again, ` +
              `and if it will not take, you can withdraw it from an unplayed match after 30 days.`,
          );
        }
        throw error;
      }
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
        mode,
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
  // measured in days; a live match runs one turn in two, so while there is one
  // of those on screen it ticks every second. Still nothing polls the server —
  // this only redraws a number already here.
  const watchingLive = (matches ?? []).some(
    (match) => match.mode === "live" && !match.finished,
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), watchingLive ? 1_000 : 60_000);
    return () => clearInterval(timer);
  }, [watchingLive]);

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
          Two minutes a turn if you want it over with, or a day a turn so a match runs across a
          week and nobody has to be anywhere. Play for nothing, or put CRO up: both sides stake the
          same and the winner takes the pot, less a cut that falls the more $CROCARD you hold. It is
          held by a contract neither of you can reach — not us either, beyond CRO that belongs to
          no match.
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
            <p className="text-[8px] tracking-[0.18em] text-faint">A TURN LASTS</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["live", "correspondence"] as const).map((one) => (
                <button
                  key={one}
                  type="button"
                  onClick={() => setMode(one)}
                  className={cx(
                    "border px-3 py-2 text-[10px] tracking-[0.14em] transition-colors",
                    mode === one
                      ? "border-pump bg-pump/10 text-pump"
                      : "border-line text-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  {one === "live" ? "2 MINUTES · LIVE" : "A DAY · SLOW"}
                </button>
              ))}
            </div>
            <p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-muted">
              {mode === "live"
                ? `Both of you at the table, ${RULES.turns} turns in a sitting. A turn you do not ` +
                  `answer in two minutes ends — it costs the turn, not the match. One live match ` +
                  `at a time.`
                : `A day to answer, so it plays out over a week from wherever you are. Up to ` +
                  `${CONCURRENT.correspondence} of these at once.`}
            </p>

            <p className="mt-4 text-[8px] tracking-[0.18em] text-faint">PLAYING FOR</p>
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

        {/* Sent here for a seat that is no longer there. Said plainly, because
            the alternative is somebody reading a challenge in Discord, pressing
            it, and finding a lobby that looks like it never happened. */}
        {wanted !== null && listings !== null && !listings.some((one) => one.id === wanted) && (
          <p className="mt-4 border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
            That seat is gone — taken, withdrawn, or an hour old. Anything else on offer is below.
          </p>
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
                ref={(node) => {
                  // Once, and only when it is actually the one asked for. The
                  // list re-renders on a timer — the countdown ticks every
                  // second — so scrolling on every render would pin the page.
                  if (node === null || listing.id !== wanted || found) return;
                  setFound(true);
                  node.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
                className={cx(
                  "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
                  listing.id === wanted && "bg-pump/10 ring-1 ring-inset ring-pump",
                )}
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
                  {/* Which clock you would be sitting down to. Every offer was
                      a day long when this row was written, so it did not have
                      to say — and sitting down to two minutes without being
                      told is losing turns to a rule nobody mentioned. */}
                  <span
                    className={cx(
                      "ml-3 text-[10px]",
                      listing.mode === "live" ? "text-pump" : "text-faint",
                    )}
                  >
                    {listing.mode === "live" ? "2 min a turn" : "a day a turn"}
                  </span>
                  <span className="ml-3 text-[10px] text-faint">
                    {timeLeft(listing.expiresAt, now)}
                  </span>
                  {/* Not yet, rather than broken. Posting an offer and signing
                      the deposit are two steps; this is the gap between them,
                      and without saying so the seat would simply refuse anybody
                      who tried it after choosing a deck. */}
                  {listing.taken ? (
                    <span className="mt-1 block text-[10px] leading-relaxed text-pump">
                      {listing.mine
                        ? "Both stakes are in. The match is on — it is in your games above."
                        : "Somebody has already taken this one."}
                    </span>
                  ) : (
                    !listing.funded && (
                      <span className="mt-1 block text-[10px] leading-relaxed text-gold">
                        {listing.mine
                          ? "Your stake has not arrived yet. Put it up below, or take the offer down."
                          : "Waiting on the poster's stake. It cannot be taken until that lands."}
                      </span>
                    )
                  )}
                </span>
                {listing.mine ? (
                  <span className="flex shrink-0 flex-wrap gap-2">
                  {/* Not while it is taken. `funded` goes false the instant the
                      state leaves `open`, so this button was being offered to
                      the one person who could not use it — the host, whose money
                      was already in. open() on an existing wager is refused by
                      the contract, so pressing it cost gas and read like a lost
                      deposit. */}
                  {!listing.funded && !listing.taken && listing.stake > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(listing.id, async () => {
                          if (wallet === null || !CONTRACTS.escrow) return;
                          // Asked again, right before signing.
                          //
                          // This screen can be minutes old — somebody leaves the
                          // tab open and comes back — and in that time the seat
                          // may have been taken, which puts the stake in and
                          // makes this call something the contract refuses. A
                          // refusal costs gas and reads like a lost deposit, so
                          // it is worth one request to not send it.
                          const fresh = await ask<{ listings: LobbyListing[] }>("lobby");
                          const now = fresh.listings.find((one) => one.id === listing.id);
                          setListings(fresh.listings);
                          if (now === undefined) {
                            throw new Error(
                              "That offer is no longer in the lobby. Nothing was sent.",
                            );
                          }
                          if (now.funded) {
                            throw new Error(
                              "Your stake is already in the escrow — nothing was sent, and nothing is owed. " +
                                "If the seat has been taken the match is in your games above.",
                            );
                          }
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
                    disabled={busy !== null || !hasDeck || !listing.funded || listing.taken}
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
