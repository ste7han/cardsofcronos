/**
 * Whether this is a finger or a mouse.
 *
 * Asked of the pointer and never of the width. A narrow window on a laptop is
 * still a mouse, and a tablet in landscape is still a finger — width has never
 * answered this question and every layout that used it got one of the two wrong.
 *
 * Here rather than inside one component because two of them need the same
 * answer: the popover on the board, and the magnified card in your hand. Two
 * copies of a media query is two chances for them to disagree about what kind of
 * device somebody is holding.
 */
export function usesTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}
