"use client";

// Connect a wallet.
//
// Any wallet may sign in. What signing in buys you is your own cards and your
// own deck — a collection belongs to an address, not to a browser. One wallet
// buys more: the deployer can mint while the mint is shut, and this button says
// so when it is that wallet and stays quiet when it is not.
//
// It asks for a signature, not just an address. Every address is public the
// moment its wallet does anything on-chain, so an address alone proves nothing;
// lib/session.ts has the long version.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { keepProof, signOut } from "@/lib/session";
import { useSession } from "@/lib/use-session";
import { connectAndProve, disconnectWallet, reasonFor } from "@/lib/wallet";
import { QrConnect } from "@/components/QrConnect";

type Status = "idle" | "asking" | "failed";

/**
 * How long to wait before saying the wallet might not have surfaced.
 *
 * eth_requestAccounts returns a promise a wallet is free to leave pending
 * forever, and extensions do exactly that when they cannot raise their own
 * window: the request goes and sits behind the toolbar icon instead. Nothing rejects, nothing times
 * out, and from where the person is standing the button simply stopped. Eight
 * seconds is long enough that nobody who is reading a signing prompt gets nagged
 * and short enough that nobody concludes the site is broken.
 */
const SURFACING = 8_000;

/**
 * The panel is portalled to the body, and this is not decoration.
 *
 * globals.css lifts every direct child of <body> onto its own layer so the page
 * sits above the grid lines. That gives <header> and <main> the same z-index,
 * and <main> comes second, so the whole page paints over the nav — which is also
 * why the header's `sticky` and `z-50` do nothing. A dropdown that lives inside
 * the header therefore lands underneath the cards, and the clicks land there
 * too: not merely hard to read, unusable.
 *
 * Escaping to the body is the only way out from inside that rule. The panel then
 * has to be placed by hand, since it no longer has the button as a parent.
 */
const PANEL_Z = 100;

export function WalletButton() {
  const { wallet, admin } = useSession();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  /** Whether the QR panel is open. Nothing of WalletConnect loads until it is. */
  const [qr, setQr] = useState(false);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Placed from the button, and kept there. `true` on the scroll listener is the
  // capture phase: the page scrolls inside its own containers on some screens
  // and a listener on window alone never hears it.
  useEffect(() => {
    if (!open) return;

    const place = () => {
      const box = button.current?.getBoundingClientRect();
      if (box) setAt({ top: box.bottom + 8, right: window.innerWidth - box.right });
    };
    place();

    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) {
        setOpen(false);
        // Back to the two buttons. Leaving the QR panel open means reopening
        // the dropdown starts a pairing nobody asked for, which is a code on
        // screen that nobody is going to scan — and one more live pairing.
        setQr(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQr(false);
      }
    };

    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (status !== "asking") {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SURFACING);
    return () => clearTimeout(timer);
  }, [status]);

  async function connect() {
    setQr(false);
    setStatus("asking");
    setProblem(null);
    setSlow(false);
    try {
      const proof = await connectAndProve();
      if (keepProof(proof) === null) {
        // The signature did not check out against the address it names. Not
        // something a person does by accident, so it is short.
        setProblem("That signature does not match the wallet it came from.");
        setStatus("failed");
        return;
      }
      setStatus("idle");
      setOpen(false);
    } catch (error) {
      setProblem(reasonFor(error));
      setStatus("failed");
    }
  }

  return (
    <div className="relative ml-1">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          admin
            ? "border border-gold px-3 py-1.5 text-[10px] tracking-[0.16em] text-gold transition-colors hover:bg-gold hover:text-ground"
            : wallet !== null
              ? "border border-pump px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground"
              : "border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.16em] text-muted transition-colors hover:border-pump hover:text-pump"
        }
      >
        {admin ? "ADMIN" : wallet !== null ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "WALLET"}
      </button>

      {open &&
        at !== null &&
        createPortal(
          <div
            ref={panel}
            style={{ position: "fixed", top: at.top, right: at.right, zIndex: PANEL_Z }}
            className="panel w-72 border border-line p-4"
          >
          {wallet !== null ? (
            <>
              <p
                className={
                  admin
                    ? "text-[10px] tracking-[0.16em] text-gold"
                    : "text-[10px] tracking-[0.16em] text-pump"
                }
              >
                {admin ? "SIGNED IN AS ADMIN" : "SIGNED IN"}
              </p>
              <p className="mt-2 font-mono text-[10px] break-all text-muted">{wallet}</p>
              <p className="mt-3 text-[10px] leading-relaxed text-muted">
                {admin
                  ? "The mint is open for you and shut for everyone else. Your cards and your deck belong to this wallet."
                  : "Your cards and your deck belong to this wallet, on any machine you sign in from."}{" "}
                It lapses after twelve hours and asks for a signature again.
              </p>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  // And hang up the pairing, if the wallet is a phone. Leaving
                  // it open would mean the next sign-in silently reused a
                  // session the person thought they had ended.
                  void disconnectWallet();
                  setOpen(false);
                }}
                className="mt-4 w-full border border-line-strong px-3 py-2 text-[10px] tracking-[0.16em] text-muted transition-colors hover:border-dump hover:text-dump"
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] leading-relaxed text-muted">
                Sign in to hold cards and build a deck. A collection belongs to a wallet rather
                than to a browser, so it follows you to any machine — and clearing this one loses
                nothing.
              </p>
              <button
                type="button"
                onClick={connect}
                disabled={status === "asking"}
                className="glow-pump mt-4 w-full border border-pump bg-pump/10 px-3 py-2 text-[10px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none"
              >
                {status === "asking" ? "CHECK YOUR WALLET…" : "CONNECT AND SIGN"}
              </button>

              {/* The second way in, for a wallet that lives on a phone.
                  Deliberately the quieter of the two: most people here have an
                  extension, and the loud button should be the one most people
                  want. It loads nothing until it is pressed — the whole
                  WalletConnect SDK is behind that click. */}
              {qr ? (
                <QrConnect
                  onDone={() => {
                    setQr(false);
                    setOpen(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setProblem(null);
                    setQr(true);
                  }}
                  className="mt-2 w-full border border-line-strong px-3 py-2 text-[10px] tracking-[0.16em] text-muted transition-colors hover:border-pump hover:text-pump"
                >
                  USE A PHONE WALLET (QR)
                </button>
              )}
              {slow ? (
                // Not an error: the request is still open and approving it still
                // works. It is a place to look, which is the one thing a pending
                // promise cannot tell anybody by itself.
                <div className="mt-3 border border-line-strong px-3 py-2">
                  <p className="text-[10px] leading-relaxed text-muted">
                    The wallet has not come forward. The request is still waiting — open the
                    extension from the toolbar and it should be sitting there. A locked wallet asks
                    for the password first.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-2 text-[10px] tracking-[0.16em] text-faint transition-colors hover:text-fg"
                  >
                    START OVER
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[9px] leading-relaxed text-faint">
                  You will be asked to sign a line of text. It is not a transaction: it moves
                  nothing and approves nothing.
                </p>
              )}
              {problem && (
                <p className="mt-3 text-[10px] leading-relaxed text-dump">{problem}</p>
              )}
            </>
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}
