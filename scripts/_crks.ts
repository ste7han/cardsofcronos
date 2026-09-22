// Wie houdt CRKS, en hoeveel. De momentopname voor de airdrop.
//
//   npx tsx scripts/_crks.ts
//
// Twee stappen. Eerst elke Transfer sinds het contract bestaat, om te weten
// WELKE adressen er ooit bij betrokken waren; dan balanceOf op één blok, om te
// weten wat ze NU houden. De tweede stap is wat telt — de eerste bestaat alleen
// omdat een ERC20 geen lijst van houders bijhoudt.
//
// ── WAAROM ÉÉN ENDPOINT ──────────────────────────────────────────────────────
// Alleen evm.cronos.org bedient logs. publicnode geeft op historische bereiken
// een lege array terug met HTTP 200, en drpc antwoordt met 400 — zie de notitie
// in lib/cronos.ts, waar dat een dag aan burns kostte. Een leeg bereik is een
// geldig antwoord, dus er valt niets aan te controleren; het enige wat helpt is
// weten welke endpoint geschiedenis heeft.
//
// ── HET SCHRIJFT ZIJN VOORTGANG OP ───────────────────────────────────────────
// Drieënhalf uur werk dat bij een hapering opnieuw moet beginnen, begint nooit
// af. De stand gaat elke honderd vensters naar schijf en de run pakt hem op.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RPC = "https://evm.cronos.org";
const CRKS = "0x03c87fa1b19b1fc9cf6ee2a88056e01ecca6cb51";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BIRTH = 61_254_078;
const WIDTH = 2000; // evm.cronos.org weigert 2001.
const STATE = "/tmp/crks-scan.json";

interface State { upto: number; head: number; seen: string[] }

async function ask<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await response.text();
  // Als tekst: bij knijpen komt er een HTML-pagina terug, en response.json()
  // zegt dan alleen "Unexpected token <".
  if (!text.startsWith("[") && !text.startsWith("{")) {
    throw new Error(`http ${response.status}: ${text.slice(0, 70).replace(/\s+/g, " ")}`);
  }
  const body = JSON.parse(text) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result as T;
}

async function window(from: number, to: number): Promise<{ topics: string[] }[]> {
  return ask("eth_getLogs", [{
    address: CRKS, topics: [TRANSFER],
    fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16),
  }]);
}

async function main() {
  const head = Number(BigInt(await ask<string>("eth_blockNumber", [])));

  let state: State = { upto: BIRTH, head, seen: [] };
  if (existsSync(STATE)) {
    const saved = JSON.parse(readFileSync(STATE, "utf8")) as State;
    // Alleen oppakken als het over hetzelfde blok gaat. Een oude stand tegen een
    // nieuwe kop is een lijst met een gat erin waarvan niemand weet.
    if (saved.head === head || saved.upto < head) state = { ...saved, head: saved.head || head };
    console.error(`opgepakt bij blok ${state.upto.toLocaleString("nl-NL")}, ${state.seen.length} adressen`);
  }

  const seen = new Set(state.seen);
  const windows = Math.ceil((state.head - state.upto) / WIDTH);
  console.error(`${windows.toLocaleString("nl-NL")} vensters te gaan tot blok ${state.head.toLocaleString("nl-NL")}`);

  let done = 0;
  const began = Date.now();
  for (let from = state.upto; from <= state.head; from += WIDTH) {
    const to = Math.min(from + WIDTH - 1, state.head);

    let logs: { topics: string[] }[] | null = null;
    for (let attempt = 0; attempt < 8 && logs === null; attempt++) {
      try { logs = await window(from, to); }
      catch (e) {
        if (attempt === 7) throw new Error(`blok ${from}-${to} gaf het op: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    for (const log of logs!) {
      // topics[1] is van, topics[2] is naar. Allebei 32 bytes met het adres in
      // de laatste 20.
      for (const topic of log.topics.slice(1, 3)) seen.add("0x" + topic.slice(-40));
    }

    state.upto = to + 1;
    done++;
    if (done % 100 === 0) {
      writeFileSync(STATE, JSON.stringify({ ...state, seen: [...seen] }));
      const per = done / ((Date.now() - began) / 1000);
      const left = Math.ceil((state.head - state.upto) / WIDTH) / per / 60;
      console.error(`  blok ${state.upto.toLocaleString("nl-NL")} · ${seen.size} adressen · nog ${left.toFixed(0)} min`);
    }
  }

  writeFileSync(STATE, JSON.stringify({ ...state, seen: [...seen] }));
  console.error(`\nklaar: ${seen.size} adressen ooit gezien. Nu de saldi op blok ${state.head}.`);

  // Wat ze NU houden. Stapels van tien — meer weigert deze endpoint.
  const addresses = [...seen].filter((a) => a !== "0x" + "0".repeat(40));
  const balances = new Map<string, bigint>();
  for (let i = 0; i < addresses.length; i += 10) {
    const chunk = addresses.slice(i, i + 10);
    const body = chunk.map((address, k) => ({
      jsonrpc: "2.0", id: k, method: "eth_call",
      params: [{ to: CRKS, data: "0x70a08231" + address.replace(/^0x/, "").padStart(64, "0") },
               "0x" + state.head.toString(16)],
    }));
    let rows: { id: number; result?: string }[] | null = null;
    for (let attempt = 0; attempt < 8 && rows === null; attempt++) {
      try {
        const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const text = await r.text();
        if (!text.startsWith("[")) throw new Error(text.slice(0, 60));
        rows = JSON.parse(text) as { id: number; result?: string }[];
      } catch {
        if (attempt === 7) throw new Error(`saldi voor ${chunk[0]} gaven het op`);
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
    for (const row of rows!) {
      if (row.result === undefined) throw new Error(`geen saldo voor ${chunk[row.id]}`);
      const held = BigInt(row.result);
      if (held > 0n) balances.set(chunk[row.id]!, held);
    }
    if (i % 500 === 0) console.error(`  saldi ${i}/${addresses.length}`);
  }

  const sorted = [...balances.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1));
  writeFileSync("/tmp/crks-holders.json", JSON.stringify({
    token: CRKS, block: state.head, readAt: new Date().toISOString(),
    holders: sorted.map(([address, held]) => ({ address, held: held.toString() })),
  }, null, 1));

  const whole = (n: bigint) => Number(n / 10n ** 18n);
  const total = sorted.reduce((s, [, n]) => s + n, 0n);
  console.log(`\nCRKS houders: ${sorted.length}`);
  console.log(`samen: ${whole(total).toLocaleString("nl-NL")} van 1.000.000.000`);
  for (const floor of [1, 100_000, 1_000_000, 5_000_000, 10_000_000]) {
    const many = sorted.filter(([, n]) => whole(n) >= floor);
    console.log(`  >= ${floor.toLocaleString("nl-NL").padStart(12)}: ${String(many.length).padStart(4)} houders`);
  }
  console.log("weggeschreven naar /tmp/crks-holders.json");
}

main().catch((e) => { console.error("FOUT:", (e as Error).message); process.exit(1); });
