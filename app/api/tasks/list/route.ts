// The five tasks, as they stand for the wallet asking, plus the balance.
//
// One request rather than five, because the page draws the whole ladder at once
// and five round trips to draw one panel is five chances for it to be half
// right on a bad connection.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { ledgerOf, linksOf, referralsBy, tasksOf } from "@/lib/store";
import { PERFECT_SCORE, TASK_LIST } from "@/lib/points";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const [done, ledger, links, brought] = await Promise.all([
    tasksOf(db(), wallet),
    ledgerOf(db(), wallet),
    linksOf(db(), wallet),
    referralsBy(db(), wallet),
  ]);

  const byId = new Map(done.map((task) => [task.task, task]));

  return Response.json({
    ledger,
    // Which links exist, so the page can grey out "join the group" until there
    // is a Telegram account to ask about rather than letting somebody press it
    // and be told off.
    linked: { x: links.some((l) => l.network === "x"), telegram: links.some((l) => l.network === "telegram") },
    tasks: TASK_LIST.map((spec) => {
      const row = byId.get(spec.id);
      return {
        ...spec,
        done: row !== undefined && !row.voided,
        voided: row?.voided ?? false,
        doneAt: row?.doneAt ?? null,
      };
    }),
    referrals: brought.map((referral) => ({ wallet: referral.referee })),
    perfect: PERFECT_SCORE,
  });
}
