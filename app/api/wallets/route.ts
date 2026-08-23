// What is in the wallets, so nobody has to go and look it up.
//
// Public, cached for a minute at the edge. A balance a minute old is a balance;
// asking an RPC once per visitor is how you get rate-limited by lunchtime.

import { env } from "@/lib/api";
import { BALANCE_TTL, PUBLIC_RPCS, balances } from "@/lib/cronos";
import { WALLETS } from "@/lib/revenue";
import { checksum } from "@/lib/address";

export const dynamic = "force-dynamic";

export async function GET() {
  // A secret first, then the free ones in order. Cronos' public endpoints go
  // down often enough that a single one is not a plan — the old dapp's holder
  // scan learned that the hard way and kept a list.
  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  const wallets = Object.values(WALLETS);
  // Only the ones that have an address. The others are not zero and not a
  // failed lookup — nobody has said what they are yet, and the page says so.
  const known = wallets.filter((wallet) => wallet.address !== null);
  const wei = await balances(rpcs, known.map((wallet) => wallet.address!));
  const found = new Map(known.map((wallet, i) => [wallet.id, wei[i] ?? null]));

  return Response.json(
    {
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        // Checksummed on the way out, so an address on screen can be checked by
        // eye against Cronoscan. Lowercase is the storage form, not the reading
        // form.
        address: wallet.address === null ? null : checksum(wallet.address),
        what: wallet.what,
        // A string: wei has eighteen zeroes behind it and JSON numbers stop
        // being exact long before that.
        wei: (found.get(wallet.id) ?? null)?.toString() ?? null,
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
