"use client";

import { useEffect, useRef } from "react";

import type { LogEntry } from "@/engine/types";
import { cx } from "@/lib/cx";

const TONE_COLOUR = {
  pump: "text-pump",
  dump: "text-dump",
  neutral: "text-fg/70",
  system: "text-gold",
} as const;

export function Log({ entries }: { entries: readonly LogEntry[] }) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <section className="panel flex h-full min-h-0 flex-col border border-line">
      <h2 className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5 text-[9px] tracking-[0.2em] text-faint">
        LOG
        <span className="text-faint/60">{entries.length}</span>
      </h2>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <ol className="space-y-1">
          {entries.map((entry, i) => (
            <li
              key={i}
              className={cx(
                "flex gap-2 border-l-2 py-0.5 pl-2 text-[10px] leading-relaxed",
                entry.player === null
                  ? "border-gold/40"
                  : entry.player === "you"
                    ? "border-pump/40"
                    : "border-dump/30",
              )}
            >
              <span className="shrink-0 text-faint tabular-nums">
                t{String(entry.turn).padStart(2, "0")}
              </span>
              <span
                className={cx(
                  "w-7 shrink-0 tracking-[0.1em]",
                  entry.player === "you" ? "text-fg" : "text-faint",
                )}
              >
                {entry.player === null ? "—" : entry.player === "you" ? "YOU" : "BOT"}
              </span>
              <span className={TONE_COLOUR[entry.tone]}>{entry.text}</span>
            </li>
          ))}
        </ol>
        <div ref={bottom} />
      </div>
    </section>
  );
}
