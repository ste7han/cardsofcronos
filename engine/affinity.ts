// Which support card belongs in which deck.
//
// A deck is forty cards and the set is 79% projects, so anything that fills a
// deck by shuffling hands you a deck of projects. buildFamilyDeck did exactly
// that: forty project cards and not one tactic, event, influencer or tool. The
// cap in deck.ts fixes how many, and this file answers which.
//
// WHY IT IS DERIVED RATHER THAN LISTED. A hand-written list of "these eighteen
// cards go with BONK" is 155 families of maintenance and goes stale the moment a
// card changes, which is the same trap data/preset-decks.ts warns about at the
// top. The cards already say what they do; this reads that and matches it.
//
// The signal, strongest first:
//
//   ticker       Seven influencers name project families outright — Bonk Guy
//                names BONK, Meow names JUP, Donald Trump names four. Nothing
//                beats a card that says who it is for.
//   sector       Sixty-eight cards point at a sector. A meme family wants the
//                thirty that pump meme.
//   shape        What the family needs. A family that banks wants bankPays; a
//                wide family wants morePositions; a fragile one wants healing.
//   overlap      Failing all that, a card that does what the family already does.
//
// Hostile auras — giftBudget, punishWaste, burnHand, stripHolders — score zero
// here on purpose. They win by attacking the other board rather than by building
// yours, which makes them the property of the style presets in preset-decks.ts
// and not of a deck built around a project family.

import type { Aura, Card, EffectKind, ProjectCard, Sector } from "./types";
import { auraOf } from "./types";

/** What a family is, read off its own cards. */
export interface FamilyProfile {
  family: string;
  sector: Sector;
  /** The ticker its cards print, which is how champion auras name it. */
  tickers: ReadonlySet<string>;
  effectKinds: ReadonlySet<EffectKind>;
  /** Pays for closing a position: wants cards that reward banking. */
  banks: boolean;
  /** Pays for holding many projects: wants room to hold them. */
  wide: boolean;
  /** Costs more than the set average: wants budget. */
  expensive: boolean;
  /** Thin on holders, so it rugs early: wants healing. */
  fragile: boolean;
}

/**
 * Reads a family off the set.
 *
 * Throws on a family that has no cards rather than returning an empty profile,
 * because an empty profile scores every support card the same and would quietly
 * build a deck of whatever the shuffle put first — the exact failure this file
 * exists to end.
 */
export function familyProfile(cards: readonly Card[], family: string): FamilyProfile {
  const own = cards.filter(
    (c): c is ProjectCard => c.type === "project" && c.project === family,
  );
  if (own.length === 0) {
    throw new Error(`No cards for project family "${family}". Check the key against data/cards.ts.`);
  }

  const effectKinds = new Set<EffectKind>();
  for (const c of own) if (c.effect) effectKinds.add(c.effect.kind);

  const payoffKinds = new Set<string>();
  for (const c of own) if (c.payoff) payoffKinds.add(c.payoff.when.kind);

  const avgHolders = own.reduce((s, c) => s + c.holders, 0) / own.length;
  const allHolders = cards.filter((c): c is ProjectCard => c.type === "project");
  const setHolders = allHolders.reduce((s, c) => s + c.holders, 0) / allHolders.length;

  const heavy = own.filter((c) => c.rarity === "legendary" || c.rarity === "mythic").length;

  return {
    family,
    sector: own[0]!.sector,
    tickers: new Set(own.map((c) => c.ticker)),
    effectKinds,
    banks: payoffKinds.has("bankedAtLeast") || effectKinds.has("refundMC"),
    wide: payoffKinds.has("ownProjectCount") || payoffKinds.has("ownProjectsInSector"),
    expensive: heavy / own.length > 0.25,
    fragile: avgHolders < setHolders,
  };
}

/** Scores that mean something when you read them back in a deck list. */
const SCORE = {
  namesTheFamily: 100,
  sameSector: 40,
  shapeFits: 30,
  broadlyUseful: 20,
  sameEffect: 10,
  neutral: 5,
  hostile: 0,
} as const;

/**
 * How well one support card suits one family, 0 to 100.
 *
 * Every aura kind in the set is answered here by name. A kind this function has
 * not been taught is a thrown error and not a zero, because a silent zero is how
 * Cards of Cronos ended up with 110 dead cards: the name did not match, nothing
 * complained, and the card quietly stopped mattering. If you add an aura kind,
 * this stops compiling and then it stops running.
 */
export function supportAffinity(card: Card, profile: FamilyProfile): number {
  if (card.type === "project") {
    throw new Error(`supportAffinity is for support cards; ${card.id} is a project.`);
  }

  const aura = auraOf(card);
  const fromAura = aura === null ? null : scoreAura(aura, profile);
  if (fromAura !== null && fromAura > SCORE.neutral) return fromAura;

  if (card.effect && profile.effectKinds.has(card.effect.kind)) return SCORE.sameEffect;
  return fromAura ?? SCORE.neutral;
}

function scoreAura(aura: Aura, profile: FamilyProfile): number {
  switch (aura.kind) {
    case "championProjects":
      if (aura.tickers.some((t) => profile.tickers.has(t))) return SCORE.namesTheFamily;
      return aura.sector === profile.sector ? SCORE.sameSector : SCORE.neutral;
    case "pumpSector":
      return aura.sector === profile.sector ? SCORE.sameSector : SCORE.neutral;
    case "bankPays":
      return profile.banks ? SCORE.shapeFits : SCORE.neutral;
    case "morePositions":
      return profile.wide ? SCORE.shapeFits : SCORE.neutral;
    case "budgetEachTurn":
      return profile.expensive ? SCORE.shapeFits : SCORE.broadlyUseful;
    case "healEachTurn":
      return profile.fragile ? SCORE.shapeFits : SCORE.neutral;
    case "drawEachTurn":
      // Worth 4 to 5 win-rate points on any deck, measured in scripts/draw-winrate.ts.
      // It never fits a family in particular and never stops being good.
      return SCORE.broadlyUseful;
    case "giftBudget":
    case "punishWaste":
    case "burnHand":
    case "stripHolders":
      return SCORE.hostile;
    default: {
      const never: never = aura;
      throw new Error(`supportAffinity has not been taught the aura ${JSON.stringify(never)}.`);
    }
  }
}


/**
 * How much of the support half one card type may take.
 *
 * Affinity alone builds a monoculture. Influencers carry auras and tactics do
 * not, so scoring on aura strength gave BONK seventeen influencers, one tool and
 * no tactics or events at all — which trades a deck of forty projects for a deck
 * of eighteen influencers and fixes nothing.
 *
 * The shares are the set's own proportions, rounded up so they overlap: 34
 * tactics, 20 events, 85 influencers and 26 tools. They deliberately sum to more
 * than the slots available, so affinity still decides who gets in — this only
 * stops any one type from taking the lot.
 */
export const SUPPORT_SHARE: Readonly<Record<"tactic" | "event" | "person" | "tool", number>> = {
  person: 0.45,
  tactic: 0.3,
  tool: 0.25,
  event: 0.2,
};

/** The cap for one type given how many support slots a deck has. */
export function supportCap(type: keyof typeof SUPPORT_SHARE, slots: number): number {
  return Math.max(1, Math.round(slots * SUPPORT_SHARE[type]));
}
