// The week's winners, as a square picture to post.
//
//   npx tsx scripts/weekly-winners.ts                 # the week just settled
//   npx tsx scripts/weekly-winners.ts 2026-W39
//   npx tsx scripts/weekly-winners.ts 2026-W39 out.png
//
// ── IT READS THE WEEK, IT DOES NOT TAKE IT ───────────────────────────────────
//
// Every figure on the picture comes out of the database: who won each board,
// what they beat the opponent by, and what was actually paid — the payout rows
// carry the transaction hash, so what is drawn is what moved. Typing the numbers
// in would take a minute and would be wrong the first week nobody checked, which
// is the failure this project already paid for with eight card images showing
// numbers the data no longer had.
//
// A board with a pot of its own shows both of its prizes. Loaded Lions wins
// $CROCARD out of the shared pot and $LION out of the one its entry fees fill,
// and a picture showing one of them tells half the week.
//
// The wall behind it is the same one the other promos use: every card in the
// set, tilted and run off all four edges.

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { chromium } from "playwright";
import sharp from "sharp";

import { BOARDS } from "@/data/boards";
import { formatMCExact } from "@/engine/format";
import { lastWeek } from "@/lib/publisher";
import { SET } from "@/lib/set";
import { CROCARD } from "@/lib/revenue";

const args = process.argv.slice(2);
const WEEK = args.find((a) => /^\d{4}-W\d{2}$/.test(a)) ?? lastWeek(Date.now());
const OUT = args.find((a) => a.endsWith(".png")) ?? `promo/winners-${WEEK}.png`;
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

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** Whole tokens above a thousand, two decimals below it. See components/Tournament.tsx. */
function amount(wei: string): string {
  const tokens = Number(BigInt(wei) / 10n ** 14n) / 10_000;
  return tokens >= 1_000
    ? Math.round(tokens).toLocaleString("en-US")
    : tokens.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

interface Won {
  board: string;
  name: string;
  wallet: string;
  mc: number;
  opponentMC: number;
  prizes: { amount: string; symbol: string }[];
}

function theWeek(): Won[] {
  // The winner of each board, by the rule the board itself ranks by: the margin.
  const scores = ask<{ board: string; wallet: string; mc: number; opponent_mc: number }>(
    `SELECT board, wallet, mc, opponent_mc FROM tournament WHERE week = '${WEEK}'
      ORDER BY board, mc - opponent_mc DESC, at ASC`,
  );
  const paid = ask<{ board: string; token: string; wei: string }>(
    `SELECT board, token, wei FROM tournament_paid WHERE week = '${WEEK}'`,
  );

  const won: Won[] = [];
  for (const board of BOARDS) {
    const top = scores.find((row) => row.board === board.id);
    if (top === undefined) continue;

    // In the order the money means something: the shared pot first, then the
    // board's own. Named from the board data so a token cannot be mislabelled.
    const prizes: { amount: string; symbol: string }[] = [];
    const main = paid.find(
      (row) => row.board === board.id && row.token.toLowerCase() === CROCARD.toLowerCase(),
    );
    if (main) prizes.push({ amount: amount(main.wei), symbol: "$CROCARD" });
    if (board.alsoPays !== null) {
      const own = paid.find(
        (row) =>
          row.board === board.id &&
          row.token.toLowerCase() === board.alsoPays!.token.toLowerCase(),
      );
      if (own) prizes.push({ amount: amount(own.wei), symbol: board.alsoPays.symbol });
    }

    won.push({
      board: board.id,
      name: board.name,
      wallet: top.wallet,
      mc: top.mc,
      opponentMC: top.opponent_mc,
      prizes,
    });
  }
  return won;
}

function page(won: Won[]): string {
  const wall = SET.map(
    (card) => `<img src="${SITE}/render/${card.id}.webp" loading="eager" decoding="sync" alt="">`,
  ).join("");

  // One wallet on every board is worth saying out loud; two is just a list.
  const swept = won.length > 1 && new Set(won.map((one) => one.wallet)).size === 1;
  const week = Number(WEEK.split("-W")[1]);

  const blocks = won
    .map(
      (one) => `
    <div class="board">
      <div class="who">
        <div class="name">${one.name.toUpperCase()}</div>
        <div class="wallet">${short(one.wallet)}</div>
        <div class="line">
          ${formatMCExact(one.mc)} <span class="beat">beat</span> ${formatMCExact(one.opponentMC)}
          <span class="margin">+${formatMCExact(one.mc - one.opponentMC)}</span>
        </div>
      </div>
      <div class="prizes">
        ${one.prizes
          .map(
            (prize, i) =>
              `<div class="prize${i > 0 ? " extra" : ""}">${i > 0 ? "+ " : ""}${prize.amount} <span class="sym">${prize.symbol}</span></div>`,
          )
          .join("")}
        ${one.prizes.length === 0 ? '<div class="prize unpaid">NOT PAID YET</div>' : ""}
      </div>
    </div>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${W}px; overflow: hidden; position: relative;
    background: #050314; font-family: "JetBrains Mono", ui-monospace, monospace;
  }

  /* The same wall as the other promos: every card, tilted, running off all four
     edges so it reads as "there is more of this" rather than as a screenshot. */
  .wall { position: absolute; inset: -22%; display: grid;
          grid-template-columns: repeat(32, 1fr); gap: 5px;
          transform: rotate(-9deg) scale(1.08); transform-origin: center; }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  /* Dimmed enough to read over and no further.
     The first version buried the wall completely — a black square with text on
     it, which loses the one thing this background is for. The panels behind the
     two results carry their own ground, so the scrim only has to protect the
     headline and the footer, and those sit where the gradient is darkest. */
  .scrim { position: absolute; inset: 0; background:
    linear-gradient(180deg, rgba(5,3,20,0.80) 0%, rgba(5,3,20,0.44) 40%, rgba(5,3,20,0.86) 100%),
    radial-gradient(78% 64% at 50% 44%, rgba(5,3,20,0.18) 0%, rgba(5,3,20,0.78) 100%); }
  .tint { position: absolute; inset: 0; mix-blend-mode: soft-light;
    background: radial-gradient(80% 70% at 50% 40%, #9d4edd 0%, rgba(157,78,221,0) 65%); }

  .sheet { position: absolute; inset: 0; display: flex; flex-direction: column;
           align-items: center; justify-content: center; padding: 96px 88px; }

  /* Every line outside a panel carries its own shadow. Letting the wall show
     through is the point of the picture, and it costs legibility exactly where
     a card happens to be bright — the subtitle sat over four pale cards and
     half of it disappeared. The panels below do not need this: they have a
     ground of their own. */
  .eyebrow, h1, .sub, .foot {
    text-shadow: 0 2px 18px rgba(5,3,20,0.95), 0 0 46px rgba(5,3,20,0.85);
  }

  .eyebrow { font-size: 19px; letter-spacing: 0.42em; color: #ffd700; font-weight: 700; }
  h1 { font-family: "Archivo Black", sans-serif; font-size: 118px; line-height: 0.9;
       color: #fff; letter-spacing: -0.02em; margin-top: 18px; text-align: center; }
  .sub { margin-top: 20px; font-size: 20px; letter-spacing: 0.16em; color: #b9a8d6;
         text-align: center; }

  .boards { margin-top: 56px; width: 100%; display: flex; flex-direction: column; gap: 26px; }
  .board { display: flex; align-items: center; justify-content: space-between; gap: 40px;
           padding: 34px 40px; border: 1px solid rgba(157,78,221,0.42);
           background: rgba(8,5,26,0.86); border-radius: 4px;
           backdrop-filter: blur(3px); }
  .name { font-size: 17px; letter-spacing: 0.3em; color: #ffd700; font-weight: 700; }
  .wallet { font-family: "Archivo Black", sans-serif; font-size: 44px; color: #fff;
            margin-top: 12px; letter-spacing: -0.01em; }
  .line { margin-top: 12px; font-size: 19px; color: #9d8fb8; }
  .beat { color: #6f6390; }
  .margin { color: #00e08a; font-weight: 700; margin-left: 10px; }

  .prizes { text-align: right; flex-shrink: 0; }
  .prize { font-family: "Archivo Black", sans-serif; font-size: 40px; color: #00e08a;
           white-space: nowrap; }
  .prize.extra { font-size: 31px; color: #ffd700; margin-top: 10px; }
  .prize.unpaid { font-size: 22px; color: #ff5470; font-family: "JetBrains Mono", monospace;
                  letter-spacing: 0.2em; }
  .sym { font-family: "JetBrains Mono", monospace; font-size: 0.5em; letter-spacing: 0.12em;
         color: #b9a8d6; margin-left: 8px; }

  .foot { margin-top: 58px; font-size: 17px; letter-spacing: 0.3em; color: #00e08a;
          font-weight: 700; }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="sheet">
    <div class="eyebrow">WEEK ${week} · PAID OUT</div>
    <h1>${swept ? "ONE WALLET<br>TOOK BOTH" : "THIS WEEK&rsquo;S<br>WINNERS"}</h1>
    <div class="sub">${swept ? short(won[0]!.wallet) + " won every board there was" : "Biggest win on each board takes the pot"}</div>
    <div class="boards">${blocks}</div>
    <div class="foot">CARDSOFCRONOS.COM</div>
  </div>
</body></html>`;
}

async function main() {
  const won = theWeek();
  if (won.length === 0) {
    throw new Error(`Nobody is on any board for ${WEEK}, so there is nothing to draw.`);
  }

  const browser = await chromium.launch();
  const tab = await browser.newPage({
    viewport: { width: W, height: W },
    deviceScaleFactor: SCALE,
  });
  await tab.setContent(page(won), { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: W } });
  await browser.close();

  writeFileSync(OUT, shot);
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  const { size } = await sharp(shot).jpeg({ quality: 92, mozjpeg: true }).toFile(jpg);

  console.log(`\n  ${WEEK}`);
  for (const one of won) {
    const prizes = one.prizes.map((p) => `${p.amount} ${p.symbol}`).join(" + ") || "not paid yet";
    console.log(`    ${one.name.padEnd(14)} ${short(one.wallet)}  +${formatMCExact(one.mc - one.opponentMC)}  ${prizes}`);
  }
  console.log(`\n  ${OUT}  ${W * SCALE}x${W * SCALE}`);
  console.log(`  ${jpg}  ${(size / 1024 / 1024).toFixed(2)} MB  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
