// The burn, for anybody. No wallet needed.
//
// Public on purpose: a burn total is a claim about the token, and a claim only
// anybody logged in can read is not much of one.

import { db } from "@/lib/api";
import { burnTotal, burns } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [total, recent] = await Promise.all([burnTotal(db()), burns(db(), 25)]);
  return Response.json({ total, burns: recent });
}
