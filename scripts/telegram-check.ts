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
  result?: { id?: number; username?: string; first_name?: string };
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

// ── AND THE CHANNEL THE FEEDS GO TO ──────────────────────────────────────────
//
// A bot may only post to a channel it administrates, and the refusal for that
// is one line in a Worker log at whatever hour the burn happened. Asked here
// instead, where somebody is looking.
const chat = process.env.TELEGRAM_FEED_CHAT;
if (!chat) {
  console.log("\nTELEGRAM_FEED_CHAT is not set, so the feeds are not mirrored.");
} else {
  const who = body.result?.id;
  const member = await fetch(
    `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chat)}` +
      `&user_id=${who}`,
  );
  const said = (await member.json()) as {
    ok?: boolean;
    description?: string;
    result?: { status?: string };
  };
  if (said.ok !== true) {
    // Telegram's own words. "chat not found" means the id is wrong or the bot
    // was never added; anything else is usually a permission.
    console.error(`\nfeed chat ${chat}: Telegram said "${said.description ?? "no"}"`);
    process.exit(1);
  }
  const status = said.result?.status ?? "unknown";
  console.log(`feed chat    : ${chat} — the bot is "${status}" there`);
  if (status !== "administrator" && status !== "creator") {
    console.error(
      `\nThe bot has to be an administrator of that chat to post in it. ` +
        `Right now it is "${status}", and every mirrored line will be refused.`,
    );
    process.exit(1);
  }
  console.log("Can post there.");
}
