// The weekly board, and a finished match handed over to be checked.
//
// GET is the board: this week's standings, the weeks that have closed with their
// winners, and what is in the prize pot.
//
// POST is a match. The seed, the deck and the moves — the server rebuilds the
// bot's deck from the seed, which is all it is derived from, replays every move
// through the same engine the browser used, and records what ITS OWN state says
// at the end. Nothing the caller claims about the outcome is read. That is the
// difference between a leaderboard and a form: lib/history.ts is blunt that solo
// results are computed in the player's own browser and are worth exactly as much
// as the player's honesty, which is fine on a profile and worthless with a prize
// on it.
//
// What it still cannot stop: somebody writing a solver and submitting matches it
// played. The engine is public. What that costs is a program that beats the same
// bot everybody else is beating, which is the game rather than a way past it.

import { CARDS } from "@/data/cards";
import { BOARDS, boardOf, opponentDeck, type Board } from "@/data/boards";
import { deckProblems } from "@/engine/deck";
import { applyMove, newMatch } from "@/engine/match";
import { RULES, type Move } from "@/engine/types";
import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { scoreEntry } from "@/lib/entries";
import { PUBLIC_RPCS, rpc, tokenBalances } from "@/lib/cronos";
import { selector } from "@/lib/evm-tx";
import { asWord } from "@/lib/publisher";
import { lockedOut, prizeFor } from "@/lib/gate";
import { CONTRACTS, CROCARD } from "@/lib/revenue";
import { INDEX } from "@/lib/set";
import { pastWeeks, record, standings, weekEnds, weekOf } from "@/lib/tournament";

export const dynamic = "force-dynamic";

/** More than a match can contain, so a bad list cannot spin the worker. */
const MOST_MOVES = 400;

export async function GET() {
  const now = Date.now();
  const week = weekOf(now);

  // Every board, because the page shows them side by side and one request is
  // one round trip. A board with nothing on it is an empty table rather than a
  // missing one — "nobody has played this yet" is a real answer.
  const boards = await Promise.all(
    BOARDS.map(async (board) => ({
      id: board.id,
      name: board.name,
      blurb: board.blurb,
      needs: board.needs === null ? null : { token: board.needs.token, whole: board.needs.whole },
      standings: await standings(db(), week, board.id),
      past: await pastWeeks(db(), week, board.id),
      prize: await prizeFor(board.id),
    })),
  );

  return Response.json({ week, closes: weekEnds(now), boards, pot: await potNow() });
}

/**
 * What the pot is holding, in the token's smallest unit, or null.
 *
 * THE POT AND NOT A PRIZE. It used to return both, with `most` reading
 * `nextPrize()` — a function that took no board back when there was only one.
 * There are several now and each has its own share, so a single "most" is a
 * number that belongs to nobody. Each board carries its own; this is the pool
 * they come out of.
 *
 * Null covers two different things and the page has to say them differently: the
 * pot is not deployed, or an RPC would not answer. Neither is zero. A pot
 * reading empty because a request timed out is the kind of number that makes
 * somebody stop playing.
 */
async function potNow(): Promise<{ wei: string | null; wallet: string | null }> {
  const pot = CONTRACTS.pot;
  if (pot === null) return { wei: null, wallet: null };

  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const [held] = await tokenBalances(rpcs, CROCARD, [pot]);
  return { wei: held?.toString() ?? null, wallet: pot };
}

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const { seed, deck, moves, board: boardId } = (body ?? {}) as {
    seed?: unknown;
    deck?: unknown;
    moves?: unknown;
    board?: unknown;
  };

  if (!Number.isInteger(seed) || !Array.isArray(moves) || !Array.isArray(deck)) {
    return Response.json(
      { error: "An entry is a seed, a deck and a list of moves." },
      { status: 400 },
    );
  }
  if (moves.length > MOST_MOVES) {
    return Response.json({ error: "That is longer than a match." }, { status: 400 });
  }
  if (!deck.every((id): id is string => typeof id === "string")) {
    return Response.json({ error: "A deck is a list of card ids." }, { status: 400 });
  }

  // Missing means the board that existed before there were boards, so an old
  // client keeps working rather than having every entry refused.
  const board = boardOf(typeof boardId === "string" ? boardId : "bot");
  if (board === undefined) {
    return Response.json({ error: "There is no such board." }, { status: 400 });
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  // THE LOCK IS HERE AND NOT ONLY ON THE SCREEN. engine/deck.ts says it about a
  // different rule and it is the same rule: in the first version of this game
  // the card check was a UI filter, so a direct call could play anything. A
  // board held back for people who hold $LION has to read the chain.
  const shut = await lockedOut(board, wallet);
  if (shut !== null) return Response.json({ error: shut }, { status: 403 });

  // The deck has to be a legal deck. What is NOT checked is whether it is
  // yours: a collection lives in the player's browser here, so there is nothing
  // on chain to read it against. That does not matter while the mint is shut —
  // with nothing to mint there is nothing to own — and it is the check that has
  // to arrive the moment either changes.
  const wrong = deckProblems(deck, INDEX);
  if (wrong.length > 0) {
    return Response.json({ error: wrong.join(" ") }, { status: 400 });
  }

  let state;
  try {
    state = newMatch(CARDS, seed as number, {
      you: deck,
      // Built by data/boards.ts, which is also what the browser built it with.
      // Two copies of this rule is every honest submission refused for a reason
      // nobody can see, and it was two copies until boards arrived.
      opponent: opponentDeck(CARDS, board, seed as number),
    });
    for (const move of moves as Move[]) state = applyMove(state, move, INDEX);
  } catch (error) {
    // The engine's own sentence. If a list does not replay, this is the only
    // thing that knows why.
    return Response.json(
      { error: error instanceof Error ? error.message : "That does not replay." },
      { status: 400 },
    );
  }

  if (!state.finished || state.turn <= RULES.turns) {
    return Response.json({ error: "That match is not finished." }, { status: 400 });
  }
  if (state.winner !== "you") {
    // The entry requirement, and the reason the table stores the bot's figure
    // next to yours: a row on this board carries its own proof that it won.
    return Response.json({ error: "Only a match you won counts." }, { status: 400 });
  }

  // ── A PAID BOARD IS SCORED AGAINST THE MATCH IT DEALT ──────────────────────
  //
  // The seed had to come from /api/boards/deal, which is where the go was
  // spent. Checking it here is what makes the fee buy an attempt rather than a
  // win: a seed the server never dealt is a shuffle the player found by
  // replaying locally until one went their way.
  //
  // After the replay, deliberately. Marking it scored before would consume the
  // deal for a submission the engine then refused.
  const now = Date.now();
  if (board.entry?.contract != null) {
    if (!(await scoreEntry(db(), wallet, board.id, seed as number, now))) {
      return Response.json(
        {
          error:
            `That match was not dealt to this wallet, or it has already been scored. ` +
            `This board costs ${board.entry.cro} CRO a go.`,
        },
        { status: 402 },
      );
    }
  }

  const best = await record(
    db(),
    {
      wallet,
      mc: state.players.you.mc,
      opponentMC: state.players.opponent.mc,
      seed: seed as number,
      at: now,
    },
    weekOf(now),
    board.id,
  );

  return Response.json({ ok: true, best, board: board.id, mc: state.players.you.mc });
}
