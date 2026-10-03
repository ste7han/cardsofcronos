import type { Metadata } from "next";
import Link from "next/link";

import { Watch } from "@/components/Watch";

export const metadata: Metadata = {
  title: "Watching a match — Cards of Cronos",
  description: "Both boards, the market caps and what has happened so far.",
};

/**
 * Open to anybody with the link, and that is the point.
 *
 * A page you can only see after connecting a wallet is a page nobody shares.
 * What it shows is what both players can already see — the redaction is in
 * engine/view.ts, where a watcher's view has no field a hand could go in.
 */
export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-[10px] tracking-[0.28em] text-faint">LOOKING IN</p>
      <h1 className="display mt-2 text-3xl sm:text-4xl">WATCHING</h1>
      <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-muted">
        Both boards as the players see each other&rsquo;s — no hands, because a hand somebody can
        read is a hand they can tell the other side about.
      </p>

      <div className="mt-8">
        <Watch id={id} />
      </div>

      <p className="mt-10 text-[10px] text-faint">
        <Link href="/pvp" className="tracking-[0.16em] hover:text-pump">
          ← THE LOBBY
        </Link>
      </p>
    </main>
  );
}
