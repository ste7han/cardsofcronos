// Remembering who is about to press Telegram's button.
//
// Telegram's widget goes straight to our callback with no way to carry anything
// of ours along, so the wallet has to be waiting when it arrives. This sets the
// same pending cookie the X flow uses, and for the same reason it holds the
// proof rather than the address: a cookie with a bare address could be edited to
// somebody else's, and an account would then attach to a wallet its owner never
// touched.
//
// No state and no PKCE here, and neither is missing. There is no code to
// exchange — the payload Telegram sends is signed with the bot token, and that
// signature is the whole proof.

import { signedInWallet, UNAUTHORISED } from "@/lib/api";
import { LINK_COOKIE, sealPending } from "@/lib/link-cookie";
import { newState } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const proof = (body as { proof?: unknown } | null)?.proof;

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const response = Response.json({ ok: true });
  response.headers.append(
    "set-cookie",
    sealPending(
      LINK_COOKIE,
      { proof, state: newState(), verifier: "" },
      new URL(request.url).protocol === "https:",
    ),
  );
  return response;
}
