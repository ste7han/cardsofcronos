import type { Metadata } from "next";

import { Profile } from "@/components/Profile";

export const metadata: Metadata = {
  title: "Profile — Cards of Cronos",
  description: "Your rank, your decks and what they have done.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.28em] text-faint">YOUR WALLET</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">PROFILE</h1>
      </header>

      <Profile />
    </div>
  );
}
