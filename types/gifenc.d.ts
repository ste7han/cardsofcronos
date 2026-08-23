// gifenc ships no types. Only the parts this project calls are declared, rather
// than a guessed-at shape for the whole library — a wrong declaration is worse
// than none, because it type-checks.
declare module "gifenc" {
  export function quantize(data: Uint8ClampedArray, maxColors: number): number[][];
  export function applyPalette(data: Uint8ClampedArray, palette: number[][]): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: {
        /** Required on the first frame, where it becomes the global colour table. */
        palette?: number[][];
        delay: number;
        /** 1 = leave the frame in place, which is what makes a delta frame work. */
        dispose?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
