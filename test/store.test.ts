// The storage layer, against a fake that behaves like SQLite where it matters.
//
// Two behaviours here are worth more than the rest put together. Claiming a
// listing has to be atomic, because two players pressing join on the same offer
// is the normal case for anything interesting in a lobby rather than a rare one.
// And the limits have to count offers as well as matches, or five listings and
// five matches is ten.

import { describe, expect, it } from "vitest";

import { CONCURRENT, LISTING_LIFE, addResult, claimListing, getMatch, hasRoomFor, linkAccount, linksOf, matchesOf, openListings, playerOf, putListing, putMatch, saveMoves, seePlayer, seedFor, unlinkAccount } from "@/lib/store";
import type { Database, Link, Listing, Statement } from "@/lib/store";
import type { MatchRecord } from "@/engine/record";

// Wallets that look like wallets.
//
// db/schema.sql checks every wallet column for lowercase, forty-two characters
// and a leading 0x. The fake database below is a set of string matches and
// enforces no constraints at all, so ALICE would pass here and be refused by
// the real D1 — a test that is green about something production rejects, which
// is exactly the shape this project has been caught by before.
//
// Still readable: a wallet of forty a's is as easy to follow as ALICE and it
// is a valid address.
const ALICE = "0x" + "a".repeat(40);
const BOB = "0x" + "b".repeat(40);
const CAROL = "0x" + "c".repeat(40);

/**
 * A fake that stores rows and answers the handful of queries this file writes.
 *
 * Matched on the shape of the SQL rather than parsed, which is crude and honest:
 * it is a fake, and if a query changes shape the test fails loudly instead of
 * quietly answering the wrong question.
 */
function fakeDb(): Database & {
  listings: Map<string, Record<string, unknown>>;
  matches: Map<string, Record<string, unknown>>;
  links: Map<string, Record<string, unknown>>;
  players: Map<string, Record<string, unknown>>;
  referrals: Map<string, Record<string, unknown>>;
  tasks: Map<string, Record<string, unknown>>;
  points: Record<string, unknown>[];
} {
  const listings = new Map<string, Record<string, unknown>>();
  const matches = new Map<string, Record<string, unknown>>();
  // Keyed the way the real primary key is, so the fake cannot accept a row the
  // database would refuse.
  const links = new Map<string, Record<string, unknown>>();
  const players = new Map<string, Record<string, unknown>>();
  // Keyed by referee, the way the real primary key is: you can be referred once.
  const referrals = new Map<string, Record<string, unknown>>();
  // Keyed the way the real primary key is: one row per wallet per task.
  const tasks = new Map<string, Record<string, unknown>>();
  // A list, because the real one is a ledger and the balance is its sum.
  const points: Record<string, unknown>[] = [];

  const db = {
    listings,
    matches,
    links,
    players,
    referrals,
    tasks,
    points,
    // The fake applies a batch in order. It cannot model the all-or-nothing part
    // — that is D1's — but it does model the shape the code now calls with.
    async batch(statements: readonly Statement[]) {
      const out: unknown[] = [];
      for (const one of statements) out.push(await one.run());
      return out;
    },
    prepare(sql: string): Statement {
      let bound: unknown[] = [];
      const self: Statement = {
        bind(...values: unknown[]) {
          bound = values;
          return self;
        },
        async first<T>() {
          if (sql.includes("DELETE FROM listings") && sql.includes("RETURNING")) {
            const [id, now] = bound as [string, number];
            const row = listings.get(id);
            if (!row || (row.expires_at as number) <= now) return null;
            listings.delete(id);
            return row as T;
          }
          if (sql.includes("SELECT * FROM matches")) {
            return (matches.get(bound[0] as string) ?? null) as T | null;
          }
          if (sql.includes("SELECT wallet FROM players WHERE ref_code")) {
            const held = [...players.values()].find((p) => p.ref_code === bound[0]);
            return (held ? { wallet: held.wallet } : null) as T | null;
          }
          if (sql.startsWith("INSERT INTO tasks")) {
            const [wallet, task, done_at, proof] = bound as [string, string, number, string];
            const key = `${wallet}:${task}`;
            if (tasks.has(key)) return null;
            tasks.set(key, { wallet, task, done_at, proof, voided_at: null });
            return { wallet } as T;
          }
          if (sql.includes("FROM points WHERE wallet")) {
            const wallet = bound[0] as string;
            const mine = points.filter((p) => p.wallet === wallet && p.voided_at === null);
            const sum = (f: (n: number) => number) =>
              mine.reduce((total, p) => total + f(p.amount as number), 0);
            return {
              balance: sum((n) => n),
              earned: sum((n) => (n > 0 ? n : 0)),
              spent: sum((n) => (n < 0 ? -n : 0)),
            } as T;
          }
          if (sql.includes("SELECT demo_done_at FROM players")) {
            const row = players.get(bound[0] as string);
            return ((row?.demo_done_at ?? null) === null ? null : row) as T | null;
          }
          if (sql.includes("FROM players WHERE wallet")) {
            const row = players.get(bound[0] as string);
            return (row ?? null) as T | null;
          }
          if (sql.includes("SELECT referee FROM referrals") || sql.includes("SELECT * FROM referrals WHERE referee")) {
            return (referrals.get(bound[0] as string) ?? null) as T | null;
          }
          // Matched on the WHERE and not just the SELECT. Two queries start
          // "SELECT wallet FROM links" and mean opposite things — one asks who
          // holds an account, the other asks whether a wallet has one — and the
          // looser match sent the second down the first's branch and answered
          // null. The failure was in this fake and it looked like a bug in
          // qualifyReferral, which is exactly how a crude fake earns its keep
          // and also exactly how it costs you an afternoon.
          if (sql.includes("SELECT wallet FROM links") && sql.includes("network = ? AND account_id")) {
            const [network, accountId] = bound as [string, string];
            const held = [...links.values()].find(
              (l) => l.network === network && l.account_id === accountId,
            );
            return (held ? { wallet: held.wallet } : null) as T | null;
          }
          if (sql.includes("SELECT wallet FROM links") && sql.includes("wallet = ?")) {
            const wallet = bound[0] as string;
            const held = [...links.values()].find(
              (l) => l.wallet === wallet && l.network === "x",
            );
            return (held ? { wallet: held.wallet } : null) as T | null;
          }
          if (sql.includes("COUNT(*)") && sql.includes("FROM matches")) {
            const [playerId, , mode] = bound as [string, string, string];
            const n = [...matches.values()].filter(
              (m) =>
                (m.seat_you === playerId || m.seat_opponent === playerId) &&
                m.finished_at === null &&
                m.mode === mode,
            ).length;
            return { n } as T;
          }
          if (sql.includes("COUNT(*)") && sql.includes("FROM listings")) {
            const [playerId, mode, now] = bound as [string, string, number];
            const n = [...listings.values()].filter(
              (l) => l.player_id === playerId && l.mode === mode && (l.expires_at as number) > now,
            ).length;
            return { n } as T;
          }
          throw new Error(`fake has no answer for: ${sql.slice(0, 60)}`);
        },
        async all<T>() {
          if (sql.includes("FROM listings")) {
            const now = bound[0] as number;
            return {
              results: [...listings.values()].filter((l) => (l.expires_at as number) > now) as T[],
            };
          }
          if (sql.includes("FROM tasks WHERE wallet")) {
            const wallet = bound[0] as string;
            return { results: [...tasks.values()].filter((t) => t.wallet === wallet) as T[] };
          }
          if (sql.includes("FROM referrals")) {
            const referrer = bound[0] as string;
            return { results: [...referrals.values()].filter((r) => r.referrer === referrer) as T[] };
          }
          if (sql.includes("FROM links")) {
            const wallet = bound[0] as string;
            return { results: [...links.values()].filter((l) => l.wallet === wallet) as T[] };
          }
          if (sql.includes("FROM matches")) {
            const playerId = bound[0] as string;
            return {
              results: [...matches.values()].filter(
                (m) => m.seat_you === playerId || m.seat_opponent === playerId,
              ) as T[],
            };
          }
          throw new Error(`fake has no answer for: ${sql.slice(0, 60)}`);
        },
        async run() {
          if (sql.startsWith("INSERT INTO listings")) {
            const [id, player_id, mode, stake, deck, rank, created_at, expires_at] = bound;
            listings.set(id as string, { id, player_id, mode, stake, deck, rank, created_at, expires_at });
            return;
          }
          if (sql.startsWith("INSERT INTO matches")) {
            // In the order putMatch binds them. A column added to the real
            // schema and not here comes back null and the round-trip test is
            // the only thing that notices.
            const [id, mode, stake, seat_you, seat_opponent, seed, deck_you, deck_opponent, moves, created_at, deadline, wager] = bound;
            matches.set(id as string, {
              id, mode, stake, seat_you, seat_opponent, seed, deck_you, deck_opponent,
              moves, created_at, deadline, wager: wager ?? null, finished_at: null,
            });
            return;
          }
          if (sql.startsWith("UPDATE matches")) {
            const [moves, deadline, finished_at, id] = bound;
            const row = matches.get(id as string);
            if (row) Object.assign(row, { moves, deadline, finished_at });
            return;
          }
          if (sql.startsWith("DELETE FROM listings")) {
            listings.delete(bound[0] as string);
            return;
          }
          if (sql.startsWith("INSERT INTO points")) {
            const [wallet, amount, reason, task, about, reward, at] = bound as [
              string, number, string, string, string, string, number,
            ];
            // The partial unique index: one point per task, and per referral
            // per task. Claims and adjustments repeat freely.
            if (
              (reason === "task" || reason === "referral") &&
              points.some(
                (p) => p.wallet === wallet && p.reason === reason && p.task === task && p.about === about,
              )
            ) {
              throw new Error("UNIQUE constraint failed: points_once");
            }
            points.push({ wallet, amount, reason, task, about, reward, at, voided_at: null });
            return;
          }
          if (sql.startsWith("UPDATE tasks SET voided_at")) {
            const [at, wallet, task] = bound as [number, string, string];
            const row = tasks.get(`${wallet}:${task}`);
            if (row && row.voided_at === null) row.voided_at = at;
            return;
          }
          if (sql.startsWith("UPDATE points SET voided_at")) {
            const [at, task, wallet] = bound as [number, string, string];
            for (const p of points) {
              if (p.voided_at !== null || p.task !== task) continue;
              const mine = p.reason === "task" && p.wallet === wallet;
              const theirs = p.reason === "referral" && p.about === wallet;
              if (mine || theirs) p.voided_at = at;
            }
            return;
          }
          if (sql.startsWith("INSERT INTO referrals")) {
            const [referee, referrer, code, claimed_at] = bound;
            if (referrals.has(referee as string)) throw new Error("UNIQUE constraint failed");
            referrals.set(referee as string, {
              referee, referrer, code, claimed_at, qualified_at: null,
            });
            return;
          }
          if (sql.startsWith("UPDATE referrals")) {
            const [at, referee] = bound as [number, string];
            const row = referrals.get(referee);
            if (row && row.qualified_at === null) row.qualified_at = at;
            return;
          }
          if (sql.startsWith("UPDATE players SET ref_code")) {
            const [code, wallet] = bound as [string, string];
            const row = players.get(wallet);
            if (row && row.ref_code === null) {
              if ([...players.values()].some((p) => p.ref_code === code)) {
                throw new Error("UNIQUE constraint failed: players.ref_code");
              }
              row.ref_code = code;
            }
            return;
          }
          if (sql.startsWith("INSERT INTO players")) {
            const wallet = bound[0] as string;
            if (!players.has(wallet)) {
              players.set(wallet, {
                wallet, rank: 1000, wins: 0, losses: 0, draws: 0, staked: 0,
                ref_code: null, demo_done_at: null,
              });
            }
            const row = players.get(wallet)!;
            for (const column of ["wins", "losses", "draws"]) {
              if (sql.includes(`${column}, created_at`)) row[column] = (row[column] as number) + 1;
            }
            // COALESCE: the first date stands. Somebody who plays ten demos has
            // not met the game ten times.
            if (sql.includes("demo_done_at")) {
              row.demo_done_at = row.demo_done_at ?? (bound[1] as number);
            }
            return;
          }
          if (sql.startsWith("INSERT INTO links")) {
            const [wallet, network, account_id, handle, linked_at] = bound;
            links.set(`${String(wallet)}:${String(network)}`, {
              wallet, network, account_id, handle, linked_at,
            });
            return;
          }
          if (sql.startsWith("DELETE FROM links")) {
            const [wallet, network] = bound as [string, string];
            links.delete(`${wallet}:${network}`);
            return;
          }
          throw new Error(`fake has no answer for: ${sql.slice(0, 60)}`);
        },
      };
      return self;
    },
  };
  return db;
}

const T0 = 1_700_000_000_000;

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: "l1",
  playerId: ALICE,
  mode: "correspondence",
  stake: 0,
  deck: ["a", "b"],
  rank: 1000,
  createdAt: T0,
  expiresAt: T0 + LISTING_LIFE,
  ...over,
});

const link = (over: Partial<Link> = {}): Link => ({
  wallet: ALICE,
  network: "x",
  accountId: "111",
  handle: "alice_x",
  linkedAt: T0,
  ...over,
});

const record = (over: Partial<MatchRecord> = {}): MatchRecord => ({
  id: "m1",
  // Null for a friendly match, which is what most of these are. A staked one
  // carries the id of the offer it came from — see the column's comment.
  wager: null,
  mode: "correspondence",
  stake: 0,
  seats: { you: ALICE, opponent: BOB },
  seed: 4242,
  decks: { you: ["a"], opponent: ["b"] },
  moves: [],
  createdAt: T0,
  deadline: T0 + 1000,
  ...over,
});

describe("the lobby", () => {
  it("shows what is on offer and hides what has expired", async () => {
    const db = fakeDb();
    await putListing(db, listing({ id: "fresh" }));
    await putListing(db, listing({ id: "stale", expiresAt: T0 - 1 }));

    const open = await openListings(db, T0);
    expect(open.map((l) => l.id)).toEqual(["fresh"]);
  });

  it("gives a listing to exactly one of two players claiming it", async () => {
    const db = fakeDb();
    await putListing(db, listing({ id: "hot" }));

    const [bob, carol] = await Promise.all([
      claimListing(db, "hot", T0),
      claimListing(db, "hot", T0),
    ]);

    // One of them gets it and the other gets null. Which one does not matter;
    // that it is exactly one does. A read-then-write here hands the same match
    // to both and there is no rule anywhere downstream that would notice.
    expect([bob, carol].filter(Boolean)).toHaveLength(1);
  });

  it("will not hand out an expired listing", async () => {
    const db = fakeDb();
    await putListing(db, listing({ id: "old", expiresAt: T0 - 1 }));
    expect(await claimListing(db, "old", T0)).toBeNull();
  });

  it("round-trips a deck through storage unchanged", async () => {
    const db = fakeDb();
    await putListing(db, listing({ deck: ["bonk-dog", "wif-hat", "murad"] }));
    const [back] = await openListings(db, T0);
    expect(back!.deck).toEqual(["bonk-dog", "wif-hat", "murad"]);
  });
});

describe("the limits", () => {
  it("counts offers as well as matches", async () => {
    const db = fakeDb();
    expect(await hasRoomFor(db, ALICE, "live", T0)).toBe(true);

    // One live offer standing is one live match committed to. Counting only
    // matches would let a player hold five offers and five matches.
    await putListing(db, listing({ id: "offer", mode: "live" }));
    expect(await hasRoomFor(db, ALICE, "live", T0)).toBe(false);
  });

  it("lets go once an offer expires", async () => {
    const db = fakeDb();
    await putListing(db, listing({ id: "offer", mode: "live", expiresAt: T0 + 10 }));
    expect(await hasRoomFor(db, ALICE, "live", T0)).toBe(false);
    expect(await hasRoomFor(db, ALICE, "live", T0 + 11)).toBe(true);
  });

  it("holds five correspondence matches and refuses the sixth", async () => {
    const db = fakeDb();
    for (let i = 0; i < CONCURRENT.correspondence; i++) {
      await putMatch(db, record({ id: `m${i}` }));
      expect(await hasRoomFor(db, ALICE, "correspondence", T0)).toBe(i < CONCURRENT.correspondence - 1);
    }
  });

  it("counts a mode against itself only", async () => {
    const db = fakeDb();
    await putMatch(db, record({ id: "live1", mode: "live" }));
    expect(await hasRoomFor(db, ALICE, "live", T0)).toBe(false);
    expect(await hasRoomFor(db, ALICE, "correspondence", T0)).toBe(true);
  });
});

describe("a match in storage", () => {
  it("comes back exactly as it went in", async () => {
    const db = fakeDb();
    const written = record({ moves: [{ kind: "endTurn" }, { kind: "playCard", handIndex: 2 }] });
    await putMatch(db, written);
    expect(await getMatch(db, "m1")).toEqual(written);
  });

  it("remembers which wager is holding the stakes", async () => {
    // Null for a friendly match and the offer's id for a staked one. Losing it
    // would mean a finished match that nobody could settle, with both stakes
    // sitting in the escrow until somebody walked away from them.
    const db = fakeDb();
    await putMatch(db, record({ id: "staked", stake: 100, wager: "offer-7" }));
    const back = await getMatch(db, "staked");
    expect(back?.wager).toBe("offer-7");
    expect(back?.stake).toBe(100);

    await putMatch(db, record({ id: "friendly" }));
    expect((await getMatch(db, "friendly"))?.wager).toBeNull();
  });

  it("finds a player on either side of the table", async () => {
    const db = fakeDb();
    await putMatch(db, record({ id: "m1", seats: { you: ALICE, opponent: BOB } }));
    expect((await matchesOf(db, ALICE)).map((m) => m.id)).toEqual(["m1"]);
    expect((await matchesOf(db, BOB)).map((m) => m.id)).toEqual(["m1"]);
    expect(await matchesOf(db, CAROL)).toEqual([]);
  });

  it("writes moves back and marks a finish", async () => {
    const db = fakeDb();
    await putMatch(db, record());
    await saveMoves(db, "m1", [{ kind: "endTurn" }], T0 + 5000, T0 + 9000);

    const back = await getMatch(db, "m1");
    expect(back!.moves).toEqual([{ kind: "endTurn" }]);
    expect(back!.deadline).toBe(T0 + 5000);
    // Finished matches stop counting against the limit, which is the only thing
    // finished_at is for.
    expect(await hasRoomFor(db, ALICE, "correspondence", T0)).toBe(true);
  });
});

describe("linking an account", () => {
  it("attaches one, and finds it again", async () => {
    const db = fakeDb();
    expect(await linkAccount(db, link())).toBeNull();
    const [back] = await linksOf(db, ALICE);
    expect(back).toMatchObject({ network: "x", accountId: "111", handle: "alice_x" });
  });

  it("refuses an account another wallet already holds, and says who", async () => {
    const db = fakeDb();
    await linkAccount(db, link({ wallet: ALICE }));
    // The whole defence of a referral system. Without it, points are farmed by
    // making wallets, and wallets are free.
    expect(await linkAccount(db, link({ wallet: BOB }))).toBe(ALICE);
    expect(await linksOf(db, BOB)).toEqual([]);
  });

  it("lets a wallet re-link its own account, because people rename themselves", async () => {
    const db = fakeDb();
    await linkAccount(db, link({ handle: "old_name" }));
    expect(await linkAccount(db, link({ handle: "new_name" }))).toBeNull();
    const rows = await linksOf(db, ALICE);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.handle).toBe("new_name");
  });

  it("turns the database's own refusal into the same answer", async () => {
    // The look-up above answers the ordinary case; the unique index decides.
    // Between the two there is a moment where another wallet can take the
    // account, and a player cannot act on a 500.
    const db = fakeDb();
    await linkAccount(db, link({ wallet: ALICE }));

    const real = db.prepare;
    db.prepare = (sql: string) => {
      const statement = real(sql);
      if (sql.startsWith("INSERT INTO links")) {
        return { ...statement, bind: () => ({ ...statement, run: async () => {
          throw new Error("UNIQUE constraint failed: links.network, links.account_id");
        } }) } as Statement;
      }
      return statement;
    };

    expect(await linkAccount(db, link({ wallet: CAROL }))).toBe(ALICE);
  });

  it("frees the account again when it is unlinked", async () => {
    const db = fakeDb();
    await linkAccount(db, link({ wallet: ALICE }));
    await unlinkAccount(db, ALICE, "x");
    // What stops farming is that an account cannot be in two places at once, not
    // that it can never move.
    expect(await linkAccount(db, link({ wallet: BOB }))).toBeNull();
  });
});

describe("a record", () => {
  it("counts wins, losses and draws apart", async () => {
    const db = fakeDb();
    await seePlayer(db, ALICE, T0);
    await addResult(db, ALICE, "win", T0);
    await addResult(db, ALICE, "win", T0);
    await addResult(db, ALICE, "loss", T0);
    await addResult(db, ALICE, "draw", T0);

    const player = await playerOf(db, ALICE);
    expect([player.wins, player.losses, player.draws]).toEqual([2, 1, 1]);
    // Cosmetic and separate from the rank, which only staked matches move.
    expect(player.rank).toBe(1000);
  });
});

describe("the seed", () => {
  it("is the same every time for the same match", () => {
    // Not random: creating a match twice must not be able to produce two
    // different games, and a replay must never have to guess.
    expect(seedFor("abc")).toBe(seedFor("abc"));
    expect(seedFor("abc")).not.toBe(seedFor("abd"));
    expect(Number.isInteger(seedFor("abc"))).toBe(true);
  });
});
