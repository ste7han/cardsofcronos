import type { Metadata } from "next";

import { PlayArea } from "@/components/game/PlayArea";

export const metadata: Metadata = {
  title: "Play — Cards of Cronos",
  description: "Ten turns, a growing marketing budget. Highest market cap wins.",
};

export default function PlayPage() {
  return <PlayArea />;
}
