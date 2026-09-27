// Runs the daily job and prints exactly what it did, or why it did not.
//
//   npm run daily-why           report only, does not run the job
//   npm run daily-why -- --run  run it for real
//
// The job returns 200 with everything that happened, including the sentence it
// writes when it declines. That sentence is the only place the reason exists:
// the cron swallows the body, so a run that refuses for a fortnight looks
// exactly like a run that worked. This is how to read it.
//
// CRON_SECRET is read from the environment, or out of .env.local when it is not
// there — one variable by name, never printed. Never from an argument: argv is
// visible to anybody who can run ps.

import { existsSync, readFileSync } from "node:fs";

const SITE = process.env.SITE ?? "https://cardsofcronos.com";

function fromEnvFile(name: string): string | undefined {
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at === -1 || line.trimStart().startsWith("#")) continue;
    if (line.slice(0, at).trim() !== name) continue;
    return line.slice(at + 1).trim().replace(/^["']|["']$/g, "") || undefined;
  }
  return undefined;
}

async function main(): Promise<void> {
  const secret = process.env.CRON_SECRET ?? fromEnvFile("CRON_SECRET");
  if (!secret) {
    throw new Error("No CRON_SECRET. Put it in the environment or in .env.local.");
  }

  const run = process.argv.includes("--run");
  if (!run) {
    console.log("\n  Asking with soft:true — it will decline if it ran in the last six hours.");
    console.log("  Add --run to make it work for real.\n");
  }

  const answer = await fetch(`${SITE}/api/cron/daily`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify(run ? {} : { soft: true }),
  });

  const body = (await answer.json()) as Record<string, unknown>;
  console.log(`  HTTP ${answer.status}\n`);
  console.log(JSON.stringify(body, null, 2));
  console.log("");
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
