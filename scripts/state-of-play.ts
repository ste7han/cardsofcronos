// Where the project stands, in four figures, as a square picture to post.
//
//   npm run state-of-play [out.png]
//
// Minting, burning, and the two ways money reaches players: the holder drop and
// the weekly prize. Read live — the chain for what the contracts hold and have
// paid, the database for what has been burned and won.
//
// ── NOTHING IS TYPED AND NOTHING IS ROUNDED UP ───────────────────────────────
//
// A progress picture is the one most tempting to flatter, and the one people
// check. So every figure here is read rather than written, and where a number
// could be told two ways the smaller one is shown:
//
//   BURNED is what THIS GAME burned, out of the burns table, and not the balance
//   at the burn address — that address already held 89 million $CROCARD before
//   this project sent any, and quoting it would be claiming somebody else's fire
//   as our own.
//
//   PAID TO HOLDERS is `paidOut()`, what has actually left the contract. Not
//   what has been promised, which is larger and which nobody has in their hands.
//
//   WON is the sum of tournament_paid, which carries a transaction hash per row,
//   so every dollar on that line is one somebody can look up.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { chromium } from "playwright";
import sharp from "sharp";

import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector, word } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD, LION } from "@/lib/revenue";
import { SET } from "@/lib/set";

const OUT = process.argv.find((a) => a.endsWith(".png")) ?? "promo/state-of-play.png";
const W = 1600;
const SCALE = 2;
const SITE = "http://localhost:3000";

function ask<T>(sql: string): T[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "cards-of-cronos", "--remote", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results as T[];
}

/** Whole tokens, with thousands separators. Millions read better than decimals. */
const whole = (wei: bigint) => (wei / 10n ** 18n).toLocaleString("en-US");

/** Whole tokens above a thousand, two decimals below. See components/Tournament.tsx. */
function some(wei: bigint): string {
  const tokens = Number(wei / 10n ** 14n) / 10_000;
  return tokens >= 1_000
    ? Math.round(tokens).toLocaleString("en-US")
    : tokens.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

interface Figure {
  label: string;
  value: string;
  unit: string;
  /** The sentence under it. What the number means, not what it is called. */
  note: string;
  /** 0 to 1, or null for a figure that is not a fraction of anything. */
  bar: number | null;
}

async function gather(): Promise<Figure[]> {
  const rpcs = PUBLIC_RPCS;
  const nft = CONTRACTS.nft!;
  const drop = CONTRACTS.drop!;

  const call = async (to: string, data: string) =>
    BigInt(await rpc<string>(rpcs, "eth_call", [{ to, data }, "latest"]));

  const [minted, max, paidOut, promised] = await Promise.all([
    call(nft, selector("nextTokenId()")).then((n) => n - 1n),
    call(nft, selector("maxSupply()")),
    call(drop, selector("paidOut()")),
    // What the LIVE root promises, cumulatively. Not the contract's balance:
    // that also holds money nobody has been promised yet, and calling it
    // "waiting" would be telling holders it is theirs before it is.
    call(drop, selector("promised()")),
  ]);
  const claimable = promised > paidOut ? promised - paidOut : 0n;

  // Burned: this project's own, summed in TypeScript because both columns are
  // wei held as TEXT and SUM() over TEXT would quietly round through a double.
  const burns = ask<{ burned: string }>("SELECT burned FROM burns");
  const burned = burns.reduce((sum, row) => sum + BigInt(row.burned), 0n);

  const won = ask<{ token: string; wei: string }>("SELECT token, wei FROM tournament_paid");
  const wonCard = won
    .filter((row) => row.token.toLowerCase() === CROCARD.toLowerCase())
    .reduce((sum, row) => sum + BigInt(row.wei), 0n);
  const wonLion = won
    .filter((row) => row.token.toLowerCase() === LION.toLowerCase())
    .reduce((sum, row) => sum + BigInt(row.wei), 0n);

  return [
    {
      label: "CARDS MINTED",
      value: Number(minted).toLocaleString("en-US"),
      unit: `of ${Number(max).toLocaleString("en-US")}`,
      note: "Set 01 is fixed in the contract. There will never be more.",
      bar: Number(minted) / Number(max),
    },
    {
      label: "$CROCARD BURNED",
      value: whole(burned),
      unit: `over ${burns.length} buybacks`,
      note: "Half of everything the game earns buys the token and destroys it.",
      bar: null,
    },
    {
      label: "PAID TO HOLDERS",
      value: whole(paidOut),
      unit: `${whole(claimable)} claimable now`,
      // No bar. A pot that grows every day has no finish line, and a bar drawn
      // against a moving denominator says "almost nowhere" for ever.
      note: "Three tenths of what the game earns, shared by what you hold.",
      bar: null,
    },
    {
      label: "WON ON THE BOARDS",
      value: whole(wonCard),
      unit: wonLion > 0n ? `+ ${some(wonLion)} $LION` : "so far",
      note: "A fifth of earnings becomes the weekly prize. Beat the opponent to take it.",
      bar: null,
    },
  ];
}

function page(figures: Figure[]): string {
  const wall = SET.map(
    (card) => `<img src="${SITE}/render/${card.id}.webp" loading="eager" decoding="sync" alt="">`,
  ).join("");

  const cells = figures
    .map(
      (one) => `
      <div class="cell">
        <div class="label">${one.label}</div>
        <div class="value">${one.value}<span class="unit">${one.unit}</span></div>
        ${
          one.bar === null
            ? ""
            : `<div class="track"><div class="fill" style="width:${Math.max(1.5, one.bar * 100).toFixed(1)}%"></div></div>`
        }
        <div class="note">${one.note}</div>
      </div>`,
    )
    .join("");

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
          transform: rotate(-9deg) scale(1.08); transform-origin: center; }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  .scrim { position: absolute; inset: 0; background:
    linear-gradient(180deg, rgba(5,3,20,0.90) 0%, rgba(5,3,20,0.60) 28%, rgba(5,3,20,0.90) 100%),
    radial-gradient(76% 62% at 50% 46%, rgba(5,3,20,0.28) 0%, rgba(5,3,20,0.84) 100%); }
  .tint { position: absolute; inset: 0; mix-blend-mode: soft-light;
    background: radial-gradient(80% 70% at 50% 38%, #9d4edd 0%, rgba(157,78,221,0) 64%); }

  .sheet { position: absolute; inset: 0; padding: 104px 88px;
           display: flex; flex-direction: column; align-items: center; justify-content: center; }

  .kicker { font-size: 19px; letter-spacing: 0.36em; color: #ffd700; font-weight: 700; }
  h1 { font-family: "Archivo Black", sans-serif; font-size: 104px; line-height: 0.92; color: #fff;
       letter-spacing: -0.02em; margin-top: 16px; text-align: center; }

  .grid { margin-top: 56px; width: 100%; display: grid; grid-template-columns: 1fr 1fr;
          gap: 20px; }
  .cell { padding: 34px 34px 30px; border: 1px solid rgba(157,78,221,0.40);
          background: rgba(8,5,26,0.86); border-radius: 4px; }
  .label { font-size: 14px; letter-spacing: 0.26em; color: #8a7cab; font-weight: 700; }
  .value { font-family: "Archivo Black", sans-serif; font-size: 62px; color: #00e08a;
           margin-top: 14px; letter-spacing: -0.02em; white-space: nowrap; }
  .unit { font-family: "JetBrains Mono", monospace; font-size: 16px; letter-spacing: 0.08em;
          color: #b9a8d6; margin-left: 12px; }
  .track { margin-top: 18px; height: 6px; background: rgba(157,78,221,0.22); border-radius: 3px;
           overflow: hidden; }
  .fill { height: 100%; background: #00e08a; }
  .note { margin-top: 16px; font-size: 16px; line-height: 1.5; color: #9d8fb8; }

  .foot { margin-top: 52px; display: flex; align-items: baseline; justify-content: space-between;
          width: 100%; font-size: 17px; letter-spacing: 0.28em; font-weight: 700; }
  .site { color: #00e08a; }
  .when { color: #6f6390; }

  .kicker, h1, .foot { text-shadow: 0 2px 20px rgba(5,3,20,0.92); }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="sheet">
    <div class="kicker">CARDS OF CRONOS</div>
    <h1>WHERE IT<br>STANDS</h1>
    <div class="grid">${cells}</div>
    <div class="foot">
      <span class="site">CARDSOFCRONOS.COM</span>
      <span class="when">READ FROM CHAIN · ${when}</span>
    </div>
  </div>
</body></html>`;
}

async function main() {
  const figures = await gather();

  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: SCALE });
  await tab.setContent(page(figures), { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: W } });
  await browser.close();

  writeFileSync(OUT, shot);
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  const { size } = await sharp(shot).jpeg({ quality: 92, mozjpeg: true }).toFile(jpg);

  for (const one of figures) {
    console.log(`  ${one.label.padEnd(20)} ${one.value.padStart(12)}  ${one.unit}`);
  }
  console.log(`\n  ${jpg}  ${(size / 1024 / 1024).toFixed(2)} MB  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
