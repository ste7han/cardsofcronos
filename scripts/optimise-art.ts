// Turn the art into something a browser can be asked to download.
//
//   npm run art:optimise            convert anything new
//   npm run art:optimise -- --check report what it would do and change nothing
//
// The art arrives as PNGs of about 1376x768 and 1.6 MB each, 449 MB across 272
// files. Nothing on the site shows one larger than about a thousand pixels
// across: the card render is 268px wide and the NFT image is that at four times.
// So every one of them is roughly twenty times the size it is displayed at, and
// the gallery shows fifteen cards at once — twenty-four megabytes a screen,
// which is not a slow page, it is a broken one.
//
// WebP at quality 82 takes them to between 16 and 210 KB, and at a thousand
// pixels the linework, the halftones and the small type all survive. Checked by
// eye on the worst case before this script was written, not assumed.
//
// Originals are moved rather than deleted. They are the master for anything
// printed or re-rendered later, and art-source/ is ignored by git for the same
// reason public/art is — the last project put 734 MB in a repository and could
// not get it out again.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const ART = path.join(process.cwd(), "public", "art");
const SOURCE = path.join(process.cwd(), "art-source");
const CHECK = process.argv.includes("--check");

/** Wide enough for the NFT render, which is a 268px card shot at four times. */
const MAX_WIDTH = 1200;
const QUALITY = 82;

function widthOf(file: string): number {
  // sips rather than a library: it is on every Mac and this script runs on the
  // one machine that holds the art.
  const out = execFileSync("sips", ["-g", "pixelWidth", file], { encoding: "utf8" });
  const match = out.match(/pixelWidth:\s*(\d+)/);
  if (!match) throw new Error(`Could not read the width of ${file}.`);
  return Number(match[1]);
}

function main(): void {
  if (!existsSync(ART)) throw new Error(`No ${ART} to work on.`);

  const originals = readdirSync(ART).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (originals.length === 0) {
    console.log("Nothing to convert — every picture is already a webp.");
    return;
  }

  let before = 0;
  let after = 0;
  if (!CHECK) mkdirSync(SOURCE, { recursive: true });

  for (const file of originals) {
    const from = path.join(ART, file);
    const to = path.join(ART, file.replace(/\.(png|jpe?g)$/i, ".webp"));
    const size = statSync(from).size;
    before += size;

    if (CHECK) {
      console.log(`  would convert ${file}  (${(size / 1024).toFixed(0)} KB)`);
      continue;
    }

    // Only ever downscale. -resize on something already narrower would enlarge
    // it, which costs bytes and adds nothing — and one file in the set is 300px
    // wide, so this is not hypothetical.
    const wide = widthOf(from) > MAX_WIDTH;
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      String(QUALITY),
      ...(wide ? ["-resize", String(MAX_WIDTH), "0"] : []),
      from,
      "-o",
      to,
    ]);

    after += statSync(to).size;
    renameSync(from, path.join(SOURCE, file));
    console.log(`  ${file} → ${path.basename(to)}  ${(size / 1024).toFixed(0)} → ${(statSync(to).size / 1024).toFixed(0)} KB`);
  }

  if (CHECK) {
    console.log(`\n${originals.length} to convert, ${(before / 1e6).toFixed(0)} MB.`);
    return;
  }

  console.log(
    `\n${originals.length} converted: ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(1)} MB ` +
      `(${(100 - (100 * after) / before).toFixed(0)}% smaller).`,
  );
  console.log(`Originals moved to art-source/. Run \`npm run art\` to rebuild the manifest.`);
}

main();
