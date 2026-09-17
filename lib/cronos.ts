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

import {
  CRONOS_CHAIN_ID,
  addressOfKey,
  signTransaction,
} from "@/lib/evm-tx";

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
  return ask(
    rpcs,
    addresses.map((address) => ({ method: "eth_getBalance", params: [address, "latest"] })),
  );
}

/** The four bytes of `balanceOf(address)`. */
const BALANCE_OF = "0x70a08231";

/**
 * How much of one ERC20 each address holds, in the same shape as `balances`.
 *
 * Needed because the money stopped being CRO. The splitter buys $CROCARD and
 * pays every share in it, so the prize pot and the drop hold a token balance and
 * not a wallet balance — `eth_getBalance` on either reads the gas they were sent
 * to deploy with, which is a real number and the wrong one.
 *
 * Same null rule: an address holding nothing answers zero, and an endpoint that
 * would not answer is null. A pot reading empty because a request timed out is
 * the number that makes somebody stop playing.
 */
export async function tokenBalances(
  rpcs: readonly string[],
  token: string,
  addresses: readonly string[],
): Promise<(bigint | null)[]> {
  return ask(
    rpcs,
    addresses.map((address) => ({
      method: "eth_call",
      params: [
        { to: token, data: BALANCE_OF + address.replace(/^0x/, "").toLowerCase().padStart(64, "0") },
        "latest",
      ],
    })),
  );
}

/** A JSON-RPC call with its id still to be assigned. */
interface Call {
  method: string;
  params: unknown[];
}

/**
 * One batch, tried against each endpoint until one answers.
 *
 * The method is a parameter because reading a token balance and reading a wallet
 * balance differ in nothing else: same batch, same ordering trap, same fallback.
 * Two copies would be two places to fix the next time an endpoint misbehaves.
 */
async function ask(rpcs: readonly string[], calls: readonly Call[]): Promise<(bigint | null)[]> {
  if (calls.length === 0) return [];

  for (const rpc of rpcs) {
    const answer = await askOne(rpc, calls);
    if (answer !== null) return answer;
  }
  // Every call unknown rather than a partial answer nobody can interpret.
  return calls.map(() => null);
}

/** One endpoint's attempt. Null means "this one did not answer" — try the next. */
async function askOne(rpc: string, calls: readonly Call[]): Promise<(bigint | null)[] | null> {
  const batch = calls.map((call, i) => ({ jsonrpc: "2.0", id: i, ...call }));

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
  if (byId.size !== calls.length) {
    console.error(`Cronos RPC ${rpc} answered ${byId.size} of ${calls.length} calls.`);
    return null;
  }

  return calls.map((_, i) => {
    const entry = byId.get(i);
    if (!entry || entry.error || typeof entry.result !== "string") return null;
    // "0x" is what a call to an address with no code returns. Reading it as zero
    // would print an empty pot for a contract that is not there at all.
    if (entry.result === "0x") return null;
    try {
      return BigInt(entry.result);
    } catch {
      return null;
    }
  });
}

export async function rpc<T = string>(
  rpcs: readonly string[],
  method: string,
  params: unknown[],
): Promise<T> {
  let last = "no endpoint answered";
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const found = (await answer.json()) as { result?: unknown; error?: { message?: string } };
      if (found.error) {
        // A revert is the chain's answer, not a broken endpoint: trying the next
        // RPC would get the same answer and hide it behind a timeout.
        throw new Error(found.error.message ?? "the call was rejected");
      }
      // Present rather than truthy. A receipt for a transaction nobody has mined
      // yet is a real answer of null, and a log scan that found nothing is a
      // real answer of []: treating either as "this endpoint is broken" would
      // walk the whole list and then report a timeout for a working chain.
      if ("result" in found) return found.result as T;
      last = "an endpoint answered with nothing";
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (/revert|rejected|insufficient|nonce/i.test(last)) throw error;
    }
  }
  throw new Error(last);
}

/**
 * Signs one call to a contract and sends it. Returns the transaction hash.
 *
 * It lived in lib/publisher.ts while the weekly prize was the only thing that
 * ever signed anything. The daily job signs too — `release()` on the splitter —
 * and two copies of a transaction signer is two places to get a chain id or a
 * gas bump wrong. One of them would be found by somebody else.
 */
export async function send(
  rpcs: readonly string[],
  key: Uint8Array,
  to: string,
  data: string,
): Promise<string> {
  const from = addressOfKey(key);
  const [nonceHex, gasPriceHex] = await Promise.all([
    rpc(rpcs, "eth_getTransactionCount", [from, "pending"]),
    rpc(rpcs, "eth_gasPrice", []),
  ]);

  // Estimated rather than guessed, and estimating is also the cheapest way to
  // find out that the call would revert — which is how "the week is already
  // closed" is discovered without paying for it.
  const gasHex = await rpc(rpcs, "eth_estimateGas", [{ from, to, data }]);

  const raw = signTransaction(
    {
      nonce: BigInt(nonceHex),
      gasPrice: (BigInt(gasPriceHex) * 12n) / 10n,
      // A fifth over the estimate. An estimate that is exactly right fails on a
      // block where anything about the state moved.
      gasLimit: (BigInt(gasHex) * 12n) / 10n,
      to,
      value: 0n,
      data,
      chainId: CRONOS_CHAIN_ID,
    },
    key,
  );
  return rpc(rpcs, "eth_sendRawTransaction", [raw]);
}
