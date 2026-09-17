// Who holds $CROCARD, and what each of them is owed.
//
//   npx tsx scripts/holder-drop.ts <round> <wei>            writes data/holder-drop.json
//   npx tsx scripts/holder-drop.ts 7 1000000000000000000    one round, one CRO
//
// Half of every mint, royalty and ranked match goes back to the people holding
// the token. Paying thousands of wallets by transfer costs more gas than the
// small shares are worth, so the round is published as a merkle root and each
// holder's share is proved when it is taken — see contracts/HolderDrop.sol.
//
// ── HOW HOLDERS ARE FOUND ────────────────────────────────────────────────────
//
// By replaying every Transfer the token has ever emitted. An ERC20 has no list
// of its holders; the balances are a mapping, and a mapping cannot be read
// without knowing the keys. So the keys come from the logs, and the balances are
// rebuilt by adding up what moved.
//
// That is slow and it is the only honest way. Asking an indexer would be faster
// and would make this file's answer depend on somebody else's uptime and
// somebody else's definition of a holder — for a number that decides who gets
// paid.
//
// ── WHAT IS LEFT OUT ─────────────────────────────────────────────────────────
//
// Anything that is not a person. The burn address and the zero address, because
// tokens sent there are gone by definition and paying them is paying nobody
// forever out of everybody else's share. This project's own contracts, because
// they would be paying themselves. And ANY ADDRESS WITH CODE ON IT.
//
// That last one is the rule and the rest is the list, and it is this way round
// because of one address: the EbisusBay CROCARD/WCRO pool holds 399 million —
// thirty-nine per cent of the supply. It is the largest holder of the token by
// far and it is not a holder, it is the liquidity. A list-only approach pays it
// two fifths of every round until somebody notices, and the next pool, bridge or
// router is the one nobody remembers to add.
//
// A holder whose wallet is a contract — a Safe, say — is caught by this too, and
// that is the trade. Every skipped contract is printed with what it holds, so
// allowing one is a deliberate line in lib/revenue.ts rather than a silent
// payout to a pool.
//
// Shares are floored, so they always sum to a little UNDER the round. The few
// wei left over stay in the contract and are swept into a later round rather
// than being handed to whoever happened to sort last.

import { writeFileSync } from "node:fs";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import { normalise } from "@/lib/address";
import { CROCARD, CONTRACTS, NOT_A_HOLDER } from "@/lib/revenue";
import { PUBLIC_RPCS } from "@/lib/cronos";

/** keccak of "Transfer(address,address,uint256)". */
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Blocks per eth_getLogs call. Cronos' public RPCs refuse much more. */
const CHUNK = 2_000;

/**
 * Shares smaller than this are left out of the tree.
 *
 * A claim costs gas. Below some amount the transaction costs more than it moves,
 * and putting those holders in the tree hands them a share they would lose money
 * taking. What is left out stays in the contract and is shared again next round,
 * by which time it may be worth taking.
 */
const DUST = 10_000_000_000_000_000n; // 0.01 CRO

const rpcs = process.env.CRONOS_RPC ? [process.env.CRONOS_RPC, ...PUBLIC_RPCS] : PUBLIC_RPCS;

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "no endpoint answered";
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const found = (await answer.json()) as { result?: unknown; error?: { message?: string } };
      if (found.error) throw new Error(found.error.message ?? "rejected");
      if (found.result !== undefined) return found.result;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`${method}: ${last}`);
}

const topicToAddress = (topic: string) => normalise("0x" + topic.slice(26));

async function balances(): Promise<Map<string, bigint>> {
  const head = Number(await rpc("eth_blockNumber", []));
  const held = new Map<string, bigint>();

  for (let from = 0; from <= head; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, head);
    const logs = (await rpc("eth_getLogs", [
      {
        address: CROCARD,
        topics: [TRANSFER],
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
      },
    ])) as { topics: string[]; data: string }[];

    for (const log of logs) {
      // Transfer indexes from and to, so the amount is the only thing in data.
      const value = BigInt(log.data);
      const sender = topicToAddress(log.topics[1]!);
      const recipient = topicToAddress(log.topics[2]!);
      held.set(sender, (held.get(sender) ?? 0n) - value);
      held.set(recipient, (held.get(recipient) ?? 0n) + value);
    }
    if (from % (CHUNK * 50) === 0) {
      process.stderr.write(`  ${to}/${head}\r`);
    }
  }
  return held;
}

/**
 * Which of these addresses have code on them.
 *
 * `eth_getCode` per address, in batches the endpoints will take. It is a lot of
 * calls for a script that runs when a round is opened, and the alternative is
 * trusting a list of addresses somebody remembered to keep up to date with a
 * payout hanging on it.
 */
async function whichHaveCode(addresses: readonly string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const AT_A_TIME = 10; // evm.cronos.org refuses a larger JSON-RPC batch.

  for (let i = 0; i < addresses.length; i += AT_A_TIME) {
    const slice = addresses.slice(i, i + AT_A_TIME);
    const answers = await Promise.all(
      slice.map((address) => rpc("eth_getCode", [address, "latest"]) as Promise<string>),
    );
    for (const [j, code] of answers.entries()) {
      // "0x" is an ordinary wallet. Anything longer is a contract.
      if (code !== "0x" && code !== "0x0") found.add(slice[j]!);
    }
    process.stderr.write(`  code ${Math.min(i + AT_A_TIME, addresses.length)}/${addresses.length}\r`);
  }
  return found;
}

async function main(): Promise<void> {
  const round = Number(process.argv[2]);
  const total = BigInt(process.argv[3] ?? "0");
  if (!Number.isInteger(round) || round < 1 || total <= 0n) {
    throw new Error("Give a round number and an amount in wei.");
  }

  const held = await balances();

  // The named ones: burn, zero, the pool, the router, and this project's own
  // contracts. Known today, and not what is relied on.
  const skip = new Set<string>([
    ...NOT_A_HOLDER,
    ...Object.values(CONTRACTS).filter((a): a is string => a !== null),
  ]);

  const positive = [...held]
    .filter(([address, amount]) => amount > 0n && !skip.has(address))
    .sort(([a], [b]) => a.localeCompare(b));

  // And the rule: anything with code is not a person. Asked of the chain rather
  // than assumed, because this is the check that catches the pool nobody wrote
  // down — and it is asked for every address rather than only the big ones, so
  // that adding a contract to the list later is a decision and not a discovery.
  const contracts = await whichHaveCode(positive.map(([address]) => address));
  const holders = positive.filter(([address]) => !contracts.has(address));

  if (contracts.size > 0) {
    const missed = positive
      .filter(([address]) => contracts.has(address))
      .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0));
    process.stderr.write(`\n  Skipped ${contracts.size} address(es) with code on them:\n`);
    for (const [address, amount] of missed) {
      process.stderr.write(`    ${address}  ${(amount / 10n ** 18n).toLocaleString("en-US")}\n`);
    }
    process.stderr.write(
      "  Any of these that is a person's wallet has to be allowed in lib/revenue.ts.\n\n",
    );
  }

  const supply = holders.reduce((sum, [, amount]) => sum + amount, 0n);
  if (supply === 0n) throw new Error("Nobody holds any, which cannot be right.");

  // Floored, so the shares always sum to at most the round. The remainder stays
  // in the contract and is shared again later.
  const shares = holders
    .map(([address, amount]) => [address, ((amount * total) / supply).toString()] as [string, string])
    .filter(([, share]) => BigInt(share) >= DUST);

  if (shares.length === 0) throw new Error("Every share is dust. The round is too small.");

  const paid = shares.reduce((sum, [, share]) => sum + BigInt(share), 0n);
  if (paid > total) throw new Error(`The tree promises ${paid} out of ${total}.`);

  const tree = StandardMerkleTree.of(shares, ["address", "uint256"]);
  const out = {
    round,
    token: CROCARD,
    root: tree.root,
    total: total.toString(),
    paid: paid.toString(),
    holders: shares.length,
    entries: shares.map(([address, amount], i) => ({
      address,
      amount,
      proof: tree.getProof(i),
    })),
  };

  writeFileSync("data/holder-drop.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`\nround ${round}`);
  console.log(`  holders in the tree : ${shares.length} of ${holders.length}`);
  console.log(`  shared out          : ${paid} of ${total} wei`);
  console.log(`  left for next round : ${total - paid} wei`);
  console.log(`  root                : ${tree.root}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
