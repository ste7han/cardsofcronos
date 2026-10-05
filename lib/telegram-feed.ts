// The public feeds, mirrored into a Telegram channel.
//
// ── ONE MESSAGE, BUILT ONCE ──────────────────────────────────────────────────
//
// The feeds already know how to say a burn, a mint and a buy — in Discord's
// embed shape, because Discord is where they went first. So this renders that
// shape as text rather than building a second set of sentences. Two sets would
// drift, and the one nobody is watching is the one that drifts: that is the same
// trap as a rule written out in prose beside the rule in code.
//
// What is lost in the translation is colour and layout, which carried nothing.
// What has to survive is the numbers and the link.
//
// ── IT IS ALLOWED TO FAIL ────────────────────────────────────────────────────
//
// The ledger and the cursor in lib/feed.ts are moved on the strength of the
// Discord post. By the time this runs, the feed has already been posted and
// recorded as posted, so a failure here is one missing line in a channel — and
// the alternative, holding the cursor back until both succeeded, would repost
// the Discord line every run until Telegram came back. A missing line beats a
// duplicated one.

import { sendMessage } from "@/lib/telegram-send";
import type { Embed } from "@/lib/discord";

/**
 * One embed as Telegram Markdown.
 *
 * Deliberately plain. Field names are kept because they are what makes the
 * numbers mean anything — "4,812" on its own is not a fact — and the inline/
 * block distinction Discord uses is dropped, because a phone has one column.
 */
export function asText(embed: Embed): string {
  const lines: string[] = [];

  if (embed.title) {
    // Linked when there is somewhere to go, which is what makes the title the
    // way in rather than a headline.
    lines.push(embed.url ? `*[${embed.title}](${embed.url})*` : `*${embed.title}*`);
  }
  if (embed.description) lines.push(embed.description);

  for (const field of embed.fields ?? []) {
    lines.push(`${field.name}: ${field.value}`);
  }
  if (embed.footer?.text) lines.push(`_${embed.footer.text}_`);

  return lines.join("\n");
}

/**
 * Put these in the channel, and never throw.
 *
 * Sent one message per embed rather than one joined message: a run that caught
 * up on six burns is six things that happened, and a wall with six of them in it
 * is read as one.
 */
export async function mirror(
  botToken: string | undefined,
  chat: string | undefined,
  embeds: readonly Embed[],
): Promise<void> {
  if (!botToken || !chat || embeds.length === 0) return;
  for (const embed of embeds) {
    try {
      await sendMessage(botToken, chat, asText(embed));
    } catch {
      // Swallowed per message. One embed that cannot be rendered or sent must
      // not take the rest of the batch with it.
    }
  }
}
