// Retries a flaky async call a few times with a short delay before giving up.
// Meant for transient hiccups (a cold-starting edge function, a dropped
// packet) — not a substitute for real error handling, so callers should still
// catch and report a final failure after retries are exhausted.
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 800,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return withRetry(fn, retries - 1, delayMs);
  }
}
