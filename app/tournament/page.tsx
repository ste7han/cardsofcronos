import type { Metadata } from "next";

import { Tournament } from "@/components/Tournament";

export const metadata: Metadata = {
  title: "Weekly — Cards of Cronos",
  description: "Beat the bot. The best market cap of the week takes the pot.",
};

export default function TournamentPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.28em] text-faint">EVERY WEEK</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">HIGH SCORE</h1>
      </header>

      <Tournament />
    </div>
  );
}
