"use client";

// The real mint: what the contract will let this wallet do, and the button.
//
// Everything on this page above it is the local rehearsal — cards drawn in a
// browser and kept in localStorage. This is the half that costs money and hands
// over an NFT, so the two are deliberately not one component that changes
// behaviour: a button that is sometimes free and sometimes 15 CRO is a button
// somebody presses out of habit.
//
// ── IT ASKS THE CHAIN, NOT THE REPOSITORY ────────────────────────────────────
//
// /api/mint reads saleOpen, claimsOpen, the price for this wallet, and how many
// of its free mints it has already taken. Every one of those can change without
// a deploy — a door opened from scripts/nft/mint-control.ts, a claim made from a
// block explorer — and a page that assumed any of them would be offering a
// button that reverts.
//
// The price it shows is `priceFor(wallet)`, so it already has the $CROCARD
// discount in it. lib/revenue.ts holds the list price for the copy above; this
// holds what will actually be charged, and the contract refunds an overpayment
// but reverts an underpayment.
//
// ── WHAT IT DOES NOT PRETEND ─────────────────────────────────────────────────
//
// A minted token is face down. The contract's baseURI points at the face-down
// folder until the set is revealed, so what somebody gets is a numbered token
// that does not say what card it is yet — and this says that rather than showing
// them a card. Which card each token is was settled before the mint opened; the
// hash is on this page.

import { useCallback, useEffect, useState } from "react";

import { buyData, claimData } from "@/lib/mint";
import { EXPLORER } from "@/lib/units";
import { useSession } from "@/lib/use-session";
import { reasonFor, sendCall } from "@/lib/wallet";
import { cx } from "@/lib/cx";

interface State {
  contract: string | null;
  saleOpen: boolean;
  claimsOpen: boolean;
  price: string;
  minted: number;
  supply: number;
  maxPerTx: number;
}

interface Free {
  allowance: number;
  taken: number;
  left: number;
  proof: string[];
}

interface Answer {
  state: State;
  claim: Free | null;
}

/** Wei as whole CRO, to one decimal, because the discount produces halves. */
function inCro(wei: string): string {
  const cro = Number(BigInt(wei) / 10n ** 15n) / 1000;
  return cro % 1 === 0 ? String(cro) : cro.toFixed(1);
}

export function MintOnChain() {
  const { wallet } = useSession();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [failed, setFailed] = useState(false);
  const [amount, setAmount] = useState(1);
  const [sentAs, setSentAs] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const url = wallet === null ? "/api/mint" : `/api/mint?wallet=${wallet}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("no");
      setAnswer((await response.json()) as Answer);
      setFailed(false);
    } catch {
      // Loud rather than empty. "The mint is shut" and "we could not ask" are
      // two sentences this must never swap: one of them is a reason to leave.
      setFailed(true);
    }
  }, [wallet]);

  useEffect(() => {
    void look();
  }, [look]);

  if (failed) {
    return (
      <div className="panel mt-4 border border-line p-6">
        <p className="text-[11px] leading-relaxed text-dump">
          The mint could not be read off the chain. That is this page failing, not a mint that is
          shut — try again in a moment.
        </p>
      </div>
    );
  }

  if (answer === null || answer.state.contract === null) return null;

  const { state, claim } = answer;
  const left = state.supply - state.minted;
  const soldOut = left <= 0;
  const canBuy = state.saleOpen && !soldOut;
  const canClaim = state.claimsOpen && !soldOut && claim !== null && claim.left > 0;

  const send = async (what: "buy" | "claim") => {
    if (wallet === null || state.contract === null) return;
    setWrong(null);
    try {
      const hash =
        what === "buy"
          ? await sendCall(
              wallet,
              state.contract,
              buyData(amount),
              BigInt(state.price) * BigInt(amount),
            )
          : await sendCall(
              wallet,
              state.contract,
              // Never more than a transaction holds, and never more than is
              // left — the contract refuses both and this is the cheaper place
              // to find out.
              claimData(
                claim!.allowance,
                claim!.proof,
                Math.min(claim!.left, state.maxPerTx),
              ),
            );
      setSentAs(hash);
    } catch (error) {
      setWrong(reasonFor(error));
    }
  };

  return (
    <div className="panel mt-4 border border-pump/40 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="display text-lg text-pump">ON CHAIN</h3>
        <span className="text-[10px] tracking-[0.18em] text-faint tabular-nums">
          {state.minted.toLocaleString("en-US")} of {state.supply.toLocaleString("en-US")} MINTED
        </span>
      </div>

      {sentAs !== null ? (
        <div className="mt-4 border border-pump/40 bg-pump/5 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-pump">
            Sent. Your tokens arrive when the transaction lands — a block on Cronos is under half a
            second, so that is about now. They are face down until the set is revealed.
          </p>
          <a
            href={`${EXPLORER}/tx/${sentAs}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[10px] tracking-[0.18em] text-pump hover:underline"
          >
            SEE IT ON CRONOSCAN →
          </a>
        </div>
      ) : soldOut ? (
        <p className="mt-3 text-[11px] leading-relaxed text-gold">
          All {state.supply.toLocaleString("en-US")} are minted. There will not be more — the supply
          was fixed in the contract when it was deployed.
        </p>
      ) : !state.saleOpen && !state.claimsOpen ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          The contract is deployed and both its doors are shut. Nothing above this line can be
          bought yet, and nothing here is queued or reserved — when it opens, this is where it
          happens.
        </p>
      ) : wallet === null ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Sign in with your wallet to mint. The price you will be charged depends on what you hold,
          so it cannot be worked out until there is a wallet to ask about.
        </p>
      ) : (
        <>
          {canClaim && (
            <div className="mt-4 border border-gold/40 bg-gold/5 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-gold">
                You hold {claim!.allowance} of the first collection, so {claim!.allowance} of these
                are free.{" "}
                {claim!.taken > 0 && `You have taken ${claim!.taken} of them. `}
                {claim!.left > state.maxPerTx
                  ? `This takes ${state.maxPerTx}, which is all one transaction may mint — the rest stays yours to take afterwards.`
                  : `This takes all ${claim!.left}.`}
              </p>
              <button
                type="button"
                onClick={() => void send("claim")}
                className="glow-pump mt-3 w-full border border-gold bg-gold/10 px-4 py-3 text-[10px] tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-ground"
              >
                CLAIM {Math.min(claim!.left, state.maxPerTx)} — FREE
              </button>
            </div>
          )}

          {claim !== null && claim.left === 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Your {claim.allowance} free mints have all been taken.
            </p>
          )}

          {canBuy && (
            <div className="mt-4">
              <p className="text-[8px] tracking-[0.18em] text-faint">HOW MANY</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 3, 5, 10, 25, state.maxPerTx]
                  .filter((n, i, all) => n <= Math.min(state.maxPerTx, left) && all.indexOf(n) === i)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(n)}
                      className={cx(
                        "min-w-[3.5rem] border px-3 py-2 text-center text-[11px] tabular-nums transition-colors",
                        n === amount
                          ? "border-pump bg-pump/10 text-pump"
                          : "border-line text-muted hover:border-line-strong hover:text-fg",
                      )}
                    >
                      {n}
                    </button>
                  ))}
              </div>

              <p className="mt-4 text-[10px] tracking-[0.18em] text-faint">
                <span className="text-fg tabular-nums">
                  {inCro((BigInt(state.price) * BigInt(amount)).toString())} CRO
                </span>
                <span className="tabular-nums"> · {inCro(state.price)} a card</span>
              </p>

              <button
                type="button"
                onClick={() => void send("buy")}
                className="glow-pump mt-3 w-full border border-pump bg-pump/10 px-4 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
              >
                MINT {amount} — {inCro((BigInt(state.price) * BigInt(amount)).toString())} CRO
              </button>
            </div>
          )}

          {!canBuy && !canClaim && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              {state.claimsOpen && !state.saleOpen
                ? "Only the free mints are open, and this wallet has none. The paid mint follows."
                : "Nothing here is open to this wallet yet."}
            </p>
          )}

          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            What you mint is a numbered token, face down. Which card each number is was settled
            before this opened and the hash is further down this page — the pictures go on at the
            reveal, and until then every one of them looks the same on purpose.
          </p>
        </>
      )}

      {wrong && <p className="mt-3 text-[10px] leading-relaxed text-dump">{wrong}</p>}
    </div>
  );
}
