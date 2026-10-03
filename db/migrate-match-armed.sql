-- Matches got an opening grace window, so a row needs somewhere to record
-- whether the turn clock has started. See MatchRecord.armed in engine/record.ts.
--
-- Rows that already exist are matches already under way, and their clocks are
-- demonstrably running: both players have been at the table. Backfilled to
-- created_at rather than left NULL, which would hand every live match in flight
-- a fresh opening grace.
ALTER TABLE matches ADD COLUMN armed INTEGER;
UPDATE matches SET armed = created_at WHERE armed IS NULL;
