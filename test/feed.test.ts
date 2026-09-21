// The Discord feeds, and the decoding underneath them.
//
// Everything here reads a log and turns it into a sentence somebody in a channel
// believes. That is a short path with two silent failures on it.
//
// The first is the topic. A wrong event signature matches nothing, and a feed
// that matches nothing is indistinguishable from a quiet afternoon — this token
// went a week without a trade while this was being written, so "the channel is
// empty" proves nothing at all.
//
// The second is the field order. A Uniswap V2 `Swap` log is four amounts in one
// blob and nothing in it says which is which, so reading them in the wrong order
// turns every sell into a buy. It is right in this file because the pair sorts
// its tokens by address and this pool happens to put WCRO first — which is a
// fact about this pool, checked against it, and not a rule.

import { describe, expect, it } from "vitest";

import { topicOf, word } from "@/lib/evm-tx";
import {
  BOUGHT,
  CLAIMED,
  CHUNK,
  SWAP,
  TOO_MANY,
  TRANSFER,
  amount,
  idOf,
  sayBurns,
  sayBuys,
  sayMints,
  type Log,
} from "@/lib/feed";

/** A log, with only the fields the feed reads. */
function log(over: Partial<Log> & { topics: string[]; data: string }): Log {
  return {
    address: "0x" + "a".repeat(40),
    blockNumber: "0x1",
    transactionHash: "0x" + "f".repeat(64),
    logIndex: "0x0",
    ...over,
  };
}

const amounts = (...values: bigint[]) => "0x" + values.map((v) => word(v)).join("");

describe("the events being watched", () => {
  it("are the ones the contracts actually emit", () => {
    // Typed out here rather than imported, so a signature changed in the
    // contract has to be changed in two places by somebody who looked at both.
    expect(BOUGHT).toBe(topicOf("Bought(address,uint256,uint256)"));
    expect(CLAIMED).toBe(topicOf("Claimed(address,uint256)"));
    expect(TRANSFER).toBe(topicOf("Transfer(address,address,uint256)"));
    // The Uniswap V2 pair event, which is the one value here that cannot be
    // derived from anything in this repository. Checked against a log pulled
    // off Cronos while this was written: 307 of them in 2,000 blocks, every one
    // with three topics and four data words.
    expect(SWAP).toBe("0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822");
  });

  it("scans a range the endpoint will actually serve", () => {
    // evm.cronos.org answers 2,001 blocks with "maximum [from, to] blocks
    // distance: 2000" rather than with the logs, and a job that asked for more
    // would fail every run without ever reading anything.
    expect(CHUNK).toBeLessThanOrEqual(2000);
  });
});

describe("telling one log from another", () => {
  it("keys on the log index and not only the transaction", () => {
    // One transaction can mint twice, burn twice, or buy through two pools. A
    // key that could not tell those apart would post the first and silently
    // drop the second.
    const tx = "0x" + "1".repeat(64);
    const first = idOf("mints", log({ topics: [BOUGHT], data: "0x", transactionHash: tx, logIndex: "0x0" }));
    const second = idOf("mints", log({ topics: [BOUGHT], data: "0x", transactionHash: tx, logIndex: "0x1" }));
    expect(first).not.toBe(second);
  });

  it("keeps the feeds apart, so one cannot mark another's work done", () => {
    const one = log({ topics: [TRANSFER], data: "0x" });
    expect(idOf("burns", one)).not.toBe(idOf("buys", one));
  });
});

describe("amounts, as somebody reads them", () => {
  it("shows the decimals that matter and drops the ones that do not", () => {
    expect(amount(10n ** 18n)).toBe("1");
    expect(amount(10n ** 18n * 3n / 2n)).toBe("1.5");
    // Past a thousand the cents are noise in a channel.
    expect(amount(1_234_567n * 10n ** 18n)).toBe("1,234,567");
    expect(amount(0n)).toBe("0");
  });

  it("does not lose the top of a number to a double", () => {
    // 890 million $CROCARD is past what a JS number counts exactly in base
    // units, which is the bug that would print a burn as a slightly wrong
    // enormous figure and nobody would check.
    expect(amount(890_000_000n * 10n ** 18n)).toBe("890,000,000");
  });
});

describe("a buy, which is half of a swap", () => {
  // token0 is WCRO and token1 is $CROCARD on this pool — read off the pair
  // itself. So CRO goes in as word 0 and $CROCARD comes out as word 3.
  const buy = log({ topics: [SWAP], data: amounts(5n * 10n ** 18n, 0n, 0n, 1000n * 10n ** 18n) });
  const sell = log({ topics: [SWAP], data: amounts(0n, 1000n * 10n ** 18n, 5n * 10n ** 18n, 0n) });

  it("reports a buy", async () => {
    const [embed] = await sayBuys([buy]);
    expect(embed!.title).toContain("1,000 $CROCARD bought");
    expect(embed!.description).toContain("5 CRO");
  });

  it("says nothing about a sell", async () => {
    // The channel is called CROCARD BUYS. A feed that reported both under that
    // name would be lying by its own title.
    expect(await sayBuys([sell])).toEqual([]);
  });

  it("picks the buys out of a mixed batch", async () => {
    const embeds = await sayBuys([sell, buy, sell]);
    expect(embeds).toHaveLength(1);
  });

  it("collapses a burst rather than posting a line each", async () => {
    const many = Array.from({ length: TOO_MANY + 2 }, () => buy);
    const embeds = await sayBuys(many);
    expect(embeds).toHaveLength(1);
    expect(embeds[0]!.title).toContain(`${many.length} buys`);
    expect(embeds[0]!.description).toContain("CRO");
  });
});

describe("a mint", () => {
  const who = "0x" + "b".repeat(40);
  const bought = log({
    topics: [BOUGHT, "0x" + word(who)],
    data: amounts(5n, 75n * 10n ** 18n),
  });
  const claimed = log({ topics: [CLAIMED, "0x" + word(who)], data: amounts(3n) });

  it("says who, how many and what it cost", async () => {
    const [embed] = await sayMints([bought], []);
    expect(embed!.title).toContain("minted 5 cards");
    expect(embed!.title).toContain("0xbbbb");
    expect(embed!.description).toContain("75 CRO");
  });

  it("says a free claim is free, rather than pricing it at zero", async () => {
    // Claimed has no `paid` word at all. Reading one would either throw or
    // report whatever followed in memory as a price.
    const [embed] = await sayMints([claimed], []);
    expect(embed!.title).toContain("claimed 3 free cards");
    expect(embed!.description).not.toContain("0 CRO");
  });

  it("counts one card as a card and two as cards", async () => {
    const one = log({ topics: [BOUGHT, "0x" + word(who)], data: amounts(1n, 15n * 10n ** 18n) });
    const [embed] = await sayMints([one], []);
    expect(embed!.title).toContain("minted 1 card");
    expect(embed!.title).not.toContain("1 cards");
  });

  it("adds up a burst of both kinds", async () => {
    const many = [...Array.from({ length: TOO_MANY }, () => bought), claimed];
    const embeds = await sayMints(many, []);
    expect(embeds).toHaveLength(1);
    // Six bought at five, plus three claimed.
    expect(embeds[0]!.title).toBe(`${TOO_MANY * 5 + 3} cards minted`);
  });

  it("still posts when the chain will not say how far along the mint is", async () => {
    // The footer is the nice-to-have. Losing the RPC must not lose the message
    // — an empty rpc list makes every call throw, which is the case here.
    const [embed] = await sayMints([bought], []);
    expect(embed!.title).toBeTruthy();
    expect(embed!.footer).toBeUndefined();
  });
});

describe("a burn", () => {
  const burn = log({ topics: [TRANSFER, "0x" + word("0x" + "c".repeat(40)), "0x" + word("0x000000000000000000000000000000000000dEaD")], data: amounts(50_000n * 10n ** 18n) });

  it("says how much went to the dead address", async () => {
    const [embed] = await sayBurns([burn], []);
    expect(embed!.title).toBe("50,000 $CROCARD burned");
  });

  it("collapses a burst", async () => {
    const many = Array.from({ length: TOO_MANY + 1 }, () => burn);
    const embeds = await sayBurns(many, []);
    expect(embeds).toHaveLength(1);
    expect(embeds[0]!.title).toBe(`${50_000 * many.length} $CROCARD burned`.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  });
});
