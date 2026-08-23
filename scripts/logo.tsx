// The project mark, in a few directions, as square images to choose between.
//
//   npm run dev            (in another terminal — this shoots the running site)
//   npx tsx scripts/logo.ts [outdir] [size]
//
// Composed inside the running site for the same reason the promo banner is: the
// gold is the real gold. `.display.gold-gradient` is a linear-gradient clipped
// to text, defined once in globals.css and used by the nav, the footer and the
// card backs. A logo that hard-codes its own gold is a second definition, and
// the day anybody warms the tokens up the mark stops matching the site it is
// the mark of.
//
// Everything is drawn rather than generated: three letters have to be spelled
// right and the edges have to be straight at 32px.
//
// Where this ends up decides the shape. A token mark is shown small and usually
// inside a circle — pump.fun, DEX Screener, a wallet's token list, a Twitter
// avatar. So every variant is composed on a centre-safe square: nothing that
// matters within a corner, and the contact sheet renders each one circle-cropped
// at avatar size next to the full square, because a mark that only works as a
// square is not a mark for this.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";

import { CardBack } from "../components/CardBack";

// The real card back, not a drawing of one. CardBack is a pure component, so a
// script can render it to markup and drop that into the stage — which means the
// mark and the card in the game are the same object, down to the hatch spacing
// and the punched-out letters. An imitation would be a second definition of the
// back, and the first time anybody touches the real one the logo stops being
// the logo of this game.
//
// preserveAspectRatio="xMidYMid slice" is why one component gives a card, a
// square and a disc: the same SVG fills whatever box it is put in and crops the
// overflow. The shapes below are boxes, nothing more.
const foil = renderToStaticMarkup(<CardBack size="large" design="foil" />);
const guilloche = renderToStaticMarkup(<CardBack size="large" design="guilloche" />);

/** Whatever back, in a box of your choosing, with a shadow under it. */
const back = (svg: string, w: number, h: number, radius: number, rotate = 0, extra = "") => `
  <div style="width:${w}px;height:${h}px;transform:rotate(${rotate}deg);${extra}
    border-radius:${radius}px;overflow:hidden;
    box-shadow:0 ${Math.round(h * 0.04)}px ${Math.round(h * 0.09)}px -${Math.round(h * 0.03)}px rgba(0,0,0,0.9)">
    ${svg}
  </div>`;

const OUT = process.argv[2] ?? "logo";
const SIZE = Number(process.argv[3] ?? 1024);
const PICK = process.argv[4];
const SITE = "http://localhost:3000";

type Variant = { id: string; title: string; html: (s: number) => string };

/** A card, drawn as a frame: gold edge, hairline inside it, dark middle. */
const card = (w: number, h: number, rotate = 0, extra = "") => `
  <div style="position:relative;width:${w}px;height:${h}px;transform:rotate(${rotate}deg);${extra}
    border-radius:${Math.round(w * 0.07)}px;
    background:linear-gradient(150deg,#fff3cf,#f5c451 45%,#a8761f);
    box-shadow:0 ${Math.round(h * 0.03)}px ${Math.round(h * 0.07)}px -${Math.round(h * 0.02)}px rgba(0,0,0,0.85);
    padding:${Math.max(2, Math.round(w * 0.035))}px">
    <div style="width:100%;height:100%;border-radius:${Math.round(w * 0.045)}px;background:#08090a;
      box-shadow:inset 0 0 0 1px rgba(245,196,81,0.45)"></div>
  </div>`;

const VARIANTS: Variant[] = [
  {
    id: "foil-card",
    title: "The foil back, as it is",
    // The card grows into the frame as the frame shrinks. At 1024 the black
    // around it is the composition; at 32 it is nine wasted pixels a side and
    // the mark is a smear. Optical sizing rather than one scale — an app icon
    // that keeps its large-size padding is unreadable in a tab.
    html: (s) => {
      const fill = s <= 64 ? 0.88 : s <= 192 ? 0.78 : 0.7;
      return back(foil, s * fill * (100 / 140), s * fill, s * 0.035);
    },
  },
  {
    id: "foil-tilt",
    title: "The foil back, tilted",
    html: (s) => back(foil, s * 0.48, s * 0.672, s * 0.034, -7),
  },
  {
    id: "foil-stack",
    title: "A sealed stack",
    html: (s) => `
      <div style="position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute">${back(foil, s * 0.44, s * 0.616, s * 0.031, -9, `opacity:0.5;transform-origin:bottom center;translate:-${s * 0.06}px ${s * 0.01}px`)}</div>
        <div style="position:absolute">${back(foil, s * 0.44, s * 0.616, s * 0.031, 9, `opacity:0.5;transform-origin:bottom center;translate:${s * 0.06}px ${s * 0.01}px`)}</div>
        <div style="position:relative">${back(foil, s * 0.46, s * 0.644, s * 0.032)}</div>
      </div>`,
  },
  {
    id: "guilloche-card",
    title: "The guilloche back",
    html: (s) => back(guilloche, s * 0.5, s * 0.7, s * 0.035),
  },
  {
    id: "foil-square",
    title: "Foil, cropped square",
    html: (s) => back(foil, s * 0.72, s * 0.72, s * 0.16),
  },
  {
    id: "foil-round",
    title: "Foil, cropped round",
    html: (s) => back(foil, s * 0.76, s * 0.76, s * 0.38),
  },
  {
    id: "foil-bleed",
    title: "Foil to the edges",
    // Blown up past the frame on purpose. At 1:1 the card's own edge stroke
    // lands inside the crop and reads as two dark lines down the sides; a
    // sixteen percent overscan pushes it out of shot and takes the mark up with
    // it, which it needed anyway.
    // Sized, not inset:0. The stage centres a content-sized box, so inset had
    // nothing to stretch against and this rendered as an empty glow — invisible
    // on the contact sheet, where the box is sized, and broken in the file.
    html: (s) => `
      <div style="width:${s}px;height:${s}px;overflow:hidden;position:relative">
        <div style="position:absolute;width:${s * 1.16}px;height:${s * 1.16}px;
          left:${-s * 0.08}px;top:${-s * 0.08}px">${foil}</div>
      </div>`,
  },
  {
    id: "roundel",
    title: "Gold ring, gold letters",
    html: (s) => `
      <div style="position:relative;width:${s * 0.66}px;height:${s * 0.66}px;border-radius:50%;
        background:linear-gradient(150deg,#fff3cf,#f5c451 45%,#a8761f);padding:${s * 0.022}px">
        <div style="width:100%;height:100%;border-radius:50%;background:#08090a;
          box-shadow:inset 0 0 0 1px rgba(245,196,81,0.4);display:flex;align-items:center;
          justify-content:center">
          <div class="display gold-gradient" style="font-size:${s * 0.24}px;letter-spacing:-0.03em">TCG</div>
        </div>
      </div>`,
  },
  {
    id: "wordmark",
    title: "The letters, nothing else",
    html: (s) => `
      <div class="display gold-gradient" style="font-size:${s * 0.33}px;letter-spacing:-0.04em">TCG</div>`,
  },
];

/** The sizes a token mark is actually asked for, and what asks for them. */
const EXPORTS: [number, string][] = [
  [1024, "master"],
  [512, "pump.fun"],
  [400, "X avatar"],
  [180, "apple touch icon"],
  [64, "small"],
  [32, "favicon"],
];

/** One chosen mark, at every size it will be asked for. */
async function exportOne(id: string) {
  const variant = VARIANTS.find((v) => v.id === id);
  // Loud rather than an empty folder: a typo here used to be a silent no-op.
  if (!variant) throw new Error(`no variant called "${id}". There is ${VARIANTS.map((v) => v.id).join(", ")}.`);

  const dir = path.resolve(OUT);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.goto(SITE, { waitUntil: "networkidle" });

  for (const [size, what] of EXPORTS) {
    await page.setViewportSize({ width: size, height: size });
    await draw(page, variant.html(size), size, variant.id);
    const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: size, height: size } });
    writeFileSync(path.join(dir, `tcg-${size}.png`), shot);
    console.log(`  tcg-${size}.png`.padEnd(22) + what);
  }
  await browser.close();
  console.log(`\n${dir}  ${variant.id} at ${EXPORTS.length} sizes`);
}

/** Put one mark on the stage. Shared by the sheet and the export. */
async function draw(page: import("playwright").Page, html: string, size: number, id: string) {
  await page.evaluate(
    ({ html, SIZE, id }) => {
      document.getElementById("logo")?.remove();
      const stage = document.createElement("div");
      stage.id = "logo";
      stage.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;
        width:${SIZE}px;height:${SIZE}px;background:#060709;overflow:hidden;
        display:flex;align-items:center;justify-content:center;
        font-family:var(--font-display),sans-serif`;
      const glow = document.createElement("div");
      glow.style.cssText = `position:absolute;inset:0;background:
        radial-gradient(55% 55% at 50% 42%, rgba(245,196,81,0.10), transparent 72%)`;
      stage.append(glow);
      const inner = document.createElement("div");
      inner.style.cssText = "position:relative;z-index:2";
      inner.innerHTML = html;
      stage.append(inner);
      document.documentElement.append(stage);
      if (!document.getElementById("logo")) throw new Error(`the stage for ${id} is gone from the page`);
    },
    { html, SIZE: size, id },
  );
}

async function main() {
  if (PICK) return exportOne(PICK);

  const dir = path.resolve(OUT);
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  await page.goto(SITE, { waitUntil: "networkidle" });

  for (const variant of VARIANTS) {
    await page.evaluate(
      ({ html, SIZE, id }) => {
        document.getElementById("logo")?.remove();
        // Laid over the site rather than replacing it, for the reason the promo
        // banner learned the hard way: emptying the body removes React's root
        // and whether the app re-mounts itself into the bare body is a race with
        // hydration. Lose it and you shoot the homepage.
        const stage = document.createElement("div");
        stage.id = "logo";
        stage.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;
          width:${SIZE}px;height:${SIZE}px;background:#060709;overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          font-family:var(--font-display),sans-serif`;
        // A wash off-centre so the black is not flat. Nothing readable in it.
        const glow = document.createElement("div");
        glow.style.cssText = `position:absolute;inset:0;background:
          radial-gradient(55% 55% at 50% 42%, rgba(245,196,81,0.10), transparent 72%)`;
        stage.append(glow);
        const inner = document.createElement("div");
        inner.style.cssText = "position:relative;z-index:2";
        inner.innerHTML = html;
        stage.append(inner);
        document.documentElement.append(stage);
        if (!document.getElementById("logo")) throw new Error(`the stage for ${id} is gone from the page`);
      },
      { html: variant.html(SIZE), SIZE, id: variant.id },
    );

    const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
    writeFileSync(path.join(dir, `${variant.id}.png`), shot);
    console.log(`  ${variant.id}.png  ${variant.title}`);
  }

  // The contact sheet: every variant at a size you can compare, and beside each
  // one the same mark circle-cropped at avatar size, which is the size that
  // actually decides this.
  await page.setViewportSize({ width: 1200, height: 300 * Math.ceil(VARIANTS.length / 2) + 40 });
  await page.evaluate(
    ({ variants, SIZE }) => {
      document.getElementById("logo")?.remove();
      const sheet = document.createElement("div");
      sheet.id = "logo";
      sheet.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:#0a0c10;
        display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px;
        font-family:var(--font-mono),monospace;color:#5f6a66;overflow:hidden`;
      for (const v of variants) {
        const cell = document.createElement("div");
        cell.style.cssText = "display:flex;align-items:center;gap:16px";
        cell.innerHTML = `
          <div style="width:230px;height:230px;background:#060709;overflow:hidden;position:relative;
            display:flex;align-items:center;justify-content:center;flex:none">
            <div style="transform:scale(${230 / SIZE});position:absolute;
              width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center">
              ${v.html}
            </div>
          </div>
          <div>
            <div style="width:72px;height:72px;border-radius:50%;background:#060709;overflow:hidden;
              position:relative;display:flex;align-items:center;justify-content:center">
              <div style="transform:scale(${72 / SIZE});position:absolute;
                width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center">
                ${v.html}
              </div>
            </div>
            <div style="font-size:11px;margin-top:10px;max-width:150px;line-height:1.5">${v.id}<br>${v.title}</div>
          </div>`;
        sheet.append(cell);
      }
      document.documentElement.append(sheet);
    },
    { variants: VARIANTS.map((v) => ({ id: v.id, title: v.title, html: v.html(SIZE) })), SIZE },
  );

  const sheet = await page.screenshot({ type: "png", fullPage: false });
  writeFileSync(path.join(dir, "contact-sheet.png"), sheet);
  await browser.close();
  console.log(`\n${dir}  ${VARIANTS.length} marks at ${SIZE}x${SIZE}, plus contact-sheet.png`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
