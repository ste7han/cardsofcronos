// The og:image host.
//
// This shipped. The first deploy on cardsofcronos.com served
//
//   <meta property="og:image" content="http://localhost:3000/opengraph-image.png">
//
// because metadataBase fell back to the dev server, written back when there was
// no domain to fall back to. Nothing failed. The build was clean, the page was
// fine, and the only symptom was that a link pasted into Telegram or X would
// have come back as a blank rectangle — visible to everyone except the person
// who deployed it.
//
// That is the shape of failure this project keeps paying for: a default that is
// right on the machine that wrote it and wrong everywhere else. So it gets a
// test rather than a comment.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const LAYOUT = readFileSync("app/layout.tsx", "utf8");

describe("metadataBase", () => {
  it("does not fall back to a host only the developer can reach", () => {
    // The env var is the override for preview deploys and may be anything.
    // What is checked is the literal default sitting in the source.
    const fallback = LAYOUT.match(/metadataBase: new URL\([^)]*\?\?\s*"([^"]+)"/)?.[1];

    expect(fallback, "metadataBase has no string fallback any more").toBeTruthy();
    expect(fallback).not.toMatch(/localhost|127\.0\.0\.1|0\.0\.0\.0/);
    expect(fallback).toMatch(/^https:\/\//);
  });
});
