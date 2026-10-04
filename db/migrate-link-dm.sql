-- Linked accounts need somewhere to record that we cannot actually reach them.
-- See the dm_problem column in db/schema.sql.
--
-- Existing Telegram links were made through the login widget, which proves who
-- somebody is and does not open a chat with the bot. So every one of them is
-- 'never-started' until a send succeeds — the honest answer, and the one that
-- puts a Start button on their profile instead of silently dropping messages.
-- X rows stay NULL: nothing is sent over X and the column does not apply.
ALTER TABLE links ADD COLUMN dm_problem TEXT;
UPDATE links SET dm_problem = 'never-started' WHERE network = 'telegram';
