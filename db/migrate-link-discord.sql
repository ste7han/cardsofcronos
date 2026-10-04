-- Discord joins X and Telegram as something a wallet can be linked to.
--
-- ── WHY THIS REBUILDS THE TABLE ──────────────────────────────────────────────
--
-- The network column carries a CHECK listing the networks by name, and SQLite
-- cannot alter a CHECK: there is no ALTER TABLE for it. The only way to widen
-- one is the rebuild below — new table, copy, drop, rename — which is also why
-- the full column definitions are repeated here rather than referred to. They
-- must stay identical to db/schema.sql apart from the one list.
--
-- The index is recreated afterwards because dropping the old table takes it.
--
-- Wrangler runs a --file import as one transaction, so a failure anywhere here
-- leaves the original table untouched.

CREATE TABLE links_new (
  wallet        TEXT NOT NULL CHECK (wallet = lower(wallet) AND length(wallet) = 42 AND substr(wallet, 1, 2) = '0x'),
  network       TEXT NOT NULL CHECK (network IN ('x', 'telegram', 'discord')),
  account_id    TEXT NOT NULL,
  handle        TEXT NOT NULL,
  linked_at     INTEGER NOT NULL,
  dm_problem    TEXT,
  PRIMARY KEY (wallet, network)
);

INSERT INTO links_new (wallet, network, account_id, handle, linked_at, dm_problem)
  SELECT wallet, network, account_id, handle, linked_at, dm_problem FROM links;

DROP TABLE links;
ALTER TABLE links_new RENAME TO links;

CREATE UNIQUE INDEX IF NOT EXISTS links_account ON links (network, account_id);
