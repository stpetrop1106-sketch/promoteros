/**
 * P39 — bounded concurrency and a request pacer.
 *
 * Resend's default limit is 2 requests per second per team, shared by everything that sends: the
 * cron, a welcome email fired from a coordinator's save, an owner's "send now". The pacer spaces
 * provider requests inside one run; HTTP 429 from the other senders is handled by the adapter's
 * retry. Pure: the clock and `sleep` are injectable, so the spacing is tested without waiting.
 */

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

/** Resend allows 2/s; 550 ms apart leaves margin for clock skew between us and them. */
export const RESEND_MIN_INTERVAL_MS = 550;

/**
 * Returns a function that resolves no sooner than `minIntervalMs` after the previous caller's
 * slot. Slots are reserved synchronously, so concurrent callers queue rather than race.
 */
export function createPacer(minIntervalMs: number, clock: Clock = realClock): () => Promise<void> {
  let nextSlot = 0;
  return async () => {
    const now = clock.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + minIntervalMs;
    const wait = slot - now;
    if (wait > 0) await clock.sleep(wait);
  };
}

export type BoundedResult<R> = { results: R[]; notStarted: number };

/**
 * Run `worker` over `items` with at most `concurrency` in flight. A worker that throws yields
 * `onError(err)` for that item and the rest carry on. Once `deadline` (epoch ms) has passed no new
 * item is started — the run ends inside its function's time budget and reports what it left.
 */
export async function runBounded<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  options: {
    concurrency: number;
    onError: (err: unknown, item: T) => R;
    deadline?: number;
    now?: () => number;
  },
): Promise<BoundedResult<R>> {
  const now = options.now ?? (() => Date.now());
  const results: R[] = [];
  let cursor = 0;
  let notStarted = 0;

  async function lane() {
    while (true) {
      if (cursor >= items.length) return;
      if (options.deadline !== undefined && now() >= options.deadline) {
        notStarted += items.length - cursor;
        cursor = items.length;
        return;
      }
      const item = items[cursor++] as T;
      try {
        results.push(await worker(item));
      } catch (err) {
        results.push(options.onError(err, item));
      }
    }
  }

  const lanes = Math.max(1, Math.min(options.concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, () => lane()));
  return { results, notStarted };
}
