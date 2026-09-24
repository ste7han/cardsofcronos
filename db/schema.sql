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
  finished_at   INTEGER,
  -- Which wager in contracts/MatchEscrow.sol holds this match's stakes, or
  -- NULL for a friendly one. It is the LISTING's id and not this match's, and
  -- that is not tidiness: the deposits are made against the offer, which exists
  -- before anybody has joined it, and a match id is only minted once both decks
  -- are in.
  --
  -- The two must stay different. `seed` is derived from the match id, so a match
  -- id somebody could know before choosing a deck is a shuffle they could work
  -- out and build against.
  wager         TEXT
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
  -- Left over from the referral system, which this game does not have. See
  -- DESIGN.md: it was taken out on 2026-09-17 along with points, because what
  -- holding $CROCARD gets you is the whole of the reward and a second currency
  -- beside it is a second thing to explain and a second thing to farm.
  --
  -- Kept as columns rather than dropped. The rows in D1 are real rows on a live
  -- table and SQLite's DROP COLUMN is the one statement in this file that could
  -- lose something; two unused columns cost nothing and a migration that goes
  -- wrong costs a players table. Nothing reads them.
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


-- The referral, task and points tables went with the old app and nothing reads
-- them any more. Their indexes stayed behind here, which made this file stop at
-- the first one on any database that did not already have those tables — so a
-- fresh one got everything above this line and nothing below it. The live
-- database still holds the three empty tables, which is why it never showed.

-- One code per player, and no two players sharing one. NULL is allowed as often
-- as it likes, which is what makes this work: a code is handed out lazily, on
-- the first time somebody asks for one.
-- Unused with ref_code, and kept with it for the same reason.
CREATE UNIQUE INDEX IF NOT EXISTS players_ref_code ON players (ref_code);

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
  -- Which opponent this score was posted against. An id from data/boards.ts,
  -- and the same string contracts/PrizePot.sol keys a prize by.
  --
  -- It is part of the primary key, so one wallet has one best score PER BOARD
  -- per week rather than one overall. Without that, beating the Loaded Lions
  -- deck would overwrite a better score against the ordinary bot, and the
  -- player would watch their own entry disappear for winning.
  board       TEXT NOT NULL DEFAULT 'bot',
  -- The market cap this wallet finished on. The score.
  mc          INTEGER NOT NULL,
  -- What the bot finished on, kept because beating it is the entry requirement
  -- and a row should carry its own proof of that.
  opponent_mc INTEGER NOT NULL
              CHECK (opponent_mc < mc),
  seed        INTEGER NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (wallet, week, board)
);

-- How a board is read: one week, one board, best first, and the earliest of a
-- tie ahead of the later one.
CREATE INDEX IF NOT EXISTS tournament_board ON tournament (week, board, mc DESC, at ASC);

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
  week     TEXT NOT NULL,
  -- Which board was paid. One week now has a winner per board.
  board    TEXT NOT NULL DEFAULT 'bot',
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
  at       INTEGER NOT NULL,
  -- A week is paid once per board. Two rows for one board is either a mistake
  -- or a story, and both want a loud failure rather than a second row.
  PRIMARY KEY (week, board)
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

-- Who holds $CROCARD and how much, kept up to date rather than rediscovered.
--
-- An ERC20 has no list of its holders. The balances are a mapping and a mapping
-- cannot be read without knowing the keys, so the keys come from the Transfer
-- log and the balances are rebuilt by adding up what moved. Doing that from the
-- token's first block is 37,822 eth_getLogs calls — about ten minutes against a
-- fast endpoint, and far more than a scheduled job can do while somebody waits.
--
-- So it is done once by scripts/holder-drop.ts and kept current from then on by
-- the daily job, which reads one day of blocks and applies the differences. The
-- cursor in `cursors` under the name "holders" says how far it has read.
--
-- THIS TABLE IS A CACHE OF THE CHAIN and not a record of anything. Every number
-- in it is derived, and losing it costs a rescan rather than a fact. What it is
-- not allowed to be is subtly wrong, which is why the balance is applied as a
-- delta from the log rather than asked for per address: asking would be right
-- for the addresses asked about and silently stale for every other.
CREATE TABLE IF NOT EXISTS holders (
  address     TEXT PRIMARY KEY
              CHECK (address = lower(address) AND length(address) = 42
                     AND substr(address, 1, 2) = '0x'),
  -- Base units, TEXT. Eighteen zeroes behind it; SQLite's INTEGER is 64-bit
  -- signed and wraps somewhere around nine of anything without erroring.
  balance     TEXT NOT NULL,
  -- 1 if the address has code on it, 0 if it does not, NULL if nobody has
  -- asked yet. Three states and not two: an address that has not been checked
  -- must not be treated as a person, because the largest holder of this token
  -- is a liquidity pool and paying it would be paying two fifths of a round to
  -- nobody. Asked once and remembered — code does not appear on an address
  -- that had none, except by a deploy to a counterfactual address, which is
  -- not a thing that happens to a holder by accident.
  is_contract INTEGER,
  -- Everything this address has ever earned from the drop, in base units, as
  -- TEXT. Cumulative and it never goes down — that is what makes the tree in
  -- contracts/HolderDrop.sol work: the leaf says what somebody has earned in
  -- total, the contract remembers what they have taken, and a claim is the
  -- difference. So a holder who sells keeps what they earned while they held,
  -- and a holder who never claims loses nothing by waiting.
  entitlement TEXT NOT NULL DEFAULT '0',
  at          INTEGER NOT NULL
);

-- Anything with a balance is a candidate; the ones that are not people are
-- filtered out. Indexed for the round builder, which reads every positive
-- balance and nothing else.
CREATE INDEX IF NOT EXISTS holders_positive ON holders (balance) WHERE balance <> '0';

-- Every cumulative tree that has been proposed, newest last.
--
-- One row per `propose` on contracts/HolderDrop.sol. A tree waits a day before
-- it can be adopted — that delay is what makes a stolen publisher key worth
-- almost nothing — so at any moment there is a live tree and possibly one
-- waiting behind it, and proofs have to come from the live one.
CREATE TABLE IF NOT EXISTS drop_trees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  root        TEXT NOT NULL,
  -- What every leaf in it adds up to, in base units, as TEXT.
  promised    TEXT NOT NULL,
  holders     INTEGER NOT NULL,
  proposed_at INTEGER NOT NULL,
  -- When the chain will let it be adopted, and when it actually was.
  live_at     INTEGER NOT NULL,
  adopted_at  INTEGER,
  tx_hash     TEXT NOT NULL
              CHECK (tx_hash = lower(tx_hash) AND length(tx_hash) = 66
                     AND substr(tx_hash, 1, 2) = '0x')
);

-- What each tree said each holder had earned.
--
-- The tree itself is not stored; it is rebuilt from these rows when somebody
-- asks for a proof, which is cheap for a few thousand leaves and means one
-- source of truth rather than a blob that can disagree with the rows it came
-- from. Old trees are kept: a proof against a tree that is no longer live is
-- refused by the contract, and being able to read what it said is worth more
-- than the rows cost.
CREATE TABLE IF NOT EXISTS drop_leaves (
  tree    INTEGER NOT NULL,
  address TEXT NOT NULL
          CHECK (address = lower(address) AND length(address) = 42
                 AND substr(address, 1, 2) = '0x'),
  amount  TEXT NOT NULL,
  PRIMARY KEY (tree, address)
);

-- What the Discord feeds have already said.
--
-- The cursor in `cursors` says how far each feed has read the chain; this says
-- which individual logs have gone out. Both, because the two failure modes are
-- different and both happen: a run that posts and then fails to save its cursor
-- would repeat itself forever, and a feed with no cursor would rescan the chain
-- every minute to find out it had nothing to say.
--
-- The order is post, record here, then move the cursor. So a crash between the
-- three costs a repeated line somebody sees rather than a missed one nobody
-- does — which is the right way round for a feed, where the only evidence that a
-- mint went unreported is that nobody noticed.
--
-- ID IS THE FEED, THE TRANSACTION AND THE LOG INDEX. Not the transaction alone:
-- one transaction can mint twice, burn twice, or buy through two pools, and a
-- key that could not tell those apart would drop the second one silently.
--
-- It is a cache of nothing. Losing it costs at most one repeat of whatever the
-- cursor has not passed yet.
CREATE TABLE IF NOT EXISTS feed_posted (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);

-- Old rows are worth dropping eventually: nothing ever reads a row whose block
-- the cursor has long passed. Nothing does that yet, and at a few rows a day it
-- would take years to be worth a job.
CREATE INDEX IF NOT EXISTS feed_posted_at ON feed_posted (at);

-- Who holds which card, kept current rather than asked for.
--
-- The collection is not ERC721Enumerable — deliberately, because an index costs
-- every holder gas on every mint and transfer and this project reads it from a
-- script. So there is no `tokenOfOwnerByIndex` to ask, and finding somebody's
-- cards by walking `ownerOf(1..5603)` is 5,603 calls for one page view.
--
-- Instead the same minute-job that feeds Discord reads the collection's Transfer
-- log and writes the answer down. A mint is a Transfer from the zero address and
-- a sale is a Transfer between two people; both are the same row being updated,
-- which is why this is a table of current owners rather than a list of events.
--
-- THIS IS A CACHE OF THE CHAIN and not a record of anything. Every row is
-- derived, losing it costs a rescan rather than a fact, and the cursor in
-- `cursors` under "feed:owners" says how far it has read. What it must not be is
-- subtly stale in a way nobody notices, which is why the scan moves its cursor
-- only over blocks it actually read.
CREATE TABLE IF NOT EXISTS card_owners (
  token INTEGER PRIMARY KEY,
  owner TEXT NOT NULL
        CHECK (owner = lower(owner) AND length(owner) = 42
               AND substr(owner, 1, 2) = '0x'),
  at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS card_owners_by_owner ON card_owners (owner);

-- The decks somebody built, kept where the wallet is rather than where the
-- browser is.
--
-- These lived in localStorage, which meant a deck belonged to a browser and not
-- to a player: one built on a laptop did not exist on the same person's phone,
-- and /play on a phone therefore offered a deck builder to somebody who already
-- had four decks. A deck is a thing you own, like the cards in it, so it hangs
-- off the wallet.
--
-- `cards` is a JSON array of card ids. Denormalised on purpose: a deck is read
-- and written whole, never queried by the cards inside it, and a join table
-- would buy a query nothing asks in exchange for forty rows per deck.
--
-- WHAT IS IN HERE HAS BEEN CHECKED. app/api/decks validates against the rules
-- and against what the wallet holds before writing, because a deck that arrives
-- over HTTP is a deck somebody typed. The browser checks too, and that one is
-- the filter; this one is the rule.
CREATE TABLE IF NOT EXISTS decks (
  id      TEXT PRIMARY KEY,
  wallet  TEXT NOT NULL CHECK (wallet = lower(wallet) AND length(wallet) = 42 AND substr(wallet, 1, 2) = '0x'),
  name    TEXT NOT NULL,
  cards   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  -- The one being dealt. At most one per wallet, and the index below is what
  -- says so rather than the code that writes it — two decks both claiming the
  -- seat is the kind of thing that reads fine and deals the wrong deck.
  playing INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS decks_by_wallet ON decks (wallet, at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS decks_playing ON decks (wallet) WHERE playing = 1;

-- Who paid to play a board, read off the chain.
--
-- contracts/BoardEntry.sol emits `Entered` and this is that log, written down.
-- It is not a record of anything the browser said: a payment is a fact about
-- Cronos, and the whole reason the fee is a contract call rather than a transfer
-- to a wallet is that a wallet transfer cannot say which board it was for.
--
-- ONE ENTRY IS ONE MATCH, AND THE SERVER DEALS IT. `used_at` is set when the
-- match is handed out, not when a score comes back, and `seed` is the shuffle it
-- was handed out with.
--
-- It was the other way round for a day and it did not hold. The browser picks
-- when to submit and only ever submitted a win, so a loss never reached the
-- server and never spent anything — which is what the maker saw: paid once,
-- played once, lost, and still had a go left. Worse than the missing
-- bookkeeping was what it allowed: the browser also chose the seed, so one
-- payment bought as many attempts as it took to find a shuffle that won.
--
-- Spending at the deal closes both. A disconnection does not cost the go
-- either: coming back hands out THE SAME seed, so the match is still yours to
-- finish and there is still only one of it.
--
-- Keyed on the log and not on the transaction: one transaction could hold two
-- entries, and a primary key that could not tell them apart would quietly throw
-- the second away.
CREATE TABLE IF NOT EXISTS board_entries (
  id      TEXT PRIMARY KEY,
  player  TEXT NOT NULL CHECK (player = lower(player) AND length(player) = 42 AND substr(player, 1, 2) = '0x'),
  board   TEXT NOT NULL,
  -- Wei and base units, as TEXT. Both are what the event said, kept so the
  -- page can show what an entry actually bought rather than what it should have.
  paid    TEXT NOT NULL,
  bought  TEXT NOT NULL,
  at      INTEGER NOT NULL,
  -- Null until the match is handed out.
  used_at INTEGER,
  -- The shuffle it was handed out with. Null until then, and the same number on
  -- every read after — a second deal would be a second attempt.
  seed    INTEGER,
  -- Null until a score has been taken against it. An entry can be dealt once
  -- and scored once, and the two are different moments.
  scored_at INTEGER
);

-- The question every read asks: has this wallet got one left on this board.
CREATE INDEX IF NOT EXISTS board_entries_spare ON board_entries (player, board, used_at);
