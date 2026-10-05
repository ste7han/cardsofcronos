// Sending one message to one chat.
//
// A chat is a person or a channel — Telegram does not distinguish, and neither
// does this. Two callers use it for two different things: lib/notify.ts tells
// one player it is their turn, and lib/telegram-feed.ts mirrors the public feeds
// into a channel.
//
// ── WHY THIS NEEDS NO WEBHOOK ────────────────────────────────────────────────
//
// A private chat's `chat_id` IS the user's own Telegram id, and the login widget
// already hands us that — see app/api/link/telegram/callback. A channel's is the
// id of the channel, which is configuration. So sending needs nothing but the
// token and a number we already have. No gateway, no webhook, no long-lived
// connection, which is what makes this possible at all from a Worker that only
// exists for the length of a request.
//
// ── THE ONE THING TELEGRAM WILL NOT DO ───────────────────────────────────────
//
// A bot may not open a conversation with a person. They have to press Start
// once, and until they have, every send is refused. (A channel is different: the
// bot has to be an administrator of it, and the refusal says so.) That refusal is the normal state of a
// freshly linked account rather than an error, so it comes back named: the
// profile page turns `not-started` into a button and anything else into the
// reason Telegram gave.
//
// Failing loudly matters here more than usual, because the alternative fails
// invisibly — a notification nobody receives looks exactly like a notification
// nobody needed.

const API = "https://api.telegram.org/bot";

export type Delivery =
  | { sent: true }
  /** No bot token in the environment. Not a player problem. */
  | { sent: false; because: "unconfigured"; detail: string }
  /** They have never pressed Start, so there is no chat to send into. */
  | { sent: false; because: "not-started"; detail: string }
  /** They pressed Start once and have since blocked the bot. Stop asking. */
  | { sent: false; because: "blocked"; detail: string }
  /** Telegram said something else, or could not be reached at all. */
  | { sent: false; because: "unreachable"; detail: string };

/** Telegram's own words, mapped onto the three cases that mean different things. */
function readRefusal(description: string): Delivery {
  const said = description.toLowerCase();
  // "bot can't initiate conversation with a user" and "chat not found" are the
  // same fact from two angles: nobody has opened this chat.
  if (said.includes("can't initiate") || said.includes("chat not found")) {
    return { sent: false, because: "not-started", detail: description };
  }
  if (said.includes("blocked")) {
    return { sent: false, because: "blocked", detail: description };
  }
  return { sent: false, because: "unreachable", detail: description };
}

/**
 * Send one message to one chat.
 *
 * The token goes in the URL because that is the only place Telegram accepts it,
 * which is also why it must never be logged: `detail` carries Telegram's
 * description and never the request.
 */
export async function sendMessage(
  botToken: string | undefined,
  chatId: string,
  text: string,
): Promise<Delivery> {
  if (!botToken) {
    return {
      sent: false,
      because: "unconfigured",
      detail: "TELEGRAM_BOT_TOKEN is not set on this Worker.",
    };
  }

  let body: { ok?: boolean; description?: string };
  try {
    const response = await fetch(`${API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        // The link in these messages is the whole point of them, so a preview
        // card under every one would be noise on a phone.
        link_preview_options: { is_disabled: true },
      }),
    });
    body = (await response.json()) as typeof body;
  } catch (error) {
    return { sent: false, because: "unreachable", detail: String(error) };
  }

  if (body.ok === true) return { sent: true };
  return readRefusal(body.description ?? "Telegram said no and did not say why.");
}
