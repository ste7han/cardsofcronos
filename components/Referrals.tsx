"use client";

// Your referral code, who you brought, and who brought you.
//
// What it deliberately does not say is what any of it is worth. The price of a
// referral is not settled and does not have to be for this to be useful now:
// this records what happened, and a number can be put on it later without any
// of this history being wrong. A page that invented one would be a promise
// nobody made.

import { useCallback, useEffect, useState } from "react";

import { proofOf } from "@/lib/session";
import { PENDING_REF, peekPendingRef, takePendingRef } from "@/lib/ref";

interface Brought {
  wallet: string;
  claimedAt: number;
  /** False until they have linked an X account and finished a match. */
  qualified: boolean;
}

interface Answer {
  code: string;
  record: { wins: number; losses: number; draws: number };
  brought: Brought[];
  broughtBy: { code: string } | null;
}

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

const SAID: Record<string, string> = {
  claimed: "Recorded. Each of your five now earns them a point as well.",
  already: "Somebody is already down as having brought you, and that only happens once.",
  self: "That is your own code.",
  unknown: "No such code.",
};

async function ask<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const proof = proofOf();
  if (proof === null) throw new Error("Sign in with a wallet first.");
  const response = await fetch(`/api/ref/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });
  const answer = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(answer?.error ?? `The server said no (${response.status}).`);
  return answer as T;
}

export function Referrals({ wallet }: { wallet: string | null }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [typed, setTyped] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (wallet === null) return;
    try {
      setAnswer(await ask<Answer>("me"));
    } catch {
      setAnswer(null);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  // A code carried in from a link, claimed the moment there is a wallet to
  // attach it to. Somebody who arrives on a referral link and signs in ten
  // minutes later should not have to remember to type anything.
  useEffect(() => {
    if (wallet === null || answer === null || answer.broughtBy !== null) return;
    // Peeked, not taken. The code is only spent once the server has given a
    // real answer — it was taken first, so a request that failed on the way out
    // threw away the one thing telling us who brought this person, and there is
    // no getting it back.
    const pending = peekPendingRef();
    if (!pending) return;

    void (async () => {
      try {
        const { outcome } = await ask<{ outcome: string }>("claim", { code: pending });
        // Every one of these is final: recorded, already referred, your own
        // code, or a code that is not one. None of them gets better on a retry.
        takePendingRef();
        setSaid(SAID[outcome] ?? null);
        await load();
      } catch {
        // A network that is not there. Kept, and tried again next visit.
      }
    })();
  }, [wallet, answer, load]);

  if (wallet === null || answer === null) return null;

  // A path and no punctuation. /profile?ref=CODE is correct and fragile: chat
  // clients and in-app browsers guess where a bare URL ends, and a `?` is one of
  // the places they guess wrong — the link arrives cut short and the person sees
  // "failed to load". /r/CODE has nothing in it to guess about, and it can be
  // read out loud. It redirects to the query form, so claiming has one
  // implementation and old links still work.
  const link = `${window.location.origin}/r/${answer.code}`;


  async function claim() {
    setBusy(true);
    try {
      const { outcome } = await ask<{ outcome: string }>("claim", { code: typed });
      setSaid(SAID[outcome] ?? null);
      if (outcome === "claimed") setTyped("");
      await load();
    } catch (error) {
      setSaid(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="display text-xl">REFERRALS</h2>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
        Bring people in and it is recorded here.{" "}
        <span className="text-fg">What a referral is worth is not settled yet</span> — that needs
        the token to exist. Everything below is kept from now on, so whatever it is decided to be
        worth, none of this is lost.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="panel border border-line p-5">
          <p className="text-[9px] tracking-[0.18em] text-faint">YOUR CODE</p>
          <p className="display mt-2 text-2xl tracking-[0.12em] text-gold">{answer.code}</p>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-4 w-full border border-line-strong px-3 py-2 text-[10px] tracking-[0.16em] text-muted transition-colors hover:border-pump hover:text-pump"
          >
            {copied ? "COPIED" : "COPY YOUR LINK"}
          </button>
          <p className="mt-2 font-mono text-[9px] break-all text-faint">{link}</p>
        </div>

        <div className="panel border border-line p-5">
          <p className="text-[9px] tracking-[0.18em] text-faint">YOU HAVE BROUGHT</p>
          {/* Two numbers and not one. Claiming a code is free, so the count of
              people who used it is not the count of people who are worth
              anything — and showing only the first would be the page making the
              same promise the anti-farming rule exists to refuse. */}
          <p className="display mt-2 text-2xl tabular-nums">
            {answer.brought.filter((one) => one.qualified).length}
            <span className="text-muted"> / {answer.brought.length}</span>
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Counting against claimed. Using your code costs nothing, so it earns nothing on its
            own — one counts once they have linked an X account and played a match through. After
            that it is a point for every one of the five they do, up to five.
          </p>

          {answer.brought.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3">
              {answer.brought.slice(0, 6).map((one) => (
                <li
                  key={one.wallet}
                  className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-muted"
                >
                  <span>{short(one.wallet)}</span>
                  <span className={one.qualified ? "text-pump" : "text-faint"}>
                    {one.qualified ? "COUNTS" : "NOT YET"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-3 panel border border-line p-5">
        <p className="text-[9px] tracking-[0.18em] text-faint">WHO BROUGHT YOU</p>
        {answer.broughtBy ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Code <span className="font-mono text-gold">{answer.broughtBy.code}</span>. Every one of
            your five earns them a point too.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Nobody yet. If somebody sent you here, their code goes in below — once, and it
              cannot be changed afterwards.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value.toUpperCase())}
                placeholder="THEIR CODE"
                maxLength={8}
                className="min-w-0 flex-1 border border-line bg-ground px-3 py-2 font-mono text-[11px] tracking-[0.12em] text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void claim()}
                disabled={busy || typed.trim().length === 0}
                className="border border-pump px-4 py-2 text-[10px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:text-muted"
              >
                {busy ? "…" : "SAVE"}
              </button>
            </div>
          </>
        )}
        {said && <p className="mt-3 text-[10px] leading-relaxed text-gold">{said}</p>}
      </div>
    </section>
  );
}
