"use client";

// The button anybody can press to move a mint's money through the split.
//
// ── WHY THERE IS ANYTHING TO PRESS ───────────────────────────────────────────
//
// A mint pays the collection and the CRO sits there. `release()` on the
// collection forwards it to the splitter; `release()` on the splitter buys
// $CROCARD and divides it half burned, three tenths to holders, a fifth to the
// pot. Neither call takes an argument and neither has an owner check.
//
// A job does this every six hours on its own. That batching is deliberate — a
// release is a trade, and four a day is a better trade than forty — but it also
// means somebody who has just minted can watch 420 CRO sit in a contract for
// four hours and reasonably conclude that nothing works.
//
// So: the amount is on the page, and so is the button. Pressing it is paying
// the gas, not making a decision. There is nothing to choose: the call has no
// arguments, it cannot be pointed anywhere, and the split is fixed in the
// contract.
//
// ── ONE PRESS IS ONE STEP ────────────────────────────────────────────────────
//
// It could send both transactions and wait in between. It does not: each press
// does the step that is due and the panel then shows the next one. Two wallet
// prompts from one click is the kind of surprise that makes people cancel the
// second one, and a half-done release read as a failure.

import { useState } from "react";

import { selector } from "@/lib/evm-tx";
import { EXPLORER, toCro } from "@/lib/units";
import { reasonFor, sendCall } from "@/lib/wallet";
import { useSession } from "@/lib/use-session";

export function SendItThrough({
  waiting,
  at,
  onDone,
}: {
  waiting: { collection: string | null; splitter: string | null };
  at: { collection: string | null; splitter: string | null };
  onDone: () => void;
}) {
  const { wallet } = useSession();
  const [busy, setBusy] = useState(false);
  const [sentAs, setSentAs] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);

  const inCollection = waiting.collection === null ? 0n : BigInt(waiting.collection);
  const inSplitter = waiting.splitter === null ? 0n : BigInt(waiting.splitter);
  const unreadable = waiting.collection === null && waiting.splitter === null;

  // The step that is due. The collection first, because what it holds has to be
  // in the splitter before the splitter can spend it.
  const step =
    inCollection > 0n && at.collection !== null
      ? { to: at.collection, amount: inCollection, label: "FORWARD IT TO THE SPLITTER" }
      : inSplitter > 0n && at.splitter !== null
        ? { to: at.splitter, amount: inSplitter, label: "BUY AND SPLIT IT" }
        : null;

  const press = async () => {
    if (wallet === null || step === null) return;
    setWrong(null);
    setBusy(true);
    try {
      // `release()` on both, which is the same four bytes either way.
      const hash = await sendCall(wallet, step.to, selector("release()"));
      setSentAs(hash);
      onDone();
    } catch (error) {
      setWrong(reasonFor(error));
    } finally {
      setBusy(false);
    }
  };

  if (unreadable) {
    return (
      <p className="mt-4 text-[10px] leading-relaxed text-dump">
        What is waiting could not be read off the chain. That is this page failing rather than an
        empty contract.
      </p>
    );
  }

  return (
    <div className="mt-4 border border-line bg-panel px-5 py-4">
      <p className="text-[8px] tracking-[0.18em] text-faint">WAITING TO GO THROUGH</p>
      <p className="display mt-1.5 text-3xl tabular-nums text-gold">
        {toCro(inCollection + inSplitter).toFixed(2)}{" "}
        <span className="text-[10px] tracking-[0.18em] text-faint">CRO</span>
      </p>

      {inCollection > 0n && inSplitter > 0n && (
        <p className="mt-1 text-[10px] tabular-nums text-faint">
          {toCro(inCollection).toFixed(2)} in the collection · {toCro(inSplitter).toFixed(2)} in the
          splitter
        </p>
      )}

      {step === null ? (
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          Nothing is waiting. Everything that has been earned has been bought and divided — the
          burns above are what came of it.
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
            A job does this on its own every six hours, in batches, because a release is a trade and
            four a day is a better trade than forty. You do not have to wait for it. Pressing this
            is paying the gas, not making a decision: the call takes no arguments, cannot be pointed
            anywhere, and the split is fixed in the contract.
          </p>

          {wallet === null ? (
            <p className="mt-3 text-[10px] leading-relaxed text-gold">
              Sign in with your wallet to send it through.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void press()}
              disabled={busy}
              className="glow-pump mt-3 border border-pump bg-pump/10 px-5 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none"
            >
              {busy ? "SENDING…" : `${step.label} · ${toCro(step.amount).toFixed(2)} CRO`}
            </button>
          )}
        </>
      )}

      {sentAs !== null && (
        <p className="mt-3 text-[10px] leading-relaxed text-pump">
          Sent.{" "}
          <a
            href={`${EXPLORER}/tx/${sentAs}`}
            target="_blank"
            rel="noreferrer"
            className="tracking-[0.18em] hover:underline"
          >
            SEE IT ON CRONOSCAN →
          </a>
        </p>
      )}

      {wrong && <p className="mt-3 text-[10px] leading-relaxed text-dump">{wrong}</p>}
    </div>
  );
}
