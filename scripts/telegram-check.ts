// Does the bot exist, and is it the one this repo names?
//
// Run after creating the bot in BotFather:
//
//   npm run telegram:check
//
// The token is read from .env.local, the way every other script here takes a
// key — never from argv, which `ps` shows to every process on the machine, and
// never from a shell line that lands in history. It is printed by nothing here.
//
// ── WHY THIS SCRIPT EXISTS ───────────────────────────────────────────────────
//
// TELEGRAM_BOT in lib/links.ts is the bot's public @username, and it is the
// whole of the Start link a player presses. A bot's display name and its
// username are two different strings — "CrocardBot" may be registered as
// @CroCardBot, @crocard_bot or anything else free at the time — and a wrong one
// is a link that opens Telegram and finds nothing. That failure is invisible
// from this side: the site renders a button, the player presses it, and nobody
// is notified for the rest of the project's life.
//
// getMe answers it in one call, so there is no reason to guess.

import { TELEGRAM_BOT } from "../lib/links";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("No TELEGRAM_BOT_TOKEN in the environment. Nothing to ask with.");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
const body = (await response.json()) as {
  ok?: boolean;
  description?: string;
  result?: { username?: string; first_name?: string; can_read_all_group_messages?: boolean };
};

if (body.ok !== true) {
  // Telegram's own words. "Unauthorized" means the token is wrong or revoked.
  console.error(`Telegram refused: ${body.description ?? "no reason given"}`);
  process.exit(1);
}

const username = body.result?.username ?? "(none)";
console.log(`bot          : ${body.result?.first_name ?? "?"}`);
console.log(`username     : @${username}`);
console.log(`lib/links.ts : ${TELEGRAM_BOT === null ? "(not set)" : `@${TELEGRAM_BOT}`}`);

if (TELEGRAM_BOT !== username) {
  console.error(
    `\nThese do not match. Set TELEGRAM_BOT in lib/links.ts to "${username}" ` +
      `or the Start link on /profile goes nowhere.`,
  );
  process.exit(1);
}

console.log("\nMatches. The Start link on /profile points at this bot.");
