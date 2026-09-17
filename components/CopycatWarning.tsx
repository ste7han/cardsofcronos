"use client";

// The banner that says there is no token yet.
//
// IT DRAWS NOTHING FOR THIS PROJECT AND THAT IS IT WORKING. $CROCARD launched
// with the first version, so lib/launch.ts answers yes and this returns null on
// the first line — the header below describes a component that removes itself,
// and it has. What is left is the empty-override case, and the copy has to stay
// true for that one or it is a trap for whoever sets it.
//
// It exists because of a specific, predictable thing: the moment a project has a
// Telegram group filling up and referral links going around, somebody launches a
// token with this site's address in its description. The people it
// works on are the ones who found the real project first — they have every
// reason to believe the link, and nothing on the site tells them otherwise.
//
// Three decisions worth stating.
//
// It cannot be dismissed. Somebody who waves it away on the day they arrive is
// exactly the person who gets caught three weeks later, and a warning that is
// only shown once is a warning aimed at the wrong moment.
//
// It disappears by itself the moment there is a mint address, and is not a thing
// anybody has to remember to remove. A site still shouting "we are not live"
// after launch is the thing that makes the real one look like the copy.
//
// It says what to check rather than only what to fear. "Be careful" is not
// actionable; "there is no contract address, and it will be on this page when
// there is" tells somebody precisely what a scam cannot produce.

import Link from "next/link";

import { LAUNCHED, OFFICIAL } from "@/lib/launch";

export function CopycatWarning() {
  if (LAUNCHED) return null;

  // And nothing at all until the accounts exist. The whole sentence below is
  // "here is where the real thing is announced" — pointing it at a Telegram
  // nobody has registered would be the copycat warning doing the copycat's job.
  const { telegram, x, xHandle } = OFFICIAL;
  if (telegram === null || x === null || xHandle === null) return null;

  return (
    <div
      role="alert"
      className="border-b border-dump/50 bg-dump/10 px-4 py-2.5 text-center text-[10px] leading-relaxed"
    >
      <p className="mx-auto max-w-4xl text-dump">
        <span className="font-bold tracking-[0.16em]">$CROCARD HAS NOT LAUNCHED.</span>{" "}
        <span className="text-muted">
          There is no contract address and no token. Anything using this name or this site is not
          us, on Cronos or anywhere else.{" "}
          <Link href="/burn" className="text-dump underline underline-offset-2 hover:text-fg">
            The only address that will ever be real
          </Link>{" "}
          appears on {OFFICIAL.site}, in{" "}
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dump underline underline-offset-2 hover:text-fg"
          >
            our Telegram
          </a>{" "}
          and from{" "}
          <a
            href={x}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dump underline underline-offset-2 hover:text-fg"
          >
            @{xHandle}
          </a>{" "}
          first. Nowhere else.
        </span>
      </p>
    </div>
  );
}
