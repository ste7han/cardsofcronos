// One small hash, used in two places that must not drift.
//
// FNV-1a, 32-bit. It is here rather than written out twice because both callers
// need the same number for the same input across builds: lib/store.ts turns a
// match id into a seed, and a replay of that match must deal the same cards
// forever; lib/history.ts turns a deck into a key, and a deck's record has to
// still be that deck's record next week.
//
// Not a checksum and not a security primitive. It is short, fast and stable,
// which is all either caller wants.

export function fnv1a(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
