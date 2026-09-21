"use client";

// Talking to the lobby.
//
// One place, because every one of these calls carries a wallet proof and doing
// that by hand at eight call sites is seven chances to forget. A request without
// one comes back 401, which is correct and unhelpful — the failure to design
// against is the one where somebody adds a ninth call and it silently works
// while signed out because the route was the one that did not check.

import { proofOf } from "@/lib/session";

export class NotSignedIn extends Error {
  constructor() {
    super("Sign in with a wallet first.");
  }
}

export async function ask<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const proof = proofOf();
  if (proof === null) throw new NotSignedIn();

  const response = await fetch(`/api/pvp/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, proof }),
  });

  const answer = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    // The server's sentence, not a status code. Those messages are written to be
    // read by a player and are the only explanation that knows what happened.
    throw new Error(answer?.error ?? `The server said no (${response.status}).`);
  }
  return answer as T;
}

export interface LobbyListing {
  id: string;
  mode: "live" | "correspondence";
  stake: number;
  rank: number;
  createdAt: number;
  expiresAt: number;
  mine: boolean;
  /**
   * Whether the opener's stake is actually in the escrow.
   *
   * Always true for a friendly offer. False on a staked one means "not yet":
   * posting the offer and signing the deposit are two steps, and the second
   * happens in a wallet. Read off the chain by /api/pvp/lobby.
   */
  funded: boolean;
}

export interface MatchSummary {
  id: string;
  mode: "live" | "correspondence";
  stake: number;
  opponent: string;
  turn: number;
  yourTurn: boolean;
  finished: boolean;
  won: boolean | null;
  drawn: boolean;
  yourMC: number;
  theirMC: number;
  deadline: number;
  createdAt: number;
}
