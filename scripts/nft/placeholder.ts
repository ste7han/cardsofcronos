// The metadata every token carries until the reveal.
//
//   npx tsx scripts/nft/placeholder.ts [uploadDir] [imageUrl]
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// The real metadata says which card every token is, and the contract asks for it
// at `baseURI + tokenId`. Point the contract at the real folder before the mint
// is over and anybody can read ahead: fetch token 601, 602, 603, see a mythic
// coming at 640, and buy exactly that one. The odds stop being odds and the
// people who lose are the ones who did not think to look.
//
// So the contract is deployed pointing here instead, and setBaseURI moves it to
// the real folder once there is nothing left to snipe.
//
// ── WHAT MAKES THAT HONEST ───────────────────────────────────────────────────
//
// Not this file. The hash of the order — published before the first sale, from
// data/shuffle.json — is what stops the order being decided after the fact to
// suit somebody. Anyone can rerun scripts/shuffle.ts with the published seed
// afterwards, hash the result, and check it against what was promised.
//
// A delayed reveal without that hash is not a fair mint, it is the same mint
// with the evidence withheld.
//
// ── WHY 5555 IDENTICAL FILES ─────────────────────────────────────────────────
//
// ERC721.tokenURI concatenates, so every token asks for its own name and a
// folder with one file in it answers 404 for all but one of them. They are two
// hundred bytes each and they exist for as long as the mint runs.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD = process.argv[2] ?? "out/upload";
const IMAGE = process.argv[3] ?? "";

async function main(): Promise<void> {
  const shuffle = JSON.parse(await readFile("data/shuffle.json", "utf8")) as {
    tokens: number;
    hash: string;
  };

  const out = path.join(UPLOAD, "placeholder");
  await mkdir(out, { recursive: true });

  for (let token = 1; token <= shuffle.tokens; token++) {
    await writeFile(
      path.join(out, String(token)),
      `${JSON.stringify(
        {
          name: `Cards of Cronos #${token}`,
          description:
            "Face down until the mint closes. Which card this is was decided before the " +
            "first sale and fixed by a hash published with it — see /mint. Revealing it " +
            "early would let anybody read ahead and buy only the good ones.",
          image: IMAGE,
          attributes: [
            { trait_type: "Status", value: "Face down" },
            { trait_type: "Token", value: token },
            // The promise, carried by every token rather than only by a page
            // somebody has to find and trust.
            { trait_type: "Order fixed by", value: shuffle.hash },
          ],
        },
        null,
        2,
      )}\n`,
    );
  }

  console.log(`\n${shuffle.tokens} placeholder files written to ${out}/`);
  console.log(`  image  ${IMAGE || "none — pass a URL for the card back"}`);
  console.log(`  hash   ${shuffle.hash}\n`);
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
});
