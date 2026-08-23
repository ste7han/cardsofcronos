import type { Sector } from "./types";

// Numbers the way the trenches read them: $40K, $1.2M, $2.4B.

export function formatMC(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(amount);

  if (n >= 1_000_000_000) return `${sign}$${trim(n / 1_000_000_000)}B`;
  if (n >= 1_000_000) return `${sign}$${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `${sign}$${trim(n / 1_000)}K`;
  return `${sign}$${Math.round(n)}`;
}

/**
 * The exact figure, to the last dollar: $1,712,000.
 *
 * formatMC rounds to one decimal, so everything from $1,650,000 to $1,749,999
 * reads as "$1.7M". That is fine while a match is running and wrong the moment
 * two numbers are being compared — a final screen saying both players finished
 * on $1.7M and then naming a winner is the screen contradicting itself, and the
 * player is right to think it is broken.
 *
 * So the end of a match uses this. Everywhere else keeps the short form.
 */
export function formatMCExact(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(amount)).toLocaleString("en-US")}`;
}

/**
 * Two market caps, written with just enough precision to tell them apart.
 *
 * $1.7M against $1.7M with a winner underneath is the screen contradicting
 * itself. Spelling both out to the dollar fixes that and reads like a bank
 * statement, so this does the thing in between: start at one decimal, add
 * another whenever the two still look identical, and only fall back to the exact
 * figures when even three cannot separate them.
 *
 * $1.71M against $1.75M. Equal numbers come back equal, which is the one case
 * where showing the same string is the truth.
 */
export function formatMCPair(a: number, b: number): [string, string] {
  for (let decimals = 1; decimals <= 3; decimals += 1) {
    const left = formatMCAt(a, decimals);
    const right = formatMCAt(b, decimals);
    if (a === b || left !== right) return [left, right];
  }
  return [formatMCExact(a), formatMCExact(b)];
}

/** formatMC, but with the number of decimals said out loud. */
function formatMCAt(amount: number, decimals: number): string {
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(amount);
  const at = (value: number, unit: string) => `${sign}$${value.toFixed(decimals)}${unit}`;

  if (n >= 1_000_000_000) return at(n / 1_000_000_000, "B");
  if (n >= 1_000_000) return at(n / 1_000_000, "M");
  if (n >= 1_000) return at(n / 1_000, "K");
  return `${sign}$${Math.round(n)}`;
}

/** With an explicit sign, for deltas in the log: +$25K, -$10K. */
export function formatDelta(amount: number): string {
  return amount >= 0 ? `+${formatMC(amount)}` : formatMC(amount);
}

/** "1 holder", "3 holders". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** One decimal, but no bare ".0". */
function trim(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * A sector's name as it reads in card text and in the log.
 *
 * Lives here rather than in rules-text.ts because effects.ts needs it too, and
 * rules-text.ts already imports assertNever from effects.ts — putting it there
 * would make the two files import each other. format.ts imports nothing from
 * the engine, so it is the one place both can reach.
 *
 * The switch is exhaustive; adding a sector breaks the build here. It ends on a
 * throw rather than assertNever for the same reason: assertNever is in
 * effects.ts and importing it would rebuild the cycle.
 */
export function sectorName(sector: Sector): string {
  switch (sector) {
    case "meme":
      return "meme";
    case "nft":
      return "NFT";
    case "defi":
      return "DeFi";
    case "dex":
      return "DEX";
    case "infra":
      return "infra";
    default:
      throw new Error(`sectorName: unknown sector ${JSON.stringify(sector)}.`);
  }
}

/**
 * How a card is named in a log line or an error.
 *
 * A project across several cards shares its name with its siblings, so the name
 * alone cannot say which one was played. Everything the player reads goes through
 * here so the answer is the same everywhere.
 */
export function cardLabel(card: { name: string; edition?: string }): string {
  return card.edition ? `${card.name} ${card.edition}` : card.name;
}

/**
 * Everything a card can be found by: its project, its edition and its ticker.
 *
 * The edition is in here because within a family it is the only
 * thing telling eight cards apart, so it is the thing somebody types.
 */
export function searchText(card: { name: string; ticker: string; edition?: string }): string {
  return `${card.name} ${card.ticker} ${card.edition ?? ""}`.toLowerCase();
}
