// Connecting a phone wallet by QR.
//
// A player asked for it, and it reverses half of a decision lib/wallet.ts
// documents: no wallet library, because a modal and a provider tree for one
// signature is too much. The half that stands is the rest — no AppKit, no chain
// adapter, and nothing of it downloaded until somebody presses the button.
//
// Almost everything here is a source guard, because the behaviour needs a
// wallet on a phone and a relay in the middle. What source guards CAN hold are
// the four things that would each be invisible if they broke: the SDK staying
// out of the first load, the QR staying out of a third party's hands, the two
// connect buttons meaning two different wallets, and a remembered phone session
// never quietly becoming the browser extension instead.

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WALLETCONNECT_PROJECT, forgetHow, howConnected } from "@/lib/wallet";

const wallet = readFileSync(new URL("../lib/wallet.ts", import.meta.url), "utf8");
const qr = readFileSync(new URL("../components/QrConnect.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("../components/WalletButton.tsx", import.meta.url), "utf8");

/** Just enough localStorage to answer howConnected. */
function fakeStorage(start: Record<string, string> = {}) {
  const kept = { ...start };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => kept[k] ?? null,
      setItem: (k: string, v: string) => void (kept[k] = v),
      removeItem: (k: string) => void delete kept[k],
    },
  });
  return kept;
}

afterEach(() => vi.unstubAllGlobals());

describe("none of it loads until it is wanted", () => {
  it("imports the SDK dynamically and never at the top of the file", () => {
    // The whole bundle argument. A static import would put four hundred
    // kilobytes in front of every visitor, including the ones with MetaMask who
    // will never press this.
    expect(wallet).toContain('await import("@walletconnect/ethereum-provider")');
    expect(wallet).not.toMatch(/^import .*@walletconnect/m);
  });

  it("imports the QR drawer dynamically too", () => {
    expect(qr).toContain('await import("qrcode")');
    expect(qr).not.toMatch(/^import .*"qrcode"/m);
  });

  it("does not mount the QR panel until the button is pressed", () => {
    // Rendered behind a flag rather than hidden with CSS: a mounted component
    // runs its effects, and its effect is what opens a pairing.
    expect(button).toContain("{qr ? (");
    expect(button).toContain("setQr(true)");
  });
});

describe("the QR belongs to this site", () => {
  it("skips WalletConnect's own modal", () => {
    // CLAUDE.md is explicit that the palette and the typeface are this game's.
    // A modal in somebody else's house style in the middle of signing in is
    // what that rule is about.
    expect(wallet).toContain("showQrModal: false");
  });

  it("draws the code in this browser and sends the URI nowhere", () => {
    // A WalletConnect URI carries the symmetric key for the pairing. An image
    // service asked to draw it would be handed the session.
    expect(qr).toContain("toCanvas(target, state.uri");
    expect(qr).not.toMatch(/https?:\/\/[^"'\s]*(qr|chart|api)[^"'\s]*\$\{/);
    expect(qr).not.toContain("api.qrserver.com");
    expect(qr).not.toContain("chart.googleapis.com");
  });

  it("offers Cronos and nothing else", () => {
    // A wallet that connects on a chain this game cannot use is a wallet that
    // connects and then fails at the first transaction.
    expect(wallet).toContain("chains: [25]");
  });
});

describe("which wallet a later call goes to", () => {
  it("remembers the choice, because the proof names one address", () => {
    // Somebody who paired a phone may also have MetaMask. The signed proof
    // names ONE address, and sending a transaction through the other wallet
    // would either fail or send from an account they did not mean to use.
    expect(wallet).toContain("export async function active()");
    expect(wallet).toContain('if (howConnected() === "walletconnect")');
  });

  it("does not fall back to the extension when the pairing is gone", () => {
    // The dangerous version of this function returns the injected wallet when
    // the session cannot be restored. That is a different address.
    const body = wallet.slice(wallet.indexOf("export async function active()"));
    const inner = body.slice(0, body.indexOf("\n}"));
    const fallback = inner.indexOf("return provider();");
    const branch = inner.indexOf('howConnected() === "walletconnect"');
    // The only `return provider()` is after the branch has already returned.
    expect(branch).toBeLessThan(fallback);
    expect(inner).toContain("return null;");
  });

  it("asks the extension directly when that is the button pressed", () => {
    // Honouring the remembered choice here would make the browser-wallet
    // button quietly reconnect the phone.
    const connect = wallet.slice(wallet.indexOf("export async function connectAndProve()"));
    expect(connect.slice(0, connect.indexOf("\n}"))).toContain("const wallet = provider();");
  });

  it("only remembers a choice that worked", () => {
    // A remembered failure would send every later call at a wallet nobody is
    // signed in to.
    for (const how of ['remember("injected")', 'remember("walletconnect")']) {
      const at = wallet.indexOf(how);
      expect(at, how).toBeGreaterThan(-1);
      // After the proof exists, not before it is asked for.
      expect(wallet.lastIndexOf("proveWith", at)).toBeLessThan(at);
    }
  });

  it("hangs up the pairing when somebody signs out", () => {
    // Leaving it open means the next sign-in silently reuses a session the
    // person thought they had ended.
    expect(button).toContain("void disconnectWallet();");
    expect(wallet).toContain("export async function disconnectWallet()");
  });
});

describe("the project it pairs under", () => {
  it("is in the source, where a missing value cannot be silent", () => {
    // NEXT_PUBLIC_ variables are inlined at build time, so a build without one
    // produces a site where the QR never appears and nothing says why. It is
    // public either way: it ships in the bundle.
    expect(WALLETCONNECT_PROJECT).toMatch(/^[0-9a-f]{32}$/);
    expect(wallet).not.toContain("NEXT_PUBLIC_WALLETCONNECT");
  });
});

describe("what the browser remembers", () => {
  it("reads back a choice it was given", () => {
    fakeStorage({ "coc.wallet.how": "walletconnect" });
    expect(howConnected()).toBe("walletconnect");
  });

  it("treats anything it does not recognise as nothing", () => {
    // A hand-edited value, or a key from an older version of this.
    fakeStorage({ "coc.wallet.how": "rainbow" });
    expect(howConnected()).toBeNull();
  });

  it("is null when nothing was ever chosen", () => {
    fakeStorage();
    expect(howConnected()).toBeNull();
  });

  it("can be forgotten", () => {
    const kept = fakeStorage({ "coc.wallet.how": "injected" });
    forgetHow();
    expect(kept["coc.wallet.how"]).toBeUndefined();
  });
});
