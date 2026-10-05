// The bindings this Worker actually has.
//
// Written by hand rather than generated, so adding one is a decision somebody
// made rather than a diff that appeared. Everything here is declared in
// wrangler.jsonc except the secrets, which are set with `wrangler secret put`
// and never appear in any file — see CLAUDE.md on why that rule has no
// exceptions.

interface CloudflareEnv {
  /** Cloudflare D1. Schema in db/schema.sql. */
  DB: D1Database;
  /** Public: it travels in the authorize URL. Declared in wrangler.jsonc. */
  X_CLIENT_ID?: string;
  /** A Worker secret. Absent locally, and every caller has to handle that. */
  X_CLIENT_SECRET?: string;
  /** A Worker secret. It is also the HMAC key the login payload is signed with. */
  TELEGRAM_BOT_TOKEN?: string;
  /**
   * The channel or group the public feeds and the weekly result are mirrored
   * into, by chat id.
   *
   * A chat id and not a @name: a channel's name can be changed by whoever runs
   * it and the id cannot. The bot has to be an administrator of it, or every
   * send is refused — and refused in a way only the logs would show, which is
   * why scripts/telegram-check.ts reports on this too.
   *
   * Unset means the mirroring is off. That is a real state: the Discord feeds
   * carry on either way.
   */
  TELEGRAM_FEED_CHAT?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  /**
   * A Cronos RPC endpoint. Absent falls back to the public ones in
   * lib/cronos.ts, which are rate-limited but free and tried in order. A paid
   * provider's URL carries its key, so it is a secret and never a var.
   */
  CRONOS_RPC?: string;
  /**
   * What the weekly cron sends to prove it is the cron.
   *
   * Absent means the job refuses to run rather than running for anybody who
   * finds the URL. /api/cron/weekly is a public route: it has to be, because
   * the scheduled handler reaches it the same way a browser would.
   */
  CRON_SECRET?: string;
  /**
   * The PrizePot publisher's private key, 0x-prefixed.
   *
   * THE ONLY KEY THIS PROJECT PUTS ON A SERVER, and it is allowed there because
   * of what contracts/PrizePot.sol lets it do: name the winner of a week that
   * has not closed yet, and nothing else. It cannot withdraw, cannot reopen a
   * week, cannot reach the balance. If it leaks, the owner rotates it with
   * setPublisher and the worst that happened is one week's pot.
   *
   * Never the owner key. That one can reach the money through the rescue hatch
   * and belongs on a wallet that never touches a server.
   */
  PUBLISHER_KEY?: string;
  /**
   * Discord webhook URLs, one per feed. See lib/feed.ts.
   *
   * A webhook URL is a password with no username: anybody holding one can post
   * into that channel, as that webhook, until somebody deletes it. So they are
   * secrets like the rest — never in wrangler.jsonc, never in a log line, and
   * not in a URL this project builds.
   *
   * Absent means that feed does not run and says so, rather than the job
   * failing: one channel nobody set up should not stop the other two.
   */
  DISCORD_MINTS?: string;
  DISCORD_BUYS?: string;
  DISCORD_BURNS?: string;
  /**
   * Cards sold on EbisusBay.
   *
   * The odd one out: the three above are read off the chain, and this is read
   * off EbisusBay's own API — a sale happens inside their marketplace contract
   * and their answer carries the card's name and the price in CRO, which a raw
   * log does not. It runs on its own so that an API changing shape cannot take
   * the chain feeds down with it. See lib/sales.ts.
   */
  DISCORD_SALES?: string;
  /**
   * Where a finished match against the bot is announced.
   *
   * Unlike the three above, what goes here is not read off a log — a solo match
   * happens in somebody's browser. It is replayed on the server first; see
   * app/api/solo/route.ts for why that is the only version of this worth
   * building.
   */
  DISCORD_SOLO?: string;
  /**
   * Loaded Lions results, in their own channel.
   *
   * A board with its own entry fee and its own prize pot is its own
   * competition, and putting its results in the channel named after the market
   * was the same mistake as one leaderboard for two boards — every reader has
   * to remember which one a line is about.
   *
   * Unset falls back to DISCORD_SOLO rather than going quiet: a result nobody
   * hears about is worse than one in the wrong room.
   */
  DISCORD_PVE_LIONS?: string;
  /**
   * Where a finished PvP match is announced, split by what was at stake.
   *
   * Two channels because they are two different things to watch: a friendly is
   * a game and a ranked one is money. Nothing here needs verifying first — this
   * server refereed the match, replaying it from the seed and the moves.
   */
  DISCORD_PVP_FRIENDLY?: string;
  DISCORD_PVP_RANKED?: string;
  /**
   * The general channel, which hears about an open seat as well.
   *
   * The two rooms above are where somebody goes who is already looking for a
   * game. Most people are not — they are in general talking about something
   * else, and a seat nobody sees expires in an hour. Absent means the rooms
   * still get it and general does not, which is where this started.
   */
  DISCORD_PVP_GENERAL?: string;
  /**
   * The Durable Object holding the feeds' clock. See worker/index.js.
   *
   * Optional because nothing in the app needs it: only the Worker wrapper winds
   * it up, and a build without the binding should still serve pages.
   */
  FEED_TICKER?: DurableObjectNamespace;
}
