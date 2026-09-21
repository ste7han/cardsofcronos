// Posting to a Discord webhook.
//
// A webhook URL is a password: anybody holding one can post into that channel as
// that webhook, forever, with no login. So they are Worker secrets like every
// other — never in a file, never in wrangler.jsonc, never in a log line. The
// three names are in cloudflare-env.d.ts.
//
// ── WHAT IT DOES WHEN DISCORD SAYS NO ────────────────────────────────────────
//
// Nothing dramatic. A feed is not the game: a post that does not land is a
// missing line in a channel, and failing the whole scheduled run over it would
// mean the cursor does not move and the next run tries the same batch again,
// forever, while every later mint goes unreported. So a failure is returned and
// counted rather than thrown, and the caller decides.
//
// The one thing it does insist on is the rate limit. Discord answers 429 with
// `retry_after` in seconds, and ignoring that gets the webhook temporarily
// banned rather than merely rate-limited — which would take the feed down for
// everybody instead of delaying one message.

/** What one post either did or did not do. Never throws. */
export interface Posted {
  ok: boolean;
  /** The HTTP status, or null when the request never got an answer. */
  status: number | null;
  /** Why not, in a sentence, for the job's return value. Null when it worked. */
  wrong: string | null;
}

/** A Discord embed, as much of one as this project sends. */
export interface Embed {
  title: string;
  /** The small line above the title: who is speaking, with an icon. */
  author?: { name: string; url?: string; icon_url?: string };
  description?: string;
  /** Decimal, not hex. Discord wants an integer. */
  color?: number;
  url?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Posts one message, retrying once if Discord asks for a pause.
 *
 * Once, not until it works. A scheduled run has a minute before the next one
 * starts, and a webhook being rate-limited for longer than that is a thing to
 * report rather than to wait out.
 */
export async function post(webhook: string, embeds: Embed[]): Promise<Posted> {
  if (!webhook) return { ok: false, status: null, wrong: "no webhook configured" };
  if (embeds.length === 0) return { ok: true, status: null, wrong: null };
  // Discord takes at most ten embeds in one message.
  if (embeds.length > 10) {
    const first = await post(webhook, embeds.slice(0, 10));
    if (!first.ok) return first;
    return post(webhook, embeds.slice(10));
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let answer: Response;
    try {
      answer = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ embeds }),
      });
    } catch (error) {
      return {
        ok: false,
        status: null,
        wrong: error instanceof Error ? error.message : "the request failed",
      };
    }

    if (answer.status === 429 && attempt === 0) {
      const wait = await answer
        .json()
        .then((body) => Number((body as { retry_after?: number }).retry_after ?? 1))
        .catch(() => 1);
      // Capped. A webhook asking for a minute is one to report, not to sit on.
      if (wait > 10) {
        return { ok: false, status: 429, wrong: `rate limited for ${wait}s` };
      }
      await new Promise((wake) => setTimeout(wake, wait * 1000 + 250));
      continue;
    }

    if (answer.ok) return { ok: true, status: answer.status, wrong: null };

    // The body says which field Discord objected to, which is the only way to
    // find a malformed embed. Truncated: it is going into a log line.
    const said = await answer.text().catch(() => "");
    return {
      ok: false,
      status: answer.status,
      wrong: `${answer.status} ${said.slice(0, 200)}`,
    };
  }

  return { ok: false, status: 429, wrong: "still rate limited after waiting" };
}

/**
 * Whether a webhook exists and where it points, without posting anything.
 *
 * A GET on a webhook URL returns its name and channel. It is the only way to
 * check one is live without putting a message in somebody's channel to find
 * out — which is a thing you cannot take back and which everybody in the
 * channel sees.
 */
export async function whereItPoints(
  webhook: string,
): Promise<{ ok: boolean; name?: string; channel?: string; wrong?: string }> {
  try {
    const answer = await fetch(webhook, { method: "GET" });
    if (!answer.ok) return { ok: false, wrong: `${answer.status} ${await answer.text()}` };
    const body = (await answer.json()) as { name?: string; channel_id?: string };
    return { ok: true, name: body.name, channel: body.channel_id };
  } catch (error) {
    return { ok: false, wrong: error instanceof Error ? error.message : "the request failed" };
  }
}
