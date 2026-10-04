// Reading and writing matches. The only file that knows SQL.
//
// Everything here takes a `Database` rather than reaching for a binding, so the
// tests run against a fake and nothing in the engine or the routes has to know
// whether it is talking to D1, to SQLite on a laptop, or to a Map in a test.
//
// The rules live in engine/. This file stores and fetches; it decides nothing
// about whether a move is legal or a deck is allowed. Every function that could
// be tempted to is a query and nothing else.

import { fnv1a } from "@/lib/fnv";
import type { Network } from "@/lib/links";
import type { MatchMode, MatchRecord } from "@/engine/record";
import { TURN_CLOCK } from "@/engine/record";
import type { Move, Player } from "@/engine/types";

/** The slice of D1 this file uses. Small on purpose, so a fake is small too. */
export interface Database {
  prepare(sql: string): Statement;
  /**
   * Several statements as one call, applied together or not at all.
   *
   * Here because of what a loop of `.run()` costs rather than for tidiness. A
   * Worker gets a thousand subrequests per request and every statement is one:
   * the nightly holder round spent 207 on reading entitlements, 207 on writing
   * them and 168 on storing a tree, on top of its log scans, and on 28
   * September 2026 it ran out partway through. The propose had already landed,
   * so the chain held a tree the database had never stored and could not make
   * proofs for — see scripts/recover-tree.ts for what getting that back took.
   *
   * A batch is one subrequest whatever its length, and D1 wraps it in a
   * transaction, so it fixes the ceiling and the half-written state at once.
   */
  batch(statements: readonly Statement[]): Promise<unknown[]>;
}
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

/** An offer in the lobby. One player, no seed, no board — not a match yet. */
export interface Listing {
  id: string;
  playerId: string;
  mode: MatchMode;
  stake: number;
  deck: string[];
  rank: number;
  createdAt: number;
  expiresAt: number;
}

/** How long an unanswered offer stays in the lobby. */
export const LISTING_LIFE = 60 * 60 * 1000;

/** How many matches one player may have running, by mode. */
export const CONCURRENT: Record<MatchMode, number> = {
  live: 1,
  correspondence: 5,
};

interface ListingRow {
  id: string;
  player_id: string;
  mode: MatchMode;
  stake: number;
  deck: string;
  rank: number;
  created_at: number;
  expires_at: number;
}

interface MatchRow {
  id: string;
  mode: MatchMode;
  stake: number;
  seat_you: string;
  seat_opponent: string;
  seed: number;
  deck_you: string;
  deck_opponent: string;
  moves: string;
  created_at: number;
  deadline: number;
  armed: number | null;
  finished_at: number | null;
  wager: string | null;
}

const toListing = (row: ListingRow): Listing => ({
  id: row.id,
  playerId: row.player_id,
  mode: row.mode,
  stake: row.stake,
  deck: JSON.parse(row.deck) as string[],
  rank: row.rank,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

const toRecord = (row: MatchRow): MatchRecord => ({
  id: row.id,
  wager: row.wager ?? null,
  mode: row.mode,
  stake: row.stake,
  seats: { you: row.seat_you, opponent: row.seat_opponent },
  seed: row.seed,
  decks: {
    you: JSON.parse(row.deck_you) as string[],
    opponent: JSON.parse(row.deck_opponent) as string[],
  },
  moves: JSON.parse(row.moves) as Move[],
  createdAt: row.created_at,
  deadline: row.deadline,
  armed: row.armed ?? null,
});

export async function putListing(db: Database, listing: Listing): Promise<void> {
  await db
    .prepare(
      `INSERT INTO listings (id, player_id, mode, stake, deck, rank, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      listing.id,
      listing.playerId,
      listing.mode,
      listing.stake,
      JSON.stringify(listing.deck),
      listing.rank,
      listing.createdAt,
      listing.expiresAt,
    )
    .run();
}

/** Everything still on offer. Expired rows are filtered rather than swept. */
export async function openListings(db: Database, now: number): Promise<Listing[]> {
  const { results } = await db
    .prepare(`SELECT * FROM listings WHERE expires_at > ? ORDER BY created_at ASC`)
    .bind(now)
    .all<ListingRow>();
  return results.map(toListing);
}

/**
 * Claim a listing, or get nothing because somebody else already did.
 *
 * DELETE ... RETURNING rather than SELECT then DELETE: two players pressing
 * join on the same offer at the same moment is not a rare case in a lobby, it
 * is the normal one when anything interesting is posted. Read-then-write hands
 * the match to both of them.
 */
export async function claimListing(db: Database, id: string, now: number): Promise<Listing | null> {
  const row = await db
    .prepare(`DELETE FROM listings WHERE id = ? AND expires_at > ? RETURNING *`)
    .bind(id, now)
    .first<ListingRow>();
  return row ? toListing(row) : null;
}

export async function cancelListing(db: Database, id: string, playerId: string): Promise<void> {
  await db.prepare(`DELETE FROM listings WHERE id = ? AND player_id = ?`).bind(id, playerId).run();
}

export async function putMatch(db: Database, record: MatchRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO matches
         (id, mode, stake, seat_you, seat_opponent, seed, deck_you, deck_opponent,
          moves, created_at, deadline, armed, wager)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.mode,
      record.stake,
      record.seats.you,
      record.seats.opponent,
      record.seed,
      JSON.stringify(record.decks.you),
      JSON.stringify(record.decks.opponent),
      JSON.stringify(record.moves),
      record.createdAt,
      record.deadline,
      record.armed,
      record.wager ?? null,
    )
    .run();
}

export async function getMatch(db: Database, id: string): Promise<MatchRecord | null> {
  const row = await db.prepare(`SELECT * FROM matches WHERE id = ?`).bind(id).first<MatchRow>();
  return row ? toRecord(row) : null;
}

/**
 * Write the moves back.
 *
 * The whole list every time rather than an append. A match is sixty-six moves of
 * a few bytes, so the row is smaller than the query that would update it in
 * place — and a whole-list write cannot leave a half-applied match behind, which
 * an append can if the deadline update fails after it.
 */
export async function saveMoves(
  db: Database,
  id: string,
  moves: Move[],
  deadline: number,
  finishedAt: number | null,
  /**
   * Passed every time rather than defaulted, because the safe-looking default
   * is the wrong one: a caller that left it out would write NULL over a running
   * clock and hand that match a fresh opening grace.
   */
  armed: number | null,
): Promise<void> {
  await db
    .prepare(`UPDATE matches SET moves = ?, deadline = ?, finished_at = ?, armed = ? WHERE id = ?`)
    .bind(JSON.stringify(moves), deadline, finishedAt, armed, id)
    .run();
}

/**
 * Running matches whose clock has already run out.
 *
 * The one query behind enforcing the clock on a schedule rather than when
 * somebody happens to look. Capped, because this runs every minute and a tick
 * that tries to catch up a thousand matches is a tick that times out and
 * catches up none — the next one takes the rest, and nothing is ever more than
 * a minute behind.
 *
 * Oldest deadline first, so the longest-overdue match is never the one left to
 * the next run.
 */
export async function matchesOnTheClock(
  db: Database,
  now: number,
  limit = 25,
): Promise<MatchRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM matches
        WHERE finished_at IS NULL AND deadline <= ?
        ORDER BY deadline ASC
        LIMIT ?`,
    )
    .bind(now, limit)
    .all<MatchRow>();
  return results.map(toRecord);
}

/**
 * Matches anybody may look in on, newest first.
 *
 * Everybody's, not one player's — this is what makes a spectator page findable
 * rather than a URL you have to be sent. What it returns is the record; what a
 * watcher is shown is decided by engine/view.ts, which has no field a hand could
 * go in.
 *
 * Running ones first and a few finished ones after, because a game that has just
 * been decided is the one worth opening. Capped rather than paged: this is a
 * list to glance at, and a lobby that needs paging is a problem to have.
 */
export async function watchableMatches(db: Database, limit = 12): Promise<MatchRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM matches
        ORDER BY finished_at IS NOT NULL ASC, created_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<MatchRow>();
  return results.map(toRecord);
}

/** Every match a player is in, newest first. */
export async function matchesOf(
  db: Database,
  playerId: string,
  onlyRunning = false,
): Promise<MatchRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM matches
        WHERE (seat_you = ? OR seat_opponent = ?)
          ${onlyRunning ? "AND finished_at IS NULL" : ""}
        ORDER BY created_at DESC`,
    )
    .bind(playerId, playerId)
    .all<MatchRow>();
  return results.map(toRecord);
}

/**
 * Is this player allowed one more match of this mode?
 *
 * Counts running matches and open offers together, because an offer is a match
 * a player has already committed to — five listings and five matches would be
 * ten, which is not the limit anybody agreed to.
 */
export async function hasRoomFor(
  db: Database,
  playerId: string,
  mode: MatchMode,
  now: number,
): Promise<boolean> {
  const running = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM matches
        WHERE (seat_you = ? OR seat_opponent = ?) AND finished_at IS NULL AND mode = ?`,
    )
    .bind(playerId, playerId, mode)
    .first<{ n: number }>();
  const offered = await db
    .prepare(`SELECT COUNT(*) AS n FROM listings WHERE player_id = ? AND mode = ? AND expires_at > ?`)
    .bind(playerId, mode, now)
    .first<{ n: number }>();
  return (running?.n ?? 0) + (offered?.n ?? 0) < CONCURRENT[mode];
}

/** An account attached to a wallet. */
export interface Link {
  wallet: string;
  network: Network;
  accountId: string;
  handle: string;
  linkedAt: number;
  /**
   * Why we cannot reach this account, or null when the last attempt worked.
   *
   * 'never-started' on a fresh Telegram link, because the login widget proves
   * who somebody is without opening a chat with the bot — and Telegram will not
   * let a bot open one. See db/schema.sql.
   */
  dmProblem: string | null;
}

interface LinkRow {
  wallet: string;
  network: Network;
  account_id: string;
  handle: string;
  linked_at: number;
  dm_problem: string | null;
}

const toLink = (row: LinkRow): Link => ({
  wallet: row.wallet,
  network: row.network,
  accountId: row.account_id,
  handle: row.handle,
  linkedAt: row.linked_at,
  dmProblem: row.dm_problem ?? null,
});

/**
 * The Telegram account attached to a wallet, or null.
 *
 * Narrower than linksOf on purpose: this is the one the notifier asks, it is
 * asked on the path of a move, and reading one row by primary key is what that
 * path can afford.
 */
export async function telegramFor(db: Database, wallet: string): Promise<Link | null> {
  const row = await db
    .prepare(`SELECT * FROM links WHERE wallet = ? AND network = 'telegram'`)
    .bind(wallet)
    .first<LinkRow>();
  return row ? toLink(row) : null;
}

/**
 * Remember whether we could reach somebody, so their profile can say so.
 *
 * Called with null after a message lands, which is the only thing that clears
 * 'never-started' — pressing Start sends us nothing, so a successful send is
 * the only evidence that ever arrives.
 */
export async function noteDelivery(
  db: Database,
  wallet: string,
  network: Network,
  problem: string | null,
): Promise<void> {
  await db
    .prepare(`UPDATE links SET dm_problem = ? WHERE wallet = ? AND network = ?`)
    .bind(problem, wallet, network)
    .run();
}

/** Everything attached to one wallet. */
export async function linksOf(db: Database, wallet: string): Promise<Link[]> {
  const { results } = await db
    .prepare(`SELECT * FROM links WHERE wallet = ?`)
    .bind(wallet)
    .all<LinkRow>();
  return results.map(toLink);
}

/**
 * Attach an account, or say who already has it.
 *
 * Returns the wallet holding this account when it is somebody else's, and null
 * when the link was made. Not a thrown error: being told an account is taken is
 * an answer a person needs to read, not a failure.
 *
 * The look-up answers the ordinary case, and the unique index on (network,
 * account_id) is what actually decides. Between the SELECT and the INSERT there
 * is a moment where a second wallet can take the account, and the database
 * refuses the write when that happens — so that refusal is caught and turned
 * into the same answer, rather than into a 500 the player cannot act on.
 *
 * Verified against the real D1, not against a fake: the upsert keeps one row,
 * and a second wallet claiming a taken account fails with UNIQUE constraint.
 *
 * Re-linking your own account is allowed and refreshes the handle. People
 * rename themselves, and the id is what identity rests on.
 */
export async function linkAccount(
  db: Database,
  // Without dmProblem: whether we can reach somebody is not something the
  // caller knows or decides. It is derived below from what linking actually
  // proves, which for Telegram is an identity and not a chat.
  link: Omit<Link, "dmProblem">,
): Promise<string | null> {
  const holder = () =>
    db
      .prepare(`SELECT wallet FROM links WHERE network = ? AND account_id = ?`)
      .bind(link.network, link.accountId)
      .first<{ wallet: string }>();

  const held = await holder();
  if (held && held.wallet !== link.wallet) return held.wallet;

  try {
    await db
      .prepare(
        `INSERT INTO links (wallet, network, account_id, handle, linked_at, dm_problem)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (wallet, network)
         DO UPDATE SET account_id = excluded.account_id,
                       handle = excluded.handle,
                       linked_at = excluded.linked_at,
                       dm_problem = excluded.dm_problem`,
      )
      .bind(
        link.wallet,
        link.network,
        link.accountId,
        link.handle,
        link.linkedAt,
        // Linking is not reachability. Telegram hands over an id and no chat;
        // X is not messaged at all, so the column does not apply to it.
        link.network === "telegram" ? "never-started" : null,
      )
      .run();
  } catch (error) {
    // Only the race. Anything else is a real fault and has to keep travelling —
    // swallowing every error here would turn a broken table into "that account
    // is taken", which is the kind of wrong answer nobody can debug.
    if (!/UNIQUE/i.test(String(error))) throw error;
    const winner = await holder();
    return winner?.wallet ?? link.wallet;
  }

  return null;
}

export async function unlinkAccount(db: Database, wallet: string, network: Network): Promise<void> {
  await db
    .prepare(`DELETE FROM links WHERE wallet = ? AND network = ?`)
    .bind(wallet, network)
    .run();
}

/**
 * The player row, made on first sight.
 *
 * Rank starts at 1000 with nothing behind it, settled in DESIGN.md. Every route
 * that touches a wallet calls this, so a profile exists from the first thing its
 * owner does rather than from some later step nobody remembered to add.
 */
export async function seePlayer(db: Database, wallet: string, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO players (wallet, created_at, seen_at) VALUES (?, ?, ?)
       ON CONFLICT (wallet) DO UPDATE SET seen_at = excluded.seen_at`,
    )
    .bind(wallet, now, now)
    .run();
}

/**
 * Close a match and write both records, once.
 *
 * `WHERE finished_at IS NULL` is what makes it once. Two requests can arrive at
 * the same finished match — the loser's move ends it and the winner's next poll
 * reads it — and a record incremented twice is a record nobody can correct,
 * because there is nothing in the row saying it happened twice.
 *
 * Returns whether this call was the one that closed it. Only that caller writes
 * the records.
 */
export async function finishMatch(
  db: Database,
  id: string,
  moves: Move[],
  deadline: number,
  now: number,
): Promise<boolean> {
  const closed = await db
    .prepare(
      `UPDATE matches SET moves = ?, deadline = ?, finished_at = ?
        WHERE id = ? AND finished_at IS NULL
        RETURNING id`,
    )
    .bind(JSON.stringify(moves), deadline, now, id)
    .first<{ id: string }>();

  return closed !== null;
}

/**
 * Add one result to a player's record.
 *
 * Cosmetic, and from every PvP match including friendly ones — settled in
 * DESIGN.md. The rank is a different number and moves only on staked matches,
 * which is why it is not touched here.
 *
 * An upsert rather than an update, because a player who has never been seen by
 * any other route still has to end up with a row.
 */
export async function addResult(
  db: Database,
  wallet: string,
  outcome: "win" | "loss" | "draw",
  now: number,
): Promise<void> {
  const column = { win: "wins", loss: "losses", draw: "draws" }[outcome];
  await db
    .prepare(
      `INSERT INTO players (wallet, ${column}, created_at, seen_at) VALUES (?, 1, ?, ?)
       ON CONFLICT (wallet) DO UPDATE SET ${column} = ${column} + 1, seen_at = excluded.seen_at`,
    )
    .bind(wallet, now, now)
    .run();
}

export interface PlayerRow {
  wallet: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  staked: number;
  /** The code other people use to say this player brought them. */
  refCode: string | null;
  /** When they first finished a demo match, or null. */
  demoDoneAt: number | null;
}

/**
 * A player's standing, or the starting one.
 *
 * Never null. A wallet with no row has not played, which is the same standing as
 * a wallet whose row says it has not played — and returning null here would make
 * every caller write the same defaulting, differently.
 */
export async function playerOf(db: Database, wallet: string): Promise<PlayerRow> {
  const row = await db
    .prepare(
      `SELECT wallet, rank, wins, losses, draws, staked, ref_code, demo_done_at
         FROM players WHERE wallet = ?`,
    )
    .bind(wallet)
    .first<
      Omit<PlayerRow, "refCode" | "demoDoneAt"> & {
        ref_code: string | null;
        demo_done_at: number | null;
      }
    >();

  return row
    ? { ...row, refCode: row.ref_code, demoDoneAt: row.demo_done_at }
    : {
        wallet,
        rank: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        staked: 0,
        refCode: null,
        demoDoneAt: null,
      };
}

export interface Burn {
  /** The Cronos transaction hash, lowercase. */
  txHash: string;
  stream: string;
  /** Wei spent buying, as a decimal string. Eighteen zeroes do not fit a number. */
  wei: string;
  /** Base units of $CROCARD destroyed, as a decimal string. */
  burned: string;
  at: number;
}

export interface BurnTotal {
  burns: number;
  wei: string;
  burned: string;
}

/** Every burn, newest first, capped so one page cannot become a slow one. */
export async function burns(db: Database, limit = 50): Promise<Burn[]> {
  const { results } = await db
    .prepare(`SELECT tx_hash, stream, wei, burned, at FROM burns ORDER BY at DESC LIMIT ?`)
    .bind(limit)
    .all<{ tx_hash: string; stream: string; wei: string; burned: string; at: number }>();
  return results.map((row) => ({
    txHash: row.tx_hash,
    stream: row.stream,
    wei: row.wei,
    burned: row.burned,
    at: row.at,
  }));
}

/**
 * The totals, summed rather than stored.
 *
 * A stored total is a number that can disagree with the transactions behind it,
 * and the only thing that makes a burn counter worth reading is that it cannot.
 */
export async function burnTotal(db: Database): Promise<BurnTotal> {
  // Summed here rather than by SQL. Both columns are wei — eighteen zeroes —
  // and they are TEXT for that reason; SUM() over TEXT would coerce them to
  // doubles and round, quietly, in whichever direction the floats happened to
  // fall. There are as many rows here as there have been buy-and-burns, which
  // is a number a person can count, so reading them all costs nothing.
  const { results } = await db
    .prepare(`SELECT wei, burned FROM burns`)
    .all<{ wei: string; burned: string }>();

  let wei = 0n;
  let burned = 0n;
  for (const row of results) {
    wei += BigInt(row.wei);
    burned += BigInt(row.burned);
  }
  return { burns: results.length, wei: wei.toString(), burned: burned.toString() };
}

/**
 * Record a burn.
 *
 * DO NOTHING on conflict, because the transaction hash is the key: the same
 * transaction reported twice is the one mistake that makes the total wrong in
 * the flattering direction, and it has to be impossible rather than unlikely.
 */
export async function recordBurn(db: Database, burn: Burn): Promise<boolean> {
  const written = await db
    .prepare(
      `INSERT INTO burns (tx_hash, stream, wei, burned, at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (tx_hash) DO NOTHING
       RETURNING tx_hash`,
    )
    // Lowercased here as well as checked by the table. An explorer will hand you
    // a hash in either case, and the table refusing it is a 500 where this is a
    // row — the constraint is there to catch a path that forgot, not to be the
    // path.
    .bind(burn.txHash.toLowerCase(), burn.stream, burn.wei, burn.burned, burn.at)
    .first<{ tx_hash: string }>();
  return written !== null;
}

/**
 * How far a job has read the chain, or null when it has never run.
 *
 * Null and zero are different answers and the caller has to tell them apart:
 * never run means "start from wherever the chain is now", and block zero would
 * mean "read the whole chain", which is a day of rate limits and no burns.
 */
export async function cursorOf(db: Database, name: string): Promise<number | null> {
  const row = await db
    .prepare(`SELECT block FROM cursors WHERE name = ?`)
    .bind(name)
    .first<{ block: number }>();
  return row?.block ?? null;
}

/**
 * Moves a cursor forward. Never backwards.
 *
 * A job that crashed halfway and restarted would otherwise write a lower block
 * than it had already read, and the rescan that follows is harmless for burns —
 * the transaction hash is the key — but it is wasted work every run forever.
 * `MAX` in the upsert means the worst a bad call can do is nothing.
 */
export async function setCursor(
  db: Database,
  name: string,
  block: number,
  at: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO cursors (name, block, at) VALUES (?, ?, ?)
       ON CONFLICT (name) DO UPDATE SET block = MAX(block, excluded.block), at = excluded.at`,
    )
    .bind(name, block, at)
    .run();
}

/** One holder of $CROCARD, as the table keeps it. */
export interface Holder {
  address: string;
  balance: bigint;
  /** Everything they have ever earned from the drop. Never goes down. */
  entitlement: bigint;
  /** Null until somebody has asked the chain whether there is code on it. */
  isContract: boolean | null;
}

/**
 * Applies what a batch of Transfer logs moved.
 *
 * DELTAS AND NOT BALANCES. The log says what moved; adding it up is what makes
 * the table right for every address at once. Asking the chain for a balance per
 * address would be right for the addresses asked about and quietly stale for
 * every other one, and the ones that go stale are exactly the ones nobody
 * thought to ask about.
 *
 * `is_contract` and `entitlement` are left alone on an address that already has
 * a row: whether an address has code is asked once and remembered, and what it
 * has earned is not a function of what it holds today.
 *
 * THE ADDITION HAPPENS IN JAVASCRIPT, not in SQL. `balance + delta` inside the
 * statement would be SQLite arithmetic, and SQLite's INTEGER is 64-bit signed:
 * it stops being able to hold one of these somewhere around nine tokens and it
 * does not error, it wraps. That is the reason the column is TEXT in the first
 * place, and doing the sum in SQL would have thrown that away in the one place
 * it mattered. Read, add with bigints, write back — this is the only writer, so
 * there is nothing to race with.
 */
export async function moveBalances(
  db: Database,
  deltas: ReadonlyMap<string, bigint>,
  at: number,
): Promise<void> {
  const rows = [...deltas].filter(([, delta]) => delta !== 0n);
  if (rows.length === 0) return;

  const had = new Map<string, bigint>();
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50);
    const found = await Promise.all(
      slice.map(([address]) =>
        db
          .prepare(`SELECT balance FROM holders WHERE address = ?`)
          .bind(address)
          .first<{ balance: string }>(),
      ),
    );
    for (const [j, row] of found.entries()) {
      if (row !== null) had.set(slice[j]![0], BigInt(row.balance));
    }
  }

  for (let i = 0; i < rows.length; i += 50) {
    await Promise.all(
      rows.slice(i, i + 50).map(([address, delta]) =>
        db
          .prepare(
            `INSERT INTO holders (address, balance, is_contract, entitlement, at)
             VALUES (?, ?, NULL, '0', ?)
             ON CONFLICT (address) DO UPDATE SET balance = excluded.balance, at = excluded.at`,
          )
          .bind(address, ((had.get(address) ?? 0n) + delta).toString(), at)
          .run(),
      ),
    );
  }
}

/**
 * Everyone with a positive balance who is known not to be a contract.
 *
 * This is who a day's arrivals are shared between. Unknown is excluded rather
 * than included: the largest holder of this token is a liquidity pool, so "we
 * have not checked" has to mean "not paid" — the other way round pays two fifths
 * of a day to nobody, once, before anybody notices.
 */
export async function payableHolders(db: Database): Promise<Holder[]> {
  const { results } = await db
    .prepare(
      `SELECT address, balance, entitlement, is_contract FROM holders
        WHERE is_contract = 0 AND balance <> '0'`,
    )
    .all<{ address: string; balance: string; entitlement: string; is_contract: number | null }>();

  return results
    .map((row) => ({
      address: row.address,
      balance: BigInt(row.balance),
      entitlement: BigInt(row.entitlement),
      isContract: row.is_contract === null ? null : row.is_contract === 1,
    }))
    .filter((holder) => holder.balance > 0n);
}

/**
 * Everyone who has earned anything, whatever they hold now.
 *
 * This is what goes in the tree, and it is a different question from who a day
 * is shared between. Somebody who sold keeps what they earned while they held
 * it — dropping them from the tree would take back money they were already told
 * was theirs, and would make the cumulative total go down, which the contract
 * refuses outright.
 */
export async function earners(db: Database): Promise<Holder[]> {
  const { results } = await db
    .prepare(
      `SELECT address, balance, entitlement, is_contract FROM holders
        WHERE entitlement <> '0'`,
    )
    .all<{ address: string; balance: string; entitlement: string; is_contract: number | null }>();

  return results
    .map((row) => ({
      address: row.address,
      balance: BigInt(row.balance),
      entitlement: BigInt(row.entitlement),
      isContract: row.is_contract === null ? null : row.is_contract === 1,
    }))
    .filter((holder) => holder.entitlement > 0n);
}

/** Adds to what holders have earned. Never subtracts — see the column's comment. */
export async function addEntitlements(
  db: Database,
  earned: ReadonlyMap<string, bigint>,
  at: number,
): Promise<void> {
  const rows = [...earned].filter(([, amount]) => amount > 0n);
  if (rows.length === 0) return;

  // Read then write, with bigints, for the same reason moveBalances does.
  //
  // ONE QUERY, NOT ONE PER ADDRESS. This asked for each entitlement separately
  // — two hundred round trips to learn two hundred numbers, in a request that
  // has a thousand of them to spend in total. Every row that has one is fewer
  // calls than every row we are about to write, and the map is the same map.
  const had = new Map<string, bigint>();
  const { results } = await db
    .prepare(`SELECT address, entitlement FROM holders WHERE entitlement <> '0'`)
    .all<{ address: string; entitlement: string }>();
  for (const row of results) had.set(row.address, BigInt(row.entitlement));

  // And one call per fifty writes rather than one per write. Fifty keeps a
  // batch small enough to read in a log line while turning two hundred
  // subrequests into four.
  for (let i = 0; i < rows.length; i += 50) {
    await db.batch(
      rows
        .slice(i, i + 50)
        .map(([address, amount]) =>
          db
            .prepare(`UPDATE holders SET entitlement = ?, at = ? WHERE address = ?`)
            .bind(((had.get(address) ?? 0n) + amount).toString(), at, address),
        ),
    );
  }
}

/** Addresses holding something that nobody has checked for code yet. */
export async function unknownHolders(db: Database, limit: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT address FROM holders
        WHERE is_contract IS NULL AND balance <> '0'
        ORDER BY at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<{ address: string }>();
  return results.map((row) => row.address);
}

/** Writes down whether an address has code on it. */
export async function markContracts(
  db: Database,
  answers: ReadonlyMap<string, boolean>,
): Promise<void> {
  await Promise.all(
    [...answers].map(([address, isContract]) =>
      db
        .prepare(`UPDATE holders SET is_contract = ? WHERE address = ?`)
        .bind(isContract ? 1 : 0, address)
        .run(),
    ),
  );
}

/** A cumulative tree that has been proposed to the drop. */
export interface DropTree {
  id: number;
  root: string;
  promised: bigint;
  holders: number;
  proposedAt: number;
  /** When the chain will let it be adopted. */
  liveAt: number;
  /** Null while it is still waiting. */
  adoptedAt: number | null;
  txHash: string;
}

/**
 * Writes a proposed tree and every leaf in it.
 *
 * The leaves go in first. A tree row with no leaves is a tree nobody can prove
 * anything against, and the order is the difference between that and a tree that
 * is simply not there yet.
 */
export async function recordTree(
  db: Database,
  tree: { root: string; promised: bigint; proposedAt: number; liveAt: number; txHash: string },
  leaves: readonly (readonly [string, bigint])[],
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO drop_trees (root, promised, holders, proposed_at, live_at, adopted_at, tx_hash)
       VALUES (?, ?, ?, ?, ?, NULL, ?) RETURNING id`,
    )
    .bind(
      tree.root,
      tree.promised.toString(),
      leaves.length,
      tree.proposedAt,
      tree.liveAt,
      tree.txHash.toLowerCase(),
    )
    .first<{ id: number }>();

  const id = row!.id;
  for (let i = 0; i < leaves.length; i += 50) {
    await db.batch(
      leaves.slice(i, i + 50).map(([address, amount]) =>
        db
          .prepare(
            `INSERT INTO drop_leaves (tree, address, amount) VALUES (?, ?, ?)
             ON CONFLICT (tree, address) DO NOTHING`,
          )
          .bind(id, address, amount.toString()),
      ),
    );
  }
  return id;
}

/** Marks a tree as the live one. */
export async function markAdopted(db: Database, id: number, at: number): Promise<void> {
  await db
    .prepare(`UPDATE drop_trees SET adopted_at = ? WHERE id = ? AND adopted_at IS NULL`)
    .bind(at, id)
    .run();
}

/** The tree the chain is currently paying against, or null before the first one. */
export async function liveTree(db: Database): Promise<DropTree | null> {
  const row = await db
    .prepare(
      `SELECT id, root, promised, holders, proposed_at, live_at, adopted_at, tx_hash
         FROM drop_trees WHERE adopted_at IS NOT NULL ORDER BY id DESC LIMIT 1`,
    )
    .first<{
      id: number;
      root: string;
      promised: string;
      holders: number;
      proposed_at: number;
      live_at: number;
      adopted_at: number | null;
      tx_hash: string;
    }>();
  if (row === null) return null;
  return {
    id: row.id,
    root: row.root,
    promised: BigInt(row.promised),
    holders: row.holders,
    proposedAt: row.proposed_at,
    liveAt: row.live_at,
    adoptedAt: row.adopted_at,
    txHash: row.tx_hash,
  };
}

/** The tree that is waiting out its delay, if there is one. */
export async function pendingTree(db: Database): Promise<DropTree | null> {
  const row = await db
    .prepare(
      `SELECT id, root, promised, holders, proposed_at, live_at, adopted_at, tx_hash
         FROM drop_trees WHERE adopted_at IS NULL ORDER BY id DESC LIMIT 1`,
    )
    .first<{
      id: number;
      root: string;
      promised: string;
      holders: number;
      proposed_at: number;
      live_at: number;
      adopted_at: number | null;
      tx_hash: string;
    }>();
  if (row === null) return null;
  return {
    id: row.id,
    root: row.root,
    promised: BigInt(row.promised),
    holders: row.holders,
    proposedAt: row.proposed_at,
    liveAt: row.live_at,
    adoptedAt: row.adopted_at,
    txHash: row.tx_hash,
  };
}

/** Every leaf of one tree, in the order it was built from. */
export async function treeLeaves(db: Database, tree: number): Promise<[string, string][]> {
  const { results } = await db
    .prepare(`SELECT address, amount FROM drop_leaves WHERE tree = ? ORDER BY address ASC`)
    .bind(tree)
    .all<{ address: string; amount: string }>();
  return results.map((row) => [row.address, row.amount]);
}

// ─── DECKS ───────────────────────────────────────────────────────────────────
//
// A deck belongs to a wallet, and used to belong to a browser. That difference
// is the whole reason these exist: localStorage meant somebody who built four
// decks on a laptop arrived at /play on their phone and was told to build one.
//
// Reading gives the whole list including which one is being dealt, because every
// screen that wants one wants both — "your decks, and the one you are on" is a
// single question asked in several places.

/** A deck as it is stored, with its cards already parsed. */
export interface StoredDeck {
  id: string;
  name: string;
  cardIds: string[];
  at: number;
  playing: boolean;
}

/** How many decks one wallet may keep. A list, not a warehouse. */
export const MOST_DECKS = 20;

interface DeckRow {
  id: string;
  name: string;
  cards: string;
  at: number;
  playing: number;
}

/**
 * Every deck this wallet has, newest first.
 *
 * A row whose cards will not parse is DROPPED rather than thrown: one corrupt
 * row should cost that row and not somebody's other decks. It cannot happen
 * through the route — what goes in has been validated — so this is for a row
 * that was edited by hand or written by something older.
 */
export async function decksOf(db: Database, wallet: string): Promise<StoredDeck[]> {
  const { results } = await db
    .prepare(`SELECT id, name, cards, at, playing FROM decks WHERE wallet = ? ORDER BY at DESC`)
    .bind(wallet)
    .all<DeckRow>();

  return (results ?? [])
    .map((row): StoredDeck | null => {
      let cardIds: unknown;
      try {
        cardIds = JSON.parse(row.cards);
      } catch {
        return null;
      }
      if (!Array.isArray(cardIds) || !cardIds.every((id) => typeof id === "string")) return null;
      return {
        id: row.id,
        name: row.name,
        cardIds: cardIds as string[],
        at: row.at,
        playing: row.playing === 1,
      };
    })
    .filter((deck): deck is StoredDeck => deck !== null);
}

/**
 * Writes a deck, and makes it the one being dealt.
 *
 * Saving a deck and then playing something else is not a thing anybody means, so
 * these are one operation. The seat is cleared before it is claimed, in that
 * order, because the table has a unique index over it — doing it the other way
 * round would be rejected by the database rather than quietly leaving two.
 */
export async function putDeck(
  db: Database,
  wallet: string,
  deck: { id: string; name: string; cardIds: readonly string[]; at: number },
): Promise<void> {
  await db.prepare(`UPDATE decks SET playing = 0 WHERE wallet = ?`).bind(wallet).run();
  await db
    .prepare(
      `INSERT INTO decks (id, wallet, name, cards, at, playing) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, cards = excluded.cards,
                                     at = excluded.at, playing = 1
       WHERE decks.wallet = excluded.wallet`,
    )
    .bind(deck.id, wallet, deck.name, JSON.stringify(deck.cardIds), deck.at)
    .run();
}

/**
 * Throws one away.
 *
 * Scoped to the wallet in the WHERE rather than checked first, so a deck id
 * belonging to somebody else deletes nothing instead of deleting theirs.
 */
export async function dropDeck(db: Database, wallet: string, id: string): Promise<void> {
  await db.prepare(`DELETE FROM decks WHERE id = ? AND wallet = ?`).bind(id, wallet).run();
}

/** Picks which deck is dealt, without changing any of them. */
export async function playDeck(db: Database, wallet: string, id: string): Promise<boolean> {
  const exists = await db
    .prepare(`SELECT id FROM decks WHERE id = ? AND wallet = ?`)
    .bind(id, wallet)
    .first<{ id: string }>();
  if (exists === null) return false;

  await db.prepare(`UPDATE decks SET playing = 0 WHERE wallet = ?`).bind(wallet).run();
  await db.prepare(`UPDATE decks SET playing = 1 WHERE id = ? AND wallet = ?`).bind(id, wallet).run();
  return true;
}

/** Which tokens of the collection this wallet holds, per the minute-job's table. */
export async function tokensOf(db: Database, wallet: string): Promise<number[]> {
  const { results } = await db
    .prepare(`SELECT token FROM card_owners WHERE owner = ? ORDER BY token`)
    .bind(wallet)
    .all<{ token: number }>();
  return (results ?? []).map((row) => row.token);
}

/** The seed for a new match. Not from the engine: it is what the engine is given. */
export function seedFor(id: string): number {
  // A hash of the id rather than a random number, so creating the same match
  // twice cannot produce two different games and a replay never has to guess.
  return fnv1a(id);
}

export { TURN_CLOCK };
export type { MatchMode, MatchRecord, Player };
