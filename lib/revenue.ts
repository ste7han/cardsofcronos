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
import { CROCARD_SUPPLY } from "@/data/holder-tiers";

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
export const BURN_ADDRESS = normalise("0x000000000000000000000000000000000000dEaD");


/**
 * The team wallet the first version called a burn address.
 *
 * It is not one, and that mattered enough to keep the name of it here rather
 * than delete the line. It is an ordinary wallet the maker holds — 201 outgoing
 * transactions and a live balance — so tokens sent there were never destroyed,
 * only moved. The site said otherwise for a while.
 *
 * $CROCARD is actually burned at the dead address above, where 89 million of it
 * already sits.
 *
 * ── IT IS DELIBERATELY NOT IN `NOT_A_HOLDER` ─────────────────────────────────
 *
 * It held 182 million — eighteen per cent of the supply — when the holder table
 * was first filled in on 2026-09-17, so a wallet this size sitting outside the
 * exclusions looks exactly like something somebody forgot. It is not.
 *
 * That eighteen per cent is being given away to people on Cronos, so the wallet
 * is on its way to nothing. Excluding it would be a rule about a balance that is
 * about to stop existing, and the rule would outlive the balance — which is how
 * a project ends up not paying somebody for a reason nobody can remember.
 *
 * WHAT TO WATCH is the order. The drop is cumulative: whatever this wallet holds
 * on the day of a share-out earns its proportion for good, and selling or giving
 * away afterwards does not hand it back — the same rule that lets an ordinary
 * holder sell without losing what they earned. Finish the giveaway before the
 * mint opens and this costs nothing. The other way round and the team wallet
 * earns a fifth of everything that arrives in between.
 */
export const TEAM_WALLET = normalise("0x42BCc1355808aDf2344773c54e364257911CcC99");

/**
 * The DEX every stream is bought through.
 *
 * EbisusBay's Ryoshi router, and it is the only one that can trade the token:
 * the CROCARD/WCRO pool sits on factory 0x5f1d751f…, which is EbisusBay's.
 * Obsidian's own factory has no CROCARD pair at all, and its documentation was
 * what nearly sent this at a pool that does not exist. Verified by asking the
 * router for its factory and getting a live quote back.
 */
export const ROUTER = normalise("0xa476c97d8d1ec7d263eafa0039645dbe0cc0a012");

/**
 * The CROCARD/WCRO pool the router trades against.
 *
 * Named here because of what it holds: 399 million $CROCARD, thirty-nine per
 * cent of the supply. It is the single largest holder of the token by a long way
 * and it is not a person — it is the liquidity, and paying it a holder's share
 * would send two fifths of every payout to nobody, out of everybody else's.
 */
export const POOL = normalise("0xce7AE1d9dB768bfCccD3E7acAC2C0E563c25caEA");

/**
 * Loaded Lions' own token, which this game reads and never buys.
 *
 * Verified on 18 September 2026 by asking it: name "Loaded Lions", symbol LION,
 * 18 decimals, a hundred billion supply. Holding it unlocks a board — see
 * data/boards.ts — and that is the whole of its role here.
 *
 * IT IS NOT BOUGHT WITH ANYTHING. Paying part of a mint into $LION was
 * considered and dropped: its pair on the router this project trades through
 * holds zero WCRO, so every purchase would have to route somewhere else and pay
 * for the privilege. A token that gates something costs nothing to read.
 */
export const LION = normalise("0x9D8c68F185A04314DDC8B8216732455e8dbb7E45");

/**
 * Addresses that hold $CROCARD and are not holders.
 *
 * Named so they can be checked, and not the whole rule — scripts/holder-drop.ts
 * also refuses any address with code on it, because the next pool, router or
 * bridge is the one nobody remembered to add to a list. This is what is known
 * to be here today; that is what catches what is not.
 */
export const NOT_A_HOLDER: readonly string[] = [
  normalise("0x0000000000000000000000000000000000000000"),
  BURN_ADDRESS,
  POOL,
  ROUTER,
];

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
    /**
     * NO STREAM PAYS THIS, and that is the settled position rather than an
     * oversight.
     *
     * It took 25% of mints and 25% of royalties once. Mints went to the holders,
     * the pot and the burn first; royalties followed, and that was the last one.
     * Every way money enters this game now divides the same three ways and none
     * of them is here.
     *
     * The wallet stays because it is a real wallet with a real job the moment
     * anything is ever paid out of the project rather than into it, and deleting
     * it would make that a new decision instead of a visible one.
     */
    what: "The maker's own wallet. No stream pays it.",
  },
  deployer: {
    id: "deployer",
    /**
     * The maker's cold wallet, given on 2026-09-16 and checked against the chain
     * before it was written here: the EIP-55 checksum verifies and it held 10
     * CRO, which is what the maker said it held.
     *
     * IT IS ALSO THE OWNER of all four contracts, because whoever deploys them
     * is. That makes it the only key that can reach the money, through the
     * rescue hatch in contracts/Rescuable.sol, and the reason it must never be
     * the publisher and must never become a Worker secret.
     */
    address: normalise("0x48D0af6f9cf85D80D61657cE7b852f3Dc4aa16E8"),
    what: "Deploys the contracts and owns them. Never on a server.",
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

/**
 * The contracts, once they exist.
 *
 * Null until deployed, for exactly the reason the wallets are: a stand-in reads
 * like a real address and this is the file where money goes somewhere. The cron
 * that closes a week checks these and does nothing rather than sending a
 * transaction into the dark.
 *
 * Deploy order is the drop and the pot, then the splitter that pays them, then
 * the NFT that pays the splitter — each needs the ones before it. That order is
 * what scripts/deploy-contracts.ts exists to get right.
 */
export const CONTRACTS: Record<"drop" | "splitter" | "pot" | "nft", string | null> = {
  drop: "0x09e4d4bf527ddcff1ea38e550573a15c490043c6",
  splitter: "0xbb658915095d90fe7892d642ea1e6d223ae5fa75",
  pot: "0xafe431c0c6b2cde0888e0dff74d22be08c981025",
  nft: null,
};

for (const [name, address] of Object.entries(CONTRACTS)) {
  if (address === null) continue;
  if (normalise(address) !== address) {
    throw new Error(`The ${name} contract address is not in the stored lowercase form.`);
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
    // Every share is bought as $CROCARD before it is split. The CRO that arrives
    // goes through the market first, so the whole of a mint is buy pressure and
    // each destination is paid in the thing the game is about — half back to the
    // people already holding it, a quarter burned, a quarter into the pot. The
    // creator takes nothing out of a mint any more.
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
    // The third stream on the same split, which makes it the only split there
    // is. Three streams dividing three ways was three things to explain; one
    // sentence now covers every way money enters this game, and a rule somebody
    // can repeat from memory is a rule they can check.
    shares: [
      { to: "holders", percent: 50 },
      { to: "burn", percent: 25 },
      { to: "tournament", percent: 25 },
    ],
    live: false,
  },
  {
    id: "rake",
    name: "Ranked matches",
    from: "A cut of what is staked on a match.",
    // The same split as a mint, on purpose. This is the stream players pay
    // directly and most often, so it is the one they will actually learn — and
    // two streams that divide differently is two things to explain and two
    // things to get wrong.
    //
    // It used to be 100% burn, on the argument that "all of it goes into the
    // token" is a shorter sentence than any split. It is, and it was the wrong
    // trade: the pot has to be fed by the thing people do every day rather than
    // by mints alone, or the weekly prize is only ever as big as last week's
    // minting.
    shares: [
      { to: "holders", percent: 50 },
      { to: "burn", percent: 25 },
      { to: "tournament", percent: 25 },
    ],
    live: false,
    open:
      "How much is taken is the holder ladder in data/holder-tiers.ts, 25% down to 5% " +
      "by what the winner holds. Nothing is staked yet, so nothing is taken.",
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
 * addresses four hundred lines away — so the check lives here, at load, where
 * the deploy fails instead of the payout.
 *
 * IT ASKS WHAT RECEIVES THE MONEY, not what is responsible for it. It used to
 * ask the latter, and for burn and holders that was the deployer — an address
 * known since the day it was written down. So the guard passed while two of the
 * three destinations were still null, which is the single case it exists to
 * catch. What a stream needs is the thing that receives the money and the
 * splitter that buys the token on the way, and both are checked here.
 */
for (const stream of STREAMS) {
  if (!stream.live) continue;
  if (CONTRACTS.splitter === null) {
    throw new Error(`${stream.id} is live but the splitter that buys $CROCARD is not deployed.`);
  }
  for (const share of stream.shares) {
    if (receiverOf(share.to) === null) {
      throw new Error(`${stream.id} is live but ${share.to} has nowhere to receive it yet.`);
    }
  }
}

/**
 * The most one week's prize may be, in whole $CROCARD.
 *
 * One percent of the billion there will ever be. A quarter of every mint lands
 * in the pot and the mint is the busiest this game will ever be, so without a
 * ceiling the first week after it hands one player a tenth of the supply for
 * beating a bot once — and that player is then the market.
 *
 * What is over the ceiling is not refused and not lost. It stays in the pot and
 * is the next week's prize, so every token that arrives is still paid out, just
 * never all in one week.
 *
 * THIS IS THE DEFAULT AND NOT THE TRUTH once the pot is deployed. The contract
 * holds the live figure in `mostPerWeek` and the owner can move it — a percent
 * of supply is the right rule at a small market cap and the wrong one at a
 * large one. The site reads the chain where it can and falls back to this.
 */
export const MOST_PER_WEEK = CROCARD_SUPPLY / 100;

/**
 * What a burn row's source is called on screen.
 *
 * The splitter does not know which stream paid it. Mints, royalties and a
 * match's cut all arrive as CRO in one balance and leave in one swap, so a row
 * recorded from its log is honestly "all three" and naming one of them would be
 * a guess printed as a fact. A stream id still resolves, for anything recorded
 * before the splitter existed or by hand.
 */
export function sourceOf(stream: string): string {
  if (stream === "splitter") return "Mints, royalties and matches";
  return STREAMS.find((one) => one.id === stream)?.name ?? stream;
}

/**
 * What a share is called on screen.
 *
 * All three are paid in $CROCARD: the splitter buys it before dividing anything,
 * so "buy and burn" stopped being the name of one leg and became what happens to
 * every one of them. Only the destination differs.
 */
export function nameOf(to: Destination): string {
  if (to === "burn") return "$CROCARD burned";
  if (to === "holders") return "$CROCARD to the people holding it";
  if (to === "tournament") return "$CROCARD into the weekly prize pot";
  return WALLETS[to].what;
}

/**
 * The address a share actually lands on, or null while nobody has deployed it.
 *
 * THIS USED TO ANSWER "THE DEPLOYER" for burns and for the holders' half, and
 * that was true while a person did those jobs by hand. It stopped being true the
 * moment contracts started doing them, and it stopped in the quietest way: the
 * page carried on showing a wallet somebody could go and look at, and the money
 * was going somewhere else.
 *
 * So each destination now names the thing that really receives it. The burn
 * address is a constant and has always been known; the other two are contracts
 * and are null until scripts/deploy-contracts.ts has run.
 */
export function receiverOf(to: Destination): string | null {
  switch (to) {
    case "burn":
      return BURN_ADDRESS;
    case "holders":
      return CONTRACTS.drop;
    case "tournament":
      return CONTRACTS.pot;
    default:
      return WALLETS[to].address;
  }
}
