"use client";

// The wallet, and then the cards.
//
// A thin thing: app/profile/cards/page.tsx is a server component and cannot ask
// who is signed in, because the session lives in localStorage. This is the one
// line of client that reads it and hands it on.

import { YourCards } from "@/components/YourCards";
import { useSession } from "@/lib/use-session";

export function YourCardsPage() {
  const { wallet, ready } = useSession();

  // `ready` is not the same question as `wallet !== null`. Before the effect
  // runs they look identical and mean opposite things, and a page that told
  // everybody to sign in for half a second would be telling most of them
  // something untrue.
  if (!ready) return <p className="text-[11px] leading-relaxed text-muted">Looking…</p>;

  return <YourCards wallet={wallet} />;
}
