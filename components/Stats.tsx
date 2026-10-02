"use client";

// The figures on the how-it-works page, read from the chain on every view.
//
// Nothing here is written down. The page it sits on explains where the money
// goes, which makes it the page somebody is most likely to check — and a figure
// typed into prose is a figure that is wrong by however long nobody looked.
//
// A number that could not be read shows as a dash and says so underneath. Blank
// would read as zero, and zero burned is a very different claim from "the chain
// did not answer".

import { useEffect, useState } from "react";

import { toTokens } from "@/lib/units";

interface Stats {
  minted: number | null;
  supply: number;
  burned: string | null;
  buybacks: number | null;
  allocated: string | null;
  claimed: string | null;
  won: { card: string; lion: string } | null;
}

const whole = (wei: string) => Math.round(toTokens(wei)).toLocaleString("en-US");

/** Whole tokens above a thousand, two decimals below. Matches the board. */
function some(wei: string): string {
  const tokens = toTokens(wei);
  return tokens >= 1_000
    ? Math.round(tokens).toLocaleString("en-US")
    : tokens.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border border-line bg-panel px-5 py-4">
      <p className="text-[9px] tracking-[0.22em] text-faint">{label}</p>
      <p className="display mt-2 text-2xl tabular-nums text-pump sm:text-3xl">{value}</p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

export function Stats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetch("/api/stats")
      .then((answer) => (answer.ok ? answer.json() : Promise.reject(new Error())))
      .then((found: Stats) => setStats(found))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="mt-6 text-[11px] text-dump">
        The figures would not load. That is this page failing, not the project standing still.
      </p>
    );
  }
  if (stats === null) {
    return <p className="mt-6 text-[11px] text-muted">Reading the chain…</p>;
  }

  const outstanding =
    stats.allocated === null || stats.claimed === null
      ? null
      : (BigInt(stats.allocated) - BigInt(stats.claimed)).toString();

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Figure
          label="CARDS MINTED"
          value={stats.minted === null ? "—" : stats.minted.toLocaleString("en-US")}
          note={
            stats.minted === null
              ? "The collection would not answer just now."
              : `of ${stats.supply.toLocaleString("en-US")}. Fixed in the contract and unable to grow.`
          }
        />
        <Figure
          label="$CROCARD BURNED"
          value={stats.burned === null ? "—" : whole(stats.burned)}
          note={
            stats.burned === null
              ? "The burn record would not answer just now."
              : `Over ${stats.buybacks} buybacks. What this game burned — not the balance at the dead address, where 89 million already sat.`
          }
        />
        <Figure
          label="ALLOCATED TO HOLDERS"
          value={stats.allocated === null ? "—" : whole(stats.allocated)}
          note={
            stats.allocated === null
              ? "The drop contract would not answer just now."
              : "Published on chain and cumulative. It only ever goes up, and nothing expires."
          }
        />
        <Figure
          label="WON ON THE BOARDS"
          value={stats.won === null ? "—" : whole(stats.won.card)}
          note={
            stats.won === null
              ? "The prize record would not answer just now."
              : stats.won.lion === "0"
                ? "$CROCARD paid out to weekly winners."
                : `$CROCARD, plus ${some(stats.won.lion)} $LION out of the Loaded Lions pot.`
          }
        />
      </div>

      {/* Claimed against outstanding, which is the split people actually ask
          about — and the one that looks alarming if only the smaller half is
          shown. Most of what has been allocated is simply still sitting there. */}
      {stats.allocated !== null && stats.claimed !== null && outstanding !== null && (
        <div className="mt-3 border border-line bg-panel px-5 py-4">
          <p className="text-[9px] tracking-[0.22em] text-faint">OF THAT</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] tracking-[0.16em] text-muted">CLAIMED</dt>
              <dd className="display mt-1 text-xl tabular-nums text-fg">{whole(stats.claimed)}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-[0.16em] text-muted">WAITING TO BE CLAIMED</dt>
              <dd className="display mt-1 text-xl tabular-nums text-gold">{whole(outstanding)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">
            There is no deadline and no penalty for leaving it. One transaction collects all of it,
            whenever a holder wants it.
          </p>
        </div>
      )}
    </>
  );
}
