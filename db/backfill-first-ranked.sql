-- The one staked match that was played before the ladder existed.
--
-- Match 0y5e3q2u372p, finished 2026-10-05 12:40 UTC, 10 CRO a side. Replayed
-- from its seed and moves: 0xeb1b… took it on market cap, $12.9M to $8.4M.
--
-- Both players were on the opening rank with nothing behind them, so K is 32
-- and the expectation is even — which lib/elo.ts turns into exactly 16 either
-- way. Written out rather than computed here so the numbers are readable in a
-- migration a year from now, and they are the same numbers the code produces:
--
--   move({ mine: 1000, theirs: 1000, played: 0, outcome: "win"  }) ===  16
--   move({ mine: 1000, theirs: 1000, played: 0, outcome: "loss" }) === -16
--
-- The `staked = 0` guard is what makes this safe to run twice: after the first
-- run neither row matches, so a second run changes nothing. MAX() mirrors the
-- floor in recordStaked, which does not bite here and is kept so the two
-- statements say the same thing.

-- The winner.
UPDATE players
   SET rank = MAX(100, rank + 16), staked = staked + 1
 WHERE wallet = '0xeb1bd9b64a240c537408ee1f21aa7facdf7c923f' AND staked = 0;

-- And the loser.
UPDATE players
   SET rank = MAX(100, rank - 16), staked = staked + 1
 WHERE wallet = '0x1b95f8f67639bbc3153e6d277070518ff122c421' AND staked = 0;
