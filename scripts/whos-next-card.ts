// "Who's next?" — every Cronos project already in the game, and one empty slot.
//
//   npm run whos-next-card [out.png]
//
// The companion to scripts/partner-card.ts. That one states the terms; this one
// shows the company a project would be keeping. Same 16:9 for X, same palette,
// and the same rule: every number comes from the data. The count of projects is
// counted, not typed — a picture saying 43 next to a set holding 44 is the
// copy-drifts-from-the-number lesson in CLAUDE.md.
//
// ── ONE TILE PER PROJECT ─────────────────────────────────────────────────────
//
// The art of each project's rarest card, labelled with its name, in the order
// Set 01 lists them. The empty slot comes last in reading order, so the eye
// ends where the question is.

import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import sharp from "sharp";

import { TO_PARTNER_PERCENT } from "@/data/partner-sets";
import { RARITIES } from "@/engine/types";
import { SET } from "@/lib/set";

const OUT = process.argv.find((a) => a.endsWith(".png")) ?? "promo/whos-next.png";
const W = 1600;
const H = 900;
const SCALE = 2;
const COLUMNS = 11;

/** One card per project: its rarest, so each tile is that project at its best. */
function projects() {
  const best = new Map<string, (typeof SET)[number]>();
  for (const card of SET) {
    if (card.type !== "project") continue;
    const key = card.project as string;
    const held = best.get(key);
    if (!held || RARITIES.indexOf(card.rarity) > RARITIES.indexOf(held.rarity)) best.set(key, card);
  }
  return [...best.values()].map((card) => {
    const art = resolve("public/art", `${card.id}.webp`);
    // Loud rather than a blank tile: a project missing from the wall is the
    // one project that will notice.
    if (!existsSync(art)) throw new Error(`No art for ${card.id} (${card.name}).`);
    return { name: card.name, art: pathToFileURL(art).href };
  });
}

function page(): string {
  const all = projects();
  const slots = all.length + 1;
  if (slots % COLUMNS !== 0) {
    // Not fatal, but the last row would be ragged and the "?" would not sit in
    // the corner. Say so rather than ship a lopsided grid without noticing.
    console.warn(`  ${all.length} projects + 1 do not fill ${COLUMNS} columns evenly.`);
  }

  const tiles = all
    .map(
      (p) =>
        `<div class="tile"><div class="img" style="background-image:url('${p.art}')"></div><div class="n${p.name.length > 20 ? " long" : ""}">${p.name}</div></div>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
         background: #050314; font-family: "JetBrains Mono", ui-monospace, monospace; color: #fff; }
  .glow { position: absolute; inset: 0; background:
    radial-gradient(45% 50% at 12% 18%, rgba(157,78,221,0.30) 0%, rgba(157,78,221,0) 100%),
    radial-gradient(30% 35% at 94% 92%, rgba(255,215,0,0.20) 0%, rgba(255,215,0,0) 100%); }

  .head { position: absolute; left: 64px; right: 64px; top: 104px;
          display: flex; justify-content: space-between; align-items: flex-end; gap: 48px; }
  .kicker { font-size: 16px; letter-spacing: 0.34em; color: #ffd700; font-weight: 700; }
  h1 { font-family: "Archivo Black", sans-serif; font-size: 124px; line-height: 0.92;
       letter-spacing: -0.03em; margin-top: 18px; white-space: nowrap; }
  h1 em { font-style: normal;
          background: linear-gradient(180deg, #ffe066 0%, #ffd700 50%, #ff9a1f 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent; }
  .right { width: 640px; padding-bottom: 8px; }
  .lead { font-size: 20px; line-height: 1.5; color: #b9aed6; }
  .lead b { color: #fff; font-weight: 700; }
  .cta { margin-top: 22px; display: flex; align-items: center; gap: 20px; }
  .button { padding: 13px 22px; background: #ffd700; color: #050314; font-weight: 700;
            font-size: 17px; letter-spacing: 0.22em; border-radius: 3px; }
  .site { font-size: 17px; letter-spacing: 0.22em; font-weight: 700; color: #00e08a; }

  .grid { position: absolute; left: 64px; right: 64px; bottom: 72px;
          display: grid; grid-template-columns: repeat(${COLUMNS}, 1fr); gap: 9px; }
  .tile { border: 1px solid rgba(157,78,221,0.40); background: rgba(8,5,26,0.9);
          border-radius: 4px; overflow: hidden; }
  .tile .img { aspect-ratio: 1200 / 670; background-size: cover; background-position: center; }
  .tile .n { height: 26px; display: flex; align-items: center; padding: 0 5px; font-size: 9.5px; font-weight: 700; letter-spacing: 0;
             color: #d9d0ee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* A name that would otherwise be cut off: a project reading its own name
     with an ellipsis in it is not being welcomed. */
  .tile .n.long { white-space: normal; font-size: 8.6px; line-height: 1.12; }

  .next { border: 2px dashed #ffd700; border-radius: 4px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center;
          background: radial-gradient(80% 70% at 50% 40%, #4a2a86 0%, #14103a 80%);
          box-shadow: 0 0 34px rgba(255,215,0,0.45); }
  .next .q { font-family: "Archivo Black", sans-serif; font-size: 50px; line-height: 1; color: #ffd700;
             text-shadow: 0 0 22px rgba(255,215,0,0.6); }
  .next .t { margin-top: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; }
</style></head><body>
  <div class="glow"></div>

  <div class="head">
    <div>
      <div class="kicker">CARDS OF CRONOS · SET 01</div>
      <h1>WHO&rsquo;S <em>NEXT?</em></h1>
    </div>
    <div class="right">
      <p class="lead"><b>${all.length} Cronos projects</b> are already cards in the game. Yours can be next: a set of its own, played in the same decks, with <b>${TO_PARTNER_PERCENT}% of every mint</b> going to your project.</p>
      <div class="cta">
        <div class="button">APPLY</div>
        <div class="site">CARDSOFCRONOS.COM/PARTNERS</div>
      </div>
    </div>
  </div>

  <div class="grid">
    ${tiles}
    <div class="next"><div class="q">?</div><div class="t">YOUR PROJECT</div></div>
  </div>
</body></html>`;
}

async function main() {
  // A file rather than setContent, so the art loads straight off disk.
  const html = join(mkdtempSync(join(tmpdir(), "whos-next-")), "index.html");
  writeFileSync(html, page());

  // Playwright's own browser when it is installed, the machine's Chrome when it
  // is not — a promo picture is not worth a hundred-megabyte download.
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  await tab.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();

  writeFileSync(OUT, shot);
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  const { size } = await sharp(shot).jpeg({ quality: 92, mozjpeg: true }).toFile(jpg);
  console.log(`\n  ${jpg}  ${(size / 1024 / 1024).toFixed(2)} MB  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
