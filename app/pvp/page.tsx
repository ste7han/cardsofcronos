import type { Metadata } from "next";

import { Lobby } from "@/components/Lobby";

export const metadata: Metadata = {
  title: "PvP — Cards of Cronos",
  description: "Play a real opponent. A day a turn, friendly for now.",
};

export default function PvpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.28em] text-faint">CORRESPONDENCE</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">PVP</h1>
      </header>

      <Lobby />
    </div>
  );
}
