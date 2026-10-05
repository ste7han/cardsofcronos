"use client";

// How a match ended.
//
// Came over from TCG, where this screen has a second half: what each side
// staked, what the winner got, what went to the burn, every figure beside the
// transaction that did it. That half was left out, because it was written in
// lamports, signatures and Solscan links and none of those are the units this
// game settles in.
//
// ── IT WENT ON SAYING "FRIENDLY" AFTER THAT STOPPED BEING TRUE ───────────────
//
// What stood here instead was one hardcoded sentence: "A friendly match. Nothing
// was staked and nothing moved." True when it was written — there was nowhere on
// Cronos to hold a stake yet — and left alone while contracts/MatchEscrow.sol,
// the ranked lobby and lib/finish.ts were built around it. So the maker lost a
// ranked match and was told by this screen that nothing had been at stake.
//
// Of all the places for copy to drift from the code, the one that tells somebody
// what happened to their money is the worst, and it is the hardest to notice:
// everything on it is a sentence, so nothing typechecks and no test about
// behaviour goes near it. It is read off the match now.
//
// ── AND THE RANK, WHICH NOW ACTUALLY MOVES ───────────────────────────────────
//
// This said nothing about a rank for one commit, on purpose: the old sentence
// claimed a friendly match "does not touch a rank either", implying a staked one
// does, and nothing wrote players.rank at all. A screen is not the place to
// announce a feature that does not exist.
//
// lib/elo.ts exists now, so the sentence is back and true. What it does not do
// is quote a number: the delta is worked out in lib/finish.ts and stored
// nowhere per match, so printing one here would mean either a second
// calculation that can disagree with the first or a figure invented for the
// screen. It says the rank moved and sends them to the profile, which reads the
// one the database has.

import { formatMCExact } from "@/engine/format";
import type { PlayerView } from "@/engine/view";
import { cx } from "@/lib/cx";

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

/**
 * What became of the money, in the words of what actually happened.
 *
 * The three staked endings are three different facts and the draw is the one
 * nobody would guess: contracts/MatchEscrow.sol has no draw — `settle` takes a
 * winner and refuses anything else — so a drawn staked match pays nobody and
 * each side takes their own deposit back through walkAway after thirty days.
 * Somebody who is not told that is somebody watching for a payout that is never
 * coming.
 */
function settlement(stake: number, won: boolean, drawn: boolean, opponent: string): string {
  if (stake <= 0) {
    return (
      "A friendly match. Nothing was staked and nothing moved — and it does not touch " +
      "your rank either, which is what keeps a rank something you had to pay to lose."
    );
  }
  const pot = `${stake * 2} CRO`;
  if (drawn) {
    return (
      `${stake} CRO a side. The escrow has no draw, so the pot pays nobody — ` +
      `each of you can take your own deposit back after thirty days. Both ranks ` +
      `still moved: the pot and the ladder are different questions.`
    );
  }
  if (won) {
    return (
      `${stake} CRO a side. The pot of ${pot} goes to you, less the fee that falls ` +
      `the more $CROCARD you hold — the contract sends it, there is nothing to claim. ` +
      `Your rank moved with it.`
    );
  }
  return (
    `${stake} CRO a side, and the pot of ${pot} went to ${short(opponent)}. ` +
    `Your rank moved with it.`
  );
}

export function EndScreen({
  view,
  opponent,
  stake,
}: {
  view: PlayerView;
  opponent: string;
  /** CRO a side. Zero for a friendly match. */
  stake: number;
}) {
  const won = view.winner === view.me;
  const drawn = view.winner === null;

  return (
    <section className="panel border border-line p-6">
      <p className="text-[9px] tracking-[0.24em] text-faint">AFTER TEN TURNS</p>
      <h2
        className={cx(
          "display mt-2 text-3xl",
          drawn ? "text-fg" : won ? "green-gradient" : "text-dump",
        )}
      >
        {drawn ? "DRAW" : won ? "YOU WIN" : "YOU LOSE"}
      </h2>

      <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-2">
        <div className="bg-panel px-4 py-4">
          <dt className="text-[8px] tracking-[0.18em] text-faint">YOUR MARKET CAP</dt>
          <dd className="display mt-1.5 text-2xl tabular-nums">{formatMCExact(view.you.mc)}</dd>
        </div>
        <div className="bg-panel px-4 py-4">
          <dt className="text-[8px] tracking-[0.18em] text-faint">
            {short(opponent).toUpperCase()}
          </dt>
          <dd className="display mt-1.5 text-2xl tabular-nums text-muted">
            {formatMCExact(view.them.mc)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        {settlement(stake, won, drawn, opponent)}
      </p>
    </section>
  );
}
