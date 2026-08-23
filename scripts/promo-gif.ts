// The animated card for a token profile: the name, and seven cards dealt out
// one at a time.
//
//   npm run dev            (in another terminal — this shoots the running site)
//   npx tsx scripts/promo-gif.ts [out.gif] [width] [height] [colours] [scale] [supersample]
//
// Built rather than generated, for the same reason the card backs are: it has to
// carry the wordmark spelled right and the cards have to be the cards. It shoots
// /card/<id>/image, which is the same route the NFT images come from, so what
// somebody sees in the banner is exactly what they would hold.
//
// The frames are composed inside the running site rather than in a blank page.
// That is what makes the fonts, the gold gradient and the near-black the real
// ones — a standalone HTML file would have to reimplement all three and would
// drift from them the first time anybody changed a token.

import { writeFileSync } from "node:fs";
import path from "node:path";

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "promo.gif";
const W = Number(process.argv[3] ?? 1500);
const H = Number(process.argv[4] ?? 500);
const SITE = "http://localhost:3000";

// Six cards: common, rare, rare, epic, legendary, mythic, left to right, so the
// fan is the rarity ladder and ends on a mythic. Five
// projects and one influencer, because the two layouts do not look alike and a
// row of six identical shapes reads as one card printed six times. Six rather
// than seven because at 1500x500 the seventh either hangs off the right edge or
// squeezes the spread down to a sliver of art per card.
const FAN = [
  "popcat-cat",
  "pnut-raid",
  "wif-sphere-fund",
  "moodeng-halfbillion",
  "alon",
  "bull-peak",
];

const DEAL = 6; // frames between one card landing and the next starting
const FLIGHT = 12; // frames a single card takes to arrive
const HOLD = 30; // frames the finished fan sits still before the loop
const FRAMES = (FAN.length - 1) * DEAL + FLIGHT + HOLD;
const DELAY = 60; // ms per frame
const COLOURS = Number(process.argv[5] ?? 128); // palette size, shared by every frame
// Device pixel ratio for the stage. The design stays W x H; the raster comes out
// that many times larger, which is the difference between a banner that is sharp
// on a retina screen and one the browser has to upscale. It also multiplies the
// file by roughly the square of it, so it is a knob and not a default.
const SCALE = Number(process.argv[6] ?? 1);
// Render bigger than the output and average back down, for when the target size
// is fixed and there is nothing left to spend.
//
// Measured, and it does not buy anything here: at 1500x500 the supersampled
// frames are indistinguishable from the directly rendered ones at 3x zoom, and
// if anything the small type is very slightly softer. The browser already
// anti-aliases text and already downsamples the 3x card shots properly, so
// there was no aliasing left for this to fix. 1.95 MB against 2.00 MB.
//
// Kept because it is four lines and the measurement is worth having written
// down — but the default is 1 on purpose. Do not reach for it expecting a win.
const SS = Number(process.argv[7] ?? 1);
const PW = W * SCALE;
const PH = H * SCALE;

/**
 * Average each SS x SS block down to one pixel.
 *
 * A plain box filter rather than anything cleverer, because the input is an
 * exact integer multiple of the output — which is the case where a box filter
 * is not an approximation of the right answer, it is the right answer.
 */
function boxDown(src: Uint8ClampedArray, w: number, h: number, ss: number) {
  const ow = w / ss;
  const oh = h / ss;
  if (!Number.isInteger(ow) || !Number.isInteger(oh)) {
    throw new Error(`${w}x${h} does not divide by ${ss}`);
  }
  const out = new Uint8ClampedArray(ow * oh * 4);
  const n = ss * ss;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < ss; dy++) {
        let i = ((y * ss + dy) * w + x * ss) * 4;
        for (let dx = 0; dx < ss; dx++, i += 4) {
          r += src[i]!; g += src[i + 1]!; b += src[i + 2]!; a += src[i + 3]!;
        }
      }
      const o = (y * ow + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return out;
}

// Wrapped in a main() because the project compiles to CJS and top-level await
// is not available there.
async function main() {
  const browser = await chromium.launch();
  const shooter = await browser.newPage({
    viewport: { width: 400, height: 560 },
    deviceScaleFactor: 3,
  });

  const cards: string[] = [];
  for (const id of FAN) {
    await shooter.goto(`${SITE}/card/${id}/image`, { waitUntil: "networkidle" });
    // The element, not the viewport. Shooting the viewport dragged in the page
    // background below the card and, in dev, the Next indicator badge with it —
    // which is why the first render had a dark box and an N under every card.
    const shot = await shooter.locator("#card-image").screenshot({ type: "png" });
    cards.push(`data:image/png;base64,${shot.toString("base64")}`);
    console.log(`  shot ${id}`);
  }
  await shooter.close();

  const stage = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE * SS,
  });
  await stage.goto(SITE, { waitUntil: "networkidle" });

  await stage.evaluate(
    ({ cards, W, H }) => {
      // Laid over the site rather than replacing it. Emptying the body took out
      // React's root container, and whether the app then re-mounted itself into
      // the bare body was a race with hydration — win it and you get the banner,
      // lose it and you silently shoot the homepage. A fixed overlay outside the
      // body is not something React reaches into.
      document.documentElement.style.cssText = "margin:0;overflow:hidden";
      document.body.style.cssText = "margin:0;overflow:hidden";

      const stage = document.createElement("div");
      stage.id = "promo";
      stage.style.cssText = `
        position:fixed;left:0;top:0;z-index:2147483647;
        width:${W}px;height:${H}px;background:#08090a;overflow:hidden;
        display:flex;align-items:center;font-family:var(--font-display),sans-serif;`;

      // No wash behind the fan, deliberately. A soft radial gradient over a
      // near-black ground is the single most expensive thing you can ask a
      // 256-colour palette for: it either eats a third of the colour table or
      // it bands into visible rings, and in a GIF it did both. Flat ground
      // spends the whole palette on the card art, which is what anybody
      // actually looks at.

      const words = document.createElement("div");
      words.id = "words";
      words.style.cssText = `position:relative;z-index:2;padding-left:${Math.round(W * 0.055)}px;max-width:${Math.round(W * 0.42)}px`;
      words.innerHTML = `
        <div style="font-family:var(--font-mono),monospace;font-size:${Math.round(H * 0.032)}px;
                    letter-spacing:0.3em;color:#5f6a66">SET 01 · SOLANA</div>
        <div class="display gold-gradient" style="font-size:${Math.round(H * 0.155)}px;line-height:0.95;
                    margin-top:${Math.round(H * 0.03)}px;letter-spacing:-0.02em">TRENCHES<br>CARD GAME</div>
        <div style="font-family:var(--font-mono),monospace;font-size:${Math.round(H * 0.042)}px;
                    letter-spacing:0.22em;color:#00e08a;margin-top:${Math.round(H * 0.05)}px">TRENCHES.CARDS</div>`;
      stage.append(words);

      const fan = document.createElement("div");
      fan.id = "fan";
      fan.style.cssText = `position:absolute;inset:0;z-index:3`;
      for (const src of cards) {
        const card = document.createElement("img");
        card.src = src;
        card.className = "promo-card";
        card.style.cssText = `position:absolute;height:${Math.round(H * 0.74)}px;
          border-radius:${Math.round(H * 0.022)}px;will-change:transform,opacity;
          box-shadow:0 ${Math.round(H * 0.05)}px ${Math.round(H * 0.09)}px -${Math.round(H * 0.04)}px rgba(0,0,0,0.9)`;
        fan.append(card);
      }
      stage.append(fan);
      document.documentElement.append(stage);

      // Measured, not estimated. The display size was a fraction of the height
      // and the column it sits in is a fraction of the width, so the two only
      // agreed at the aspect it was written for: at 1200x630 the headline came
      // out reading TRENCH CARD GAME, with the ES clipped off by the stage's
      // own overflow. A wordmark that silently loses letters is the worst thing
      // this script could ship, so it now shrinks until it demonstrably fits.
      const head = words.querySelector<HTMLElement>(".display")!;
      for (let guard = 0; guard < 40 && head.scrollWidth > head.clientWidth; guard++) {
        head.style.fontSize = `${parseFloat(head.style.fontSize) * 0.96}px`;
      }
      if (head.scrollWidth > head.clientWidth) throw new Error("the wordmark will not fit its column");
    },
    { cards, W, H },
  );

  /** Where card `i` rests once it has landed: a fan leaning right. */
  await stage.evaluate(
    ({ W, H, count, DEAL, FLIGHT }) => {
      const w = window as unknown as { layout: (frame: number) => void };
      const cards = [...document.querySelectorAll<HTMLElement>(".promo-card")];
      // Sized so the rotated fan clears every edge: the rightmost card's far
      // corner lands inside 1500 and the tallest card inside 500. The first
      // render had the last card cropped in half and the tops shaved off.
      // The card used to take its height from H and its spacing from W, which
      // only fits at the aspect those two were tuned against — at 1200x630 the
      // cards grew and the fan ran off the right edge. Both now come out of the
      // room actually left beside the words.
      const first = W * 0.455;
      const room = W * 0.96 - first;
      const wanted = W * 0.058;
      const cardW = Math.min((H * 0.74) / 1.4, room - (count - 1) * wanted);
      const cardH = cardW * 1.4;
      const spread = Math.min(wanted, (room - cardW) / (count - 1));
      const mid = (count - 1) / 2;
      for (const card of cards) {
        card.style.height = `${cardH}px`;
      }

      w.layout = (frame: number) => {
        // Checked every frame, because the failure this guards against is the
        // silent one: the overlay gone and the homepage underneath shot instead.
        if (!document.getElementById("promo")) throw new Error("the promo stage is gone from the page");
        if (cards.length !== count) throw new Error(`${cards.length} cards on the stage, expected ${count}`);
        cards.forEach((card, i) => {
          const start = i * DEAL;
          // Ease-out cubic. A card that decelerates reads as dealt; linear reads
          // as a slide, and at six frames apart the difference is the whole feel.
          const t = Math.max(0, Math.min(1, (frame - start) / FLIGHT));
          const e = 1 - Math.pow(1 - t, 3);

          const restX = first + i * spread;
          const restY = H / 2 - cardH / 2 + Math.abs(i - mid) * H * 0.012;
          const restR = (i - mid) * 3.6;

          card.style.opacity = String(Math.min(1, t * 2.2));
          card.style.left = `${restX + (1 - e) * W * 0.09}px`;
          card.style.top = `${restY + (1 - e) * H * 0.22}px`;
          card.style.transform = `rotate(${restR + (1 - e) * 13}deg) scale(${0.86 + e * 0.14})`;
          card.style.zIndex = String(i);
        });
      };
    },
    { W, H, count: FAN.length, DEAL, FLIGHT },
  );

  /** Draw frame `n` and hand back its pixels. */
  const shoot = async (n: number) => {
    await stage.evaluate((f) => (window as unknown as { layout: (n: number) => void }).layout(f), n);
    const shot = await stage.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
    // Decoded here rather than in the page. The first version handed the PNG
    // back to the browser, drew it to a canvas and returned getImageData as an
    // array — three million numbers per frame across the bridge, which does not
    // finish. The screenshot is already a Buffer in this process; decoding it
    // locally costs nothing.
    const { data } = PNG.sync.read(Buffer.from(shot));
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    return SS === 1 ? pixels : boxDown(pixels, PW * SS, PH * SS, SS);
  };

  // One palette for the whole animation, quantized from the last frame — the
  // only frame that holds every card at once, so every colour that appears
  // anywhere appears there. A palette per frame would be marginally prettier and
  // would make the delta below impossible, because index 40 would mean a
  // different colour in every frame.
  const last = await shoot(FRAMES - 1);
  const shared = quantize(last, COLOURS - 1);
  // Appended after the quantize, never after applyPalette has seen it, so no
  // real pixel can be mapped onto it. It exists only to be the hole.
  const TRANSPARENT = shared.length;
  const palette = [...shared, [255, 0, 255]];

  const encoder = GIFEncoder();
  let previous: Uint8Array | null = null;
  let held = 0;

  for (let frame = 0; frame < FRAMES; frame++) {
    const index = applyPalette(await shoot(frame), shared);

    if (previous === null) {
      encoder.writeFrame(index, PW, PH, { palette, delay: DELAY, dispose: 1 });
    } else {
      // Only what moved. The near-black ground, the glow and the wordmark are
      // identical in all sixty-six frames; punching them out drops the file by
      // about four fifths. Compared on palette indices rather than on pixels,
      // which is both cheaper and exactly the right question — two pixels that
      // quantize to the same colour are the same colour in the output.
      const delta = new Uint8Array(index);
      for (let i = 0; i < delta.length; i++) {
        if (delta[i] === previous[i]) {
          delta[i] = TRANSPARENT;
          held++;
        }
      }
      encoder.writeFrame(delta, PW, PH, {
        delay: DELAY,
        dispose: 1,
        transparent: true,
        transparentIndex: TRANSPARENT,
      });
    }
    previous = index;
    if (frame % 10 === 0) console.log(`  frame ${frame}/${FRAMES}`);
  }
  encoder.finish();

  const carried = (100 * held) / (PW * PH * (FRAMES - 1));
  console.log(`  ${carried.toFixed(1)}% of pixels carried over rather than re-encoded`);

  const file = path.resolve(OUT);
  writeFileSync(file, Buffer.from(encoder.bytes()));

  // The finished fan as a still, from the same render. Anywhere that will not
  // take an animation wants this exact picture rather than a second one drawn
  // to look like it, and it is also how the fan gets looked at — a screenshot
  // of a playing GIF lands on whatever frame it lands on.
  const still = new PNG({ width: PW, height: PH });
  still.data = Buffer.from(last.buffer, last.byteOffset, last.byteLength);
  const stillFile = file.replace(/\.gif$/, ".png");
  writeFileSync(stillFile, PNG.sync.write(still));
  console.log(`${stillFile}  still of the last frame`);
  await browser.close();
  console.log(
    `\n${file}  ${PW}x${PH}  ${FRAMES} frames  ${(encoder.bytes().length / 1e6).toFixed(2)} MB` +
      (SS > 1 ? `  (rendered at ${PW * SS}x${PH * SS} and averaged down)` : ""),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
