// One site, one hostname.
//
// The same shape of pairing test/cron.test.ts guards, and the same quiet
// failure: wrangler.jsonc claims two custom domains, and whether the second one
// is a redirect or a second copy of the site is decided in a different file.
// Nothing fails if they disagree — both hostnames answer 200 and everything
// looks fine, while anything scoped to a host quietly works on one of them and
// not the other. That is how "Bot domain invalid" happened: Telegram allows one
// domain per bot and the site had two.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");

/** The hostnames wrangler points at this Worker. */
function routed(): string[] {
  return [...wrangler.matchAll(/"pattern"\s*:\s*"([^"]+)"/g)].map((m) => m[1]!);
}

describe("the hostnames this Worker answers on", () => {
  it("sends every one of them but the canonical host to the canonical host", () => {
    // Written as a sweep rather than against the one name, so a third domain
    // added to wrangler.jsonc without a redirect fails here instead of becoming
    // another silently-wrong copy.
    const hosts = routed();
    expect(hosts).toContain("cardsofcronos.com");

    for (const host of hosts) {
      if (host === "cardsofcronos.com") continue;
      expect(config, `${host} has no redirect`).toContain(`value: "${host}"`);
    }
  });

  it("points them at the apex and not at each other", () => {
    expect(config).toContain('destination: "https://cardsofcronos.com/:path*"');
  });

  it("keeps the path, because a redirect to the front page loses the link", () => {
    // Somebody arriving on www/pvp?offer=abc is arriving for that offer.
    expect(config).toContain('source: "/:path*"');
  });

  it("matches on an exact host, so the destination cannot match its own rule", () => {
    // A prefix or suffix match would catch the apex too and loop — and a
    // permanent redirect that loops is cached in everybody's browser.
    expect(config).toContain('type: "host"');
    expect(config).not.toMatch(/value:\s*"[^"]*\*/);
  });
});
