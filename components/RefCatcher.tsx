"use client";

// Catches a referral code, on every page.
//
// It used to be caught by the profile alone, which is the page a referral link
// never lands on: the link went to the homepage, the profile never ran, and the
// code was thrown away by the browser on the next click. So the link worked for
// nobody — the person who followed it would not have been credited even if they
// had worked out what to do.
//
// Here in the layout, so wherever somebody lands with one, it is kept. Renders
// nothing.

import { useEffect } from "react";

import { noticeRefInUrl } from "@/lib/ref";

export function RefCatcher() {
  useEffect(() => noticeRefInUrl(), []);
  return null;
}
