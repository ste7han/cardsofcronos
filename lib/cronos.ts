// Reading balances off Cronos.
//
// Server-side, and deliberately. A browser could ask an RPC directly, but then
// the endpoint is in the page — and the day this needs a paid one, its key would
// be in the page with it. CLAUDE.md has one rule about keys and it has no
// exceptions, so the request is made where a secret can exist.
//
// One round trip for every wallet. There is no getMultipleAccounts here the way
// there is on Solana, but JSON-RPC has batching: a list of calls goes out as one
// array and comes back as one array, so four balances cost one request. The
// answer is cached at the edge — a balance that is a minute old is a balance,
// and hitting an RPC once per visitor is how you get rate-limited by lunchtime.
//
// The endpoints are tried in order. That pattern is lifted from the old dapp's
// holder scan, which needed it: Cronos' public RPCs go down often enough that a
// single one is not a plan.

/** How long an answer is good for. A minute is fresh enough to be true. */
export const BALANCE_TTL = 60;

/**
 * Public endpoints, tried in order, and none of them carrying a key.
 *
 * A paid provider's URL contains its key, which makes the URL a secret — set
 * CRONOS_RPC as a Worker secret and it is used ahead of all of these.
 */
export const PUBLIC_RPCS: readonly string[] = [
  "https://evm.cronos.org",
  "https://cronos-evm-rpc.publicnode.com",
  "https://cronos.drpc.org",
];

interface RpcResponse {
  id?: unknown;
  result?: unknown;
  error?: { message?: string };
}

/**
 * Wei per address, in the order asked for.
 *
 * `null` where the answer is not known — a wallet that has never been funded
 * comes back as a real zero, and an RPC that would not answer comes back as
 * null. Those are different facts and the page says them differently: nobody
 * should read "0 CRO" because a request timed out.
 *
 * Bigint and not number. A balance is wei, eighteen zeroes behind it, and a
 * double stops counting exactly somewhere around four CRO.
 */
export async function balances(
  rpcs: readonly string[],
  addresses: readonly string[],
): Promise<(bigint | null)[]> {
  if (addresses.length === 0) return [];

  for (const rpc of rpcs) {
    const answer = await askOne(rpc, addresses);
    if (answer !== null) return answer;
  }
  // Every address unknown rather than a partial answer nobody can interpret.
  return addresses.map(() => null);
}

/** One endpoint's attempt. Null means "this one did not answer" — try the next. */
async function askOne(
  rpc: string,
  addresses: readonly string[],
): Promise<(bigint | null)[] | null> {
  const batch = addresses.map((address, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "eth_getBalance",
    params: [address, "latest"],
  }));

  let body: RpcResponse[];
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw new Error(`answered ${response.status}`);
    const parsed: unknown = await response.json();
    if (!Array.isArray(parsed)) {
      // Some endpoints refuse batching and reply with a single object. That is a
      // reason to use the next one, not a reason to guess.
      throw new Error("did not return a batch");
    }
    body = parsed as RpcResponse[];
  } catch (error) {
    console.error(`Cronos RPC ${rpc} failed:`, error);
    return null;
  }

  // Matched by id and not by position. JSON-RPC does not promise a batch comes
  // back in the order it went out, and a shifted list would put one wallet's
  // balance under another wallet's name — which is worse than showing none.
  const byId = new Map<number, RpcResponse>();
  for (const entry of body) {
    if (typeof entry.id === "number") byId.set(entry.id, entry);
  }
  if (byId.size !== addresses.length) {
    console.error(`Cronos RPC ${rpc} answered ${byId.size} of ${addresses.length} calls.`);
    return null;
  }

  return addresses.map((_, i) => {
    const entry = byId.get(i);
    if (!entry || entry.error || typeof entry.result !== "string") return null;
    try {
      return BigInt(entry.result);
    } catch {
      return null;
    }
  });
}
