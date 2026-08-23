// Asking Telegram whether somebody is in the group.
//
// getChatMember, which is free and needs no permission from the person being
// asked about — but does need the bot to be in the group itself. If it is not,
// Telegram answers with a description saying so, and that description is passed
// through rather than flattened into "could not check": the difference between
// "they are not in the group" and "the bot is not in the group" is the
// difference between a player's problem and the maker's.

const API = "https://api.telegram.org/bot";

/** The group, by its public name. The bot must be a member or an admin of it. */
// Null until the group exists. See lib/links.ts.
export const TELEGRAM_GROUP: string | null = null;

/** Telegram's own words for somebody who is in a chat. */
const IN = new Set(["creator", "administrator", "member", "restricted"]);

export type Membership =
  | { in: true }
  | { in: false; because: "left" | "kicked" | "unknown" }
  | { in: false; because: "cannot-ask"; detail: string };

export async function isInGroup(botToken: string, userId: string): Promise<Membership> {
  // No group, nothing to be a member of. Said out loud rather than answered
  // with a false: "you are not in the group" and "there is no group" are
  // different facts and the caller shows them differently.
  if (TELEGRAM_GROUP === null) {
    return { in: false, because: "cannot-ask", detail: "No Telegram group is configured yet." };
  }

  const url = new URL(`${API}${botToken}/getChatMember`);
  url.searchParams.set("chat_id", TELEGRAM_GROUP);
  url.searchParams.set("user_id", userId);

  let body: { ok?: boolean; description?: string; result?: { status?: string } };
  try {
    body = (await (await fetch(url)).json()) as typeof body;
  } catch (error) {
    return { in: false, because: "cannot-ask", detail: String(error) };
  }

  if (!body.ok) {
    // "chat not found" means the bot is not in the group. "user not found"
    // means what it says. Both come back as themselves.
    return { in: false, because: "cannot-ask", detail: body.description ?? "Telegram said no." };
  }

  const status = body.result?.status ?? "unknown";
  if (IN.has(status)) return { in: true };
  return { in: false, because: status === "left" || status === "kicked" ? status : "unknown" };
}
