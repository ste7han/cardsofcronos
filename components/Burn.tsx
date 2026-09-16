"use client";

// Where the money goes, and what has been burned with it.
//
// Both on one page, because they are one subject: the burn number only means
// something if you can see what feeds it, and the splits only matter because of
// where a quarter to three quarters of them ends up.
//
// Every burn is a transaction signature and a link to an explorer. A burn
// counter you cannot check is a number you should not believe, and this corner
// of the internet is full of them — so the total here is the sum of things
// anybody can go and look at, and when there are none it says zero rather than
// something rounder.

import { useEffect, useState } from "react";

import { STREAMS, WALLETS, nameOf, walletFor, type Destination } from "@/lib/revenue";
import { EXPLORER, toCro, toTokens } from "@/lib/units";
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
  burns: BurnRow[];
}

interface WalletBalance {
  id: string;
  /** Null while nobody has said what this wallet is. Not the same as unknown. */
  address: string | null;
  what: string;
  /** null means the chain would not answer, which is not the same as empty. */
  wei: string | null;
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

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
  const [held, setHeld] = useState<WalletBalance[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/burn");
        if (response.ok) setAnswer((await response.json()) as Answer);
      } catch {
        // Nothing to say. The page reads "none yet" either way, and inventing a
        // number because a request failed is the one thing it must not do.
      }
    })();

    void (async () => {
      try {
        const response = await fetch("/api/wallets");
        if (response.ok) {
          setHeld(((await response.json()) as { wallets: WalletBalance[] }).wallets);
        }
      } catch {
        // Same rule. A balance nobody could read stays unread on screen.
      }
    })();
  }, []);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="display text-xl">BURNED SO FAR</h2>
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

        {answer !== null && answer.burns.length === 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-gold">
            None yet, and zero is the honest number. There is no token, so there is nothing to buy
            and nothing to burn. Every burn that does happen turns up here with the transaction
            that did it — a burn total you cannot check is a number you should not believe.
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
                    <td className="px-4 py-3 text-[10px] text-muted">{burn.stream}</td>
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
          Three things earn, and all three send most of what they earn into the token. Every
          buy-and-burn runs through the deployer wallet, so all of it lands in one place anybody
          can watch.
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
                      {/* No address, no link. A wallet nobody has named yet says
                          so — a placeholder here would be an address somebody
                          could send money to, and it would not be ours. */}
                      {walletFor(share.to).address === null ? (
                        <span className="text-gold">not announced yet</span>
                      ) : (
                        <a
                          href={`${EXPLORER}/address/${walletFor(share.to).address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-faint hover:text-fg"
                        >
                          {short(walletFor(share.to).address!)}
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

      <section>
        <h2 className="display text-xl">THE WALLETS</h2>
        <dl className="mt-4 divide-y divide-line border border-line">
          {Object.values(WALLETS).map((wallet) => {
            const balance = held?.find((one) => one.id === wallet.id);
            return (
              <div key={wallet.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <dt className="text-[10px] tracking-[0.18em] text-faint">
                    {wallet.id.toUpperCase()}
                  </dt>
                  <dd className="mt-1 text-[10px] leading-relaxed text-muted">{wallet.what}</dd>
                  {wallet.address === null ? (
                    <p className="mt-1 text-[10px] text-gold">Not announced yet.</p>
                  ) : (
                    <a
                      href={`${EXPLORER}/address/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block font-mono text-[10px] break-all text-fg hover:text-pump"
                    >
                      {balance?.address ?? wallet.address}
                    </a>
                  )}
                </div>

                {/* Four states and never three. Empty is a fact about the
                    wallet; unknown is a fact about the request; and an address
                    nobody has chosen yet is a fact about the project. Reading
                    "0 CRO" for any of the other three is the one wrong answer
                    this section can give. */}
                <span className="shrink-0 text-right">
                  <span className="display block text-xl tabular-nums">
                    {wallet.address === null
                      ? "—"
                      : held === null
                        ? "…"
                        : balance?.wei == null
                          ? "—"
                          : toCro(balance.wei).toFixed(2)}
                  </span>
                  <span className="block text-[8px] tracking-[0.18em] text-faint">
                    {wallet.address === null
                      ? "NO WALLET YET"
                      : held !== null && balance?.wei == null
                        ? "NOT KNOWN"
                        : "CRO"}
                  </span>
                </span>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-faint">
          Read off the chain a minute at a time, so nobody has to go and look it up — and published
          so the splits above can be checked rather than taken on trust. None of them is a key: an
          address is public by nature, and these are here to be watched.
        </p>
      </section>
    </div>
  );
}
