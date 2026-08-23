// What is in the wallets, so nobody has to go and look it up.
//
// Public, cached for a minute at the edge. A balance a minute old is a balance;
// asking an RPC once per visitor is how you get rate-limited by lunchtime.

import { env } from "@/lib/api";
import { BALANCE_TTL, balances } from "@/lib/solana";
import { WALLETS } from "@/lib/revenue";

export const dynamic = "force-dynamic";

/**
 * A public endpoint that answers a Worker, unless something better is set.
 *
 * Not api.mainnet-beta.solana.com, which was the obvious choice and returns 403
 * here: it refuses datacenter traffic, and a Cloudflare Worker is datacenter
 * traffic. It answers a laptop perfectly, which is exactly why that was worth
 * finding out from the Worker's own logs rather than from a terminal.
 *
 * This one is free, needs no key, and is rate-limited in ways nobody publishes.
 * Survivable, because a refusal shows as "not known" rather than as a wrong
 * number, and because one cached call a minute is not much to ask. Set
 * SOLANA_RPC as a Worker secret to point at a paid provider — a paid URL carries
 * its key, so it is a secret and never a var.
 */
const PUBLIC_RPC = "https://solana-rpc.publicnode.com";

export async function GET() {
  const rpc = env().SOLANA_RPC ?? PUBLIC_RPC;

  const wallets = Object.values(WALLETS);
  const lamports = await balances(rpc, wallets.map((wallet) => wallet.address));

  return Response.json(
    {
      wallets: wallets.map((wallet, i) => ({
        id: wallet.id,
        address: wallet.address,
        what: wallet.what,
        lamports: lamports[i] ?? null,
      })),
      readAt: Date.now(),
    },
    {
      headers: {
        // Cached at the edge, not in the browser: everyone shares one answer per
        // minute, and a reload still gets whatever the edge has rather than
        // something stale from disk.
        "cache-control": `public, max-age=0, s-maxage=${BALANCE_TTL}`,
      },
    },
  );
}
