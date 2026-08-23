"use client";

// The five things to do, what they have earned, and what that buys.
//
// Read top to bottom: what you can do now, what it is worth, and what it costs
// to claim. The catalogue is published even though nothing in it can be handed
// over yet, because somebody deciding whether to bring three hundred people in
// is entitled to know what they are working towards — and a claim button that
// took the points and delivered nothing would be far worse than one that is
// honestly switched off.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  PERFECT_SCORE,
  REWARDS,
  TASK_BY_ID,
  blockedBy,
  nextTask,
  peopleFor,
  type Task,
} from "@/lib/points";
import { proofOf } from "@/lib/session";
import { TELEGRAM_CHANNEL, X_ACCOUNT } from "@/lib/links";
import { cx } from "@/lib/cx";

interface TaskView {
  id: Task;
  needs?: Task;
  title: string;
  what: string;
  how: string;
  proof: "verified" | "declared";
  live: boolean;
  done: boolean;
  voided: boolean;
}

interface Answer {
  ledger: { balance: number; earned: number; spent: number };
  linked: { x: boolean; telegram: boolean };
  tasks: TaskView[];
  referrals: { wallet: string }[];
  perfect: number;
}

async function ask<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const proof = proofOf();
  if (proof === null) throw new Error("Sign in with a wallet first.");
  const response = await fetch(`/api/tasks/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });
  const answer = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(answer?.error ?? `The server said no (${response.status}).`);
  return answer as T;
}

/** Where a task is actually done, when it is not done by a button here. */
const ELSEWHERE: Partial<Record<Task, { href: string; label: string }>> = {
  demo: { href: "/play", label: "PLAY ONE" },
};

export function Points({ wallet }: { wallet: string | null }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState<Task | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (wallet === null) return;
    try {
      setAnswer(await ask<Answer>("list"));
    } catch {
      setAnswer(null);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  if (wallet === null || answer === null) return null;

  const finished = new Set(answer.tasks.filter((task) => task.done).map((task) => task.id));
  const done = finished.size;
  // Which one to point at. Not a lock — the others stay pressable — but it turns
  // a list of five into a step at a time, which is the whole ask.
  const next = nextTask(finished);

  async function press(task: TaskView) {
    setBusy(task.id);
    setProblem(null);
    try {
      await ask("do", { task: task.id });
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="display text-xl">POINTS</h2>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
        {PERFECT_SCORE} things to do, one point each. Then a point for every one of those{" "}
        {PERFECT_SCORE} that somebody you brought in does — so a referral is worth up to{" "}
        {PERFECT_SCORE}, and somebody who does three of five earns you three.{" "}
        <span className="text-fg">Points are spent, not scored.</span>{" "}
        {next !== null && "Work down the list; only the group check needs another step first."}
      </p>

      <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
        <div className="bg-panel px-4 py-4">
          <dt className="text-[8px] tracking-[0.18em] text-faint">TO SPEND</dt>
          <dd className="display mt-1.5 text-2xl tabular-nums text-gold">{answer.ledger.balance}</dd>
        </div>
        <div className="bg-panel px-4 py-4">
          <dt className="text-[8px] tracking-[0.18em] text-faint">YOUR FIVE</dt>
          <dd className="display mt-1.5 text-2xl tabular-nums">
            {done}
            <span className="text-faint"> / {answer.perfect}</span>
          </dd>
        </div>
        <div className="bg-panel px-4 py-4">
          <dt className="text-[8px] tracking-[0.18em] text-faint">EARNED · SPENT</dt>
          <dd className="display mt-1.5 text-2xl tabular-nums">
            {answer.ledger.earned}
            <span className="text-faint"> · {answer.ledger.spent}</span>
          </dd>
        </div>
      </dl>

      <ol className="mt-5 divide-y divide-line border border-line">
        {answer.tasks.map((task, i) => {
          const waiting = blockedBy(TASK_BY_ID.get(task.id)!, finished);
          const blocked = waiting ? `Do "${waiting.title}" first — otherwise there is nobody to ask Telegram about.` : null;
          const somewhere = ELSEWHERE[task.id];
          const isNext = task.id === next;

          return (
            <li
              key={task.id}
              className={cx(
                "flex flex-wrap items-start gap-3 px-4 py-3 transition-colors",
                isNext && "bg-pump/5",
                // Dimmed, not disabled. Somebody who wants to play the demo
                // first is welcome to; they just are not being pointed at it.
                !isNext && !task.done && "opacity-60",
              )}
            >
              <span
                className={cx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[9px]",
                  task.done ? "border-pump bg-pump/10 text-pump" : "border-line-strong text-faint",
                )}
              >
                {task.done ? "✓" : i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-fg">
                  {task.title}
                  {isNext && (
                    <span className="ml-2 border border-pump px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-pump">
                      NEXT
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                  {task.what}
                </span>
                {/* How we know, on the task rather than in a footnote. A player
                    who can see that something is checked by hand behaves
                    differently from one who assumes nothing is. */}
                <span className="mt-1 block text-[9px] leading-relaxed text-faint">{task.how}</span>
                {blocked && (
                  <span className="mt-1 block text-[9px] leading-relaxed text-gold">{blocked}</span>
                )}
                {task.voided && (
                  <span className="mt-1 block text-[9px] leading-relaxed text-dump">
                    This one was taken back, and the point with it.
                  </span>
                )}
              </span>

              <span className="shrink-0">
                {task.done ? (
                  <span className="text-[9px] tracking-[0.16em] text-pump">DONE</span>
                ) : task.id === "join_telegram" || task.id === "follow_x" ? (
                  <span className="flex flex-col items-end gap-1">
                    {/* No account, no link. Both are null until they are
                        registered — see lib/links.ts — and "OPEN ↗" going
                        nowhere is worse than not offering it. */}
                    {(task.id === "follow_x" ? X_ACCOUNT : TELEGRAM_CHANNEL) !== null && (
                      <a
                        href={(task.id === "follow_x" ? X_ACCOUNT : TELEGRAM_CHANNEL)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] tracking-[0.16em] text-muted transition-colors hover:text-fg"
                      >
                        OPEN ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void press(task)}
                      disabled={busy !== null || blocked !== null}
                      className="border border-pump px-3 py-1.5 text-[9px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:text-muted"
                    >
                      {busy === task.id ? "…" : "DONE IT"}
                    </button>
                  </span>
                ) : somewhere ? (
                  <Link
                    href={somewhere.href}
                    className="border border-pump px-3 py-1.5 text-[9px] tracking-[0.16em] text-pump transition-colors hover:bg-pump hover:text-ground"
                  >
                    {somewhere.label}
                  </Link>
                ) : (
                  <span className="text-[9px] tracking-[0.16em] text-faint">ABOVE ↑</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {problem && <p className="mt-3 text-[10px] leading-relaxed text-dump">{problem}</p>}

      <h3 className="display mt-8 text-lg">WHAT POINTS BUY</h3>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
        Spending takes them off your balance, so a big number is a choice rather than a score. At
        1500 you are picking between both token lots and ten starter packs — and 1500 is{" "}
        {peopleFor(1500)} people plus your own five.
      </p>

      <dl className="mt-4 divide-y divide-line border border-line">
        {REWARDS.map((reward) => {
          const affordable = answer.ledger.balance >= reward.cost;
          return (
            <div key={reward.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3">
              <dt
                className={cx(
                  "display w-14 shrink-0 text-lg tabular-nums",
                  affordable ? "text-gold" : "text-faint",
                )}
              >
                {reward.cost}
              </dt>
              <dd className="min-w-0 flex-1">
                <span className="block text-[11px] text-fg">{reward.name}</span>
                <span className="block text-[10px] text-muted">{reward.what}</span>
              </dd>
              <span className="shrink-0 text-[9px] tracking-[0.16em] text-faint">
                {peopleFor(reward.cost)} PEOPLE
              </span>
            </div>
          );
        })}
      </dl>

      <p className="mt-4 max-w-2xl text-[10px] leading-relaxed text-gold">
        Nothing here can be claimed yet, and that is the honest state rather than a queue: there is
        no token, and a single-card mint is a product that does not exist. Points earned now are
        kept and will still be yours when there is something to spend them on.
      </p>

      <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-faint">
        Anything that looks botted is removed, along with the points it earned — on both sides of
        the referral.
      </p>
    </section>
  );
}
