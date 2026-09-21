// Reading and settling what two players put up on a ranked match.
//
// contracts/MatchEscrow.sol holds it. This is the server's half: it asks the
// chain what state a wager is in before letting a match move, and it names the
// winner when one is finished.
//
// ── NOTHING HERE TRUSTS THE BROWSER ──────────────────────────────────────────
//
// A client saying "I deposited" is a client saying anything it likes. Every
// answer below comes from an eth_call, and a match with a stake does not start
// until the chain says both deposits are in and are the right size. That is the
// whole reason this file exists rather than a flag on a row.
//
// ── THE MATCH ID IS THE WAGER ID ─────────────────────────────────────────────
//
// The escrow keys on a bytes32 that means nothing to it. This uses the match's
// own id, hashed, so there is exactly one wager per match and no table anywhere
// mapping one to the other — a mapping is a thing that can disagree.

import { LOG_RPCS, PUBLIC_RPCS, rpc, send } from "@/lib/cronos";
import { hexToBytes, normalise } from "@/lib/address";
import { addressOfKey, selector, topicOf, word } from "@/lib/evm-tx";
import { CONTRACTS } from "@/lib/revenue";

/** What the contract's State enum means, in the order it declares them. */
export type WagerState = "none" | "open" | "full" | "settled";
const STATES: WagerState[] = ["none", "open", "full", "settled"];

export interface Wager {
  opener: string;
  joiner: string;
  /** CRO per side, in wei. The pot is twice this. */
  stake: bigint;
  filledAt: number;
  state: WagerState;
  winner: string | null;
  paid: boolean;
}

/**
 * The wager id for a match. One per match, derived and never stored.
 *
 * keccak of the match id, so it is a bytes32 and so two matches cannot collide
 * by having ids that differ in a way the padding would lose.
 */
export function wagerId(matchId: string): string {
  // topicOf is keccak of a string, which is what this needs. Named for the
  // event topics it was written for; the hash is the same hash.
  return topicOf(matchId);
}

/** What the chain says about a match's wager, or null when there is no escrow. */
export async function wagerFor(
  matchId: string,
  secretRpc?: string | null,
): Promise<Wager | null> {
  const escrow = CONTRACTS.escrow;
  if (escrow === null) return null;

  const rpcs = secretRpc ? [secretRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const answer = await rpc<string>(rpcs, "eth_call", [
    { to: escrow, data: selector("wagerOf(bytes32)") + wagerId(matchId).slice(2) },
    "latest",
  ]);

  const at = (n: number): string => answer.slice(2).slice(n * 64, (n + 1) * 64);
  const address = (n: number): string => "0x" + at(n).slice(24);
  const number = (n: number): bigint => BigInt("0x" + at(n));

  const winner = address(5);
  return {
    opener: address(0),
    joiner: address(1),
    stake: number(2),
    filledAt: Number(number(3)) * 1000,
    state: STATES[Number(number(4))] ?? "none",
    winner: BigInt(winner) === 0n ? null : winner,
    paid: number(6) === 1n,
  };
}

/**
 * Whether a match may start: both deposits in, the right size, the right people.
 *
 * Every one of those is checked, and not only the state. A wager that is Full
 * with somebody else's addresses on it is not this match's wager, and a stake
 * that does not match what the lobby advertised is a lobby telling a different
 * story from the chain.
 *
 * Returns the reason it may not, or null.
 */
export function whyNotFunded(
  wager: Wager | null,
  want: { opener: string; joiner: string; stakeCro: number },
): string | null {
  if (wager === null) return "There is nowhere to hold a stake yet.";
  if (wager.state === "none") return "Nothing has been staked on this match.";
  if (wager.state === "open") return "Only one side has put its stake up.";
  if (wager.state === "settled") return "This match has already been settled.";

  const wei = BigInt(Math.round(want.stakeCro)) * 10n ** 18n;
  if (wager.stake !== wei) {
    return `The escrow holds ${wager.stake} wei a side and this match is for ${wei}.`;
  }

  // Either way round: whoever opened the seat in the lobby may not be whoever
  // opened it on chain, and the pair is what matters rather than the order.
  const onChain = [normalise(wager.opener), normalise(wager.joiner)].sort().join();
  const wanted = [normalise(want.opener), normalise(want.joiner)].sort().join();
  if (onChain !== wanted) return "The escrow is between two other addresses.";

  return null;
}

/**
 * Names the winner on chain. The publisher key, which may do nothing else.
 *
 * Returns the transaction hash, or the reason there is none. A settlement that
 * could not be sent is not an error to throw at whoever finished the match —
 * the result is already recorded, and the pot can be settled on the next pass.
 */
export async function settleMatch(
  matchId: string,
  winner: string,
  secrets: { publisherKey?: string; rpc?: string },
): Promise<{ tx: string | null; why?: string }> {
  const escrow = CONTRACTS.escrow;
  if (escrow === null) return { tx: null, why: "no escrow contract" };
  if (!secrets.publisherKey) return { tx: null, why: "no key to settle with" };

  const digits = secrets.publisherKey.replace(/^0x/, "");
  if (digits.length !== 64) return { tx: null, why: "PUBLISHER_KEY is not a private key" };

  const key = hexToBytes(secrets.publisherKey);
  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  // Asked before it is sent. A match with no wager is the ordinary case — most
  // matches are friendly — and attempting it would be a reverted transaction
  // and a log line that reads like a fault.
  const wager = await wagerFor(matchId, secrets.rpc);
  if (wager === null || wager.state !== "full") {
    return { tx: null, why: `nothing to settle: the wager is ${wager?.state ?? "missing"}` };
  }

  return {
    tx: await send(
      rpcs,
      key,
      escrow,
      selector("settle(bytes32,address)") + wagerId(matchId).slice(2) + word(winner),
    ),
  };
}

/** Which wallet the settling key belongs to, or null. Never the key itself. */
export function settlerOf(publisherKey: string | undefined): string | null {
  if (!publisherKey) return null;
  try {
    return addressOfKey(hexToBytes(publisherKey));
  } catch {
    return null;
  }
}

/** The calldata a browser sends to put a stake up, or to match one. */
export function openData(matchId: string): string {
  return selector("open(bytes32)") + wagerId(matchId).slice(2);
}

export function joinData(matchId: string): string {
  return selector("join(bytes32)") + wagerId(matchId).slice(2);
}

/** And to take back a stake from a seat nobody sat down at. */
export function cancelData(matchId: string): string {
  return selector("cancel(bytes32)") + wagerId(matchId).slice(2);
}

/** And to take a settled pot. Anybody may send it; it pays the winner. */
export function claimData(matchId: string): string {
  return selector("claim(bytes32)") + wagerId(matchId).slice(2);
}

/** CRO as wei, for a whole-CRO stake. The lobby only ever deals in whole ones. */
export function stakeWei(cro: number): bigint {
  return BigInt(Math.round(cro)) * 10n ** 18n;
}

void LOG_RPCS;
