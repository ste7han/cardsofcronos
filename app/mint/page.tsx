import type { Metadata } from "next";
import Link from "next/link";

import { MintClosedNotice } from "@/components/MintClosedNotice";
import { MintShop } from "@/components/MintShop";
import { CROCARD_SUPPLY, HOLDER_TIERS } from "@/data/holder-tiers";
import type { Rarity } from "@/engine/types";
import { RARITIES, RULES } from "@/engine/types";
import { COPIES, HASH, SEED, TOKENS } from "@/lib/provenance";
import { RARITY } from "@/lib/rarity";
import { SET } from "@/lib/set";

export const metadata: Metadata = {
  title: "Mint — Cards of Cronos",
  description: "The cards become NFTs on Cronos. The mint is not open yet.",
};

export default function MintPage() {
  const perTier = new Map<Rarity, number>();
  for (const card of SET) perTier.set(card.rarity, (perTier.get(card.rarity) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-[10px] tracking-[0.28em] text-faint">SET 01</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">MINT</h1>
      <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-muted">
        The cards become NFTs on Cronos. What you mint you play, and what you play you own.
      </p>
      <MintClosedNotice />

      <div className="mt-10">
        <div>
          <MintShop />

          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            The moment there is a mint, it shows up here.{" "}
            <Link href="/deck" className="text-pump hover:underline">
              Until then the whole set is open to build from
            </Link>{" "}
            — nothing to buy first, because there is nothing worth buying yet.
          </p>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="display text-xl">HOLDING $CROCARD</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          One rule sits above the rest:{" "}
          <span className="text-fg">holding never changes what you may put in a deck.</span> No
          amount of token buys a card, a slot or a rule. What you deck is what you drew, and the
          odds are the same odds for everyone.
        </p>
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          That was measured before it was decided. When decks did have a points budget, one built on
          110 points beat one built on 80 in 86% of matches. Selling deck power in a game people bet
          on is not selling a stronger deck, it is selling the result of the bet. So holding buys
          economics instead, and only economics: a smaller cut out of what you win.
        </p>

        {/* Reversed: the ladder is stored highest-first because that is the order
            tierFor searches it in, and read lowest-first because that is how
            anybody reads a ladder. */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...HOLDER_TIERS].reverse().map((tier, i) => (
            <div key={tier.id} className="panel relative border border-line p-5">
              <span
                className={`absolute inset-x-0 top-0 h-px ${
                  ["bg-line-strong", "bg-line-strong", "bg-pump", "bg-gold"][i]
                }`}
              />
              <p className="display text-lg">{tier.name}</p>
              <p className="mt-1 text-[10px] tracking-[0.16em] text-faint">
                {tier.atLeast === 0
                  ? "ANY AMOUNT, INCLUDING NONE"
                  : `FROM ${tier.atLeast.toLocaleString("en-US")} · ${(
                      (tier.atLeast / CROCARD_SUPPLY) *
                      100
                    ).toFixed(2)}% OF SUPPLY`}
              </p>

              {/* A rule above and none below: with the perks gone there is
                  nothing under this to divide it from, and a trailing border
                  reads as something having been cut off. */}
              <dl className="mt-4 border-t border-line pt-3">
                <dt className="text-[8px] tracking-[0.18em] text-faint">TAKEN WHEN YOU WIN</dt>
                <dd className="display mt-1 text-2xl text-gold">
                  {Math.round(tier.cut * 100)}%
                </dd>
                <dt className="mt-3 text-[8px] tracking-[0.18em] text-faint">DECK POWER</dt>
                <dd className="display mt-1 text-2xl">SAME</dd>
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-4 max-w-2xl text-[10px] leading-relaxed text-muted">
          The winner&rsquo;s tier is the one that counts. Holding is meant to mean you keep more of
          what you win, and your stake is gone either way when you lose — so a discount on a loss
          would only ever have been a discount for the person who beat you.
        </p>

        <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-muted">
          What is taken is not all burned. A ranked match splits its cut the way a mint does — half
          of it burned, three tenths back to $CROCARD holders, a fifth into the{" "}
          <Link href="/tournament" className="text-pump hover:underline">
            weekly prize pot
          </Link>
          . None of it is divided as CRO: it buys $CROCARD first and the three shares are paid in
          the token, so the whole of what is taken goes through the market on its way out.
        </p>

        <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-gold">
          Nothing here is running yet: nothing is staked, so there is no cut to take. Anybody whose
          balance cannot be read is on the retail rate, because a discount that could not be
          verified is a discount nobody earned.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="display text-xl">THE SET IN TIERS</h2>
        <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted">
          This is how set 01 is put together. The spread is settled and the pull rates follow from
          it — they are printed beside the price.
        </p>

        <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-5">
          {RARITIES.map((rarity) => {
            const count = perTier.get(rarity) ?? 0;
            return (
              <div key={rarity} className="bg-panel px-4 py-4">
                <div className="h-[2px] w-8" style={{ background: RARITY[rarity].colour }} />
                <dt
                  className="mt-2 text-[8px] tracking-[0.16em]"
                  style={{ color: RARITY[rarity].colour }}
                >
                  {RARITY[rarity].label}
                </dt>
                <dd className="display mt-1.5 text-2xl tabular-nums">{count}</dd>
                <p className="text-[9px] text-muted">
                  {Math.round((count / SET.length) * 100)}% of the set
                </p>
              </div>
            );
          })}
        </dl>
      </section>

      {/* Which card a token turns out to be, and the proof that it was settled
          first. Published before the sale opens, because after it opens the
          order is visible and hashing something everybody can see proves
          nothing. lib/provenance.ts has why the numbers come from the file
          rather than being typed here. */}
      <section className="mt-16 border border-line bg-panel px-5 py-5">
        <h2 className="display text-xl">WHICH CARD YOU GET</h2>
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          The contract cannot draw anything. A token&rsquo;s picture is its number, so which card
          token 7 is had to be decided before anybody could buy token 7. The whole sequence was
          drawn from one seed, hashed, and the hash put here before the mint opened.
        </p>

        <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-panel px-4 py-4">
            <dt className="text-[8px] tracking-[0.18em] text-faint">SEED</dt>
            <dd className="display mt-1.5 text-2xl tabular-nums">{SEED}</dd>
          </div>
          <div className="bg-panel px-4 py-4">
            <dt className="text-[8px] tracking-[0.18em] text-faint">TOKENS</dt>
            <dd className="display mt-1.5 text-2xl tabular-nums">
              {TOKENS.toLocaleString("en-US")}
            </dd>
          </div>
          <div className="bg-panel px-4 py-4">
            <dt className="text-[8px] tracking-[0.18em] text-faint">COPIES OF EACH CARD</dt>
            <dd className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {RARITIES.map((rarity) => `${COPIES[rarity]} ${RARITY[rarity].label.toLowerCase()}`).join(
                " · ",
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border border-line px-4 py-3">
          <p className="text-[8px] tracking-[0.18em] text-faint">SHA-256 OF THE SEQUENCE</p>
          {/* Broken to the character so it can be compared by eye against a
              hash somebody computed themselves, which is the only use it has. */}
          <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-gold">{HASH}</p>
        </div>

        <p className="mt-4 max-w-2xl text-[10px] leading-relaxed text-muted">
          Check it yourself: run the shuffle again with the seed above and the file comes back byte
          for byte identical, or this promise was false. The rarities are spread evenly across the
          whole sequence before anything is shuffled, so the odds are the same whether you are the
          tenth buyer or the last — which matters because the last collection planned 1,894 and
          stopped at 515.
        </p>

        <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-gold">
          What this does not say is that the order is fair. It says it was fixed before the first
          sale and has not moved since, and those are different claims. It is also why nothing here
          can guarantee the contents of any ten tokens you happen to buy together: a sequence
          settled in advance cannot promise you a rare in the next ten, and a page that said it
          could would be lying about something checkable.
        </p>
      </section>

      {/* The update authority, said out loud.
          DESIGN.md settles that the metadata stays mutable so a picture can be
          changed if a rights holder ever objects, and that decision is only
          defensible if a buyer reads it before they mint rather than finds out
          afterwards. Everything here is what that hatch actually is and what it
          is not, including the part that is inconvenient. */}
      <section className="mt-16 border border-line bg-panel px-5 py-5">
        <h2 className="display text-xl">WHAT WE CAN CHANGE AFTER YOU MINT</h2>
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          These cards become NFTs on Cronos, and the contract keeps an owner who
          can change some of it. That is a choice and you should know it before
          you mint rather than after.
        </p>

        <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-2">
          <div className="bg-panel px-4 py-4">
            <dt className="text-[9px] tracking-[0.16em] text-dump">CAN CHANGE</dt>
            <dd className="mt-2 text-[11px] leading-relaxed text-muted">
              The picture and the name. There is one reason for it: a card whose
              art turns out to be somebody&rsquo;s property has to be able to
              come down. Without the key, it cannot, and what you own stops
              being sellable anywhere that honours a takedown.
            </dd>
            {/* The mechanism, named. The paragraph above says what can change;
                without this it is a promise about intentions, and this is the
                half somebody can go and check for themselves. */}
            <dd className="mt-3 text-[10px] leading-relaxed text-faint">
              How: the images sit on IPFS and the contract holds the address of
              the folder they are in. <span className="font-mono">setBaseURI</span>{" "}
              changes that address and only the owner can call it. Read{" "}
              <span className="font-mono">tokenURI</span> on the contract and you
              can see where yours points right now — this is not a thing you have
              to take our word for.
            </dd>
          </div>
          <div className="bg-panel px-4 py-4">
            <dt className="text-[9px] tracking-[0.16em] text-pump">WILL NOT CHANGE</dt>
            <dd className="mt-2 text-[11px] leading-relaxed text-muted">
              What the card does. Effects, stats and rarity are fixed at the
              mint. Balance goes into the next set, the way a printed card game
              does it — new cards with new numbers, old cards left alone.
            </dd>
          </div>
        </dl>

        <p className="mt-4 max-w-2xl text-[10px] leading-relaxed text-gold">
          And the part nobody puts on a mint page: this is a repair, not a
          promise. Marketplaces and wallets cache images hard and some caches
          never refresh, so a picture that has to come down can keep showing up
          in places for a long time after it is replaced. It is the answer to
          what we did not see coming, not a reason to ship art we already have
          doubts about.
        </p>

        <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-gold">
          Said plainly, because the sentence above is the polite version: a key
          exists that can change the picture on a card you own, and it is ours.
          A collection where that key had been thrown away would be a stronger
          promise than this one. We kept it, on purpose, for the takedown case —
          and you are entitled to weigh that before you buy rather than discover
          it afterwards.
        </p>
      </section>
    </div>
  );
}
