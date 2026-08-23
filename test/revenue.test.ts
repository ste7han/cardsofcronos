// Where the money goes.
//
// These are the numbers with the worst failure mode in the repository. A split
// that does not add up leaves a remainder sitting wherever it landed, and a
// mistyped address is a valid-looking string that money goes to and never comes
// back from. Neither shows up as an error anywhere — which is why they are
// checked at load and checked again here.

import { describe, expect, it } from "vitest";

import { base58Decode, base58Encode } from "@/lib/base58";
import { STREAMS, WALLETS, nameOf, walletFor } from "@/lib/revenue";

describe("the wallets", () => {
  it("are Solana addresses and not things that look like one", () => {
    for (const wallet of Object.values(WALLETS)) {
      expect(base58Decode(wallet.address)).toHaveLength(32);
      // Round-tripped as well as decoded: a string can decode to 32 bytes and
      // still not be the address somebody meant to type.
      expect(base58Encode(base58Decode(wallet.address))).toBe(wallet.address);
    }
  });

  it("are all different wallets", () => {
    // Two of these being the same address would be a split that quietly pays one
    // party twice, and it would look completely normal on the page.
    const addresses = Object.values(WALLETS).map((wallet) => wallet.address);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("are addresses and never keys", () => {
    for (const wallet of Object.values(WALLETS)) {
      expect(base58Decode(wallet.address)).toHaveLength(32);
    }
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

    expect(share("creator-fee", "creator")).toBe(50);
    expect(share("creator-fee", "marketing")).toBe(20);
    expect(share("creator-fee", "burn")).toBe(20);
    expect(share("creator-fee", "tournament")).toBe(10);

    expect(share("mints", "burn")).toBe(75);
    expect(share("mints", "creator")).toBe(25);

    expect(share("royalties", "burn")).toBe(75);
    expect(share("royalties", "creator")).toBe(25);

    // The one stream players pay directly, and all of it goes into the token.
    expect(share("rake", "burn")).toBe(100);
    expect(by("rake").shares).toHaveLength(1);
  });
});

describe("burning", () => {
  it("always runs through the deployer", () => {
    // One wallet does every buy-and-burn, so all of it lands somewhere anybody
    // can watch. A second burning wallet would mean a total nobody can add up.
    expect(walletFor("burn").address).toBe(WALLETS.deployer.address);
    for (const stream of STREAMS) {
      for (const share of stream.shares) {
        if (share.to !== "burn") continue;
        expect(walletFor(share.to).id).toBe("deployer");
      }
    }
  });

  it("is named as itself and not as a wallet", () => {
    expect(nameOf("burn")).toMatch(/burn/i);
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
    // There is no token. Every one of these needs it.
    expect(STREAMS.every((stream) => !stream.live)).toBe(true);
  });
});
