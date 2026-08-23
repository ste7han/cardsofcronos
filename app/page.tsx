import Link from "next/link";

import { CardView } from "@/components/CardView";
import { BurnStrip } from "@/components/BurnStrip";
import { ContractAddress } from "@/components/ContractAddress";
import { HeroCards } from "@/components/HeroCards";
import { Tickertape } from "@/components/Tickertape";
import { RULES } from "@/engine/types";
import { SET } from "@/lib/set";

/**
 * The five cards on the landing page. The first three are the ones in the window.
 *
 * Exported so a test can check they are real, which is how this should have been
 * caught: the ids went stale when PNUT became eight cards and nothing said so
 * until `next build` refused to prerender the front page.
 *
 * The three in the window are drawn from the families that have painted art —
 * procedural candles are fine in a gallery of six hundred and are the wrong thing
 * to lead with. A test keeps them that way, because art is resolved by filename
 * and a renamed file would quietly drop the front page back to generated charts.
 *
 * One card each from WIF, RUG PULL and MOODENG, and deliberately three different
 * rarities: the frame changes with the tier, so mythic, legendary and epic side
 * by side show what the set looks like rather than three of the same.
 *
 * The order is the banner's too — scripts/banner.ts imports this list, so the
 * profile header and the front page always lead with the same cards in the same
 * order. Reordering here reorders both, which is the point of there being one
 * list rather than two.
 */
export const SHOWCASE = [
  "dak-again",
  "howlers-moon",
  "crooks-cover",
  "rug-pull",
  "founder-dak",
];

export default function Landing() {
  const featured = SHOWCASE.map((id) => {
    const card = SET.find((c) => c.id === id);
    if (!card) throw new Error(`Showcase card "${id}" is not in the set.`);
    return card;
  });

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-20 pb-14 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-6">
        <div>
          <p className="flex items-center gap-2.5 text-[10px] tracking-[0.28em] text-faint">
            <span className="breathe h-1.5 w-1.5 bg-pump" />
            CRONOS · SET 01 · $CROCARD
          </p>

          {/* Sized so "AS A CARD GAME." stays on one line next to the card fan;
              at text-7xl it wraps and the heading falls apart into three lines. */}
          <h1 className="display mt-5 text-5xl sm:text-6xl 2xl:text-7xl">
            <span className="block">CRONOS,</span>
            {/* Gold rather than green. Green is the up-arrow on this site and
                gold is what the first version put every heading in. */}
            <span className="gold-gradient block">AS A CARD GAME.</span>
          </h1>

          <p className="mt-7 max-w-xl text-[12px] leading-relaxed text-muted">
            The projects you watched come and go, the tactics you used and the names you know.{" "}
            {RULES.turns} turns, a marketing budget that grows every one of them. Highest market
            cap wins.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/play"
              className="glow-pump border border-pump bg-pump/10 px-6 py-3 text-[10px] tracking-[0.2em] text-pump transition-colors hover:bg-pump hover:text-ground"
            >
              PLAY THE MARKET
            </Link>
            <Link
              href="/cards"
              className="border border-line-strong px-6 py-3 text-[10px] tracking-[0.2em] text-muted transition-colors hover:border-gold hover:text-gold"
            >
              SEE THE SET
            </Link>
            <ContractAddress />
          </div>

          <dl className="panel mt-12 grid max-w-2xl grid-cols-2 border border-line sm:grid-cols-4">
            <Figure label="CARDS" value={String(SET.length)} />
            <Figure label="TURNS" value={String(RULES.turns)} />
            <Figure label="BUDGET" value={`${RULES.budgetPerTurn / 1000}K–${(RULES.budgetPerTurn * RULES.turns) / 1000}K`} />
            <Figure label="WINS" value="highest MC" last />
          </dl>
        </div>

        <div className="hidden lg:block">
          <HeroCards cards={featured.slice(0, 3)} />
        </div>
      </section>

      <Tickertape />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Heading above="THE CORE" title="HOW IT WORKS" />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Step
            number="01"
            title="LAUNCH"
            tone="pump"
            text="Play a project from your hand. The launch MC lands on your market cap right away, and the project takes a position in your portfolio."
          />
          <Step
            number="02"
            title="PUMP"
            tone="gold"
            text="At the end of your turn every position in your portfolio adds its pump to your MC. Six positions, so opening one means closing another."
          />
          <Step
            number="03"
            title="RUG"
            tone="dump"
            text="Snipe, FUD and Rug Pull strip holders off their projects. At zero the project rugs — off the table, and the pump stops for good."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex items-end justify-between gap-4">
          <Heading
            above="SET 01"
            title="FROM THE SET"
            below={`Five of ${SET.length}. The rules text on every card is generated from the effect the engine runs, so what it says is what happens.`}
          />
          <Link
            href="/cards"
            className="shrink-0 text-[10px] tracking-[0.18em] text-muted transition-colors hover:text-gold"
          >
            ALL {SET.length} →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {featured.map((card) => (
            <CardView key={card.id} card={card}  />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="panel border border-line p-8">
          <Heading above="$CROCARD" title="TOKEN AND BURN" />
          {/* This paragraph said the split was still open. It is not any more —
              only the size of the cut on a staked match is, and saying "still
              open" about a thing that has been decided is how a page stops being
              worth reading. */}
          <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted">
            <span className="text-fg">Four things earn, and most of it burns.</span> Three quarters
            of every paid mint and every royalty, a quarter of the pump.fun creator fee, and all of
            the cut on a staked match. Every buy-and-burn runs through one wallet, so it lands
            somewhere anybody can watch.
          </p>
          <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
            What that cut on a staked match is has not been decided. Nothing is staked yet and
            nothing is taken — until then the game runs entirely in your browser. No wallet needed,
            nothing on-chain.
          </p>

          <BurnStrip />

          <dl className="mt-3 grid border border-line sm:grid-cols-3">
            <Figure label="TICKER" value="$CROCARD" />
            <Figure label="LAUNCH" value="pump.fun" />
            <Figure label="BURN" value="every match" last />
          </dl>
        </div>
      </section>
    </>
  );
}

function Heading({ above, title, below }: { above: string; title: string; below?: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.28em] text-faint">{above}</p>
      <h2 className="display mt-2 text-2xl sm:text-3xl">{title}</h2>
      {below && <p className="mt-3 max-w-lg text-[11px] leading-relaxed text-muted">{below}</p>}
    </div>
  );
}

function Figure({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "px-5 py-4" : "border-r border-line px-5 py-4"}>
      <dt className="text-[8px] tracking-[0.2em] text-faint">{label}</dt>
      <dd className="display mt-1.5 text-base">{value}</dd>
    </div>
  );
}

function Step({
  number,
  title,
  text,
  tone,
}: {
  number: string;
  title: string;
  text: string;
  tone: "pump" | "gold" | "dump";
}) {
  const colour = { pump: "text-pump", gold: "text-gold", dump: "text-dump" }[tone];
  const line = { pump: "bg-pump", gold: "bg-gold", dump: "bg-dump" }[tone];

  return (
    <div className="panel relative border border-line p-6">
      <span className={`absolute inset-x-0 top-0 h-px ${line}`} />
      <p className={`text-[10px] tracking-[0.2em] ${colour}`}>{number}</p>
      <h3 className="display mt-3 text-xl">{title}</h3>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}
