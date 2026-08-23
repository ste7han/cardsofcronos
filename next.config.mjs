import { fileURLToPath } from "node:url";

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Without this Turbopack looks for a package-lock.json above this directory
    // and warns that it is ignoring one outside the repo.
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

/**
 * The Cloudflare bindings, in development.
 *
 * Without this `getCloudflareContext()` throws, so every route that touches D1
 * or a Worker variable returns a 500 — which is every route that does anything:
 * the burn totals, the wallet balances, the whole of PvP, referrals and points.
 *
 * It was missing, and the reason it went unnoticed for so long is worth saying.
 * `npm run dev` starts, every page renders, and the failure is confined to
 * fetches that the pages are written to survive: /burn shows "—" when it cannot
 * read a total, which is exactly what it should do when an RPC is down and
 * exactly what it did when nothing was configured at all. A site that degrades
 * gracefully hides its own broken half.
 *
 * It runs D1 locally through miniflare, in .wrangler/, so nothing here touches
 * the real database — the id in wrangler.jsonc is still a TODO.
 */
initOpenNextCloudflareForDev();

export default nextConfig;
