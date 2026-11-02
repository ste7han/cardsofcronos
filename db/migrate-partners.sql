-- Projects asking for a set of their own. See app/partners and lib/partners.ts.
--
--   npx wrangler d1 execute cards-of-cronos --remote --file db/migrate-partners.sql
--
-- Only adds; nothing existing is touched, so it is safe to run twice.

CREATE TABLE IF NOT EXISTS partner_applications (
  id       TEXT PRIMARY KEY,
  project  TEXT NOT NULL,
  website  TEXT NOT NULL,
  token    TEXT CHECK (token IS NULL OR (token = lower(token) AND length(token) = 42
                                         AND substr(token, 1, 2) = '0x')),
  x        TEXT,
  telegram TEXT,
  contact  TEXT NOT NULL,
  about    TEXT NOT NULL,
  sender   TEXT NOT NULL,
  at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS partner_applications_sender ON partner_applications (sender, at);
