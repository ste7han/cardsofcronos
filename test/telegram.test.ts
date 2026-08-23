// Proving a Telegram account.
//
// The hash is the whole security of this link — there is no code to exchange and
// no second round trip — so these tests build real payloads with a known token
// and then try to get a forged one past.

import { describe, expect, it } from "vitest";

import { MAX_AGE, authFrom, checkString, handleOf, verifyTelegram, type TelegramAuth } from "@/lib/telegram";

const TOKEN = "123456:AAHtestTokenNotARealOneAtAll";
const NOW = 1_700_000_000_000;

/** Sign a payload the way Telegram does, so the test is not marking its own homework. */
async function signed(over: Partial<TelegramAuth> = {}): Promise<TelegramAuth> {
  const auth = {
    id: "42",
    first_name: "Stephan",
    username: "trencher",
    auth_date: String(Math.floor(NOW / 1000)),
    ...over,
  } as TelegramAuth;

  const secret = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(TOKEN));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(checkString(auth as unknown as Record<string, string | undefined>)),
  );
  const hash = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { ...auth, hash };
}

describe("the check string", () => {
  it("is sorted, newline joined, and leaves the hash out", () => {
    // The hash cannot be part of what it signs.
    expect(checkString({ b: "2", hash: "x", a: "1" })).toBe("a=1\nb=2");
  });

  it("leaves absent fields out rather than sending them empty", () => {
    // An empty string is a value. Including one changes the string and every
    // check then fails, which is a very quiet way to break a login.
    expect(checkString({ a: "1", b: undefined })).toBe("a=1");
  });
});

describe("verifying", () => {
  it("accepts what Telegram signed", async () => {
    expect(await verifyTelegram(await signed(), TOKEN, NOW)).toBe(true);
  });

  it("refuses a field changed after signing", async () => {
    // The attack: take a real payload and put your own id in it.
    const auth = await signed();
    expect(await verifyTelegram({ ...auth, id: "999" }, TOKEN, NOW)).toBe(false);
    expect(await verifyTelegram({ ...auth, username: "someone_else" }, TOKEN, NOW)).toBe(false);
  });

  it("refuses a hash made with a different token", async () => {
    expect(await verifyTelegram(await signed(), "999999:someoneElsesToken", NOW)).toBe(false);
  });

  it("refuses one that has gone stale, and one dated forward", async () => {
    const auth = await signed();
    // A hash does not expire on its own, so one lifted out of a browser history
    // would otherwise still link an account a year later.
    expect(await verifyTelegram(auth, TOKEN, NOW + MAX_AGE * 1000 - 1000)).toBe(true);
    expect(await verifyTelegram(auth, TOKEN, NOW + MAX_AGE * 1000 + 2000)).toBe(false);
    expect(await verifyTelegram(await signed({ auth_date: String(Math.floor(NOW / 1000) + 600) }), TOKEN, NOW)).toBe(false);
  });

  it("says no to rubbish rather than falling over", async () => {
    const auth = await signed();
    expect(await verifyTelegram({ ...auth, hash: "" }, TOKEN, NOW)).toBe(false);
    expect(await verifyTelegram({ ...auth, hash: "not hex" }, TOKEN, NOW)).toBe(false);
    expect(await verifyTelegram({ ...auth, auth_date: "soon" }, TOKEN, NOW)).toBe(false);
  });
});

describe("reading the callback", () => {
  it("needs an id, a date and a hash", () => {
    expect(authFrom(new URLSearchParams("id=1&auth_date=2&hash=3"))).toMatchObject({ id: "1" });
    expect(authFrom(new URLSearchParams("id=1&auth_date=2"))).toBeNull();
    expect(authFrom(new URLSearchParams(""))).toBeNull();
  });

  it("leaves out what was not sent, rather than sending empty strings", async () => {
    // This is the same trap as the check string, arriving from the other side: a
    // photo_url of "" would be signed by nobody.
    const auth = authFrom(new URLSearchParams("id=1&auth_date=2&hash=3"))!;
    expect(auth.photo_url).toBeUndefined();
    expect(auth.username).toBeUndefined();
    // And a payload built this way still verifies, which is the real proof.
    expect(await verifyTelegram(await signed({ username: undefined, first_name: undefined }), TOKEN, NOW)).toBe(true);
  });
});

describe("what to show", () => {
  it("prefers the username and falls back to a name", () => {
    // Plenty of Telegram accounts have no username, and a blank on a profile
    // page reads as a bug.
    expect(handleOf({ id: "1", auth_date: "1", hash: "x", username: "trencher" })).toBe("trencher");
    expect(handleOf({ id: "1", auth_date: "1", hash: "x", first_name: "Stephan" })).toBe("Stephan");
  });
});
