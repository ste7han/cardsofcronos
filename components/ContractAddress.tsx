"use client";

import { useState } from "react";

import { TCG_MINT } from "@/lib/launch";

/**
 * The TCG contract address, once it exists. Comes from lib/launch.ts, which is
 * also what the copycat banner reads — the two must never disagree about whether
 * a token exists, and one of them saying "not launched" while the other shows an
 * address is exactly what a scam wants the site to look like.
 *
 * While that is empty it says exactly that: not launched yet. A fake address, or a
 * grey box implying something is there, costs trust you don't get twice in this
 * corner of the market.
 */
export function ContractAddress() {
  const address = TCG_MINT;
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <div className="inline-flex items-center gap-2 border border-line bg-panel px-3 py-2 text-[10px] tracking-[0.14em] text-muted">
        <span className="h-1.5 w-1.5 animate-pulse bg-dump" />
        CA — NOT LAUNCHED YET
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-3 border border-line bg-panel px-3 py-2 text-[10px] tracking-[0.1em] text-muted transition-colors hover:border-pump hover:text-fg"
    >
      <span className="max-w-[15rem] truncate">{address}</span>
      <span className={copied ? "text-pump" : ""}>{copied ? "COPIED" : "COPY"}</span>
    </button>
  );
}
