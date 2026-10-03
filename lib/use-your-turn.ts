"use client";

// How many matches are waiting on you.
//
// A correspondence match gives each side a day to answer, which is generous
// enough that people forget they are in one. Nothing on the site said so unless
// you went looking at /pvp, so a match could time out while its player was on
// the mint page three clicks away.
//
// This is the smallest version of telling them: a count in the nav. It is not a
// push notification and does not pretend to be — it only reaches somebody who is
// already here. What it is good for is finding out whether being told is worth
// building the rest of.
//
// ── ONE REQUEST, NOT ONE PER PLACE THAT ASKS ─────────────────────────────────
//
// Shared through a module-level cache rather than fetched per component. The nav
// is on every page and the lobby is on one of them; two independent pollers
// would double the requests and could disagree about the number in front of
// somebody's eyes.

import { useEffect, useState } from "react";

import { useSession } from "@/lib/use-session";
import { ask, NotSignedIn, type MatchSummary } from "@/lib/pvp-client";

/** How often to ask, while somebody has the site open. */
const EVERY = 45_000;

let waiting = 0;
let at = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(n: number) => void>();

function tell(n: number): void {
  waiting = n;
  for (const listener of listeners) listener(n);
}

async function look(): Promise<void> {
  try {
    const { matches } = await ask<{ matches: MatchSummary[] }>("matches");
    // Finished matches still come back — they are the history — and a finished
    // one can carry yourTurn from whenever it stopped.
    tell(matches.filter((one) => one.yourTurn && !one.finished).length);
  } catch (error) {
    // Signed out is a real answer and means none.
    if (error instanceof NotSignedIn) {
      tell(0);
      return;
    }
    // Anything else leaves the count where it was. Dropping it to zero on a
    // flaky connection would quietly tell somebody they had nothing to do.
  }
}

/**
 * The number of matches it is your turn in, kept current while the tab is open.
 *
 * Zero when signed out, and zero rather than null while the first answer is on
 * its way: a badge that flashes a number and then takes it away is worse than
 * one that arrives a moment late.
 */
export function useYourTurn(): number {
  const { wallet, ready } = useSession();
  const [count, setCount] = useState(waiting);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  useEffect(() => {
    if (!ready || wallet === null) {
      tell(0);
      return;
    }

    const ask = () => {
      // One at a time, and not more often than the interval however many
      // components mount.
      if (inFlight !== null || Date.now() - at < EVERY / 2) return;
      at = Date.now();
      inFlight = look().finally(() => {
        inFlight = null;
      });
    };

    ask();
    const timer = setInterval(ask, EVERY);
    // And straight away when somebody comes back to the tab, which is when the
    // answer is most likely to have changed and most likely to be looked at.
    const woke = () => {
      if (document.visibilityState === "visible") {
        at = 0;
        ask();
      }
    };
    document.addEventListener("visibilitychange", woke);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", woke);
    };
  }, [ready, wallet]);

  return count;
}
