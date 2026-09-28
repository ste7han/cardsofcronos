// The Crooks Finance free mints, as a square picture to post.
//
//   npm run crooks-card [out.png]
//
// Every figure comes out of data/granted-mints.json and the ladder in
// lib/crooks.ts — the same two files the allowlist is built from. So the picture
// and the merkle root cannot disagree: if somebody changes what a rank earns and
// rebuilds, this changes with it or it does not change at all.
//
// That matters more here than on the other promos. This one tells people what
// they are owed, and a rank showing the wrong number is somebody arriving at the
// mint page expecting three cards and finding one.
//
// The wall behind it is the same one the rest of the promos use.

import { readFileSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";
import sharp from "sharp";

import { RANKS } from "@/lib/crooks";
import { SET } from "@/lib/set";

const OUT = process.argv.find((a) => a.endsWith(".png")) ?? "promo/crooks-mints.png";
const W = 1600;
const SCALE = 2;
const SITE = "http://localhost:3000";

interface Grant {
  address: string;
  mints: number;
  why: string;
  programme?: string;
}

/** What each rank earns, read back out of the grants rather than restated. */
function ladder(): { name: string; from: number; mints: number; holders: number }[] {
  const grants = (
    JSON.parse(readFileSync("data/granted-mints.json", "utf8")) as { grants: Grant[] }
  ).grants.filter((one) => one.programme === "crooks");

  const rows: { name: string; from: number; mints: number; holders: number }[] = [];
  for (const rank of RANKS) {
    // The rank is in the reason line, which is where it was written when the
    // grant was made. Reading it back means the picture describes the grants
    // that exist rather than the rule they were supposed to follow.
    const mine = grants.filter((one) => one.why.startsWith(`Crooks Finance ${rank.name} —`));
    if (mine.length === 0) continue;
    const mints = mine[0]!.mints;
    if (mine.some((one) => one.mints !== mints)) {
      throw new Error(`${rank.name} has grants of different sizes, so there is no one number to show.`);
    }
    rows.push({ name: rank.name, from: rank.from, mints, holders: mine.length });
  }
  return rows;
}

function page(rows: ReturnType<typeof ladder>, holders: number, mints: number): string {
  const wall = SET.map(
    (card) => `<img src="${SITE}/render/${card.id}.webp" loading="eager" decoding="sync" alt="">`,
  ).join("");

  // Highest first: the ladder is read from the top by the people who care most
  // about it, and the biggest number should not be hidden at the bottom.
  const tiers = [...rows]
    .reverse()
    .map(
      (row) => `
      <div class="tier">
        <div class="rank">${row.name.toUpperCase()}</div>
        <div class="need">${row.from}+ LEGENDS</div>
        <div class="gets">${row.mints}<span class="unit">card${row.mints === 1 ? "" : "s"}</span></div>
      </div>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${W}px; overflow: hidden; position: relative;
         background: #050314; font-family: "JetBrains Mono", ui-monospace, monospace; }

  .wall { position: absolute; inset: -22%; display: grid;
          grid-template-columns: repeat(32, 1fr); gap: 5px;
          transform: rotate(-9deg) scale(1.08); transform-origin: center; }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  .scrim { position: absolute; inset: 0; background:
    linear-gradient(180deg, rgba(5,3,20,0.90) 0%, rgba(5,3,20,0.62) 30%, rgba(5,3,20,0.90) 100%),
    radial-gradient(76% 62% at 50% 44%, rgba(5,3,20,0.30) 0%, rgba(5,3,20,0.84) 100%); }
  .tint { position: absolute; inset: 0; mix-blend-mode: soft-light;
    background: radial-gradient(80% 70% at 50% 38%, #9d4edd 0%, rgba(157,78,221,0) 64%); }

  .sheet { position: absolute; inset: 0; padding: 92px 84px;
           display: flex; flex-direction: column; align-items: center; justify-content: center; }

  .kicker { font-size: 19px; letter-spacing: 0.34em; color: #ffd700; font-weight: 700;
            text-align: center; }
  h1 { font-family: "Archivo Black", sans-serif; font-size: 96px; line-height: 0.92; color: #fff;
       letter-spacing: -0.02em; margin-top: 18px; text-align: center; }
  .sub { margin-top: 18px; font-size: 21px; color: #cdbfe4; text-align: center; }

  /* Two columns of five. Ten rows down one side leaves the type too small to
     read at the size a timeline shows this. */
  .tiers { margin-top: 44px; width: 100%; display: grid; grid-template-columns: 1fr 1fr;
           gap: 12px 16px; }
  .tier { display: flex; align-items: baseline; gap: 14px; padding: 18px 22px;
          border: 1px solid rgba(157,78,221,0.40); background: rgba(8,5,26,0.84);
          border-radius: 4px; }
  .rank { font-family: "Archivo Black", sans-serif; font-size: 25px; color: #fff;
          letter-spacing: -0.01em; white-space: nowrap; }
  .need { font-size: 13px; letter-spacing: 0.14em; color: #8a7cab; white-space: nowrap; }
  .gets { margin-left: auto; font-family: "Archivo Black", sans-serif; font-size: 30px;
          color: #00e08a; white-space: nowrap; }
  .unit { font-family: "JetBrains Mono", monospace; font-size: 13px; letter-spacing: 0.1em;
          color: #b9a8d6; margin-left: 7px; }

  .foot { margin-top: 44px; display: flex; align-items: baseline; justify-content: space-between;
          width: 100%; font-size: 17px; letter-spacing: 0.28em; font-weight: 700; }
  .site { color: #00e08a; }
  .tally { color: #8a7cab; }

  .kicker, h1, .sub, .foot { text-shadow: 0 2px 20px rgba(5,3,20,0.92); }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="sheet">
    <div class="kicker">FOR CROOKS FINANCE HOLDERS</div>
    <h1>YOUR RANK,<br>YOUR FREE CARDS</h1>
    <div class="sub">Hold Crooks Legends? Claim your Cards of Cronos at cardsofcronos.com/mint</div>
    <div class="tiers">${tiers}</div>
    <div class="foot">
      <span class="site">CARDSOFCRONOS.COM/MINT</span>
      <span class="tally">${holders} WALLETS · ${mints} FREE CARDS</span>
    </div>
  </div>
</body></html>`;
}

async function main() {
  const rows = ladder();
  const holders = rows.reduce((sum, row) => sum + row.holders, 0);
  const mints = rows.reduce((sum, row) => sum + row.holders * row.mints, 0);

  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: SCALE });
  await tab.setContent(page(rows, holders, mints), { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: W } });
  await browser.close();

  writeFileSync(OUT, shot);
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  const { size } = await sharp(shot).jpeg({ quality: 92, mozjpeg: true }).toFile(jpg);

  for (const row of [...rows].reverse()) {
    console.log(
      `  ${row.name.padEnd(15)} ${String(row.from).padStart(3)}+  ` +
        `${String(row.holders).padStart(3)} wallets × ${String(row.mints).padStart(2)} = ${String(row.holders * row.mints).padStart(4)}`,
    );
  }
  console.log(`\n  ${holders} wallets, ${mints} free cards`);
  console.log(`  ${jpg}  ${(size / 1024 / 1024).toFixed(2)} MB  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
