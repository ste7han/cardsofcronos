"use client";

// Telegram's own login button.
//
// Their script, not a button of ours. The widget renders an iframe on
// telegram.org, and that is not a detail we could route around: it is what lets
// Telegram see a session we never touch, and it means this site never handles a
// Telegram credential of any kind. What comes back is a set of fields signed
// with the bot token, checked in the Worker.
//
// The cookie has to be waiting before the button is pressed. Telegram's redirect
// carries its own fields and nothing of ours, so there is no way to say which
// wallet is linking except to have said it beforehand — which is what /start
// does, and why this component sets that up on mount rather than on click.

import { useEffect, useRef, useState } from "react";

import { TELEGRAM_BOT } from "@/lib/links";
import { proofOf } from "@/lib/session";

export function TelegramLink() {
  const slot = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const proof = proofOf();
      if (proof === null) {
        setProblem("Sign in with a wallet first.");
        return;
      }
      try {
        const response = await fetch("/api/link/telegram/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proof }),
        });
        if (!response.ok) throw new Error(await response.text());
      } catch {
        setProblem("Could not reach the server. Try again in a moment.");
        return;
      }
      if (!cancelled) setReady(true);
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = slot.current;
    // No bot registered, no widget. TELEGRAM_BOT is null until somebody makes
    // one with BotFather; rendering the widget without a name gets a button that
    // fails on click rather than one that is honestly absent.
    if (!ready || !host || TELEGRAM_BOT === null) return;

    // React runs effects twice in development. Without this the button appears
    // twice, which looks like a bug and is one.
    host.replaceChildren();

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT);
    // Pinned, or Telegram localises the button to whoever is looking: the maker
    // in the Netherlands got "Inloggen met Telegram" in the middle of a page
    // that is English everywhere else, and a German visitor would get German.
    // The widget is Telegram's iframe, so this is the only say we have over it.
    script.setAttribute("data-lang", "en");
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-radius", "0");
    // A full page redirect to our own callback, rather than a JavaScript
    // callback: the fields have to reach the Worker to be checked, and anything
    // that only ever exists in the browser has been checked by nobody.
    script.setAttribute("data-auth-url", `${window.location.origin}/api/link/telegram/callback`);
    // Permission for the bot to message you. It is what makes "it is your turn"
    // possible later, and Telegram asks for it on its own screen.
    script.setAttribute("data-request-access", "write");
    host.appendChild(script);

    return () => host.replaceChildren();
  }, [ready]);

  if (problem) return <p className="mt-4 text-[10px] leading-relaxed text-dump">{problem}</p>;

  return (
    <div className="mt-4">
      <div ref={slot} className="flex justify-center" />
      {!ready && (
        <p className="text-center text-[10px] tracking-[0.18em] text-faint">LOADING…</p>
      )}
    </div>
  );
}
