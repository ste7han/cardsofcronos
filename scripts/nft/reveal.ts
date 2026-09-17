// Turns face-down tokens face up, as far as the mint has got and no further.
//
//   npx tsx scripts/nft/reveal.ts <bucket> --upto <token>
//   npx tsx scripts/nft/reveal.ts <bucket> --contract 0x…
//
// ── WHY THIS IS NOT ONE REVEAL AT THE END ────────────────────────────────────
//
// A mint can take months, and the last one this project ran stopped at 515 of
// 1894 and never finished at all. Holding every card face down until it is "over"
// means a card nobody can look at for as long as nobody buys — which is a worse
// deal than the sniping the face-down folder exists to prevent.
//
// So the boundary moves. Everything already minted is turned face up; everything
// past it stays down. That is safe because a token below nextTokenId is already
// owned: whoever holds it cannot un-buy it, so knowing what it is changes
// nothing. A token at or above nextTokenId has not been sold, and showing it is
// exactly what would let somebody wait for the good ones.
//
// ── IT READS THE LINE FROM THE CHAIN ─────────────────────────────────────────
//
// `--contract` asks the contract for nextTokenId rather than being told a
// number. Being told is how you reveal one too many by hand at two in the
// morning, and one too many is the whole mint's fairness gone. `--upto` exists
// for a dry run and for the case where the contract is not deployed yet.
//
// ── AFTERWARDS ───────────────────────────────────────────────────────────────
//
// It prints a new folder CID. That has to go on chain with setBaseURI or nothing
// has changed for anybody — the files are new, the address the contract hands
// out is not. And marketplaces cache metadata hard: expect to ask them to
// refresh, and expect some of them to take their time about it.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  PutBucketTaggingCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { PUBLIC_RPCS } from "@/lib/cronos";
import { selector } from "@/lib/evm-tx";

const BUCKET = process.argv[2];
const UPLOAD = "out/upload";

const flag = (name: string): string | null => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : process.argv[at + 1] ?? null;
};

/** What the contract says the next unsold token is. */
async function nextTokenId(contract: string): Promise<number> {
  const rpcs = process.env.CRONOS_RPC ? [process.env.CRONOS_RPC, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: contract, data: selector("nextTokenId()") }, "latest"],
        }),
      });
      const found = (await answer.json()) as { result?: string; error?: { message?: string } };
      if (found.error) throw new Error(found.error.message ?? "rejected");
      if (found.result && found.result !== "0x") return Number(BigInt(found.result));
    } catch {
      // Next endpoint.
    }
  }
  throw new Error(`Could not read nextTokenId from ${contract}.`);
}

async function main(): Promise<void> {
  if (!BUCKET) throw new Error("Give the bucket the live metadata is in.");
  const key = process.env.FILEBASE_KEY;
  const secret = process.env.FILEBASE_SECRET;
  if (!key || !secret) throw new Error("Set FILEBASE_KEY and FILEBASE_SECRET in the environment.");

  const contract = flag("contract");
  const told = flag("upto");
  if (!contract && !told) throw new Error("Pass --contract 0x… or --upto <token>.");

  // The last token that may be shown. nextTokenId is the next UNSOLD one, so
  // everything strictly below it is already somebody's.
  const upto = contract ? (await nextTokenId(contract)) - 1 : Number(told);
  if (!Number.isInteger(upto) || upto < 0) throw new Error(`"${told}" is not a token number.`);
  if (upto === 0) {
    console.log("\nNothing has been minted. Nothing to turn over.\n");
    return;
  }

  const s3 = new S3Client({
    endpoint: "https://s3.filebase.com",
    region: "us-east-1",
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: true,
  });
  let lastHeaders: Record<string, string> = {};
  s3.middlewareStack.add(
    (next) => async (args) => {
      const result = await next(args);
      const response = result.response as { headers?: Record<string, string> };
      if (response.headers) lastHeaders = response.headers;
      return result;
    },
    { step: "deserialize", name: "keepHeaders" },
  );

  console.log(`\nturning tokens 1…${upto} face up in ${BUCKET}\n`);

  let sent = 0;
  for (let token = 1; token <= upto; token++) {
    const from = path.join(UPLOAD, "tokens", String(token));
    // Loud rather than skipped. A token whose real metadata is missing would be
    // left face down for ever with nothing saying so.
    await stat(from);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: String(token),
        Body: await readFile(from),
        ContentType: "application/json",
      }),
    );
    sent++;
    if (token % 250 === 0) process.stderr.write(`  ${token}/${upto}\r`);
  }

  await s3.send(
    new PutBucketTaggingCommand({
      Bucket: BUCKET,
      Tagging: { TagSet: [{ Key: "generateBucketCid", Value: "true" }] },
    }),
  );
  const cid = lastHeaders["x-amz-meta-cid"];
  if (!cid) throw new Error("No bucket CID came back in x-amz-meta-cid.");

  console.log(`  ${sent} turned over, ${5555 - upto} still face down`);
  console.log(`\n  new folder CID  ${cid}`);
  console.log(`  setBaseURI to   ipfs://${cid}/`);
  console.log(`\n  Nothing has changed for anybody until that is on chain.\n`);
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
});
