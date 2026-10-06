"use client";

// Connecting a phone wallet to a desktop, by showing it something to scan.
//
// A player asked for this and the reason is plain: an injected provider is the
// browser it is installed in, so somebody whose wallet lives on their phone had
// no way in at all on a laptop.
//
// ── THE QR IS DRAWN HERE ─────────────────────────────────────────────────────
//
// A WalletConnect URI carries the symmetric key for the pairing. Sending it to
// an image service to be turned into a picture would be handing that service
// the session, so it is drawn in this browser from a local library. This is the
// one place in the project where "one fewer dependency" is the wrong trade.
//
// ── AND IT IS OUR QR, NOT THEIRS ─────────────────────────────────────────────
//
// WalletConnect ships a modal. It is skipped (`showQrModal: false` in
// lib/wallet.ts) because CLAUDE.md is explicit that the palette and the
// typeface are this game's, and a modal in somebody else's house style in the
// middle of signing in is exactly what that rule is about. The cost is this
// file; the saving is that nothing between the player and their signature is
// drawn by code we do not control.
//
// The dark squares are drawn in the foreground colour rather than pure black,
// and the light ones in the panel colour, which keeps the contrast a scanner
// needs while sitting in the page instead of on it.

import { useCallback, useEffect, useRef, useState } from "react";

import { connectByQrAndProve, reasonFor } from "@/lib/wallet";
import { keepProof } from "@/lib/session";

/** Big enough to scan across a desk, small enough for a dropdown. */
const SIDE = 208;

type State =
  | { at: "starting" }
  | { at: "waiting"; uri: string }
  | { at: "signing" }
  | { at: "failed"; why: string };

export function QrConnect({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<State>({ at: "starting" });
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  // So a component that unmounts mid-pairing does not set state afterwards,
  // and so the effect cannot run its pairing twice in development.
  const running = useRef(false);

  const begin = useCallback(async () => {
    setState({ at: "starting" });
    try {
      const proof = await connectByQrAndProve((uri) => setState({ at: "waiting", uri }));
      setState({ at: "signing" });
      if (keepProof(proof) === null) {
        setState({ at: "failed", why: "That signature does not match the wallet it came from." });
        return;
      }
      onDone();
    } catch (error) {
      setState({ at: "failed", why: reasonFor(error) });
    }
  }, [onDone]);

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    void begin();
  }, [begin]);

  // Drawn after the canvas is in the document, and redrawn if the URI changes —
  // which it does when a pairing expires and a new one is offered.
  useEffect(() => {
    if (state.at !== "waiting") return;
    const target = canvas.current;
    if (target === null) return;

    let cancelled = false;
    void (async () => {
      const { toCanvas } = await import("qrcode");
      if (cancelled) return;
      try {
        await toCanvas(target, state.uri, {
          width: SIDE,
          margin: 1,
          // Medium: enough redundancy for a phone camera at an angle without
          // making the squares so small that the camera gives up.
          errorCorrectionLevel: "M",
          color: { dark: "#e8e4f0ff", light: "#0b0620ff" },
        });
      } catch {
        // A canvas that cannot be drawn leaves the copyable URI below it, which
        // is the whole reason that is there.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state.at === "failed") {
    return (
      <div className="px-3 py-3">
        <p className="text-[10px] leading-relaxed text-dump">{state.why}</p>
        <button
          type="button"
          onClick={() => void begin()}
          className="mt-3 w-full border border-line-strong px-3 py-2 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-pump hover:text-pump"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <p className="text-[10px] leading-relaxed text-muted">
        {state.at === "signing"
          ? "Connected. Approve the signature on your phone."
          : "Scan this with your phone wallet, then approve the signature there."}
      </p>

      <div
        className="mt-3 flex items-center justify-center border border-line-strong bg-ground"
        style={{ minHeight: SIDE + 16 }}
      >
        {state.at === "waiting" ? (
          <canvas ref={canvas} width={SIDE} height={SIDE} className="block" />
        ) : (
          <span className="text-[10px] tracking-[0.18em] text-faint">
            {state.at === "signing" ? "ON YOUR PHONE…" : "OPENING…"}
          </span>
        )}
      </div>

      {/* The URI, for a phone that cannot scan — a cracked camera, a wallet
          without a scanner, somebody on the same phone as the browser. It is
          never shown unless somebody asks: it is the pairing key, and a key
          sitting on screen in a room with other people is a key they have. */}
      {state.at === "waiting" && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(state.uri).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              },
              () => setCopied(false),
            );
          }}
          className="mt-2 w-full text-center text-[9px] tracking-[0.16em] text-faint transition-colors hover:text-muted"
        >
          {copied ? "COPIED — PASTE IT IN YOUR WALLET" : "CANNOT SCAN? COPY THE LINK"}
        </button>
      )}
    </div>
  );
}
