"use client";

// The burn total, small enough for the homepage.
//
// The same number as /burn and read from the same route, so the two cannot
// disagree — a headline figure that has drifted from the page it links to is
// worse than no headline figure.
//
// It renders nothing at all until it has an answer. A homepage that flashes a
// zero and then corrects itself is telling somebody nothing was burned, briefly,
// which is the one thing a burn counter must never say by accident.

import Link from "next/link";
import { useEffect, useState } from "react";

interface Total {
  burns: number;
  lamports: number;
  burned: number;
}

export function BurnStrip() {
  const [total, setTotal] = useState<Total | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/burn");
        if (response.ok) setTotal(((await response.json()) as { total: Total }).total);
      } catch {
        // Nothing to say, and nothing invented to fill the gap.
      }
    })();
  }, []);

  if (total === null) return null;

  return (
    <Link
      href="/burn"
      className="mt-7 flex flex-wrap items-baseline justify-between gap-3 border border-line px-5 py-4 transition-colors hover:border-line-strong"
    >
      <span className="text-[8px] tracking-[0.2em] text-faint">
        $TCG BURNED SO FAR
        <span className="ml-3 normal-case tracking-normal text-muted">
          {total.burns === 0
            ? "nothing yet, and zero is the honest number"
            : `${total.burns} burns, ${(total.lamports / 1_000_000_000).toFixed(2)} SOL spent`}
        </span>
      </span>
      <span className="flex items-baseline gap-3">
        <span className="display text-2xl tabular-nums text-dump">
          {total.burned.toLocaleString("en-US")}
        </span>
        <span className="text-[9px] tracking-[0.18em] text-pump">SEE THE SPLITS →</span>
      </span>
    </Link>
  );
}
