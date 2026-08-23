"use client";

import { usePathname } from "next/navigation";

import { TELEGRAM_CHANNEL, X_ACCOUNT, X_HANDLE } from "@/lib/links";

/**
 * The site footer, on every page except the table.
 *
 * /play is a screen you play on rather than a page you read, and it is sized to
 * the viewport exactly. The footer added 98px plus its margin below that, which
 * made the whole page scrollable by a couple of hundred pixels — enough that the
 * log, which is fixed, drifted away from the header as soon as anybody scrolled,
 * and the middle of the table went wandering. A footer nobody scrolls to is not
 * worth that.
 *
 * The disclaimer it carries is not lost: /play states it on the stake panel,
 * beside the log, where it belongs anyway.
 */
export function Footer() {
  const pathname = usePathname();
  // /play is sized to the viewport exactly, and the card route is a picture
  // rather than a page — anything around the card gets captured with it.
  if (pathname === "/play" || pathname?.startsWith("/card/")) return null;

  return (
    <footer className="mt-8 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[10px] leading-relaxed text-faint sm:flex-row sm:items-center sm:justify-between">
        <p className="tracking-[0.16em]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Cards of Cronos"
            className="inline-block h-7 w-auto align-middle"
            width={1224}
            height={1604}
          />
          <span className="ml-2 align-middle">CARDS OF CRONOS</span>
        </p>
        <div className="flex flex-col gap-3 sm:items-end">
          {/* rel on an outbound link, always. noopener is the one that matters —
              without it the page it opens gets a handle on this one. */}
          <span className="flex items-center gap-5">
          {/* Hidden rather than dead. An account that does not exist yet is a gap
              somebody can see; a link to the wrong one is not. See lib/links.ts. */}
          {X_ACCOUNT !== null && (
          <a
            href={X_ACCOUNT}
            target="_blank"
            rel="noopener noreferrer"
            title={`@${X_HANDLE}`}
            className="inline-flex items-center gap-1.5 tracking-[0.16em] transition-colors hover:text-pump"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 shrink-0 fill-current">
              <path d="M18.9 2.3h3.4l-7.5 8.5L23.6 22h-6.9l-5.4-7-6.2 7H1.7l8-9.1L.9 2.3h7l4.9 6.4zm-1.2 17.6h1.9L7.1 4.3H5z" />
            </svg>
            X
          </a>
          )}
          {TELEGRAM_CHANNEL !== null && (
          <a
            href={TELEGRAM_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 tracking-[0.16em] transition-colors hover:text-pump"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 fill-current"
            >
              <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.6 13.1 1.9 11.6c-1-.3-1-1 .2-1.5l18.5-7.1c.9-.3 1.6.2 1.3 1.3z" />
            </svg>
            TELEGRAM
          </a>
          )}
          </span>
          <p className="max-w-md sm:text-right">
            Not financial advice. Cards reference existing projects and people; this game is not
            affiliated with any of them.
          </p>
        </div>
      </div>
    </footer>
  );
}
