"use client";

// The claim button: what you have earned, and one transaction to take it.
//
// This is the first thing on this site that writes to the chain. Everything else
// reads, or signs a message that cannot move anything — see lib/wallet.ts.
//
// ── WHAT IT SHOWS AND WHEN ───────────────────────────────────────────────────
//
// Four states, and they are four because collapsing any two of them says
// something untrue. Nothing deployed yet is a fact about the project. Nothing
// earned yet is a fact about this wallet. Everything already taken is a fact
// about what they did last week. And a number with a button is the only one of
// the four that is an invitation.
//
// ── THE PROOF COMES FROM THE SERVER, THE TRANSACTION FROM THE WALLET ─────────
//
// /api/drop rebuilds the merkle tree and hands back this wallet's leaf and its
// proof. That is not a capability and it is not a secret: `claim` pays the
// holder named in the proof and never the caller, so the worst somebody can do
// with another wallet's proof is pay that wallet's gas.
//
// What the wallet does is send it. Which means the amount in the confirmation
// screen is the amount in the tree, and this component cannot change it — it can
// only be wrong about what it displayed beforehand, which the transaction would
// then contradict in public.

import { useCallback, useEffect, useState } from "react";

import { selector } from "@/lib/evm-tx";
import { EXPLORER, toTokens } from "@/lib/units";
import { claimData, reasonFor, sendCall } from "@/lib/wallet";

interface Owed {
  /** Everything the live tree says this wallet has earned. */
  earned: string;
  /** What the contract says it has already paid them. */
  taken: string;
  /** The difference, which is what this button would move. */
  claimable: string;
  proof: string[];
  root: string;
}

/** A share-out that has been proposed and is serving out its day of notice. */
interface Coming {
  earned: string;
  promised: string;
  holders: number;
  liveAt: number;
}

interface Answer {
  wallet: string;
  owed: Owed | null;
  coming?: Coming | null;
  drop: string | null;
}

type Doing = "idle" | "asking" | "sent";

/**
 * How long until a moment, in the largest unit that is still true.
 *
 * "in 6h 12m" rather than a date and a time. A holder looking at this wants to
 * know whether to wait or to come back tomorrow, and a timestamp makes them work
 * that out — in their own timezone, against a clock they have to find.
 */
function until(when: number, now: number): string {
  const left = when - now;
  if (left <= 0) return "any moment now";
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  if (days >= 1) return `in ${days}d ${hours}h`;
  if (hours >= 1) return `in ${hours}h ${minutes}m`;
  return `in ${Math.max(1, minutes)}m`;
}

export function Claim({ wallet }: { wallet: string | null }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [failed, setFailed] = useState(false);
  const [doing, setDoing] = useState<Doing>("idle");
  const [sentAs, setSentAs] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  // The one thing on this panel that goes stale while somebody looks at it.
  const [now, setNow] = useState(() => Date.now());

  /**
   * Passed through to the route, which is where the preview lives.
   *
   * Read during the first render and not in an effect: another section on this
   * page clears the query string in an effect of its own, and which of the two
   * ran first decided whether the preview worked at all.
   *
   * It is only ever a query parameter forwarded to a server that ignores it in
   * production. This component has no idea what a pretend balance looks like,
   * which is the point — the first version kept the sample numbers here, and
   * they shipped in the production bundle where anybody could find them.
   */
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const [preview] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("preview"),
  );

  const look = useCallback(async () => {
    if (wallet === null) return;
    try {
      const asking = preview === null ? "" : `&preview=${encodeURIComponent(preview)}`;
      const response = await fetch(`/api/drop?wallet=${wallet}${asking}`);
      if (!response.ok) throw new Error(String(response.status));
      setAnswer((await response.json()) as Answer);
      setFailed(false);
    } catch {
      // Loud rather than empty. "Nothing to claim" and "we could not ask" are
      // the two sentences this section must never swap, because one of them is
      // a reason to walk away.
      setFailed(true);
    }
  }, [wallet, preview]);

  useEffect(() => {
    void look();
  }, [look]);

  const claim = async () => {
    if (wallet === null || answer?.owed == null || answer.drop === null) return;
    setWrong(null);
    setDoing("asking");
    try {
      const hash = await sendCall(
        wallet,
        answer.drop,
        claimData(
          selector("claim(address,uint256,bytes32[])"),
          wallet,
          BigInt(answer.owed.earned),
          answer.owed.proof,
        ),
      );
      setSentAs(hash);
      setDoing("sent");
    } catch (error) {
      setWrong(reasonFor(error));
      setDoing("idle");
    }
  };

  if (wallet === null) return null;

  if (failed) {
    return (
      <p className="mt-3 text-[11px] leading-relaxed text-dump">
        What you are owed could not be read. That is this page failing, not an empty balance.
      </p>
    );
  }

  // Not deployed. A fact about the project rather than about this wallet, and
  // the section above already says the whole of it.
  if (answer === null || answer.drop === null) return null;

  // Deployed, and this wallet has never been in a tree — which is what a wallet
  // that has never held any looks like.
  const whole = (value: string) => Math.round(toTokens(value)).toLocaleString("en-US");

  // ── QUEUED, AND NOT YET CLAIMABLE ──────────────────────────────────────────
  //
  // The fifth state, and it was missing. A tree is proposed and then waits a day
  // in the open before the contract will adopt it — that delay is the whole
  // answer to a publisher key being stolen, and it is the reason this drop is
  // safe to run from a server at all.
  //
  // With only the live tree read, that day looked like nothing: a holder with
  // half a million $CROCARD queued and a timestamp attached was shown the same
  // empty space as somebody who had earned nothing, and reasonably concluded
  // the payout did not work. Saying what is coming turns the delay from a
  // silence into the thing it actually is.
  // ── WHAT IS ON ITS WAY ─────────────────────────────────────────────────────
  //
  // A tree is proposed and then waits a day in the open before the contract will
  // adopt it. That delay is the whole answer to a publisher key being stolen,
  // and the reason this drop is safe to run from a server at all.
  //
  // Said as a countdown rather than a date. Somebody looking at this wants to
  // know whether to wait or to come back tomorrow, and a timestamp makes them
  // work that out in their own timezone against a clock they have to find.
  //
  // AND SHOWN ALONGSIDE WHAT IS CLAIMABLE, not instead of it. It used to render
  // only when there was nothing to claim, so anybody who had claimed before saw
  // no sign that more was coming — which is the same silence this block was
  // written to remove, just moved to the people most likely to look.
  const coming = answer.coming ?? null;
  const onItsWay =
    coming === null ? null : (
      <div className="mt-4 border border-gold/40 bg-gold/5 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[8px] tracking-[0.18em] text-faint">ON ITS WAY</p>
            <p className="display mt-1 text-3xl tabular-nums text-gold">
              {whole(coming.earned)} <span className="text-base text-muted">$CROCARD</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[8px] tracking-[0.18em] text-faint">UNLOCKS</p>
            <p className="display mt-1 text-xl tabular-nums text-gold">
              {until(coming.liveAt, now)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          Your share of {whole(coming.promised)} going to{" "}
          {coming.holders.toLocaleString("en-US")} holders. A share-out is published first and
          only counts a day later, in the open, so a key on a server can never pay anybody
          without a day in which it can be thrown away.
        </p>

        <p className="mt-2 text-[10px] leading-relaxed text-gold">
          {coming.liveAt > now
            ? `It is adopted on the first nightly run after ${new Date(coming.liveAt).toLocaleString(
                undefined,
                { dateStyle: "medium", timeStyle: "short" },
              )}, and then the button below works on it too.`
            : "The day is up. It is adopted on the next nightly run, and then it is claimable here."}
        </p>
      </div>
    );

  if (answer.owed === null) return onItsWay;

  const claimable = BigInt(answer.owed.claimable);

  if (sentAs !== null) {
    return (
      <>
      <div className="mt-4 border border-pump/40 bg-pump/5 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-pump">
          Sent. It arrives when the transaction lands — a block on Cronos is under half a second,
          so that is about now.
        </p>
        <a
          href={`${EXPLORER}/tx/${sentAs}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block font-mono text-[10px] break-all text-muted hover:text-fg"
        >
          {sentAs}
        </a>
        <button
          type="button"
          onClick={() => {
            setSentAs(null);
            void look();
          }}
          className="mt-2 text-[10px] tracking-[0.16em] text-faint hover:text-fg"
        >
          READ IT BACK
        </button>
      </div>
      {onItsWay}
      </>
    );
  }

  // Everything already taken. Said rather than hidden: a holder who claimed on
  // Monday and comes back on Tuesday should see that they are up to date, not an
  // empty space that reads like something is broken.
  if (claimable === 0n) {
    return (
      <>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          You are up to date — everything earned so far has been paid out.
          {onItsWay === null ? " It starts going up again with the next share-out." : ""}
        </p>
        {onItsWay}
      </>
    );
  }

  return (
    <>
      <div className="mt-4 border border-pump/40 bg-pump/5 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[8px] tracking-[0.18em] text-faint">READY TO CLAIM</p>
          <p className="display mt-1 text-3xl tabular-nums text-pump">
            {whole(answer.owed.claimable)}{" "}
            <span className="text-base text-muted">$CROCARD</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void claim()}
          disabled={doing === "asking"}
          className="border border-pump px-5 py-2.5 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-bg disabled:opacity-50"
        >
          {doing === "asking" ? "CHECK YOUR WALLET…" : "CLAIM"}
        </button>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        One transaction, and you pay only the gas. It does not expire and it keeps going up, so
        leaving it costs nothing — this is here for whenever you want it.
      </p>

      {wrong !== null && <p className="mt-2 text-[10px] text-dump">{wrong}</p>}
      </div>
      {onItsWay}
    </>
  );
}
