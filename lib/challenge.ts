// An offer posted to the lobby, announced where people are.

// A lobby only works if somebody is looking at it. Nobody sits on /pvp waiting
// for an offer to appear, so an offer posted into an empty lobby expires in an
// hour having been seen by nobody — which is how a game with two players stays
// a game with two players.
//
// So the channel is the lobby. The same two webhooks that carry results carry
// the challenges, friendly in one and ranked in the other, and the title is a
// link straight to the offer.
//
// ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
//
// It does not wait for the stake. A ranked offer is two steps — post, then sign
// the deposit — and the seat cannot be taken until the second one lands. This
// announces after the first, and says so, because an offer that appears in the
// channel a minute late is worse than one that appears with a line saying the
// stake is on its way. /api/pvp/join is what actually refuses an unfunded seat;
// this is a notice, not a gate.
//
// ── IT NEVER FAILS THE OFFER ─────────────────────────────────────────────────
//
// Same rule as every other feed in this project: a channel that did not hear
// about something is a missing line in Discord, not a reason to refuse a player
// a seat. The caller catches and moves on.

import { post } from "@/lib/discord";
import { from } from "@/lib/flair";
import type { Database } from "@/lib/store";
import type { MatchMode } from "@/engine/record";

export interface Offer {
  id: string;
  playerId: string;
  mode: MatchMode;
  stake: number;
  rank: number;
  expiresAt: number;
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Said once, even if the route runs twice.
 *
 * A retried request posting a second challenge for the same offer would put two
 * identical links in the channel, one of which stops working the moment the
 * other is taken. The same table the mint and burn feeds dedupe against.
 */
async function alreadySaid(db: Database, id: string): Promise<boolean> {
  const key = `offer:${id}`;
  const found = await db
    .prepare(`SELECT id FROM feed_posted WHERE id = ?`)
    .bind(key)
    .first<{ id: string }>();
  if (found !== null) return true;

  await db
    .prepare(`INSERT OR IGNORE INTO feed_posted (id, at) VALUES (?, ?)`)
    .bind(key, Date.now())
    .run();
  return false;
}

/** How long a seat gives you to answer, in the words the lobby uses. */
function clockOf(mode: MatchMode): string {
  return mode === "live"
    ? "**Live.** Two minutes a turn, and a turn you do not answer is a turn you lose."
    : "**Slow.** A day a turn, so it can be played across a week from a phone.";
}

export async function announceOffer(
  db: Database,
  offer: Offer,
  secrets: { pvpFriendly?: string; pvpRanked?: string },
): Promise<void> {
  const staked = offer.stake > 0;
  const hook = staked ? secrets.pvpRanked : secrets.pvpFriendly;
  if (!hook) return;
  if (await alreadySaid(db, offer.id)) return;

  await post(hook, [
    {
      author: from(
        staked ? "Cards of Cronos · ranked" : "Cards of Cronos · friendly",
        "https://cardsofcronos.com/pvp",
      ),
      title: staked
        ? `💰  A seat is open for ${offer.stake} CRO`
        : `⚔️  A seat is open`,
      // Straight to the offer rather than to the lobby. The page scrolls to it
      // and marks it, so somebody arriving from here does not have to work out
      // which of six rows they were sent for.
      url: `https://cardsofcronos.com/pvp?offer=${offer.id}`,
      description:
        `**${short(offer.playerId)}** · rank ${offer.rank}\n` +
        `${clockOf(offer.mode)}\n\n` +
        (staked
          ? `**${offer.stake} CRO a side**, so the pot is ${offer.stake * 2}. The winner takes it ` +
            `less the cut their $CROCARD holding earns — hold more, keep more.\n\n` +
            `The stake is being put up now. The seat opens the moment it lands.`
          : `Nothing staked and no rank moves. A game, for the sake of one.`) +
        `\n\n**[Take it →](https://cardsofcronos.com/pvp?offer=${offer.id})**`,
      color: staked ? 0xffd700 : 0x9d4edd,
      footer: {
        text: staked
          ? "Open for an hour · first to sit down takes it · you need a deck of 40"
          : "Open for an hour · first to sit down takes it",
      },
      timestamp: new Date(offer.expiresAt - 60 * 60 * 1000).toISOString(),
    },
  ]);
}
