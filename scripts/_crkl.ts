// Wie houdt welke Crooks Legends, gelezen met ownerOf.
//
// Stapels van TIEN. evm.cronos.org weigert elf en zegt dat in elke regel van het
// antwoord, met HTTP 200 eromheen — een stapel van 200 komt dus terug als 200
// keurige foutregels. Een lezer die alleen naar `result` kijkt maakt daar
// tienduizend kaarten zonder eigenaar van en meldt niets.
import { writeFileSync } from "node:fs";
import { selector } from "@/lib/evm-tx";

const CRKL = "0x44102b7ab3e2b8edf77d188cd2b173ecbda60967";
// Verdeeld over drie endpoints. Een enkele haalt het niet: evm.cronos.org gaat
// rond de tweeduizend tokens op 429 met een HTML-pagina. ownerOf is een gewone
// call, dus de waarschuwing in lib/cronos.ts over endpoints die logs leeg
// teruggeven speelt hier niet.
const RPCS = [
  "https://evm.cronos.org",
  "https://cronos-evm-rpc.publicnode.com",
  "https://cronos.drpc.org",
];
const SUPPLY = 10_000;
const STACK = 10;
const AT_ONCE = 6;

interface Row { id: number; result?: string; error?: { code: number; message: string } }

/** Eigenaren van tien tokens. Gooit bij alles wat geen "bestaat niet" is. */
async function batch(ids: number[], rpc: string): Promise<[number, string | null][]> {
  const body = ids.map((id) => ({
    jsonrpc: "2.0", id, method: "eth_call",
    params: [{ to: CRKL, data: selector("ownerOf(uint256)") + id.toString(16).padStart(64, "0") }, "latest"],
  }));
  const response = await fetch(rpc, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  // Als tekst gelezen: bij te snel vragen komt er een HTML-foutpagina terug met
  // HTTP 200 eromheen, en response.json() gooit dan iets wat niets zegt over de
  // oorzaak.
  const text = await response.text();
  let rows: Row[];
  try { rows = JSON.parse(text) as Row[]; }
  catch { throw new Error(`geen json (http ${response.status}): ${text.slice(0, 80).replace(/\s+/g, " ")}`); }
  if (!Array.isArray(rows)) throw new Error(`geen array: ${JSON.stringify(rows).slice(0, 160)}`);

  return rows.map((row): [number, string | null] => {
    if (row.result !== undefined) return [row.id, "0x" + row.result.slice(-40)];
    // Alleen een revert betekent "dit token bestaat niet". Al het andere is een
    // fout in het lezen en moet de run stoppen, niet een kaart stilletjes
    // zonder eigenaar laten.
    if (row.error?.code === 3) return [row.id, null];
    throw new Error(`${row.error?.message ?? "geen antwoord"} (token ${row.id})`);
  });
}

async function main() {
  const owners = new Map<number, string>();
  const failed: number[][] = [];
  let gone = 0;

  const stacks: number[][] = [];
  for (let from = 1; from <= SUPPLY; from += STACK) {
    stacks.push(Array.from({ length: Math.min(STACK, SUPPLY - from + 1) }, (_, i) => from + i));
  }

  for (let i = 0; i < stacks.length; i += AT_ONCE) {
    const now = stacks.slice(i, i + AT_ONCE);
    const answers = await Promise.all(now.map(async (ids, k) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        // Een andere endpoint per poging, zodat een geknepen endpoint een
        // andere krijgt in plaats van alleen langer wachten.
        const rpc = RPCS[(i + k + attempt) % RPCS.length]!;
        try { return await batch(ids, rpc); }
        catch {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      // Niet de run stoppen. Wat niet gelukt is komt aan het eind terug, want
      // achtduizend gelezen kaarten weggooien om tien mislukte is duurder dan
      // het nog eens proberen.
      failed.push(ids);
      return [] as [number, string | null][];
    }));
    for (const rows of answers) {
      for (const [id, owner] of rows) { if (owner === null) gone++; else owners.set(id, owner); }
    }
    if (i % 100 === 0) process.stderr.write(`  ${i * STACK}…\n`);
    await new Promise((r) => setTimeout(r, 250));
  }

  // De achterblijvers, een voor een en met rust.
  if (failed.length > 0) {
    process.stderr.write(`  ${failed.length} stapels opnieuw…\n`);
    for (const ids of failed.splice(0)) {
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          for (const [id, owner] of await batch(ids, RPCS[attempt % RPCS.length]!)) {
            if (owner === null) gone++; else owners.set(id, owner);
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
    // Hardop. Een houderslijst met gaten waarvan niemand weet is precies het
    // soort bestand waar later een airdrop op wordt gebouwd.
    console.error(`NIET GELEZEN: ${failed.flat().length} tokens. Deze lijst is niet compleet.`);
  }

  const byHolder = new Map<string, number>();
  for (const owner of owners.values()) byHolder.set(owner, (byHolder.get(owner) ?? 0) + 1);
  const sorted = [...byHolder.entries()].sort((a, b) => b[1] - a[1]);

  console.log("\ntokens gelezen:", owners.size, "| bestaat niet:", gone);
  console.log("houders:", sorted.length);
  console.log("grootste tien:", sorted.slice(0, 10).map(([, n]) => n).join(" "));
  for (const b of [1, 2, 3, 5, 10, 25, 50, 100]) {
    const many = sorted.filter(([, n]) => n >= b);
    console.log(`  >= ${String(b).padStart(3)}: ${String(many.length).padStart(4)} houders, samen ${many.reduce((s, [, n]) => s + n, 0)} kaarten`);
  }
  writeFileSync("/tmp/crkl-holders.json", JSON.stringify(Object.fromEntries(sorted), null, 1));
  console.log("weggeschreven naar /tmp/crkl-holders.json");
}
main().catch((e) => console.error("FOUT:", (e as Error).message));
