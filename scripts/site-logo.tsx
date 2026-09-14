// The mark in the nav and the footer, rendered from the card back.
//
//   npm run dev          (in another terminal — this shoots the running site)
//   npm run site-logo
//
// Why a script and not an <img> of something drawn elsewhere: the logo of this
// game is a card from this game. CardBack is a pure component, so this renders
// the real one — the same hatch, the same edge, the same three letters — and
// puts it in perspective. Nobody has to remember to redraw a logo when the back
// changes, because there is no drawing of it to redraw.
//
// Why not render it live in the nav instead: the tilt wants a perspective, two
// stacked layers for thickness and a cast shadow, and that is a lot of DOM to
// ship on every page for something that never moves. A flat file it is, made by
// a command that can be re-run.
//
// Shot on transparency, and that is a decision rather than a default. The nav
// used to blend its mark with mix-blend-screen, which adds the image to what is
// behind it and drops black to nothing. That works for a gold card. It does not
// work for a dark purple one: screen makes dark pixels nearly invisible, so the
// mark came out as a smudge on the bar. Transparent PNG, no blend, and the card
// is the colour it was drawn in.
//
// Nothing behind the card, either — no bloom, no cast shadow, no coloured glow.
// Those were here first and they looked right against the black they were shot
// on. Baked into a transparent PNG they are a soft purple haze in a rectangle
// around the mark, which is visible on any ground that is not exactly the one
// they were composed against. A logo is the card and its own thickness; the
// room it sits in belongs to the page.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";

import { CardBack } from "../components/CardBack";

// Overridable, because 3000 is not guaranteed to be this game. It was not:
// the first render of this logo was composed inside Trenches' dev server,
// which happened to hold the port, and came out looking almost right — the
// shapes are this repo's component, but the fonts and tokens were another
// project's. Almost right is the worst outcome, so the port is a flag now and
// the page gets checked below.
const SITE = process.env.SITE ?? `http://localhost:${process.env.PORT ?? 3000}`;
const OUT = path.resolve(process.argv[2] ?? "public/logo.png");

// The card, and then the frame around it — in that order, because the card is
// the thing and the frame is only what is left over.
//
// CARD_RATIO is not a taste decision. CardBack is a 100x140 SVG drawn with
// preserveAspectRatio="xMidYMid slice", which means a box of any other shape
// does not letterbox it, it *crops* it. A box 5% too short quietly ate the top
// and bottom strips of the back — including the gold edge line along them — and
// the result read as a card photographed slightly too close rather than as a
// mistake. Derive the height from the width and it cannot happen.
const CARD_W = 560;
const CARD_RATIO = 140 / 100;
const CARD_H = CARD_W * CARD_RATIO;

// How much of the frame the card takes. Trenches' mark fills 99% of its width
// and 93% of its height, bleeding off three sides — it is shot on black, where
// running off the edge costs nothing. This one is shot on transparency, so it
// keeps a margin: partly so the tilt and the thickness have somewhere to go,
// and partly because the border being empty is what the check at the end of
// this file reads to prove nothing is standing behind the card.
const MARGIN = 0.055;
const W = Math.round(CARD_W / (1 - 2 * MARGIN));
const H = Math.round(CARD_H / (1 - 2 * MARGIN));

// Composed in the running site rather than in a bare page, because the letters
// are set in --font-display and the face gradient is the component's own. A
// standalone page would fall back to a system font and the mark would be a
// different mark.
// No design prop: the logo wears whatever the game's cards wear. Naming one here
// is how the site came to wear a back that appeared nowhere on the table — the
// default was guilloche and this asked for foil, so the mark in the corner and
// the cards in your hand were two different objects for three weeks.
const card = renderToStaticMarkup(<CardBack size="large" />);

// CARD_RATIO above is a copy of a number that lives in CardBack, so it is read
// back out of the markup and checked rather than trusted. If the back is ever
// redrawn on a different viewBox, this stops with the two numbers side by side
// instead of shipping a logo with its top and bottom shaved off — which is what
// happened, and which looked like a crop rather than a bug.
const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(card);
if (!viewBox) throw new Error("CardBack no longer renders a viewBox this script can read");
const drawn = Number(viewBox[2]) / Number(viewBox[1]);
if (Math.abs(drawn - CARD_RATIO) > 0.001) {
  throw new Error(
    `CardBack is drawn ${viewBox[1]}x${viewBox[2]} (${drawn.toFixed(3)}) and this script frames ` +
      `it at ${CARD_RATIO.toFixed(3)}. preserveAspectRatio="slice" crops the difference away ` +
      `instead of showing it. Set CARD_RATIO to ${drawn.toFixed(4)}.`,
  );
}

const html = `
<div style="position:relative;width:${W}px;height:${H}px;display:flex;
     align-items:center;justify-content:center;perspective:${W * 2.6}px">

  <!-- Nudged left, because what the frame has to hold is not the card but the
       card plus its thickness, and the slabs only stick out on one side. Centre
       the card and the thing you see sits off-centre; this centres what is
       actually drawn. The number came from measuring the render, not from
       taste. -->
  <div style="position:relative;transform:translateX(-${CARD_W * 0.038}px)
       rotateY(-15deg) rotateX(3deg) rotateZ(-1.5deg);
       transform-style:preserve-3d">

    <!-- The thickness. Two slabs behind the face, each a step further back and
         darker, which is cheaper than a real extruded edge and reads the same
         at the size this is ever shown. -->
    <div style="position:absolute;inset:0;border-radius:${CARD_W * 0.068}px;
      background:#170b2e;transform:translateZ(-14px) translateX(9px)"></div>
    <div style="position:absolute;inset:0;border-radius:${CARD_W * 0.068}px;
      background:#2a1250;transform:translateZ(-7px) translateX(4px)"></div>

    <div style="position:relative;width:${CARD_W}px;height:${CARD_H}px;
      border-radius:${CARD_W * 0.068}px;overflow:hidden">
      ${card}

      <!-- The sheen. A single soft diagonal band, low opacity: what sells a
           struck face is one highlight travelling across it, not an even
           brightening, which just looks like the opacity slipped. -->
      <div style="position:absolute;inset:0;background:linear-gradient(115deg,
        rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 20%,
        transparent 45%, transparent 100%)"></div>
    </div>
  </div>
</div>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  const response = await page.goto(SITE, { waitUntil: "networkidle" });
  // A dev server that is not running gives a connection error rather than a
  // response, and Playwright's own message for that names a port and not the
  // thing you forgot. Say the thing you forgot.
  if (!response?.ok()) throw new Error(`${SITE} did not answer. Is \`npm run dev\` running?`);

  // Whose dev server is this. A sibling project shares the machine, the port
  // and most of the CSS variable names, so landing on the wrong one produces a
  // logo rather than an error — the failure this whole file exists to avoid.
  const title = await page.title();
  if (!title.includes("Cards of Cronos")) {
    throw new Error(
      `${SITE} is serving "${title}", which is not this game. Something else has the port; ` +
        `start this project's dev server and pass it, e.g. PORT=3001 npm run site-logo.`,
    );
  }

  await page.evaluate(
    ({ html, W, H }) => {
      // Clear the page before composing on it.
      //
      // The stage used to be a transparent box laid over the running site, and
      // with an opaque backdrop that was fine. Take the backdrop away for a
      // transparent PNG and the site behind it is photographed too: the first
      // version of this shot had the nav, a heading and a wallet button baked
      // into the logo's background. omitBackground only drops the browser's own
      // white; it does not drop a page.
      //
      // A stylesheet rather than a loop over the children, because the loop was
      // not enough: Next's dev overlay mounts itself into a portal after the
      // script has run, and it turned up as a black bar in the corner of the
      // file. A rule applies to whatever arrives later too.
      //
      // The stylesheets stay — the fonts and the colour tokens are the whole
      // reason for composing inside the site rather than in a blank page.
      const hide = document.createElement("style");
      hide.textContent = `
        html, body { background: transparent !important; }
        body > *:not(#site-logo) { display: none !important; }
        nextjs-portal { display: none !important; }
        /* The faint grid the site draws over everything is .grid-lines::after
           on the body itself. A rule about the body's children does not touch
           it, and it is fixed and full-screen, so it covered the whole render
           in a wash that reads as texture rather than as a mistake. */
        body::before, body::after, html::before, html::after { display: none !important; }`;
      document.head.append(hide);

      const stage = document.createElement("div");
      stage.id = "site-logo";
      stage.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;
        width:${W}px;height:${H}px;overflow:hidden;
        display:flex;align-items:center;justify-content:center`;
      stage.innerHTML = html;
      document.body.append(stage);
    },
    { html, W, H },
  );

  const stage = page.locator("#site-logo");
  await page.waitForTimeout(400);
  const shot = await stage.screenshot({ type: "png", omitBackground: true });

  // What surrounds the card has to be nothing at all. This is checked rather
  // than eyeballed because the version with a whole web page behind it looked
  // entirely fine at the size the nav shows it, and was obviously wrong the
  // moment anybody opened the file. The border of the image is sampled: every
  // pixel around the edge must have an alpha of zero.
  const opaque = await page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext("2d");
    if (!ctx) return -1;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    // Inline rather than a helper: this body is serialised into the browser,
    // and the bundler rewrites named functions with a helper of its own that
    // does not exist on the other side. It fails with `__name is not defined`,
    // which says nothing about the actual cause.
    let found = 0;
    for (let x = 0; x < c.width; x++) {
      if (data[x * 4 + 3]! > 0) found++;
      if (data[((c.height - 1) * c.width + x) * 4 + 3]! > 0) found++;
    }
    for (let y = 0; y < c.height; y++) {
      if (data[y * c.width * 4 + 3]! > 0) found++;
      if (data[(y * c.width + c.width - 1) * 4 + 3]! > 0) found++;
    }
    return found;
  }, Array.from(shot));

  if (opaque < 0) throw new Error("could not read the render back to check it");
  if (opaque > 0) {
    throw new Error(
      `${opaque} pixels along the border of the render are not transparent. Something is ` +
        `behind the card — a page that did not get hidden, or a glow that spills to the edge.`,
    );
  }

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, shot);
  await browser.close();

  console.log(`${OUT}  ${W * 2}x${H * 2}  ${(shot.length / 1024).toFixed(0)} KB`);
}

void main();
