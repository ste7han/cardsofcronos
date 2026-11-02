import type { Metadata } from "next";
import Link from "next/link";

import { PartnerApply } from "@/components/PartnerApply";
import { CROCARD_SUPPLY, HOLDER_TIERS } from "@/data/holder-tiers";
import { CARDS_PER_SET, MINTS_PER_SET, PRICE_MULTIPLE, TO_PARTNER_PERCENT } from "@/data/partner-sets";
import { RULES } from "@/engine/types";
import { GAME_SHARES, PARTNER_PRICE_CRO, partnerPrice, toPartner } from "@/lib/partners";
import { MINT_PRICE_CRO } from "@/lib/revenue";
import { SET } from "@/lib/set";

export const metadata: Metadata = {
  title: "For projects — Cards of Cronos",
  description:
    "A set of cards about your project, in a game people play on Cronos. Half of what it mints goes to you.",
};

/** Every number on this page comes from data/partner-sets.ts or lib/revenue.ts. */
const cro = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} CRO`;

const SHARE_NAMES: Record<string, string> = {
  burn: "bought and burned as $CROCARD",
  holders: "to $CROCARD holders",
  tournament: "into the weekly prize pot",
};

/** The ladder lowest first, the way anybody reads one. */
const RUNGS = [...HOLDER_TIERS].reverse();

/** "0.01%" for a ten-thousandth of the supply. */
const shareOfSupply = (atLeast: number) => `${+((atLeast / CROCARD_SUPPLY) * 100).toPrecision(2)}%`;

/** Not decided is a state, and the page says so rather than inventing a number. */
const orOpen = (value: number | null, unit: string) =>
  value === null ? "To be decided together" : `${value.toLocaleString("en-US")} ${unit}`;

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-[10px] tracking-[0.28em] text-faint">FOR PROJECTS ON CRONOS</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">YOUR PROJECT, AS A SET</h1>
      <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-muted">
        Cards of Cronos is a trading card game where the cards are the chain&rsquo;s own projects.
        We make a set about yours — your token, your people, your products — and mint it as NFTs
        that are played like any other card. Half of what the mint brings in goes to you.
      </p>

      {/* ── WHAT YOU GET ──────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">What is in it for you</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Benefit title="A set of your own">
            Cards about your project, made with you, released as a mint of their own. Every one of
            them is tied to your project, and every match they are played in puts it in front of
            the people playing.
          </Benefit>
          <Benefit title={`${TO_PARTNER_PERCENT}% of the mint, in CRO`}>
            A card costs {cro(PARTNER_PRICE_CRO)} and {cro(toPartner(PARTNER_PRICE_CRO))} of that is
            yours. No fee to take part, nothing to pay up front.
          </Benefit>
          <Benefit title="A reason to hold your token">
            Holding your token earns the same mint discount holding $CROCARD does. Your community
            buys your cards cheaper than anybody else — and anybody who wants that discount has a
            reason to buy into you.
          </Benefit>
          <Benefit title="Played, not just collected">
            Your cards go in a deck next to the {SET.length} cards of Set 01. A deck is{" "}
            {RULES.deckSize} cards and can mix both, so your set meets the players who are already
            here rather than waiting for its own.
          </Benefit>
        </div>
      </section>

      {/* ── THE TERMS ─────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">The terms</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <tbody className="text-muted">
              <Term name="Price per card">
                {cro(PARTNER_PRICE_CRO)} — {PRICE_MULTIPLE === 2 ? "twice" : `${PRICE_MULTIPLE}×`}{" "}
                a Set 01 card ({cro(MINT_PRICE_CRO)}), before any discount.
              </Term>
              <Term name="To your project">
                {TO_PARTNER_PERCENT}% of every card minted. At list price that is{" "}
                {cro(toPartner(PARTNER_PRICE_CRO))} a card.
              </Term>
              <Term name="The other half">
                Goes where every CRO this game earns goes:{" "}
                {GAME_SHARES.map((share) => `${share.percent}% ${SHARE_NAMES[share.to] ?? share.to}`).join(
                  ", ",
                )}
                . <Link href="/how-it-works" className="text-pump hover:underline">How that works</Link>.
              </Term>
              <Term name="Holder discount">
                Holding $CROCARD or your token. The rungs are the same share of each token&rsquo;s
                supply, and whichever puts a buyer higher counts.
              </Term>
              <Term name="Different cards in a set">{orOpen(CARDS_PER_SET, "cards")}</Term>
              <Term name="Cards minted">{orOpen(MINTS_PER_SET, "in total")}</Term>
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {RUNGS.map((tier) => (
            <div key={tier.id} className="panel border border-line p-4">
              <p className="display text-base">{tier.name}</p>
              <p className="mt-1 text-[9px] tracking-[0.16em] text-faint">
                {tier.atLeast === 0 ? "ANY AMOUNT" : `${shareOfSupply(tier.atLeast)} OF A SUPPLY`}
              </p>
              <p className="mt-3 text-lg text-fg tabular-nums">{cro(partnerPrice(tier.off))}</p>
              <p className="text-[10px] text-muted">
                {tier.off === 0 ? "list price" : `${tier.off}% off`} · {cro(toPartner(partnerPrice(tier.off)))} to you
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT GOES ───────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">How it goes</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["Apply", "Tell us about the project below. It takes two minutes and commits you to nothing."],
            ["Talk", "We get in touch, and decide together what the set is about and what goes on its cards."],
            ["Build", "We design and balance the cards, so they play fairly against everything already in the game."],
            ["Mint", "The set goes on sale here. Your half is counted from the first card."],
          ].map(([title, text], at) => (
            <li key={title} className="panel border border-line p-4">
              <p className="text-[9px] tracking-[0.22em] text-faint">STEP {at + 1}</p>
              <p className="display mt-1 text-base">{title}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── APPLY ─────────────────────────────────────────────────────────── */}
      <section id="apply" className="mt-14 scroll-mt-24">
        <h2 className="display text-xl text-gold">Apply</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          Projects building on Cronos, with a community that would play. A token is not required —
          without one, the $CROCARD discount is the only one on your set.
        </p>
        <div className="mt-5">
          <PartnerApply />
        </div>
      </section>
    </div>
  );
}

function Benefit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel relative border border-line p-5">
      <span className="absolute inset-x-0 top-0 h-px bg-gold" />
      <p className="display text-lg">{title}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line">
      <td className="py-3 pr-4 align-top whitespace-nowrap text-fg">{name}</td>
      <td className="py-3 leading-relaxed">{children}</td>
    </tr>
  );
}
