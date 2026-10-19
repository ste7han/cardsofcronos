// How much of $CROCARD is gone, as a square picture to post.
//
//   npm run burn-card [out.png]
//
// One subject only — the burn — where state-of-play has it as one figure of
// four. Read live: the supply and the burn address off the chain, what this game
// burned out of the burns table.
//
// ── TWO FIRES, DRAWN AS TWO ──────────────────────────────────────────────────
//
// The headline is everything at the burn address over the supply, because that
// is a fact about the token and the one people ask: how much of it is gone. But
// most of it was put there by the 2025 version, and /burn says so. So the
// picture splits it the same way the page does — the dead address minus the
// burns table is "the first version", the burns table is "this game" — and
// never lets the larger number pass for the work of the newer one.
//
// Every square is a million tokens and every segment is rounded DOWN, so the
// grid can show a little less than was burned and never more.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import sharp from "sharp";

import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector, word } from "@/lib/evm-tx";
import { BURN_ADDRESS, CROCARD } from "@/lib/revenue";
import { SET } from "@/lib/set";

const OUT = process.argv.find((a) => a.endsWith(".png")) ?? "promo/burned.png";
const W = 1600;
const SCALE = 2;
const SQUARE = 1_000_000n * 10n ** 18n;
const COLUMNS = 50;

function ask<T>(sql: string): T[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "cards-of-cronos", "--remote", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results as T[];
}

const whole = (wei: bigint) => (wei / 10n ** 18n).toLocaleString("en-US");

interface Burned {
  supply: bigint;
  dead: bigint;
  ours: bigint;
  before: bigint;
  buybacks: number;
}

async function gather(): Promise<Burned> {
  const call = async (data: string) =>
    BigInt(await rpc<string>(PUBLIC_RPCS, "eth_call", [{ to: CROCARD, data }, "latest"]));

  const [supply, dead] = await Promise.all([
    call(selector("totalSupply()")),
    call(selector("balanceOf(address)") + word(BURN_ADDRESS)),
  ]);

  // Summed in TypeScript: wei held as TEXT, and SUM() would go through a double.
  const burns = ask<{ burned: string }>("SELECT burned FROM burns");
  const ours = burns.reduce((sum, row) => sum + BigInt(row.burned), 0n);

  // If the table ever claims more than the address holds, something is wrong
  // with the table, and the picture is not the place to find out.
  if (ours > dead) {
    throw new Error(`the burns table says ${whole(ours)}, the burn address holds ${whole(dead)}`);
  }

  return { supply, dead, ours, before: dead - ours, buybacks: burns.length };
}

/** Two decimals, cut rather than rounded, so 12.996% reads 12.99%. */
function percent(part: bigint, of: bigint): string {
  const hundredths = (part * 10_000n) / of;
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}

function page(burned: Burned): string {
  const render = (id: string) => pathToFileURL(resolve("public/render", `${id}.webp`)).href;
  const wall = SET.map((card) => `<img src="${render(card.id)}" loading="eager" decoding="sync" alt="">`).join("");

  const total = Number(burned.supply / SQUARE);
  const before = Number(burned.before / SQUARE);
  const ours = Number(burned.ours / SQUARE);
  const squares = Array.from({ length: total }, (_, i) =>
    i < before ? `<i class="old"></i>` : i < before + ours ? `<i class="new"></i>` : `<i></i>`,
  ).join("");

  const [whole_, fraction] = percent(burned.dead, burned.supply).split(".");
  const when = new Date().toISOString().slice(0, 10);

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
          transform: rotate(-9deg) scale(1.08); transform-origin: center;
          filter: grayscale(0.6); }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  .scrim { position: absolute; inset: 0; background:
    linear-gradient(180deg, rgba(5,3,20,0.92) 0%, rgba(5,3,20,0.72) 40%, rgba(5,3,20,0.94) 100%); }
  .glow { position: absolute; inset: 0; mix-blend-mode: screen; background:
    radial-gradient(60% 34% at 50% 100%, rgba(255,90,20,0.34) 0%, rgba(255,90,20,0) 100%),
    radial-gradient(50% 30% at 50% 30%, rgba(157,78,221,0.22) 0%, rgba(157,78,221,0) 100%); }

  .sheet { position: absolute; inset: 0; padding: 96px 96px 88px;
           display: flex; flex-direction: column; align-items: center; }

  .kicker { font-size: 19px; letter-spacing: 0.36em; color: #ffd700; font-weight: 700; }
  .big { font-family: "Archivo Black", sans-serif; font-size: 260px; line-height: 0.9;
         letter-spacing: -0.04em; margin-top: 30px;
         background: linear-gradient(180deg, #ffe066 0%, #ff9a1f 48%, #ff4d1a 100%);
         -webkit-background-clip: text; background-clip: text; color: transparent;
         filter: drop-shadow(0 0 48px rgba(255,110,30,0.45)); }
  .big small { font-size: 130px; }
  .claim { font-family: "Archivo Black", sans-serif; font-size: 50px; color: #fff;
           letter-spacing: -0.01em; margin-top: 18px; text-align: center; line-height: 1.05; }
  .claim em { font-style: normal; color: #ff8a2a; }

  .grid { margin-top: 54px; display: grid; grid-template-columns: repeat(${COLUMNS}, 1fr);
          gap: 4px; width: 100%; }
  .grid i { aspect-ratio: 1; border-radius: 2px; background: rgba(157,78,221,0.16); }
  .grid i.old { background: #ffd700; box-shadow: 0 0 8px rgba(255,215,0,0.35); }
  .grid i.new { background: #ff5a1f; box-shadow: 0 0 10px rgba(255,90,31,0.75); }

  .key { margin-top: 18px; width: 100%; display: flex; justify-content: space-between;
         font-size: 15px; letter-spacing: 0.18em; color: #8a7cab; font-weight: 700; }

  .split { margin-top: 44px; width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .cell { padding: 28px 32px; border: 1px solid rgba(157,78,221,0.40);
          background: rgba(8,5,26,0.86); border-radius: 4px; }
  .label { font-size: 14px; letter-spacing: 0.26em; color: #8a7cab; font-weight: 700;
           display: flex; align-items: center; gap: 12px; }
  .label b { width: 14px; height: 14px; border-radius: 2px; display: inline-block; }
  .value { font-family: "Archivo Black", sans-serif; font-size: 52px; margin-top: 12px;
           letter-spacing: -0.02em; white-space: nowrap; }
  .old-v { color: #ffd700; } .new-v { color: #ff6a2a; }
  .note { margin-top: 10px; font-size: 16px; line-height: 1.5; color: #9d8fb8; }

  .foot { margin-top: auto; display: flex; align-items: baseline; justify-content: space-between;
          width: 100%; font-size: 17px; letter-spacing: 0.28em; font-weight: 700; }
  .site { color: #00e08a; }
  .when { color: #6f6390; }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="glow"></div>
  <div class="sheet">
    <div class="kicker">CARDS OF CRONOS · $CROCARD</div>
    <div class="big">${whole_}<small>.${fraction}%</small></div>
    <div class="claim">OF THE SUPPLY IS <em>BURNED</em>.<br>GONE FOR GOOD.</div>

    <div class="grid">${squares}</div>
    <div class="key">
      <span>ONE SQUARE = 1,000,000 $CROCARD</span>
      <span>${whole(burned.dead)} OF ${whole(burned.supply)}</span>
    </div>

    <div class="split">
      <div class="cell">
        <div class="label"><b style="background:#ffd700"></b>THE 2025 VERSION</div>
        <div class="value old-v">${whole(burned.before)}</div>
        <div class="note">Already at the burn address when this game began.</div>
      </div>
      <div class="cell">
        <div class="label"><b style="background:#ff5a1f"></b>THIS GAME</div>
        <div class="value new-v">${whole(burned.ours)}</div>
        <div class="note">${burned.buybacks} buybacks. Half of everything the game earns buys the token and destroys it.</div>
      </div>
    </div>

    <div class="foot">
      <span class="site">CARDSOFCRONOS.COM/BURN</span>
      <span class="when">READ FROM CHAIN · ${when}</span>
    </div>
  </div>
</body></html>`;
}

async function main() {
  const burned = await gather();

  // A file rather than setContent, so the card renders load straight off disk.
  const html = join(mkdtempSync(join(tmpdir(), "burn-card-")), "index.html");
  writeFileSync(html, page(burned));

  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: SCALE });
  await tab.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: W } });
  await browser.close();

  writeFileSync(OUT, shot);
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  const { size } = await sharp(shot).jpeg({ quality: 92, mozjpeg: true }).toFile(jpg);

  console.log(`  supply            ${whole(burned.supply).padStart(15)}`);
  console.log(`  at burn address   ${whole(burned.dead).padStart(15)}  ${percent(burned.dead, burned.supply)}%`);
  console.log(`    2025 version    ${whole(burned.before).padStart(15)}`);
  console.log(`    this game       ${whole(burned.ours).padStart(15)}  over ${burned.buybacks} buybacks`);
  console.log(`\n  ${jpg}  ${(size / 1024 / 1024).toFixed(2)} MB  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
