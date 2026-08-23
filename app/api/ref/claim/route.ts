// Saying who brought you.
//
// Every outcome is ordinary and each one is named: claimed, already referred,
// your own code, or a code that is not one. None of these is a fault, and a
// single "that did not work" would leave somebody retyping a code that was fine.
//
// Claiming counts for nothing on its own. It becomes worth something when the
// person referred has linked an X account and finished a match — wallets are
// free, so neither the wallet nor the claim can be the bar.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { claimReferral } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return Response.json({ error: "Which code?" }, { status: 400 });
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const outcome = await claimReferral(db(), wallet, code.trim(), Date.now());
  return Response.json({ outcome });
}
