import type { Metadata } from "next";

import { Contracts } from "@/components/Contracts";

export const metadata: Metadata = {
  title: "Contracts — Cards of Cronos",
  description: "Every address this game touches, and what the keys attached to them can do.",
};

export default function ContractsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-[10px] tracking-[0.28em] text-faint">ON CHAIN</p>
      <h1 className="display mt-2 text-3xl sm:text-4xl">CONTRACTS</h1>
      <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted">
        What this game is made of, where it lives, and what can be done to it. Every address links
        to the explorer.
      </p>

      <div className="mt-10">
        <Contracts />
      </div>
    </main>
  );
}
