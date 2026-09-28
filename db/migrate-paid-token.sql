DROP TABLE IF EXISTS tournament_paid;
CREATE TABLE tournament_paid (
  week     TEXT NOT NULL,
  board    TEXT NOT NULL DEFAULT 'bot',
  wallet   TEXT NOT NULL
           CHECK (wallet = lower(wallet)),
  wei      TEXT NOT NULL,
  tx_hash  TEXT NOT NULL
           CHECK (tx_hash = lower(tx_hash) AND length(tx_hash) = 66
                  AND substr(tx_hash, 1, 2) = '0x'),
  at       INTEGER NOT NULL,
  token    TEXT NOT NULL
           CHECK (token = lower(token) AND length(token) = 42
                  AND substr(token, 1, 2) = '0x'),
  PRIMARY KEY (week, board, token)
);
