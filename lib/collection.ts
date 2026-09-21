// What this player owns.
//
// Your collection is everything you have minted: cards, however many at a time.
// It only ever grows, and every product is drawn against it rather than
// against the set, so you are never handed a card you already have. A player who
// has minted nothing owns nothing — there is nothing free underneath this.
//
// A collection belongs to a wallet, not to a browser. That is the difference
// between "cards" and "cards in this Chrome": the same wallet on a laptop and a
// phone is one collection, two wallets on one machine are two, and clearing a
// browser loses nothing that was ever really yours. Signed out, you hold
// nothing — not an empty collection, no collection.
//
// Two switches sit on top of this and neither is small:
//
//   MINT_OPEN            may anyone mint at all?
//   DECK_FROM_COLLECTION may you only deck cards you own?
//
// The mint is shut, by the maker's call, and the second follows from the first.
// Owning-what-you-deck is what makes a mint a mint: if everyone can deck
// everything, minting is a screensaver, and renting cards out later would be
// renting nothing. But with nothing to mint there is nothing to own, so the rule
// has to stand down with it.
//
// The worry it has to answer is real — /mint promises that holding never changes
// what you may deck, measured back when decks had a points budget and one built
// on 110 beat one built on 80 in 86% of matches. Card ownership is that argument
// in different clothes. What makes it survivable is that a collection buys
// *choice*, not power: a card is the same card however you got it, and a draw runs
// 44.6% common and 31.7% rare against this set, so a bigger collection is mostly
// a bigger pile of the cheap tiers. That split is measured over four thousand
// purchases; DESIGN.md has the argument, and scripts/collection-packs.ts is what
// would put a number on what the spread costs in win rate — it has not been run
// against this set.
//
// Opening the mint again is one constant below and nothing else.
import { provenAdmin } from "@/lib/admin";
import { MAX_PER_TX } from "@/lib/revenue";
import { signedIn } from "@/lib/session";

import { openCards } from "@/engine/pack";
import type { Card } from "@/engine/types";
import { SET } from "@/lib/set";

/**
 * Is the mint open?
 *
 * Off, by the maker's call. There is no token and no chain behind it yet, so
 * every card drawn today is free and local, and a free mint that looks like the
 * real one is the worst kind of placeholder: somebody builds a collection,
 * believes they own it, and finds out on launch day that they owned a line in a
 * browser they have since cleared.
 *
 * This is the switch, not the button. The buttons on /mint read it, and so do
 * buyCards below — which throws rather than quietly handing out
 * cards, because turning off a button only stops the people who use buttons.
 *
 * One wallet gets through anyway: see mayMint below.
 */
export const MINT_OPEN = false;

/**
 * May whoever is at this browser mint right now?
 *
 * The public switch, or the admin. The admin is a wallet that has proved itself
 * with a signature rather than an address someone typed — lib/admin.ts has the
 * argument for why that distinction is the whole feature.
 *
 * Deliberately not folded into MINT_OPEN. MINT_OPEN is a property of the game
 * and DECK_FROM_COLLECTION is derived from it; if one visitor could flip it, the
 * deck rules would differ per browser and every reader of that constant would
 * have to start asking whose browser. A permission is not a switch.
 */
export function mayMint(): boolean {
  return MINT_OPEN || provenAdmin();
}

/**
 * May you only deck cards you own?
 *
 * Yes. Settled by the maker, and it stands whether or not the mint is running.
 *
 * It was briefly derived from MINT_OPEN, on the reasoning that a shut mint plus
 * this rule leaves the public unable to build or play. That is true and it is no
 * longer treated as a problem: before launch there is nothing for a stranger to
 * own, so a deck builder that hands them the whole set is not generosity, it is
 * a rehearsal of a game that will not work that way. The door is locked because
 * the room is not finished.
 */
export const DECK_FROM_COLLECTION = true;

/**
 * Where a wallet's cards live.
 *
 * The address is in the key rather than inside the value, so no read can ever
 * hand one wallet another's cards by forgetting to filter. Signed out there is
 * no key to read, which is not the same as an empty one.
 */
function keyFor(wallet: string | null): string | null {
  return wallet === null ? null : `tcg.collection.v1:${wallet}`;
}

/**
 * Cards that were in this collection and are no longer cards.
 *
 * Set once, when a read drops something, and then left alone for the rest of the
 * page's life — a card leaving the set is an event, not a property of the last
 * call. React runs effects twice in development, and clearing this at the top of
 * every read left the second pass with nothing to report.
 *
 * Cards do leave the set: when BONK became eight cards the single `bonk` card
 * stopped existing. Dropping them silently is the easy thing and the wrong one.
 */
let lost: string[] = [];

/** What this session's reads have found missing from the set, if anything. */
export function lostFromSet(): readonly string[] {
  return lost;
}

/**
 * Everything this player holds, duplicates and all, in the order it arrived.
 *
 * A purchase draws against the whole set now rather than against the collection, so a
 * card can turn up twice and the second copy is a real thing to hold — it is
 * what you trade. A deck still takes one of each, which is a rule about decks
 * and not about ownership; those two were the same list until now and are not
 * any more.
 */
export function holdings(): string[] {
  if (typeof window === "undefined") return [];

  const key = keyFor(signedIn());
  if (key === null) return [];

  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      const ids = parsed as string[];
      const kept = ids.filter((id) => SET.some((c) => c.id === id));
      const gone = ids.filter((id) => !SET.some((c) => c.id === id));
      if (gone.length > 0) lost = [...new Set([...lost, ...gone])];
      return kept;
    }
  } catch {
    // An unreadable collection is the same as an empty one.
  }
  return [];
}

/** How many of each card this player holds. */
export function copiesHeld(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of holdings()) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Which cards this player owns at all — one entry each, whatever they hold.
 *
 * Both halves: the browser's rehearsal cards and the last answer the chain gave.
 * The deck rules are checked against this, so leaving the chain out was a deck
 * of real cards being refused for cards you do not own.
 */
export function collection(): string[] {
  return [...new Set([...holdings(), ...rememberedChain()])];
}

/** What the deck builder may build from. See DECK_FROM_COLLECTION above. */
export function deckPool(): string[] {
  return DECK_FROM_COLLECTION ? collection() : SET.map((c) => c.id);
}

/** The same, as a set, for the deck rules — or undefined when the rule is off. */
export function ownedForRules(): ReadonlySet<string> | undefined {
  return DECK_FROM_COLLECTION ? new Set(collection()) : undefined;
}

/** The cards the deck builder may offer, as cards rather than ids. */
export function poolCards(): Card[] {
  const pool = new Set(deckPool());
  return SET.filter((c) => pool.has(c.id));
}

/**
 * What this wallet holds ON CHAIN, as card ids, one entry per token.
 *
 * The real answer now. Everything above this line is the browser: cards drawn
 * locally and kept in localStorage, which is what the mint was before there was
 * a contract. A wallet that minted 53 cards for real had none of them here and
 * the deck builder told it so — correctly, about the wrong collection.
 *
 * The chain cannot be asked directly: contracts/CardsOfCronosSetOne.sol is
 * deliberately not ERC721Enumerable, so /api/cards reads the ownership table the
 * minute-job keeps. A mint from ten seconds ago may not be in it yet.
 *
 * Returns an empty list for a wallet that holds nothing, and THROWS when it
 * could not ask — those are different facts and the builder draws them
 * differently. Signed out returns empty without asking, which is neither.
 */
export async function chainHoldings(wallet: string | null): Promise<string[]> {
  if (wallet === null) return [];
  const response = await fetch(`/api/cards?wallet=${wallet}`);
  if (!response.ok) throw new Error(`The chain holdings could not be read: ${response.status}`);
  const { tokens } = (await response.json()) as { tokens: { cardId: string }[] };
  const ids = tokens.map((one) => one.cardId);
  remember(wallet, ids);
  return ids;
}

/**
 * The last answer the chain gave, kept so the rules can be checked without one.
 *
 * lib/deck-storage.ts validates a deck against what you own, and it does that
 * synchronously — saving is a button press, not a request. Before this, the set
 * it checked against was the browser's rehearsal collection, so a deck built
 * from 53 cards minted on chain was refused for holding cards you do not own.
 * Silently: the button simply did not turn into SAVED.
 *
 * A cache, and the word is meant. It is written every time the chain is asked
 * and it can be behind — somebody who sold a card between two page loads could
 * save a deck holding it. That is a UI convenience being briefly wrong, and the
 * reason it is survivable is that it is not the last word: a deck that matters
 * is checked again where it is played.
 */
function chainKey(wallet: string): string {
  return `tcg.chain.v1:${wallet}`;
}

function remember(wallet: string, ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chainKey(wallet), JSON.stringify(ids));
  } catch {
    // A full or blocked localStorage costs the cache, not the cards.
  }
}

/** What the chain last said this wallet holds. Empty when it has never said. */
export function rememberedChain(): string[] {
  if (typeof window === "undefined") return [];
  const wallet = signedIn();
  if (wallet === null) return [];
  try {
    const raw = window.localStorage.getItem(chainKey(wallet));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      return (parsed as string[]).filter((id) => SET.some((card) => card.id === id));
    }
  } catch {
    // An unreadable cache is the same as none.
  }
  return [];
}

/**
 * Everything this wallet may deck, and how many of each it has.
 *
 * The chain and the browser, added together. They are not rivals: the local
 * ones only exist for a wallet that opened rehearsal packs before there was a
 * contract — MINT_OPEN is off, so nobody else can add to them — and throwing
 * them away would take cards off the one person who has any.
 *
 * DECK_FROM_COLLECTION off hands back the whole set, the same as deckPool.
 */
export async function poolFor(
  wallet: string | null,
): Promise<{ cards: Card[]; copies: Map<string, number> }> {
  const copies = new Map<string, number>();
  const count = (id: string) => copies.set(id, (copies.get(id) ?? 0) + 1);

  for (const id of holdings()) count(id);
  for (const id of await chainHoldings(wallet)) count(id);

  if (!DECK_FROM_COLLECTION) {
    return { cards: [...SET], copies };
  }
  return { cards: SET.filter((card) => copies.has(card.id)), copies };
}

export interface Bought {
  /** What came out, in draw order. Empty when there was nothing left to pull. */
  cardIds: string[];
  /** Cards in the set this player has still never seen. */
  remaining: number;
  /** How many were asked for. Short of `cardIds.length` means the set ran out. */
  asked: number;
}

/**
 * Buys cards and keeps them.
 *
 * One product, one price a card, any number up to what a transaction holds. It
 * was two — a single and a pack of ten with a guaranteed rare — and the pack
 * went when the token order was settled in advance, because a fixed sequence
 * cannot promise what is in any ten of it. engine/pack.ts has the whole of that.
 *
 * Nothing here refuses a second purchase. The only thing that stops it is
 * running out of set, which it reports rather than papering over with
 * duplicates.
 */
export function buyCards(count: number): Bought {
  refuseWhenShut();
  if (!Number.isInteger(count) || count < 1 || count > MAX_PER_TX) {
    // Loud. The UI offers a slider between 1 and MAX_PER_TX, so anything else
    // arrived from a console — and a quantity the chain would reject must not
    // become cards in a browser that look exactly like bought ones.
    throw new Error(`${count} is not a number of cards anybody can buy in one go.`);
  }
  return keep(count, (seed) => openCards(SET, seed, count));
}

/**
 * Every purchase goes through here first.
 *
 * A closed mint that only hides its buttons is not closed. Anyone with a console
 * open can call these, and the cards they get would be written to the same
 * collection as a real one — indistinguishable afterwards from cards minted when
 * it counted.
 */
function refuseWhenShut(): void {
  if (!mayMint()) {
    throw new Error(
      "The mint is closed, and this browser is not the admin. See mayMint in lib/collection.ts.",
    );
  }
}

/** Draws against the collection and stores what came out. */
function keep(asked: number, draw: (seed: number) => string[]): Bought {

  // Math.random is fine here: this is which cards you got, not anything the
  // engine has to replay. The seed is not kept, the cards are.
  const cardIds = draw(Math.floor(Math.random() * 2_147_483_647));

  const key = keyFor(signedIn());
  if (key === null) {
    // Unreachable through the UI, which does not offer a mint to a signed-out
    // visitor. Loud anyway: the alternative is drawing ten cards and dropping
    // them on the floor, and the person would watch the whole animation first.
    throw new Error("Nobody is signed in, so there is no collection to mint into.");
  }

  if (cardIds.length > 0) {
    // Appended to what is held, not to what is owned: writing back the
    // de-duplicated list would throw away every second copy on the next buy.
    window.localStorage.setItem(key, JSON.stringify([...holdings(), ...cardIds]));
  }
  return {
    cardIds,
    asked,
    remaining: SET.length - new Set([...collection(), ...cardIds]).size,
  };
}

/**
 * How far along this collection is.
 *
 * Two different numbers now, and both are worth showing: `owned` is how much of
 * the set you have seen, `cards` is how many you are holding. They used to be
 * the same figure, which is exactly the confusion duplicates introduce.
 */
export function collectionProgress(): { owned: number; total: number; cards: number } {
  return { owned: collection().length, total: SET.length, cards: holdings().length };
}
