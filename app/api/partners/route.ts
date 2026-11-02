// A project applying for a set of its own. See lib/partners.ts for what an
// application is and why this route does not want a wallet.
//
// ── IT ANSWERS WITH A REFERENCE, AND IT TELLS SOMEBODY ───────────────────────
//
// A form that says "thanks" and then nothing is the Telegram Start button again:
// an instruction answered by silence, read as a feature that does not work. So
// the person gets a reference they can quote when they follow up, and the
// application is posted into DISCORD_PARTNERS the moment it lands. That webhook
// is optional — unset, the row is still stored and nothing is lost — but then
// the only way to see one is to ask D1:
//
//   npx wrangler d1 execute cards-of-cronos --remote \
//     --command "SELECT * FROM partner_applications ORDER BY at DESC"

import { post } from "@/lib/discord";
import { db, env } from "@/lib/api";
import { APPLICATIONS_PER_DAY, readApplication, TRAP } from "@/lib/partners";
import { applicationsSince, putApplication } from "@/lib/store";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

async function senderOf(request: Request): Promise<string> {
  const from = request.headers.get("cf-connecting-ip") ?? "unknown";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(from));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That did not arrive as a form.", field: null }, { status: 400 });
  }

  const reference = crypto.randomUUID().slice(0, 8).toUpperCase();

  // A bot filled in the field nobody can see. It gets the same answer a person
  // would, so trying teaches it nothing, and nothing is stored.
  const trap = (body as Record<string, unknown> | null)?.[TRAP];
  if (typeof trap === "string" && trap.trim() !== "") return Response.json({ reference });

  const read = readApplication(body);
  if (!read.ok) return Response.json({ error: read.error, field: read.field }, { status: 400 });

  const now = Date.now();
  const sender = await senderOf(request);
  if ((await applicationsSince(db(), sender, now - DAY)) >= APPLICATIONS_PER_DAY) {
    return Response.json(
      { error: "We have your application already. We will be in touch.", field: null },
      { status: 429 },
    );
  }

  await putApplication(db(), reference, read.application, sender, now);

  const { application } = read;
  const posted = await post(env().DISCORD_PARTNERS ?? "", [
    {
      title: `Partner application: ${application.project}`,
      url: application.website,
      description: application.about.slice(0, 4000),
      color: 0x9d4edd,
      fields: [
        { name: "Contact", value: application.contact, inline: true },
        { name: "Reference", value: reference, inline: true },
        ...(application.token ? [{ name: "Token", value: application.token }] : []),
        ...(application.x ? [{ name: "X", value: application.x, inline: true }] : []),
        ...(application.telegram ? [{ name: "Telegram", value: application.telegram, inline: true }] : []),
      ],
      timestamp: new Date(now).toISOString(),
    },
  ]);
  // Stored either way, so a webhook that failed loses nothing. Logged so that
  // a channel that has gone quiet can be told apart from a week with no projects.
  if (!posted.ok) console.warn(`partners: not posted to Discord — ${posted.wrong}`);

  return Response.json({ reference });
}
