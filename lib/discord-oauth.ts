// Linking a Discord account, which is two HTTPS calls and no more.
//
// ── WHY NO PKCE ──────────────────────────────────────────────────────────────
//
// The X flow uses it because X requires it. Discord's authorization code flow
// for a confidential client is the client secret, and sending a code_verifier
// for a challenge that was never registered is a way to be refused. `state` is
// still here and still checked: that is the CSRF defence, and it is the one that
// matters when the thing coming back is a redirect the browser followed.
//
// ── WHAT IT ASKS FOR ─────────────────────────────────────────────────────────
//
// `identify` and nothing else. It returns the account's id and username and no
// email, no guild list and no ability to act as them. The id is what a mention
// is built from and the only thing worth storing; the username is shown and is
// never an identity, because people change them.

import { newState } from "@/lib/x-oauth";

export const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";
export const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
export const DISCORD_ME = "https://discord.com/api/users/@me";

/** The least it can be asked for. */
export const DISCORD_SCOPES = "identify";

export { newState };

/**
 * Where Discord sends the browser back to.
 *
 * Built from the request rather than from a constant, so the apex and a
 * preview deployment each come back to themselves. Every one of these has to be
 * registered in the Discord application or the authorize call is refused — and
 * refused with Discord's own screen, not ours.
 */
export function redirectUriFor(requestUrl: string): string {
  return new URL("/api/link/discord/callback", new URL(requestUrl).origin).toString();
}

export function authorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(DISCORD_AUTHORIZE);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DISCORD_SCOPES);
  url.searchParams.set("state", params.state);
  // So somebody linking a second wallet is asked again rather than silently
  // handed the account they are already signed in as.
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export interface DiscordIdentity {
  /** The snowflake. This is what a mention is made of, and it never changes. */
  id: string;
  /** What to show. People change these, so it is never the identity. */
  username: string;
}

/**
 * Exchange the code for the account behind it.
 *
 * Throws with Discord's own words on failure. The caller turns that into a
 * redirect a person can read — see the callback route.
 */
export async function identify(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<DiscordIdentity> {
  const token = await fetch(DISCORD_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!token.ok) {
    throw new Error(`Discord refused the code exchange: ${token.status} ${await token.text()}`);
  }
  const { access_token } = (await token.json()) as { access_token?: string };
  if (!access_token) throw new Error("Discord returned no access token.");

  const me = await fetch(DISCORD_ME, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!me.ok) {
    throw new Error(`Discord would not say who that is: ${me.status} ${await me.text()}`);
  }
  const body = (await me.json()) as { id?: string; username?: string };
  if (!body.id) throw new Error("Discord returned an account with no id.");

  return { id: body.id, username: body.username ?? body.id };
}
