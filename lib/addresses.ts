// Every address this game touches, and who can do what with it.
//
// One list feeding one page, so it cannot drift from what is actually deployed:
// the addresses come from lib/revenue.ts rather than being typed out again, and
// a contract that has not been deployed reads as not deployed instead of being
// quietly missing from the page.
//
// ── WHY THE POWERS ARE WRITTEN DOWN ──────────────────────────────────────────
//
// A contract list that says "here are our contracts, they are decentralised" is
// worth nothing, because every one of these has a key attached and pretending
// otherwise is how people get hurt. So each entry says what the owner can do,
// what the publisher can do, and what nobody can do — including the rescue
// hatches, which are the most dangerous things here and are therefore the ones
// most worth naming.
//
// If a power is added to a contract and not added here, this file is a
// reassurance rather than a disclosure. test/addresses.test.ts checks each claim
// against the Solidity it describes for exactly that reason.

import {
  BURN_ADDRESS,
  CONTRACTS,
  CROCARD,
  LION,
  POOL,
  PUBLISHER,
  ROUTER,
  WALLETS,
} from "@/lib/revenue";

export interface Listed {
  id: string;
  name: string;
  /** Null when it does not exist yet, which is a fact rather than a gap. */
  address: string | null;
  /** What it is, in one line. */
  what: string;
  /**
   * Who can make it do something, and what.
   *
   * Empty for a thing nobody controls. One entry per power, in the words of
   * what it can actually do rather than the name of the function.
   */
  powers: readonly string[];
  /** Why it is here at all when it is somebody else's. */
  theirs?: string;
}

/** The contracts this project deployed and holds the keys to. */
export const OURS: readonly Listed[] = [
  {
    id: "splitter",
    name: "Splitter",
    address: CONTRACTS.splitter,
    what:
      "Everything the game earns arrives here. It buys $CROCARD on the market and divides it: " +
      "half of it burned, three tenths to the people holding the token, a fifth to the prize pot. " +
      "Deployed fresh in September 2026 to change that split: the shares are fixed in the contract, " +
      "so moving them meant a new one. The first version is still on chain at " +
      "0xbb658915095d90fe7892d642ea1e6d223ae5fa75, divides the old way, and has nothing pointed at it.",
    powers: [
      "Anybody can set it going. `release()` takes no arguments, has no owner check and can only " +
        "do the one thing, so calling it is paying the gas rather than making a decision.",
      "It cannot be pointed somewhere else, and its shares cannot be moved. Both were fixed when " +
        "it was deployed, which is why changing the split means deploying a new one.",
      "The owner can empty it, after telling you first. The rescue hatch announces two days " +
        "before it can be used, which is the window to notice.",
    ],
  },
  {
    id: "drop",
    name: "HolderDrop",
    address: CONTRACTS.drop,
    what:
      "Holds the holders' half and pays it out. What you have earned only ever goes up, and one " +
      "claim collects all of it, whenever you like.",
    powers: [
      "The publisher can propose what everybody has earned, and nothing else. It holds no tokens " +
        "and cannot promise more than has actually arrived.",
      "A proposal waits a day before it counts, in the open, and the owner can throw it away in " +
        "one transaction. That day is what makes the key on the server barely worth stealing.",
      "The owner can replace the publisher, and can empty the contract through the same two-day " +
        "rescue hatch.",
    ],
  },
  {
    id: "pot",
    name: "PrizePot",
    address: CONTRACTS.pot,
    what: "The weekly prize. One pot, several leaderboards, each playing for a share of it.",
    powers: [
      "The publisher can name a week's winners and nothing else. It cannot withdraw, cannot " +
        "reopen a week it has closed and cannot reach the balance.",
      "The owner sets what share each board plays for, and what one week may pay at most.",
      "The owner can replace the publisher, and can empty the contract through the same two-day " +
        "rescue hatch.",
      "A prize already decided cannot be taken back. Neither rotating the key nor moving the " +
        "shares reaches a week that has closed.",
    ],
  },
  {
    id: "first",
    name: "The first collection",
    address: "0x10b47dabfeacbd87dd2bad5f6d489c5082181902",
    what:
      "The 2025 collection. 515 were minted, and holding one earns a free mint of the new line.",
    powers: [
      "No more can be minted. There is no mint function left in the deployed bytecode.",
      "The owner can still change where its art is served from, over all 515. That is a live " +
        "power over something people hold, and it is listed here because it is real rather than " +
        "because it is comfortable.",
      "The owner can withdraw anything the contract is holding, and can hand the ownership on or " +
        "give it up entirely.",
    ],
    theirs:
      "Owned by the team wallet, not by the wallet that owns everything else on this page. " +
      "Checked on chain on 18 September 2026.",
  },
  {
    id: "escrow",
    name: "MatchEscrow",
    address: CONTRACTS.escrow,
    what:
      "What two players put up on a ranked match. Two equal deposits in CRO; the winner takes " +
      "the pot less a cut, and the cut goes to the splitter above like everything else.",
    powers: [
      "The publisher can name the winner of a match that has two deposits and has not been " +
        "settled, and nothing else. It cannot withdraw, cannot re-settle, and cannot reach a " +
        "balance. Paying is a separate call anybody may make, and it always pays the winner.",
      "The owner can take out CRO that belongs to no match, and only that. This is the one " +
        "contract here with no rescue hatch over its balance: it counts what is owed to players " +
        "and the owner may sweep the difference, which is nothing unless somebody forced CRO in.",
      "The owner can replace the publisher, and can send out a token somebody put here by " +
        "mistake — stakes are CRO, so nothing is ever owed in a token.",
      "Nobody can move the cut. It is the holder ladder, fixed with no setter, and it is read " +
        "when a pot is paid rather than when a winner is named — so buying more $CROCARD between " +
        "the two counts in your favour.",
      "A match nobody ever settled can be walked away from after thirty days. Each side takes " +
        "its own deposit and neither can take the other's, so it is an exit and not a way to win.",
    ],
  },
  {
    id: "nft",
    name: "Cards of Cronos Set 01",
    address: CONTRACTS.nft,
    what:
      "The card collection. 5,603 of them, fixed in the contract when it was deployed in " +
      "September 2026 and unchangeable since. Every one is face down until the set is revealed.",
    powers: [
      "The owner can change where the art is served from. Revealing the set is that power being " +
        "used once — and it stays afterwards, which means it is also the power to change what " +
        "you own. Said out loud here and on the mint page for that reason.",
      "How many there will ever be was fixed when it was deployed. 5,603, and no function to " +
        "move it. Which card each one turns out to be was fixed before any of them were sold, " +
        "and the hash proving that is published on the mint page.",
      "The owner opens and closes the free claim and the sale, and sets the price.",
      "Royalties are paid to the splitter above, so they go the same three ways as everything else.",
    ],
  },
];

/**
 * Ours, and beyond anybody's reach — including ours.
 *
 * A category of its own because it is the strongest thing that can be said about
 * a contract and it would be lost inside either of the other two lists. "Not
 * ours" undersells it and reads like distance; "ours" invites the question of
 * what we can do with it, and the answer is nothing at all.
 */
export const RENOUNCED: readonly Listed[] = [
  {
    id: "crocard",
    name: "$CROCARD",
    address: CROCARD,
    what:
      "The token this game is denominated in, launched with the first version in April 2025. " +
      "A billion of them and there will never be more.",
    powers: [
      "Nobody owns it. `owner()` answers with the zero address — the ownership was given up — " +
        "so there is no key to rotate, pause with or point anywhere.",
      "No more can be made. There is no mint function in the deployed bytecode, so the supply is " +
        "the supply for good.",
    ],
    theirs:
      "Ours in the sense that this project launched it, and nobody's in the sense that matters: " +
      "checked on chain on 18 September 2026 by asking the contract itself.",
  },
];

/** Addresses the game reads or pays, and did not deploy. */
export const NOT_OURS: readonly Listed[] = [
  {
    id: "lion",
    name: "$LION",
    address: LION,
    what: "Loaded Lions' token. Holding it opens the Loaded Lions board.",
    powers: [],
    theirs:
      "Crypto.com's, not ours. This game only ever reads a balance from it — it is never bought, " +
      "never sold and never held by anything here.",
  },
  {
    id: "burn",
    name: "The burn address",
    address: BURN_ADDRESS,
    what: "Where the burned half goes. Nobody holds its key, so nothing sent there comes back.",
    powers: [],
    theirs:
      "Not an address anybody owns. It is the convention for this, and it already held 89 million " +
      "$CROCARD before this game sent any.",
  },
  {
    id: "router",
    name: "EbisusBay router",
    address: ROUTER,
    what: "The exchange the splitter buys $CROCARD through.",
    powers: [],
    theirs: "EbisusBay's. The splitter calls it and holds nothing there.",
  },
  {
    id: "pool",
    name: "$CROCARD / WCRO pool",
    address: POOL,
    what: "The liquidity the buying happens against.",
    powers: [],
    theirs:
      "Nobody's in particular. Listed because it is the largest holder of $CROCARD by a long way " +
      "and it is not a holder — it is left out of every payout, along with anything else that has " +
      "code on it.",
  },
];

/** The wallets, which are people rather than code. */
export const KEYS: readonly Listed[] = [
  {
    id: "owner",
    name: "Owner",
    address: WALLETS.deployer.address,
    what: "Deployed the contracts and owns them. A cold wallet that never touches a server.",
    powers: [
      "Everything listed above as the owner's, including every rescue hatch.",
      "It is the only key that can reach the money, and the reason it must never be the one on " +
        "the server.",
    ],
  },
  {
    id: "publisher",
    name: "Publisher",
    address: PUBLISHER,
    what: "The key the nightly jobs sign with. It lives on a server, which is why it can do so little.",
    powers: [
      "Name a week's winners, and propose what holders have earned. That is all of it.",
      "It cannot withdraw anything, from anything. Stolen, it costs one proposal that the owner " +
        "has a day to throw away.",
    ],
  },
];
