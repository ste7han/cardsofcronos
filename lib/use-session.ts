"use client";

// Who is signed in, as a React answer.
//
// Starts empty and corrects itself after mount, the same way the collection
// does: the session lives in localStorage, and a server render that guesses at
// it is a hydration mismatch. Empty first is also the safe direction to be wrong
// in — a flash of "signed out" costs a repaint, a flash of somebody's cards
// would be showing a stranger's collection.
//
// `ready` is not the same question as `wallet !== null`. Before the effect runs
// they look identical and mean opposite things: "nobody is signed in" versus "we
// have not looked yet". Screens that lock people out have to tell those apart or
// they flash a locked door at everyone on every load.

import { useEffect, useState } from "react";

import { isAdmin } from "@/lib/admin";
import { SESSION_EVENT, signedIn } from "@/lib/session";

export interface Session {
  wallet: string | null;
  admin: boolean;
  ready: boolean;
}

export function useSession(): Session {
  const [wallet, setWallet] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => {
      setWallet(signedIn());
      setReady(true);
    };
    check();
    window.addEventListener(SESSION_EVENT, check);
    // Signing in on one tab should not leave another tab locked out.
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener(SESSION_EVENT, check);
      window.removeEventListener("storage", check);
    };
  }, []);

  return { wallet, admin: isAdmin(wallet), ready };
}
