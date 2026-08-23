// Doing a task that is not done by doing something else.
//
// Three of the five record themselves: linking X, linking Telegram and finishing
// a demo all happen somewhere else and are recorded there, because the moment
// they are verified is the moment they happen. What is left is the two that a
// player has to come here and ask for.
//
//   join_telegram  checked, by asking Telegram whether they are in the group
//   follow_x       taken on their word, because X charges per follower read
//
// The difference between those two is recorded rather than smoothed over. A
// declared task and a verified one are not the same fact, and the day somebody
// asks how we know, the answer has to exist in the row.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { completeTask, linksOf } from "@/lib/store";
import { TASK_BY_ID, type Task } from "@/lib/points";
import { isInGroup } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

/** The only two a player asks for. The other three record themselves. */
const ASKABLE = new Set<Task>(["join_telegram", "follow_x"]);

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const task = (body as { task?: unknown } | null)?.task as Task | undefined;

  // Unknown fails here rather than recording a task nobody defined and paying a
  // point for it.
  if (!task || !TASK_BY_ID.has(task)) {
    return Response.json({ error: `No such task: ${String(task)}` }, { status: 400 });
  }
  if (!ASKABLE.has(task)) {
    return Response.json(
      { error: "That one records itself when you do it." },
      { status: 400 },
    );
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const now = Date.now();

  if (task === "follow_x") {
    // On their word. The page says so, and the maker keeps the right to take it
    // back along with the points it earned.
    await completeTask(db(), wallet, "follow_x", "declared", now);
    return Response.json({ ok: true, proof: "declared" });
  }

  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ error: "The Telegram bot is not configured here." }, { status: 503 });
  }

  // The same dependency the page draws, read from the same place. A second copy
  // of "needs Telegram first" would be a second thing to keep in step.
  const needs = TASK_BY_ID.get("join_telegram")?.needs;
  const telegram = (await linksOf(db(), wallet)).find((link) => link.network === "telegram");
  if (!telegram) {
    return Response.json(
      {
        error: `Do "${needs ? TASK_BY_ID.get(needs)!.title : "link your Telegram"}" first — otherwise there is nobody to ask Telegram about.`,
      },
      { status: 400 },
    );
  }

  const membership = await isInGroup(token, telegram.accountId);

  if (!membership.in && membership.because === "cannot-ask") {
    // Not the player's fault and not reported as though it were. Usually the bot
    // is not in the group.
    console.error("Telegram would not answer:", membership.detail);
    return Response.json(
      { error: `Telegram would not answer: ${membership.detail}` },
      { status: 502 },
    );
  }

  if (!membership.in) {
    return Response.json({ error: "Telegram says you are not in the group." }, { status: 400 });
  }

  await completeTask(db(), wallet, "join_telegram", "verified", now);
  return Response.json({ ok: true, proof: "verified" });
}
