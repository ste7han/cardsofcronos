"use client";

// What you can mint: cards, at one price each.
//
//   a card        15 CRO, at the printed odds, nothing promised
//
// The price is settled and lives in lib/revenue.ts with the split it pays into —
// one file, because a price on a button and a price in the design notes is two
// chances to be wrong.
//
// ── THERE WAS A PACK HERE ────────────────────────────────────────────────────
//
// Ten cards for 100 CRO where ten singles were 150, and what the third off was
// buying was a floor: one slot guaranteed rare or better. It went in September
// 2026, and not because of the price.
//
// Which card each token is was settled before the mint opened and published as a
// hash. A sequence fixed in advance cannot promise what is inside any ten tokens
// somebody buys together, and the contract has nothing in it that draws —
// `buy(amount)` mints the next `amount` in the published order and multiplies
// the price. So the floor could not have been honoured and the discount could
// not have been charged. What is left is the half that was always true: a number
// of cards at the printed odds.
//
// ── WHAT IS STILL MISSING ────────────────────────────────────────────────────
//
// The transaction. The contract is deployed and both its doors are shut, so
// nothing here charges anybody, and the page says so rather than pretending. A
// price that cannot be paid is worth printing; a button that looks like it
// charges you is not. The collection is local to this browser, which is also
// temporary and also said out loud, because a player who builds a collection and
// loses it to a cleared cache will not come back.

import { useEffect, useState } from "react";

import { CardsOpening } from "@/components/CardsOpening";
import { MintOnChain } from "@/components/MintOnChain";
import { PULL_WEIGHTS } from "@/engine/draw";
import { RARITIES } from "@/engine/types";
import { MINT_OPEN, buyCards, collectionProgress, type Bought } from "@/lib/collection";
import { DISCOUNT_CAP, MAX_PER_TX, MINT_PRICE_CRO, heldFor, priceHolding } from "@/lib/revenue";
import { useSession } from "@/lib/use-session";
import { cx } from "@/lib/cx";
import { RARITY } from "@/lib/rarity";

const TOTAL_WEIGHT = RARITIES.reduce((sum, r) => sum + PULL_WEIGHTS[r], 0);

/**
 * The quantities offered.
 *
 * Buttons rather than a free number field. Every one of these is a real quantity
 * the contract accepts, so there is no way to land on one it would reject and
 * find out after signing. Ten is where it sits by default because that is what a
 * handful of cards used to cost as a pack, and it is enough draws to see the
 * odds do something.
 */
const AMOUNTS = [1, 3, 5, 10, 25, MAX_PER_TX] as const;

export function MintShop() {
  // The public switch or the one wallet that gets in early. Everything below
  // reads this rather than MINT_OPEN, so the admin sees the mint as it will be
  // rather than a special version of it.
  const { admin } = useSession();
  const open = MINT_OPEN || admin;

  const [amount, setAmount] = useState<number>(10);
  const [progress, setProgress] = useState<{
    owned: number;
    total: number;
    cards: number;
  } | null>(null);
  const [opening, setOpening] = useState<string[] | null>(null);
  const [short, setShort] = useState<string | null>(null);

  // After mount, not during render: the collection lives in localStorage, and a
  // server render that guesses at it is a hydration mismatch waiting to happen.
  useEffect(() => setProgress(collectionProgress()), []);

  function mint() {
    // Unreachable while the mint is shut — the button is not rendered. Kept
    // because "unreachable" is a claim about today's markup, and buyCards throws
    // anyway.
    if (!open) return;
    setShort(null);
    const { cardIds, asked }: Bought = buyCards(amount);
    if (cardIds.length < asked) {
      // Never quietly. A short mint at full price is the kind of thing a player
      // finds out about from somebody else. It should now be unreachable — a
      // draw runs against the whole set — which is exactly why it stays.
      setShort(`That should have been ${asked} cards and it was ${cardIds.length}. Tell the maker.`);
    }
    setOpening(cardIds);
  }

  return (
    <div>
      <div className="panel border border-line p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-lg">CARDS</h2>
          <span className="display text-2xl tabular-nums text-gold">
            {MINT_PRICE_CRO} CRO
            <span className="ml-1 text-[10px] tracking-[0.18em] text-faint">A CARD</span>
          </span>
        </div>
        <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted">
          Buy as many as you like, up to {MAX_PER_TX} in one go. Every card is drawn at the printed
          odds below and nothing is promised on top of them — there is no pack and no floor, because
          the order the cards come out in was settled before the mint opened and no contract can
          reach into a fixed sequence to find you a rare.
        </p>

        <div className="mt-5">
          <p className="text-[8px] tracking-[0.18em] text-faint">HOW MANY</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AMOUNTS.map((n) => (
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
        </div>

        {/* The price is printed even though nothing charges for it yet. A
            product whose cost is a question mark is not a product, and the
            button below says plainly that today it takes nothing. */}
        <p className="mt-4 text-[10px] tracking-[0.18em] text-faint">
          <span className="text-fg tabular-nums">{amount * MINT_PRICE_CRO} CRO</span>
          <span className="tabular-nums">
            {" "}
            · {amount} {amount === 1 ? "card" : "cards"}
          </span>
          <span> · before the $CROCARD discount</span>
        </p>

        {/* What that discount is, in the numbers somebody would have to act on.
            It said "before the $CROCARD discount" and nowhere what the discount
            was, which is a price with a footnote and no note. */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[8px] tracking-[0.18em] text-faint">
            HOLDING $CROCARD MAKES IT CHEAPER
          </p>
          <p className="mt-2 max-w-xl text-[10px] leading-relaxed text-muted">
            One percent off per whole million you hold, up to {DISCOUNT_CAP}%. The contract counts
            in whole millions, so {(1_000_000 - 1).toLocaleString("en-US")} is the retail price and
            not a fraction off it — and above{" "}
            {heldFor(DISCOUNT_CAP)!.toLocaleString("en-US")} nothing more comes off.
          </p>

          <dl className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-4">
            {[0, 1_000_000, 10_000_000, heldFor(DISCOUNT_CAP)!].map((held) => (
              <div key={held} className="bg-panel px-3 py-3">
                <dt className="text-[8px] tracking-[0.16em] text-faint">
                  {held === 0
                    ? "UNDER A MILLION"
                    : `${(held / 1_000_000).toLocaleString("en-US")}M HELD`}
                </dt>
                <dd
                  className={cx(
                    "display mt-1 text-lg tabular-nums",
                    held === heldFor(DISCOUNT_CAP) ? "text-gold" : "text-fg",
                  )}
                >
                  {priceHolding(held)} CRO
                </dd>
                <p className="text-[9px] text-muted">
                  {held === 0
                    ? "retail"
                    : `${Math.round(100 - (priceHolding(held) / MINT_PRICE_CRO) * 100)}% off`}
                </p>
              </div>
            ))}
          </dl>

          <p className="mt-3 max-w-xl text-[10px] leading-relaxed text-muted">
            It is the same formula the first collection used and it is read off the chain, not off
            this page: connect a wallet and the panel below quotes what you will actually be
            charged. A balance that cannot be read is on the retail rate, because a discount nobody
            can verify is a discount nobody earned.
          </p>
        </div>

        {open ? (
          <button
            type="button"
            onClick={mint}
            disabled={progress === null}
            className={cx(
              "mt-5 w-full border px-4 py-3 text-[10px] tracking-[0.18em] transition-colors",
              "glow-pump border-pump bg-pump/10 text-pump hover:bg-pump hover:text-ground",
              "disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none",
            )}
          >
            {admin && !MINT_OPEN ? "MINT — ADMIN" : "MINT — FREE FOR NOW"}
          </button>
        ) : (
          // A plate rather than a greyed-out button. A disabled button still
          // reads as "not yet for you"; this one has to read as "not yet for
          // anybody", which is the honest state.
          <p className="mt-5 w-full border border-line-strong px-4 py-3 text-center text-[10px] tracking-[0.18em] text-faint">
            NOT OPEN
          </p>
        )}
      </div>

      <MintOnChain />

      <div className="panel mt-4 border border-line p-6">
        <h3 className="text-[10px] tracking-[0.18em] text-faint">THE ODDS, PER CARD DRAWN</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          One table, and it holds however much you already own. Every draw is against the whole set,
          so a card you have can come out again — a second copy is something to trade, not something
          to deck, because a deck still takes one of each. Odds that stop being true once your
          collection fills up are not odds.
        </p>

        <dl className="mt-4 grid grid-cols-5 gap-px border border-line bg-line">
          {RARITIES.map((rarity) => (
            <div key={rarity} className="bg-panel px-2 py-3 text-center">
              <div className="mx-auto h-[2px] w-6" style={{ background: RARITY[rarity].colour }} />
              <dt
                className="mt-2 text-[7px] tracking-[0.12em]"
                style={{ color: RARITY[rarity].colour }}
              >
                {RARITY[rarity].label}
              </dt>
              <dd className="display mt-1 text-sm tabular-nums">
                {((PULL_WEIGHTS[rarity] / TOTAL_WEIGHT) * 100).toFixed(0)}%
              </dd>
            </div>
          ))}
        </dl>

        {progress !== null && open && (
          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            You hold <span className="text-fg tabular-nums">{progress.cards}</span> cards, covering{" "}
            <span className="text-fg tabular-nums">
              {progress.owned} of {progress.total}
            </span>{" "}
            in the set. These are free and kept in this browser until there is a mint to hang them
            on — this is the ceremony and the odds, not the economy.
          </p>
        )}

        {progress !== null && !open && progress.cards > 0 && (
          // Anyone who drew cards while this was live still has them. Saying so
          // is better than letting them wonder where they went — and they are
          // still in their browser, untouched.
          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            You drew cards while this was running and those{" "}
            <span className="text-fg tabular-nums">{progress.cards}</span> are still in this
            browser. They were never on a chain and they carry no claim on the real mint. Nothing
            was taken away — there is just nothing more to open until the mint is real.
          </p>
        )}

        {short && <p className="mt-3 text-[10px] leading-relaxed text-dump">{short}</p>}
      </div>

      {opening && (
        <CardsOpening
          cardIds={opening}
          onDone={() => {
            setOpening(null);
            setProgress(collectionProgress());
          }}
        />
      )}
    </div>
  );
}
