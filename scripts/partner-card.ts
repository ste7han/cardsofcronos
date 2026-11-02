// The invitation to /partners, as a picture to post on X.
//
//   npm run partner-card [out.png]
//
// 16:9 because that is what X shows uncropped in a timeline. Nothing is read
// off the chain: every figure is data/partner-sets.ts and lib/revenue.ts, the
// same ones the page prints, so the picture cannot offer different terms from
// the page it points at. The two numbers that are not decided yet are not on
// it at all.
//
// ── THE EMPTY CARD ───────────────────────────────────────────────────────────
//
// Two real cards from Set 01 either side of a blank one with the project's
// name missing. The offer in one image: this is what the game looks like, and
// that slot is yours.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import sharp from "sharp";

import { TO_PARTNER_PERCENT } from "@/data/partner-sets";
import { DISCOUNT_CAP } from "@/lib/revenue";
import { PARTNER_PRICE_CRO, toPartner } from "@/lib/partners";
import { SET } from "@/lib/set";

const OUT = process.argv.find((a) => a.endsWith(".png")) ?? "promo/partners.png";
const W = 1600;
const H = 900;
const SCALE = 2;

const render = (id: string) => pathToFileURL(resolve("public/render", `${id}.webp`)).href;

function page(): string {
  const wall = SET.map((card) => `<img src="${render(card.id)}" loading="eager" decoding="sync" alt="">`).join("");
  // The two biggest cards in the set, so the ones beside the blank are the
  // ones that look most like something to want.
  const mythics = SET.filter((card) => card.rarity === "mythic");
  const [left, right] = [mythics[0] ?? SET[0]!, mythics[1] ?? SET[1]!];

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
         background: #050314; font-family: "JetBrains Mono", ui-monospace, monospace; color: #fff; }

  .wall { position: absolute; inset: -30%; display: grid;
          grid-template-columns: repeat(34, 1fr); gap: 5px;
          transform: rotate(-9deg) scale(1.05); transform-origin: center;
          filter: grayscale(0.7); }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }
  .scrim { position: absolute; inset: 0; background:
    linear-gradient(90deg, rgba(5,3,20,0.97) 0%, rgba(5,3,20,0.90) 52%, rgba(5,3,20,0.72) 100%); }
  .glow { position: absolute; inset: 0; mix-blend-mode: screen; background:
    radial-gradient(40% 55% at 78% 50%, rgba(157,78,221,0.42) 0%, rgba(157,78,221,0) 100%),
    radial-gradient(30% 40% at 78% 55%, rgba(255,215,0,0.16) 0%, rgba(255,215,0,0) 100%); }

  .copy { position: absolute; left: 88px; top: 50%; transform: translateY(-50%); width: 840px;
          display: flex; flex-direction: column; }
  .kicker { font-size: 17px; letter-spacing: 0.34em; color: #ffd700; font-weight: 700; }
  h1 { font-family: "Archivo Black", sans-serif; font-size: 96px; line-height: 0.95;
       letter-spacing: -0.03em; margin-top: 26px; }
  h1 em { font-style: normal;
          background: linear-gradient(180deg, #ffe066 0%, #ffd700 50%, #ff9a1f 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent; }
  .lead { margin-top: 26px; font-size: 22px; line-height: 1.5; color: #b9aed6; max-width: 760px; }

  .facts { margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .fact { padding: 20px 22px; border: 1px solid rgba(157,78,221,0.45);
          background: rgba(8,5,26,0.88); border-radius: 4px; }
  .fact .v { font-family: "Archivo Black", sans-serif; font-size: 44px; letter-spacing: -0.02em;
             color: #ffd700; white-space: nowrap; }
  .fact .v small { font-size: 24px; }
  .fact .l { margin-top: 8px; font-size: 14px; line-height: 1.45; color: #9d8fb8; }

  .cta { margin-top: 48px; display: flex; align-items: center; gap: 22px; }
  .button { padding: 16px 26px; background: #ffd700; color: #050314; font-weight: 700;
            font-size: 19px; letter-spacing: 0.22em; border-radius: 3px; }
  .site { font-size: 19px; letter-spacing: 0.24em; font-weight: 700; color: #00e08a; }

  .fan { position: absolute; right: 70px; top: 50%; width: 600px; height: 560px;
         transform: translateY(-50%); }
  .card { position: absolute; top: 60px; width: 268px; aspect-ratio: 1072 / 1676; border-radius: 14px;
          box-shadow: 0 24px 50px rgba(0,0,0,0.7); }
  .card img { width: 100%; height: 100%; object-fit: cover; border-radius: 14px; }
  .c1 { left: 0; transform: rotate(-11deg); }
  .c3 { right: 0; transform: rotate(11deg); }
  .c2 { left: 50%; top: 20px; width: 300px; margin-left: -150px; z-index: 2;
        border: 3px dashed #ffd700; background:
          radial-gradient(80% 60% at 50% 35%, #4a2a86 0%, #14103a 70%);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; box-shadow: 0 0 60px rgba(255,215,0,0.30), 0 30px 60px rgba(0,0,0,0.75); }
  .c2 .q { font-family: "Archivo Black", sans-serif; font-size: 150px; line-height: 1; color: #ffd700;
           text-shadow: 0 0 40px rgba(255,215,0,0.55); }
  .c2 .t { margin-top: 14px; font-family: "Archivo Black", sans-serif; font-size: 30px; line-height: 1.05; }
  .c2 .s { margin-top: 12px; font-size: 13px; letter-spacing: 0.28em; color: #b9aed6; font-weight: 700; }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="glow"></div>

  <div class="copy">
    <div class="kicker">CARDS OF CRONOS · FOR PROJECTS</div>
    <h1>YOUR PROJECT,<br><em>AS A SET.</em></h1>
    <p class="lead">We make a set of cards about your project and mint it into a game people play on Cronos. Your cards, in their decks, next to Set 01.</p>

    <div class="facts">
      <div class="fact">
        <div class="v">${TO_PARTNER_PERCENT}%</div>
        <div class="l">of every mint goes to your project, in CRO</div>
      </div>
      <div class="fact">
        <div class="v">${toPartner(PARTNER_PRICE_CRO)}<small> CRO</small></div>
        <div class="l">to you per card, from a ${PARTNER_PRICE_CRO} CRO mint</div>
      </div>
      <div class="fact">
        <div class="v">${DISCOUNT_CAP}%<small> OFF</small></div>
        <div class="l">for holders of your token, at most</div>
      </div>
    </div>

    <div class="cta">
      <div class="button">APPLY</div>
      <div class="site">CARDSOFCRONOS.COM/PARTNERS</div>
    </div>
  </div>

  <div class="fan">
    <div class="card c1"><img src="${render(left.id)}" alt=""></div>
    <div class="card c3"><img src="${render(right.id)}" alt=""></div>
    <div class="card c2">
      <div class="q">?</div>
      <div class="t">YOUR<br>PROJECT</div>
      <div class="s">NEW SET</div>
    </div>
  </div>
</body></html>`;
}

async function main() {
  // A file rather than setContent, so the card renders load straight off disk.
  const html = join(mkdtempSync(join(tmpdir(), "partner-card-")), "index.html");
  writeFileSync(html, page());

  const browser = await chromium.launch();
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
