// Where the money goes.
//
// These are the numbers with the worst failure mode in the repository. A split
// that does not add up leaves a remainder sitting wherever it landed, and a
// mistyped address is a valid-looking string that money goes to and never comes
// back from. Neither shows up as an error anywhere — which is why they are
// checked at load and checked again here.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isAddress, normalise } from "@/lib/address";
import { CROCARD_SUPPLY } from "@/data/holder-tiers";
import {
  BURN_ADDRESS,
  CONTRACTS,
  CROCARD,
  croPerCard,
  KNOWN_ADDRESSES,
  MINT_OPTIONS,
  MOST_PER_WEEK,
  NOT_A_HOLDER,
  POOL,
  ROUTER,
  nameOf,
  receiverOf,
  STREAMS,
  WALLETS,
} from "@/lib/revenue";

describe("the wallets", () => {
  // ── All four are null for now, and that is a fact rather than a gap. ──────
  // The Solana addresses that were here do not carry over. A stand-in — the zero
  // address, a treasury borrowed from the old dapp — reads exactly like a real
  // one on the page, and this is the file where money goes somewhere. Unknown is
  // safe; a plausible wrong address is a loss.
  //
  // The test below FAILS the day an address is filled in, which is what brings
  // somebody back here to restore the assertion that all four are set.
  it("names the deployer and nothing else yet", () => {
    // The maker's cold wallet, checked against the chain before it went in. It
    // is also the owner of all four contracts, which is why it is the one that
    // must never become a Worker secret.
    expect(WALLETS.deployer.address).toBe("0x48d0af6f9cf85d80d61657ce7b852f3dc4aa16e8");

    // The rest are still nobody's. Null and not a stand-in: an address that
    // reads like a real one is how money goes somewhere nobody chose.
    for (const wallet of Object.values(WALLETS)) {
      if (wallet.id === "deployer") continue;
      expect(wallet.address, `${wallet.id} has an address nobody announced`).toBeNull();
    }
  });

  it("keeps the owner apart from the key that lives on a server", () => {
    // The publisher signs from a Worker and may name a winner. The deployer owns
    // the contracts and can reach the money through the rescue hatch. One wallet
    // doing both would undo the whole reason the publisher is allowed there.
    const publisher = "0x60f84405917a456527744a40b3b64b63ab5e007c";
    expect(WALLETS.deployer.address).not.toBe(publisher);
  });

  it("keeps whatever is filled in normalised, so it can be compared", () => {
    for (const wallet of Object.values(WALLETS)) {
      if (wallet.address === null) continue;
      expect(isAddress(wallet.address)).toBe(true);
      // Lowercase, like every other address in the project. A wallet list in
      // checksummed case would never match anything it is compared against.
      expect(normalise(wallet.address)).toBe(wallet.address);
    }
  });

  it("are all different wallets", () => {
    // Two of these being the same address would be a split that quietly pays one
    // party twice, and it would look completely normal on the page.
    const addresses = Object.values(WALLETS)
      .map((wallet) => wallet.address)
      .filter((address): address is string => address !== null);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("all say what they are for", () => {
    // The page prints this line next to an address. An empty one is a wallet
    // nobody can account for.
    for (const wallet of Object.values(WALLETS)) {
      expect(wallet.what.length).toBeGreaterThan(0);
    }
  });
});

describe("the token", () => {
  it("is the $CROCARD that already exists, and the burn address already used", () => {
    // Both are carried over from the old dapp on purpose. A second burn address
    // would mean a total nobody can add up from one explorer page, and a new
    // token would leave the people who held the first one holding nothing.
    expect(isAddress(CROCARD)).toBe(true);
    expect(normalise(CROCARD)).toBe(CROCARD);
    expect(isAddress(BURN_ADDRESS)).toBe(true);
    expect(normalise(BURN_ADDRESS)).toBe(BURN_ADDRESS);
    expect(CROCARD).not.toBe(BURN_ADDRESS);
  });
});

describe("the splits", () => {
  it("each add up to exactly a hundred", () => {
    // The remainder is the dangerous half. 99% leaves 1% with no destination,
    // which in practice means it stays where it landed.
    for (const stream of STREAMS) {
      const total = stream.shares.reduce((sum, share) => sum + share.percent, 0);
      expect(total).toBe(100);
    }
  });

  it("never names the same destination twice in one stream", () => {
    // Two shares to the same place is a split somebody edited and did not
    // finish, and it sums to a hundred all the same.
    for (const stream of STREAMS) {
      const seen = stream.shares.map((share) => share.to);
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  it("has no share of nothing, and none over a hundred", () => {
    for (const stream of STREAMS) {
      for (const share of stream.shares) {
        expect(share.percent).toBeGreaterThan(0);
        expect(share.percent).toBeLessThanOrEqual(100);
      }
    }
  });

  it("is the ladder the maker settled", () => {
    const by = (id: string) => STREAMS.find((stream) => stream.id === id)!;
    const share = (id: string, to: string) =>
      by(id).shares.find((s) => s.to === to)?.percent ?? 0;

    // The pump.fun creator fee is gone rather than renamed: there is no
    // pump.fun on Cronos, and a stream that cannot happen does not belong on a
    // page that says where the money goes.
    expect(STREAMS.find((stream) => stream.id === "creator-fee")).toBeUndefined();

    // Half of a mint is burned, three tenths go back to the people holding the
    // token and a fifth is the weekly prize pot. The creator takes nothing out
    // of a mint.
    expect(share("mints", "burn")).toBe(50);
    expect(share("mints", "holders")).toBe(30);
    expect(share("mints", "tournament")).toBe(20);
    expect(share("mints", "creator")).toBe(0);

    // The third stream on the same split, which makes it the only split there
    // is: every way money enters this game divides the same three ways.
    expect(share("royalties", "burn")).toBe(50);
    expect(share("royalties", "holders")).toBe(30);
    expect(share("royalties", "tournament")).toBe(20);

    // The same split as a mint, on purpose: this is the stream players pay
    // most often, so it is the one they actually learn, and two streams that
    // divide differently is two things to get wrong.
    expect(share("rake", "burn")).toBe(50);
    expect(share("rake", "holders")).toBe(30);
    expect(share("rake", "tournament")).toBe(20);
    expect(by("rake").shares).toHaveLength(3);
  });
});

describe("burning", () => {
  it("goes to the dead address and to no wallet of ours", () => {
    // It went to a team wallet once — an address with 201 outgoing transactions,
    // which is not a burn whatever it is called. The dead address cannot spend.
    expect(receiverOf("burn")).toBe(BURN_ADDRESS);
    expect(KNOWN_ADDRESSES).not.toContain(receiverOf("burn"));
  });

  it("is named as itself and not as a wallet", () => {
    expect(nameOf("burn")).toMatch(/burn/i);
  });
});

describe("who is not a holder", () => {
  it("leaves out the pool, which is the largest holder of the token and not one", () => {
    // 399 million $CROCARD sits in the EbisusBay CROCARD/WCRO pool: thirty-nine
    // per cent of the supply. Pay it a holder's share and two fifths of every
    // round goes to the liquidity instead of to the people it was bought for.
    expect(NOT_A_HOLDER).toContain(POOL);
    expect(NOT_A_HOLDER).toContain(BURN_ADDRESS);
    expect(NOT_A_HOLDER).toContain(ROUTER);
    expect(NOT_A_HOLDER).toContain("0x0000000000000000000000000000000000000000");
  });

  it("is written the way every other address in this file is", () => {
    // Lowercase, or the set membership check in the drop script silently misses
    // it and pays it anyway.
    for (const address of NOT_A_HOLDER) {
      expect(address).toBe(address.toLowerCase());
      expect(address).toMatch(/^0x[0-9a-f]{40}$/);
    }
    expect(new Set(NOT_A_HOLDER).size).toBe(NOT_A_HOLDER.length);
  });

  it("never names a wallet of ours, which would be a payout quietly withheld", () => {
    for (const wallet of Object.values(WALLETS)) {
      if (wallet.address === null) continue;
      expect(NOT_A_HOLDER).not.toContain(wallet.address);
    }
  });
});

describe("what is still open", () => {
  it("says so on the stream it is open about, rather than nowhere", () => {
    // The rake percentage is undecided. A page that showed "100% burn" without
    // saying 100% of what would be answering a different question.
    const rake = STREAMS.find((stream) => stream.id === "rake")!;
    expect(rake.open).toBeTruthy();
    expect(rake.live).toBe(false);
  });

  it("does not claim anything is running that is not", () => {
    // Nothing mints, nothing is staked, and nothing buys the token yet.
    expect(STREAMS.every((stream) => !stream.live)).toBe(true);
  });

  it("cannot go live while it does not know where the money goes", () => {
    // The check that makes the null addresses safe rather than merely honest.
    // Flipping `live` is one word in a diff, and nobody reviewing it would think
    // to look at the addresses a hundred lines away — so lib/revenue.ts refuses
    // at load, and this is that rule written down where it can be read.
    //
    // Stated as an implication, which is what keeps it meaning something as the
    // project moves. It was paired with three assertions that the contracts were
    // still null — true when it was written and false the morning they were
    // deployed, which is a test measuring the date rather than the rule.
    for (const stream of STREAMS) {
      if (!stream.live) continue;
      expect(CONTRACTS.splitter).not.toBeNull();
      for (const share of stream.shares) {
        expect(receiverOf(share.to)).not.toBeNull();
      }
    }

    // What makes it more than an empty loop is the other side: every destination
    // a stream names resolves to an address, so the implication above has
    // something to bite on rather than being vacuously true.
    //
    // The splitter is deliberately not asserted here. It was, and the assertion
    // read "the only thing holding the streams shut is the flag" — true while it
    // was deployed and false the moment the split changed from 50/25/25 to
    // 50/30/20, because the shares are constants and the contract had to be
    // replaced rather than adjusted. An assertion that has to be edited whenever
    // a contract is redeployed is measuring the state, not the rule, which is
    // exactly what the comment above this test warns about.
    for (const stream of STREAMS) {
      for (const share of stream.shares) {
        expect(receiverOf(share.to), `${stream.id} pays ${share.to}`).not.toBeNull();
      }
    }
  });
});

describe("what a mint costs", () => {
  it("is one card or ten and nothing else", () => {
    expect(MINT_OPTIONS.map((option) => option.id)).toEqual(["single", "pack"]);
    expect(MINT_OPTIONS.map((option) => option.cards)).toEqual([1, 10]);
  });

  it("is the price the maker settled", () => {
    const price = (id: string) => MINT_OPTIONS.find((option) => option.id === id)!.cro;
    expect(price("single")).toBe(15);
    expect(price("pack")).toBe(100);
  });

  it("makes the pack the cheaper way in, which is the only reason it exists", () => {
    const [single, pack] = MINT_OPTIONS;
    expect(croPerCard(pack!)).toBeLessThan(croPerCard(single!));
    // Ten singles are 150 and a pack is 100: a third off, not a rounding.
    expect(croPerCard(pack!)).toBe(10);
    expect(pack!.cards * single!.cro - pack!.cro).toBe(50);
  });
});

describe("paying the holders", () => {
  it("goes to the drop contract, because holders are not a wallet", () => {
    expect(receiverOf("holders")).toBe(CONTRACTS.drop);
  });

  it("is named as itself and not as a wallet", () => {
    // Not pinned to the sentence, which is copy and may be reworded. What it
    // has to say is which token and who gets it, and it must never fall back to
    // naming the wallet that happens to be near it.
    expect(nameOf("holders")).toMatch(/\$CROCARD/);
    expect(nameOf("holders")).toMatch(/hold/i);
    for (const wallet of Object.values(WALLETS)) {
      expect(nameOf("holders")).not.toBe(wallet.what);
    }
  });

  it("does not claim to be running while nobody has said how a share-out works", () => {
    const mints = STREAMS.find((stream) => stream.id === "mints")!;
    expect(mints.live).toBe(false);
    expect(mints.open).toBeTruthy();
  });
});

describe("the split is written in two languages", () => {
  /**
   * `lib/revenue.ts` says where the money goes for the site and
   * `contracts/Splitter.sol` says it for the money itself. Two files holding one
   * truth is the thing this project has a rule about — the old card data lived
   * in two places and the frontend shipped the wrong one eight times — and here
   * the two cannot be one file, because one of them is Solidity.
   *
   * So they are checked against each other instead. A split changed in the
   * TypeScript and not in the contract is a page that describes a division the
   * chain is not doing.
   */
  it("agrees with contracts/Splitter.sol", () => {
    const source = readFileSync(
      new URL("../contracts/Splitter.sol", import.meta.url),
      "utf8",
    );
    const bps = (name: string) => {
      const found = source.match(
        new RegExp(`${name}\\s*=\\s*([0-9_]+)\\s*;`),
      );
      expect(found, `${name} is not in the contract`).toBeTruthy();
      return Number(found![1]!.replace(/_/g, ""));
    };

    const mints = STREAMS.find((stream) => stream.id === "mints")!;
    const share = (to: string) => mints.shares.find((s) => s.to === to)!.percent;

    expect(bps("HOLDERS_BPS")).toBe(share("holders") * 100);
    expect(bps("BURN_BPS")).toBe(share("burn") * 100);
    expect(bps("POT_BPS")).toBe(share("tournament") * 100);
    expect(bps("HOLDERS_BPS") + bps("BURN_BPS") + bps("POT_BPS")).toBe(10_000);
  });

  it("agrees with contracts/PrizePot.sol about the ceiling on a week", () => {
    // The site tells people a week pays at most one percent of supply. The
    // contract is what actually holds a winner to it, and a ceiling raised in
    // one file and not the other is a page making a promise the chain is not
    // keeping — or, worse, keeping one the page does not mention.
    const source = readFileSync(new URL("../contracts/PrizePot.sol", import.meta.url), "utf8");
    const found = source.match(/DEFAULT_MOST_PER_WEEK\s*=\s*([0-9_]+)\s*ether\s*;/);
    expect(found, "DEFAULT_MOST_PER_WEEK is not in the contract").toBeTruthy();

    expect(Number(found![1]!.replace(/_/g, ""))).toBe(MOST_PER_WEEK);
    expect(MOST_PER_WEEK).toBe(CROCARD_SUPPLY / 100);

    // And the constructor uses it, rather than declaring it and setting
    // something else — which would compile, and pass every test that only reads
    // the constant.
    expect(source).toMatch(/mostPerWeek\s*=\s*DEFAULT_MOST_PER_WEEK\s*;/);
  });

  it("is the same split for every stream, so one contract can do all of them", () => {
    // The Splitter cannot tell a mint from a royalty from a rake — CRO arrives
    // and it does not announce where it came from. That only works because the
    // three streams divide identically, and this is what would catch somebody
    // changing one of them and leaving the chain doing something else.
    const shapes = STREAMS.map((stream) =>
      [...stream.shares]
        .sort((a, b) => a.to.localeCompare(b.to))
        .map((share) => `${share.to}:${share.percent}`)
        .join(" "),
    );
    expect(new Set(shapes).size, `streams divide differently: ${shapes.join(" | ")}`).toBe(1);
  });
});
