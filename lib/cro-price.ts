// What a CRO is worth in dollars, read off the chain.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
//
// Nothing else in this project is priced in dollars, and that is deliberate: a
// mint costs CRO, a stake is CRO, a prize is CRO, and the market cap in the game
// is the game's own number. This is here for one job — the Telegram buy feed
// shows buys above a floor the maker set in dollars, and a buy is denominated in
// CRO. So it is a conversion, used once, at the edge.
//
// ── IT WAS COINGECKO FOR ONE DEPLOY, AND THAT DID NOT WORK ───────────────────
//
// The first version asked CoinGecko's public endpoint. It works from a laptop
// and returns nothing from inside a Cloudflare Worker: that endpoint refuses
// datacentre egress, and Workers are datacentre egress. The failure was exactly
// the shape this file's fallback was written for — a log line and no floor — so
// nothing broke and nothing worked, and the only sign was an empty `prices`
// table after a hundred feed runs.
//
// Reading it on chain is better on every count that matters here: no API to be
// rate-limited by, no key, no third party deciding whether a Worker may ask, and
// the same RPCs the rest of the project already depends on.
//
// ── NONE OF THESE ADDRESSES WERE TAKEN ON TRUST ──────────────────────────────
//
// Each was derived or verified by asking the chain on 5 October 2026:
//
//   WCRO     POOL.token0(), and its symbol() says WCRO
//   factory  LION_ROUTER.factory() — VVS, which is where the deep CRO
//            liquidity is; see the note on LION_ROUTER
//   USDC     symbol() says USDC and decimals() says 6
//   the pair factory.getPair(WCRO, USDC), holding 46,343,964 WCRO
//
// It priced CRO at 0.068809 while CoinGecko said 0.068897 — a tenth of a per
// cent apart, which is what made it safe to replace one with the other. The
// USDT pair exists too and agreed to five decimal places, on a twelfth of the
// liquidity, so USDC is the one used.
//
// ── IT IS ALLOWED TO BE OLD AND NOT ALLOWED TO BE ABSENT ─────────────────────
//
// A Worker isolate lives for one request, so a price read in memory is a price
// read again every minute. It is kept in D1 instead and read back when the
// chain cannot be reached: a floor applied against an hour-old CRO price is
// indistinguishable from one applied against this minute's, because CRO does
// not move 20% in an hour and the question is only "was that five dollars".
//
// What it must never do is decide the answer is zero. A price of zero would let
// every dust buy through, or — worse, depending on which way the comparison is
// written — hold every real buy back. Absent is returned as null and the caller
// decides, loudly.

import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector } from "@/lib/evm-tx";
import type { Database } from "@/lib/store";

/** The VVS WCRO/USDC pair. See the header for how it was found and checked. */
export const CRO_USDC_PAIR = "0xe61db569e231b3f5530168aa2c9d50246525b6d6";
/** Wrapped CRO, which is one side of that pair. */
export const WCRO = "0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23";
/** USDC has six, not eighteen. Read from the token, not assumed. */
export const USDC_DECIMALS = 6;

/**
 * How stale a stored price may be before it is worth reading again.
 *
 * Ten minutes. The feed runs every minute, and two RPC calls a minute for ever
 * is a cost with nothing to show for it when the answer moves by a fraction of
 * a per cent.
 */
export const REFRESH_AFTER = 10 * 60 * 1000;

export interface Priced {
  /** Dollars per CRO. */
  usd: number;
  /** Where it came from, for the log line when something is wrong. */
  from: "chain" | "stored";
  /** When that price was read. */
  at: number;
}

/**
 * Reads the kept price, however old.
 *
 * Catching here and not only around the read, because this is reached from the
 * feed cron — the most important job in the Worker — and a table that does not
 * exist yet must not take the burns and the mints down with it. A deploy that
 * lands before its migration is a thing that happens, and the answer to "I
 * could not read a price" is null, not a thrown feed run.
 */
export async function storedCroUsd(db: Database): Promise<Priced | null> {
  try {
    const row = await db
      .prepare(`SELECT micro_usd, at FROM prices WHERE symbol = 'CRO'`)
      .first<{ micro_usd: number; at: number }>();
    if (row === null || row.micro_usd <= 0) return null;
    return { usd: row.micro_usd / 1_000_000, from: "stored", at: row.at };
  } catch (error) {
    console.error("[price] the prices table could not be read:", error);
    return null;
  }
}

/**
 * The pair's two reserves, as dollars per CRO.
 *
 * `token0()` is read rather than assumed, and that is the difference between a
 * price and its reciprocal: getting it the wrong way round turns 0.069 into
 * 14.5, which would let every dust buy through while looking like a number.
 */
async function fromTheChain(rpcs: readonly string[]): Promise<number> {
  const call = (data: string) =>
    rpc<string>(rpcs, "eth_call", [{ to: CRO_USDC_PAIR, data }, "latest"]);

  const [reservesHex, token0Hex] = await Promise.all([
    call(selector("getReserves()")),
    call(selector("token0()")),
  ]);

  const packed = reservesHex.replace(/^0x/, "");
  if (packed.length < 128) throw new Error(`getReserves gave ${packed.length} hex digits`);
  const reserve0 = BigInt("0x" + packed.slice(0, 64));
  const reserve1 = BigInt("0x" + packed.slice(64, 128));
  const token0 = "0x" + token0Hex.replace(/^0x/, "").slice(24).toLowerCase();

  const croIsFirst = token0 === WCRO.toLowerCase();
  const cro = croIsFirst ? reserve0 : reserve1;
  const usd = croIsFirst ? reserve1 : reserve0;
  if (cro === 0n || usd === 0n) throw new Error("the pair holds nothing on one side");

  return Number(usd) / 10 ** USDC_DECIMALS / (Number(cro) / 1e18);
}

/**
 * The price, read again if the kept one is stale, and kept when it is read.
 *
 * Returns null only when there has never been a price AND the chain could not
 * be reached. The caller treats that as "no floor" rather than as "nothing
 * passes": a buy feed that goes silent looks broken, and showing one small buy
 * is the cheaper mistake.
 */
export async function croUsd(
  db: Database,
  now: number,
  secretRpc?: string | null,
): Promise<Priced | null> {
  const kept = await storedCroUsd(db);
  if (kept !== null && now - kept.at < REFRESH_AFTER) return kept;

  try {
    const usd = await fromTheChain(secretRpc ? [secretRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS);
    // Zero, negative and NaN are not prices. NaN in particular compares false
    // against everything, so it would silently hide every buy.
    if (!Number.isFinite(usd) || usd <= 0) {
      throw new Error(`the pair priced CRO at ${usd}`);
    }

    await db
      .prepare(
        `INSERT INTO prices (symbol, micro_usd, at) VALUES ('CRO', ?, ?)
         ON CONFLICT (symbol) DO UPDATE SET micro_usd = excluded.micro_usd, at = excluded.at`,
      )
      .bind(Math.round(usd * 1_000_000), now)
      .run();

    return { usd, from: "chain", at: now };
  } catch (error) {
    // Loud, and then the old price. A feed quietly running without a floor for
    // a week is the failure this is written to avoid — and is what happened
    // while this read CoinGecko.
    console.error(
      `[price] CRO/USD could not be read, falling back to ${kept === null ? "nothing" : "the stored price"}:`,
      error,
    );
    return kept;
  }
}
