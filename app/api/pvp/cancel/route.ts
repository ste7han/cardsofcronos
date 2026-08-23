// Take your own offer back down.
//
// Scoped to the wallet in the SQL rather than checked here first: a DELETE that
// names both the listing and its owner cannot remove somebody else's, whatever
// the caller sends.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { cancelListing } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "string") return Response.json({ error: "Which offer?" }, { status: 400 });

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  await cancelListing(db(), id, wallet);
  return Response.json({ ok: true });
}
