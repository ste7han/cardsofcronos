-- The Telegram buy feed shows buys above a floor in dollars, and a buy is
-- denominated in CRO, so a conversion has to come from somewhere and be
-- remembered. See the prices table in db/schema.sql.
CREATE TABLE IF NOT EXISTS prices (
  symbol    TEXT PRIMARY KEY,
  micro_usd INTEGER NOT NULL,
  at        INTEGER NOT NULL
);
