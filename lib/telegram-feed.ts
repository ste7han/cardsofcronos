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
// ── IT IS ALLOWED TO FAIL, AND NOT ALLOWED TO BE QUIET ──────────────────────
//
// The ledger and the cursor in lib/feed.ts are moved on the strength of the
// Discord post. By the time this runs, the feed has already been posted and
// recorded as posted, so a failure here is one missing line in a channel — and
// the alternative, holding the cursor back until both succeeded, would repost
// the Discord line every run until Telegram came back. A missing line beats a
// duplicated one.
//
// But it has to say so. The first version of this threw the Delivery away
// without looking at it and swallowed every exception, so a refused message was
// invisible — not just unreported but unloggable, with the only symptom being a
// channel that stays empty while Discord fills up. That was caught by sending
// one test line and realising nothing here could have told anybody whether it
// arrived. Both paths log now; `wrangler tail` is where they land.

import { sendMessage } from "@/lib/telegram-send";
import type { Embed } from "@/lib/discord";

/** The three characters Telegram's HTML mode cares about, and no others. */
const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Discord's inline markup, in Telegram's.
 *
 * Runs on text that has ALREADY been escaped, so the tags it inserts are the
 * only tags in the result. `**bold**` is Discord's; Telegram's legacy Markdown
 * reads one asterisk, which is why every number used to arrive wearing its
 * asterisks.
 */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * One embed as Telegram HTML.
 *
 * Deliberately plain: this is the generic translation, used by the burns feed
 * and the weekly result. Buys have their own shape — see sayBuysForTelegram in
 * lib/feed.ts — because a buy bot is read at a glance and a translated embed is
 * read like a document.
 *
 * Field names are kept because they are what makes the numbers mean anything:
 * "4,812" on its own is not a fact. The inline/block distinction Discord uses is
 * dropped, because a phone has one column.
 */
export function asText(embed: Embed): string {
  const lines: string[] = [];

  // The author line is who is talking, and dropping it was why these read as
  // coming from nobody.
  if (embed.author?.name) lines.push(`<b>${escape(embed.author.name)}</b>`);

  if (embed.title) {
    const title = escape(embed.title);
    // Linked when there is somewhere to go, which is what makes the title the
    // way in rather than a headline.
    lines.push(
      embed.url ? `<a href="${escape(embed.url)}"><b>${title}</b></a>` : `<b>${title}</b>`,
    );
  }
  if (embed.description) lines.push(inline(escape(embed.description)));

  for (const field of embed.fields ?? []) {
    lines.push(`${escape(field.name)}: ${inline(escape(field.value))}`);
  }
  if (embed.footer?.text) lines.push(`<i>${escape(embed.footer.text)}</i>`);

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
  await sendLines(
    botToken,
    chat,
    embeds.map((embed) => ({ what: embed.title ?? "a feed line", html: asText(embed) })),
  );
}

/**
 * Finished HTML, one message each, never throwing.
 *
 * The same loop `mirror` uses, reached directly by the feeds that write their
 * own lines rather than translating an embed — see sayBuysForTelegram. One loop
 * and two entry points, so the logging and the swallowing are written once.
 */
export async function sendLines(
  botToken: string | undefined,
  chat: string | undefined,
  lines: readonly { what: string; html: string }[],
): Promise<void> {
  if (!botToken || !chat || lines.length === 0) return;
  for (const line of lines) {
    try {
      const sent = await sendMessage(botToken, chat, line.html);
      if (!sent.sent) {
        // The reason, not just the fact. "not-started" on a channel means the
        // bot is not an administrator of it; "unreachable" is Telegram itself.
        // Telling them apart from the outside is impossible without this line.
        console.error(`[telegram] ${line.what} was refused: ${sent.because} — ${sent.detail}`);
      }
    } catch (error) {
      // Swallowed per message: one line that cannot be sent must not take the
      // rest of the batch with it. Logged, because a mirror that fails in
      // silence looks exactly like a mirror nobody configured.
      console.error(`[telegram] ${line.what} threw:`, error);
    }
  }
}
