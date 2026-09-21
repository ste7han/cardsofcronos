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
import { cx } from "@/lib/cx";
import { MOST_PER_RELEASE } from "@/lib/revenue";
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
  const [busy, setBusy] = useState<string | null>(null);
  const [sentAs, setSentAs] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);

  const inCollection = waiting.collection === null ? 0n : BigInt(waiting.collection);
  const inSplitter = waiting.splitter === null ? 0n : BigInt(waiting.splitter);
  const unreadable = waiting.collection === null && waiting.splitter === null;

  // Both steps, each with its own amount and its own button.
  //
  // This offered one "step that is due" and put the collection first, on the
  // reasoning that money has to be in the splitter before the splitter can
  // spend it. True, and it made the button useless the moment a new mint landed:
  // with 445 CRO waiting to be swapped and 15 newly arrived, it offered to move
  // the 15. Somebody pressed it, moved 15 CRO between two contracts, and
  // correctly saw nothing happen.
  //
  // Choosing for somebody is what went wrong. Both are shown now, with what
  // each will actually do, and the one that burns is the one that says so.
  const steps = [
    inCollection > 0n && at.collection !== null
      ? {
          key: "forward",
          to: at.collection,
          amount: inCollection,
          left: 0n,
          label: "FORWARD IT TO THE SPLITTER",
          note: "Out of the collection, where a mint pays. Nothing is bought or burned by this — it is the step before that.",
        }
      : null,
    inSplitter > 0n && at.splitter !== null
      ? {
          key: "split",
          to: at.splitter,
          // contracts/Splitter.sol spends at most MOST_PER_RELEASE in one go, so
          // a balance that has built up is taken in bites rather than in one bad
          // trade. The button said the whole balance once and spent 500 of it.
          amount: inSplitter > MOST_PER_RELEASE ? MOST_PER_RELEASE : inSplitter,
          left: inSplitter > MOST_PER_RELEASE ? inSplitter - MOST_PER_RELEASE : 0n,
          label: "BUY AND SPLIT IT",
          note: "This is the one that burns: it buys $CROCARD and divides it, half burned, three tenths to holders, a fifth to the pot.",
        }
      : null,
  ].filter((step): step is NonNullable<typeof step> => step !== null);

  const press = async (to: string, key: string) => {
    if (wallet === null) return;
    setWrong(null);
    setBusy(key);
    try {
      // `release()` on both, which is the same four bytes either way.
      const hash = await sendCall(wallet, to, selector("release()"));
      setSentAs(hash);
      onDone();
    } catch (error) {
      setWrong(reasonFor(error));
    } finally {
      setBusy(null);
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

      {steps.length === 0 ? (
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          Nothing is waiting. Everything that has been earned has been bought and divided — the
          burns above are what came of it.
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
            A job does this on its own every six hours, in batches, because a release is a trade and
            four a day is a better trade than forty. You do not have to wait for it. Pressing one of
            these is paying the gas, not making a decision: the calls take no arguments, cannot be
            pointed anywhere, and the split is fixed in the contract.
          </p>

          {wallet === null ? (
            <p className="mt-3 text-[10px] leading-relaxed text-gold">
              Sign in with your wallet to send it through.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {steps.map((step) => (
                <div key={step.key}>
                  <button
                    type="button"
                    onClick={() => void press(step.to, step.key)}
                    disabled={busy !== null}
                    className={cx(
                      "w-full border px-5 py-3 text-[10px] tracking-[0.18em] transition-colors sm:w-auto",
                      "disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none",
                      step.key === "split"
                        ? "glow-pump border-pump bg-pump/10 text-pump hover:bg-pump hover:text-ground"
                        : "border-line-strong text-muted hover:border-fg hover:text-fg",
                    )}
                  >
                    {busy === step.key
                      ? "SENDING…"
                      : `${step.label} · ${toCro(step.amount).toFixed(2)} CRO`}
                  </button>
                  <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-faint">
                    {step.note}
                    {step.left > 0n &&
                      ` One swap takes at most ${toCro(MOST_PER_RELEASE).toFixed(0)} CRO, so ${toCro(
                        step.left,
                      ).toFixed(2)} stays behind for the next press — the pool this trades against
                      is small enough that taking it all at once would be a worse price for
                      everybody.`}
                  </p>
                </div>
              ))}
            </div>
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
