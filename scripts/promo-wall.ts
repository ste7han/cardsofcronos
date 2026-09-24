// The whole set in one picture, for posting.
//
//   npm run dev                    (in another terminal — it serves the renders)
//   npx tsx scripts/promo-wall.ts [out.png] [width] [height] [scale]
//   npx tsx scripts/promo-wall.ts cronus.png --family cronus
//
// Defaults to 1600x900 at 2x, which is the shape X gives the most room to and
// twice the pixels, so it stays sharp instead of being upscaled by the browser.
//
// ── IT USES THE FILES, NOT A SECOND DRAWING ──────────────────────────────────
//
// Every card here is public/render/<id>.webp, the same picture the NFT uses and
// the same one the close-up on /cards hands out. Four hundred and forty-eight of
// them at once is the one thing this project has that no screenshot can show,
// and drawing them again for a banner would be the third implementation of what
// a card looks like.
//
// ── WHAT IS IN FRONT ─────────────────────────────────────────────────────────
//
// By default the homepage's SHOWCASE, imported rather than listed again, for the
// reason scripts/banner.ts gives: a second list is a second answer to "which
// cards are the face of this", and the two disagree within a week.
//
// `--family <project>` fans one project's cards instead, in set order, which is
// rarity order — so a family reads left to right from common to whatever it tops
// out at. That is the picture to send a project whose cards are in this game.
//
// The fan sizes itself to the number of cards. Five and eight are different
// pictures, and a width that was right for one crops the other: the eight-card
// families ran off the right edge until this measured instead of assuming.
//
// The wall behind them is every card in set order, which is the honest answer to
// "how many are there" — it is not a flattering selection, it is all of it.

import { writeFileSync } from "node:fs";

import { chromium } from "playwright";
import sharp from "sharp";

import { SET } from "@/lib/set";
import { SHOWCASE } from "../app/page";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? null : (args[at + 1] ?? null);
};
const plain = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

const OUT = plain[0] ?? "promo-wall.png";
const W = Number(plain[1] ?? 1600);
const H = Number(plain[2] ?? 900);
const SCALE = Number(plain[3] ?? 2);
const SITE = "http://localhost:3000";

/** One project's cards in front, or the homepage's five. */
const FAMILY = flag("family");

/**
 * Which project a card belongs to, or none.
 *
 * Narrowed rather than asserted: a tactic has no project, so `card.project` is
 * a type error on a third of the set and `as any` would have hidden the day a
 * tactic slipped into a family fan.
 */
const projectOf = (card: (typeof SET)[number]): string | null =>
  "project" in card && typeof card.project === "string" ? card.project : null;

const front =
  FAMILY === null ? SHOWCASE : SET.filter((c) => projectOf(c) === FAMILY).map((c) => c.id);
if (front.length === 0) {
  const known = [...new Set(SET.map(projectOf).filter((p): p is string => p !== null))].sort();
  throw new Error(`No cards with project "${FAMILY}". There are: ${known.join(", ")}`);
}

/** What the family is called, as it is printed on the cards themselves. */
const NAME = FAMILY === null ? null : SET.find((c) => projectOf(c) === FAMILY)!.name.toUpperCase();

/** Lowest and highest rarity in the fan, which is the thing a family shows off. */
const ORDER = ["common", "rare", "epic", "legendary", "mythic"];
const rarities = front
  .map((id) => SET.find((c) => c.id === id)!.rarity)
  .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
const SPAN = `${rarities[0]!.toUpperCase()} TO ${rarities[rarities.length - 1]!.toUpperCase()}`;

/** The card's own proportions, from the render: 1072 x 1676. */
const RATIO = 1676 / 1072;

/** How much of the frame the words take. The fan gets the rest. */
const SAY_WIDTH = 520;

function page(): string {
  const wall = SET.map(
    (card) =>
      `<img src="${SITE}/render/${card.id}.webp" loading="eager" decoding="sync" alt="">`,
  ).join("");

  // Measured rather than assumed. The words take the left, the fan takes what is
  // left over, and the cards shrink to fit it — eight at the width five wanted
  // put the last one through the right edge.
  // A fan of n cards overlapping by a fraction f of their width is not n cards
  // wide. It is cardW * (n - (n-1)*f). Guessing at that put a fan of eight over
  // the top of the words, which on a picture whose whole job is to be read at a
  // glance is the one thing it cannot do.
  const OVERLAP = 0.26;
  const room = W - SAY_WIDTH - 150;
  const spans = front.length - (front.length - 1) * OVERLAP;
  const cardW = Math.min(200, Math.floor(room / spans));
  const overlap = Math.round(cardW * OVERLAP);

  const heroes = front.map((id, i) => {
    // A fan: the middle card upright and the others leaning away from it, each
    // one a little lower, the way a hand of cards actually sits.
    const middle = (front.length - 1) / 2;
    const off = i - middle;
    // Six degrees a step, not seven. At seven the outer card's corner swung
    // past the right edge of the frame and was cut in half — which on a fan of
    // five is the one card that looks like a mistake rather than a crop.
    const tilt = off * (front.length > 6 ? 4.5 : 6);
    const drop = Math.abs(off) * (cardW * 0.15);
    return `<img class="hero" style="
      width: ${cardW}px;
      transform: rotate(${tilt}deg) translateY(${drop}px);
      z-index: ${front.length - Math.abs(off)};
      margin-left: ${i === 0 ? 0 : -overlap}px;
    " src="${SITE}/render/${id}.webp" alt="">`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
    background: #050314;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }

  /* ── THE WALL ──────────────────────────────────────────────────────────
     Every card, tilted and oversized so it runs off all four edges. A grid
     that stopped at the frame would read as a screenshot of a page; one that
     is cut off reads as "there is more of this". */
  .wall {
    position: absolute; inset: -22%;
    display: grid;
    grid-template-columns: repeat(32, 1fr);
    gap: 5px;
    transform: rotate(-9deg) scale(1.08);
    transform-origin: center;
  }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  /* Dimmed towards the left, where the words go, and lifted on the right so
     the fan has something to sit against. Two layers rather than one: a flat
     scrim over four hundred cards kills them, and a gradient alone does not
     get dark enough to read white text over. */
  .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(100deg, #050314 26%, rgba(5,3,20,0.86) 46%, rgba(5,3,20,0.55) 70%, rgba(5,3,20,0.72) 100%),
      radial-gradient(120% 90% at 18% 50%, rgba(5,3,20,0.92) 0%, rgba(5,3,20,0) 60%);
  }
  /* A purple wash, because the palette is purple and four hundred card frames
     in every colour average out to grey. */
  .tint {
    position: absolute; inset: 0; mix-blend-mode: soft-light;
    background: radial-gradient(90% 120% at 78% 40%, #9d4edd 0%, rgba(157,78,221,0) 62%);
  }

  /* ── THE FAN ───────────────────────────────────────────────────────────── */
  .fan {
    position: absolute; right: 95px; top: 50%;
    transform: translateY(-50%) rotate(-3deg);
    display: flex; align-items: center;
  }
  .hero {
    aspect-ratio: 1072 / 1676;
    border-radius: 10px;
    box-shadow: 0 28px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(157,78,221,0.35);
  }

  /* ── THE WORDS ─────────────────────────────────────────────────────────── */
  .say { position: absolute; left: 64px; top: 50%; transform: translateY(-50%); width: ${SAY_WIDTH}px; }
  .eyebrow {
    font-size: 15px; letter-spacing: 0.34em; color: #ffd700; font-weight: 700;
  }
  h1 {
    font-family: "Archivo Black", sans-serif;
    font-size: 92px; line-height: 0.92; color: #fff; margin-top: 16px;
    letter-spacing: -0.015em;
  }
  .count {
    font-family: "Archivo Black", sans-serif;
    font-size: 38px; color: #ffd700; margin-top: 22px; letter-spacing: 0.01em;
  }
  .count span { color: #9d93b8; font-size: 20px; font-family: "JetBrains Mono", monospace; }
  p.line {
    font-size: 18px; line-height: 1.6; color: #9d93b8; margin-top: 18px; max-width: 520px;
  }
  .url {
    margin-top: 30px; font-size: 17px; letter-spacing: 0.22em; color: #00e08a; font-weight: 700;
  }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="fan">${heroes}</div>
  <div class="say">
    <div class="eyebrow">${NAME === null ? "SET 01 · CRONOS" : "CARDS OF CRONOS · SET 01"}</div>
    <h1>${NAME === null ? "CARDS OF<br>CRONOS" : `${NAME}<br>CARDS`}</h1>
    <div class="count">${front.length} CARDS <span>· ${NAME === null ? "5,603 minted at most" : SPAN}</span></div>
    <p class="line">${
      NAME === null
        ? "A trading card game on Cronos. Ten turns, a marketing budget that grows, and the highest market cap wins."
        : `${NAME} is in the game. ${SET.length} cards on Cronos, ten turns, and the highest market cap wins.`
    }</p>
    <div class="url">CARDSOFCRONOS.COM</div>
  </div>
</body></html>`;
}

async function main() {
  const browser = await chromium.launch();
  const tab = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });

  await tab.setContent(page(), { waitUntil: "load" });
  // Every card decoded before the shutter. `load` fires when the requests are
  // done, which is not the same as the pixels being on screen — and a wall with
  // forty holes in it is the shape this would fail in.
  await tab.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
    );
  });
  await tab.waitForTimeout(600);

  const png = await tab.screenshot({ type: "png" });
  await browser.close();
  writeFileSync(OUT, png);

  // And a JPEG beside it, because X refuses a PNG over five megabytes and a
  // wall of four hundred pictures lands at four point nine. Quality 92 puts the
  // same image at about a fifth of that, and nothing here is a flat colour or a
  // hard gradient — the two things JPEG actually spoils.
  const jpg = OUT.replace(/\.png$/i, ".jpg");
  await sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(jpg);

  const size = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const { size: jpgSize } = await sharp(jpg).metadata().then(async () => ({
    size: (await import("node:fs")).statSync(jpg).size,
  }));
  console.log(
    `\n  ${OUT}  ${W * SCALE}x${H * SCALE}  ${size(png.length)}  ·  ${SET.length} in the wall` +
      `, ${front.length} in front${NAME === null ? "" : ` (${NAME})`}`,
  );
  console.log(`  ${jpg}  ${size(jpgSize)}  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
