// Rarity on screen. The colours live here as hex because the procedural SVG needs
// them; you can't put a Tailwind class in an SVG attribute.

import type { CardType, Rarity, Sector } from "@/engine/types";

export interface RarityStyle {
  label: string;
  colour: string;
  /** Glow behind the artwork. */
  glow: string;
  /** How wild this tier's candle pattern is. */
  violence: number;
  /**
   * How far the tier's colour carries through the card, 0 to 1.
   *
   * The tier used to live in a band at the top and nowhere else, which meant a
   * mythic and a common were the same card with a different stripe. This is the
   * knob that changes: a common is barely tinted and a mythic is drenched, so
   * how much colour there is *is* the rarity, before anybody reads the word.
   */
  saturation: number;
}

export const RARITY: Record<Rarity, RarityStyle> = {
  common: { label: "COMMON", colour: "#6b7784", glow: "rgba(107,119,132,0.14)", violence: 0.5, saturation: 0.18 },
  rare: { label: "RARE", colour: "#3b82f6", glow: "rgba(59,130,246,0.16)", violence: 0.7, saturation: 0.4 },
  epic: { label: "EPIC", colour: "#a855f7", glow: "rgba(168,85,247,0.18)", violence: 0.9, saturation: 0.62 },
  legendary: { label: "LEGENDARY", colour: "#f59e0b", glow: "rgba(245,158,11,0.2)", violence: 1.1, saturation: 0.82 },
  mythic: { label: "MYTHIC", colour: "#ff2d55", glow: "rgba(255,45,85,0.22)", violence: 1.4, saturation: 1 },
};

export const TYPE_LABEL: Record<CardType, string> = {
  project: "PROJECT",
  tactic: "TACTIC",
  event: "EVENT",
  influencer: "INFLUENCER",
  tool: "TOOL",
};

export const SECTOR_LABEL: Record<Sector, string> = {
  meme: "MEME",
  infra: "INFRA",
  ai: "AI",
  politics: "POLITICS",
  nft: "NFT",
  defi: "DEFI",
  depin: "DEPIN",
  gaming: "GAMING",
};
