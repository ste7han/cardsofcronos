// solc ships no types.
//
// Declared here rather than pulled from DefinitelyTyped because scripts/compile.ts
// uses exactly two things from it, and both are described below. A dependency
// added for two signatures is a dependency somebody has to keep up to date.

declare module "solc" {
  interface ImportResolver {
    import(path: string): { contents: string } | { error: string };
  }

  /** Takes a standard-json input and returns a standard-json output, both as strings. */
  export function compile(input: string, callbacks?: ImportResolver): string;

  /** The compiler's own version string, e.g. "0.8.26+commit.8a97fa7a…". */
  export function version(): string;

  const solc: { compile: typeof compile; version: typeof version };
  export default solc;
}
