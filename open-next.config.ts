// The adapter's default with the incremental cache served from static assets.
//
// Its own template uses R2, which is not in this account's token scopes. The
// static-assets backend needs neither R2 nor KV, and it fits what this site is:
// every card page is prerendered at build time and none of them is ever rebuilt
// while running, so the "cache" is a pile of files that never changes between
// deploys. That is what static assets are.
//
// Without any incremental cache the prerendered pages have nowhere to be served
// from and /card/<id>/image returned 404 while /cards, which is genuinely
// static, worked. That is the tell: a route marked ● in the build output needs
// this and a route marked ○ does not.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
