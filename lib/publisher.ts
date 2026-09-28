// Closing a week and paying its winners, without anybody being awake.
//
// Runs on a schedule. What it does is narrow on purpose:
//
//   1. work out which week has just ended
//   2. read every board's winner out of our own table, by the same rule each
//      board ranks by
//   3. tell PrizePot who won, ALL THE BOARDS IN ONE CALL, with the publisher key
//   4. push each prize to its winner
//   5. write down what was paid, so /tournament can show it
//
// Step three is one call and not one per board, and that is the whole reason
// closeWeek takes arrays. Closing them separately would make the order decide
// the money: a board on a quarter, closed second, takes a quarter of what the
// first one left. See contracts/PrizePot.sol.
//
// Step three is the only one that needs a key, and that key may name a winner
// and nothing else — see contracts/PrizePot.sol. Step four needs no permission
// at all: `claim` pays the winner rather than the caller, so this is only
// spending gas on somebody else's behalf.
//
// ── IT IS SAFE TO RUN TWICE ──────────────────────────────────────────────────
//
// Everything here is idempotent because the contract makes it so: closing a week
// that is closed reverts, paying one that is paid reverts. So a cron that fires
// twice, a retry after a timeout, or a hand-run while the schedule is also
// running all end in the same place. That is deliberate — the alternative is
// this file tracking what it has done, and a second source of truth about who
// has been paid is the last thing this wants.

import { PUBLIC_RPCS, mined, rpc, send } from "@/lib/cronos";
import { CONTRACTS, CROCARD } from "@/lib/revenue";
import { selector, word } from "@/lib/evm-tx";
import { hexToBytes } from "@/lib/address";
import type { Database } from "@/lib/store";
import { recordPayout, weekOf, winnerOf, type Score } from "@/lib/tournament";
import { BOARDS } from "@/data/boards";

/** What one board's close and payout did. */
export interface BoardResult {
  board: string;
  winner: string;
  /** The claim transaction, or null when it did not happen. */
  paid: string | null;
  /** What the contract allocated, in base units, read before it was claimed. */
  amount: string | null;
  why?: string;
  skipped?: string;
}

/** What a run did, in enough detail to read in a log a week later. */
export interface Ran {
  week: string;
  /** The one transaction that closed every board. Null when none did. */
  closed?: string | null;
  /** One entry per board somebody won. Empty is not a failure. */
  boards: BoardResult[];
  /** Why nothing happened, when nothing did. */
  skipped?: string;
}

/** The week that has just ended, given a moment inside the new one. */
export function lastWeek(now: number): string {
  return weekOf(now - 7 * 86_400_000);
}

/**
 * Text as the bytes32 the contract keys weeks and boards by.
 *
 * ASCII right-padded rather than hashed, so "2026-W38" and "lions" are readable
 * in a transaction on an explorer instead of being a digest somebody has to take
 * on trust.
 */
export function asWord(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 32) throw new Error(`A label must fit in a word: ${text}`);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex.padEnd(64, "0");
}

/** Kept under its old name, because that is what it is used for. */
export const weekWord = asWord;

/**
 * `closeWeek(bytes32,bytes32[],address[])`, encoded by hand.
 *
 * Two dynamic arrays, which is the fiddly part: the arguments in the head are
 * the week and then two OFFSETS to where each array lives, and each array is its
 * length followed by its elements. The second offset depends on how long the
 * first array is, which is the sum that a test pins rather than trusts.
 */
export function closeWeekData(
  week: string,
  boards: readonly string[],
  winners: readonly string[],
): string {
  const head = 3 * 32;
  const boardsAt = head;
  const winnersAt = head + 32 + boards.length * 32;
  return (
    selector("closeWeek(bytes32,bytes32[],address[])") +
    asWord(week) +
    word(BigInt(boardsAt)) +
    word(BigInt(winnersAt)) +
    word(BigInt(boards.length)) +
    boards.map((board) => asWord(board)).join("") +
    word(BigInt(winners.length)) +
    winners.map((winner) => word(winner)).join("")
  );
}

/**
 * Closes the week that has just ended and pays every board's winner.
 *
 * Returns what it did rather than throwing on the ordinary nothing-to-do cases,
 * because a scheduled job that errors on "nobody played last week" is a
 * scheduled job whose alerts get muted, and a muted alert is worse than none.
 */
export async function runWeekly(
  db: Database,
  secrets: { publisherKey?: string; rpc?: string },
  now: number,
): Promise<Ran> {
  const week = lastWeek(now);
  const pot = CONTRACTS.pot;
  const nothing: Ran = { week, boards: [] };

  if (pot === null) return { ...nothing, skipped: "no pot contract yet" };
  if (!secrets.publisherKey) return { ...nothing, skipped: "no publisher key set" };

  // Every board that somebody actually won. A board nobody beat is left out of
  // the call entirely, and its share of the pot stays where it is and grows —
  // which is the contract's behaviour and not something this has to arrange.
  const won: { board: string; winner: Score }[] = [];
  for (const board of BOARDS) {
    const best = await winnerOf(db, week, board.id);
    if (best !== null) won.push({ board: board.id, winner: best });
  }
  if (won.length === 0) {
    // The pot rolls into next week by doing nothing, which is the whole of the
    // behaviour and needs no code.
    return { ...nothing, skipped: "nobody won any board that week" };
  }

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const key = hexToBytes(secrets.publisherKey);

  // ── ASKED, NOT INFERRED FROM A REVERT ──────────────────────────────────────
  //
  // This used to send `closeWeek` and decide what had happened by matching the
  // error text against /WeekAlreadyClosed|already/. Cronos does not put the name
  // of a custom error in the message: what comes back for every revert is the
  // two words "execution reverted". So the one case the match existed for never
  // matched, and a week that was already closed — the normal state on every run
  // after the first — was treated as a fatal error and returned before anything
  // could be claimed. Week 2026-W39 was closed, both prizes were allocated, and
  // the job then gave up on it once a minute for hours.
  //
  // It is the oldest failure in this project written a new way: a name the code
  // does not recognise falling through to the wrong branch, with a log line that
  // reads like it knew what it was doing. So nothing is inferred from a revert
  // any more. The contract is asked what it holds, and the answer decides.
  const standing = await Promise.all(
    won.map((one) =>
      rpc<string>(rpcs, "eth_call", [
        { to: pot, data: selector("prizes(bytes32,bytes32)") + asWord(week) + asWord(one.board) },
        "latest",
      ]),
    ),
  );
  const openBoards = won.filter((_, i) => {
    const winner = standing[i]!.replace(/^0x/, "").slice(24, 64);
    return BigInt("0x" + winner) === 0n;
  });

  let closed: string | null = null;
  if (openBoards.length > 0) {
    try {
      closed = await send(
        rpcs,
        key,
        pot,
        closeWeekData(
          week,
          openBoards.map((one) => one.board),
          openBoards.map((one) => one.winner.wallet),
        ),
      );
    } catch (error) {
      const said = error instanceof Error ? error.message : String(error);
      return { ...nothing, boards: won.map((one) => ({ ...blank(one), skipped: said })), skipped: said };
    }
  }

  // ── AND WAITED FOR, BEFORE ANYTHING IS CLAIMED ─────────────────────────────
  //
  // Claiming a prize the chain has not allocated yet reverts with NoSuchWeek,
  // and `send` finds that out while estimating gas — so the claim is never sent
  // and the board comes back skipped. It happened on the first run that ever
  // closed a week: both prizes were allocated seconds later and neither was
  // paid, because the claims had already been attempted and given up.
  //
  // Not fatal if it times out. The prizes are allocated either way and the next
  // run claims them; what must not happen is claiming before that is true.
  if (closed !== null && !(await mined(rpcs, closed))) {
    return {
      week,
      closed,
      boards: won.map((one) => ({
        ...blank(one),
        skipped: `closeWeek ${closed} has not been mined yet; the prizes are allocated and the next run claims them`,
      })),
      skipped: "the week was closed but not yet mined, so nothing was claimed",
    };
  }

  const boards: BoardResult[] = [];
  for (const one of won) {
    boards.push(await payOne(db, rpcs, key, pot, week, one.board, one.winner, now, CROCARD));
  }

  // ── A BOARD WITH ITS OWN POT IS CLOSED TWICE ───────────────────────────────
  //
  // Loaded Lions pays out of two: its share of the weekly $CROCARD above, and
  // the $LION that entries bought. Two PrizePots, because the token is
  // immutable in that contract — deliberately, so a pot pays one thing for its
  // whole life — and the same week, board and winner go to each.
  //
  // Its own loop and after the first, so a second pot that will not close
  // cannot cost anybody the prize they have already been allocated on the
  // first. Everything here is per board and reported rather than thrown.
  for (const one of won) {
    const board = BOARDS.find((b) => b.id === one.board);
    const extra = board?.alsoPays?.contract ?? null;
    if (extra === null) continue;

    const pays = board?.alsoPays?.symbol ?? "its own pot";

    // Asked first here too. A revert on this chain says "execution reverted" and
    // nothing more, so "is this week already closed" and "is this pot empty" are
    // read off the contract rather than guessed at from a message that does not
    // carry the answer.
    const already = await rpc<string>(rpcs, "eth_call", [
      { to: extra, data: selector("prizes(bytes32,bytes32)") + asWord(week) + asWord(one.board) },
      "latest",
    ]);
    const shutAlready = BigInt("0x" + already.replace(/^0x/, "").slice(24, 64)) !== 0n;

    let shut: string | null = null;
    if (!shutAlready) {
      // What a close would allocate, worked out the way the contract does: this
      // board's share of what is in the pot and not already spoken for. Zero
      // means an empty pot, which is not a failure — this one fills up as people
      // pay to play, so a quiet week leaves nothing to award. Counted as settled
      // rather than retried, because a week held open for a prize that does not
      // exist is a week retried for ever.
      const holds = BigInt(
        await rpc<string>(rpcs, "eth_call", [
          { to: board!.alsoPays!.token, data: selector("balanceOf(address)") + word(extra) },
          "latest",
        ]),
      );
      const spoken = BigInt(
        await rpc<string>(rpcs, "eth_call", [{ to: extra, data: selector("allocated()") }, "latest"]),
      );
      if (holds <= spoken) {
        boards.push({
          board: one.board,
          winner: one.winner.wallet,
          paid: null,
          amount: "0",
          why: `the ${pays} pot was empty this week, so there was nothing to award`,
        });
        continue;
      }

      try {
        shut = await send(rpcs, key, extra, closeWeekData(week, [one.board], [one.winner.wallet]));
      } catch (error) {
        const said = error instanceof Error ? error.message : String(error);
        boards.push({ board: one.board, winner: one.winner.wallet, paid: null, amount: null, skipped: said });
        continue;
      }
    }

    // The same wait as the first pot, and for the same reason: claiming a prize
    // the chain has not allocated yet reverts, and `send` finds that out while
    // estimating. This loop was missed when the first one was fixed, which is
    // how the $LION half of a Loaded Lions week went unpaid while the $CROCARD
    // half went out — two pots, one bug, and only one of them repaired.
    if (shut !== null && !(await mined(rpcs, shut))) {
      boards.push({
        board: one.board,
        winner: one.winner.wallet,
        paid: null,
        amount: null,
        skipped: `the ${pays} week was closed in ${shut} but is not mined yet; the next run claims it`,
      });
      continue;
    }

    boards.push({
      ...(await payOne(db, rpcs, key, extra, week, one.board, one.winner, now, board!.alsoPays!.token)),
      why: `paid out of the ${pays} pot`,
    });
  }

  return { week, closed, boards };
}

/** What one board's payout did. */
function blank(one: { board: string; winner: Score }): BoardResult {
  return { board: one.board, winner: one.winner.wallet, paid: null, amount: null };
}

/**
 * Reads what a board was allocated, pays it, and writes it down.
 *
 * Separate from the close because the close is one transaction for everybody and
 * this is one per winner. A board that fails here does not stop the others: they
 * have already been allocated on chain and the money is theirs whether or not
 * this job manages to push it.
 */
async function payOne(
  db: Database,
  rpcs: readonly string[],
  key: Uint8Array,
  pot: string,
  week: string,
  board: string,
  winner: Score,
  now: number,
  /** What this pot pays in. Part of the key a payout is written under. */
  token: string,
): Promise<BoardResult> {
  const result: BoardResult = { board, winner: winner.wallet, paid: null, amount: null };

  // Read before claiming, because claiming zeroes it. `prizes(bytes32,bytes32)`
  // returns the winner, the amount and whether it has been paid; the amount is
  // the second word. Without this the payout happens and the board says NOT PAID
  // YET forever, which is the row somebody checks first.
  // The same reading answers both questions: how much, and whether it has
  // already gone out. Asked rather than inferred from a revert, for the reason
  // written out at the top of runWeekly — this chain's reverts are the words
  // "execution reverted" and nothing else, so matching on AlreadyPaid never
  // matched and a prize that was already claimed looked like a broken run.
  let alreadyPaid = false;
  try {
    const prize = await rpc<string>(rpcs, "eth_call", [
      {
        to: pot,
        data: selector("prizes(bytes32,bytes32)") + asWord(week) + asWord(board),
      },
      "latest",
    ]);
    const words = prize.replace(/^0x/, "");
    result.amount = BigInt("0x" + words.slice(64, 128)).toString();
    alreadyPaid = BigInt("0x" + words.slice(128, 192)) === 1n;
  } catch {
    // Not fatal. Paying the winner matters more than recording how much, and a
    // run that stopped here would leave them unpaid to protect a table.
  }

  if (alreadyPaid) {
    // Nothing owed and nothing wrong. Said out loud so a run that does this
    // every week reads as settled rather than as silence.
    return { ...result, why: "the prize had already been claimed" };
  }

  try {
    result.paid = await send(
      rpcs,
      key,
      pot,
      selector("claim(bytes32,bytes32)") + asWord(week) + asWord(board),
    );
  } catch (error) {
    return { ...result, skipped: error instanceof Error ? error.message : String(error) };
  }

  if (result.paid !== null && result.amount !== null) {
    try {
      await recordPayout(db, {
        week,
        board,
        wallet: winner.wallet,
        wei: result.amount,
        txHash: result.paid,
        at: now,
        token,
      });
    } catch (error) {
      // Week, board and token are the primary key, so a second run throws here
      // rather than writing a second row. That is the table working and not a
      // failure: the money moved once and it is written down once.
      //
      // The token is in that key because Loaded Lions is paid twice for one
      // week, in two tokens, out of two pots. Without it the second payout
      // collided with the first and was swallowed by this very catch.
      //
      // Anything else is a failure and is said out loud. It cannot be raised —
      // the winner has already been paid by this point and throwing would make
      // the next run try to pay them again — so it goes to the log, which is
      // where a scheduled job's problems have to be visible from.
      const said = error instanceof Error ? error.message : String(error);
      if (!/UNIQUE|constraint|PRIMARY/i.test(said)) {
        console.error(`[weekly] ${week}/${board} was paid in ${result.paid} but not recorded: ${said}`);
      }
    }
  }

  return result;
}
