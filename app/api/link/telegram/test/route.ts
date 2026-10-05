// Does the bot actually reach you?
//
// ── WHY THERE HAS TO BE A BUTTON FOR THIS ────────────────────────────────────
//
// Telegram will not let a bot open a conversation, so a linked account is not a
// reachable one until the person has pressed Start. And pressing Start tells us
// nothing: no webhook is registered, so the bot does not reply and the site
// never hears about it. That left the only honest instruction — "press Start" —
// with no way for anybody to find out whether it had worked. Silence from the
// bot and silence from the site look exactly like a feature that is broken.
//
// A successful send is the only evidence that ever arrives, so this is a way to
// ask for one on purpose rather than waiting for a match to produce it. It is
// also the diagnostic: Telegram's refusals each mean something different, and
// this turns the one they gave into the sentence that says what to do next.
//
// Costs nothing to abuse beyond a message to yourself: it only ever sends to the
// account attached to the wallet that asked, and it cannot be aimed.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { linkFor, noteDelivery } from "@/lib/store";
import { sendMessage } from "@/lib/telegram-send";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const link = await linkFor(db(), wallet, "telegram");
  if (link === null) {
    return Response.json({ error: "No Telegram account is attached to this wallet." }, { status: 400 });
  }

  const token = env().TELEGRAM_BOT_TOKEN;
  const delivery = await sendMessage(
    token,
    link.accountId,
    "*That worked.* This wallet is linked, and the bot can reach you.\n\n" +
      "You will get a message when a slow match becomes your turn, and when a " +
      "match you offered a seat in begins. Nothing for every turn of a live " +
      "match — you are at the board for those.",
  );

  // Recorded the same way a real notification records it, so the profile stops
  // asking the moment this succeeds.
  const problem = delivery.sent ? null : delivery.because;
  if (problem !== link.dmProblem) await noteDelivery(db(), wallet, "telegram", problem);

  if (delivery.sent) return Response.json({ sent: true });

  // Telegram's own description is deliberately not passed on: it is written for
  // whoever runs the bot. What a player needs is the one thing to do next.
  const said: Record<typeof delivery.because, string> = {
    unconfigured: "The bot is not switched on yet. That is on this end, not yours.",
    "not-started": `Telegram says you have not started a chat with the bot yet. Open it and press Start, then try again.`,
    blocked: "You have blocked the bot. Unblock it in Telegram, then try again.",
    unreachable: "Telegram could not be reached just now. Try again in a moment.",
  };
  return Response.json({ sent: false, because: delivery.because, error: said[delivery.because] });
}
