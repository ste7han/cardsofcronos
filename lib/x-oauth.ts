// Signing in with X, the parts that are just arithmetic.
//
// Split from the routes because all of it is testable without a network: the
// PKCE pair, the authorize URL, the shape of the token request. What is left in
// the routes is two fetches and a cookie.
//
// OAuth 2.0 with PKCE and a confidential client. PKCE alone protects a public
// client that cannot keep a secret; we have a Worker, so the secret is kept and
// used as well. Either would do. Both is cheap.

/**
 * Where X lives.
 *
 * Named here rather than inlined because X moved these from twitter.com and may
 * move them again, and a hostname buried in the middle of a fetch is the kind of
 * thing nobody finds on the day it breaks.
 */
export const X_AUTHORIZE = "https://x.com/i/oauth2/authorize";
export const X_TOKEN = "https://api.x.com/2/oauth2/token";
export const X_ME = "https://api.x.com/2/users/me";

/**
 * What we ask for, and nothing beyond it.
 *
 * `users.read` is the one that matters — it is what /2/users/me needs. X will
 * not grant it without `tweet.read` alongside, which is why a scope we have no
 * use for is in this list. Deliberately no `offline.access`: that returns a
 * refresh token, and a token we would have to store and keep valid is a
 * liability when the only thing we ever wanted was the account's id, once.
 */
export const X_SCOPES = "users.read tweet.read";

/** base64url, which is base64 with three substitutions and no padding. */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64url(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer);
}

export interface Pkce {
  /** Kept by us, sent only at the token exchange. */
  verifier: string;
  /** Sent to X up front, so the exchange proves it was the same client. */
  challenge: string;
}

export async function pkce(): Promise<Pkce> {
  // 32 bytes is 43 base64url characters, comfortably inside the 43–128 the spec
  // allows and well past guessing.
  const verifier = randomBase64url(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** A one-off value that ties the callback to the request that started it. */
export function newState(): string {
  return randomBase64url(16);
}

export function authorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(X_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", X_SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * The redirect URI, taken from the request rather than configured.
 *
 * It has to match what X was told, character for character, and X was told two:
 * the live site and 127.0.0.1 for development. Deriving it from the origin picks
 * whichever one is actually being used, so there is no setting to get wrong and
 * no second config that can disagree with the first.
 */
export function redirectUriFor(requestUrl: string): string {
  return `${new URL(requestUrl).origin}/api/link/x/callback`;
}

export interface XIdentity {
  id: string;
  username: string;
}

/**
 * Trade the code for a token, then ask who it belongs to.
 *
 * The id is what gets stored. A username is a display convenience and changes
 * whenever its owner feels like it; an account id does not, and a referral
 * system that keyed on the handle would hand somebody else's points to whoever
 * picked the name up next.
 */
export async function identify(params: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<XIdentity> {
  const token = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // Basic auth, because this is a confidential client. The client_id also
      // goes in the body: X documents it both ways and sending both is accepted.
      authorization: `Basic ${btoa(`${params.clientId}:${params.clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.verifier,
      client_id: params.clientId,
    }),
  });

  if (!token.ok) {
    // The body, not just the status. X says useful things in it — a redirect_uri
    // that does not match is a 400 that names the field, and without this you
    // are guessing at a config you cannot see.
    throw new Error(`X refused the code (${token.status}): ${await token.text()}`);
  }

  const { access_token } = (await token.json()) as { access_token?: string };
  if (!access_token) throw new Error("X returned a token response with no access token in it.");

  const me = await fetch(X_ME, { headers: { authorization: `Bearer ${access_token}` } });
  if (!me.ok) throw new Error(`X refused to say who that is (${me.status}): ${await me.text()}`);

  const body = (await me.json()) as { data?: { id?: string; username?: string } };
  const id = body.data?.id;
  const username = body.data?.username;
  if (!id || !username) {
    throw new Error("X answered /users/me without an id and a username.");
  }
  return { id, username };
}
