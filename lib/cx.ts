/** Joins class names. Small enough not to pull in a dependency for it. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
