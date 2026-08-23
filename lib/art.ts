// Decides what a card's procedural artwork looks like. No files, no CDN, none of
// the 734 MB of PSDs from the previous project — the image follows from the card
// id and the effect.

import { assertNever } from "@/engine/effects";
import type { Card, Effect } from "@/engine/types";

export type Mood = "pump" | "dump";

/**
 * Does the chart on this card go up or fall apart?
 *
 * Cards that hit the opponent get a chart that collapses — Rug Pull shouldn't look
 * like a green candle. The switch is exhaustive, so a new effect forces a choice
 * here instead of quietly defaulting to "pump".
 */
export function moodOf(card: Card): Mood {
  if (card.type === "project" || card.type === "influencer" || card.type === "tool") {
    return "pump";
  }
  return moodOfEffect(card.effect);
}

function moodOfEffect(effect: Effect): Mood {
  switch (effect.kind) {
    case "directMC":
      return effect.target === "opponent" || effect.mc < 0 ? "dump" : "pump";
    case "scaleMC":
      return effect.percentage < 0 || effect.target === "opponent" ? "dump" : "pump";
    case "damageHolders":
      return "dump";
    case "rug":
      return "dump";
    case "stealMC":
      return "dump";
    case "pumpProject":
      return "pump";
    case "pumpBySector":
      return "pump";
    case "healHolders":
      return "pump";
    case "drawCards":
      return "pump";
    case "cancel":
      return "dump";
    case "extraBudget":
      return "pump";
    default:
      return assertNever(effect, "moodOfEffect");
  }
}

/** djb2. The same id always produces the same image. */
export function hashOf(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) | 0;
  return h;
}
