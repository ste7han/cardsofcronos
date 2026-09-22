// The free mints, as a merkle tree.
//
//   npx tsx scripts/allowlist.ts [--per-card] [outdir]
//
// Reads data/holders-snapshot.json and turns it into an allowlist: one entry per
// address, with how many free mints that address gets. The contract stores the
// root; a claimer sends their quantity and a proof.
//
// ── ONE PER TOKEN, OR ONE PER DISTINCT CARD ─────────────────────────────────
// Both are computed here because the difference is small enough that it should
// be looked at rather than argued about: 515 mints per token against 487 per
// distinct card. The largest holder has 63 tokens covering 59 different cards.
//
// Default is per token. `--per-card` switches it. The quantity is a field in the
// leaf either way, so the contract does not know or care which was chosen — this
// is a decision about generosity, not about mechanics.
//
// ── MINTS GIVEN BY HAND ─────────────────────────────────────────────────────
// data/granted-mints.json is merged in: free mints somebody decided to give,
// on top of whatever the snapshot earns that address. They ADD rather than
// replace, so a holder who is also given some keeps both.
//
// The allowance can only ever go up. The contract counts what an address has
// already claimed against the allowance in its leaf, so a smaller number does
// not take anything back — it silently stops somebody mid-claim, which is the
// kind of quiet nothing this project keeps trying to make loud. This refuses it.
//
// ── THE BURN ADDRESS ────────────────────────────────────────────────────────
// Ten tokens sit at the old dapp's burn address. `ownerOf` calls it an owner and
// there is nobody behind it, so it is left out and the run says so. Anything
// minted to it would be minted to nobody.
//
// ── WHY THE TREE IS NOT HAND-ROLLED ─────────────────────────────────────────
// @openzeppelin/merkle-tree, and not twenty lines of keccak in this file. The
// rest of this project writes small things out rather than pulling them in —
// see lib/address.ts, which replaced a base58 decoder that was written by hand
// on purpose. The difference is the failure mode. A base58 decoder that is wrong
// throws. A merkle tree that is wrong produces a root that looks perfectly fine
// and proofs that no Solidity verifier will accept, and you find out on mint
// day. This library is by the same people as the verifier it has to match.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import { checksum, normalise } from "@/lib/address";

const BURN_ADDRESS = "0x42bcc1355808adf2344773c54e364257911ccc99";

const PER_CARD = process.argv.includes("--per-card");
// argv[2] onwards, first thing that is not a flag. The previous version matched
// on the name ending in "allowlist", so `--per-card data/allowlist-per-card`
// silently wrote over the default file with a different root. An allowlist
// quietly replaced by one with different numbers is the worst shape this script
// could fail in.
const OUT = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "data/allowlist";

interface Granted {
  grants: { address: string; mints: number; why: string; at: string }[];
}

interface Snapshot {
  contract: string;
  chainId: number;
  atBlock: number;
  readAt: string;
  minted: number;
  totalSupply: number;
  byHolder: { address: string; tokens: number[] }[];
}

function main(): void {
  const snapshot = JSON.parse(
    readFileSync("data/holders-snapshot.json", "utf8"),
  ) as Snapshot;
  const mapping = JSON.parse(
    readFileSync("data/legacy-token-mapping.json", "utf8"),
  ) as Record<string, string>;

  // Optional: there is nothing wrong with an allowlist that is only holders.
  const granted: Granted = existsSync("data/granted-mints.json")
    ? (JSON.parse(readFileSync("data/granted-mints.json", "utf8")) as Granted)
    : { grants: [] };

  let skippedBurn = 0;
  const entries: { address: string; tokens: number; cards: number; quantity: number }[] = [];

  for (const holder of snapshot.byHolder) {
    const address = normalise(holder.address);
    if (address === BURN_ADDRESS) {
      skippedBurn = holder.tokens.length;
      continue;
    }

    const cards = new Set<string>();
    for (const token of holder.tokens) {
      const card = mapping[String(token)];
      // A token with no card behind it would be a hole in the mapping, and a
      // hole is worth stopping for: it means the two files disagree about what
      // this collection is.
      if (card === undefined) {
        throw new Error(`Token ${token} is held but is not in the token mapping.`);
      }
      cards.add(card);
    }

    entries.push({
      address,
      tokens: holder.tokens.length,
      cards: cards.size,
      quantity: PER_CARD ? cards.size : holder.tokens.length,
    });
  }

  // The mints given by hand, added on top.
  for (const grant of granted.grants) {
    const address = normalise(grant.address);
    if (!Number.isInteger(grant.mints) || grant.mints <= 0) {
      throw new Error(`The grant for ${address} is ${grant.mints}, which is not a number of mints.`);
    }
    const already = entries.find((entry) => entry.address === address);
    if (already) already.quantity += grant.mints;
    else entries.push({ address, tokens: 0, cards: 0, quantity: grant.mints });
  }

  // NOBODY LOSES WHAT THEY WERE OWED. A root is replaced for everybody at once,
  // so a run that quietly lowered an allowance would take mints off people who
  // had not got round to claiming — and the only sign would be a transaction
  // that reverts, weeks later, for one person.
  if (existsSync(`${OUT}.json`)) {
    const before = JSON.parse(readFileSync(`${OUT}.json`, "utf8")) as
      { claims: { address: string; quantity: number }[] };
    for (const claim of before.claims) {
      const address = normalise(claim.address);
      const now = entries.find((entry) => entry.address === address);
      if (now === undefined) {
        throw new Error(`${address} was owed ${claim.quantity} and is not in the new list at all.`);
      }
      if (now.quantity < claim.quantity) {
        throw new Error(
          `${address} was owed ${claim.quantity} and would now be owed ${now.quantity}. ` +
            `An allowance may only go up.`,
        );
      }
    }
  }

  // Sorted by address so the file and the root are the same twice. An allowlist
  // whose root moves between runs is an allowlist nobody can check.
  entries.sort((a, b) => a.address.localeCompare(b.address));

  const tree = StandardMerkleTree.of(
    entries.map((e) => [e.address, String(e.quantity)]),
    ["address", "uint256"],
  );

  const claims = entries.map((entry, i) => ({
    address: checksum(entry.address),
    quantity: entry.quantity,
    tokensHeld: entry.tokens,
    distinctCards: entry.cards,
    proof: tree.getProof(i),
  }));

  // Every proof checked against the root before anything is written. The
  // library is trusted; a mistake in how this script feeds it is not.
  for (const [i, claim] of claims.entries()) {
    const ok = StandardMerkleTree.verify(
      tree.root,
      ["address", "uint256"],
      [normalise(claim.address), String(claim.quantity)],
      claim.proof,
    );
    if (!ok) throw new Error(`Proof ${i} for ${claim.address} does not verify against the root.`);
  }

  const total = entries.reduce((sum, e) => sum + e.quantity, 0);
  const out = {
    root: tree.root,
    policy: PER_CARD ? "one per distinct card held" : "one per token held",
    fromSnapshot: {
      contract: snapshot.contract,
      chainId: snapshot.chainId,
      atBlock: snapshot.atBlock,
      readAt: snapshot.readAt,
    },
    addresses: claims.length,
    mints: total,
    excluded: { burnAddress: checksum(BURN_ADDRESS), tokens: skippedBurn },
    claims,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(`${OUT}.json`, JSON.stringify(out, null, 2) + "\n");
  // The full tree, so a proof can be regenerated without redoing the snapshot.
  writeFileSync(`${OUT}-tree.json`, JSON.stringify(tree.dump(), null, 2) + "\n");

  console.log(`  policy      ${out.policy}`);
  console.log(`  addresses   ${claims.length}`);
  console.log(`  free mints  ${total}`);
  console.log(`  excluded    ${skippedBurn} tokens at the burn address`);
  console.log(`  root        ${tree.root}`);
  console.log(`\n  ${OUT}.json`);
  console.log(`  ${OUT}-tree.json`);
}

main();
