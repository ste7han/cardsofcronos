// Where the money goes.
//
// Settled by the maker. One file, because these numbers end up on a page, in
// DESIGN.md and eventually in whatever moves the funds — and three copies of a
// split is two chances to pay the wrong wallet.
//
// Every address is decoded at load and checked for length. A mistyped address is
// silent in the worst way here: it is a valid-looking string that money goes to
// and never comes back from. Base58 catches a wrong character and the length
// check catches a wrong length, which between them catch every typo that is not
// another real address — and a share that does not add up to a hundred is
// refused outright rather than quietly leaving a remainder somewhere.

import { base58Decode } from "@/lib/base58";

export interface Wallet {
  id: "creator" | "deployer" | "marketing" | "tournament";
  address: string;
  /** What it is for, in one line. */
  what: string;
}

export const WALLETS: Record<Wallet["id"], Wallet> = {
  creator: {
    id: "creator",
    address: "8kYc6QfaFM7633An2VPK15Tx85Lf47NtfKvBXzn6cNpr",
    what: "The maker's own wallet.",
  },
  deployer: {
    id: "deployer",
    address: "Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7kp",
    what: "Launches the token, and does every buy-and-burn.",
  },
  marketing: {
    id: "marketing",
    address: "Cstb5W8HMheovQNDh5eazwtUkocub9D8kVRMUf9kd6U8",
    what: "Marketing and the people doing it.",
  },
  tournament: {
    id: "tournament",
    address: "9AbPyT6RkCtpRycN7dZ8dak4TQ9L3Xa1ictwP8M9bQLF",
    what: "Tournament prizes. Paid out, not spent.",
  },
};

/**
 * No two of these may be the same address.
 *
 * A duplicate is a split that quietly pays one party twice, and it adds up to a
 * hundred and looks completely normal on the page. Checked here rather than only
 * in a test, because the test cannot stop a deploy and this can.
 */
{
  const addresses = Object.values(WALLETS).map((wallet) => wallet.address);
  if (new Set(addresses).size !== addresses.length) {
    throw new Error("Two wallets share an address. One of them is being paid somebody else's cut.");
  }
}

/** Checked at load, so a typo cannot wait until somebody sends money to it. */
for (const wallet of Object.values(WALLETS)) {
  const bytes = base58Decode(wallet.address);
  if (bytes.length !== 32) {
    throw new Error(`${wallet.id} is ${bytes.length} bytes, not 32. That is not a Solana address.`);
  }
}

export type Destination = "burn" | Wallet["id"];

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
    id: "creator-fee",
    name: "pump.fun creator fee",
    from: "The fee pump.fun pays the creator on every trade of the token.",
    shares: [
      { to: "creator", percent: 50 },
      { to: "marketing", percent: 20 },
      { to: "burn", percent: 20 },
      { to: "tournament", percent: 10 },
    ],
    live: false,
  },
  {
    id: "mints",
    name: "Paid mints",
    from: "Packs and cards, once they cost anything.",
    shares: [
      { to: "burn", percent: 75 },
      { to: "creator", percent: 25 },
    ],
    live: false,
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

/** What a destination is called on screen. */
export function nameOf(to: Destination): string {
  return to === "burn" ? "Buy and burn $TCG" : WALLETS[to].what;
}

/** Which wallet actually receives it. Burns go through the deployer. */
export function walletFor(to: Destination): Wallet {
  return to === "burn" ? WALLETS.deployer : WALLETS[to];
}
