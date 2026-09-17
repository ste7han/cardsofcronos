// One metadata file per token, in the order the shuffle settled.
//
//   npx tsx scripts/nft/tokens.ts [uploadDir] [imageBase]
//   npx tsx scripts/nft/tokens.ts out/upload ipfs://bafy…/
//
// The contract asks for `baseURI + tokenId` and nothing else — no extension, no
// folder — because ERC721.tokenURI concatenates and CardsOfCronosSetOne does not
// override that. So these files are named `1` … `5555` with no `.json` on them.
// Naming them `7.json` would produce a collection where every tokenURI 404s and
// every card shows blank, and it would look completely normal until it was
// deployed.
//
// WHICH CARD A TOKEN IS was decided once, by scripts/shuffle.ts, and published as
// a hash before the first sale. This turns that list into the files the chain
// will actually read. Rerun it with the same shuffle.json and it produces the
// same 5555 files.
//
// THE IMAGE FIELD. Without an argument it stays a bare filename, which is what
// render-cards.ts wrote and what webp.ts kept — useful for checking the output
// and useless to a wallet. Pass the base the images are uploaded under and every
// file gets an address that resolves. Doing it here rather than earlier is the
// point: the images have to exist before anybody knows their address.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD = process.argv[2] ?? "out/upload";
const IMAGE_BASE = process.argv[3] ?? "";

interface Card {
  name: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: string | number }[];
}

async function main(): Promise<void> {
  const shuffle = JSON.parse(await readFile("data/shuffle.json", "utf8")) as {
    seed: number;
    tokens: number;
    hash: string;
    order: string[];
  };
  if (shuffle.order.length !== shuffle.tokens) {
    throw new Error(`shuffle.json says ${shuffle.tokens} tokens and lists ${shuffle.order.length}.`);
  }

  // Every card in the order has to have both halves. A token pointing at a
  // missing image is a blank card in a wallet; a missing metadata file is worse,
  // because the token has no name at all.
  const metaDir = path.join(UPLOAD, "metadata");
  const haveMeta = new Set((await readdir(metaDir)).map((f) => f.replace(/\.json$/, "")));
  const haveImage = new Set(
    (await readdir(UPLOAD)).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, "")),
  );
  const wanted = [...new Set(shuffle.order)];
  const noMeta = wanted.filter((id) => !haveMeta.has(id));
  const noImage = wanted.filter((id) => !haveImage.has(id));
  if (noMeta.length > 0) throw new Error(`No metadata for ${noMeta.length}: ${noMeta.slice(0, 5)}`);
  if (noImage.length > 0) throw new Error(`No image for ${noImage.length}: ${noImage.slice(0, 5)}`);

  // How many of each card the shuffle holds, so a token can say which copy it is.
  const total = new Map<string, number>();
  for (const id of shuffle.order) total.set(id, (total.get(id) ?? 0) + 1);

  const cards = new Map<string, Card>();
  for (const id of wanted) {
    cards.set(id, JSON.parse(await readFile(path.join(metaDir, `${id}.json`), "utf8")) as Card);
  }

  const out = path.join(UPLOAD, "tokens");
  await mkdir(out, { recursive: true });

  const seen = new Map<string, number>();
  for (const [i, id] of shuffle.order.entries()) {
    const token = i + 1;
    const copy = (seen.get(id) ?? 0) + 1;
    seen.set(id, copy);
    const card = cards.get(id)!;

    await writeFile(
      path.join(out, String(token)),
      `${JSON.stringify(
        {
          name: card.name,
          description: card.description,
          image: IMAGE_BASE ? `${IMAGE_BASE}${card.image}` : card.image,
          attributes: [
            ...card.attributes,
            // Which of this card you hold. A collector asks it immediately and
            // the answer is already known — it is the shuffle, counted.
            { trait_type: "Copy", value: `${copy} of ${total.get(id)}` },
          ],
        },
        null,
        2,
      )}\n`,
    );
  }

  console.log(`\n${shuffle.order.length} token files written to ${out}/`);
  console.log(`  named 1…${shuffle.order.length}, no extension, as the contract asks for them`);
  console.log(`  ${wanted.length} distinct cards`);
  console.log(`  image field  ${IMAGE_BASE ? IMAGE_BASE + "<card>.webp" : "<card>.webp — a bare filename, pass a base to fix it"}`);
  console.log(`  shuffle      seed ${shuffle.seed}, hash ${shuffle.hash.slice(0, 16)}…\n`);
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
});
