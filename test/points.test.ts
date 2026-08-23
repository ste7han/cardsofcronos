// The five tasks and what they are worth.
//
// The arithmetic on this page is the kind somebody checks against the copy, so
// it is checked here first: five tasks at a point each, a referral worth up to
// five, and 1500 points meaning 299 people plus your own five. A number typed
// into a sentence goes stale the day a task is added; a number computed from the
// list cannot.

import { describe, expect, it } from "vitest";

import {
  PERFECT_SCORE,
  POINTS_PER_TASK,
  REWARDS,
  REWARD_BY_ID,
  TASKS,
  TASK_BY_ID,
  TASK_LIST,
  blockedBy,
  nextTask,
  peopleFor,
  type Task,
} from "@/lib/points";

describe("the five", () => {
  it("is five, and the list and the ids agree", () => {
    expect(TASKS).toHaveLength(5);
    expect(TASK_LIST).toHaveLength(TASKS.length);
    // Two lists of the same thing is one list too many, so at least make them
    // fail together.
    for (const id of TASKS) expect(TASK_BY_ID.get(id)?.id).toBe(id);
  });

  it("makes a perfect score of five", () => {
    expect(PERFECT_SCORE).toBe(TASKS.length * POINTS_PER_TASK);
    expect(PERFECT_SCORE).toBe(5);
  });

  it("says of every task how it is known, and does not leave it blank", () => {
    // A task whose page copy does not say whether anything checked it is a task
    // people assume nothing checks.
    for (const task of TASK_LIST) {
      expect(task.how.length).toBeGreaterThan(20);
      expect(["verified", "declared"]).toContain(task.proof);
    }
  });

  it("has exactly one it takes on trust, and says so", () => {
    // Following on X. X charges per follower read, so it cannot be checked
    // automatically — and the page has to admit that rather than imply a check.
    const declared = TASK_LIST.filter((task) => task.proof === "declared");
    expect(declared.map((task) => task.id)).toEqual(["follow_x"]);
    expect(declared[0]!.how).toMatch(/by hand|word/i);
  });
});

describe("what points buy", () => {
  it("is the maker's ladder, in order and with no gaps", () => {
    expect(REWARDS.map((reward) => reward.cost)).toEqual([5, 25, 100, 500, 1000]);
    for (const reward of REWARDS) expect(REWARD_BY_ID.get(reward.id)).toBe(reward);
  });

  it("cannot hand any of it over yet, and does not claim it can", () => {
    // There is no token and no single-card mint. A claim that took the points
    // and delivered nothing would be worse than a switched-off button.
    expect(REWARDS.every((reward) => !reward.ready)).toBe(true);
  });

  it("counts people the way the page says it does", () => {
    // Your own five are not a referral. 299 x 5 = 1495, plus your own 5 = 1500.
    expect(peopleFor(1500)).toBe(299);
    expect(peopleFor(PERFECT_SCORE)).toBe(0);
    expect(peopleFor(25)).toBe(4);
    expect(peopleFor(1000)).toBe(199);
    // And nothing below your own five asks for anybody.
    expect(peopleFor(1)).toBe(0);
  });
});

describe("the order", () => {
  it("has exactly one real dependency", () => {
    // A numbered list invites making all of them sequential, and that would cost
    // more than it looks: somebody who cannot link X this minute would be locked
    // out of the other four, and the demo — the only step that is any fun —
    // would sit behind three account links.
    const withNeeds = TASK_LIST.filter((task) => task.needs);
    expect(withNeeds.map((task) => task.id)).toEqual(["join_telegram"]);
    expect(withNeeds[0]!.needs).toBe("link_telegram");
  });

  it("points at the first thing that can actually be done", () => {
    expect(nextTask(new Set())).toBe("link_x");
    // Skips the group check while there is nobody to ask Telegram about, and
    // comes back to it once there is.
    expect(nextTask(new Set(["link_x"]))).toBe("link_telegram");
    expect(nextTask(new Set(["link_x", "link_telegram"]))).toBe("join_telegram");
  });

  it("does not point at a blocked step, but does not lose it either", () => {
    // Done out of order: X and the demo, no Telegram. The next one offered is
    // linking Telegram, which is both the next in the list and the thing the
    // group check is waiting on — and the group check itself is skipped rather
    // than offered.
    const done = new Set<Task>(["link_x", "demo"]);
    expect(nextTask(done)).toBe("link_telegram");
    expect(blockedBy(TASK_BY_ID.get("join_telegram")!, done)?.id).toBe("link_telegram");

    // Only once every unblocked one is gone does the blocked one come up, and
    // by then it is not blocked.
    const nearly = new Set<Task>(["link_x", "demo", "follow_x"]);
    expect(nextTask(nearly)).toBe("link_telegram");
    expect(nextTask(new Set([...nearly, "link_telegram"]))).toBe("join_telegram");
  });

  it("says nothing is next once all five are done", () => {
    expect(nextTask(new Set(TASKS))).toBeNull();
  });

  it("blocks nothing else, whatever order they arrive in", () => {
    // Every task except the group check is reachable from an empty slate.
    for (const task of TASK_LIST) {
      if (task.id === "join_telegram") continue;
      expect(blockedBy(task, new Set())).toBeNull();
    }
  });
});
