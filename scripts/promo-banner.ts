// The moving banner: the wall, the wordmark, and cards dealt in one at a time.
//
//   npm run dev            (in another terminal — it serves the renders)
//   npx tsx scripts/promo-banner.ts [out.gif] [width] [height]
//
// 1500x500 by default, which is what DexScreener asks a header for.
//
// ── WHY THE WALL DOES NOT MOVE ───────────────────────────────────────────────
//
// It was going to drift, which looks better than anything else here. It cannot:
// the frames are written as deltas — only the pixels that changed since the last
// one, everything else punched out as transparent — and a wall that slides
// changes every pixel in the frame. The version that drifted came out at
// thirty-eight megabytes. This one holds the wall and the words still and moves
// one card at a time, so a frame carries about a tenth of its pixels and the
// file is a thirtieth of the size.
//
// That constraint is the whole design. It is not a compromise on the look; it is
// the reason the look is affordable.
//
// ── THE CARDS ────────────────────────────────────────────────────────────────
//
// One per project, from the projects worth showing, and the rarity rotates so
// the row is not ten cards in the same frame colour. They are public/render —
// the same files the NFTs use and the stills use, so the banner cannot show a
// card that differs from the one somebody holds.

import { writeFileSync } from "node:fs";
import path from "node:path";

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { PNG } from "pngjs";
import { chromium } from "playwright";

import { SET } from "@/lib/set";

const OUT = process.argv[2] ?? "banner.gif";
const W = Number(process.argv[3] ?? 1500);
const H = Number(process.argv[4] ?? 500);
const SITE = "http://localhost:3000";

/** The projects in the row, in the order they are dealt. */
const PROJECTS = [
  "cronus",
  "obsidian",
  "wolfswap",
  "crooks",
  "cr00ts",
  "mery",
  "monsters",
  "caw",
  "lions",
  "fftb",
];

const projectOf = (card: (typeof SET)[number]): string | null =>
  "project" in card && typeof card.project === "string" ? card.project : null;

/**
 * One card per project: epic, legendary, mythic, rotating.
 *
 * All ten at the top rarity would be ten cards in the same pink frame, which
 * from a distance is one card printed ten times — the same thing scripts/
 * promo-gif.ts wrote down about six identical shapes.
 */
const FAN = PROJECTS.map((project, i) => {
  const cards = SET.filter((c) => projectOf(c) === project);
  if (cards.length === 0) {
    const known = [...new Set(SET.map(projectOf).filter(Boolean))].sort();
    throw new Error(`No cards with project "${project}". There are: ${known.join(", ")}`);
  }
  // Indices 5, 6, 7 of eight, which are epic, legendary and mythic.
  return cards[Math.min(cards.length - 1, 5 + (i % 3))]!.id;
});

// Six frames between cards, not four. Each one lands on top of the one before
// it, so a card is fully visible only for the gap before the next covers it —
// which at four frames is a fifth of a second, too short to see whose card it
// was. That gap is the whole reason ten overlapping cards can still name ten
// projects: the still cannot, the animation can.
const DEAL = 6;
const FLIGHT = 11; // frames a card takes to arrive
const HOLD = 30; // frames the finished row sits still before it loops
const FRAMES = (FAN.length - 1) * DEAL + FLIGHT + HOLD;
const DELAY = 50; // ms a frame is shown — 20 a second
const COLOURS = 200;

async function main() {
  const browser = await chromium.launch();
  const stage = await browser.newPage({ viewport: { width: W, height: H } });

  const wall = SET.map((c) => `<img src="${SITE}/render/${c.id}.webp">`).join("");
  const cards = FAN.map(
    (id, i) => `<img class="card" id="c${i}" src="${SITE}/render/${id}.webp">`,
  ).join("");

  // The words take the left, the row takes the rest — the same division as the
  // stills, at a third of the height.
  const SAY = 400;
  const room = W - SAY - 70;
  // Forty per cent rather than forty-six. Three points of card width is not
  // much, and it is the difference between seeing a project's art and seeing
  // its left edge.
  const OVERLAP = 0.4;
  // Capped by the height as well as by the width. A card is 1.563 times as tall
  // as it is wide, so on a shorter banner the width that fits across is a height
  // that does not: at 1600x400 the row filled three quarters of the frame and
  // the words underneath it had nowhere to sit. 62% leaves the same margin above
  // and below that 1500x500 has, and at that size this cap does not bite — 190
  // is still the smaller of the two, so the DexScreener header is unchanged.
  const tallest = Math.floor((H * 0.62) / 1.563);
  const cardW = Math.min(190, tallest, Math.floor(room / (FAN.length - (FAN.length - 1) * OVERLAP)));
  const step = Math.round(cardW * (1 - OVERLAP));
  const rowW = cardW + step * (FAN.length - 1);

  await stage.setContent(
    `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; position:relative; background:#050314;
         font-family:"JetBrains Mono",monospace; }
  .wall { position:absolute; inset:-30%; display:grid; grid-template-columns:repeat(34,1fr);
          gap:4px; transform:rotate(-9deg) scale(1.1); }
  .wall img { width:100%; aspect-ratio:1072/1676; object-fit:cover; border-radius:2px; }
  .scrim { position:absolute; inset:0; background:
    linear-gradient(100deg,#050314 22%,rgba(5,3,20,0.88) 40%,rgba(5,3,20,0.6) 66%,rgba(5,3,20,0.74) 100%),
    radial-gradient(120% 110% at 14% 50%,rgba(5,3,20,0.94) 0%,rgba(5,3,20,0) 62%); }
  .tint { position:absolute; inset:0; mix-blend-mode:soft-light;
    background:radial-gradient(85% 130% at 76% 45%,#9d4edd 0%,rgba(157,78,221,0) 60%); }

  .say { position:absolute; left:52px; top:50%; transform:translateY(-50%); width:${SAY}px; }
  .eyebrow { font-size:11px; letter-spacing:0.3em; color:#ffd700; font-weight:700; }
  h1 { font-family:"Archivo Black",sans-serif; font-size:56px; line-height:0.94; color:#fff;
       margin-top:10px; letter-spacing:-0.015em; }
  .url { margin-top:14px; font-size:12px; letter-spacing:0.2em; color:#00e08a; font-weight:700; }

  .row { position:absolute; right:36px; top:50%; width:${rowW}px; height:${Math.round(cardW * 1.563)}px;
         transform:translateY(-50%) rotate(-2deg); }
  .card { position:absolute; top:0; width:${cardW}px; aspect-ratio:1072/1676; border-radius:7px;
          box-shadow:0 14px 34px rgba(0,0,0,0.7), 0 0 0 1px rgba(157,78,221,0.32); }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="say">
    <div class="eyebrow">SET 01 · ${SET.length} CARDS</div>
    <h1>CARDS OF<br>CRONOS</h1>
    <div class="url">CARDSOFCRONOS.COM</div>
  </div>
  <div class="row">${cards}</div>
</body></html>`,
    { waitUntil: "load" },
  );

  await stage.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
    );
  });

  // The whole animation as one function in the page, so a frame is one call and
  // not a round trip per card.
  await stage.evaluate(
    ({ count, DEAL, FLIGHT, step }) => {
      const cards = [...document.querySelectorAll<HTMLElement>(".card")];
      (window as unknown as { layout: (n: number) => void }).layout = (n: number) => {
        cards.forEach((card, i) => {
          const began = i * DEAL;
          // 0 before it starts, 1 once it has landed.
          const t = Math.max(0, Math.min(1, (n - began) / FLIGHT));
          // Ease out: fast in, settling. A linear deal reads as a slide.
          const e = 1 - Math.pow(1 - t, 3);
          card.style.left = `${i * step}px`;
          card.style.opacity = String(t === 0 ? 0 : e);
          card.style.transform = `translateY(${(1 - e) * -40}px) rotate(${(1 - e) * 10}deg) scale(${0.9 + e * 0.1})`;
          card.style.zIndex = String(i);
        });
      };
    },
    { count: FAN.length, DEAL, FLIGHT, step },
  );

  const shoot = async (n: number) => {
    await stage.evaluate((f) => (window as unknown as { layout: (n: number) => void }).layout(f), n);
    const shot = await stage.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
    const { data } = PNG.sync.read(Buffer.from(shot));
    return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  };

  // One palette for the whole thing, taken from the last frame — the only one
  // holding every card at once, so every colour that appears anywhere appears
  // there. A palette per frame would make the delta below impossible, because
  // index 40 would mean a different colour in every frame.
  const shared = quantize(await shoot(FRAMES - 1), COLOURS - 1);
  const TRANSPARENT = shared.length;
  const palette = [...shared, [255, 0, 255]];

  const encoder = GIFEncoder();
  let previous: Uint8Array | null = null;
  let held = 0;

  for (let frame = 0; frame < FRAMES; frame++) {
    const index = applyPalette(await shoot(frame), shared);

    if (previous === null) {
      encoder.writeFrame(index, W, H, { palette, delay: DELAY, dispose: 1 });
    } else {
      // Only what moved. Compared on palette indices rather than on pixels,
      // which is both cheaper and exactly the right question: two pixels that
      // quantize to the same colour are the same colour in the output.
      const delta = new Uint8Array(index);
      for (let i = 0; i < delta.length; i++) {
        if (delta[i] === previous[i]) {
          delta[i] = TRANSPARENT;
          held++;
        }
      }
      encoder.writeFrame(delta, W, H, {
        delay: DELAY,
        dispose: 1,
        transparent: true,
        transparentIndex: TRANSPARENT,
      });
    }
    previous = index;
    if (frame % 15 === 0) process.stderr.write(`  frame ${frame}/${FRAMES}\n`);
  }
  encoder.finish();

  const bytes = Buffer.from(encoder.bytes());
  writeFileSync(path.resolve(OUT), bytes);

  // The finished row as a still, from the same render. Anywhere that will not
  // take a GIF still wants the picture, and a second script for it would be a
  // second answer to what the banner looks like.
  const still = OUT.replace(/\.gif$/i, ".png");
  await stage.evaluate((f) => (window as unknown as { layout: (n: number) => void }).layout(f), FRAMES - 1);
  writeFileSync(path.resolve(still), await stage.screenshot({ type: "png" }));
  await browser.close();

  const carried = (100 * held) / (W * H * (FRAMES - 1));
  console.log(`\n  ${OUT}  ${W}x${H}  ${FRAMES} frames  ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  ${carried.toFixed(1)}% of pixels carried over rather than re-encoded`);
  console.log(`  ${FAN.length} projects: ${PROJECTS.join(", ")}\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
