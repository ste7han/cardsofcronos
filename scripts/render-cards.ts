// Every card, as a file.
//
//   npm run dev            (in another terminal — this shoots the running site)
//   npx tsx scripts/render-cards.ts [outDir] [scale] [--force] [--stale]
//
// --stale re-shoots the cards whose art arrived since they were last rendered,
// which is what you want after dropping files into public/art and running
// `npm run art`. --force re-shoots everything and is rarely what you want.
//
// This is what becomes the NFT image. It screenshots /card/<id>/image, which
// renders the same CardView the game renders, so there is exactly one thing that
// decides what a card looks like. A separate drawing program for the mint would
// be a second implementation, and the day the two disagree the picture somebody
// owns stops matching the card they are playing.
//
// The maker's decision, recorded in DESIGN.md: the stats go on the image. That
// buys the thing worth buying — what you hold looks like what you play — and it
// costs the freedom to rebalance after a mint. Both halves of that are real, and
// the second is why this script also exists as the errata tool: a card that has
// to be corrected is re-rendered here and its metadata updated.
//
// Scale is the device pixel ratio, so 4 gives 1072x1504 from a 268x376 card.
//
// 376 and not 375: the card is aspect-[5/7] on a 268px width, which is 375.2,
// and the browser lays that out as 376. This said 1500 until all 445 came out
// at 1504 — consistently, so the collection is uniform and only the arithmetic
// in this comment was wrong.
// That is a real 4x render rather than a small one blown up.

import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { CARDS } from "../data/cards";
import { setFingerprint } from "../engine/fingerprint";
import { ART_FILES } from "../lib/art-manifest";
import { cardLabel } from "@/engine/format";
import { MARKETING_COST, auraOf } from "../engine/types";

const OUT = process.argv[2] ?? "out/cards";
const SCALE = Number(process.argv[3] ?? 4);
const BASE = process.env.SITE_BASE_URL ?? "http://localhost:3000";
/** Re-shoot pictures that already exist. Metadata is always rewritten. */
const FORCE = process.argv.includes("--force");
/** Re-shoot only the cards whose art the manifest has learned about since. */
const STALE = process.argv.includes("--stale");

/**
 * Does this card's picture predate the art it should be showing?
 *
 * Compared against the manifest rather than against the art file, and that
 * distinction is the whole reason this exists. PONKE's cards were shot after
 * ponke.png landed in the folder but before `npm run art` taught the manifest
 * about it, so the render was newer than the art and still showed a generated
 * candle chart. The page reads the manifest, so the manifest is the date that
 * matters.
 *
 * Cards with no art are never stale: there is nothing better to show them than
 * what they already have. That also makes this safe to run when a file has gone
 * missing — it will not quietly replace a good picture with a procedural one.
 */
function staleAgainstArt(cardId: string, project: string | undefined, image: string): boolean {
  const art = ART_FILES[cardId] ?? (project ? ART_FILES[project] : undefined);
  if (!art || !existsSync(image)) return false;

  // Two ways a picture goes out of date, and both have caught me out.
  //
  // The manifest changing covers a file that is newly resolved — PONKE's cards
  // were shot after ponke.png landed but before `npm run art` taught the
  // manifest about it, so they were newer than their art and still generated.
  //
  // The art file changing covers a file replaced under the same name. sonic.png
  // was swapped for a different picture; the filename did not move, so the
  // manifest is byte-identical and only the file's own timestamp knows.
  //
  // Whichever is later wins. Missing either one leaves a card showing art the
  // maker has already replaced, which is the quiet kind of wrong.
  // Without the ?v= the manifest holds. It is a browser-cache key, not part of
  // the filename, and existsSync on a path carrying it is quietly always false —
  // which would leave this returning "not stale" for every card in the set.
  const artFile = path.join(process.cwd(), "public", art.split("?")[0]!);
  const manifest = path.join(process.cwd(), "lib", "art-manifest.ts");
  const newest = Math.max(
    statSync(manifest).mtimeMs,
    existsSync(artFile) ? statSync(artFile).mtimeMs : 0,
  );
  return statSync(image).mtimeMs < newest;
}

/**
 * The card as a marketplace shows it.
 *
 * These are what somebody filters on. The first pass gave the 116 tools,
 * tactics, events and influencers nothing but rarity, type and cost — so a
 * collector could not ask for "influencers that pump meme", which is the most
 * obvious question anybody would have. Auras and effect kinds are in now, and
 * both are stable: they are printed on the image, so they are frozen anyway.
 */
function attributesOf(card: (typeof CARDS)[number]) {
  const traits: Array<{ trait_type: string; value: string | number }> = [
    { trait_type: "Rarity", value: card.rarity },
    { trait_type: "Type", value: card.type },
    { trait_type: "Marketing cost", value: MARKETING_COST[card.rarity] },
  ];

  if (card.type === "project") {
    traits.push({ trait_type: "Project", value: card.name });
    traits.push({ trait_type: "Sector", value: card.sector });
    if (card.moment) traits.push({ trait_type: "Edition", value: card.moment });
    traits.push({ trait_type: "Launch MC", value: card.launchMC });
    traits.push({ trait_type: "Pump MC", value: card.pumpMC });
    traits.push({ trait_type: "Holders", value: card.holders });
  }

  // Only a pumpSector aura has a sector and a bonus to print. TCG's aura became
  // a union — budgetEachTurn, drawEachTurn, morePositions and the rest measure
  // something else entirely — and a trait called "Pumps sector" has to mean what
  // it says, so the others print nothing rather than something near enough.
  const aura = auraOf(card);
  if (aura?.kind === "pumpSector") {
    traits.push({ trait_type: "Pumps sector", value: aura.sector });
    traits.push({ trait_type: "Aura bonus", value: aura.bonus });
  }
  if (aura?.kind === "pumpSectors") {
    traits.push({ trait_type: "Pumps sector", value: aura.sectors.join(", ") });
    traits.push({ trait_type: "Aura bonus", value: aura.bonus });
  }
  if (card.effect) traits.push({ trait_type: "Effect", value: card.effect.kind });

  return traits;
}

/**
 * Refuse to render against a server holding a different card set.
 *
 * There are two copies of the cards in a render: the one this script imported
 * and the one the server is serving. A dev server that has not restarted since
 * the card data changed serves the old one — and while a *new* card 404s, which
 * is loud, a *changed* card renders quietly with its old numbers straight onto
 * the picture that becomes somebody's NFT. Rendering from the real component
 * exists so that cannot happen; this closes the side door.
 */
async function checkFingerprint() {
  const mine = setFingerprint(CARDS);
  let theirs: { fingerprint?: string; cards?: number };
  try {
    const response = await fetch(`${BASE}/api/set-fingerprint`);
    theirs = (await response.json()) as typeof theirs;
  } catch (error) {
    throw new Error(
      `Could not reach ${BASE}/api/set-fingerprint. Is \`npm run dev\` running?\n${String(error)}`,
    );
  }

  if (theirs.fingerprint !== mine) {
    throw new Error(
      `The server is serving a different card set than this script imported.\n` +
        `  this script : ${mine} (${CARDS.length} cards)\n` +
        `  the server  : ${theirs.fingerprint} (${theirs.cards} cards)\n` +
        `Restart the dev server. Rendering now would print stale numbers onto the images.`,
    );
  }
  console.log(`card set ${mine} — script and server agree\n`);
}

async function main() {
  await checkFingerprint();
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, "metadata"), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 400, height: 520 },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();

  let done = 0;
  for (const card of CARDS) {
    // Metadata is cheap and images are not, so an existing picture is left
    // alone unless asked. Re-shooting 626 cards to correct a JSON field is ten
    // minutes for nothing.
    const image = path.join(OUT, `${card.id}.png`);
    const stale =
      STALE && staleAgainstArt(card.id, card.type === "project" ? card.project : undefined, image);
    if (FORCE || stale || !existsSync(image)) {
      // Retried, because the first full run died on card 225 of 577 and the
      // reason was not this script: the dev server was rebuilding after an edit
      // while the machine was also running measurements, and a 30-second wait is
      // not long under that load. Losing four hundred renders to one slow
      // recompile is not a failure worth having.
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await page.goto(`${BASE}/card/${card.id}/image`, {
            waitUntil: "networkidle",
            timeout: 120_000,
          });
          const target = page.locator("#card-image");
          await target.waitFor({ state: "visible", timeout: 120_000 });
          await target.screenshot({ path: image });
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          console.log(`  ${card.id}: attempt ${attempt} failed, retrying`);
        }
      }
      // Loud, not silent: a card that could not be shot after three tries is a
      // card whose NFT picture does not exist, and finishing the run quietly
      // would hand over a set with holes in it.
      if (lastError) throw lastError;
    }

    // Metadata beside the picture, in the shape an ERC721 marketplace reads.
    //
    // This was Metaplex-shaped, which is the Solana convention: it carried a
    // `symbol` and a `properties.files` block that nothing on an EVM chain looks
    // at. What is left — name, description, image, attributes — is what OpenSea
    // and everything that copied it actually parses, and it is a subset rather
    // than a translation, so no field lost meaning on the way across.
    //
    // The image field is a filename rather than a URL. It gets rewritten to the
    // permanent one at upload time, and guessing that here would bake in an
    // address nobody has registered yet.
    const label = cardLabel(card);
    await writeFile(
      path.join(OUT, "metadata", `${card.id}.json`),
      `${JSON.stringify(
        {
          name: label,
          description: card.flavour,
          image: `${card.id}.png`,
          attributes: attributesOf(card),
        },
        null,
        2,
      )}\n`,
    );

    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${CARDS.length}`);
  }

  await browser.close();
  console.log(`\n${done} cards rendered at ${268 * SCALE}x${375 * SCALE} into ${OUT}/`);
  console.log(`Metadata in ${OUT}/metadata/ — ERC721 shape; image fields are filenames, to be rewritten on upload.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
