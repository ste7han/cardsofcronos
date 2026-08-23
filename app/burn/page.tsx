import type { Metadata } from "next";

import { Burn } from "@/components/Burn";

export const metadata: Metadata = {
  title: "Burn — Cards of Cronos",
  description: "Where the money goes, and every $CROCARD burned with it.",
};

export default function BurnPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.28em] text-faint">$CROCARD</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">BURN</h1>
      </header>

      <Burn />
    </div>
  );
}
