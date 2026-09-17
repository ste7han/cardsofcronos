"use client";

// The weekly board.
//
// One table, this week's, and the weeks that have closed underneath it. What it
// has to be careful about is saying nothing it does not know: an empty board and
// a board it could not load look identical if you let them, and so do a pot of
// nothing and a pot nobody has told this project the address of.

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatMCExact } from "@/engine/format";
import { EXPLORER, toTokens } from "@/lib/units";
import { MOST_PER_WEEK, STREAMS } from "@/lib/revenue";

interface Standing {
  wallet: string;
  mc: number;
  opponentMC: number;
  seed: number;
  at: number;
}

interface PastWeek {
  week: string;
  wallet: string;
  mc: number;
  opponentMC: number;
  entries: number;
  wei: string | null;
  txHash: string | null;
  paidAt: number | null;
}

interface Board {
  week: string;
  closes: number;
  standings: Standing[];
  past: PastWeek[];
  pot: { wei: string | null; most: string | null; wallet: string | null };
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** How long until the week closes, in the largest unit that is still true. */
function until(closes: number, now: number): string {
  const left = closes - now;
  if (left <= 0) return "closing";
  const days = Math.floor(left / 86_400_000);
  if (days >= 1) return `${days}d ${Math.floor((left % 86_400_000) / 3_600_000)}h`;
  const hours = Math.floor(left / 3_600_000);
  if (hours >= 1) return `${hours}h ${Math.floor((left % 3_600_000) / 60_000)}m`;
  return `${Math.max(1, Math.floor(left / 60_000))}m`;
}

export function Tournament() {
  const [board, setBoard] = useState<Board | null>(null);
  // Null until the first answer, so "nobody has played yet" is never shown to
  // somebody whose request has not come back.
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/tournament")
      .then((answer) => (answer.ok ? answer.json() : Promise.reject(new Error())))
      .then((found: Board) => setBoard(found))
      .catch(() => setFailed(true));
  }, []);

  // The countdown is the one thing on this page that goes stale while you look
  // at it.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // The default the contract is deployed with. What is live is read from the
  // chain above; this is for the sentence that has to be sayable before there is
  // a chain to ask.
  const ONE_PERCENT = MOST_PER_WEEK.toLocaleString("en-US");

  const share = STREAMS.find((stream) => stream.id === "mints")
    ?.shares.find((s) => s.to === "tournament")?.percent;

  /**
   * What the figure at the top says, and what it is called.
   *
   * `most` is the contract's own answer to "what would a winner get", ceiling
   * and all. When it cannot be read, the balance is shown under a label that
   * does not promise it: a pot fuller than a week may pay would otherwise print
   * the larger number as the prize, which is the flattering direction to be
   * wrong in and the one this page is written against.
   */
  const shown = board?.pot.most ?? board?.pot.wei ?? null;
  const prize =
    shown === null ? "—" : `${Math.round(toTokens(shown)).toLocaleString("en-US")} $CROCARD`;

  // The balance, but only when it is more than a week can pay. Equal means the
  // ceiling is not biting and there is nothing to explain.
  const holdingBack =
    board?.pot.wei != null && board.pot.most != null && BigInt(board.pot.wei) > BigInt(board.pot.most)
      ? Math.round(toTokens(board.pot.wei)).toLocaleString("en-US")
      : null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="THIS WEEK" value={board?.week ?? "—"} />
        <Figure label="CLOSES IN" value={board ? until(board.closes, now) : "—"} />
        {/* $CROCARD and not CRO. The pot holds the token, because every share is
            bought before it is paid — and the two have eighteen decimals each,
            so the figure was right and only the unit was wrong.

            WHAT A WINNER TAKES, not what is in the pot, once those differ. A
            week pays at most one percent of supply and the rest rolls over, so
            the balance would be the bigger number and the wrong promise. The
            balance is said underneath instead, where it cannot be misread as
            the prize. */}
        <Figure label={board?.pot.most != null ? "TO BE WON" : "IN THE POT"} value={prize} />
      </div>

      <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted">
        Beat the bot and your market cap goes on the board. Your best of the week counts, not your
        last — a board where playing again can cost you your place is a board that tells you to stop
        playing. Weeks run Monday 00:00 UTC to Sunday midnight.
      </p>

      {/* Only when the two differ. While the pot is under the ceiling this
          sentence would be a rule about nothing, and a page that explains a cap
          that is not biting reads as a page looking for reasons to pay less. */}
      {holdingBack !== null ? (
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          There is {holdingBack} $CROCARD in the pot, and a week pays at most one percent of the
          supply. The rest is not held back from anybody — it stays in the pot and is next
          week&rsquo;s prize.
        </p>
      ) : null}

      <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
        Scores are replayed, not reported. You hand over the seed, the deck and every move, and the
        server plays the match through its own engine and records what that produced. A number typed
        into a request is not a score.
      </p>

      {board?.pot.wallet === null && (
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-gold">
          {share ?? 25}% of every paid mint feeds the pot, and the same share of every royalty and
          every ranked match. It arrives as $CROCARD: the CRO buys the token first and the pot is
          paid in it. One week pays at most one percent of the supply — {ONE_PERCENT} $CROCARD —
          and whatever is over that stays in the pot as next week&rsquo;s prize. Nothing has been
          minted yet and the pot is not deployed, so there is nothing in it to win — the board
          runs anyway, because the scores are the part that has to be real first.
        </p>
      )}

      <h2 className="display mt-10 text-xl">THE BOARD</h2>
      {failed ? (
        <p className="mt-3 text-[11px] text-dump">
          The board would not load. That is this page failing, not an empty week.
        </p>
      ) : board === null ? (
        <p className="mt-3 text-[11px] text-muted">Reading the board…</p>
      ) : board.standings.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted">
          Nobody has beaten the bot this week.{" "}
          <Link href="/play" className="text-pump hover:underline">
            Be first
          </Link>
          .
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-line border border-line">
          {board.standings.map((one, i) => (
            <li
              key={one.wallet}
              className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="display w-6 shrink-0 text-sm text-faint tabular-nums">
                  {i + 1}
                </span>
                <span className="truncate font-mono text-[11px]">{short(one.wallet)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="display block text-sm tabular-nums text-gold">
                  {formatMCExact(one.mc)}
                </span>
                <span className="block text-[9px] tracking-[0.14em] text-faint tabular-nums">
                  BOT {formatMCExact(one.opponentMC)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {board !== null && board.past.length > 0 && (
        <>
          <h2 className="display mt-10 text-xl">WEEKS THAT HAVE CLOSED</h2>
          <ol className="mt-3 divide-y divide-line border border-line">
            {board.past.map((week) => (
              <li
                key={week.week}
                className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="display block text-sm">{week.week}</span>
                  <span className="block truncate font-mono text-[10px] text-muted">
                    {short(week.wallet)} · {formatMCExact(week.mc)} ·{" "}
                    {week.entries === 1 ? "1 entry" : `${week.entries} entries`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {week.wei === null ? (
                    // Loud rather than hidden. A week that has been won and not
                    // paid is exactly the row somebody needs to be able to see.
                    <span className="text-[10px] tracking-[0.14em] text-dump">NOT PAID YET</span>
                  ) : (
                    <a
                      href={`${EXPLORER}/tx/${week.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] tracking-[0.14em] text-pump hover:underline"
                    >
                      {Math.round(toTokens(week.wei)).toLocaleString("en-US")} $CROCARD
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel border border-line p-5">
      <p className="text-[8px] tracking-[0.18em] text-faint">{label}</p>
      <p className="display mt-1.5 text-2xl tabular-nums">{value}</p>
    </div>
  );
}
