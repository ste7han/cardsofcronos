"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { WalletButton } from "@/components/WalletButton";
import { cx } from "@/lib/cx";

const LINKS = [
  { href: "/play", label: "PLAY" },
  { href: "/pvp", label: "PVP" },
  { href: "/deck", label: "DECK" },
  { href: "/cards", label: "CARDS" },
  { href: "/mint", label: "MINT" },
  { href: "/tournament", label: "WEEKLY" },
  { href: "/burn", label: "BURN" },
  { href: "/profile", label: "PROFILE" },
];

export function Nav() {
  const pathname = usePathname();
  // The card render route is a picture, not a page. Anything around the card
  // would be captured with it.
  if (pathname?.startsWith("/card/")) return null;
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close it on the way to somewhere. Without this the menu is still open
  // underneath the page you just asked for, which reads as the tap not working.
  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ground/70 backdrop-blur-xl">
      {/* Thin gold line along the top: gives the bar an edge instead of letting it
          dissolve into the page. */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* mix-blend-mode: screen is the background removal. The render has a
              near-black ground rather than an alpha channel, and screening it
              over a near-black page leaves the ground at the page's own colour
              while the gold comes through unchanged. It is why the mark sits on
              the bar instead of sitting in a black box on it — and it is also
              why the site staying dark is now load-bearing. */}
          {/* The card back, in perspective, made by `npm run site-logo` from the
              CardBack component — so the mark is a card from this game rather
              than a picture of one, and it cannot drift from the backs on the
              table.

              It replaced /wolf.svg, which was Wolfswap's mark. Wolfswap is a
              faction in the set: the site was wearing one of its own cards as
              its logo, three lines above a footer promising no affiliation with
              any project it names. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Cards of Cronos"
            className="h-9 w-auto sm:h-11"
            width={1258}
            height={1762}
          />
          <span className="hidden text-[9px] tracking-[0.22em] text-faint transition-colors group-hover:text-muted lg:inline">
            CARDS OF CRONOS
          </span>
        </Link>

        {/* Six links, the wordmark and a wallet button come to about 540px at
            the narrowest they go, so below md they do not fit a phone — the bar
            overflowed and the wallet button sat off the right-hand edge, which
            is a sign-in button you have to scroll to find. Below md they move
            into a sheet; the wallet button never does, because it is the one
            control that has to be reachable from anywhere. */}
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "relative px-3 py-2 text-[10px] tracking-[0.18em] transition-colors",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-pump shadow-[0_0_10px_2px_rgba(0,224,138,0.5)]" />
                )}
              </Link>
            );
          })}
          </div>

          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
            aria-label={open ? "Close the menu" : "Open the menu"}
            className="border border-line-strong px-2.5 py-1.5 text-[13px] leading-none text-muted transition-colors hover:border-fg hover:text-fg md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>

          <WalletButton />
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-ground/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "border-b border-line py-3 text-[11px] tracking-[0.18em] last:border-0",
                  path === link.href ? "text-pump" : "text-muted",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
