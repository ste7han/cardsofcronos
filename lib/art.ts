// Decides what a card's procedural artwork looks like. No files, no CDN, none of
// the 734 MB of PSDs from the previous project — the image follows from the card
// id and the effect.

import { assertNever } from "@/engine/effects";
import type { Card, Effect } from "@/engine/types";

export type Mood = "pump" | "dump";

/**
 * The names a card will answer to when looking for a picture, best first.
 *
 * One list, read by two callers that used to decide this separately: CardArt
 * renders whatever the first hit resolves to, and scripts/art.ts reports what is
 * still bare. They disagreed on 2026-09-01 — the renderer had learned that an
 * person card falls back to their portrait and the report had not, so it announced 22
 * cards on procedural art while every one of them was showing a photograph.
 *
 *   the card id      this exact moment — "clove-i"
 *   the family       a project's eight cards — "clove"
 *   the person       a person's ladder — the slug of their name
 *
 * A number is worth having only if it is the same number the screen is using.
 */
export function artKeysFor(card: Card): string[] {
  const keys = [card.id];
  if (card.type === "project") keys.push(card.project);
  if (card.type === "person") keys.push(slug(card.name));
  return keys;
}

/** The same reduction scripts/art.ts applies to a filename. */
export const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Does the chart on this card go up or fall apart?
 *
 * Cards that hit the opponent get a chart that collapses — Rug Pull shouldn't look
 * like a green candle. The switch is exhaustive, so a new effect forces a choice
 * here instead of quietly defaulting to "pump".
 */
export function moodOf(card: Card): Mood {
  if (
    card.type === "project" ||
    card.type === "person" ||
    card.type === "tool"
  ) {
    return "pump";
  }
  return moodOfEffect(card.effect);
}

function moodOfEffect(effect: Effect): Mood {
  switch (effect.kind) {
    case "directMC":
      return effect.target === "opponent" || effect.mc < 0 ? "dump" : "pump";
    case "scaleMC":
      return effect.percentage < 0 || effect.target === "opponent"
        ? "dump"
        : "pump";
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
    case "discardCards":
      return "dump";
    case "takeOver":
      // Pump. It is the one aggressive effect in the game that ends with
      // something of theirs paying you, so the card should not look like a loss.
      return "pump";
    case "extraBudget":
      return "pump";
    case "comebackMC":
      return "pump";
    case "mcPerHolderLost":
      return "pump";
    case "pumpToMC":
    case "budgetToMC":
      return "pump";
    case "merge":
      return "pump";
    case "benchmark":
      return "pump";
    case "peakMC":
      return "pump";
    case "mcPerPositionGone":
    case "refundMC":
      return "pump";
    case "peekAndBurn":
      return "dump";
    case "fork":
      return "pump";
    case "attach":
      return effect.target === "ownProject" ? "pump" : "dump";
    case "scalePump":
      return effect.percentage > 0 ? "pump" : "dump";
    case "unbankedMC":
      return "pump";
    case "burnForDamage":
      return "dump";
    case "recoverCard":
      return "pump";
    case "after":
      // The chart follows what it will eventually do, not the waiting.
      return moodOfEffect(effect.effect);
    default:
      return assertNever(effect, "moodOfEffect");
  }
}

/** djb2. The same id always produces the same image. */
export function hashOf(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++)
    h = (Math.imul(h, 33) ^ text.charCodeAt(i)) | 0;
  return h;
}
