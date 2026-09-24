// What each board plays for, pushed to the pots that pay it.
//
//   npm run board-share                read every pot and stop
//   npm run board-share -- --broadcast send what data/boards.ts says
//
// Reading is free and always happens, before and after, because a share is
// worth nothing if nobody can tell what it currently is — and because the
// thing this changes is where prize money goes.
//
// ── TWO POTS, TWO DIFFERENT NUMBERS ──────────────────────────────────────────
//
// The shared pot holds $CROCARD and every board takes a share of it; a board's
// own pot holds one token for one board and takes all of it. Ten per cent and a
// hundred per cent, on two contracts, and putting them the wrong way round is a
// prize paid out of the wrong pot for as long as nobody notices.
//
// So neither number is typed on the command line. data/boards.ts says what a
// board plays for, this reads it, and test/boards.test.ts checks it adds up.
// A number that lives only in a transaction somebody once sent is a number
// nobody can look up.
//
// ── WHAT IT REFUSES ──────────────────────────────────────────────────────────
//
// Sending from a key that is not the pot's owner, which would revert anyway but
// after the gas. And a run where nothing would change, which is not an error
// but is a transaction worth not paying for.
//
// DEPLOY_KEY is read from the environment, or out of .env.local when it is not
// there. Never from an argument: argv is visible to anybody who can run ps.

import { existsSync, readFileSync } from "node:fs";

import { BOARDS } from "@/data/boards";
import { hexToBytes, normalise } from "@/lib/address";
import { PUBLIC_RPCS } from "@/lib/cronos";
import { CONTRACTS } from "@/lib/revenue";
import { asWord } from "@/lib/publisher";
import { CRONOS_CHAIN_ID, addressOfKey, selector, signTransaction, word } from "@/lib/evm-tx";

const rpcs = process.env.CRONOS_RPC ? [process.env.CRONOS_RPC, ...PUBLIC_RPCS] : PUBLIC_RPCS;
const broadcast = process.argv.includes("--broadcast");

async function rpc(method: string, params: unknown[]): Promise<any> {
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
      if (/revert|insufficient|nonce|underpriced/i.test(last)) throw error;
    }
  }
  throw new Error(`${method}: ${last}`);
}

/** One variable out of .env.local, by name. Never the whole file, never printed. */
function fromEnvFile(name: string): string | undefined {
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at === -1 || line.trimStart().startsWith("#")) continue;
    if (line.slice(0, at).trim() !== name) continue;
    return line.slice(at + 1).trim().replace(/^["']|["']$/g, "") || undefined;
  }
  return undefined;
}

const read = (to: string, data: string) => rpc("eth_call", [{ to, data }, "latest"]) as Promise<string>;
const num = (hex: string) => Number(BigInt(hex === "0x" ? "0x0" : hex));

/** Every share this project means to hold, and on which contract. */
interface Wanted {
  pot: string;
  what: string;
  board: string;
  bps: number;
}

function wanted(): Wanted[] {
  const out: Wanted[] = [];
  for (const board of BOARDS) {
    if (CONTRACTS.pot !== null) {
      out.push({ pot: CONTRACTS.pot, what: "the shared pot", board: board.id, bps: board.shareBps });
    }
    const own = board.alsoPays?.contract ?? null;
    // All of it. One board in that pot, so there is nothing to divide — and a
    // share under 10,000 would leave prize token in it that nothing ever pays.
    if (own !== null) {
      out.push({ pot: own, what: `the ${board.id} pot`, board: board.id, bps: 10_000 });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const want = wanted();
  if (want.length === 0) throw new Error("No pots are deployed, so there is nothing to set.");

  console.log("");
  const todo: Wanted[] = [];
  for (const one of want) {
    const now = num(await read(one.pot, selector("shareOf(bytes32)") + asWord(one.board)));
    const same = now === one.bps;
    console.log(
      `  ${one.what.padEnd(16)} ${one.board.padEnd(7)} ${String(now / 100).padStart(5)}% ` +
        `${same ? "— already" : `-> ${one.bps / 100}%`}`,
    );
    if (!same) todo.push(one);
  }

  if (todo.length === 0) {
    console.log("\n  Every share is already what data/boards.ts says. Nothing to send.\n");
    return;
  }

  if (!broadcast) {
    console.log(`\n  ${todo.length} to change. Nothing was sent — add --broadcast.\n`);
    return;
  }

  const secret = process.env.DEPLOY_KEY ?? fromEnvFile("DEPLOY_KEY");
  if (!secret) {
    throw new Error("No DEPLOY_KEY. Put it in the environment or in .env.local. Never as an argument.");
  }
  const digits = secret.replace(/^0x/, "");
  if (digits.length !== 64) {
    throw new Error(`DEPLOY_KEY is ${digits.length} hex digits and a private key is 64.`);
  }
  const key = hexToBytes(secret);
  const from = addressOfKey(key);

  const chainId = Number(await rpc("eth_chainId", []));
  if (chainId !== CRONOS_CHAIN_ID) {
    throw new Error(`That endpoint is chain ${chainId}, not Cronos (${CRONOS_CHAIN_ID}).`);
  }

  // Every pot this run touches, checked before any of them is touched. Failing
  // on the second of two leaves the shares half moved, which on these two
  // contracts is the state that pays out of the wrong one.
  for (const pot of new Set(todo.map((one) => one.pot))) {
    const owner = normalise("0x" + (await read(pot, selector("owner()"))).slice(-40));
    if (owner !== normalise(from)) {
      throw new Error(`${pot} is owned by ${owner} and DEPLOY_KEY is ${from}. setShare is onlyOwner.`);
    }
  }

  let nonce = Number(BigInt(await rpc("eth_getTransactionCount", [from, "pending"])));
  const gasPrice = BigInt(await rpc("eth_gasPrice", []));

  for (const one of todo) {
    const data = selector("setShare(bytes32,uint256)") + asWord(one.board) + word(BigInt(one.bps));
    const gas = BigInt(await rpc("eth_estimateGas", [{ from, to: one.pot, data }]));
    const raw = signTransaction(
      {
        nonce: BigInt(nonce++),
        gasPrice,
        gasLimit: (gas * 13n) / 10n,
        to: one.pot,
        value: 0n,
        data,
        chainId: CRONOS_CHAIN_ID,
      },
      key,
    );
    const hash = (await rpc("eth_sendRawTransaction", [raw])) as string;
    console.log(`\n  ${one.what} ${one.board} -> ${one.bps / 100}%\n  sent  ${hash}`);

    let done = false;
    for (let tries = 0; tries < 60 && !done; tries++) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        if (BigInt(receipt.status) !== 1n) throw new Error(`It reverted: ${hash}`);
        done = true;
      } else {
        await new Promise((wake) => setTimeout(wake, 3_000));
      }
    }
    if (!done) throw new Error(`Sent but never confirmed: ${hash}`);
  }

  // Read again rather than assuming. A receipt says the transaction did not
  // revert; this says what the contracts now hold, which is what anybody
  // actually wanted to know.
  console.log("\n  reading back:");
  let wrong = 0;
  for (const one of want) {
    const now = num(await read(one.pot, selector("shareOf(bytes32)") + asWord(one.board)));
    if (now !== one.bps) wrong++;
    console.log(`  ${now === one.bps ? "ok  " : "FOUT"} ${one.what.padEnd(16)} ${one.board.padEnd(7)} ${now / 100}%`);
  }
  console.log(wrong === 0 ? "\n  every share matches data/boards.ts.\n" : `\n  ${wrong} do not match.\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
