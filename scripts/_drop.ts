import { selector } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD } from "@/lib/revenue";
const RPC = "https://evm.cronos.org";
const DROP = CONTRACTS.drop!;
async function call(to: string, data: string) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
  const j = (await r.json()) as { result?: string; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result ?? "0x";
}
const n = (h: string) => BigInt(h === "0x" ? "0x0" : h);
const whole = (v: bigint) => (v / 10n ** 18n).toLocaleString("nl-NL");
const pad = (a: string) => a.replace(/^0x/, "").toLowerCase().padStart(64, "0");

(async () => {
  const root = await call(DROP, selector("root()"));
  const pending = await call(DROP, selector("pendingRoot()"));
  const at = n(await call(DROP, selector("pendingAt()")));
  const promised = n(await call(DROP, selector("promised()")));
  const pendingPromised = n(await call(DROP, selector("pendingPromised()")));
  const paid = n(await call(DROP, selector("paidOut()")));
  const held = n(await call(CROCARD, selector("balanceOf(address)") + pad(DROP)));

  const zero = "0x" + "0".repeat(64);
  console.log("live root      ", root === zero ? "GEEN — niemand kan claimen" : root);
  console.log("beloofd        ", whole(promised), "$CROCARD");
  console.log("uitbetaald     ", whole(paid));
  console.log("in het contract", whole(held));
  console.log();
  if (at === 0n) {
    console.log("in de wacht    GEEN voorstel");
  } else {
    const when = new Date(Number(at) * 1000);
    const left = Number(at) * 1000 - Date.now();
    console.log("in de wacht    ", pending);
    console.log("  belooft      ", whole(pendingPromised), "$CROCARD");
    console.log("  adopteerbaar ", when.toLocaleString("nl-NL"),
      left > 0 ? `— nog ${Math.ceil(left / 60000)} min te gaan` : `— KAN NU, ${Math.floor(-left / 3600000)} uur geleden rijp`);
  }
})();
