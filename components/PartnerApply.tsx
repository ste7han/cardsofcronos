"use client";

// The application form on /partners.
//
// What it sends is read by lib/partners.ts, and the limits on the boxes are that
// file's — so a box cannot accept more than the server will take, and the
// message for a field the server refused lands beside that field.

import { useState } from "react";

import { LIMITS, TRAP, type Field } from "@/lib/partners";
import { cx } from "@/lib/cx";

type Sent =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; reference: string }
  | { state: "refused"; field: Field | null; error: string };

const BOXES: { field: Field; label: string; hint: string; required?: boolean; long?: boolean }[] = [
  { field: "project", label: "PROJECT", hint: "Its name, as people know it", required: true },
  { field: "website", label: "WEBSITE", hint: "yourproject.com", required: true },
  { field: "token", label: "TOKEN ON CRONOS", hint: "0x… — leave empty if there is none yet" },
  { field: "x", label: "X", hint: "@yourproject" },
  { field: "telegram", label: "TELEGRAM", hint: "t.me/yourproject" },
  { field: "contact", label: "HOW WE REACH YOU", hint: "Your Telegram handle, or an email", required: true },
  {
    field: "about",
    label: "ABOUT THE PROJECT",
    hint: "What it is, who is behind it, and what you would want on its cards",
    required: true,
    long: true,
  },
];

export function PartnerApply() {
  const [sent, setSent] = useState<Sent>({ state: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setSent({ state: "sending" });
    try {
      const answer = await fetch("/api/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const found = (await answer.json()) as { reference?: string; error?: string; field?: Field | null };
      if (answer.ok && found.reference) setSent({ state: "done", reference: found.reference });
      else setSent({ state: "refused", field: found.field ?? null, error: found.error ?? "That did not go through." });
    } catch {
      setSent({ state: "refused", field: null, error: "Could not reach the server. Try again in a moment." });
    }
  }

  if (sent.state === "done") {
    return (
      <div className="panel border border-pump/50 p-6">
        <p className="text-[10px] tracking-[0.24em] text-pump">RECEIVED</p>
        <p className="display mt-2 text-xl">We have it.</p>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          We read every application ourselves and come back to you on the contact you gave. Your
          reference is <span className="text-gold tabular-nums">{sent.reference}</span> — quote it
          if you get in touch before we do.
        </p>
      </div>
    );
  }

  const refusedHere = (field: Field) => sent.state === "refused" && sent.field === field;

  return (
    <form onSubmit={submit} className="panel grid gap-4 border border-line p-6 sm:grid-cols-2" noValidate>
      {BOXES.map((box) => (
        <label key={box.field} className={cx("block", box.long && "sm:col-span-2")}>
          <span className="text-[9px] tracking-[0.22em] text-faint">
            {box.label}
            {box.required && <span className="text-gold"> *</span>}
          </span>
          {box.long ? (
            <textarea
              name={box.field}
              rows={6}
              maxLength={LIMITS[box.field]}
              placeholder={box.hint}
              className={cx(
                "mt-1.5 block w-full resize-y border bg-ground px-3 py-2 text-[12px] leading-relaxed text-fg placeholder:text-faint focus:border-primary focus:outline-none",
                refusedHere(box.field) ? "border-dump" : "border-line-strong",
              )}
            />
          ) : (
            <input
              name={box.field}
              maxLength={LIMITS[box.field]}
              placeholder={box.hint}
              autoComplete="off"
              className={cx(
                "mt-1.5 block w-full border bg-ground px-3 py-2 text-[12px] text-fg placeholder:text-faint focus:border-primary focus:outline-none",
                refusedHere(box.field) ? "border-dump" : "border-line-strong",
              )}
            />
          )}
          {sent.state === "refused" && sent.field === box.field && (
            <span className="mt-1 block text-[10px] text-dump">{sent.error}</span>
          )}
        </label>
      ))}

      {/* Off the screen rather than display:none, which the better bots skip.
          See TRAP in lib/partners.ts. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input name={TRAP} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-relaxed text-faint">
          Applying commits you to nothing. It starts a conversation.
        </p>
        <button
          type="submit"
          disabled={sent.state === "sending"}
          className="border border-gold bg-gold px-6 py-2.5 text-[11px] tracking-[0.2em] text-ground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {sent.state === "sending" ? "SENDING…" : "APPLY"}
        </button>
      </div>
      {sent.state === "refused" && sent.field === null && (
        <p className="text-[11px] text-dump sm:col-span-2">{sent.error}</p>
      )}
    </form>
  );
}
