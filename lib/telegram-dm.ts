// Telling one player, in a private chat, that something is waiting for them.
//
// ── WHY THIS NEEDS NO WEBHOOK ────────────────────────────────────────────────
//
// A private chat's `chat_id` IS the user's own Telegram id, and the login widget
// already hands us that — see app/api/link/telegram/callback. So sending needs
// nothing but the token and a number we already have stored. No gateway, no
// webhook, no long-lived connection, which is what makes this possible at all
// from a Worker that only exists for the length of a request.
//
// ── THE ONE THING TELEGRAM WILL NOT DO ───────────────────────────────────────
//
// A bot may not open a conversation. The person has to press Start once, and
// until they have, every send is refused. That refusal is the normal state of a
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
 * Send one message to one person.
 *
 * The token goes in the URL because that is the only place Telegram accepts it,
 * which is also why it must never be logged: `detail` carries Telegram's
 * description and never the request.
 */
export async function sendDM(
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
