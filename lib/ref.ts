"use client";

// A referral code carried in from a link.
//
// Somebody arriving on the site/?ref=ABC has no wallet yet — they have not
// signed in, and may not for another ten minutes while they read the cards page.
// The code has to survive that, so it is kept in this browser until there is a
// wallet to attach it to, and then used once and thrown away.
//
// Never overwritten. The first link somebody follows is who brought them; a
// second link later is somebody else's attempt to take the credit.

export const PENDING_REF = "ref";

const KEY = "tcg.ref.v1";

/** Remembers a code from the URL, if there is one and none is already held. */
export function noticeRefInUrl(): void {
  if (typeof window === "undefined") return;

  const code = new URLSearchParams(window.location.search).get(PENDING_REF);
  if (!code) return;

  // Cleaned off the URL either way, so it is not carried into every link the
  // visitor shares from here — that is how one person's code ends up credited
  // for a whole group.
  const url = new URL(window.location.href);
  url.searchParams.delete(PENDING_REF);
  window.history.replaceState({}, "", url.toString());

  if (window.localStorage.getItem(KEY)) return;
  window.localStorage.setItem(KEY, code.trim().toUpperCase().slice(0, 8));
}

/** The held code, without spending it. For screens that only want to say so. */
export function peekPendingRef(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

/** Hands over the held code and forgets it. */
export function takePendingRef(): string | null {
  if (typeof window === "undefined") return null;
  const code = window.localStorage.getItem(KEY);
  if (code) window.localStorage.removeItem(KEY);
  return code;
}
