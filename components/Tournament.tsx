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

/** One leaderboard: an opponent, who is on it, and what it pays. */
interface BoardRow {
  id: string;
  name: string;
  blurb: string;
  /** Whole $LION needed to play it, or null when it is open to everybody. */
  needs: { token: string; whole: number } | null;
  standings: Standing[];
  past: PastWeek[];
  /** This board's share of the pot, in base units, or null. */
  prize: string | null;
}

interface Answer {
  week: string;
  closes: number;
  boards: BoardRow[];
  pot: { wei: string | null; wallet: string | null };
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
  const [answer, setAnswer] = useState<Answer | null>(null);
  // Null until the first answer, so "nobody has played yet" is never shown to
  // somebody whose request has not come back.
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/tournament")
      .then((answer) => (answer.ok ? answer.json() : Promise.reject(new Error())))
      .then((found: Answer) => setAnswer(found))
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
  const shown = answer?.pot.wei ?? null;
  const prize =
    shown === null ? "—" : `${Math.round(toTokens(shown)).toLocaleString("en-US")} $CROCARD`;

  // What the boards add up to against what is in the pot. Said only when they
  // differ, which is the week somebody would otherwise read the pot as the
  // prize — and the pot is always the bigger number now that a board plays for
  // a share of it.
  const shares = answer?.boards.reduce(
    (sum, board) => (board.prize === null ? sum : sum + BigInt(board.prize)),
    0n,
  );
  const holdingBack =
    answer?.pot.wei != null && shares != null && BigInt(answer.pot.wei) > shares
      ? Math.round(toTokens(answer.pot.wei)).toLocaleString("en-US")
      : null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="THIS WEEK" value={answer?.week ?? "—"} />
        <Figure label="CLOSES IN" value={answer ? until(answer.closes, now) : "—"} />
        {/* $CROCARD and not CRO. The pot holds the token, because every share is
            bought before it is paid — and the two have eighteen decimals each,
            so the figure was right and only the unit was wrong.

            WHAT A WINNER TAKES, not what is in the pot, once those differ. A
            week pays at most one percent of supply and the rest rolls over, so
            the balance would be the bigger number and the wrong promise. The
            balance is said underneath instead, where it cannot be misread as
            the prize. */}
        <Figure label="IN THE POT" value={prize} />
      </div>

      <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted">
        Beat an opponent and your best market cap of the week goes on that opponent&rsquo;s board.
        Each board plays for its own share of the pot. Weeks run Monday 00:00 UTC to Sunday
        midnight, and the prize is paid out on the Monday.
      </p>

      {/* The boards come next and not after five paragraphs of explanation. They
          are what somebody opened this page for; how it all works is underneath,
          for whoever wants it. */}
      {failed ? (
        <p className="mt-10 text-[11px] text-dump">
          The boards would not load. That is this page failing, not an empty week.
        </p>
      ) : answer === null ? (
        <p className="mt-10 text-[11px] text-muted">Reading the boards…</p>
      ) : (
        answer.boards.map((board) => <OneBoard key={board.id} board={board} />)
      )}

      {/* Underneath, and always — not only before the pot was deployed, which is
          what the old version did. The page hid its own explanation of where the
          money comes from on the morning the contracts went live. */}
      <section className="mt-14 border-t border-line pt-8">
        <h2 className="display text-xl">HOW IT WORKS</h2>

        <dl className="mt-5 space-y-5">
          <div>
            <dt className="display text-sm text-gold">Where the money comes from</dt>
            <dd className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted">
              {share ?? 25}% of every paid mint feeds the pot, and the same share of every royalty
              and every ranked match. It arrives as $CROCARD — the CRO buys the token first, so the
              prize and the buying are the same act.
            </dd>
          </div>

          <div>
            <dt className="display text-sm text-gold">One pot, several boards</dt>
            <dd className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted">
              Each board plays for a share of the pot rather than for the pot. What is not shared
              out stays here and grows, so a quiet week makes every prize bigger and a board nobody
              beats keeps its share for the week after.
              {holdingBack !== null && (
                <> There is {holdingBack} $CROCARD in it right now.</>
              )}
            </dd>
          </div>

          <div>
            <dt className="display text-sm text-gold">What one week can pay</dt>
            <dd className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted">
              At most one percent of the supply — {ONE_PERCENT} $CROCARD — however full the pot is.
              A fifth of every mint lands here and the mint is the busiest this game will ever be,
              so without a ceiling the first week after it would hand one player a tenth of the
              supply for beating a bot once. Whatever is over stays in the pot.
            </dd>
          </div>

          <div>
            <dt className="display text-sm text-gold">Scores are replayed, not reported</dt>
            <dd className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted">
              You hand over the seed, the deck and every move, and the server plays the match
              through its own engine and records what that produced. A number typed into a request
              is not a score.
            </dd>
          </div>

          <div>
            <dt className="display text-sm text-gold">Nobody decides who won</dt>
            <dd className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted">
              The winner is the best verified score, and paying them is a transaction anybody can
              read.{" "}
              <Link href="/contracts" className="text-pump hover:underline">
                The contract that holds the pot
              </Link>{" "}
              cannot be withdrawn from by the key that names the winners.
            </dd>
          </div>
        </dl>
      </section>
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

/**
 * One leaderboard, with its prize and its history.
 *
 * Drawn even when nobody is on it. An empty board says the prize is unclaimed
 * and the week is open, which is an invitation; leaving it out would say nothing
 * at all, and for the locked board it would mean a player never learns it is
 * there.
 */
function OneBoard({ board }: { board: BoardRow }) {
  const whole = (value: string) => Math.round(toTokens(value)).toLocaleString("en-US");

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <h2 className="display text-xl">{board.name}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{board.blurb}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[8px] tracking-[0.18em] text-faint">THIS WEEK PAYS</p>
          <p className="display text-lg tabular-nums text-gold">
            {board.prize === null ? "—" : `${whole(board.prize)} $CROCARD`}
          </p>
        </div>
      </div>

      {/* What to do about it, on the board itself. Somebody reading a
          leaderboard is deciding whether to join it, and the page used to leave
          them to work out where. */}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        <Link href="/play" className="text-pump hover:underline">
          Play this one
        </Link>{" "}
        and beat it, and your best of the week goes on the board.
        {board.needs !== null && (
          <>
            {" "}
            A score counts here while the wallet holds{" "}
            <span className="text-gold">
              {board.needs.whole.toLocaleString("en-US")} $LION
            </span>{" "}
            — anybody can play it, but only a holder&rsquo;s score is entered.
          </>
        )}
      </p>

      {board.standings.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted">
          Nobody has beaten this one yet.{" "}
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
                <span className="display w-6 shrink-0 text-sm text-faint tabular-nums">{i + 1}</span>
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

      {board.past.length > 0 && (
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
                    {whole(week.wei)} $CROCARD
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
