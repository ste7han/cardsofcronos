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
import { POINTS_PER_TASK, type Proof, type Task } from "@/lib/points";
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
 * A referral code: short, typeable, and readable out loud.
 *
 * Eight characters from an alphabet with no 0/O/1/I/L in it, for the same reason
 * base58 leaves them out — these get read off a phone screen and typed into
 * another one, and a code that turns into a different valid code when misread is
 * a code that credits the wrong person.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newRefCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export interface Referral {
  referee: string;
  referrer: string;
  code: string;
  claimedAt: number;
  qualifiedAt: number | null;
}

/** The wallet a code belongs to, or null. */
export async function walletForCode(db: Database, code: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT wallet FROM players WHERE ref_code = ?`)
    .bind(code.toUpperCase())
    .first<{ wallet: string }>();
  return row?.wallet ?? null;
}

/**
 * Give a player a code if they have not got one.
 *
 * Retried on collision rather than assumed unique. Eight characters from
 * thirty-one is about 10^12, so a clash is not going to happen — but "is not
 * going to happen" is how you end up with two players sharing a code and no way
 * to tell whose referrals are whose. The unique index decides; this just tries
 * again.
 */
export async function ensureRefCode(db: Database, wallet: string): Promise<string> {
  const existing = await playerOf(db, wallet);
  if (existing.refCode) return existing.refCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRefCode();
    try {
      await db
        .prepare(`UPDATE players SET ref_code = ? WHERE wallet = ? AND ref_code IS NULL`)
        .bind(code, wallet)
        .run();
      const now = await playerOf(db, wallet);
      if (now.refCode) return now.refCode;
    } catch (error) {
      if (!/UNIQUE/i.test(String(error))) throw error;
    }
  }
  throw new Error(`Could not find a free referral code for ${wallet} in five tries.`);
}

/**
 * Record who brought this player, if nobody has yet.
 *
 * Returns what happened rather than throwing, because every outcome here is
 * ordinary: already referred, referred yourself, a code that is not a code. None
 * of them is a fault and all of them need saying.
 *
 * Not qualified yet. Claiming is free — a wallet is free — so claiming counts
 * for nothing until the person referred has done the two things below.
 */
export async function claimReferral(
  db: Database,
  referee: string,
  code: string,
  now: number,
): Promise<"claimed" | "already" | "self" | "unknown"> {
  const referrer = await walletForCode(db, code);
  if (!referrer) return "unknown";
  // A wallet is free, so referring yourself would be the whole exploit in one
  // step. It is also the honest mistake somebody makes with their own link.
  if (referrer === referee) return "self";

  const held = await db
    .prepare(`SELECT referee FROM referrals WHERE referee = ?`)
    .bind(referee)
    .first<{ referee: string }>();
  if (held) return "already";

  try {
    await db
      .prepare(
        `INSERT INTO referrals (referee, referrer, code, claimed_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(referee, referrer, code.toUpperCase(), now)
      .run();
  } catch (error) {
    // Two tabs, one wallet. The primary key decides and the answer is the same.
    if (!/UNIQUE|PRIMARY/i.test(String(error))) throw error;
    return "already";
  }
  return "claimed";
}

/**
 * Remember that this player finished a demo match.
 *
 * Set once and never cleared: it is a thing that happened, not a state. The
 * WHERE keeps the first date rather than the most recent, because "when did they
 * first meet the game" is the question, and somebody who plays ten demos has not
 * met it ten times.
 */
export async function markDemoDone(db: Database, wallet: string, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO players (wallet, demo_done_at, created_at, seen_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (wallet) DO UPDATE SET
         demo_done_at = COALESCE(players.demo_done_at, excluded.demo_done_at),
         seen_at = excluded.seen_at`,
    )
    .bind(wallet, now, now, now)
    .run();
}

/** Everybody this wallet brought, newest first. */
export async function referralsBy(db: Database, referrer: string): Promise<Referral[]> {
  const { results } = await db
    .prepare(`SELECT * FROM referrals WHERE referrer = ? ORDER BY claimed_at DESC`)
    .bind(referrer)
    .all<{
      referee: string;
      referrer: string;
      code: string;
      claimed_at: number;
      qualified_at: number | null;
    }>();

  return results.map((row) => ({
    referee: row.referee,
    referrer: row.referrer,
    code: row.code,
    claimedAt: row.claimed_at,
    qualifiedAt: row.qualified_at,
  }));
}

/** Who brought this player, if anybody. */
export async function referrerOf(db: Database, referee: string): Promise<Referral | null> {
  const row = await db
    .prepare(`SELECT * FROM referrals WHERE referee = ?`)
    .bind(referee)
    .first<{
      referee: string;
      referrer: string;
      code: string;
      claimed_at: number;
      qualified_at: number | null;
    }>();

  return row
    ? {
        referee: row.referee,
        referrer: row.referrer,
        code: row.code,
        claimedAt: row.claimed_at,
        qualifiedAt: row.qualified_at,
      }
    : null;
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

export interface DoneTask {
  task: Task;
  doneAt: number;
  proof: Proof;
  voided: boolean;
}

/** What this wallet has done. Voided rows come back, marked — they are evidence. */
export async function tasksOf(db: Database, wallet: string): Promise<DoneTask[]> {
  const { results } = await db
    .prepare(`SELECT task, done_at, proof, voided_at FROM tasks WHERE wallet = ?`)
    .bind(wallet)
    .all<{ task: Task; done_at: number; proof: Proof; voided_at: number | null }>();

  return results.map((row) => ({
    task: row.task,
    doneAt: row.done_at,
    proof: row.proof,
    voided: row.voided_at !== null,
  }));
}

/**
 * Record a task and pay for it, once.
 *
 * Two payments, both at one point: the player, and whoever brought them. That is
 * the maker's design in one function — a referral is worth up to five because
 * the five tasks each pay the referrer once, so somebody who does three of five
 * earns their referrer three.
 *
 * Idempotent twice over, and deliberately not by checking first. The tasks
 * primary key decides whether this is new, and the partial unique index on
 * points decides whether a point has already been paid. A read-then-write would
 * pay twice for two requests arriving together, and a point paid twice cannot be
 * corrected because nothing in the row says it happened twice.
 *
 * Returns whether this call was the one that recorded it.
 */
export async function completeTask(
  db: Database,
  wallet: string,
  task: Task,
  proof: Proof,
  now: number,
): Promise<boolean> {
  const recorded = await db
    .prepare(
      `INSERT INTO tasks (wallet, task, done_at, proof) VALUES (?, ?, ?, ?)
       ON CONFLICT (wallet, task) DO NOTHING
       RETURNING wallet`,
    )
    .bind(wallet, task, now, proof)
    .first<{ wallet: string }>();

  if (!recorded) return false;

  await award(db, wallet, POINTS_PER_TASK, "task", { task }, now);

  const referral = await referrerOf(db, wallet);
  if (referral) {
    await award(db, referral.referrer, POINTS_PER_TASK, "referral", { task, about: wallet }, now);
  }
  return true;
}

/**
 * Take a task back, and the points with it.
 *
 * The maker's stated right to refuse what looks botted. Both entries go — the
 * player's and their referrer's — because a referral point was earned by a task
 * that is no longer standing.
 *
 * Voided and never deleted. A voided row is evidence and a deleted one is an
 * argument nobody can settle; it also keeps the unique index in place, so a
 * refused task cannot simply be done again for the same point.
 */
export async function voidTask(
  db: Database,
  wallet: string,
  task: Task,
  now: number,
): Promise<void> {
  await db
    .prepare(`UPDATE tasks SET voided_at = ? WHERE wallet = ? AND task = ? AND voided_at IS NULL`)
    .bind(now, wallet, task)
    .run();

  await db
    .prepare(
      `UPDATE points SET voided_at = ?
        WHERE voided_at IS NULL AND task = ?
          AND ((reason = 'task' AND wallet = ?) OR (reason = 'referral' AND about = ?))`,
    )
    .bind(now, task, wallet, wallet)
    .run();
}

type Entry = { task?: Task; about?: string; reward?: string };

/** One ledger line. Silent when the unique index says it is already there. */
async function award(
  db: Database,
  wallet: string,
  amount: number,
  reason: "task" | "referral" | "claim" | "adjust",
  entry: Entry,
  now: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO points (wallet, amount, reason, task, about, reward, at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(wallet, amount, reason, entry.task ?? "", entry.about ?? "", entry.reward ?? "", now)
      .run();
  } catch (error) {
    // Only the index. Anything else is a real fault and has to keep travelling —
    // swallowing every error here would turn a broken table into a silent
    // refusal to pay somebody.
    if (!/UNIQUE/i.test(String(error))) throw error;
  }
}

export interface Ledger {
  balance: number;
  earned: number;
  spent: number;
}

/** The balance, which is the sum of the history rather than a number beside it. */
export async function ledgerOf(db: Database, wallet: string): Promise<Ledger> {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(amount), 0) AS balance,
         COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned,
         COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
       FROM points WHERE wallet = ? AND voided_at IS NULL`,
    )
    .bind(wallet)
    .first<Ledger>();

  return row ?? { balance: 0, earned: 0, spent: 0 };
}

/**
 * Spend points on a reward.
 *
 * The balance is read and then written, which is a race — two tabs claiming at
 * once could both see enough. It is left as one because there is nothing to
 * hand over yet: every reward is `ready: false` and the route refuses before it
 * reaches here. When something is actually given out this has to become a
 * conditional write, and this comment is the note saying so.
 */
export async function spendPoints(
  db: Database,
  wallet: string,
  reward: string,
  cost: number,
  now: number,
): Promise<boolean> {
  const { balance } = await ledgerOf(db, wallet);
  if (balance < cost) return false;

  await award(db, wallet, -cost, "claim", { reward }, now);
  return true;
}

export interface Burn {
  signature: string;
  stream: string;
  lamports: number;
  burned: number;
  at: number;
}

export interface BurnTotal {
  burns: number;
  lamports: number;
  burned: number;
}

/** Every burn, newest first, capped so one page cannot become a slow one. */
export async function burns(db: Database, limit = 50): Promise<Burn[]> {
  const { results } = await db
    .prepare(`SELECT * FROM burns ORDER BY at DESC LIMIT ?`)
    .bind(limit)
    .all<Burn>();
  return results;
}

/**
 * The totals, summed rather than stored.
 *
 * A stored total is a number that can disagree with the transactions behind it,
 * and the only thing that makes a burn counter worth reading is that it cannot.
 */
export async function burnTotal(db: Database): Promise<BurnTotal> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS burns,
              COALESCE(SUM(lamports), 0) AS lamports,
              COALESCE(SUM(burned), 0) AS burned
         FROM burns`,
    )
    .first<BurnTotal>();
  return row ?? { burns: 0, lamports: 0, burned: 0 };
}

/**
 * Record a burn.
 *
 * DO NOTHING on conflict, because the signature is the key: the same
 * transaction reported twice is the one mistake that makes the total wrong in
 * the flattering direction, and it has to be impossible rather than unlikely.
 */
export async function recordBurn(db: Database, burn: Burn): Promise<boolean> {
  const written = await db
    .prepare(
      `INSERT INTO burns (signature, stream, lamports, burned, at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (signature) DO NOTHING
       RETURNING signature`,
    )
    .bind(burn.signature, burn.stream, burn.lamports, burn.burned, burn.at)
    .first<{ signature: string }>();
  return written !== null;
}

/** The seed for a new match. Not from the engine: it is what the engine is given. */
export function seedFor(id: string): number {
  // A hash of the id rather than a random number, so creating the same match
  // twice cannot produce two different games and a replay never has to guess.
  return fnv1a(id);
}

export { TURN_CLOCK };
export type { MatchMode, MatchRecord, Player };
