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
  finished_at: number | null;
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
          moves, created_at, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
): Promise<void> {
  await db
    .prepare(`UPDATE matches SET moves = ?, deadline = ?, finished_at = ? WHERE id = ?`)
    .bind(JSON.stringify(moves), deadline, finishedAt, id)
    .run();
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
}

interface LinkRow {
  wallet: string;
  network: Network;
  account_id: string;
  handle: string;
  linked_at: number;
}

const toLink = (row: LinkRow): Link => ({
  wallet: row.wallet,
  network: row.network,
  accountId: row.account_id,
  handle: row.handle,
  linkedAt: row.linked_at,
});

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
export async function linkAccount(db: Database, link: Link): Promise<string | null> {
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
        `INSERT INTO links (wallet, network, account_id, handle, linked_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (wallet, network)
         DO UPDATE SET account_id = excluded.account_id,
                       handle = excluded.handle,
                       linked_at = excluded.linked_at`,
      )
      .bind(link.wallet, link.network, link.accountId, link.handle, link.linkedAt)
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

/** The seed for a new match. Not from the engine: it is what the engine is given. */
export function seedFor(id: string): number {
  // A hash of the id rather than a random number, so creating the same match
  // twice cannot produce two different games and a replay never has to guess.
  return fnv1a(id);
}

export { TURN_CLOCK };
export type { MatchMode, MatchRecord, Player };
