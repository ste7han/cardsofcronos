// What has to survive the trip to X.
//
// The cookie carries a wallet proof, and the reason it is not signed is that the
// proof cannot be edited without the private key behind it. That argument only
// holds if the cookie round-trips exactly, and if a mangled one is refused
// rather than half-read.

import { describe, expect, it } from "vitest";

import { LINK_COOKIE, clearPending, readPending, sealPending } from "@/lib/link-cookie";

const pending = { proof: { address: "abc", nonce: "n" }, state: "state", verifier: "verifier" };

describe("the pending cookie", () => {
  it("comes back exactly as it went in", () => {
    const header = sealPending(LINK_COOKIE, pending, true).split(";")[0]!;
    expect(readPending(header, LINK_COOKIE)).toEqual(pending);
  });

  it("is httpOnly and Lax, and Secure only where there is TLS", () => {
    // Lax and not Strict: Strict is dropped on the redirect back from X, and the
    // flow then fails with nothing to read.
    const https = sealPending(LINK_COOKIE, pending, true);
    expect(https).toContain("HttpOnly");
    expect(https).toContain("SameSite=Lax");
    expect(https).toContain("Secure");
    expect(sealPending(LINK_COOKIE, pending, false)).not.toContain("Secure");
  });

  it("finds its own cookie among others", () => {
    const mine = sealPending(LINK_COOKIE, pending, true).split(";")[0]!;
    expect(readPending(`other=1; ${mine}; another=2`, LINK_COOKIE)).toEqual(pending);
  });

  it("refuses rubbish rather than half-reading it", () => {
    expect(readPending(null, LINK_COOKIE)).toBeNull();
    expect(readPending("", LINK_COOKIE)).toBeNull();
    expect(readPending(`${LINK_COOKIE}=`, LINK_COOKIE)).toBeNull();
    expect(readPending(`${LINK_COOKIE}=not-base64!`, LINK_COOKIE)).toBeNull();
    // Valid base64, valid JSON, wrong shape. This is the one that would
    // otherwise sail through and fail somewhere less obvious.
    expect(readPending(`${LINK_COOKIE}=${btoa('{"state":1}')}`, LINK_COOKIE)).toBeNull();
  });

  it("clears with a zero age and the same path", () => {
    // A different path leaves the old cookie in place and the next attempt reads
    // a stale state.
    const cleared = clearPending(LINK_COOKIE, true);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("Path=/api/link");
  });
});
