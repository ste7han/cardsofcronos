// The card as a file, and whether there is one for every card.
//
// /cards offers a close-up with a download under it, and the download is a real
// file in public/render rather than something composed on the fly: a card is
// HTML here — a frame, an art window, a footer of stats — so "the card as an
// image" only exists because scripts/render-cards.ts screenshotted it.
//
// What that arrangement can lose is a card added to the set and never rendered,
// which is a download that 404s on one card out of four hundred and forty-eight
// and is found by whoever tries to post that one.
//
// ── IT SKIPS ON A CLEAN CLONE, AND SAYS SO ───────────────────────────────────
//
// The files are gitignored, for the reason public/art is: sixty megabytes that
// are served rather than sourced. So a fresh checkout has no public/render and
// this cannot be a failure there — a test that fails for everybody who has not
// run a Playwright script is a test that gets muted, and a muted test is worse
// than none.
//
// What it does NOT check is whether a render is up to date. Nothing can, from
// here: a rebalance changes data/cards.ts and leaves the picture showing the old
// numbers, exactly as it did to eight images in the first collection. That is
// written on public/render/README.md where somebody re-rendering will read it.

import { existsSync, readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SET } from "@/lib/set";

const dir = new URL("../public/render/", import.meta.url);
const there = existsSync(dir);

describe.skipIf(!there)("the rendered cards", () => {
  const files = new Set<string>(
    there ? readdirSync(dir).filter((name) => name.endsWith(".webp")) : [],
  );

  it("has one for every card in the set", () => {
    const missing = SET.filter((card) => !files.has(`${card.id}.webp`)).map((card) => card.id);
    expect(missing, `no render for: ${missing.slice(0, 5).join(", ")}`).toEqual([]);
  });

  it("has none for a card that is not in the set", () => {
    // A render left behind by a card that was renamed or cut. Harmless to
    // serve and worth knowing about, because it means the folder was not
    // rebuilt and the one that replaced it may be missing too.
    const known = new Set(SET.map((card) => `${card.id}.webp`));
    const extra = [...files].filter((name) => !known.has(name));
    expect(extra, `left over: ${extra.slice(0, 5).join(", ")}`).toEqual([]);
  });
});

describe("the close-up that offers them", () => {
  const gallery = readFileSync(new URL("../components/Gallery.tsx", import.meta.url), "utf8");

  it("points at the file by the card's own id", () => {
    // Where the folder and the page have to agree. Get this wrong and nothing
    // looks broken: the grid opens, the card draws, and only the download is a
    // 404 — on every card at once.
    expect(gallery).toContain("`/render/${card.id}.webp`");
  });

  it("downloads rather than opening a tab to right-click in", () => {
    // The whole ask was saving the card, and a plain href to a .webp opens it
    // in the browser instead. The attribute is the difference between handing
    // somebody the file and handing them one more step.
    expect(gallery).toMatch(/download=\{`\$\{card\.id\}\.webp`\}/);
  });

  it("is the same gallery the profile draws, so the two cannot drift", () => {
    // /cards and /profile/cards are one component, and that is why asking for
    // the close-up on one of them was already asking for it on both. Written
    // down because the cheap way to add a card grid to a second page is to copy
    // the first one, and then a fix lands on one of them.
    const whole = readFileSync(new URL("../components/YourCards.tsx", import.meta.url), "utf8");
    const set = readFileSync(new URL("../app/cards/page.tsx", import.meta.url), "utf8");
    expect(whole).toContain("<Gallery cards={cards} />");
    expect(set).toContain("<Gallery cards={SET} />");
    expect(whole).toContain('from "@/components/Gallery"');
  });

  it("closes on the ground and not on the card", () => {
    // A close-up that shuts when you touch the thing you opened it to look at
    // is unusable on a phone, where the card fills most of the overlay.
    expect(gallery).toMatch(/onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  });
});
