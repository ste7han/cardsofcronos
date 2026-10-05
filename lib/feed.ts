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
import { mirror, sendLines } from "@/lib/telegram-feed";
import { croUsd } from "@/lib/cro-price";
import { CROCARD_SUPPLY } from "@/data/holder-tiers";
import { bar, from, grouped, share, sizeOf } from "@/lib/flair";
import { recordBurns } from "@/lib/splitter";
import { TRANSFER } from "@/lib/mint";
import { BURN_ADDRESS, CONTRACTS, CROCARD, POOL } from "@/lib/revenue";
import { cursorOf, setCursor } from "@/lib/store";
import { recordEntries } from "@/lib/entries";
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

export const wordAt = (data: string, n: number): bigint => {
  const hex = data.replace(/^0x/, "");
  const at = hex.slice(n * 64, (n + 1) * 64);
  if (at.length !== 64) throw new Error(`Asked for word ${n} of ${hex.length / 64}.`);
  return BigInt("0x" + at);
};

/** An indexed address topic, as an address. */
export const addressIn = (topic: string): string => "0x" + topic.slice(-40);

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
export async function alreadyPosted(db: Database, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const marks = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT id FROM feed_posted WHERE id IN (${marks})`)
    .bind(...ids)
    .all<{ id: string }>();
  return new Set((results ?? []).map((row) => row.id));
}

export async function remember(db: Database, ids: readonly string[], at: number): Promise<void> {
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
export async function logsBetween(
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
    /** Where to mirror this, in Telegram. Absent for feeds that are not. */
    telegram?: {
      botToken?: string;
      chat?: string;
      /**
       * Which logs are worth a line in the channel. Everything, when absent.
       *
       * On the LOGS and not on the finished messages, which is what lets the
       * channel have a floor while Discord keeps showing every buy.
       */
      only?: (log: Log) => boolean;
      /**
       * How to write them, when a translated embed is the wrong shape.
       *
       * Absent means the embed goes through asText, which is right for a burn
       * and for the weekly result. Buys have their own: a buy bot is scanned
       * and an embed is read. The facts still come from the same functions —
       * see sayBuysForTelegram.
       */
      lines?: (logs: Log[], rpcs: readonly string[]) => Promise<{ what: string; html: string }[]>;
    };
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

  // After the ledger and the cursor, and on purpose. Those moved on the
  // strength of the Discord post, so a Telegram failure here is one missing
  // line in a channel — where holding them back until both succeeded would
  // repost the Discord line every run until Telegram came back. A missing line
  // beats a duplicated one. `mirror` never throws.
  //
  // A feed with a floor is rendered a second time over the logs that cleared
  // it. That costs one more `say` on the runs that have something to post, and
  // buys the channel its own threshold without Discord losing a line or a
  // second description of a buy existing anywhere.
  const toTelegram = opts.telegram;
  if (toTelegram?.botToken && toTelegram.chat) {
    const worth = toTelegram.only ? fresh.filter(toTelegram.only) : fresh;
    if (worth.length > 0) {
      if (toTelegram.lines) {
        await sendLines(toTelegram.botToken, toTelegram.chat, await toTelegram.lines(worth, opts.rpcs));
      } else {
        // Already rendered when nothing was filtered out, so the ordinary feed
        // costs no second pass.
        const same = worth.length === fresh.length;
        await mirror(
          toTelegram.botToken,
          toTelegram.chat,
          same ? embeds : await say(worth, opts.rpcs),
        );
      }
    }
  }

  return { feed, from, to, found: fresh.length, posted: embeds.length };
}

/**
 * Cards minted: bought and claimed, which are two events and one sentence.
 *
 * The line carries how far the whole mint has got, because that is the fact a
 * number of cards is only interesting against. Five cards out of five thousand
 * six hundred reads differently from five out of the last twenty left.
 */
export async function sayMints(logs: Log[], rpcs: readonly string[]): Promise<Embed[]> {
  const nft = CONTRACTS.nft!;
  const times = new Map<string, string | null>();

  // Asked once for the whole batch.
  let minted: number | null = null;
  let supply = 5603;
  try {
    const next = await rpc(rpcs, "eth_call", [
      { to: nft, data: selector("nextTokenId()") },
      "latest",
    ]);
    minted = Number(BigInt(next)) - 1;
    supply = Number(BigInt(await rpc(rpcs, "eth_call", [
      { to: nft, data: selector("maxSupply()") },
      "latest",
    ])));
  } catch {
    // A missing counter costs the bar, not the message.
  }

  const progress =
    minted === null
      ? null
      : `\n\`${bar(minted, supply)}\`  ${grouped(minted)} / ${grouped(supply)} · ${share(
          minted,
          supply,
        )}`;
  const left = minted === null ? null : `${grouped(supply - minted)} left · face down until the reveal`;

  if (logs.length > TOO_MANY) {
    let cards = 0;
    let paid = 0n;
    for (const log of logs) {
      cards += Number(wordAt(log.data, 0));
      if (log.topics[0] === BOUGHT) paid += wordAt(log.data, 1);
    }
    return [
      {
        author: from("Cards of Cronos · mint", `${EXPLORER}/address/${nft}`),
        title: `🃏  ${cards} cards minted`,
        description:
          `${logs.length} transactions${paid > 0n ? ` · ${amount(paid)} CRO` : ""}` +
          (progress ?? ""),
        color: PURPLE,
        footer: left ? { text: left } : undefined,
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
      const many = cards === 1 ? "card" : "cards";

      return {
        author: from("Cards of Cronos · mint", `${EXPLORER}/address/${nft}`),
        title: free
          ? `🎁  ${who} claimed ${cards} free ${many}`
          : `${sizeOf(Number(paid / 10n ** 16n) / 100)}  ${who} minted ${cards} ${many}`,
        description:
          (free
            ? "Free, for holding the 2025 collection."
            : `**${amount(paid)} CRO**`) + (progress ?? ""),
        url: txLink(log.transactionHash),
        color: free ? GOLD : PURPLE,
        footer: left ? { text: left } : undefined,
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
 *
 * What the line adds to the two amounts is the price it came out at and how
 * much of the pool it took. A buy is only big or small against the thing it was
 * bought from.
 */
/** One buy, as the two words of a Swap that matter. */
export interface Buy {
  log: Log;
  /** CRO that went in, in wei. */
  croIn: bigint;
  /** $CROCARD that came out. Zero means it was a sell, not a buy. */
  gotOut: bigint;
}

/**
 * The buys in a batch of Swap logs.
 *
 * Pulled out so Discord and Telegram read the same two words off the same logs.
 * The messages differ — a buy bot is scanned and an embed is read — but the
 * facts behind them are computed once, which is the half that must not drift.
 */
export function buysIn(logs: Log[]): Buy[] {
  return logs
    .map((log) => ({ log, croIn: wordAt(log.data, 0), gotOut: wordAt(log.data, 3) }))
    .filter((one) => one.gotOut > 0n);
}

/** What the pool holds, so "how big was that" has an answer. */
async function inThePool(rpcs: readonly string[]): Promise<bigint | null> {
  try {
    return BigInt(
      await rpc(rpcs, "eth_call", [
        { to: CROCARD, data: selector("balanceOf(address)") + word(POOL) },
        "latest",
      ]),
    );
  } catch {
    return null;
  }
}

export async function sayBuys(logs: Log[], rpcs: readonly string[]): Promise<Embed[]> {
  const times = new Map<string, string | null>();
  const buys = buysIn(logs);
  if (buys.length === 0) return [];

  // One call for the batch, and its absence costs a line rather than the
  // message.
  const inPool = await inThePool(rpcs);

  const priceOf = (cro: bigint, got: bigint): string => {
    if (got === 0n) return "";
    // CRO per million tokens, because per token is six leading zeroes.
    const per = (Number(cro) / Number(got)) * 1_000_000;
    return ` · ${per.toFixed(2)} CRO per million`;
  };

  if (buys.length > TOO_MANY) {
    const cro = buys.reduce((sum, one) => sum + one.croIn, 0n);
    const got = buys.reduce((sum, one) => sum + one.gotOut, 0n);
    return [
      {
        author: from("Cards of Cronos · $CROCARD", `${EXPLORER}/address/${POOL}`),
        title: `${sizeOf(Number(cro / 10n ** 16n) / 100)}  ${buys.length} buys`,
        description: `**${amount(got)} $CROCARD** for **${amount(cro)} CRO**${priceOf(cro, got)}`,
        color: GREEN,
        timestamp:
          (await minedAt(rpcs, buys[buys.length - 1]!.log.blockNumber, times)) ?? undefined,
      },
    ];
  }

  return Promise.all(
    buys.map(async (one) => {
      const cro = Number(one.croIn / 10n ** 16n) / 100;
      const took =
        inPool === null || inPool === 0n
          ? null
          : `Took ${share(Number(one.gotOut / 10n ** 18n), Number(inPool / 10n ** 18n))} of the pool`;
      return {
        author: from("Cards of Cronos · $CROCARD", `${EXPLORER}/address/${POOL}`),
        title: `${sizeOf(cro)}  ${amount(one.gotOut)} $CROCARD bought`,
        description:
          `**${amount(one.croIn)} CRO**${priceOf(one.croIn, one.gotOut)}`,
        url: txLink(one.log.transactionHash),
        color: GREEN,
        footer: took ? { text: took } : undefined,
        timestamp: (await minedAt(rpcs, one.log.blockNumber, times)) ?? undefined,
      };
    }),
  );
}

/**
 * $CROCARD sent to the dead address, and how much is there now.
 *
 * The line carries the share of the whole supply that has gone, with a bar,
 * because that is the only number a burn is really about. A quarter of a million
 * tokens means nothing on its own; nine per cent of everything there will ever
 * be means something.
 */
export async function sayBurns(logs: Log[], rpcs: readonly string[]): Promise<Embed[]> {
  const times = new Map<string, string | null>();

  let held: bigint | null = null;
  try {
    held = BigInt(
      await rpc(rpcs, "eth_call", [
        { to: CROCARD, data: selector("balanceOf(address)") + word(BURN_ADDRESS) },
        "latest",
      ]),
    );
  } catch {
    // The bar goes, the message stays.
  }

  const gone =
    held === null
      ? null
      : `\n\`${bar(Number(held / 10n ** 18n), CROCARD_SUPPLY)}\`  ${share(
          Number(held / 10n ** 18n),
          CROCARD_SUPPLY,
        )} of all $CROCARD is gone`;
  const total = held === null ? null : `${amount(held)} burned in total · nothing comes back`;

  const burned = logs.map((log) => ({ log, howMuch: wordAt(log.data, 0) }));

  if (burned.length > TOO_MANY) {
    const all = burned.reduce((sum, one) => sum + one.howMuch, 0n);
    return [
      {
        author: from("Cards of Cronos · burn", "https://cardsofcronos.com/burn"),
        title: `🔥  ${amount(all)} $CROCARD burned`,
        description: `across ${burned.length} transactions` + (gone ?? ""),
        url: `${EXPLORER}/address/${BURN_ADDRESS}`,
        color: 0xff6b35,
        footer: total ? { text: total } : undefined,
        timestamp:
          (await minedAt(rpcs, burned[burned.length - 1]!.log.blockNumber, times)) ?? undefined,
      },
    ];
  }

  return Promise.all(
    burned.map(async (one) => ({
      author: from("Cards of Cronos · burn", "https://cardsofcronos.com/burn"),
      title: `🔥  ${amount(one.howMuch)} $CROCARD burned`,
      description:
        "Sent to the dead address, where nobody holds the key." + (gone ?? ""),
      url: txLink(one.log.transactionHash),
      color: 0xff6b35,
      footer: total ? { text: total } : undefined,
      timestamp: (await minedAt(rpcs, one.log.blockNumber, times)) ?? undefined,
    })),
  );
}

/**
 * Keeps `card_owners` current from the collection's Transfer log.
 *
 * Not a feed: it posts nothing. It shares this job because it reads the same
 * contract over the same blocks, and a second scan on a second cursor would be
 * a second thing to fall behind.
 *
 * A mint is a Transfer from the zero address and a sale is a Transfer between
 * two people, and both are the same row being written — so this is a table of
 * who holds what now, not a list of what happened. Applied in log order, which
 * `eth_getLogs` guarantees within a range, so a token that changed hands twice
 * in one scan ends up with the second owner.
 *
 * Returns what it did rather than throwing: a page that cannot list somebody's
 * cards is worse than a Discord line nobody sees, but it is still not a reason
 * to fail the whole minute.
 */
async function runOwners(
  db: Database,
  logRpcs: readonly string[],
  head: number,
  now: number,
): Promise<RanFeed> {
  const feed = "owners";
  const nothing: RanFeed = { feed, from: null, to: null, found: 0, posted: 0 };
  const nft = CONTRACTS.nft;
  if (nft === null) return { ...nothing, skipped: "nothing deployed to watch" };

  const seen = await cursorOf(db, `feed:${feed}`);
  // Never run: start at the head like the feeds do. What was minted before this
  // was switched on is filled in by scripts/holders.ts, which walks ownerOf —
  // slow, once, and off the critical path.
  const from = seen === null ? Math.max(0, head - 1) : seen + 1;
  if (from > head) return { ...nothing, from, to: head, skipped: "no new blocks" };
  const to = Math.min(head, from + CHUNK - 1);

  let logs: Log[];
  try {
    logs = await logsBetween(logRpcs, nft, [TRANSFER], from, to);
  } catch (error) {
    return { ...nothing, from, to, wrong: error instanceof Error ? error.message : "getLogs failed" };
  }

  for (const log of logs) {
    // An ERC721 Transfer indexes all three, so the id is a topic and not data.
    // An ERC20 Transfer would have it in the data and three topics is how they
    // are told apart — this contract only has the one kind, and a log with the
    // wrong shape is skipped rather than written as token zero.
    if (log.topics.length !== 4) continue;
    const token = Number(BigInt(log.topics[3]!));
    const to_ = addressIn(log.topics[2]!).toLowerCase();
    await db
      .prepare(
        `INSERT INTO card_owners (token, owner, at) VALUES (?, ?, ?)
         ON CONFLICT (token) DO UPDATE SET owner = excluded.owner, at = excluded.at`,
      )
      .bind(token, to_, now)
      .run();
  }

  await setCursor(db, `feed:${feed}`, to, now);
  return { feed, from, to, found: logs.length, posted: 0 };
}

/**
 * Every feed, once.
 *
 * Sequential rather than parallel, and not for correctness: three feeds on one
 * free RPC, started at the same moment, is three ways to be rate-limited into
 * looking like a quiet minute.
 */
/**
 * A buy, written for Telegram rather than translated into it.
 *
 * ── WHY THIS IS NOT THE EMBED ────────────────────────────────────────────────
 *
 * The first version put the Discord embed through asText and the maker's answer
 * was "visueel niet heel aantrekkelijk hoor", which was right twice over. The
 * bold was Discord's `**` and arrived as asterisks on the screen; and even
 * fixed, an embed is a shape that is READ — an author line, a title, a
 * description, a footer — while a buy bot is a shape that is SCANNED. Four
 * figures down the left edge, each with the same mark in front of it, is read in
 * one second. A paragraph of the same four figures is not.
 *
 * The facts come from buysIn and inThePool, the same two functions the embed
 * uses, so there is one computation and two presentations. What differs is the
 * layout; nothing that could disagree about what happened.
 *
 * ── AND IT SAYS WHAT IT COST IN DOLLARS ──────────────────────────────────────
 *
 * Which the embed cannot: Discord has shown buys in CRO since it was built and
 * this project prices nothing in dollars. But "500 CRO" is a number only
 * somebody who follows CRO can weigh, and a buy bot is read by people deciding
 * whether to look. The price is already in hand — the floor needs it — so it
 * costs nothing to say.
 */
export async function sayBuysForTelegram(
  logs: Log[],
  rpcs: readonly string[],
  croUsdPrice: number | null,
): Promise<{ what: string; html: string }[]> {
  const buys = buysIn(logs);
  if (buys.length === 0) return [];

  const inPool = await inThePool(rpcs);

  /** Money, with its cents. grouped() drops a trailing zero and $34.4 is not a price. */
  const money = (usd: number): string =>
    usd < 100
      ? usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : grouped(usd);
  const dollars = (cro: number): string =>
    croUsdPrice === null ? "" : ` · <b>$${money(cro * croUsdPrice)}</b>`;

  /**
   * The market cap this buy was made at, short enough to read.
   *
   * The figure a buy bot is actually read for: "500 CRO" says how much somebody
   * spent and this says what they thought the thing was worth. Worked out from
   * the price the buy itself paid — CRO per token, times the dollar, times the
   * supply — so it needs no call of its own.
   */
  const marketCap = (croIn: bigint, gotOut: bigint): string => {
    if (croUsdPrice === null || gotOut === 0n) return "";
    const usd = (Number(croIn) / Number(gotOut)) * croUsdPrice * CROCARD_SUPPLY;
    const short =
      usd >= 1_000_000
        ? `$${(usd / 1_000_000).toFixed(2)}M`
        : usd >= 1_000
          ? `$${(usd / 1_000).toFixed(1)}K`
          : `$${money(usd)}`;
    return `\n📊 ${short} market cap`;
  };

  // Many at once gets one line. Six separate notifications in a minute is a
  // muted channel, which is the same as not having a buy bot.
  if (buys.length > TOO_MANY) {
    const cro = Number(buys.reduce((sum, one) => sum + one.croIn, 0n) / 10n ** 16n) / 100;
    const got = buys.reduce((sum, one) => sum + one.gotOut, 0n);
    return [
      {
        what: `${buys.length} buys`,
        html:
          `<b>${sizeOf(cro)} ${buys.length} $CROCARD buys</b>\n` +
          `💰 <b>${grouped(cro, 2)} CRO</b>${dollars(cro)}\n` +
          `🪙 ${amount(got)} $CROCARD` +
          marketCap(buys.reduce((sum, one) => sum + one.croIn, 0n), got) +
          `\n` +
          `<a href="${EXPLORER}/address/${POOL}">the pool ↗</a>`,
      },
    ];
  }

  return buys.map((one) => {
    const cro = Number(one.croIn / 10n ** 16n) / 100;
    const took =
      inPool === null || inPool === 0n
        ? null
        : share(Number(one.gotOut / 10n ** 18n), Number(inPool / 10n ** 18n));
    return {
      what: `a ${grouped(cro)} CRO buy`,
      html:
        `<b>${sizeOf(cro)} $CROCARD buy</b>\n` +
        `💰 <b>${grouped(cro, 2)} CRO</b>${dollars(cro)}\n` +
        `🪙 ${amount(one.gotOut)} $CROCARD` +
        marketCap(one.croIn, one.gotOut) +
        (took === null ? "" : `\n🌊 ${took} of the pool`) +
        `\n<a href="${txLink(one.log.transactionHash)}">transaction ↗</a>`,
    };
  });
}

/**
 * The smallest buy worth telling the Telegram group about, in dollars.
 *
 * Set by the maker. It exists because there is no buy bot for Cronos on
 * Telegram and this bot is becoming one — and a buy bot that reports every
 * two-cent swap is a channel people mute, which is the same as not having one.
 *
 * Dollars and not CRO, which is the whole reason lib/cro-price.ts exists. A CRO
 * floor would mean a threshold that halves in real terms every time CRO
 * doubles, and nobody would notice until the channel filled with dust.
 *
 * Discord is deliberately NOT filtered. Its buys channel has shown every buy
 * since it was built, people read it that way, and quietly raising a floor
 * under it would be a change nobody asked for.
 */
export const TELEGRAM_BUY_FLOOR_USD = 5;

/**
 * Was that buy worth a line, given what a CRO is worth.
 *
 * `null` for the price means there has never been one — one window on one
 * deployment — and everything passes. A buy feed that goes silent looks broken;
 * showing one small buy is the cheaper mistake, and lib/cro-price.ts has
 * already said so in the log.
 */
export function bigEnoughToTell(log: Log, croUsdPrice: number | null): boolean {
  if (croUsdPrice === null) return true;
  // The CRO that went in is the first word of a Swap's data, the same word
  // sayBuys reads to price it.
  const cro = Number(wordAt(log.data, 0)) / 1e18;
  return cro * croUsdPrice >= TELEGRAM_BUY_FLOOR_USD;
}

export async function runFeeds(
  db: Database,
  secrets: {
    rpc?: string;
    mints?: string;
    buys?: string;
    burns?: string;
    /** For mirroring the feeds that are mirrored. See the burns call below. */
    telegramBotToken?: string;
    telegramChat?: string;
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

  // Once for the run, and only used by the buys mirror. Stale is fine and
  // absent is survivable — see lib/cro-price.ts.
  const priced = await croUsd(db, now, secrets.rpc);
  const croPrice = priced?.usd ?? null;

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
      // The buy bot. There is no buy bot for Cronos on Telegram, so this is
      // one — above a floor, because every swap is a channel people mute.
      telegram: {
        botToken: secrets.telegramBotToken,
        chat: secrets.telegramChat,
        only: (log) => bigEnoughToTell(log, croPrice),
        lines: (worth, rpcs) => sayBuysForTelegram(worth, rpcs, croPrice),
      },
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
      // Burns and not the other two, for now.
      //
      // Mints and buys fire in bursts — a mint is dozens of lines in an hour —
      // and a channel that buzzes dozens of times is a channel people leave.
      // A burn is the one of the three that is read as news rather than as
      // activity: supply going down is the number this project is about.
      // Mirroring another feed is this one line on another call.
      telegram: { botToken: secrets.telegramBotToken, chat: secrets.telegramChat },
    }),
  );

  // Last, and neither of these posts anything. If either fails, the three
  // channels have already had their say.
  feeds.push(await runOwners(db, logRpcs, head, now));

  // Who paid to play a board, within a minute. A player who has just sent ten
  // CRO is watching the screen, and "your entry has not arrived yet" for six
  // hours is indistinguishable from the money having gone nowhere.
  const entries = await recordEntries(db, logRpcs, head, now).catch((error: unknown) => [
    {
      from: null,
      to: null,
      recorded: 0,
      why: error instanceof Error ? error.message : "the entry scan failed",
    },
  ]);
  for (const [i, one] of entries.entries()) {
    feeds.push({
      feed: `entries:${i}`,
      from: one.from,
      to: one.to,
      found: one.recorded,
      posted: 0,
      ...(one.why === undefined ? {} : { wrong: one.why }),
    });
  }

  // Burns, written down within a minute of happening rather than within six
  // hours. That mattered the moment the burn page grew a button anybody can
  // press: somebody pressed it, watched the money leave, and saw nothing on the
  // page that exists to show exactly that.
  const burns = await recordBurns(db, { rpc: secrets.rpc }, now).catch((error: unknown) => ({
    recorded: 0,
    from: null,
    to: null,
    why: error instanceof Error ? error.message : "the burn scan failed",
  }));
  feeds.push({
    feed: "burns:recorded",
    from: burns.from,
    to: burns.to,
    found: burns.recorded,
    posted: 0,
    ...(burns.why ? { skipped: burns.why } : {}),
  });

  return { head, feeds };
}
