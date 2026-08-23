import { auraOf } from "./types";
import type { Card } from "./types";

/**
 * A short hash of everything printed on the cards.
 *
 * The render script screenshots a running server, so there are two copies of the
 * card set in play: the one the script imported and the one the server is
 * serving. They are normally the same file and normally that is fine — until the
 * server is holding a stale module, which it does after the card data changes
 * under a dev server that has not restarted.
 *
 * A new card 404s, which is loud. A *changed* card does not: the page renders
 * happily with the old numbers, and the picture that becomes somebody's NFT
 * disagrees with the card they are playing. That is the exact failure the whole
 * render-from-the-real-component approach exists to prevent, arriving through a
 * side door.
 *
 * So both sides compute this and the render refuses to start unless they match.
 * Only fields that appear on the card go in: a change to something invisible
 * should not stop a render.
 */
export function setFingerprint(cards: readonly Card[]): string {
  const parts = cards.map((card) => {
    const stats =
      card.type === "project"
        ? `${card.sector}|${card.launchMC}|${card.pumpMC}|${card.holders}|${card.edition ?? ""}`
        : "";
    return [
      card.id,
      card.type,
      card.name,
      card.ticker,
      card.rarity,
      card.flavour,
      stats,
      JSON.stringify(card.effect ?? null),
      JSON.stringify(auraOf(card) ?? null),
    ].join("~");
  });

  // FNV-1a, 32-bit. Not a security hash — it only has to change when the cards
  // change, and be the same number on both sides of an HTTP request.
  let hash = 0x811c9dc5;
  const text = `${cards.length}#${parts.join("\n")}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${cards.length}-${hash.toString(16).padStart(8, "0")}`;
}
