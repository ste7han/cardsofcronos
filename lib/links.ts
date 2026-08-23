// Accounts that can be attached to a wallet.
//
// One place naming them, so the profile page, the database check constraint and
// whatever handles the callbacks cannot end up with three different ideas of
// what a network is.
//
// What linking is for: a referral system, points, and points spent on mints or
// token. That only works if an account belongs to exactly one wallet. Which is
// why none of this can be a handle somebody types — a typed handle is a claim,
// and a referral system paying out on claims pays out to whoever claims most.
// Both networks below can prove it instead, and both need the maker to register
// something before they can:
//
//   x         an app on the X developer portal. OAuth 2.0 with PKCE; the client
//             id is public, the secret is a Worker secret and never in source.
//   telegram  a bot from BotFather. The login widget hands back a payload signed
//             with the bot token, checked server-side — no OAuth round trip.
//
// Until those exist the profile says so rather than offering a button that
// cannot work.

export type Network = "x" | "telegram";

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
export const TELEGRAM_BOT = "TrenchesCards_bot";

/**
 * Where the project actually talks.
 *
 * A channel and not the bot — they are two different accounts and it is an easy
 * thing to get wrong. Beside the bot rather than in the footer component,
 * because both of these are the maker's Telegram and changing one without
 * noticing the other is exactly how a dead link ends up in a footer nobody
 * clicks on their own site.
 */
export const TELEGRAM_CHANNEL = "https://t.me/trenchescards";

/**
 * The project's X account. Not the bot, not the maker's own.
 *
 * Beside the Telegram channel for the same reason those two are beside each
 * other: these are the accounts the copycat banner names as the only real ones,
 * and a wrong handle in that sentence points people at somebody else's account
 * while telling them it is safe.
 */
export const X_HANDLE = "trenchescards";
export const X_ACCOUNT = `https://x.com/${X_HANDLE}`;

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
    why: "Where the referrals happen. One X account, one wallet — that rule is the whole defence, because wallets are free and X accounts are not.",
    env: "X_CLIENT_ID",
    built: true,
  },
  telegram: {
    name: "TELEGRAM",
    why: "Where the trenches actually talk. Links a chat account to a wallet so a bot can tell you it is your turn without asking who you are.",
    env: "TELEGRAM_BOT_TOKEN",
    built: true,
  },
};
