// Every address the money passes through, and what is sitting on it.
//
// Public, cached for a minute at the edge. A balance a minute old is a balance;
// asking an RPC once per visitor is how you get rate-limited by lunchtime.
//
// ── IT USED TO LIST THE WALLETS, AND THAT STOPPED BEING THE ANSWER ───────────
//
// `WALLETS` in lib/revenue.ts holds four: creator, deployer, marketing and
// tournament. Three of them have no address and no stream pays two of them at
// all — the creator wallet is kept in that file precisely to record that
// nothing pays it. Listing them here put three rows reading "not announced yet"
// on a page about where the money goes, which reads as a promise that money
// will one day go there.
//
// The tournament row was worse than noise: the prize pot has been a contract
// for as long as there has been one, so "no wallet yet" was not a gap, it was
// wrong.
//
// So this lists the places a share actually lands, resolved the same way the
// splits on the page are — through `receiverOf` — plus the splitter everything
// arrives at first and the key that owns all of it.
//
// ── THE UNIT IS PART OF THE ANSWER ───────────────────────────────────────────
//
// The splitter holds CRO, briefly, between arriving and being spent. The drop
// and the pot hold $CROCARD, because the splitter buys before it divides. The
// burn address holds $CROCARD nobody can move. Printing one number and calling
// it CRO for all of them would have been wrong for three rows out of five.

import { env } from "@/lib/api";
import { BALANCE_TTL, PUBLIC_RPCS, balances, tokenBalances } from "@/lib/cronos";
import { BURN_ADDRESS, CONTRACTS, CROCARD, WALLETS } from "@/lib/revenue";
import { checksum } from "@/lib/address";

export const dynamic = "force-dynamic";

interface Place {
  id: string;
  name: string;
  what: string;
  address: string | null;
  /** Which balance is worth showing here. */
  unit: "CRO" | "$CROCARD";
}

/** In the order the money moves, which is the order worth reading them in. */
const PLACES: Place[] = [
  {
    id: "splitter",
    name: "SPLITTER",
    what:
      "Everything the game earns arrives here and is bought into $CROCARD before it is divided. " +
      "Anybody can set it going; what it holds is what has not been spent yet.",
    address: CONTRACTS.splitter,
    unit: "CRO",
  },
  {
    id: "burn",
    name: "BURN ADDRESS",
    what: "Half of every split. Nobody holds its key, so nothing sent there comes back.",
    address: BURN_ADDRESS,
    unit: "$CROCARD",
  },
  {
    id: "drop",
    name: "HOLDER DROP",
    what: "Three tenths, waiting for the people holding $CROCARD to claim it.",
    address: CONTRACTS.drop,
    unit: "$CROCARD",
  },
  {
    id: "pot",
    name: "PRIZE POT",
    what: "A fifth, paid out weekly on high score. The one balance that is somebody else's.",
    address: CONTRACTS.pot,
    unit: "$CROCARD",
  },
  {
    id: "owner",
    name: "OWNER",
    what:
      "Deploys the contracts and owns them. It takes no share of anything — it is here because " +
      "it is the key that can reach every contract above, and that is worth being able to watch.",
    address: WALLETS.deployer.address,
    unit: "CRO",
  },
];

export async function GET() {
  // A secret first, then the free ones in order. Cronos' public endpoints go
  // down often enough that a single one is not a plan — the old dapp's holder
  // scan learned that the hard way and kept a list.
  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  const inCro = PLACES.filter((p) => p.unit === "CRO" && p.address !== null);
  const inToken = PLACES.filter((p) => p.unit === "$CROCARD" && p.address !== null);

  const [cro, token] = await Promise.all([
    balances(rpcs, inCro.map((p) => p.address!)),
    tokenBalances(rpcs, CROCARD, inToken.map((p) => p.address!)),
  ]);

  const found = new Map<string, bigint | null>();
  inCro.forEach((p, i) => found.set(p.id, cro[i] ?? null));
  inToken.forEach((p, i) => found.set(p.id, token[i] ?? null));

  return Response.json(
    {
      places: PLACES.map((place) => ({
        id: place.id,
        name: place.name,
        what: place.what,
        // Checksummed on the way out, so an address on screen can be checked by
        // eye against Cronoscan. Lowercase is the storage form, not the reading
        // form.
        address: place.address === null ? null : checksum(place.address),
        unit: place.unit,
        // A string: eighteen zeroes behind it and JSON numbers stop being exact
        // long before that.
        amount: (found.get(place.id) ?? null)?.toString() ?? null,
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
