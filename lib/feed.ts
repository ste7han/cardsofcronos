// Three Discord feeds: cards minted, $CROCARD bought, $CROCARD burned.
//
// A run reads the blocks since it last looked and posts what it finds. Each feed
// has its own cursor and its own webhook, and a feed that cannot post does not
// stop the other two — one broken webhook should cost one channel, not all
// three.
//
// ── IT IS DRIVEN FROM TWO PLACES, ON PURPOSE ─────────────────────────────────
//
// A cron every minute, and ordinary page traffic. Not belt and braces for its
// own sake: the cron stopped firing on the day this was written — the daily job
// had run twenty hours earlier, and then three separate schedules, including
// four fixed minutes and a catch-all fallback in the scheduled handler,
// produced nothing at all. A channel people watch should not be one scheduler
// away from silence.
//
// Traffic is a better driver than it sounds for the thing that matters most
// here. A mint happens because somebody is on the mint page, so the busiest the
// site ever is, is exactly when there is something to report.
//
// Both drivers call the same code and `notWithin` keeps them from tripping over
// each other: a run that has just happened is declined rather than repeated.
//
// ── WHY A CURSOR AND A LEDGER, RATHER THAN ONE OR THE OTHER ──────────────────
//
// The cursor says how far the chain has been read. The ledger says which logs
// have already been posted. Both, because the two failure modes are different
// and both are real: the cursor alone means a run that posted and then failed to
// save reposts everything, and the ledger alone means every run rescans the
// chain from the beginning.
//
// The order is post, then record, then move the cursor. So the worst a crash can
// do is repeat a line somebody sees, rather than silently skip one nobody does.
//
// ── IT STARTS AT THE HEAD, NOT AT THE BEGINNING ──────────────────────────────
//
// A feed with no cursor starts one block back. The alternative — reading from
// the token's first block — is a channel filling with four years of history the
// moment it is switched on, and none of it is news. What happened before this
// was turned on belongs in the explorer.
//
// ── AND IT WILL NOT FLOOD ────────────────────────────────────────────────────
//
// When a sale opens, a minute can hold more mints than anybody wants as separate
// lines. Past a handful they collapse into one message that says how many and
// what they came to. The individual transactions are on the explorer; the
// channel's job is to say that something is happening.

import { LOG_RPCS, PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector, topicOf, word } from "@/lib/evm-tx";
import { post, type Embed } from "@/lib/discord";
import { TRANSFER } from "@/lib/mint";
import { BURN_ADDRESS, CONTRACTS, CROCARD, POOL } from "@/lib/revenue";
import { cursorOf, setCursor } from "@/lib/store";
import { EXPLORER } from "@/lib/units";
import type { Database } from "@/lib/store";

/** The most blocks one eth_getLogs may span. evm.cronos.org refuses 2001. */
export const CHUNK = 2000;

/** Past this many in one run, a feed posts a summary instead of a line each. */
export const TOO_MANY = 6;

export const BOUGHT = topicOf("Bought(address,uint256,uint256)");
export const CLAIMED = topicOf("Claimed(address,uint256)");
export const SWAP = topicOf("Swap(address,uint256,uint256,uint256,uint256,address)");


/** Cards of Cronos purple, as Discord wants it: one integer. */
const PURPLE = 0x9d4edd;
const GOLD = 0xffd700;
const GREEN = 0x3fb950;

export interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

/** One log's identity, which is what the ledger remembers. */
export const idOf = (feed: string, log: Log): string =>
  `${feed}:${log.transactionHash.toLowerCase()}:${Number(BigInt(log.logIndex))}`;

const wordAt = (data: string, n: number): bigint => {
  const hex = data.replace(/^0x/, "");
  const at = hex.slice(n * 64, (n + 1) * 64);
  if (at.length !== 64) throw new Error(`Asked for word ${n} of ${hex.length / 64}.`);
  return BigInt("0x" + at);
};

/** An indexed address topic, as an address. */
const addressIn = (topic: string): string => "0x" + topic.slice(-40);

/**
 * When a log's block was mined, as an ISO string, or null when it cannot be had.
 *
 * Discord shows an embed's timestamp as a time, and the honest value is when the
 * thing happened rather than when this got round to mentioning it. Those are the
 * same thing on a healthy minute and hours apart after a quiet night — the feed
 * only runs on a tick or a page view, so a site nobody visits overnight wakes up
 * behind, and stamping those with `now` would announce a buy from three in the
 * morning as if it had just happened.
 *
 * One call per block that actually had an event, not per block scanned, and
 * answers are shared inside a run: a burst of mints is usually one block.
 */
async function minedAt(
  rpcs: readonly string[],
  block: string,
  seen: Map<string, string | null>,
): Promise<string | null> {
  const had = seen.get(block);
  if (had !== undefined) return had;
  try {
    const head = await rpc<{ timestamp: string } | null>(rpcs, "eth_getBlockByNumber", [
      block,
      false,
    ]);
    const at =
      head === null ? null : new Date(Number(BigInt(head.timestamp)) * 1000).toISOString();
    seen.set(block, at);
    return at;
  } catch {
    // An embed with no timestamp is a message without a time on it, which is
    // better than a message with the wrong one.
    seen.set(block, null);
    return null;
  }
}

/** 1234567890123456789012 wei as "1,234.57". Whole numbers lose the decimals. */
export function amount(base: bigint, decimals = 18, places = 2): string {
  const whole = base / 10n ** BigInt(decimals);
  const rest = Number((base % 10n ** BigInt(decimals)) / 10n ** BigInt(decimals - 6)) / 1e6;
  const n = Number(whole) + rest;
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 1000 ? 0 : places,
  });
}

const short = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;
const txLink = (hash: string): string => `${EXPLORER}/tx/${hash}`;

/** What one feed did, so the cron's answer says something worth reading. */
export interface RanFeed {
  feed: string;
  from: number | null;
  to: number | null;
  found: number;
  posted: number;
  skipped?: string;
  wrong?: string;
}

export interface RanFeeds {
  head: number | null;
  feeds: RanFeed[];
  /** True when it declined to run because it had just run. Not a failure. */
  tooSoon?: boolean;
}

/**
 * When the feeds last finished a run, or null when they never have.
 *
 * The newest of the three cursors. Not the oldest: a feed that is stalled on a
 * webhook nobody has fixed would otherwise hold the answer back forever and
 * every page view would rescan the chain.
 */
async function lastRunAt(db: Database): Promise<number | null> {
  const row = await db
    .prepare(`SELECT MAX(at) AS at FROM cursors WHERE name LIKE 'feed:%'`)
    .first<{ at: number | null }>();
  return row?.at ?? null;
}

/**
 * The ledger of what has already gone out.
 *
 * `INSERT OR IGNORE` and then reading back which ids are present, rather than
 * trusting `changes`: D1 batches, and a batch's per-statement change count is
 * not something to build a "did anybody already see this" answer on.
 */
async function alreadyPosted(db: Database, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const marks = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT id FROM feed_posted WHERE id IN (${marks})`)
    .bind(...ids)
    .all<{ id: string }>();
  return new Set((results ?? []).map((row) => row.id));
}

async function remember(db: Database, ids: readonly string[], at: number): Promise<void> {
  // One at a time. lib/store.ts keeps the Database interface down to what this
  // project actually uses and `batch` is not in it — and the counts here are a
  // handful per run, not a migration.
  for (const id of ids) {
    await db
      .prepare(`INSERT OR IGNORE INTO feed_posted (id, at) VALUES (?, ?)`)
      .bind(id, at)
      .run();
  }
}

/** Reads one contract's logs over a range, or [] when there is nothing. */
async function logsBetween(
  rpcs: readonly string[],
  address: string,
  topics: (string | string[] | null)[],
  from: number,
  to: number,
): Promise<Log[]> {
  return rpc<Log[]>(rpcs, "eth_getLogs", [
    {
      address,
      topics,
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + to.toString(16),
    },
  ]);
}

/**
 * Runs one feed end to end.
 *
 * Returns what happened rather than throwing, for the reason the daily job does:
 * a scheduled thing that errors on the ordinary quiet minute is a scheduled
 * thing whose alerts get muted.
 */
async function runOne(
  db: Database,
  opts: {
    feed: string;
    webhook: string | undefined;
    address: string | null;
    topics: (string | string[] | null)[];
    rpcs: readonly string[];
    logRpcs: readonly string[];
    head: number;
    now: number;
    /** Turns the logs into messages. Empty means there was nothing worth saying. */
    say: (logs: Log[], rpcs: readonly string[]) => Promise<Embed[]>;
  },
): Promise<RanFeed> {
  const { feed, webhook, address, topics, logRpcs, head, now, say } = opts;
  const nothing: RanFeed = { feed, from: null, to: null, found: 0, posted: 0 };

  if (!webhook) return { ...nothing, skipped: "no webhook set" };
  if (address === null) return { ...nothing, skipped: "nothing deployed to watch" };

  const seen = await cursorOf(db, `feed:${feed}`);
  // Never run: start one block back, so the first tick reports the present
  // rather than the archive. See the note at the top.
  const from = seen === null ? Math.max(0, head - 1) : seen + 1;
  if (from > head) return { ...nothing, from, to: head, skipped: "no new blocks" };
  const to = Math.min(head, from + CHUNK - 1);

  let logs: Log[];
  try {
    logs = await logsBetween(logRpcs, address, topics, from, to);
  } catch (error) {
    // The cursor stays where it is. A range that could not be read is a range
    // to try again, not one to skip past.
    return { ...nothing, from, to, wrong: error instanceof Error ? error.message : "getLogs failed" };
  }

  const ids = logs.map((log) => idOf(feed, log));
  const old = await alreadyPosted(db, ids);
  const fresh = logs.filter((log) => !old.has(idOf(feed, log)));

  if (fresh.length === 0) {
    await setCursor(db, `feed:${feed}`, to, now);
    return { ...nothing, from, to, found: logs.length };
  }

  let embeds: Embed[];
  try {
    embeds = await say(fresh, opts.rpcs);
  } catch (error) {
    return {
      ...nothing,
      from,
      to,
      found: fresh.length,
      wrong: error instanceof Error ? error.message : "the message could not be built",
    };
  }

  const sent = await post(webhook, embeds);
  if (!sent.ok) {
    // Cursor and ledger both untouched, so the next run tries this range again.
    return { ...nothing, from, to, found: fresh.length, wrong: sent.wrong ?? "the post failed" };
  }

  await remember(db, fresh.map((log) => idOf(feed, log)), now);
  await setCursor(db, `feed:${feed}`, to, now);
  return { feed, from, to, found: fresh.length, posted: embeds.length };
}

/** Cards minted: bought and claimed, which are two events and one sentence. */
export async function sayMints(logs: Log[], rpcs: readonly string[]): Promise<Embed[]> {
  const nft = CONTRACTS.nft!;
  const times = new Map<string, string | null>();
  // How far along the mint is, asked once for the whole batch. It is the number
  // that makes a mint line mean something — five cards out of 5,603 reads
  // differently from five out of the last twenty.
  let minted: number | null = null;
  try {
    const next = await rpc(rpcs, "eth_call", [
      { to: nft, data: selector("nextTokenId()") },
      "latest",
    ]);
    minted = Number(BigInt(next)) - 1;
  } catch {
    // A missing counter costs a line in the footer, not the message.
  }
  const outOf = minted === null ? "" : `${minted.toLocaleString("en-US")} of 5,603 minted`;

  if (logs.length > TOO_MANY) {
    let cards = 0;
    let paid = 0n;
    for (const log of logs) {
      if (log.topics[0] === BOUGHT) {
        cards += Number(wordAt(log.data, 0));
        paid += wordAt(log.data, 1);
      } else {
        cards += Number(wordAt(log.data, 0));
      }
    }
    return [
      {
        title: `${cards} cards minted`,
        description:
          `${logs.length} transactions` +
          (paid > 0n ? `, ${amount(paid)} CRO paid` : "") +
          `\n[every one of them on the explorer](${EXPLORER}/address/${nft})`,
        color: PURPLE,
        footer: outOf ? { text: outOf } : undefined,
        // The last of them, which is when the burst had finished.
        timestamp: (await minedAt(rpcs, logs[logs.length - 1]!.blockNumber, times)) ?? undefined,
      },
    ];
  }

  return Promise.all(
    logs.map(async (log) => {
    const who = short(addressIn(log.topics[1]!));
    const cards = Number(wordAt(log.data, 0));
    const free = log.topics[0] === CLAIMED;
    const paid = free ? 0n : wordAt(log.data, 1);
    return {
      title: free
        ? `${who} claimed ${cards} free ${cards === 1 ? "card" : "cards"}`
        : `${who} minted ${cards} ${cards === 1 ? "card" : "cards"}`,
      description: free
        ? "A free mint, for holding the 2025 collection."
        : `${amount(paid)} CRO`,
      url: txLink(log.transactionHash),
      color: free ? GOLD : PURPLE,
      footer: outOf ? { text: outOf } : undefined,
      timestamp: (await minedAt(rpcs, log.blockNumber, times)) ?? undefined,
    };
    }),
  );
}

/**
 * $CROCARD bought on the pool.
 *
 * token0 is WCRO and token1 is $CROCARD — read off the pair and not assumed,
 * because the pair sorts its tokens by address and the other order is just as
 * likely. A buy is $CROCARD leaving the pool, so `amount1Out` above zero; a sell
 * is the same log with the other two fields filled in, and it is left out.
 */
export async function sayBuys(logs: Log[], rpcs: readonly string[]): Promise<Embed[]> {
  const times = new Map<string, string | null>();
  const buys = logs
    .map((log) => ({
      log,
      croIn: wordAt(log.data, 0),
      gotOut: wordAt(log.data, 3),
    }))
    .filter((one) => one.gotOut > 0n);
  if (buys.length === 0) return [];

  if (buys.length > TOO_MANY) {
    const cro = buys.reduce((sum, one) => sum + one.croIn, 0n);
    const got = buys.reduce((sum, one) => sum + one.gotOut, 0n);
    return [
      {
        title: `${buys.length} buys`,
        description: `${amount(got)} $CROCARD for ${amount(cro)} CRO`,
        url: `${EXPLORER}/address/${POOL}`,
        color: GREEN,
        timestamp:
          (await minedAt(rpcs, buys[buys.length - 1]!.log.blockNumber, times)) ?? undefined,
      },
    ];
  }

  return Promise.all(
    buys.map(async (one) => ({
      title: `${amount(one.gotOut)} $CROCARD bought`,
      description: `for ${amount(one.croIn)} CRO`,
      url: txLink(one.log.transactionHash),
      color: GREEN,
      timestamp: (await minedAt(rpcs, one.log.blockNumber, times)) ?? undefined,
    })),
  );
}

/** $CROCARD sent to the dead address, and how much is there now. */
export async function sayBurns(logs: Log[], rpcs: readonly string[]): Promise<Embed[]> {
  const times = new Map<string, string | null>();
  let held: string | null = null;
  try {
    const answer = await rpc(rpcs, "eth_call", [
      { to: CROCARD, data: selector("balanceOf(address)") + word(BURN_ADDRESS) },
      "latest",
    ]);
    held = `${amount(BigInt(answer))} $CROCARD burned in total`;
  } catch {
    // Same as the mint counter: the footer goes, the message stays.
  }

  const burned = logs.map((log) => ({ log, howMuch: wordAt(log.data, 0) }));

  if (burned.length > TOO_MANY) {
    const all = burned.reduce((sum, one) => sum + one.howMuch, 0n);
    return [
      {
        title: `${amount(all)} $CROCARD burned`,
        description: `across ${burned.length} transactions`,
        url: `${EXPLORER}/address/${BURN_ADDRESS}`,
        color: 0xff6b35,
        footer: held ? { text: held } : undefined,
        timestamp:
          (await minedAt(rpcs, burned[burned.length - 1]!.log.blockNumber, times)) ?? undefined,
      },
    ];
  }

  return Promise.all(
    burned.map(async (one) => ({
      title: `${amount(one.howMuch)} $CROCARD burned`,
      description: `Sent to the dead address, where nothing comes back from.`,
      url: txLink(one.log.transactionHash),
      color: 0xff6b35,
      footer: held ? { text: held } : undefined,
      timestamp: (await minedAt(rpcs, one.log.blockNumber, times)) ?? undefined,
    })),
  );
}

/**
 * Every feed, once.
 *
 * Sequential rather than parallel, and not for correctness: three feeds on one
 * free RPC, started at the same moment, is three ways to be rate-limited into
 * looking like a quiet minute.
 */
export async function runFeeds(
  db: Database,
  secrets: {
    rpc?: string;
    mints?: string;
    buys?: string;
    burns?: string;
  },
  now: number,
  /**
   * Skip entirely if a run finished less recently than this many milliseconds
   * ago. Null runs regardless, which is what a scheduled tick wants.
   *
   * It exists because the feed is driven from two places — a cron and ordinary
   * page traffic — and a busy page would otherwise scan the chain once per
   * visitor. The clock it reads is the cursor's, so every driver shares one
   * answer to "has this just run" rather than each keeping its own.
   */
  notWithin: number | null = null,
): Promise<RanFeeds> {
  if (notWithin !== null) {
    const last = await lastRunAt(db);
    if (last !== null && now - last < notWithin) {
      return { head: null, feeds: [], tooSoon: true };
    }
  }

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const logRpcs = secrets.rpc ? [secrets.rpc, ...LOG_RPCS] : LOG_RPCS;

  let head: number;
  try {
    head = Number(BigInt(await rpc(rpcs, "eth_blockNumber", [])));
  } catch (error) {
    return {
      head: null,
      feeds: [
        {
          feed: "all",
          from: null,
          to: null,
          found: 0,
          posted: 0,
          wrong: error instanceof Error ? error.message : "the chain could not be reached",
        },
      ],
    };
  }

  const feeds: RanFeed[] = [];
  const common = { rpcs, logRpcs, head, now };

  feeds.push(
    await runOne(db, {
      ...common,
      feed: "mints",
      webhook: secrets.mints,
      address: CONTRACTS.nft,
      // Either event, which is what an array in the first topic slot means.
      topics: [[BOUGHT, CLAIMED]],
      say: sayMints,
    }),
  );

  feeds.push(
    await runOne(db, {
      ...common,
      feed: "buys",
      webhook: secrets.buys,
      address: POOL,
      topics: [SWAP],
      say: sayBuys,
    }),
  );

  feeds.push(
    await runOne(db, {
      ...common,
      feed: "burns",
      webhook: secrets.burns,
      address: CROCARD,
      // Transfer, from anybody, to the dead address. The `to` is the third
      // topic, so `null` in the second says "whoever sent it".
      topics: [TRANSFER, null, "0x" + word(BURN_ADDRESS)],
      say: sayBurns,
    }),
  );

  return { head, feeds };
}
