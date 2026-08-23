"use client";

// What somebody sees when they arrive on a referral link.
//
// They arrive knowing one thing: a person they know sent them a link. The page
// they land on is a profile they are not signed into, which without this is a
// locked door with no sign on it — which is exactly the report that led here.
//
// So: who sent them, what this is, and the five things to do, before anything
// else. Shown as a panel and not only as a dialog, because a dialog dismissed is
// a dialog gone, and the answer to "what do I do now" has to still be there
// after the first click.

import { useEffect, useState } from "react";

import { TASK_LIST, PERFECT_SCORE } from "@/lib/points";
import { peekPendingRef } from "@/lib/ref";
import { cx } from "@/lib/cx";

export function RefWelcome({ signedIn }: { signedIn: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    const pending = peekPendingRef();
    if (!pending) return;
    setCode(pending);
    // The dialog once, on the visit the link brought them in on. After that the
    // panel below carries it, and nothing keeps interrupting somebody who is
    // already working through the list.
    setDialog(!window.sessionStorage.getItem("tcg.ref.greeted"));
    window.sessionStorage.setItem("tcg.ref.greeted", "1");
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [dialog]);

  if (code === null) return null;

  const steps = (
    <ol className="space-y-2">
      {TASK_LIST.map((task, i) => (
        <li key={task.id} className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong text-[9px] text-faint">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] text-fg">{task.title}</span>
            <span className="block text-[10px] leading-relaxed text-muted">{task.what}</span>
          </span>
        </li>
      ))}
    </ol>
  );

  const invited = (
    <>
      <p className="text-[10px] tracking-[0.28em] text-faint">YOU WERE INVITED</p>
      <h2 className="display mt-2 text-2xl">
        CODE <span className="text-gold">{code}</span>
      </h2>
      {/* You first. The sentence used to name only the sender, which reads as
          somebody asking you for a favour rather than as an offer — and the
          person arriving on the link is the one who has to decide whether to
          bother. */}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Cards of Cronos is a card game about Cronos — the projects, the tools and
        the tactics.
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        <span className="text-fg">
          {PERFECT_SCORE} things to do, and each one earns you a point.
        </span>{" "}
        Whoever sent you this earns one too, at no cost to you — and then you get a link of your
        own, and every one of the {PERFECT_SCORE} that somebody you bring in finishes earns you
        another. Points buy cards and token later on.
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-fg">
        {signedIn
          ? "Your code is saved. Work down the list below."
          : "Start by connecting a wallet — the button at the top right. Everything here belongs to an address, and your code is saved until you do."}
      </p>
    </>
  );

  return (
    <>
      {dialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ground/90 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setDialog(false)}
        >
          <div
            className="panel max-h-[90dvh] w-full max-w-md overflow-y-auto border border-gold/40 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {invited}
            <div className="mt-5 border-t border-line pt-4">{steps}</div>
            <button
              type="button"
              onClick={() => setDialog(false)}
              className="glow-pump mt-5 w-full border border-pump bg-pump/10 px-4 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      <section
        className={cx(
          "border border-gold/40 bg-gold/5 px-5 py-5",
          // Above the sign-in wall when there is one, since that wall is the
          // whole page for somebody who has just arrived.
          "mb-8",
        )}
      >
        {invited}
        <div className="mt-5 border-t border-gold/20 pt-4">{steps}</div>
      </section>
    </>
  );
}
