// Everything this wallet is holding, as cards.
//
// A page of its own rather than a section on /profile. The gallery brings
// filters, a size picker and a few hundred pictures with it, and that is too
// much to put halfway down a page which is otherwise four short facts — you
// would scroll past your own rank to get to the bottom of it.
//
// It is still under /profile because that is what it is about: this wallet.

import type { Metadata } from "next";
import Link from "next/link";

import { YourCardsPage } from "@/components/YourCardsPage";

export const metadata: Metadata = {
  title: "Your cards — Cards of Cronos",
  description: "Every card this wallet is holding.",
};

export default function CardsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <Link
          href="/profile"
          className="text-[10px] tracking-[0.28em] text-faint hover:text-pump"
        >
          ← PROFILE
        </Link>
        <h1 className="display mt-2 text-4xl sm:text-5xl">YOUR CARDS</h1>
      </header>

      <YourCardsPage />
    </div>
  );
}
