// The header banner for a profile: the name on the left, the homepage cards
// fanned out on the right.
//
//   npm run dev            (in another terminal — this shoots the running site)
//   npx tsx scripts/banner.ts [out.png] [width] [height] [scale] [raised|cards]
//
// Defaults to 1500x500 at 2x, which is what X asks for and twice the pixels, so
// it stays sharp on a retina screen instead of being upscaled by the browser.
//
// The cards are SHOWCASE, imported from the homepage rather than listed again
// here. Change the three cards on the landing page and the banner follows on the
// next run; a second list would be a second answer to "which cards are the face
// of this", and the two would disagree within a week.
//
// Composed inside the running site, like the promo banner and the logo sheet:
// the fonts, the gold and the near-black are the ones in globals.css rather than
// a copy that drifts the first time anybody warms up a token.

import { writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { SHOWCASE } from "../app/page";

const OUT = process.argv[2] ?? "banner.png";
const W = Number(process.argv[3] ?? 1500);
const H = Number(process.argv[4] ?? 500);
const SCALE = Number(process.argv[5] ?? 2);
/** "raised" lifts the words off centre; "cards" lines their top up with the fan. */
const ALIGN = process.argv[6] ?? "raised";
const SITE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();

  // Shot at the card's own size and scaled up by the device pixel ratio, so the
  // art is resampled once by the browser rather than twice by us.
  const shooter = await browser.newPage({
    viewport: { width: 400, height: 560 },
    deviceScaleFactor: 3,
  });
  const cards: string[] = [];
  for (const id of SHOWCASE) {
    await shooter.goto(`${SITE}/card/${id}/image`, { waitUntil: "networkidle" });
    const shot = await shooter.locator("#card-image").screenshot({ type: "png" });
    cards.push(`data:image/png;base64,${shot.toString("base64")}`);
    console.log(`  shot ${id}`);
  }
  await shooter.close();

  const stage = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });
  await stage.goto(SITE, { waitUntil: "networkidle" });

  await stage.evaluate(
    ({ cards, W, H }) => {
      // An overlay rather than a wipe of the body: emptying it removes React's
      // root and whether the app remounts itself is a race with hydration.
      document.documentElement.style.cssText = "margin:0;overflow:hidden";
      document.body.style.cssText = "margin:0;overflow:hidden";

      const stage = document.createElement("div");
      stage.id = "banner";
      stage.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;
        width:${W}px;height:${H}px;background:#060709;overflow:hidden;
        display:flex;align-items:center;font-family:var(--font-display),sans-serif`;

      const words = document.createElement("div");
      words.id = "words";
      // Lifted off the vertical centre on purpose. A profile picture sits over
      // the bottom-left of an X header, and the second line is what it would
      // land on.
      words.style.cssText = `position:relative;z-index:2;
        padding-left:${Math.round(W * 0.055)}px;padding-bottom:${Math.round(H * 0.1)}px;
        max-width:${Math.round(W * 0.44)}px`;
      words.innerHTML = `
        <div class="display gold-gradient" style="font-size:${Math.round(H * 0.16)}px;
          line-height:0.95;letter-spacing:-0.025em">TRENCHES<br>CARD GAME</div>
        <div style="font-family:var(--font-mono),monospace;font-size:${Math.round(H * 0.046)}px;
          letter-spacing:0.22em;color:#00e08a;margin-top:${Math.round(H * 0.055)}px">TRENCHES.CARDS</div>`;
      stage.append(words);

      const fan = document.createElement("div");
      fan.style.cssText = "position:absolute;inset:0;z-index:3";
      for (const src of cards) {
        const card = document.createElement("img");
        card.src = src;
        card.className = "banner-card";
        card.style.cssText = `position:absolute;border-radius:${Math.round(H * 0.022)}px;
          box-shadow:0 ${Math.round(H * 0.05)}px ${Math.round(H * 0.09)}px -${Math.round(H * 0.035)}px rgba(0,0,0,0.9)`;
        fan.append(card);
      }
      stage.append(fan);
      document.documentElement.append(stage);

      // Measured, not estimated. The type size comes from the height and the
      // column it sits in comes from the width, so the two only agree at one
      // aspect — at another the headline silently loses letters to the stage's
      // own overflow. Shrink until it demonstrably fits, and say so if it never
      // does.
      const head = words.querySelector<HTMLElement>(".display")!;
      for (let guard = 0; guard < 40 && head.scrollWidth > head.clientWidth; guard++) {
        head.style.fontSize = `${parseFloat(head.style.fontSize) * 0.96}px`;
      }
      if (head.scrollWidth > head.clientWidth) throw new Error("the wordmark will not fit its column");
    },
    { cards, W, H },
  );

  await stage.evaluate(
    ({ W, H, count, ALIGN }) => {
      const cards = [...document.querySelectorAll<HTMLElement>(".banner-card")];
      if (cards.length !== count) throw new Error(`${cards.length} cards on the stage, expected ${count}`);

      // Sized out of the room actually left beside the words rather than off H,
      // so the fan clears the right edge at whatever aspect it is asked for.
      const first = W * 0.46;
      const room = W * 0.965 - first;
      const wanted = W * 0.062;
      const cardW = Math.min((H * 0.78) / 1.4, room - (count - 1) * wanted);
      const cardH = cardW * 1.4;
      const spread = Math.min(wanted, (room - cardW) / (count - 1));
      const mid = (count - 1) / 2;

      cards.forEach((card, i) => {
        card.style.height = `${cardH}px`;
        card.style.left = `${first + i * spread}px`;
        card.style.top = `${H / 2 - cardH / 2 + Math.abs(i - mid) * H * 0.014}px`;
        card.style.transform = `rotate(${(i - mid) * 3.8}deg)`;
        card.style.zIndex = String(i);
      });

      if (ALIGN === "cards") {
        // Top of the words to the top of the fan. Done here rather than in the
        // markup because the card height is not known until the room beside the
        // words has been measured, and that happens above.
        const words = document.getElementById("words")!;
        words.style.position = "absolute";
        words.style.top = `${H / 2 - cardH / 2}px`;
        words.style.paddingBottom = "0";
      }
    },
    { W, H, count: SHOWCASE.length, ALIGN },
  );

  const file = path.resolve(OUT);
  writeFileSync(file, await stage.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  await browser.close();
  console.log(`\n${file}  ${W * SCALE}x${H * SCALE} for a ${W}x${H} design`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
