// Proving a Telegram account, which Telegram makes unusually easy to get right.
//
// No OAuth round trip. Their login widget hands the browser a set of fields and
// a `hash`, and that hash is an HMAC over the fields keyed by SHA-256 of the bot
// token. Only whoever holds the token can produce it, and only Telegram and this
// Worker hold it — so a payload that verifies came from Telegram, and one that
// does not is somebody's invention.
//
// The whole check runs server-side on data the browser merely carried. That is
// the same standard the wallet and X are held to: what the client says is a
// claim, and a claim is checked.

/** The fields Telegram sends back. Everything but `hash` is signed. */
export interface TelegramAuth {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

/**
 * How old a login may be.
 *
 * A payload stays valid forever otherwise: the hash does not expire, so one
 * captured out of a browser's history would still link an account a year later.
 * A day is Telegram's own suggestion and is generous for something a person does
 * in one sitting.
 */
export const MAX_AGE = 86_400;

/**
 * The string the hash is taken over.
 *
 * Sorted by key and joined with newlines, exactly as documented — and `hash`
 * itself left out, because it cannot be part of what it signs. Fields Telegram
 * did not send are absent rather than empty: an empty string is a value, and
 * including one changes the string and fails every check.
 */
export function checkString(auth: Record<string, string | undefined>): string {
  return Object.keys(auth)
    .filter((key) => key !== "hash" && auth[key] !== undefined)
    .sort()
    .map((key) => `${key}=${auth[key]}`)
    .join("\n");
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Did Telegram sign this, and recently? */
export async function verifyTelegram(
  auth: TelegramAuth,
  botToken: string,
  now: number,
): Promise<boolean> {
  const seconds = Number(auth.auth_date);
  if (!Number.isFinite(seconds)) return false;
  // Both ends, the same as the wallet session: a clock that ran backwards and a
  // date set forward to outlive the window are the same kind of wrong.
  const age = Math.floor(now / 1000) - seconds;
  if (age < -60 || age > MAX_AGE) return false;

  const secret = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(botToken));
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(checkString(auth as unknown as Record<string, string | undefined>)),
  );

  return hex(signature) === auth.hash;
}

/**
 * What to show for this account.
 *
 * A username when there is one — plenty of Telegram accounts have none, and a
 * blank name on a profile page reads as a bug. The id is what identity rests on
 * either way; this is only a label.
 */
export function handleOf(auth: TelegramAuth): string {
  return auth.username ?? [auth.first_name, auth.last_name].filter(Boolean).join(" ") ?? auth.id;
}

/** Pulls the fields out of the callback URL, or nothing if the required ones are missing. */
export function authFrom(params: URLSearchParams): TelegramAuth | null {
  const id = params.get("id");
  const auth_date = params.get("auth_date");
  const hash = params.get("hash");
  if (!id || !auth_date || !hash) return null;

  const optional = (key: string) => params.get(key) ?? undefined;
  return {
    id,
    auth_date,
    hash,
    first_name: optional("first_name"),
    last_name: optional("last_name"),
    username: optional("username"),
    photo_url: optional("photo_url"),
  };
}
