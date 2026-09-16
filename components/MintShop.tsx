"use client";

// The two things you can mint.
//
//   one card      15 CRO, at the printed odds, nothing promised
//   a pack        100 CRO for ten, one of them rare or better
//
// The prices are settled and live in lib/revenue.ts with the split they pay
// into — one file, because a price on a button and a price in the design notes
// is two chances to be wrong. What is still missing is the transaction: there is
// no mint and nothing to sign, so nothing here actually charges anybody, and the
// page says so rather than pretending. A price that cannot be paid is worth
// printing; a button that looks like it charges you is not.
//
// The collection is local to this browser. That is also temporary and also said
// out loud, because a player who builds a collection and loses it to a cleared
// cache will not come back.
//
// And right now nothing here mints at all: MINT_OPEN is off. What survives is
// what a product is and what the odds are, because that is worth reading before
// there is anything to buy. What goes is the button, since a free rehearsal that
// looks like the real thing teaches players to own something that is not there.

import { useEffect, useState } from "react";

import { PackOpening, type PackKind } from "@/components/PackOpening";
import { PULL_WEIGHTS } from "@/engine/draw";

import { PACK_SIZE } from "@/engine/pack";
import { RARITIES } from "@/engine/types";
import { MINT_OPEN, buyPack, buySingle, collectionProgress, type PackResult } from "@/lib/collection";
import { MINT_OPTIONS } from "@/lib/revenue";
import { useSession } from "@/lib/use-session";
import { cx } from "@/lib/cx";
import { RARITY } from "@/lib/rarity";

const TOTAL_WEIGHT = RARITIES.reduce((sum, r) => sum + PULL_WEIGHTS[r], 0);

type Product = {
  id: PackKind;
  name: string;
  size: number;
  /** List price in whole CRO, before the $CROCARD discount. */
  cro: number;
  blurb: string;
  promise: string;
  buy: () => PackResult;
};

/** The price this product is sold at, from the file the split is in. */
const priceOf = (id: "single" | "pack"): number =>
  MINT_OPTIONS.find((option) => option.id === id)!.cro;

const PRODUCTS: Product[] = [
  {
    id: "single",
    name: "ONE CARD",
    size: 1,
    cro: priceOf("single"),
    blurb: "One card at the printed odds. The cheapest way in, and the only one with no floor.",
    promise: "Nothing promised. One card is what the odds say it is.",
    buy: buySingle,
  },
  {
    id: "pack",
    name: "PACK",
    size: PACK_SIZE,
    cro: priceOf("pack"),
    blurb: "The one you open for the pull. Ten cards and whatever the odds hand you.",
    promise: "One slot guaranteed rare or better. The rest is the table.",
    buy: buyPack,
  },
];

export function MintShop() {
  // The public switch or the one wallet that gets in early. Everything below
  // reads this rather than MINT_OPEN, so the admin sees the mint as it will be
  // rather than a special version of it.
  const { admin } = useSession();
  const open = MINT_OPEN || admin;

  const [progress, setProgress] = useState<{
    owned: number;
    total: number;
    cards: number;
  } | null>(null);
  const [opening, setOpening] = useState<{ kind: PackKind; cardIds: string[] } | null>(null);
  const [short, setShort] = useState<string | null>(null);

  // After mount, not during render: the collection lives in localStorage, and a
  // server render that guesses at it is a hydration mismatch waiting to happen.
  useEffect(() => setProgress(collectionProgress()), []);

  function mint(product: Product) {
    // Unreachable while the mint is shut — the button is not rendered. Kept
    // because "unreachable" is a claim about today's markup, and buyPack throws
    // anyway.
    if (!open) return;
    setShort(null);
    const { cardIds, asked } = product.buy();
    if (cardIds.length < asked) {
      // Never quietly. A short mint at full price is the kind of thing a player
      // finds out about from somebody else. It should now be unreachable — a
      // draw runs against the whole set — which is exactly why it stays.
      setShort(`That should have been ${asked} cards and it was ${cardIds.length}. Tell the maker.`);
    }
    setOpening({ kind: product.id, cardIds });
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {PRODUCTS.map((product) => (
          <div key={product.id} className="panel flex flex-col border border-line p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-lg">{product.name}</h2>
              <span className="display text-2xl tabular-nums text-gold">{product.size}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{product.blurb}</p>
            <p className="mt-2 text-[10px] leading-relaxed text-pump">{product.promise}</p>

            {/* The price is printed even though nothing charges for it yet. A
                product whose cost is a question mark is not a product, and the
                button below says plainly that today it takes nothing. */}
            <p className="mt-4 text-[10px] tracking-[0.18em] text-faint">
              <span className="text-fg tabular-nums">{product.cro} CRO</span>
              {product.size > 1 ? (
                <span className="tabular-nums"> · {product.cro / product.size} a card</span>
              ) : null}
              <span> · before the $CROCARD discount</span>
            </p>

            <div className="flex-1" />

            {open ? (
              <button
                type="button"
                onClick={() => mint(product)}
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
        ))}
      </div>

      <div className="panel mt-4 border border-line p-6">
        <h3 className="text-[10px] tracking-[0.18em] text-faint">THE ODDS, PER CARD DRAWN</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          One table for both products, and it holds however much you already own. Every draw is
          against the whole set, so a card you have can come out again — a second copy is something
          to trade, not something to deck, because a deck still takes one of each. Odds that stop
          being true once your collection fills up are not odds.
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
            in the set. Both products are free and kept in this browser until there is a mint to hang
            them on — this is the ceremony and the odds, not the economy.
          </p>
        )}

        {progress !== null && !open && progress.cards > 0 && (
          // Anyone who opened a pack while this was live still has one. Saying so
          // is better than letting them wonder where it went — and it is still
          // in their browser, untouched.
          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            You opened packs while this was running and those{" "}
            <span className="text-fg tabular-nums">{progress.cards}</span> cards are still in this
            browser. They were never on a chain and they carry no claim on the real mint. Nothing
            was taken away — there is just nothing more to open until the mint is real.
          </p>
        )}

        {short && <p className="mt-3 text-[10px] leading-relaxed text-dump">{short}</p>}
      </div>

      {opening && (
        <PackOpening
          kind={opening.kind}
          cardIds={opening.cardIds}
          onDone={() => {
            setOpening(null);
            setProgress(collectionProgress());
          }}
        />
      )}
    </div>
  );
}
