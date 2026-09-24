// A finished match against the bot, replayed here and said out loud.
//
// This is the route components/game/Game.tsx has had a comment about since the
// boards arrived: "a number this browser computed is fine as a private note to
// itself and is not a record the moment somebody else reads it back."
//
// ── NOTHING IS TAKEN ON THE CLIENT'S WORD ────────────────────────────────────
//
// A solo match is played in the player's own browser, so the server has never
// seen a move of it. What arrives here is a seed, a deck and a list of moves,
// and the server rebuilds the bot's deck from the seed and replays every move
// with its own engine. What goes to Discord is what THIS engine produced. A
// browser that reported a win it did not have would have to produce a list of
// moves that actually wins, which is playing the game.
//
// It is the same verification /api/tournament does, and deliberately a separate
// route: that one is a competition entry and refuses anything but a win. This
// one is a result, and a loss is a result.
//
// ── IT DOES NOT WRITE ANYTHING DOWN ──────────────────────────────────────────
//
// No table, no rank, no leaderboard. The private record stays in the browser
// where it was computed and the weekly board stays where it is. All this adds
// is a line in a channel, which is why it can afford to accept a loss.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { CARDS } from "@/data/cards";
import { boardOf, opponentDeck } from "@/data/boards";
import { deckProblems } from "@/engine/deck";
import { applyMove, newMatch } from "@/engine/match";
import { RULES, type Move } from "@/engine/types";
import { post } from "@/lib/discord";
import { INDEX } from "@/lib/set";
import { formatMC } from "@/engine/format";
import { from, versus } from "@/lib/flair";

export const dynamic = "force-dynamic";

/** Longer than a match can be. The same guard the tournament route uses. */
const MOST_MOVES = 400;

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Whether this exact match has already been announced.
 *
 * A wallet, a seed and a board name one match: the seed fixes both shuffles and
 * the board fixes the opponent, so the same three replaying to the same result
 * is the same match being submitted twice. Without this, a page that retried —
 * or somebody pressing a button — would put the same win in the channel again.
 *
 * It reuses the ledger the Discord feeds keep, because it is the same question
 * those ask: has this already gone out.
 */
async function alreadySaid(wallet: string, seed: number, board: string): Promise<boolean> {
  const id = `solo:${wallet}:${seed}:${board}`;
  const found = await db()
    .prepare(`SELECT id FROM feed_posted WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();
  if (found !== null) return true;

  await db()
    .prepare(`INSERT OR IGNORE INTO feed_posted (id, at) VALUES (?, ?)`)
    .bind(id, Date.now())
    .run();
  return false;
}

export async function POST(request: Request) {
  // CLONED. signedInWallet reads the body too, and a body can only be read
  // once — without this, every submission came back 401 and the client swallowed
  // it, so a finished match simply never appeared in the channel and nothing
  // anywhere said why. /api/tournament and /api/pvp/join both clone; this did
  // not, and that was the whole of the bug.
  const body = await request.clone().json().catch(() => null);
  const { seed, deck, moves, board: boardId, deckName } = (body ?? {}) as {
    seed?: unknown;
    deck?: unknown;
    moves?: unknown;
    board?: unknown;
    deckName?: unknown;
  };

  if (!Number.isInteger(seed) || !Array.isArray(moves) || !Array.isArray(deck)) {
    return Response.json({ error: "A result is a seed, a deck and a list of moves." }, { status: 400 });
  }
  const at = seed as number;
  if (moves.length > MOST_MOVES) {
    return Response.json({ error: "That is longer than a match." }, { status: 400 });
  }
  if (!deck.every((id): id is string => typeof id === "string")) {
    return Response.json({ error: "A deck is a list of card ids." }, { status: 400 });
  }

  const board = boardOf(typeof boardId === "string" ? boardId : "bot");
  if (board === undefined) return Response.json({ error: "There is no such board." }, { status: 400 });

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  // A legal deck, checked with the engine's own rules rather than a copy.
  const wrong = deckProblems(deck, INDEX);
  if (wrong.length > 0) return Response.json({ error: wrong.join(" ") }, { status: 400 });

  let state;
  try {
    state = newMatch(CARDS, at, {
      you: deck,
      // From data/boards.ts, the same builder the browser used. Two copies of
      // this rule would refuse every honest submission and say nothing useful.
      opponent: opponentDeck(CARDS, board, at),
    });
    for (const move of moves as Move[]) state = applyMove(state, move, INDEX);
  } catch (error) {
    // The engine's own sentence, which is the only thing that knows why.
    return Response.json(
      { error: error instanceof Error ? error.message : "That does not replay." },
      { status: 400 },
    );
  }

  if (!state.finished || state.turn <= RULES.turns) {
    return Response.json({ error: "That match is not finished." }, { status: 400 });
  }

  const yours = state.players.you.mc;
  const theirs = state.players.opponent.mc;
  const won = state.winner === null ? null : state.winner === "you";

  // Recorded before it is posted, and the check and the write are one call, so
  // two requests arriving together cannot both decide they are the first.
  if (await alreadySaid(wallet, at, board.id)) {
    return Response.json({ ok: true, already: true, yourMC: yours, theirMC: theirs, won });
  }

  // The board's own channel, falling back to the market's. Falling back rather
  // than going quiet: a result nobody hears about is worse than one in the
  // wrong room, and a board added without its secret set should still be heard.
  const hook = env()[board.channel] ?? env().DISCORD_SOLO;
  if (hook) {
    const name = typeof deckName === "string" && deckName.trim() !== "" ? deckName.trim() : null;
    await post(hook, [
      {
        author: from(`Cards of Cronos · ${board.name.toLowerCase()}`, "https://cardsofcronos.com/play"),
        title:
          won === null
            ? `⚖️  ${short(wallet)} drew with ${board.name}`
            : won
              ? `🏆  ${short(wallet)} beat ${board.name}`
              : `💀  ${board.name} beat ${short(wallet)}`,
        description:
          // The bar first, because it is the shape of the match and the two
          // figures are only the caption under it.
          `\`${versus(yours, theirs)}\`\n` +
          `**${formatMC(yours)}**  ·  ${board.name} **${formatMC(theirs)}**\n` +
          (won === null
            ? "Level after ten turns."
            : `${won ? "Won" : "Lost"} by **${formatMC(Math.abs(yours - theirs))}**`) +
          (name ? ` · playing ${name}` : ""),
        color: won === null ? 0x8b949e : won ? 0x3fb950 : 0xf85149,
        // Replayed on the server before this was written, which is the only
        // reason a figure a browser computed is worth putting in a channel.
        footer: { text: "Replayed and checked on the server" },
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  return Response.json({ ok: true, yourMC: yours, theirMC: theirs, won });
}
