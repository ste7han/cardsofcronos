// Every address this game touches, and what can be done with it.
//
// ── WHY THE POWERS ARE ON THE PAGE ───────────────────────────────────────────
//
// A contract list is usually a reassurance: here are our addresses, look how
// open we are. That is worth nothing by itself, because every contract here has
// a key attached and the only useful question is what that key can do.
//
// So each one says it. Including the rescue hatches, which are the most
// dangerous things on this page — an owner who can empty a contract after a
// two-day notice is a real power and a reader is entitled to know it exists
// before they decide anything. Leaving them off would make this page a nicer
// read and a worse one.
//
// The addresses come from lib/addresses.ts, which reads them from the same place
// the code does. A page that lists contracts by hand is a page that eventually
// lists the wrong ones.

import { KEYS, NOT_OURS, OURS, RENOUNCED, type Listed } from "@/lib/addresses";
import { EXPLORER } from "@/lib/units";

export function Contracts() {
  return (
    <div className="space-y-12">
      <section>
        <h2 className="display text-xl">OURS</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Deployed by this project, and every one of them has a key attached. What that key can do
          is under each address — including the parts nobody enjoys writing down, because a list
          that only mentions the comfortable powers is a list you should not trust.
        </p>
        <div className="mt-5 space-y-3">
          {OURS.map((one) => (
            <Entry key={one.id} one={one} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-xl">OURS, AND NOBODY&rsquo;S</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Launched by this project and out of everybody&rsquo;s hands, including ours. No owner to
          rotate, no function to pause it with, and no way to make more.
        </p>
        <div className="mt-5 space-y-3">
          {RENOUNCED.map((one) => (
            <Entry key={one.id} one={one} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-xl">NOT OURS</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Addresses the game reads, pays or buys through, and did not deploy. Here so that seeing
          one in a transaction is not a surprise.
        </p>
        <div className="mt-5 space-y-3">
          {NOT_OURS.map((one) => (
            <Entry key={one.id} one={one} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-xl">THE KEYS</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Two of them, kept apart on purpose. The one that can reach money is never on a server;
          the one on the server can barely do anything.
        </p>
        <div className="mt-5 space-y-3">
          {KEYS.map((one) => (
            <Entry key={one.id} one={one} />
          ))}
        </div>
      </section>

      <p className="max-w-2xl text-[10px] leading-relaxed text-gold">
        Nothing on this page has to be believed. Every address links to the explorer, where the
        code, the transactions and the balances are somebody else&rsquo;s copy of the same facts —
        which is the only reason a page like this is worth reading at all.
      </p>
    </div>
  );
}

function Entry({ one }: { one: Listed }) {
  return (
    <div className="panel border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="display text-lg">{one.name}</p>
        {one.address === null ? (
          // Said rather than left blank. A missing row reads as an oversight; a
          // row that says "not deployed" is a fact about where the project is.
          <span className="text-[9px] tracking-[0.18em] text-gold">NOT DEPLOYED YET</span>
        ) : (
          <a
            href={`${EXPLORER}/address/${one.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] break-all text-pump hover:underline"
          >
            {one.address}
          </a>
        )}
      </div>

      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">{one.what}</p>
      {one.theirs && (
        <p className="mt-1.5 max-w-2xl text-[10px] leading-relaxed text-faint">{one.theirs}</p>
      )}

      {one.powers.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {one.powers.map((power) => (
            <li key={power} className="flex gap-2 text-[10px] leading-relaxed text-muted">
              <span className="shrink-0 text-faint">—</span>
              <span>{power}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
