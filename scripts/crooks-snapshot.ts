// Who holds Crooks Legends, and how many, so free mints can be handed out by rank.
//
//   npm run crooks-snapshot           read it, resuming if a run was cut short
//   npm run crooks-snapshot -- --fresh  start over
//
// Writes data/crooks-snapshot.json: one address, one count, sorted. That file is
// what scripts/allowlist.ts turns into free mints.
//
// ── READ WITH ownerOf, NOT FROM THE LOGS ─────────────────────────────────────
//
// An ERC20 has no list of its holders, so finding CRKS holders means replaying
// every Transfer since the token existed — three and a half hours against a
// throttled endpoint, and it was abandoned twice. An ERC721 does not need any of
// that: ask who owns token 1, then token 2, and keep going. Ten thousand plain
// calls instead of forty thousand log windows.
//
// STACKS OF TEN. evm.cronos.org refuses eleven and says so in every line of the
// answer, wrapped in an HTTP 200 — so a stack of two hundred comes back as two
// hundred tidy error rows. A reader that only looks at `result` turns that into
// ten thousand cards with no owner and reports nothing.
//
// ── IT SAVES AS IT GOES ──────────────────────────────────────────────────────
//
// The version this replaces held everything in memory and wrote once at the end.
// It was interrupted twice and both runs were worth nothing — and the second
// time the partial state was in /tmp, which had been cleared by the time anybody
// looked. Progress now goes to disk every few hundred tokens, in the repository,
// and a new run picks it up.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { RANKS, rankOf } from "@/lib/crooks";
import { selector } from "@/lib/evm-tx";

const CRKL = "0x44102b7ab3e2b8edf77d188cd2b173ecbda60967";
const SUPPLY = 10_000;
const STACK = 10;
const AT_ONCE = 6;
const OUT = "data/crooks-snapshot.json";
const PART = "data/.crooks-partial.json";

/**
 * Spread over three endpoints. One does not manage it: evm.cronos.org starts
 * answering 429 with an HTML page at around two thousand tokens. `ownerOf` is an
 * ordinary call, so the warning in lib/cronos.ts about endpoints returning empty
 * logs does not apply here.
 */
const RPCS = [
  "https://evm.cronos.org",
  "https://cronos-evm-rpc.publicnode.com",
  "https://cronos.drpc.org",
];

interface Row {
  id: number;
  result?: string;
  error?: { code: number; message: string };
}

/** The owners of ten tokens. Throws on anything that is not "does not exist". */
async function batch(ids: number[], rpc: string): Promise<[number, string | null][]> {
  const body = ids.map((id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [
      { to: CRKL, data: selector("ownerOf(uint256)") + id.toString(16).padStart(64, "0") },
      "latest",
    ],
  }));
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Read as text: asking too fast returns an HTML error page wrapped in an HTTP
  // 200, and response.json() then throws something that says nothing about why.
  const text = await response.text();
  let rows: Row[];
  try {
    rows = JSON.parse(text) as Row[];
  } catch {
    throw new Error(`not json (http ${response.status}): ${text.slice(0, 80).replace(/\s+/g, " ")}`);
  }
  if (!Array.isArray(rows)) throw new Error(`not an array: ${JSON.stringify(rows).slice(0, 160)}`);

  return rows.map((row): [number, string | null] => {
    if (row.result !== undefined) return [row.id, "0x" + row.result.slice(-40).toLowerCase()];
    // Only a revert means "this token does not exist". Anything else is a
    // failure to read, and must stop the run rather than quietly leaving a card
    // with no owner.
    if (row.error?.code === 3) return [row.id, null];
    throw new Error(`${row.error?.message ?? "no answer"} (token ${row.id})`);
  });
}

interface Partial {
  owners: Record<string, string>;
  gone: number;
  done: number;
}

function load(): Partial {
  if (process.argv.includes("--fresh") || !existsSync(PART)) {
    return { owners: {}, gone: 0, done: 0 };
  }
  const saved = JSON.parse(readFileSync(PART, "utf8")) as Partial;
  console.error(`  picking up at token ${saved.done}, ${Object.keys(saved.owners).length} read\n`);
  return saved;
}

async function main() {
  mkdirSync("data", { recursive: true });
  const state = load();
  const owners = new Map<number, string>(
    Object.entries(state.owners).map(([id, who]) => [Number(id), who]),
  );
  let gone = state.gone;
  const failed: number[][] = [];

  const stacks: number[][] = [];
  for (let from = state.done + 1; from <= SUPPLY; from += STACK) {
    stacks.push(Array.from({ length: Math.min(STACK, SUPPLY - from + 1) }, (_, i) => from + i));
  }

  const save = (done: number) => {
    writeFileSync(
      PART,
      JSON.stringify({ owners: Object.fromEntries(owners), gone, done } satisfies Partial),
    );
  };

  for (let i = 0; i < stacks.length; i += AT_ONCE) {
    const now = stacks.slice(i, i + AT_ONCE);
    const answers = await Promise.all(
      now.map(async (ids, k) => {
        for (let attempt = 0; attempt < 6; attempt++) {
          // A different endpoint each attempt, so a throttled one gets swapped
          // rather than merely waited on.
          const rpc = RPCS[(i + k + attempt) % RPCS.length]!;
          try {
            return await batch(ids, rpc);
          } catch {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          }
        }
        // Do not stop the run. What did not land comes back at the end: throwing
        // away eight thousand read cards over ten failed ones costs more than
        // trying again.
        failed.push(ids);
        return [] as [number, string | null][];
      }),
    );
    for (const rows of answers) {
      for (const [id, owner] of rows) {
        if (owner === null) gone++;
        else owners.set(id, owner);
      }
    }
    const done = now[now.length - 1]?.[STACK - 1] ?? state.done;
    if (i % 60 === 0) {
      save(done);
      process.stderr.write(`  ${done} / ${SUPPLY}\n`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  // The stragglers, one at a time and left alone in between.
  if (failed.length > 0) {
    process.stderr.write(`  ${failed.length} stacks again…\n`);
    for (const ids of failed.splice(0)) {
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          for (const [id, owner] of await batch(ids, RPCS[attempt % RPCS.length]!)) {
            if (owner === null) gone++;
            else owners.set(id, owner);
          }
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          if (attempt === 7) failed.push(ids);
        }
      }
    }
  }
  if (failed.length > 0) {
    // Out loud. A holder list with gaps nobody knows about is exactly the kind
    // of file an airdrop gets built on later.
    console.error(`NOT READ: ${failed.flat().length} tokens. This list is incomplete.`);
    save(SUPPLY);
    process.exit(1);
  }

  const byHolder = new Map<string, number>();
  for (const owner of owners.values()) byHolder.set(owner, (byHolder.get(owner) ?? 0) + 1);
  const sorted = [...byHolder.entries()].sort((a, b) => b[1] - a[1]);

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        note:
          "Who held Crooks Legends when this was read, by ownerOf on every token id. " +
          "Built by scripts/crooks-snapshot.ts. One address, one count.",
        contract: CRKL,
        at: new Date().toISOString(),
        tokens: owners.size,
        holders: sorted.length,
        held: Object.fromEntries(sorted),
      },
      null,
      1,
    ),
  );

  console.log(`\n  tokens read ${owners.size}   never minted or burned ${gone}`);
  console.log(`  holders     ${sorted.length}\n`);
  console.log("  by rank:");
  const counted = new Map<string, { holders: number; tokens: number }>();
  for (const [, held] of sorted) {
    const rank = rankOf(held);
    const row = counted.get(rank) ?? { holders: 0, tokens: 0 };
    counted.set(rank, { holders: row.holders + 1, tokens: row.tokens + held });
  }
  for (const rank of [...RANKS].reverse()) {
    const row = counted.get(rank.name);
    if (row === undefined) continue;
    console.log(
      `    ${rank.name.padEnd(15)} ${String(rank.from).padStart(3)}+   ` +
        `${String(row.holders).padStart(4)} holders   ${String(row.tokens).padStart(5)} cards`,
    );
  }
  console.log(`\n  ${OUT}\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
