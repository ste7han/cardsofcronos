// What has to survive the trip to X and back.
//
// Three things: the wallet proof, the state, and the PKCE verifier. They go in a
// cookie because the player leaves the site entirely in between, and there is
// nowhere else to put them that survives that.
//
// The cookie is not signed and does not need to be, which is worth explaining
// because it looks like an omission. A signed cookie protects a payload that
// would otherwise be editable; this payload is a wallet proof, and editing it to
// another address means producing a signature for that address, which means
// holding its private key. The tamper-proofing is the thing being carried.
//
// The verifier is the other half of PKCE and is secret, so: httpOnly, so no
// script can read it; Secure wherever there is TLS; and SameSite=Lax, which is
// the loosest setting that still arrives on the way back from X — Strict would
// drop it on that redirect and the flow would fail with no useful error.

export const LINK_COOKIE = "tcg.link";

/** Ten minutes. Long enough to read a consent screen, short enough to be junk. */
export const PENDING_LIFE = 600;

export interface Pending {
  proof: unknown;
  state: string;
  verifier: string;
}

/** base64 rather than raw JSON: a cookie value has opinions about punctuation. */
export function sealPending(name: string, pending: Pending, secure: boolean): string {
  const value = btoa(JSON.stringify(pending));
  return [
    `${name}=${value}`,
    "Path=/api/link",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${PENDING_LIFE}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearPending(name: string, secure: boolean): string {
  return [`${name}=`, "Path=/api/link", "HttpOnly", "SameSite=Lax", secure ? "Secure" : "", "Max-Age=0"]
    .filter(Boolean)
    .join("; ");
}

export function readPending(header: string | null, name: string): Pending | null {
  if (!header) return null;

  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;

  const value = match.slice(name.length + 1);
  if (!value) return null;

  try {
    const parsed = JSON.parse(atob(value)) as Partial<Pending>;
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string") return null;
    return { proof: parsed.proof, state: parsed.state, verifier: parsed.verifier };
  } catch {
    return null;
  }
}
