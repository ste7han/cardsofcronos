"use client";

// How a match ended.
//
// Came over from TCG, where this screen has a second half: what each side
// staked, what the winner got, what went to the burn, every figure beside the
// transaction that did it. That half is not here, and it is not commented out
// either. It is written in lamports, signatures and Solscan links, and none of
// those are the units this game will settle in — translating them would produce
// a screen that reads right and means nothing. lib/pvp.ts already refuses a
// stake for the same reason: "a stake nobody holds is not a stake."
//
// So every match here is a friendly one and this screen says so. When there is
// somewhere on Cronos to hold a stake, the money half gets written against that
// rather than ported from a chain this game is not on.

import { formatMCExact } from "@/engine/format";
import type { PlayerView } from "@/engine/view";
import { cx } from "@/lib/cx";

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

export function EndScreen({ view, opponent }: { view: PlayerView; opponent: string }) {
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
        A friendly match. Nothing was staked and nothing moved — and it does not touch a rank
        either, which is what keeps a rank something you had to pay to lose.
      </p>
    </section>
  );
}
