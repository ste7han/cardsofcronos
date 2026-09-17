// Puts a folder on IPFS through Filebase, and asks for the CID of the folder.
//
//   FILEBASE_KEY=… FILEBASE_SECRET=… npx tsx scripts/nft/upload.ts <dir> <bucket>
//   FILEBASE_KEY=… FILEBASE_SECRET=… npx tsx scripts/nft/upload.ts out/upload coc-art
//
// THE KEYS COME FROM THE ENVIRONMENT and never from an argument, because argv is
// readable by anything that can run `ps`. They are not written anywhere by this.
//
// ── WHY A BUCKET CID ─────────────────────────────────────────────────────────
//
// The contract asks for `baseURI + tokenId`, so the base has to be a folder that
// a gateway can resolve a name inside. Filebase gives every object its own CID,
// which is not that. Its Bucket CID feature is: upload the objects one at a time
// with ordinary PutObject, then ask the bucket for the CID of everything in it
// with a PutBucketTagging of generateBucketCid=true. The CID comes back in the
// x-amz-meta-cid response header.
//
// That also makes a later change cheap, which is the point of doing it this way
// rather than as one giant CAR upload: put the changed files, ask for a new
// bucket CID, and call setBaseURI. Nothing else is re-uploaded.
//
// ── CONTENT TYPE, AND WHY IT IS SET BY HAND ──────────────────────────────────
//
// The token files are named `1` … `5555` with no extension, because that is what
// ERC721.tokenURI asks for. Nothing can guess their type from the name, and a
// marketplace handed `text/plain` where it expected JSON shows an empty card
// with no error anywhere. So it is stated rather than inferred.
//
// ── IT CAN BE RUN AGAIN ──────────────────────────────────────────────────────
//
// Six thousand uploads is enough that something will time out. Anything already
// in the bucket at the right size is skipped, so running it twice finishes the
// job rather than starting it over. --force ignores that.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketTaggingCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const DIR = process.argv[2];
const BUCKET = process.argv[3];
const FORCE = process.argv.includes("--force");

/** Stated, never guessed. See the note above about extensionless token files. */
function contentType(file: string): string {
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".json")) return "application/json";
  // No extension: these are the token files, and they are JSON.
  if (!path.extname(file)) return "application/json";
  throw new Error(`Nothing here knows what ${file} is. Add it to contentType().`);
}

async function main(): Promise<void> {
  if (!DIR || !BUCKET) {
    throw new Error("Give a folder and a bucket: npx tsx scripts/nft/upload.ts out/upload coc-art");
  }
  const key = process.env.FILEBASE_KEY;
  const secret = process.env.FILEBASE_SECRET;
  if (!key || !secret) {
    throw new Error("Set FILEBASE_KEY and FILEBASE_SECRET in the environment. Never as arguments.");
  }

  const s3 = new S3Client({
    endpoint: "https://s3.filebase.com",
    region: "us-east-1",
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: true,
  });

  /**
   * The raw response headers, which the SDK does not hand back on its own.
   *
   * `$metadata` carries a status code, a request id and a retry count, and
   * nothing else — not the header the CID arrives in. Reading
   * `$metadata.httpHeaders` compiles, returns undefined at runtime, and would
   * have looked like Filebase refusing to answer.
   */
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

  // Made if it is not there. One less thing to do by hand in a dashboard, and
  // one less way for a typo to end up as a second bucket nobody notices.
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`  bucket ${BUCKET} is there already`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`  bucket ${BUCKET} made`);
  }

  // Files directly in the folder. Sub-folders are their own bucket and their own
  // CID on purpose: the images and the token files are referenced separately, and
  // one flat folder of both would put 6000 names where 5555 belong.
  const names = (await readdir(DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) throw new Error(`Nothing to upload in ${DIR}.`);

  console.log(`\n${names.length} files from ${DIR} into ${BUCKET}\n`);

  let sent = 0;
  let skipped = 0;
  for (const [i, name] of names.entries()) {
    const full = path.join(DIR, name);
    const size = (await stat(full)).size;

    if (!FORCE) {
      try {
        const there = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: name }));
        if (there.ContentLength === size) {
          skipped++;
          continue;
        }
      } catch {
        // Not there, or not readable. Either way it is about to be written.
      }
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: name,
        Body: await readFile(full),
        ContentType: contentType(name),
      }),
    );
    sent++;
    if ((i + 1) % 250 === 0) process.stderr.write(`  ${i + 1}/${names.length}\r`);
  }

  console.log(`  uploaded ${sent}, already there ${skipped}`);

  // The folder, now that everything is in it.
  await s3.send(
    new PutBucketTaggingCommand({
      Bucket: BUCKET,
      Tagging: { TagSet: [{ Key: "generateBucketCid", Value: "true" }] },
    }),
  );
  const cid = lastHeaders["x-amz-meta-cid"];

  if (!cid) {
    throw new Error(
      "The bucket CID did not come back in x-amz-meta-cid. Filebase needs a paid plan for this, " +
        "and the files have to have been uploaded within three months.",
    );
  }

  console.log(`\n  folder CID  ${cid}`);
  console.log(`  as a base   ipfs://${cid}/`);
  console.log(`  to check    https://ipfs.filebase.io/ipfs/${cid}/${names[0]}\n`);
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
});
