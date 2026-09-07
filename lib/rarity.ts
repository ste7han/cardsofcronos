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

/**
 * The tiers, in the first version's own colours.
 *
 * Taken from src/components/CardPreview.tsx, which was the canonical set — two
 * other copies in the old dapp disagreed with it using generic Tailwind values,
 * and this is now the one place they live.
 *
 *   common     grey            rare       gold
 *   epic       the purple      legendary  orange
 *
 * ── THE MYTHIC IS NOT BLACK, AND THAT IS A DECISION ─────────────────────────
 * Over there a mythic was a black-to-#333 gradient, which works beautifully as
 * the *fill* of a card face on a light page. Here `colour` is a rim and `glow`
 * is a wash on a near-black ground, so black would make the rarest tier the only
 * one you cannot see — and `saturation` below says the whole point is that a
 * mythic is drenched in its colour and a common is barely tinted.
 *
 * So the mythic takes --nebula-pink, which is the loudest colour in the old
 * palette and was already sitting in :root unused. If the obsidian look matters
 * more than the visibility, the honest way back is a different card frame for
 * that tier rather than an invisible rim, and this comment is where to start.
 */
export const RARITY: Record<Rarity, RarityStyle> = {
  common: { label: "COMMON", colour: "#9ca3af", glow: "rgba(156,163,175,0.14)", violence: 0.5, saturation: 0.18 },
  rare: { label: "RARE", colour: "#ffd700", glow: "rgba(255,215,0,0.16)", violence: 0.7, saturation: 0.4 },
  epic: { label: "EPIC", colour: "#9d4edd", glow: "rgba(157,78,221,0.2)", violence: 0.9, saturation: 0.62 },
  legendary: { label: "LEGENDARY", colour: "#ff8c00", glow: "rgba(255,140,0,0.2)", violence: 1.1, saturation: 0.82 },
  mythic: { label: "MYTHIC", colour: "#f72585", glow: "rgba(247,37,133,0.24)", violence: 1.4, saturation: 1 },
};

export const TYPE_LABEL: Record<CardType, string> = {
  project: "PROJECT",
  tactic: "TACTIC",
  event: "EVENT",
  person: "PERSON",
  tool: "TOOL",
};

export const SECTOR_LABEL: Record<Sector, string> = {
  meme: "MEME",
  nft: "NFT",
  defi: "DEFI",
  dex: "DEX",
  infra: "INFRA",
};
