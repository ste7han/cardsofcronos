import type { Metadata } from "next";
import Link from "next/link";

import { Stats } from "@/components/Stats";
import { MARKETING_COST, RULES, TURN_ACTION_COST } from "@/engine/types";
import { formatMC } from "@/engine/format";
import { SET } from "@/lib/set";
import { STREAMS } from "@/lib/revenue";
import { HOLDER_TIERS } from "@/data/holder-tiers";

export const metadata: Metadata = {
  title: "How it works — Cards of Cronos",
  description:
    "The game in one page: ten turns, what the moves cost, and where every CRO the game earns goes.",
};

/**
 * The split, taken from the stream that defines it rather than written out.
 *
 * All three streams divide the same way, so any of them answers — and reading it
 * means a page that says 50/30/20 cannot go on saying it after somebody changes
 * the splitter and the data with it.
 */
const SHARES = STREAMS[0]!.shares;
const shareTo = (who: string) => SHARES.find((one) => one.to === who)?.percent ?? 0;

const mc = (n: number) => formatMC(n);

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-[10px] tracking-[0.28em] text-faint">THE WHOLE THING</p>
      <h1 className="display mt-2 text-3xl sm:text-4xl">HOW IT WORKS</h1>
      <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-muted">
        A trading card game on Cronos where you play {RULES.turns} turns against an opponent and the
        higher market cap wins. The cards are the chain&rsquo;s own projects. Everything the game
        earns is spent through one contract that nobody can point anywhere else.
      </p>

      {/* ── THE GAME ──────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">The match</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          You bring a deck of {RULES.deckSize} cards. Each turn you get a marketing budget — turn one
          gives you {mc(RULES.budgetPerTurn)}, turn {RULES.turns} gives you{" "}
          {mc(RULES.budgetPerTurn * RULES.turns)} — and you spend it putting projects on your board.
          A project pays its launch value once and then pays again every turn you leave it standing,
          so a card played early keeps earning for the rest of the match.
        </p>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          The budget does not carry over. Whatever you fail to spend comes off your market cap when
          the turn ends, which is what makes an expensive card genuinely unplayable early rather than
          merely slower.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-line text-[9px] tracking-[0.18em] text-faint">
                <th className="py-2 pr-4 text-left font-normal">MOVE</th>
                <th className="py-2 pr-4 text-left font-normal">COSTS</th>
                <th className="py-2 text-left font-normal">WHAT IT DOES</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-line">
                <td className="py-3 pr-4 text-fg">Play a project</td>
                <td className="py-3 pr-4 tabular-nums whitespace-nowrap">
                  {mc(MARKETING_COST.common)}–{mc(MARKETING_COST.mythic)}
                </td>
                <td className="py-3 leading-relaxed">
                  By rarity. You hold {RULES.portfolioSize} projects at a time.
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3 pr-4 text-fg">Take profit</td>
                <td className="py-3 pr-4 tabular-nums whitespace-nowrap">
                  {mc(TURN_ACTION_COST)} + one play
                </td>
                <td className="py-3 leading-relaxed">
                  Closes a position and banks everything it earned. Banked money cannot be rugged.
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3 pr-4 text-fg">Upgrade</td>
                <td className="py-3 pr-4 whitespace-nowrap">One play</td>
                <td className="py-3 leading-relaxed">
                  A bigger card of the same project takes the position over, keeping what it earned
                  and inheriting what it was pumping.
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3 pr-4 text-fg">Attack</td>
                <td className="py-3 pr-4 whitespace-nowrap">By rarity</td>
                <td className="py-3 leading-relaxed">
                  Rugs, damage and FUD take a position&rsquo;s holders — and a damaged position pays
                  proportionally less.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-2xl text-[12px] leading-relaxed text-muted">
          That tension is the game: a position left standing keeps earning and can be taken from you;
          a position you bank is safe and stops earning. Set 01 is {SET.length} cards.
        </p>
      </section>

      {/* ── THE MONEY ─────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">Where the money goes</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          Three things earn: card sales, secondary royalties, and the cut on ranked matches. All
          three land in the same contract, and all three are divided the same way. The CRO buys
          $CROCARD on the market first, so the buying and the paying out are the same act — there is
          no step where somebody decides whether to buy this week.
        </p>

        <div className="mt-6 border border-line bg-panel p-5">
          <p className="text-[9px] tracking-[0.22em] text-faint">
            EVERYTHING THE GAME EARNS, IN CRO
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STREAMS.map((stream) => (
              <span
                key={stream.id}
                className="border border-line-strong px-3 py-1.5 text-[10px] text-muted"
              >
                {stream.id === "rake" ? "Ranked match cut" : stream.id}
              </span>
            ))}
          </div>

          <p className="my-5 text-center text-[10px] tracking-[0.2em] text-primary">
            ↓ &nbsp; BUYS $CROCARD, THEN DIVIDES IT &nbsp; ↓
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border border-line bg-panel-raised px-4 py-4">
              <p className="display text-2xl tabular-nums text-dump">{shareTo("burn")}%</p>
              <p className="mt-2 text-[9px] tracking-[0.18em] text-muted">BURNED</p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Sent to the dead address. Nothing comes back.
              </p>
            </div>
            <div className="border border-line bg-panel-raised px-4 py-4">
              <p className="display text-2xl tabular-nums text-pump">{shareTo("holders")}%</p>
              <p className="mt-2 text-[9px] tracking-[0.18em] text-muted">TO HOLDERS</p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Shared by what each wallet holds, claimable whenever.
              </p>
            </div>
            <div className="border border-line bg-panel-raised px-4 py-4">
              <p className="display text-2xl tabular-nums text-gold">{shareTo("tournament")}%</p>
              <p className="mt-2 text-[9px] tracking-[0.18em] text-muted">WEEKLY PRIZE</p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Played for every week on the leaderboards.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-[12px] leading-relaxed text-muted">
          The destinations and the shares were fixed when the contract was deployed. There is no
          setter for either, so changing the split means deploying a new splitter and pointing the
          revenue at it, in public. Anyone can set it going: the call takes no arguments and has no
          owner check, so running it is paying the gas rather than making a decision.
        </p>
      </section>

      {/* ── HOLDING ───────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">What holding the token does</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          $CROCARD is not only a share of the revenue. It discounts the mint and lowers the cut you
          pay on a ranked match, on the same ladder.
        </p>
        {/* Read from data/holder-tiers.ts, which is where the ladder lives and
            what both the mint discount and the match cut are taken from. Typed
            out here, this table would go on promising 30% off after somebody
            moved it — and it is a promise people hold the token for. */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-line text-[9px] tracking-[0.18em] text-faint">
                <th className="py-2 pr-4 text-left font-normal">HOLD</th>
                <th className="py-2 pr-4 text-left font-normal">OFF THE MINT</th>
                <th className="py-2 text-left font-normal">RANKED CUT</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-muted">
              {[...HOLDER_TIERS].reverse().map((tier) => (
                <tr key={tier.id} className="border-b border-line">
                  <td className="py-2.5 pr-4 text-fg">
                    {tier.atLeast === 0
                      ? "Nothing"
                      : tier.atLeast.toLocaleString("en-US")}
                  </td>
                  <td className="py-2.5 pr-4">{tier.off === 0 ? "—" : `${tier.off}%`}</td>
                  <td className="py-2.5">{Math.round(tier.cut * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-muted">
          The cut is read when the pot is paid rather than when a winner is named, so buying more
          between the two counts in your favour. The ladder is fixed in the contract with no setter:
          a cut somebody can be moved onto after they staked is not a deal.
        </p>
      </section>

      {/* ── THE DROP ──────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">Getting paid, and the day it waits</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          The holders&rsquo; share accumulates in a contract and is shared out by a nightly job. What
          a wallet has earned only ever goes up, and one claim collects all of it — there is no
          window to miss and nothing expires.
        </p>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          A proposed share-out does not count immediately. It is published and waits a full day
          before the contract will adopt it, in the open, during which it can be thrown away in one
          transaction. That delay is the whole answer to a key living on a server: stolen, it costs
          one proposal that can be discarded, and the contract cannot promise more than has actually
          arrived in it. The weekly prize works the same way — the key that names winners cannot
          withdraw, cannot reopen a closed week, and cannot reach a balance.
        </p>
      </section>

      {/* ── THE NUMBERS ───────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="display text-xl text-gold">Where it stands</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          Read from the chain every time this page is opened, so none of it can quietly go stale.
        </p>
        <Stats />
      </section>

      {/* ── THE KEYS ──────────────────────────────────────────────────────── */}
      <section className="mt-14 border-t border-line pt-10">
        <h2 className="display text-xl text-gold">What the keys can do</h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          Every contract here has a key attached, and pretending otherwise is how people get hurt.
          Each power is named on the{" "}
          <Link href="/contracts" className="text-pump hover:underline">
            contracts page
          </Link>
          , including the rescue hatches — which are the most dangerous things there and therefore
          the ones most worth naming. A test checks each claim against the Solidity it describes, so
          a power added and not disclosed fails the build.
        </p>
      </section>
    </main>
  );
}
