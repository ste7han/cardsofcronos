import type { Metadata } from "next";

import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "Play — Trenches Card Game",
  description: "Ten turns, a growing marketing budget. Highest market cap wins.",
};

export default function PlayPage() {
  return <Game />;
}
