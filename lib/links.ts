// Accounts that can be attached to a wallet.
//
// One place naming them, so the profile page, the database check constraint and
// whatever handles the callbacks cannot end up with three different ideas of
// what a network is.
//
// What linking is for, now that the referral system it was built for is gone:
// telling a person the same thing in two places. A Telegram link lets a bot say
// it is your turn without asking who you are, and an X link is how the maker
// reaches somebody about a match or a prize.
//
// It is still something the network confirms rather than a handle somebody
// types. A typed handle is a claim, and one X account being ten wallets is ten
// people to anything counting. Both networks below can prove it instead, and
// both need the maker to register something first:
//
//   x         an app on the X developer portal. OAuth 2.0 with PKCE; the client
//             id is public, the secret is a Worker secret and never in source.
//   telegram  a bot from BotFather. The login widget hands back a payload signed
//             with the bot token, checked server-side — no OAuth round trip.
//
// Until those exist the profile says so rather than offering a button that
// cannot work.

// ── NULL UNTIL SOMEBODY REGISTERS THEM ──────────────────────────────────────
// All three of these carried the other project's accounts: a bot called
// TrenchesCards_bot, t.me/trenchescards, @trenchescards. They are not this
// game's accounts and they are named on screen as the ones that are safe — a
// copycat warning pointing at somebody else's Telegram is worse than no warning.
//
// Null rather than a guess, for the same reason the wallets in lib/revenue.ts
// are null: every place that shows one hides it instead, which is a gap a person
// can see. A wrong handle is a gap nobody can see.
//
// TODO: register a bot with BotFather, a channel and an X account for Cards of
// Cronos, then fill in all three. Telegram linking additionally needs
// `/setdomain` pointed at the live site or the widget silently declines to work.

export type Network = "x" | "telegram" | "discord";

/**
 * The bot behind the Telegram button.
 *
 * Here rather than in wrangler.jsonc because the browser is what needs it — the
 * widget prints this name on its own button — and a Worker variable would have
 * to be plumbed through a server component to reach it. It is public, it does
 * not change, and its token is the secret.
 *
 * The bot must have `/setdomain` pointed at the site in BotFather or the widget
 * silently declines to work. One domain per bot, so this is the live site and
 * local development cannot link Telegram.
 */
export const TELEGRAM_BOT: string | null = "CrocardBot";

/**
 * Where the project actually talks.
 *
 * A channel and not the bot — they are two different accounts and it is an easy
 * thing to get wrong. Beside the bot rather than in the footer component,
 * because both of these are the maker's Telegram and changing one without
 * noticing the other is exactly how a dead link ends up in a footer nobody
 * clicks on their own site.
 */
export const TELEGRAM_CHANNEL: string | null = null;

/**
 * The project's X account. Not the bot, not the maker's own.
 *
 * Beside the Telegram channel for the same reason those two are beside each
 * other: these are the accounts the copycat banner names as the only real ones,
 * and a wrong handle in that sentence points people at somebody else's account
 * while telling them it is safe.
 */
export const X_HANDLE: string | null = null;
export const X_ACCOUNT: string | null = X_HANDLE === null ? null : `https://x.com/${X_HANDLE}`;

export interface Linkable {
  name: string;
  /** Why this one is worth attaching, in the player's terms. */
  why: string;
  /** The environment variable that switches it on. Absent means not configured. */
  env: string;
  /** Is there code behind this yet? Set by hand, because it is a fact about the repo. */
  built: boolean;
}

export const LINKABLE: Record<Network, Linkable> = {
  x: {
    name: "X",
    why: "How the maker reaches you about a match or a prize. One X account, one wallet — wallets are free and X accounts are not.",
    env: "X_CLIENT_ID",
    built: true,
  },
  discord: {
    name: "DISCORD",
    why: "Where the game is talked about. Links an account to a wallet so the bot can tag you in the match room when it is your turn — no DM permission to grant, just a mention you will see on your phone.",
    env: "DISCORD_CLIENT_ID",
    built: true,
  },
  telegram: {
    name: "TELEGRAM",
    why: "Where the trenches actually talk. Links a chat account to a wallet so a bot can tell you it is your turn without asking who you are.",
    env: "TELEGRAM_BOT_TOKEN",
    built: true,
  },
};
