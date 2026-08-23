// The OAuth arithmetic, without a network.
//
// Everything checked here is something a live test would not catch cheaply: a
// PKCE pair that does not verify, an authorize URL missing a parameter, a
// redirect URI that does not match what X was told. Each of those fails at X
// with an error that names nothing useful.

import { describe, expect, it } from "vitest";

import { X_SCOPES, authorizeUrl, newState, pkce, redirectUriFor } from "@/lib/x-oauth";

const base64urlOf = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

describe("PKCE", () => {
  it("produces a challenge that really is the hash of the verifier", () => {
    // The whole point of PKCE. If these two do not correspond, X rejects the
    // exchange with a message about the code, not about the challenge.
    return pkce().then(async ({ verifier, challenge }) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      expect(challenge).toBe(base64urlOf(new Uint8Array(digest)));
    });
  });

  it("is base64url, not base64", async () => {
    // + / = are legal in base64 and change meaning in a URL. Every one of the
    // three has to be gone.
    const { verifier, challenge } = await pkce();
    for (const value of [verifier, challenge]) {
      expect(value).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
    // 32 bytes of entropy, which the spec's 43-character minimum is written for.
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("is different every time", async () => {
    const [a, b] = await Promise.all([pkce(), pkce()]);
    expect(a.verifier).not.toBe(b.verifier);
    expect(newState()).not.toBe(newState());
  });
});

describe("the authorize URL", () => {
  const url = () =>
    new URL(
      authorizeUrl({
        clientId: "client",
        redirectUri: "https://trenches.cards/api/link/x/callback",
        state: "state",
        challenge: "challenge",
      }),
    );

  it("carries everything X requires", () => {
    const params = url().searchParams;
    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe("client");
    expect(params.get("redirect_uri")).toBe("https://trenches.cards/api/link/x/callback");
    expect(params.get("state")).toBe("state");
    expect(params.get("code_challenge")).toBe("challenge");
    // S256 and not "plain". Plain is legal and pointless.
    expect(params.get("code_challenge_method")).toBe("S256");
  });

  it("asks for identity and nothing more", () => {
    // No offline.access: a refresh token is a thing to store and keep valid, and
    // all this ever wanted was the account id, once.
    expect(url().searchParams.get("scope")).toBe(X_SCOPES);
    expect(X_SCOPES).not.toContain("offline.access");
    expect(X_SCOPES).not.toContain("write");
  });
});

describe("the redirect URI", () => {
  it("is the origin the request arrived on", () => {
    // Both of these are registered with X, and it has to be whichever one is
    // actually in use — X compares it character for character at the exchange.
    expect(redirectUriFor("https://trenches.cards/api/link/x/start")).toBe(
      "https://trenches.cards/api/link/x/callback",
    );
    expect(redirectUriFor("http://127.0.0.1:3000/api/link/x/start")).toBe(
      "http://127.0.0.1:3000/api/link/x/callback",
    );
  });

  it("does not care what the path was", () => {
    expect(redirectUriFor("https://trenches.cards/anything?x=1")).toBe(
      "https://trenches.cards/api/link/x/callback",
    );
  });
});
