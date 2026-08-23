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
   * A Cronos RPC endpoint. Absent falls back to the public ones in
   * lib/cronos.ts, which are rate-limited but free and tried in order. A paid
   * provider's URL carries its key, so it is a secret and never a var.
   */
  CRONOS_RPC?: string;
}
