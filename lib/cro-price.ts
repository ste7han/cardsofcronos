// What a CRO is worth in dollars.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
//
// Nothing else in this project is priced in dollars, and that is deliberate: a
// mint costs CRO, a stake is CRO, a prize is CRO, and the market cap in the game
// is the game's own number. This is here for one job — the Telegram buy feed
// shows buys above a floor the maker set in dollars, and a buy is denominated in
// CRO. So it is a conversion, used once, at the edge.
//
// ── IT IS ALLOWED TO BE OLD AND NOT ALLOWED TO BE ABSENT ─────────────────────
//
// A Worker isolate lives for one request, so a price fetched in memory is a
// price fetched again every minute. It is kept in D1 instead, and read back
// when the fetch fails: a floor applied against an hour-old CRO price is
// indistinguishable from one applied against this minute's, because CRO does
// not move 20% in an hour and the question is only "was that five dollars".
//
// What it must never do is decide the answer is zero. A price of zero would let
// every dust buy through, or — worse, depending on which way the comparison is
// written — hold every real buy back. Absent is returned as null and the caller
// decides, loudly.

import type { Database } from "@/lib/store";

/** CoinGecko's id for Cronos' own coin. Not "cronos", which is the chain. */
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price?ids=crypto-com-chain&vs_currencies=usd";

/**
 * How stale a stored price may be before it is worth asking again.
 *
 * Ten minutes. The feed runs every minute and most minutes have no buy in them,
 * so this is asked far less often than that — and a public API called once a
 * minute for ever is a public API that starts refusing.
 */
export const REFRESH_AFTER = 10 * 60 * 1000;

export interface Priced {
  /** Dollars per CRO. */
  usd: number;
  /** Where it came from, for the log line when something is wrong. */
  from: "api" | "stored";
  /** When that price was read. */
  at: number;
}

/**
 * Reads the kept price, however old.
 *
 * Catching here and not only around the fetch, because this is reached from the
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
 * The price, fetched if the kept one is stale, and kept when it is fetched.
 *
 * Returns null only when there has never been a price AND the fetch failed,
 * which is one window on one deployment. The caller treats that as "no floor"
 * rather than as "nothing passes": a buy feed that goes silent looks broken,
 * and showing one small buy is the cheaper mistake.
 */
export async function croUsd(db: Database, now: number): Promise<Priced | null> {
  const kept = await storedCroUsd(db);
  if (kept !== null && now - kept.at < REFRESH_AFTER) return kept;

  try {
    const answer = await fetch(COINGECKO, { headers: { accept: "application/json" } });
    if (!answer.ok) throw new Error(`CoinGecko answered ${answer.status}`);
    const body = (await answer.json()) as { "crypto-com-chain"?: { usd?: number } };
    const usd = body["crypto-com-chain"]?.usd;
    // Zero and negative are not prices. A missing field reads as undefined and
    // would become NaN two lines down, which compares false against everything
    // and would silently hide every buy.
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
      throw new Error(`CoinGecko gave no usable price: ${JSON.stringify(body)}`);
    }

    await db
      .prepare(
        `INSERT INTO prices (symbol, micro_usd, at) VALUES ('CRO', ?, ?)
         ON CONFLICT (symbol) DO UPDATE SET micro_usd = excluded.micro_usd, at = excluded.at`,
      )
      .bind(Math.round(usd * 1_000_000), now)
      .run();

    return { usd, from: "api", at: now };
  } catch (error) {
    // Loud, and then the old price. A feed quietly running without a floor for
    // a week is the failure this is written to avoid.
    console.error(
      `[price] CRO/USD could not be read, falling back to ${kept === null ? "nothing" : "the stored price"}:`,
      error,
    );
    return kept;
  }
}
