// Compile the contracts, and say so out loud when they do not.
//
//   npx tsx scripts/compile.ts [contracts/Something.sol]
//
// There is no Hardhat and no Foundry here. This is solc and forty lines of
// plumbing, which is enough to answer the one question that matters at this
// stage: does the thing compile, and does the compiler have anything to say
// about it. It is NOT a test runner, and contracts/CardsOfCronosSetOne.sol has a
// note at the bottom about what that means.
//
// Warnings are printed and do not fail the run; errors fail it. The distinction
// is solc's own.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import solc from "solc";

const TARGET = process.argv[2] ?? "contracts/CardsOfCronosSetOne.sol";

interface SolcError {
  severity: "error" | "warning" | "info";
  formattedMessage?: string;
  message?: string;
}

/**
 * Imports, resolved off disk.
 *
 * solc has no filesystem. It asks for every path it meets and this hands the
 * bytes back — which is how `@openzeppelin/contracts/...` reaches it from
 * node_modules without a build tool in between.
 */
function findImport(where: string): { contents: string } | { error: string } {
  const candidates = [where, path.join("node_modules", where), path.join("contracts", where)];
  for (const candidate of candidates) {
    try {
      return { contents: readFileSync(candidate, "utf8") };
    } catch {
      // next
    }
  }
  return { error: `Could not find ${where}` };
}

function main(): void {
  const source = readFileSync(TARGET, "utf8");
  const input = {
    language: "Solidity",
    sources: { [TARGET]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImport }),
  ) as {
    errors?: SolcError[];
    contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  };

  const problems = output.errors ?? [];
  const errors = problems.filter((p) => p.severity === "error");
  for (const problem of problems) {
    console.log(problem.formattedMessage ?? problem.message ?? JSON.stringify(problem));
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s). Nothing written.`);
    process.exit(1);
  }

  const compiled = output.contracts?.[TARGET] ?? {};
  mkdirSync("contracts/out", { recursive: true });

  for (const [name, artefact] of Object.entries(compiled)) {
    const bytes = artefact.evm.bytecode.object.length / 2;
    writeFileSync(
      path.join("contracts/out", `${name}.abi.json`),
      JSON.stringify(artefact.abi, null, 2) + "\n",
    );
    // 24576 bytes is the deploy limit every EVM chain inherited from EIP-170.
    // Finding out about it from a failed deploy is a bad afternoon.
    const room = 24_576 - bytes;
    console.log(
      `  ${name.padEnd(24)} ${String(bytes).padStart(6)} bytes` +
        (room < 0 ? `  OVER THE 24576 LIMIT by ${-room}` : `  (${room} to spare)`),
    );
  }

  console.log(`\n  solc ${solc.version()}`);
  console.log(`  ABIs in contracts/out/`);
}

main();
