-- One spelling per wallet, enforced by the table.
--
-- An EVM address is the same address in any case: 0xAB… and 0xab… are one
-- wallet. Left alone that is one player counted twice, two referral rows and two
-- sets of points, and nothing about it looks wrong until somebody counts. So
-- every column that holds a wallet checks three things — it is lowercase, it is
-- forty-two characters, and it starts with 0x.
--
-- Not the full hex check: SQLite's GLOB cannot say "forty hex digits" without
-- writing the class out forty times. lib/address.ts `normalise` does the whole
-- check, and it is the only way an address reaches this file. This is the
-- backstop, and what it backstops is the case, which is the half that is silent.

-- Two tables, because an offer is not a match.
--
-- A listing is somebody saying "I will play this"; it has one player, no seed
-- and no board. A match exists, has two seats, and is a seed plus a list of
-- moves. Folding them together would mean a matches row with half its columns
-- null for as long as it sits in the lobby, and every read having to know which
-- half of the table it is looking at.

CREATE TABLE IF NOT EXISTS listings (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL CHECK (player_id = lower(player_id) AND length(player_id) = 42 AND substr(player_id, 1, 2) = '0x'),
  mode        TEXT NOT NULL CHECK (mode IN ('live', 'correspondence')),
  -- CRO per side. Zero is a friendly match, which is all that runs today.
  stake       REAL NOT NULL DEFAULT 0,
  -- The creator's deck, validated before it was ever written here.
  deck        TEXT NOT NULL,
  rank        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  -- An hour after creation, settled in DESIGN.md. A lobby that keeps dead
  -- listings looks busier than it is, which is worse than looking empty.
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS listings_open ON listings (mode, stake, expires_at);

CREATE TABLE IF NOT EXISTS matches (
  id            TEXT PRIMARY KEY,
  mode          TEXT NOT NULL CHECK (mode IN ('live', 'correspondence')),
  stake         REAL NOT NULL DEFAULT 0,
  seat_you      TEXT NOT NULL CHECK (seat_you = lower(seat_you) AND length(seat_you) = 42 AND substr(seat_you, 1, 2) = '0x'),
  seat_opponent TEXT NOT NULL CHECK (seat_opponent = lower(seat_opponent) AND length(seat_opponent) = 42 AND substr(seat_opponent, 1, 2) = '0x'),
  seed          INTEGER NOT NULL,
  deck_you      TEXT NOT NULL,
  deck_opponent TEXT NOT NULL,
  -- The match is this list and nothing else. A state is never stored: it is
  -- replayed from the seed and these moves, which is also the audit when two
  -- players disagree about what happened.
  moves         TEXT NOT NULL DEFAULT '[]',
  created_at    INTEGER NOT NULL,
  deadline      INTEGER NOT NULL,
  finished_at   INTEGER
);

-- Both sides are queried the same way, so both get an index. "My matches" is
-- the query the whole app is built around.
CREATE INDEX IF NOT EXISTS matches_you ON matches (seat_you, finished_at);
CREATE INDEX IF NOT EXISTS matches_opponent ON matches (seat_opponent, finished_at);

-- A player, keyed by the wallet that proved itself.
--
-- The rank lives here rather than being recomputed from matches, because Elo is
-- path-dependent: it is the order the results arrived in, not the set of them,
-- and a table you can only rebuild by replaying every match in sequence is a
-- table you should be storing.
--
-- Solo results against the bot are deliberately absent. They are computed in the
-- player's own browser, so putting them in a server table would dress a number
-- up as verified when the server has never seen a move of it. Those stay local;
-- DESIGN.md settles that rank comes from staked PvP.
CREATE TABLE IF NOT EXISTS players (
  wallet        TEXT PRIMARY KEY CHECK (wallet = lower(wallet) AND length(wallet) = 42 AND substr(wallet, 1, 2) = '0x'),
  -- The code other people type to say this player brought them, and when this
  -- player finished their demo match.
  --
  -- Both of these were ALTER TABLE statements at the end of this file, because
  -- over in the other project they were added to a table that already existed.
  -- They were also commented out, while the index that needs ref_code was not —
  -- so this file could only ever be run against the one database it had already
  -- been run against. On anything fresh it stopped at
  -- `no such column: ref_code`, which is what it did the first time anybody
  -- tried it here.
  --
  -- This game has no database yet, so there is no migration to respect. The
  -- columns go where columns go.
  ref_code      TEXT,
  demo_done_at  INTEGER,
  -- 1000 at first login, settled in DESIGN.md.
  rank          INTEGER NOT NULL DEFAULT 1000,
  -- Cosmetic, from every PvP match including friendly ones.
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  draws         INTEGER NOT NULL DEFAULT 0,
  -- How many staked matches this rank rests on. The top tiers open at ten.
  staked        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  seen_at       INTEGER NOT NULL
);

-- Linked accounts, one row per account rather than columns on players.
--
-- A column per network means a migration every time one is added, and a NULL
-- that means three different things: never linked, unlinked, or linked to an
-- account that has since gone. A row exists or it does not.
--
-- The unique index is on the account and not the wallet: one X account may not
-- be worn by two wallets. That is the entire defence of a referral system —
-- without it, points are farmed by making wallets, and every wallet is free.
CREATE TABLE IF NOT EXISTS links (
  wallet        TEXT NOT NULL CHECK (wallet = lower(wallet) AND length(wallet) = 42 AND substr(wallet, 1, 2) = '0x'),
  network       TEXT NOT NULL CHECK (network IN ('x', 'telegram')),
  -- The network's own id, which never changes. Handles do.
  account_id    TEXT NOT NULL,
  -- What to show. Kept as a convenience and never as an identity.
  handle        TEXT NOT NULL,
  linked_at     INTEGER NOT NULL,
  PRIMARY KEY (wallet, network)
);

CREATE UNIQUE INDEX IF NOT EXISTS links_account ON links (network, account_id);

-- Who brought whom.
--
-- One row per person referred, and the primary key says so: you can be referred
-- once, ever. Not once per campaign and not once per code — the question "who
-- brought this player to the game" has exactly one answer for the whole life of
-- the wallet, and a table that could hold two answers is a table somebody will
-- eventually make hold two.
--
-- `qualified_at` is the whole anti-farming design and it is worth reading before
-- changing anything here. Wallets are free, so a referral that counted the
-- moment a wallet appeared would be a wallet-generating machine. It counts when
-- the person referred has both linked an X account and finished a match: an X
-- account is not free, and a match is not instant. Neither is impossible to
-- fake — nothing here is — but together they cost more than the referral can
-- ever be worth, which is the only bar that matters.
--
-- Deliberately no points column. What a referral is worth is not settled and
-- does not have to be: this table records what happened, and a price can be
-- decided later without any of this history being wrong.
CREATE TABLE IF NOT EXISTS referrals (
  -- The one referred. One row each, forever.
  referee      TEXT PRIMARY KEY CHECK (referee = lower(referee) AND length(referee) = 42 AND substr(referee, 1, 2) = '0x'),
  referrer     TEXT NOT NULL CHECK (referrer = lower(referrer) AND length(referrer) = 42 AND substr(referrer, 1, 2) = '0x'),
  -- The code as it was used, kept so a changed code cannot rewrite history.
  code         TEXT NOT NULL,
  claimed_at   INTEGER NOT NULL,
  -- Null until it counts. See above.
  qualified_at INTEGER
);

CREATE INDEX IF NOT EXISTS referrals_by_referrer ON referrals (referrer, qualified_at);

-- One code per player, and no two players sharing one. NULL is allowed as often
-- as it likes, which is what makes this work: a code is handed out lazily, on
-- the first time somebody asks for one.
CREATE UNIQUE INDEX IF NOT EXISTS players_ref_code ON players (ref_code);

-- The five things a player can do, one row each.
--
-- A row exists or it does not, which is what makes "have they done this" a
-- lookup rather than a calculation over other tables. `proof` says how we know:
-- `verified` means this server checked it, `declared` means the player said so
-- and nothing checked. Those are not the same fact and a column that blurred
-- them would make the difference invisible on the day it mattered.
--
-- `voided_at` is the maker's stated right to refuse what looks botted. Set it
-- and the task stops counting, for the player and for whoever referred them.
-- Nothing is deleted: a voided row is evidence, and a deleted one is an argument
-- nobody can settle.
CREATE TABLE IF NOT EXISTS tasks (
  wallet    TEXT NOT NULL CHECK (wallet = lower(wallet) AND length(wallet) = 42 AND substr(wallet, 1, 2) = '0x'),
  task      TEXT NOT NULL,
  done_at   INTEGER NOT NULL,
  proof     TEXT NOT NULL CHECK (proof IN ('verified', 'declared')),
  voided_at INTEGER,
  PRIMARY KEY (wallet, task)
);

CREATE INDEX IF NOT EXISTS tasks_by_wallet ON tasks (wallet, voided_at);

-- Points, as a ledger rather than a balance.
--
-- A balance column would be one number with no account of how it got there, and
-- the first time somebody disputes it there is nothing to show them. Every entry
-- here says what happened and when: earned by doing a task, earned because
-- somebody you referred did one, spent on a reward, or adjusted by hand.
--
-- The balance is the sum of everything not voided. That is a cheap query at this
-- size and it can never disagree with its own history.
CREATE TABLE IF NOT EXISTS points (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet    TEXT NOT NULL CHECK (wallet = lower(wallet) AND length(wallet) = 42 AND substr(wallet, 1, 2) = '0x'),
  -- Positive earned, negative spent. One column, so the sum is the balance.
  amount    INTEGER NOT NULL,
  reason    TEXT NOT NULL CHECK (reason IN ('task', 'referral', 'claim', 'adjust')),
  -- Which task earned it. Empty for a claim or an adjustment.
  task      TEXT NOT NULL DEFAULT '',
  -- Whose task it was, when this is a referral point. Empty otherwise.
  about     TEXT NOT NULL DEFAULT '',
  -- What was claimed. Empty unless this is a claim.
  reward    TEXT NOT NULL DEFAULT '',
  at        INTEGER NOT NULL,
  voided_at INTEGER
);

-- One point per task, and one referral point per task per person referred.
-- Partial, so claims and adjustments are free to repeat — you may buy two
-- booster packs, and you may not be paid twice for one task.
--
-- Empty strings rather than NULLs on purpose: SQLite counts two NULLs as
-- different, so a nullable column here would let the same point in twice.
CREATE UNIQUE INDEX IF NOT EXISTS points_once
  ON points (wallet, reason, task, about)
  WHERE reason IN ('task', 'referral');

CREATE INDEX IF NOT EXISTS points_by_wallet ON points (wallet, voided_at);

-- Every buy-and-burn, one row each.
--
-- `tx_hash` is the whole point and it is the primary key. A burn counter that
-- shows a number nobody can check is a number nobody should believe, and this
-- corner of the internet is full of them. Every row here names the transaction
-- that did it, the page links each one to an explorer, and the total is the sum
-- of things anybody can go and look at.
--
-- It is the primary key rather than a column so the same transaction cannot be
-- counted twice — which is the one mistake that would make the total wrong in
-- the flattering direction.
--
-- Written by the daily job in lib/splitter.ts, which reads the splitter's own
-- Released log and records every one it finds — ours and anybody else's, since
-- release() needs no permission. The stream column says "splitter" for those:
-- mints, royalties and a match's cut all arrive in one balance and leave in one
-- swap, so which of the three paid is not a thing the chain can be asked.
CREATE TABLE IF NOT EXISTS burns (
  -- The Cronos transaction hash. Checkable, by anyone, forever. Lowercase, for
  -- the same reason wallets are: one transaction must not be two rows.
  tx_hash    TEXT PRIMARY KEY
             CHECK (tx_hash = lower(tx_hash) AND length(tx_hash) = 66
                    AND substr(tx_hash, 1, 2) = '0x'),
  -- Which stream paid for it. Matches an id in lib/revenue.ts.
  stream     TEXT NOT NULL,
  -- What was spent and what went up in smoke, both in base units, both TEXT.
  --
  -- TEXT and not INTEGER because these are wei: eighteen zeroes behind them.
  -- SQLite's INTEGER is 64-bit signed, which stops being able to hold a balance
  -- somewhere around nine CRO — and it would not error, it would wrap. The
  -- totals are summed in JavaScript with bigints instead; see lib/store.ts.
  wei        TEXT NOT NULL,
  -- Base units of $CROCARD destroyed.
  burned     TEXT NOT NULL,
  at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS burns_by_time ON burns (at DESC);

-- The weekly high score: one row per wallet per week, holding their best.
--
-- VERIFIED, NOT REPORTED. lib/history.ts says it plainly about solo results:
-- they are computed in the player's own browser, so they are worth exactly as
-- much as the player's honesty. That is fine for a profile and worthless the
-- moment a prize hangs on it. So a score only gets here by being replayed on the
-- server from its seed, its deck and its moves — the same way /api/ref/demo
-- checks that somebody met the game.
--
-- The seed is kept so a disputed score can be replayed by anybody who asks.
CREATE TABLE IF NOT EXISTS tournament (
  wallet      TEXT NOT NULL
              CHECK (wallet = lower(wallet)),
  -- ISO-ish week, "2026-W38". Weeks run Monday 00:00 UTC to Sunday midnight.
  week        TEXT NOT NULL,
  -- The market cap this wallet finished on. The score.
  mc          INTEGER NOT NULL,
  -- What the bot finished on, kept because beating it is the entry requirement
  -- and a row should carry its own proof of that.
  opponent_mc INTEGER NOT NULL
              CHECK (opponent_mc < mc),
  seed        INTEGER NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (wallet, week)
);

CREATE INDEX IF NOT EXISTS tournament_board ON tournament (week, mc DESC, at ASC);

-- What a closed week paid out, one row per week.
--
-- The week is the primary key rather than a column, so the same week cannot be
-- paid twice — which is the one mistake that costs real money and leaves a
-- perfectly ordinary-looking second row behind.
--
-- Written by the weekly job in lib/publisher.ts, after the winner has been paid
-- and from the amount the contract had allocated to them. The payout is what
-- matters and the row is the record of it: a run that cannot write here logs
-- that loudly and does not retry the payment.
CREATE TABLE IF NOT EXISTS tournament_paid (
  week     TEXT PRIMARY KEY,
  wallet   TEXT NOT NULL
           CHECK (wallet = lower(wallet)),
  -- $CROCARD paid, in the token's smallest unit, as TEXT. Eighteen zeroes
  -- behind it: SQLite's INTEGER is 64-bit signed and would wrap somewhere
  -- around nine of anything without erroring. Same rule as the burns table.
  --
  -- The column is called wei because that is what eighteen decimals are called.
  -- It stopped being CRO when the splitter started buying the token before
  -- paying anything out.
  wei      TEXT NOT NULL,
  -- The Cronos transaction. Checkable, by anyone, forever.
  tx_hash  TEXT NOT NULL
           CHECK (tx_hash = lower(tx_hash) AND length(tx_hash) = 66
                  AND substr(tx_hash, 1, 2) = '0x'),
  at       INTEGER NOT NULL
);

-- How far a job has read the chain, one row per job.
--
-- The daily job records burns from the splitter's own log. To do that it has to
-- know where it stopped, because Cronos answers eth_getLogs over at most two
-- thousand blocks at a time and a block is 0.42 seconds — a day is a hundred
-- chunks, and a job that started from the beginning every time would ask for
-- the whole chain once a day and be rate-limited off it by lunchtime.
--
-- So the cursor is the job's memory and nothing else. It is not a source of
-- truth about burns: the burns table is, keyed by transaction hash, and a chunk
-- read twice writes no second row. Losing this table costs a rescan, not a
-- number.
CREATE TABLE IF NOT EXISTS cursors (
  -- The job's name. "burns" is the only one today.
  name  TEXT PRIMARY KEY,
  -- The last block that has been read, inclusive. INTEGER is right here and
  -- wrong two tables up: a block number is nine digits, not eighteen zeroes.
  block INTEGER NOT NULL,
  at    INTEGER NOT NULL
);
