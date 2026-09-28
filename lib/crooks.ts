// The Crooks Finance rank ladder, as they publish it.
//
// Its own file because two scripts need it and neither should import the other:
// scripts/crooks-snapshot.ts runs a three-minute chain read the moment it is
// loaded, so importing it for a constant starts a scan nobody asked for. That
// happened once, which is why this exists.
//
// A rank is decided by how many Crooks Legends an address holds, and nothing
// else. What each rank is WORTH in free mints is not here — that is a decision
// rather than a fact, and it lives in scripts/crooks-grants.ts where the
// reasoning for it can sit next to it.

export interface Rank {
  name: string;
  /** The smallest holding that reaches this rank. */
  from: number;
}

/** Lowest first. Published by Crooks Finance; copied on 22 September 2026. */
export const RANKS: readonly Rank[] = [
  { name: "Prospect", from: 0 },
  { name: "Member", from: 1 },
  { name: "Hustler", from: 2 },
  { name: "Street Soldier", from: 3 },
  { name: "Enforcer", from: 5 },
  { name: "Officer", from: 10 },
  { name: "Captain", from: 25 },
  { name: "General", from: 50 },
  { name: "Gang Leader", from: 75 },
  { name: "Boss", from: 100 },
  { name: "Kingpin", from: 150 },
  { name: "Overlord", from: 200 },
  { name: "Icon", from: 300 },
  { name: "Legend", from: 400 },
  { name: "Immortal", from: 500 },
];

/**
 * The rank a holding reaches.
 *
 * Walks the whole ladder rather than stopping at the first match, so the order
 * of the list above is the only thing that has to be right. A find() on
 * `held >= from` would return Prospect for everybody.
 */
export function rankOf(held: number): string {
  let found = RANKS[0]!.name;
  for (const rank of RANKS) if (held >= rank.from) found = rank.name;
  return found;
}
