// What the mint brought in, and where every CRO of it went, as a square to post.
//
//   npm run mint-money [out.png]
//
// The mint is the CRO. The splitter turns CRO into $CROCARD and divides it
// 50/30/20 — burned, holders, the weekly prize — so the picture follows it
// through that one swap and then down each of the three branches to where it is
// now: at the burn address, paid out to holders or still claimable, won on the
// boards or still in the pot.
//
// ── THE SPLITTER DOES NOT KNOW WHO PAID IT ───────────────────────────────────
//
// Mints, royalties, ranked cuts and half of every board entry land in one
// balance and leave in one swap (see sourceOf in lib/revenue.ts). So the three
// branches are what EVERYTHING the game earned became, and the picture says so
// and shows the mint as its share of the input — rather than quietly calling
// the whole of the output "the mint money". Board entries are known from their
// own table; what is left after mints and entries is royalties, match cuts and
// anything anybody sent, and is named as that.
//
// ── WHERE THE NUMBERS COME FROM ──────────────────────────────────────────────
//
//   MINT CRO    every `Bought(to, amount, paid)` the collection has emitted,
//               read off the chain. Cached in node_modules/.cache so a second
//               run reads only the blocks since the first.
//   SWAPPED     the burns table: one row per `Released`, `wei` is croSpent and
//               `burned` is the half that went to the burn address. Holders and
//               pot are 3/10 and the rest of what was bought — derived from the
//               burn rather than stored, exactly as Splitter.sol derives them.
//   HOLDERS     `paidOut()` and `promised()` on the drop.
//   POT         tournament_paid for what was won, the pot's own balance for
//               what is left.
//
// Every figure is cut, never rounded up.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import sharp from "sharp";

import { LOG_RPCS, PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector, word } from "@/lib/evm-tx";
import { BOUGHT, logsBetween, wordAt } from "@/lib/feed";
import { CONTRACTS, CROCARD } from "@/lib/revenue";
import { SET } from "@/lib/set";

const OUT = process.argv.find((a) => a.endsWith(".png")) ?? "promo/mint-money.png";
const W = 1600;
const SCALE = 2;
const CACHE = "node_modules/.cache/mint-money.json";

/** The widest range evm.cronos.org will answer. See lib/feed.ts. */
const CHUNK = 2000;
/**
 * One request at a time, with a pause between them.
 *
 * evm.cronos.org sits behind Cloudflare and answers a burst with error 1015 — an
 * HTML page, not JSON — and then refuses everything for a while. Six lanes got
 * a minute in; three did not get past finding the deploy block. Slow and
 * finished beats fast and banned, and the cache means it is slow once.
 */
const LANES = 1;
const PAUSE = 300;

const E18 = 10n ** 18n;

function ask<T>(sql: string): T[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "cards-of-cronos", "--remote", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results as T[];
}

const whole = (wei: bigint) => (wei / E18).toLocaleString("en-US");
const sum = (rows: readonly { [k: string]: string }[], key: string) =>
  rows.reduce((total, row) => total + BigInt(row[key]!), 0n);

// ── THE MINT, OFF THE CHAIN ─────────────────────────────────────────────────

interface Scanned {
  /** The block the collection was deployed in, and the last one read. */
  from: number;
  to: number;
  paid: string;
  cards: number;
  buys: number;
}

const call = async (to: string, data: string, at = "latest") =>
  BigInt(await rpc<string>(PUBLIC_RPCS, "eth_call", [{ to, data }, at]));

/** The first block with code at `address`. Binary search, about thirty asks. */
async function deployedAt(address: string, head: number): Promise<number> {
  let low = 0;
  let high = head;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const code = await patiently("finding the deploy block", () =>
      rpc<string>(LOG_RPCS, "eth_getCode", [address, "0x" + middle.toString(16)]),
    );
    if (code === "0x") low = middle + 1;
    else high = middle;
  }
  return low;
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Any ask of the log endpoint, retried with a growing pause when it is refused. */
async function patiently<T>(what: string, ask: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const answer = await ask();
      await wait(PAUSE);
      return answer;
    } catch (error) {
      if (attempt === 8) throw new Error(`${what}: ${(error as Error).message}`);
      await wait(5_000 * attempt);
    }
  }
}

const chunk = (nft: string, from: number, to: number) =>
  patiently(`blocks ${from}–${to}`, () => logsBetween(LOG_RPCS, nft, [BOUGHT], from, to));

async function mintIncome(): Promise<Scanned> {
  const nft = CONTRACTS.nft!;
  const head = Number(
    BigInt(await patiently("the head block", () => rpc<string>(LOG_RPCS, "eth_blockNumber", []))),
  );

  let scanned: Scanned;
  if (existsSync(CACHE)) {
    scanned = JSON.parse(readFileSync(CACHE, "utf8")) as Scanned;
  } else {
    const from = await deployedAt(nft, head);
    scanned = { from, to: from - 1, paid: "0", cards: 0, buys: 0 };
  }

  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(scanned, null, 2));

  const starts: number[] = [];
  for (let at = scanned.to + 1; at <= head; at += CHUNK) starts.push(at);
  if (starts.length > 0) console.log(`  reading ${starts.length} chunks of Bought logs…`);

  let paid = BigInt(scanned.paid);
  let { cards, buys } = scanned;
  for (let i = 0; i < starts.length; i += LANES) {
    const lane = starts.slice(i, i + LANES);
    const found = await Promise.all(lane.map((at) => chunk(nft, at, Math.min(head, at + CHUNK - 1))));
    for (const log of found.flat()) {
      cards += Number(wordAt(log.data, 0));
      paid += wordAt(log.data, 1);
      buys += 1;
    }
    // Saved as it goes, so a run the endpoint cuts off resumes rather than restarts.
    const to = Math.min(head, lane[lane.length - 1]! + CHUNK - 1);
    scanned = { ...scanned, to, paid: paid.toString(), cards, buys };
    writeFileSync(CACHE, JSON.stringify(scanned, null, 2));
    if ((i / LANES) % 100 === 0) process.stdout.write(`  ${Math.min(i + LANES, starts.length)}/${starts.length}\r`);
  }

  return scanned;
}

// ── EVERYTHING ELSE ─────────────────────────────────────────────────────────

interface Money {
  minted: number;
  boughtCards: number;
  buys: number;
  /** CRO, wei. */
  mints: bigint;
  entries: bigint;
  other: bigint;
  spent: bigint;
  waiting: bigint;
  releases: number;
  /** $CROCARD, base units. */
  burned: bigint;
  toHolders: bigint;
  toPot: bigint;
  paidOut: bigint;
  claimable: bigint;
  won: bigint;
  inPot: bigint;
}

async function gather(): Promise<Money> {
  const nft = CONTRACTS.nft!;
  const splitter = CONTRACTS.splitter!;
  const balance = async (at: string) => BigInt(await rpc<string>(PUBLIC_RPCS, "eth_getBalance", [at, "latest"]));

  const [scan, minted, atNft, atSplitter, paidOut, promised, inPot, prizeBps] = await Promise.all([
    mintIncome(),
    call(nft, selector("nextTokenId()")).then((n) => Number(n - 1n)),
    balance(nft),
    balance(splitter),
    call(CONTRACTS.drop!, selector("paidOut()")),
    call(CONTRACTS.drop!, selector("promised()")),
    call(CROCARD, selector("balanceOf(address)") + word(CONTRACTS.pot!)),
    call(CONTRACTS.lionEntry!, selector("prizeBps()")),
  ]);

  const burns = ask<{ wei: string; burned: string }>("SELECT wei, burned FROM burns");
  const spent = sum(burns, "wei");
  const burned = sum(burns, "burned");
  // Splitter.sol: burned is bought × 5000/10000, holders × 3000, the pot the rest.
  // Twice the burn is the purchase to within one base unit.
  const bought = burned * 2n;
  const toHolders = (bought * 3_000n) / 10_000n;
  const toPot = bought - toHolders - burned;

  // Only the share of an entry that is not buying $LION reaches the splitter.
  const entered = sum(ask<{ paid: string }>("SELECT paid FROM board_entries"), "paid");
  const entries = entered - (entered * prizeBps) / 10_000n;

  const won = sum(
    ask<{ wei: string }>(`SELECT wei FROM tournament_paid WHERE lower(token) = '${CROCARD.toLowerCase()}'`),
    "wei",
  );

  const mints = BigInt(scan.paid);
  // Everything that has ever arrived at the collection or the splitter is what
  // has been swapped plus what is sitting in either. Mints and entries are known;
  // the rest is royalties, match cuts and anything sent by hand.
  const waiting = atNft + atSplitter;
  const arrived = spent + waiting;
  const other = arrived - mints - entries;
  if (other < 0n) {
    throw new Error(
      `the mints (${whole(mints)}) and entries (${whole(entries)}) add up to more than ever arrived (${whole(arrived)})`,
    );
  }

  return {
    minted,
    boughtCards: scan.cards,
    buys: scan.buys,
    mints,
    entries,
    other,
    spent,
    waiting,
    releases: burns.length,
    burned,
    toHolders,
    toPot,
    paidOut,
    claimable: promised > paidOut ? promised - paidOut : 0n,
    won,
    inPot,
  };
}

// ── THE PICTURE ─────────────────────────────────────────────────────────────

const FLAME = "#ff5a1f";
const GREEN = "#00e08a";
const GOLD = "#ffd700";

/** Three ribbons out of one trunk, as wide as their share. */
function ribbons(): string {
  const width = 1408;
  const height = 160;
  const gap = 20;
  const column = (width - 2 * gap) / 3;
  const trunk = 560;
  const shares = [
    { part: 0.5, colour: FLAME },
    { part: 0.3, colour: GREEN },
    { part: 0.2, colour: GOLD },
  ];
  let left = (width - trunk) / 2;
  return `<svg class="flow" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>${shares
      .map(
        (one, i) => `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9d4edd" stop-opacity="0.55"/>
          <stop offset="1" stop-color="${one.colour}" stop-opacity="0.85"/></linearGradient>`,
      )
      .join("")}</defs>
    ${shares
      .map((one, i) => {
        const w = trunk * one.part;
        const x0 = left;
        left += w;
        const centre = i * (column + gap) + column / 2;
        const x1 = centre - w / 2;
        const bend = height / 2;
        return `<path fill="url(#g${i})" d="M${x0},0 L${x0 + w},0
          C${x0 + w},${bend} ${x1 + w},${bend} ${x1 + w},${height}
          L${x1},${height} C${x1},${bend} ${x0},${bend} ${x0},0 Z"/>`;
      })
      .join("")}
  </svg>`;
}

function page(money: Money): string {
  const render = (id: string) => pathToFileURL(resolve("public/render", `${id}.webp`)).href;
  const wall = SET.map((card) => `<img src="${render(card.id)}" loading="eager" decoding="sync" alt="">`).join("");

  const arrived = money.mints + money.entries + money.other;
  const pct = (part: bigint) => Number((part * 10_000n) / arrived) / 100;
  const free = money.minted - money.boughtCards;
  const when = new Date().toISOString().slice(0, 10);

  const inputs = [
    { name: "MINTS", value: money.mints, colour: "#b57bff" },
    { name: "BOARD ENTRIES", value: money.entries, colour: "#7a5aa8" },
    { name: "ROYALTIES & MATCH CUTS", value: money.other, colour: "#4e3a72" },
  ].filter((one) => one.value > 0n);

  const branch = (
    label: string,
    share: string,
    colour: string,
    value: bigint,
    cro: bigint,
    lines: [string, bigint][],
  ) => `
    <div class="cell" style="--c:${colour}">
      <div class="label"><span>${label}</span><span class="share">${share}</span></div>
      <div class="value">${whole(value)}</div>
      <div class="unit">$CROCARD · bought with ${whole(cro)} CRO</div>
      <div class="lines">${lines
        .map(([what, amount]) => `<div><span>${what}</span><b>${whole(amount)}</b></div>`)
        .join("")}</div>
    </div>`;

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
          transform: rotate(-9deg) scale(1.08); transform-origin: center; filter: grayscale(0.5); }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }
  .scrim { position: absolute; inset: 0; background:
    linear-gradient(180deg, rgba(5,3,20,0.93) 0%, rgba(5,3,20,0.80) 45%, rgba(5,3,20,0.95) 100%); }
  .glow { position: absolute; inset: 0; mix-blend-mode: screen; background:
    radial-gradient(55% 30% at 50% 22%, rgba(157,78,221,0.30) 0%, rgba(157,78,221,0) 100%); }

  .sheet { position: absolute; inset: 0; padding: 60px 96px 120px;
           display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .kicker { font-size: 19px; letter-spacing: 0.36em; color: ${GOLD}; font-weight: 700; }
  h1 { font-family: "Archivo Black", sans-serif; font-size: 72px; line-height: 0.95; color: #fff;
       letter-spacing: -0.01em; margin-top: 18px; text-align: center; }

  .hero { margin-top: 34px; font-family: "Archivo Black", sans-serif; font-size: 180px; line-height: 0.9;
          letter-spacing: -0.03em; color: #fff; display: flex; align-items: baseline; gap: 22px; }
  .hero .cro { font-size: 64px; color: #b57bff; letter-spacing: 0; }
  .sub { margin-top: 14px; font-size: 18px; letter-spacing: 0.14em; color: #b9a8d6; font-weight: 700; }

  .in { margin-top: 44px; width: 100%; }
  .bar { display: flex; height: 18px; border-radius: 3px; overflow: hidden; gap: 3px; }
  .bar i { display: block; height: 100%; }
  .legend { margin-top: 12px; display: flex; gap: 30px; font-size: 14px; letter-spacing: 0.16em;
            color: #9d8fb8; font-weight: 700; }
  .legend b { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 10px;
              vertical-align: -1px; }
  .legend em { font-style: normal; color: #fff; margin-left: 8px; }

  .swap { margin-top: 30px; padding: 18px 34px; border: 1px solid rgba(157,78,221,0.6);
          background: rgba(20,10,48,0.92); border-radius: 999px; text-align: center;
          font-size: 17px; letter-spacing: 0.16em; color: #d9ccf0; font-weight: 700; }
  .swap strong { font-family: "Archivo Black", sans-serif; font-size: 26px; letter-spacing: 0;
                 color: #fff; margin: 0 8px; font-weight: 400; }
  .flow { display: block; margin-top: -1px; }

  .split { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .cell { padding: 26px 26px 22px; border: 1px solid rgba(157,78,221,0.40); border-top: 4px solid var(--c);
          background: rgba(8,5,26,0.90); border-radius: 4px; }
  .label { display: flex; justify-content: space-between; font-size: 14px; letter-spacing: 0.24em;
           color: #8a7cab; font-weight: 700; }
  .share { color: var(--c); }
  .value { font-family: "Archivo Black", sans-serif; font-size: 48px; margin-top: 12px;
           letter-spacing: -0.02em; color: var(--c); white-space: nowrap; }
  .unit { margin-top: 6px; font-size: 13px; letter-spacing: 0.06em; color: #9d8fb8; }
  .lines { margin-top: 18px; border-top: 1px solid rgba(157,78,221,0.25); padding-top: 12px;
           display: grid; gap: 10px; font-size: 16px; color: #b9a8d6; }
  .lines div { display: flex; justify-content: space-between; }
  .lines b { color: #fff; font-weight: 700; }

  .note { margin-top: 26px; font-size: 15px; line-height: 1.5; color: #8a7cab; text-align: center; }
  .foot { position: absolute; left: 96px; right: 96px; bottom: 84px; display: flex;
          align-items: baseline; justify-content: space-between; font-size: 17px; letter-spacing: 0.28em; font-weight: 700; }
  .site { color: ${GREEN}; }
  .when { color: #6f6390; }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="glow"></div>
  <div class="sheet">
    <div class="kicker">CARDS OF CRONOS · SET 01</div>
    <h1>WHERE THE MINT MONEY WENT</h1>

    <div class="hero">${whole(money.mints)}<span class="cro">CRO</span></div>
    <div class="sub">RAISED BY ${money.boughtCards.toLocaleString("en-US")} PAID CARDS · ${free.toLocaleString("en-US")} MORE CLAIMED FREE</div>

    <div class="in">
      <div class="bar">${inputs
        .map((one) => `<i style="flex:${pct(one.value)};background:${one.colour}"></i>`)
        .join("")}</div>
      <div class="legend">${inputs
        .map((one) => `<span><b style="background:${one.colour}"></b>${one.name}<em>${whole(one.value)}</em></span>`)
        .join("")}</div>
    </div>

    <div class="swap">ALL OF IT BUYS $CROCARD FIRST ·<strong>${whole(money.spent)} CRO</strong>SWAPPED IN ${money.releases} BUYS${
      money.waiting > 0n ? ` · ${whole(money.waiting)} WAITING` : ""
    }</div>
    ${ribbons()}

    <div class="split">
      ${branch("BURNED", "50%", FLAME, money.burned, money.spent / 2n, [["Sent to 0x…dEaD", money.burned], ["Ever coming back", 0n]])}
      ${branch("HOLDERS", "30%", GREEN, money.toHolders, (money.spent * 3n) / 10n, [
        ["Claimed", money.paidOut],
        ["Claimable now", money.claimable],
      ])}
      ${branch("PRIZE POT", "20%", GOLD, money.toPot, money.spent - money.spent / 2n - (money.spent * 3n) / 10n, [
        ["Won on the boards", money.won],
        ["In the pot now", money.inPot],
      ])}
    </div>

    <div class="note">Nothing goes to the team. Every CRO is swapped for $CROCARD and split by a contract with no setter.</div>

    <div class="foot">
      <span class="site">CARDSOFCRONOS.COM/BURN</span>
      <span class="when">READ FROM CHAIN · ${when}</span>
    </div>
  </div>
</body></html>`;
}

async function main() {
  const money = await gather();

  const html = join(mkdtempSync(join(tmpdir(), "mint-money-")), "index.html");
  writeFileSync(html, page(money));

  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: SCALE });
  await tab.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: W } });
  await browser.close();

  writeFileSync(OUT, shot);
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  const { size } = await sharp(shot).jpeg({ quality: 92, mozjpeg: true }).toFile(jpg);

  const line = (what: string, value: string) => console.log(`  ${what.padEnd(26)} ${value.padStart(16)}`);
  line("cards minted", money.minted.toLocaleString("en-US"));
  line("  paid, in buys", `${money.boughtCards} in ${money.buys}`);
  line("CRO from mints", whole(money.mints));
  line("CRO from board entries", whole(money.entries));
  line("CRO from everything else", whole(money.other));
  line("CRO swapped", `${whole(money.spent)} in ${money.releases}`);
  line("CRO waiting", whole(money.waiting));
  line("$CROCARD burned", whole(money.burned));
  line("$CROCARD to holders", whole(money.toHolders));
  line("  claimed / claimable", `${whole(money.paidOut)} / ${whole(money.claimable)}`);
  line("$CROCARD to pot", whole(money.toPot));
  line("  won / in pot", `${whole(money.won)} / ${whole(money.inPot)}`);
  console.log(`\n  ${jpg}  ${(size / 1024 / 1024).toFixed(2)} MB  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
