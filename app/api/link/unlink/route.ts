// Detaching an account.
//
// Allowed, and deliberately so: an account somebody cannot get back is an
// account they will not attach in the first place. The unique index means the
// account is then free for another wallet, which is the honest consequence —
// what stops farming is that one account cannot be in two places at once, not
// that it can never move.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { LINKABLE, type Network } from "@/lib/links";
import { unlinkAccount } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const network = (body as { network?: string } | null)?.network;

  // An unknown network fails here rather than deleting nothing and reporting
  // success, which is the shape of failure this project keeps trying to avoid.
  if (typeof network !== "string" || !(network in LINKABLE)) {
    return Response.json({ error: `Unknown network: ${String(network)}` }, { status: 400 });
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  await unlinkAccount(db(), wallet, network as Network);
  return Response.json({ ok: true });
}
