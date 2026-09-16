// Where the money goes.
//
// One file, because these numbers end up on a page, in the design notes and
// eventually in whatever moves the funds — and three copies of a split is two
// chances to pay the wrong wallet.
//
// Every address is normalised at load. A mistyped address is silent in the worst
// way here: it is a valid-looking string that money goes to and never comes back
// from. `normalise` catches a wrong length, a character that is not hex, and —
// for the mixed-case form everybody copies from an explorer — a failed EIP-55
// checksum. A share that does not add up to a hundred is refused outright rather
// than quietly leaving a remainder somewhere.

import { normalise } from "@/lib/address";

/**
 * The token this game burns. Already live on Cronos, already held by the people
 * who played the first version — the same $CROCARD the old dapp gave a mint
 * discount for.
 */
export const CROCARD = normalise("0xECf3361441512c1e9F6A6e8734D86614D8e795BC");

/**
 * Where burned tokens go. The old dapp's burn address, kept rather than swapped
 * for 0x…dEaD, so that every burn this project has ever done lands on one
 * address anybody can watch in a single explorer page.
 */
export const BURN_ADDRESS = normalise("0x42BCc1355808aDf2344773c54e364257911CcC99");

export interface Wallet {
  id: "creator" | "deployer" | "marketing" | "tournament";
  /**
   * Lowercase, or null while nobody has said what it is.
   *
   * Null rather than a placeholder. The Solana version of this file had four
   * real addresses in it and they do not carry over. A stand-in — the zero
   * address, a treasury borrowed from the old dapp — reads exactly like a real
   * one on the page, and the whole point of this file is that money never goes
   * somewhere nobody chose. Unknown is a fact; a plausible wrong address is a
   * loss.
   */
  address: string | null;
  /** What it is for, in one line. */
  what: string;
}

export const WALLETS: Record<Wallet["id"], Wallet> = {
  creator: {
    id: "creator",
    address: null,
    what: "The maker's own wallet.",
  },
  deployer: {
    id: "deployer",
    address: null,
    what: "Deploys the contract, does every buy-and-burn, and pays the holders.",
  },
  marketing: {
    id: "marketing",
    address: null,
    what: "Marketing and the people doing it.",
  },
  tournament: {
    id: "tournament",
    address: null,
    what: "The prize pot for the weekly high score. Paid out, not spent.",
  },
};

/** The addresses that are actually known, in the one form they are compared in. */
export const KNOWN_ADDRESSES: readonly string[] = Object.values(WALLETS)
  .map((wallet) => wallet.address)
  .filter((address): address is string => address !== null);

/**
 * No two of these may be the same address.
 *
 * A duplicate is a split that quietly pays one party twice, and it adds up to a
 * hundred and looks completely normal on the page. Checked here rather than only
 * in a test, because the test cannot stop a deploy and this can.
 */
{
  if (new Set(KNOWN_ADDRESSES).size !== KNOWN_ADDRESSES.length) {
    throw new Error("Two wallets share an address. One of them is being paid somebody else's cut.");
  }
}

/** Checked at load, so a typo cannot wait until somebody sends money to it. */
for (const wallet of Object.values(WALLETS)) {
  if (wallet.address === null) continue;
  try {
    if (normalise(wallet.address) !== wallet.address) {
      throw new Error("it is not in the lowercase form everything else compares against");
    }
  } catch (error) {
    throw new Error(`The ${wallet.id} wallet is not usable: ${(error as Error).message}`);
  }
}

/**
 * "burn" and "holders" are not wallets — they are what happens to the money once
 * a wallet has it. Both run through the deployer, which is why `walletFor` exists
 * at all: the page has to show an address somebody can watch, and neither of
 * these has one of its own.
 */
/**
 * What a mint costs, in whole CRO.
 *
 * Two ways to buy and no others: one card, or ten. The pack is the cheaper way
 * in per card and that is the whole reason it exists — ten singles are 150 CRO
 * and the pack is 100, so a pack is a third off. Checked at load, because a pack
 * that is not cheaper than its cards is a button nobody has a reason to press
 * and the mistake is one digit wide.
 *
 * These are the list prices. The $CROCARD discount carried over from the first
 * collection comes off on top — one percent per million held, capped at thirty —
 * so the most anybody pays less is 10.5 CRO for a card and 70 for a pack.
 */
export interface MintOption {
  id: "single" | "pack";
  /** How many cards it hands over. */
  cards: number;
  /** List price in whole CRO, before the $CROCARD discount. */
  cro: number;
}

export const MINT_OPTIONS: readonly MintOption[] = [
  { id: "single", cards: 1, cro: 15 },
  { id: "pack", cards: 10, cro: 100 },
];

/** CRO per card, for comparing the two ways to buy. */
export function croPerCard(option: MintOption): number {
  return option.cro / option.cards;
}

{
  const single = MINT_OPTIONS.find((option) => option.id === "single")!;
  const pack = MINT_OPTIONS.find((option) => option.id === "pack")!;
  if (croPerCard(pack) >= croPerCard(single)) {
    throw new Error(
      `A pack costs ${croPerCard(pack)} CRO a card and a single costs ${croPerCard(single)}. ` +
        `Nobody would buy the pack.`,
    );
  }
  for (const option of MINT_OPTIONS) {
    if (!Number.isInteger(option.cro) || option.cro <= 0) {
      throw new Error(`The ${option.id} price is ${option.cro} CRO, which is not a price.`);
    }
    if (!Number.isInteger(option.cards) || option.cards <= 0) {
      throw new Error(`The ${option.id} hands over ${option.cards} cards.`);
    }
  }
}

export type Destination = "burn" | "holders" | Wallet["id"];

export interface Share {
  to: Destination;
  percent: number;
}

export interface Stream {
  id: string;
  name: string;
  /** Where the money comes from, for somebody who does not already know. */
  from: string;
  shares: readonly Share[];
  /** Is this actually running? */
  live: boolean;
  /** What is still undecided about it, if anything. */
  open?: string;
}

export const STREAMS: readonly Stream[] = [
  {
    id: "mints",
    name: "Paid mints",
    from: "Packs and cards of the new line.",
    // Half of it goes back to the people already holding the token, which is a
    // different promise from burning: a burn helps everyone holding it by making
    // the supply smaller, and this pays them in CRO. The creator takes nothing
    // out of a mint any more.
    shares: [
      { to: "holders", percent: 50 },
      { to: "burn", percent: 25 },
      { to: "tournament", percent: 25 },
    ],
    live: false,
    open:
      "How holders are paid has not been decided. A share-out needs a snapshot or a " +
      "claim, and neither exists yet.",
  },
  {
    id: "royalties",
    name: "NFT royalties",
    from: "Secondary sales of the cards.",
    shares: [
      { to: "burn", percent: 75 },
      { to: "creator", percent: 25 },
    ],
    live: false,
  },
  {
    id: "rake",
    name: "Staked matches",
    from: "A cut of what is staked on a match.",
    // All of it. The rake is the only stream that is entirely burn, which is
    // deliberate: it is the one players pay directly, and the answer to "what
    // happens to my money" being "all of it goes into the token" is a shorter
    // sentence than any split.
    shares: [{ to: "burn", percent: 100 }],
    live: false,
    open: "What that cut is has not been decided. Nothing is staked yet, so nothing is taken.",
  },
];

/**
 * A split that does not add up is refused at load.
 *
 * The remainder is the dangerous half. Ninety-nine per cent leaves one per cent
 * with no destination, which in practice means it sits wherever it landed — and
 * that is exactly the kind of thing nobody notices until somebody audits it.
 */
for (const stream of STREAMS) {
  const total = stream.shares.reduce((sum, share) => sum + share.percent, 0);
  if (total !== 100) {
    throw new Error(`${stream.id} splits ${total}%, not 100%. The rest would have nowhere to go.`);
  }
}

/**
 * A stream cannot be live while it does not know where its money goes.
 *
 * This is the reason the unknown addresses are null and not a stand-in. Flipping
 * `live` is one word in a diff and nobody reviewing it would think to check the
 * wallets four hundred lines away — so the check lives here, at load, where the
 * deploy fails instead of the payout.
 */
for (const stream of STREAMS) {
  if (!stream.live) continue;
  for (const share of stream.shares) {
    if (walletFor(share.to).address === null) {
      throw new Error(
        `${stream.id} is live but the ${walletFor(share.to).id} wallet has no address yet.`,
      );
    }
  }
}

/** What a destination is called on screen. */
export function nameOf(to: Destination): string {
  if (to === "burn") return "Buy and burn $CROCARD";
  if (to === "holders") return "Paid out to $CROCARD holders";
  return WALLETS[to].what;
}

/** Which wallet actually receives it. Burns go through the deployer. */
export function walletFor(to: Destination): Wallet {
  return to === "burn" || to === "holders" ? WALLETS.deployer : WALLETS[to];
}
