// The card back, shot the same way the fronts are: one element, no page
// furniture, the browser's own pixel ratio rather than a scaled-up copy.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const OUT = process.argv[2] ?? "out/back";
const SCALE = Number(process.argv[3] ?? 4);
async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 400, height: 520 }, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/back/image", { waitUntil: "networkidle", timeout: 120_000 });
  // The dev server paints its own indicator over the bottom-left of the page,
  // and this route renders inside the site layout rather than bare, so the badge
  // lands on top of the card instead of beside it. The fronts are unaffected —
  // their route has no header or footer and the element sits elsewhere. It would
  // have been baked into the one image every token carries until the reveal.
  await page.addStyleTag({
    content: "nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important }",
  });
  await page.waitForTimeout(500);
  const target = page.locator("#card-image");
  await target.waitFor({ state: "visible", timeout: 120_000 });
  const box = await target.boundingBox();
  await target.screenshot({ path: `${OUT}/back.png` });
  await browser.close();
  console.log(`card back written to ${OUT}/back.png  (${box!.width}x${box!.height} at ${SCALE}x)`);
}
main();
