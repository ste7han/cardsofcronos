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

/** Card proportions. The nav sizes by height, so only the ratio matters. */
const W = 612;
const H = 802;

// Composed in the running site rather than in a bare page, because the letters
// are set in --font-display and the face gradient is the component's own. A
// standalone page would fall back to a system font and the mark would be a
// different mark.
const card = renderToStaticMarkup(<CardBack size="large" design="foil" />);

const html = `
<div style="position:relative;width:${W}px;height:${H}px;display:flex;
     align-items:center;justify-content:center;perspective:${W * 2.6}px">

  <!-- The bloom behind it. Without this the card is a bright shape on flat
       black and reads as a sticker; a little spill sets it in a room. -->
  <div style="position:absolute;width:${W * 0.95}px;height:${H * 0.8}px;
    background:radial-gradient(50% 50% at 50% 50%, rgba(157,78,221,0.30), transparent 70%);
    filter:blur(${W * 0.06}px)"></div>

  <div style="position:relative;transform:rotateY(-15deg) rotateX(3deg) rotateZ(-1.5deg);
       transform-style:preserve-3d">

    <!-- The thickness. Two slabs behind the face, each a step further back and
         darker, which is cheaper than a real extruded edge and reads the same
         at the size this is ever shown. -->
    <div style="position:absolute;inset:0;border-radius:${W * 0.062}px;
      background:#160a2c;transform:translateZ(-14px) translateX(9px)"></div>
    <div style="position:absolute;inset:0;border-radius:${W * 0.062}px;
      background:#2a1250;transform:translateZ(-7px) translateX(4px)"></div>

    <div style="position:relative;width:${W * 0.88}px;height:${H * 0.88}px;
      border-radius:${W * 0.062}px;overflow:hidden;
      box-shadow:0 ${H * 0.05}px ${H * 0.09}px -${H * 0.03}px rgba(0,0,0,0.95),
                 0 0 ${W * 0.09}px rgba(157,78,221,0.35)">
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
      const stage = document.createElement("div");
      stage.id = "site-logo";
      stage.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;
        width:${W}px;height:${H}px;overflow:hidden;
        display:flex;align-items:center;justify-content:center`;
      stage.innerHTML = html;
      document.documentElement.append(stage);
    },
    { html, W, H },
  );

  const stage = page.locator("#site-logo");
  await page.waitForTimeout(400);
  const shot = await stage.screenshot({ type: "png", omitBackground: true });

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, shot);
  await browser.close();

  console.log(`${OUT}  ${W * 2}x${H * 2}  ${(shot.length / 1024).toFixed(0)} KB`);
}

void main();
