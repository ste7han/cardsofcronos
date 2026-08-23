// A referral code arriving on a link.
//
// This exists because the link was broken and nothing said so: the code was only
// ever caught by the profile page, and the link pointed at the homepage. The
// person who followed one would not have been credited even if they had worked
// out what to do. So the rules it has to obey are written down here rather than
// left to a component's mount order.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_REF, noticeRefInUrl, peekPendingRef, takePendingRef } from "@/lib/ref";

/** Just enough browser for this file: a URL, a store, and a history that logs. */
function browser(url: string) {
  const store = new Map<string, string>();
  const replaced: string[] = [];

  vi.stubGlobal("window", {
    location: { search: new URL(url).search, href: url },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
    history: { replaceState: (_s: unknown, _t: string, to: string) => replaced.push(to) },
  });

  return { store, replaced };
}

beforeEach(() => vi.unstubAllGlobals());

describe("a code on a link", () => {
  it("is kept", () => {
    const { store } = browser(`https://cardsofcronos.test/profile?${PENDING_REF}=ABCD1234`);
    noticeRefInUrl();
    expect(peekPendingRef()).toBe("ABCD1234");
    expect(store.size).toBe(1);
  });

  it("is upper-cased and trimmed to a code's length", () => {
    browser(`https://cardsofcronos.test/?${PENDING_REF}=abcd1234extra`);
    noticeRefInUrl();
    expect(peekPendingRef()).toBe("ABCD1234");
  });

  it("comes off the URL", () => {
    // Otherwise the visitor shares the page they are on and carries somebody
    // else's code into it — which is how one person gets credited for a group.
    const { replaced } = browser(`https://cardsofcronos.test/profile?${PENDING_REF}=ABCD1234`);
    noticeRefInUrl();
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).not.toContain(PENDING_REF);
  });

  it("does not overwrite one already held", () => {
    // The first link somebody follows is who brought them. A second link later
    // is somebody else trying to take the credit.
    const { store } = browser(`https://cardsofcronos.test/?${PENDING_REF}=FIRST111`);
    noticeRefInUrl();
    browser(`https://cardsofcronos.test/?${PENDING_REF}=SECOND22`);
    // Same store contents as a real browser would have.
    window.localStorage.setItem("tcg.ref.v1", store.get("tcg.ref.v1")!);
    noticeRefInUrl();
    expect(peekPendingRef()).toBe("FIRST111");
  });

  it("does nothing when there is no code", () => {
    const { store, replaced } = browser("https://cardsofcronos.test/profile");
    noticeRefInUrl();
    expect(store.size).toBe(0);
    // And leaves the URL alone rather than rewriting every page it runs on.
    expect(replaced).toHaveLength(0);
  });

  it("is handed over once", () => {
    browser(`https://cardsofcronos.test/?${PENDING_REF}=ABCD1234`);
    noticeRefInUrl();
    // Peeking leaves it; taking spends it. The greeting reads it without using
    // it up, and the claim is what uses it.
    expect(peekPendingRef()).toBe("ABCD1234");
    expect(takePendingRef()).toBe("ABCD1234");
    expect(takePendingRef()).toBeNull();
  });
});
