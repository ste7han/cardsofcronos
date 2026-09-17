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
import { PRESET_DECKS } from "@/data/preset-decks";
import { buildDeckPreferring, deckProblems } from "@/engine/deck";
import { applyMove, newMatch } from "@/engine/match";
import { RULES, type Move } from "@/engine/types";
import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { PUBLIC_RPCS, tokenBalances } from "@/lib/cronos";
import { CONTRACTS, CROCARD } from "@/lib/revenue";
import { INDEX } from "@/lib/set";
import { pastWeeks, record, standings, weekEnds, weekOf } from "@/lib/tournament";

export const dynamic = "force-dynamic";

/** More than a match can contain, so a bad list cannot spin the worker. */
const MOST_MOVES = 400;

export async function GET() {
  const now = Date.now();
  const week = weekOf(now);
  const [board, past, pot] = await Promise.all([
    standings(db(), week),
    pastWeeks(db(), week),
    potNow(),
  ]);
  return Response.json({ week, closes: weekEnds(now), standings: board, past, pot });
}

/**
 * What is in the prize pot, in the token's smallest unit, or null.
 *
 * IT IS A TOKEN BALANCE AND NOT A WALLET BALANCE. This asked `eth_getBalance` of
 * a wallet once, from when a quarter of a mint arrived as CRO. It does not any
 * more: the splitter buys $CROCARD and pays the pot in it, so the CRO balance of
 * that address is the gas it was deployed with — a real number, and the wrong
 * one to print under "IN THE POT".
 *
 * Null covers two different things and the page has to say them differently: the
 * pot is not deployed yet, or an RPC would not answer. Neither is zero. A pot
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
  const { seed, deck, moves } = (body ?? {}) as {
    seed?: unknown;
    deck?: unknown;
    moves?: unknown;
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

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  // The deck has to be a legal deck. What is NOT checked is whether it is
  // yours: a collection lives in the player's browser here, so there is nothing
  // on chain to read it against. That does not matter while the mint is shut —
  // with nothing to mint there is nothing to own — and it is the check that has
  // to arrive the moment either changes.
  const wrong = deckProblems(deck, INDEX);
  if (wrong.length > 0) {
    return Response.json({ error: wrong.join(" ") }, { status: 400 });
  }

  // The bot's deck comes from the seed and nothing else, which is what makes a
  // match replayable at all. Reproduced exactly as components/game/Game.tsx
  // builds it — a different offset or a different theme here would fail every
  // honest submission and tell nobody why.
  const theme = PRESET_DECKS[(seed as number) % PRESET_DECKS.length]!;

  let state;
  try {
    state = newMatch(CARDS, seed as number, {
      you: deck,
      opponent: buildDeckPreferring(CARDS, (seed as number) + 7919, theme.prefer),
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

  const now = Date.now();
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
  );

  return Response.json({ ok: true, best, mc: state.players.you.mc });
}
