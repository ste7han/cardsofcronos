// Whether the publisher can still pay for its own transactions.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// Every payout this game makes is a transaction signed by one key: the weekly
// prizes, the holders' share-outs, settling a ranked match. That key pays its
// own gas. In November 2026 it ran out, and for ten days every weekly run ended
// in "insufficient funds" — in a log line, once a minute, read by nobody. Two
// weeks of prizes went unpaid and the first anyone knew was a player asking.
//
// The failure was loud. It was loud in a place nobody looks. So this reads the
// balance every minute and, when it is low, says so where the maker does look:
// once a day, not once a minute, because an alert that repeats sixty times an
// hour is an alert that gets muted.
//
// ── WHERE IT GOES ────────────────────────────────────────────────────────────
//
// DISCORD_ALERTS if it is set, and DISCORD_PARTNERS if not — the one private
// channel this project already has. Never a public feed: "the payout key is
// nearly empty" is not a thing to announce to the people waiting on payouts.

import { db, env } from "@/lib/api";
import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { post } from "@/lib/discord";
import { PUBLISHER } from "@/lib/revenue";
import { cursorOf, setCursor } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Below this many CRO, warn.
 *
 * One transaction has been seen to need up to 0.06 CRO at the gas limit it is
 * sent with. A week is two to four of them and a day's share-out one or two, so
 * three CRO is roughly a month — time enough to notice a message and act on it.
 */
export const LOW_GAS_CRO = 3;

/** The day a warning was last sent, so the next one waits for tomorrow. */
const TOLD = "gas:warned";

export async function POST(request: Request) {
  const expected = env().CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET is missing or empty, so nothing runs." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "No." }, { status: 401 });
  }

  const ourRpc = env().CRONOS_RPC;
  const rpcs = ourRpc ? [ourRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const wei = BigInt(await rpc<string>(rpcs, "eth_getBalance", [PUBLISHER, "latest"]));
  // Two decimals is all a warning needs, and Number is exact enough for that.
  const cro = Number(wei / 10n ** 16n) / 100;
  if (cro >= LOW_GAS_CRO) return Response.json({ ok: true, low: false, cro });

  const now = Date.now();
  const today = Math.floor(now / 86_400_000);
  if ((await cursorOf(db(), TOLD)) === today) {
    return Response.json({ ok: true, low: true, cro, toldToday: true });
  }

  const room = env().DISCORD_ALERTS || env().DISCORD_PARTNERS || "";
  const sent = await post(room, [
    {
      title: "The publisher is running out of gas",
      color: 0xff4d6d,
      description:
        `${PUBLISHER} holds **${cro} CRO**, under the ${LOW_GAS_CRO} CRO this warns at. ` +
        `It signs every payout — weekly prizes, holder share-outs, ranked matches — and ` +
        `when it is empty they stop without anything else saying so.\n\n` +
        `Send CRO to it on Cronos. Missed weeks are caught up by themselves once it can pay.`,
      url: `https://explorer.cronos.org/address/${PUBLISHER}`,
    },
  ]);

  // Marked only when it landed. A warning that did not arrive is tried again in
  // a minute, which is the point of having it.
  if (sent.ok) await setCursor(db(), TOLD, today, now);
  return Response.json({ ok: true, low: true, cro, told: sent.ok, wrong: sent.wrong });
}
