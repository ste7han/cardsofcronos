// Turns the rendered PNGs into the files that actually go on chain.
//
//   npx tsx scripts/nft/webp.ts [inDir] [outDir] [quality]
//   npx tsx scripts/nft/webp.ts out/cards out/upload 92
//
// Carried over from TCG, whose reasoning holds here unchanged.
//
// WHY q92 AND NOT q85. The saving between them is a few tens of megabytes, which
// on any storage anybody would pick is a difference of pennies. These cards
// carry rules text at nine pixels and it is the only thing on them that has to
// be readable; paying anything at all to compress it harder is the wrong trade.
// The format is chosen on whether it displays and the quality on legibility,
// never on price.
//
// THE METADATA COMES WITH IT. render-cards.ts writes `image: "<id>.png"` as a
// bare filename, to be rewritten at upload time rather than baking in an address
// nobody has registered yet. This is that time for the extension at least: a
// metadata file pointing at a .png that is not being uploaded is a token whose
// picture 404s, and it would look fine everywhere until somebody opened a wallet.
//
// Verified after writing rather than trusted: a conversion that silently
// produced a 0-byte file would hand over a set with holes in it, and the holes
// only show up in somebody's wallet.

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const IN = process.argv[2] ?? "out/cards";
const OUT = process.argv[3] ?? "out/upload";
const QUALITY = Number(process.argv[4] ?? 92);

async function main(): Promise<void> {
  if (!Number.isInteger(QUALITY) || QUALITY < 1 || QUALITY > 100) {
    throw new Error(`Quality is "${process.argv[4]}". It is a whole number from 1 to 100.`);
  }

  const files = (await readdir(IN)).filter((f) => f.endsWith(".png"));
  if (files.length === 0) throw new Error(`No PNGs in ${IN}. Run scripts/render-cards.ts first.`);

  // Made rather than assumed. Pointed at a folder that does not exist, sharp
  // fails on every single file with "unable to open for write" — hundreds of
  // lines of the same error where one line of mkdir belongs.
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, "metadata"), { recursive: true });

  let pngBytes = 0;
  let webpBytes = 0;
  const empty: string[] = [];

  for (const file of files) {
    const from = path.join(IN, file);
    const to = path.join(OUT, file.replace(/\.png$/, ".webp"));
    pngBytes += (await stat(from)).size;
    await sharp(from).webp({ quality: QUALITY }).toFile(to);
    const size = (await stat(to)).size;
    if (size === 0) empty.push(file);
    webpBytes += size;
  }

  // The metadata beside it, with the extension it now points at.
  const metaIn = path.join(IN, "metadata");
  const metas = (await readdir(metaIn)).filter((f) => f.endsWith(".json"));
  const missing: string[] = [];
  for (const file of metas) {
    const card = JSON.parse(await readFile(path.join(metaIn, file), "utf8")) as {
      image: string;
    };
    if (!card.image.endsWith(".png")) {
      missing.push(`${file} points at ${card.image}`);
      continue;
    }
    card.image = card.image.replace(/\.png$/, ".webp");
    await writeFile(
      path.join(OUT, "metadata", file),
      `${JSON.stringify(card, null, 2)}\n`,
    );
  }

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  console.log(`\n${files.length} cards converted at q${QUALITY}\n`);
  console.log(`  PNG   ${mb(pngBytes).padStart(7)} MB`);
  console.log(`  WebP  ${mb(webpBytes).padStart(7)} MB   ${(pngBytes / webpBytes).toFixed(1)}x smaller`);
  console.log(`  mean  ${(webpBytes / files.length / 1024).toFixed(0)} KB a card`);
  console.log(`  ${metas.length} metadata files rewritten to .webp\n`);

  if (empty.length > 0) {
    throw new Error(`${empty.length} files came out empty: ${empty.slice(0, 5).join(", ")}`);
  }
  if (missing.length > 0) {
    throw new Error(`${missing.length} metadata files did not name a PNG: ${missing[0]}`);
  }
  if (metas.length !== files.length) {
    throw new Error(`${files.length} images and ${metas.length} metadata files. They have to match.`);
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
});
