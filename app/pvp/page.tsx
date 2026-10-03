import type { Metadata } from "next";

import { Lobby } from "@/components/Lobby";
import { clockPhrase } from "@/engine/record";

export const metadata: Metadata = {
  title: "PvP — Cards of Cronos",
  description: `Play a real opponent. ${clockPhrase("live")} or a day, for nothing or for CRO.`,
};

export default function PvpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        {/* Not "CORRESPONDENCE" any more. That was true of every match here
            while the lobby only offered one clock, and it is the sort of label
            that goes on being read long after it stopped being true. */}
        <p className="text-[10px] tracking-[0.28em] text-faint">
          {clockPhrase("live").toUpperCase()}, OR A DAY
        </p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">PVP</h1>
      </header>

      <Lobby />
    </div>
  );
}
