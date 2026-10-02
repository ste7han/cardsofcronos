// What the project has actually done, in the handful of figures worth printing.
//
// Read on every request, from the chain and from our own tables, and never
// written down anywhere. A page that explains how the money works is the page
// most tempting to put a nice number on and forget — and this project already
// has eight card images showing figures the data has not had for months. A
// number that cannot go stale is the only kind worth publishing.
//
// ── WHERE EACH ONE COMES FROM, AND WHY NOT THE EASIER PLACE ──────────────────
//
// BURNED is summed from our own burns table, which records what the splitter
// sent. Not `balanceOf` at the dead address: 89 million $CROCARD was already
// sitting there before this project sent any, and quoting that would be claiming
// somebody else's fire.
//
// ALLOCATED is `promised()` — what the live merkle root owes holders in total.
// CLAIMED is `paidOut()`. The difference is what is sitting in the contract with
// somebody's name on it, which is the figure people actually want and the one
// that is easiest to leave out.
//
// WON is summed from tournament_paid, where every row carries the transaction
// that moved it.

import { db, env } from "@/lib/api";
import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD, LION } from "@/lib/revenue";

export const dynamic = "force-dynamic";

export interface Stats {
  minted: number | null;
  supply: number;
  burned: string | null;
  buybacks: number | null;
  /** Everything the live root owes holders, cumulative. */
  allocated: string | null;
  /** How much of that has been taken out. */
  claimed: string | null;
  won: { card: string; lion: string } | null;
}

export async function GET() {
  const rpcs = env().CRONOS_RPC ? [env().CRONOS_RPC!, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const call = async (to: string, data: string) =>
    BigInt(await rpc<string>(rpcs, "eth_call", [{ to, data }, "latest"]));

  // Each in its own try. One endpoint refusing one call should cost that figure
  // and not the page: a stats panel that goes blank because the prize pot was
  // slow reads as a project that has stopped.
  let minted: number | null = null;
  let supply = 5603;
  try {
    const nft = CONTRACTS.nft!;
    minted = Number(await call(nft, selector("nextTokenId()"))) - 1;
    supply = Number(await call(nft, selector("maxSupply()")));
  } catch {
    // The bar goes, the page stays.
  }

  let allocated: string | null = null;
  let claimed: string | null = null;
  try {
    const drop = CONTRACTS.drop!;
    allocated = (await call(drop, selector("promised()"))).toString();
    claimed = (await call(drop, selector("paidOut()"))).toString();
  } catch {
    // Both or neither: one without the other invites a subtraction that is wrong.
    allocated = null;
    claimed = null;
  }

  let burned: string | null = null;
  let buybacks: number | null = null;
  try {
    const { results } = await db()
      .prepare(`SELECT burned FROM burns`)
      .all<{ burned: string }>();
    // Summed here rather than by SQL: the column is wei held as TEXT, and SUM()
    // over TEXT coerces to a double and rounds in whichever direction the floats
    // happen to fall. See lib/store.ts, which says the same thing at length.
    burned = results.reduce((sum, row) => sum + BigInt(row.burned), 0n).toString();
    buybacks = results.length;
  } catch {
    burned = null;
  }

  let won: Stats["won"] = null;
  try {
    const { results } = await db()
      .prepare(`SELECT token, wei FROM tournament_paid`)
      .all<{ token: string; wei: string }>();
    const sum = (token: string) =>
      results
        .filter((row) => row.token.toLowerCase() === token.toLowerCase())
        .reduce((total, row) => total + BigInt(row.wei), 0n)
        .toString();
    won = { card: sum(CROCARD), lion: sum(LION) };
  } catch {
    won = null;
  }

  return Response.json({ minted, supply, burned, buybacks, allocated, claimed, won } satisfies Stats);
}
