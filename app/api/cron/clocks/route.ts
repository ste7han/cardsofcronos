// Enforcing the match clock, on a schedule rather than when somebody looks.
//
// ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
//
// `catchUp` ends a turn whose window has passed, and it only ran inside the two
// routes a player reads a match through. So a correspondence turn did not
// actually expire after a day — it expired the next time anybody opened that
// match, which could be days later, and nothing told the player it had become
// their turn again.
//
// That left the notifications missing the case they were built for. A turn comes
// back to you one of two ways: the opponent moves, or the opponent lets the day
// lapse. /api/pvp/move covers the first. For a slow match the second is the more
// likely of the two — somebody forgets — and it reached nobody.
//
// ── IT DOES THE SAME THING A PLAYER'S REQUEST DOES ───────────────────────────
//
// Deliberately not a second implementation of the clock. It calls the same
// catchUp, saves through the same saveMoves, settles through the same settle and
// notifies through the same lib/notify — so a match advanced by this tick is
// indistinguishable from one advanced by somebody opening the page, and there is
// no second set of rules to drift.
//
// Sending is guarded in lib/notify by the move count, so a tick that runs again
// before anything changes sends nothing a second time.

import { db, env } from "@/lib/api";
import { CARDS } from "@/data/cards";
import { catchUp, stateOf } from "@/engine/record";
import { matchesOnTheClock, potsToPay, saveMoves } from "@/lib/store";
import { payOut, settle } from "@/lib/finish";
import { tellItIsTheirTurn } from "@/lib/notify";
import { INDEX } from "@/lib/set";

/**
 * The window the contract gives either player to walk away with their own
 * deposit. Past it the escrow's own exit applies and a claim is asking the
 * chain about something it can no longer change. ABANDON_AFTER in
 * contracts/MatchEscrow.sol.
 */
const WALK_AWAY_AFTER = 30 * 86_400_000;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Falsy and not undefined: `wrangler secret put` accepts an empty value and
  // reports success, so an unset secret must refuse rather than match "".
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

  const now = Date.now();
  const due = await matchesOnTheClock(db(), now);

  let advanced = 0;
  let finished = 0;
  let told = 0;

  for (const record of due) {
    const caught = catchUp(record, now, CARDS, INDEX);
    // Nothing to do. A match can sit on this list for a moment after it is
    // already up to date — catchUp refuses to advance a finished one.
    if (caught.moves.length === record.moves.length && caught.armed === record.armed) continue;

    const state = stateOf(caught, CARDS, INDEX);
    advanced += 1;

    if (state.finished) {
      // settle writes the moves itself, under a WHERE that makes it happen once.
      await settle(db(), caught, state, now, {
        publisherKey: env().PUBLISHER_KEY,
        rpc: env().CRONOS_RPC,
        pvpFriendly: env().DISCORD_PVP_FRIENDLY,
        pvpRanked: env().DISCORD_PVP_RANKED,
      });
      finished += 1;
      continue;
    }

    await saveMoves(db(), caught.id, caught.moves, caught.deadline, null, caught.armed);

    // Whoever it is now. The turn may have passed back to the player who was
    // already waiting, which is exactly the case nobody was being told about.
    await tellItIsTheirTurn(
      db(),
      caught,
      state.toMove,
      state.turn,
      "your-turn",
      {
        telegramBotToken: env().TELEGRAM_BOT_TOKEN,
        pvpFriendly: env().DISCORD_PVP_FRIENDLY,
        pvpRanked: env().DISCORD_PVP_RANKED,
      },
    );
    told += 1;
  }

  // ── AND THE POTS NOBODY CLAIMED ────────────────────────────────────────────
  //
  // Settling a match and paying it out are two calls, and for a month only the
  // first was made: the first ranked match ever played ended `settled` with
  // `paid: false` and twenty CRO sat in the escrow with a winner's name on it.
  // lib/finish.ts claims it now at the moment of settling, and one attempt is
  // not an attempt — a bad RPC at that second would put it right back where it
  // was, silently, with nobody looking.
  //
  // Anybody may call claim and it always pays the winner, so retrying costs
  // gas and can take nothing.
  const pots = await potsToPay(db(), now, WALK_AWAY_AFTER);
  let claimed = 0;
  for (const record of pots) {
    const paid = await payOut(db(), record, {
      publisherKey: env().PUBLISHER_KEY,
      rpc: env().CRONOS_RPC,
    });
    if (paid.tx !== null) claimed += 1;
  }

  return Response.json({ looked: due.length, advanced, finished, told, pots: pots.length, claimed });
}
