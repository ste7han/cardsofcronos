"use client";

// Where the money goes, and what has been burned with it.
//
// Both on one page, because they are one subject: the burn number only means
// something if you can see what feeds it, and the splits only matter because
// every one of them is bought in the token before it is divided.
//
// Every burn is a transaction signature and a link to an explorer. A burn
// counter you cannot check is a number you should not believe, and this corner
// of the internet is full of them — so the total here is the sum of things
// anybody can go and look at, and when there are none it says zero rather than
// something rounder.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CROCARD_SUPPLY } from "@/data/holder-tiers";
import { BURN_ADDRESS, CONTRACTS, STREAMS, WALLETS, nameOf, receiverOf, sourceOf, type Destination } from "@/lib/revenue";
import { EXPLORER, toCro, toTokens } from "@/lib/units";
import { SendItThrough } from "@/components/SendItThrough";
import { cx } from "@/lib/cx";

interface BurnRow {
  txHash: string;
  stream: string;
  /** Decimal strings. Wei has eighteen zeroes and a JSON number does not. */
  wei: string;
  burned: string;
  at: number;
}

interface Answer {
  total: { burns: number; wei: string; burned: string };
  /** What the burn address holds now, base units, or null when unreadable. */
  dead: string | null;
  deadAddress: string;
  /** CRO that has arrived and has not been through the split yet. */
  waiting: { collection: string | null; splitter: string | null };
  at: { collection: string | null; splitter: string | null };
  burns: BurnRow[];
}

/** One address the money passes through. See app/api/wallets/route.ts. */
interface Place {
  id: string;
  name: string;
  what: string;
  /** Null while it is not deployed. Not the same as a balance nobody could read. */
  address: string | null;
  unit: "CRO" | "$CROCARD";
  /** null means the chain would not answer, which is not the same as empty. */
  amount: string | null;
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * The shape of the list before the balances arrive.
 *
 * Names and addresses only, so the section is a list with its numbers still
 * loading rather than a blank box that pops into existence. The addresses come
 * from lib/revenue.ts, which is where they come from on the server too.
 */
const PLACEHOLDERS: Place[] = [
  { id: "splitter", name: "SPLITTER", what: "", address: CONTRACTS.splitter, unit: "CRO", amount: null },
  { id: "burn", name: "BURN ADDRESS", what: "", address: BURN_ADDRESS, unit: "$CROCARD", amount: null },
  { id: "drop", name: "HOLDER DROP", what: "", address: CONTRACTS.drop, unit: "$CROCARD", amount: null },
  { id: "pot", name: "PRIZE POT", what: "", address: CONTRACTS.pot, unit: "$CROCARD", amount: null },
  { id: "owner", name: "OWNER", what: "", address: WALLETS.deployer.address, unit: "CRO", amount: null },
];

/**
 * A colour per destination, in one place.
 *
 * It was a nested ternary that assumed three of them, and adding a fourth made
 * everything that was not burn or creator the same green — two different
 * destinations drawn identically on a bar whose whole job is telling them apart.
 */
const COLOUR: Record<Destination, { bar: string; text: string }> = {
  burn: { bar: "bg-dump", text: "text-dump" },
  holders: { bar: "bg-primary", text: "text-primary" },
  creator: { bar: "bg-gold", text: "text-gold" },
  marketing: { bar: "bg-pump", text: "text-pump" },
  tournament: { bar: "bg-fg/60", text: "text-fg" },
  deployer: { bar: "bg-dump", text: "text-dump" },
};

/**
 * Shares are drawn in the order the stream lists them, so a stream reads the way
 * it was written down rather than largest-first.
 */
function Bar({ shares }: { shares: readonly { to: Destination; percent: number }[] }) {
  return (
    <div className="mt-3 flex h-2 w-full overflow-hidden border border-line">
      {shares.map((share) => (
        <div
          key={share.to}
          style={{ width: `${share.percent}%` }}
          className={cx(COLOUR[share.to].bar)}
        />
      ))}
    </div>
  );
}

export function Burn() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [held, setHeld] = useState<Place[] | null>(null);

  // Pulled out of the effect so the release button can ask again after it has
  // sent one: what is waiting has just changed, and a panel still showing the
  // old figure reads as a press that did nothing.
  const look = useCallback(async () => {
    try {
      const response = await fetch("/api/burn");
      if (response.ok) setAnswer((await response.json()) as Answer);
    } catch {
      // Nothing to say. The page reads "none yet" either way, and inventing a
      // number because a request failed is the one thing it must not do.
    }
  }, []);

  useEffect(() => {
    void look();

    void (async () => {
      try {
        const response = await fetch("/api/wallets");
        if (response.ok) {
          setHeld(((await response.json()) as { places: Place[] }).places);
        }
      } catch {
        // Same rule. A balance nobody could read stays unread on screen.
      }
    })();
  }, [look]);

  return (
    <div className="space-y-10">
      {/* What is at the dead address, first, because it is the bigger number and
          the one somebody came to see. The page used to open with what this game
          had burned — zero — under the heading "$CROCARD BURNED", which read as
          "none has ever been burned" while 89 million sat at an address anybody
          could look at. Both numbers are true; only one of them was here. */}
      <section>
        <h2 className="display text-xl">$CROCARD BURNED, ALL OF IT</h2>
        <div className="mt-4 border border-line bg-panel px-5 py-5">
          <p className="text-[8px] tracking-[0.18em] text-faint">
            HELD AT THE BURN ADDRESS RIGHT NOW
          </p>
          <p className="display mt-1.5 text-4xl tabular-nums text-dump sm:text-5xl">
            {answer === null
              ? "—"
              : answer.dead === null
                ? "—"
                : Math.round(toTokens(answer.dead)).toLocaleString("en-US")}
          </p>
          {answer !== null && answer.dead !== null && (
            <p className="mt-1 text-[10px] tracking-[0.18em] text-faint tabular-nums">
              {((toTokens(answer.dead) / CROCARD_SUPPLY) * 100).toFixed(2)}% OF THE SUPPLY
            </p>
          )}

          {answer !== null && answer.dead === null ? (
            // Said differently from a zero, because they are different facts and
            // only one of them is about the token.
            <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-dump">
              The burn address could not be read just now. That is this page failing rather than an
              empty address — try again in a moment, or go and look for yourself.
            </p>
          ) : (
            <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
              Read off the chain when you loaded this page, not from anything we keep. Most of it is
              from the 2025 version; what this game has burned is the number below, and the two add
              up to this one. Nothing sent there comes back — nobody holds its key.
            </p>
          )}

          {answer !== null && (
            <a
              href={`${EXPLORER}/address/${answer.deadAddress}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[10px] tracking-[0.18em] text-pump hover:underline"
            >
              CHECK IT YOURSELF →
            </a>
          )}
        </div>
      </section>

      <section>
        <h2 className="display text-xl">BURNED BY THIS GAME</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          The part of the total above that this version put there, and every one of them is a
          transaction you can open.
        </p>
        <dl className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-panel px-4 py-4">
            <dt className="text-[8px] tracking-[0.18em] text-faint">$CROCARD BURNED</dt>
            <dd className="display mt-1.5 text-2xl tabular-nums text-dump">
              {answer === null ? "—" : toTokens(answer.total.burned).toLocaleString("en-US")}
            </dd>
          </div>
          <div className="bg-panel px-4 py-4">
            <dt className="text-[8px] tracking-[0.18em] text-faint">CRO SPENT BUYING IT</dt>
            <dd className="display mt-1.5 text-2xl tabular-nums">
              {answer === null ? "—" : toCro(answer.total.wei).toFixed(2)}
            </dd>
          </div>
          <div className="bg-panel px-4 py-4">
            <dt className="text-[8px] tracking-[0.18em] text-faint">BURNS</dt>
            <dd className="display mt-1.5 text-2xl tabular-nums">
              {answer === null ? "—" : answer.total.burns}
            </dd>
          </div>
        </dl>

        {answer !== null && (
          <SendItThrough
            waiting={answer.waiting}
            at={answer.at}
            onDone={() => void look()}
          />
        )}

        {answer !== null && answer.burns.length === 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-gold">
            None yet, and zero is the honest number for this half of it. Nothing has been minted,
            so nothing has been earned, so nothing has been bought and nothing burned by this
            version. Every burn that does happen turns up here with the transaction that did it —
            a burn total you cannot check is a number you should not believe, which is also why the
            figure above is read off the chain rather than kept here.
          </p>
        ) : answer !== null ? (
          <div className="mt-4 overflow-x-auto border border-line">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[8px] tracking-[0.18em] text-faint">
                  <th className="px-4 py-3 font-normal">WHEN</th>
                  <th className="px-4 py-3 font-normal">FROM</th>
                  <th className="px-4 py-3 text-right font-normal">CRO</th>
                  <th className="px-4 py-3 text-right font-normal">$CROCARD</th>
                  <th className="px-4 py-3 text-right font-normal">TX</th>
                </tr>
              </thead>
              <tbody>
                {answer.burns.map((burn) => (
                  <tr key={burn.txHash} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-[10px] tabular-nums text-faint">
                      {new Date(burn.at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted">{sourceOf(burn.stream)}</td>
                    <td className="px-4 py-3 text-right text-[10px] tabular-nums text-muted">
                      {toCro(burn.wei).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-[10px] tabular-nums text-dump">
                      {toTokens(burn.burned).toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`${EXPLORER}/tx/${burn.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-pump hover:underline"
                      >
                        {burn.txHash.slice(0, 8)}…
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="display text-xl">WHERE THE MONEY GOES</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Three things earn, and none of what they earn stays in CRO. It is swapped for $CROCARD
          first and divided afterwards, so the whole of it is a buy and the split only decides
          where the tokens go. The swap is done by a contract with no owner and no settings —
          anybody can trigger it, nobody can point it somewhere else.{" "}
          <Link href="/contracts" className="text-pump hover:underline">
            Every address is here
          </Link>
          , with what each key attached to it can do.
        </p>

        <div className="mt-5 space-y-3">
          {STREAMS.map((stream) => (
            <div key={stream.id} className="panel border border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="display text-lg">{stream.name}</p>
                <span className="text-[9px] tracking-[0.18em] text-faint">
                  {stream.live ? "RUNNING" : "NOT YET"}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{stream.from}</p>

              <Bar shares={stream.shares} />

              <dl className="mt-3 space-y-1">
                {stream.shares.map((share) => (
                  <div key={share.to} className="flex flex-wrap items-baseline gap-2 text-[10px]">
                    <dt
                      className={cx("display w-10 shrink-0 tabular-nums", COLOUR[share.to].text)}
                    >
                      {share.percent}%
                    </dt>
                    <dd className="min-w-0 flex-1 text-muted">
                      {nameOf(share.to)}{" "}
                      {/* The thing that actually receives it, which for two of
                          the three is a contract rather than a wallet. No
                          address, no link: a placeholder here would be an
                          address somebody could send money to, and it would not
                          be ours. */}
                      {receiverOf(share.to) === null ? (
                        <span className="text-gold">not deployed yet</span>
                      ) : (
                        <a
                          href={`${EXPLORER}/address/${receiverOf(share.to)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-faint hover:text-fg"
                        >
                          {short(receiverOf(share.to)!)}
                        </a>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {stream.open && (
                <p className="mt-3 border-t border-line pt-3 text-[10px] leading-relaxed text-gold">
                  {stream.open}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Where the money actually goes, in the order it moves.
          This listed the four wallets in lib/revenue.ts until September 2026,
          three of which have no address and two of which no stream pays — so a
          page about where the money goes carried three rows reading "not
          announced yet", which reads as a promise that money will one day go
          there. The tournament row was not a gap but wrong: the prize pot has
          been a contract for as long as there has been one. */}
      <section>
        <h2 className="display text-xl">WHERE IT GOES</h2>
        <dl className="mt-4 divide-y divide-line border border-line">
          {(held ?? PLACEHOLDERS).map((place) => (
            <div
              key={place.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <dt className="text-[10px] tracking-[0.18em] text-faint">{place.name}</dt>
                <dd className="mt-1 max-w-xl text-[10px] leading-relaxed text-muted">
                  {place.what}
                </dd>
                {place.address === null ? (
                  <p className="mt-1 text-[10px] text-gold">Not deployed yet.</p>
                ) : (
                  <a
                    href={`${EXPLORER}/address/${place.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block font-mono text-[10px] break-all text-fg hover:text-pump"
                  >
                    {place.address}
                  </a>
                )}
              </div>

              {/* Four states and never three. Empty is a fact about the
                  address; unknown is a fact about the request; and something
                  not deployed is a fact about the project. Reading "0" for any
                  of the other three is the one wrong answer this can give. */}
              <span className="shrink-0 text-right">
                <span className="display block text-xl tabular-nums">
                  {place.address === null
                    ? "—"
                    : held === null
                      ? "…"
                      : place.amount == null
                        ? "—"
                        : place.unit === "CRO"
                          ? toCro(place.amount).toFixed(2)
                          : Math.round(toTokens(place.amount)).toLocaleString("en-US")}
                </span>
                <span className="block text-[8px] tracking-[0.18em] text-faint">
                  {place.address === null
                    ? "NOT DEPLOYED"
                    : held !== null && place.amount == null
                      ? "NOT KNOWN"
                      : place.unit}
                </span>
              </span>
            </div>
          ))}
        </dl>
        <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-faint">
          Read off the chain a minute at a time, so nobody has to go and look it up — and published
          so the splits above can be checked rather than taken on trust. None of them is a key: an
          address is public by nature, and these are here to be watched.
        </p>

        {/* A door rather than a word in a footnote. This is where somebody
            looking at five addresses wants to ask what can be done with them,
            and it is the only way through now that /contracts has left the
            nav — see components/Nav.tsx. */}
        <Link
          href="/contracts"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-panel px-5 py-4 transition-colors hover:border-pump"
        >
          <span className="min-w-0">
            <span className="display block text-sm">WHAT CAN BE DONE WITH THEM</span>
            <span className="mt-1 block max-w-xl text-[10px] leading-relaxed text-muted">
              Every contract this game touches, who holds the key, and what that key can do —
              including the rescue hatches, which are the most alarming things on it and therefore
              the ones most worth naming. The wallets no stream pays are there too.
            </span>
          </span>
          <span className="shrink-0 text-[10px] tracking-[0.18em] text-pump">CONTRACTS →</span>
        </Link>
      </section>
    </div>
  );
}
