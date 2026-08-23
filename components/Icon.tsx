// Small icons for the stat lines on a card. Inline SVG rather than an icon
// library: there are four of them and they need to take the colour of the text
// next to them.

import React from "react";

type Name = "mc" | "pump" | "holders" | "effect" | "aura";

const PATHS: Record<Name, React.ReactNode> = {
  // Stack of coins
  mc: (
    <>
      <ellipse cx="8" cy="4.6" rx="5.4" ry="2.3" />
      <path d="M2.6 4.6v3.2c0 1.27 2.42 2.3 5.4 2.3s5.4-1.03 5.4-2.3V4.6" />
      <path d="M2.6 7.8V11c0 1.27 2.42 2.3 5.4 2.3s5.4-1.03 5.4-2.3V7.8" />
    </>
  ),
  // Arrow rising out of a base
  pump: (
    <>
      <path d="M8 13.2V3.4" />
      <path d="M3.9 7.5 8 3.2l4.1 4.3" />
    </>
  ),
  // Two figures
  holders: (
    <>
      <circle cx="6" cy="5.6" r="2.2" />
      <path d="M2.4 13c0-2.2 1.6-3.7 3.6-3.7s3.6 1.5 3.6 3.7" />
      <path d="M10.6 4.1a2.2 2.2 0 0 1 0 4.2" />
      <path d="M11.4 9.6c1.4.4 2.4 1.7 2.4 3.4" />
    </>
  ),
  // Lightning
  effect: <path d="M8.9 2.2 4.2 9h3.3l-.9 4.8L11.8 7H8.4z" />,
  // Star
  aura: <path d="m8 2.4 1.7 3.7 4 .5-3 2.8.8 4L8 11.4l-3.5 2 .8-4-3-2.8 4-.5z" />,
};

export function Icon({ name, className }: { name: Name; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
