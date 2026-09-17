// The five tasks, what they are worth, and what points buy.
//
// One file, because the profile page, the routes and the database all have to
// agree about what a task is called. A task named in three places is a task that
// will one day be named two ways.
//
// The shape, settled by the maker: five tasks, one point each, and for every
// wallet you bring in you earn a point for each of the five they complete. So a
// referral is worth up to five, and somebody who does three of five earns their
// referrer three. Points are spent to claim, not held as a score — at fifteen
// hundred you are choosing between two token lots and ten starter packs, and
// that choice is the whole design.

export const TASKS = ["link_x", "link_telegram", "join_telegram", "follow_x", "demo"] as const;
export type Task = (typeof TASKS)[number];

/** One point each. Written out rather than assumed, so changing it is a change. */
export const POINTS_PER_TASK = 1;

/**
 * How a task is known to be done.
 *
 * `verified` means this server checked it against something outside itself.
 * `declared` means the player said so. They are not the same fact and they are
 * not stored as the same fact, because the day somebody asks "how do you know",
 * the answer has to exist.
 */
export type Proof = "verified" | "declared";

export interface TaskSpec {
  id: Task;
  title: string;
  /** What the player has to do, in their words. */
  what: string;
  /** How this server knows, said out loud on the page. */
  how: string;
  proof: Proof;
  /** Off means it is not offered at all. See follow_x. */
  live: boolean;
  /**
   * What has to be done first, and why.
   *
   * Exactly one of the five has a real dependency: the group check asks Telegram
   * about a person, and without a linked account there is nobody to ask about.
   * The rest are independent and are deliberately left that way.
   *
   * A numbered list invites making them sequential, and it would cost more than
   * it looks. Somebody who cannot link X this minute would be locked out of the
   * other four, and the demo — the only step that is any fun, and the one most
   * likely to make a stranger care — would sit behind three account links. The
   * order is a suggestion; this is the one place it is a rule.
   */
  needs?: Task;
}

export const TASK_LIST: readonly TaskSpec[] = [
  {
    id: "link_x",
    title: "Link your X account",
    what: "Sign in with X on your profile.",
    how: "X tells us who you are, and one X account can only ever be attached to one wallet.",
    proof: "verified",
    live: true,
  },
  {
    id: "link_telegram",
    title: "Link your Telegram",
    what: "Press the Telegram button on your profile.",
    how: "Telegram signs what it sends with the bot's own key, and this server checks the signature.",
    proof: "verified",
    live: true,
  },
  {
    id: "join_telegram",
    title: "Join the Telegram group",
    what: "Join the Telegram group, then come back and press the button.",
    how: "The bot asks Telegram whether you are in the group.",
    proof: "verified",
    live: true,
    needs: "link_telegram",
  },
  {
    id: "follow_x",
    title: "Follow us on X",
    what: "Follow the project on X, then say so here.",
    // Said on the page rather than hidden, because a player who knows this is
    // checked by hand behaves differently from one who thinks nothing is.
    how: "Taken on your word for now and checked by hand afterwards — X charges per follower read, and a botted claim is removed along with the points it earned.",
    proof: "declared",
    live: true,
  },
  {
    id: "demo",
    title: "Play a demo match",
    what: "Play one match through against the market. It takes a couple of minutes.",
    how: "Your match is replayed here move by move, so it has to be a real one.",
    proof: "verified",
    live: true,
  },
];

export const TASK_BY_ID = new Map<Task, TaskSpec>(TASK_LIST.map((task) => [task.id, task]));

/** Five, at one point each — the number every other number here is built on. */
export const PERFECT_SCORE = TASK_LIST.length * POINTS_PER_TASK;

export interface Reward {
  id: string;
  cost: number;
  name: string;
  /** What it is, for somebody who has not read the mint page. */
  what: string;
  /** Can it actually be handed over yet? */
  ready: boolean;
}

/**
 * What points buy. Spent, not scored.
 *
 * Nothing here can be handed over yet. $CROCARD exists and has since the first
 * version, so what is missing is not the token but the machinery: nothing mints
 * on chain and no contract pays a reward out. The catalogue is published anyway,
 * because
 * somebody deciding whether to bring people in is entitled to know what they are
 * working towards — and a claim that took the points and delivered nothing would
 * be worse than a button that is honestly switched off.
 */
export const REWARDS: readonly Reward[] = [
  { id: "card", cost: 5, name: "One card", what: "A single card, minted to you.", ready: false },
  { id: "booster", cost: 25, name: "A booster pack", what: "Ten cards, one rare or better.", ready: false },
  { id: "starter", cost: 100, name: "A starter pack", what: "Sixty cards — enough to build from.", ready: false },
  { id: "coc100k", cost: 500, name: "100K $CROCARD", what: "Not paid out yet.", ready: false },
  { id: "coc250k", cost: 1000, name: "250K $CROCARD", what: "Not paid out yet.", ready: false },
];

export const REWARD_BY_ID = new Map<string, Reward>(REWARDS.map((reward) => [reward.id, reward]));

/**
 * How many people you have to bring in for a given number of points.
 *
 * Your own five count once and are not a referral. Written as a function because
 * it is the sentence the page has to say — "1500 points is 299 people plus
 * yourself" — and a number typed into copy goes stale the day a task is added.
 */
/**
 * The one to do next: the first that is not done and is not waiting on another.
 *
 * A suggestion rather than a gate. It is what makes a list of five feel like a
 * step at a time without any of them actually being locked.
 */
export function nextTask(done: ReadonlySet<Task>): Task | null {
  for (const task of TASK_LIST) {
    if (done.has(task.id)) continue;
    if (task.needs && !done.has(task.needs)) continue;
    return task.id;
  }
  return null;
}

/** Why this one cannot be done yet, or null. */
export function blockedBy(task: TaskSpec, done: ReadonlySet<Task>): TaskSpec | null {
  if (!task.needs || done.has(task.needs)) return null;
  return TASK_BY_ID.get(task.needs) ?? null;
}

export function peopleFor(points: number): number {
  return Math.max(0, Math.ceil((points - PERFECT_SCORE) / PERFECT_SCORE));
}
