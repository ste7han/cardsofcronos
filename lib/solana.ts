// Reading balances off the chain.
//
// Server-side, and deliberately. A browser could ask an RPC directly, but then
// the endpoint is in the page — and the day this needs a paid one, its key would
// be in the page with it. CLAUDE.md has one rule about keys and it has no
// exceptions, so the request is made where a secret can exist.
//
// One call for every wallet. getMultipleAccounts takes a list, so four balances
// cost one round trip rather than four, and the answer is cached at the edge —
// a balance that is a minute old is a balance, and hitting an RPC once per
// visitor is how you get rate-limited by lunchtime.

/** How long an answer is good for. A minute is fresh enough to be true. */
export const BALANCE_TTL = 60;

interface AccountValue {
  lamports?: number;
}

/**
 * Lamports per address, in the order asked for.
 *
 * `null` where the answer is not known — a wallet that has never been funded
 * comes back as a real zero, and an RPC that would not answer comes back as
 * null. Those are different facts and the page says them differently: nobody
 * should read "0 SOL" because a request timed out.
 */
export async function balances(
  rpc: string,
  addresses: readonly string[],
): Promise<(number | null)[]> {
  if (addresses.length === 0) return [];

  let body: { result?: { value?: (AccountValue | null)[] }; error?: { message?: string } };
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getMultipleAccounts",
        params: [addresses, { commitment: "confirmed" }],
      }),
    });
    if (!response.ok) throw new Error(`RPC answered ${response.status}`);
    body = (await response.json()) as typeof body;
  } catch (error) {
    // Every address unknown rather than a partial answer nobody can interpret.
    console.error("Could not read balances:", error);
    return addresses.map(() => null);
  }

  if (body.error) {
    console.error("RPC refused:", body.error.message);
    return addresses.map(() => null);
  }

  const values = body.result?.value;
  if (!Array.isArray(values) || values.length !== addresses.length) {
    // A shorter list than asked for would silently shift every balance onto the
    // wrong wallet, which is worse than showing none of them.
    console.error("RPC returned a list of a different length than it was asked for.");
    return addresses.map(() => null);
  }

  // An account that does not exist yet is null on Solana and zero in fact: a
  // wallet nobody has ever sent anything to holds nothing.
  return values.map((value) => (value === null ? 0 : (value.lamports ?? 0)));
}
