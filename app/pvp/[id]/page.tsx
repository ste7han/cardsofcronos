import type { Metadata } from "next";

import { MatchBoard } from "@/components/pvp/MatchBoard";

export const metadata: Metadata = {
  title: "Match — Cards of Cronos",
};

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <MatchBoard id={id} />
    </div>
  );
}
