/**
 * Playback timing policies shared by Cinema and its regression tests.
 * This module deliberately has no DOM dependency: it can be tested in Node.
 */
export function getCinemaStartupBufferTarget(streamDuration: number): number {
  // Transcoded clips can be shorter than 12s (especially when resuming near
  // the end). Never wait for more buffer than a finite stream can provide.
  if (Number.isFinite(streamDuration) && streamDuration > 0) {
    return Math.min(12, Math.max(0.1, streamDuration - 0.25));
  }
  return 12;
}

export function createCinemaStallRecovery({
  isStalled,
  recover,
  exhausted,
  delayMs = 12_000,
  maxAttempts = 2,
}: {
  isStalled: () => boolean;
  recover: (attempt: number, maxAttempts: number) => void;
  exhausted: () => void;
  delayMs?: number;
  maxAttempts?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  let disposed = false;
  let attempts = 0;

  const schedule = () => {
    if (!active || disposed || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!active || disposed) return;
      if (!isStalled()) {
        active = false;
        return;
      }
      if (attempts >= maxAttempts) {
        active = false;
        exhausted();
        return;
      }
      attempts += 1;
      recover(attempts, maxAttempts);
      // A single stalled episode needs another check even if the browser
      // never emits another 'waiting' event after startLoad().
      schedule();
    }, delayMs);
  };

  return {
    begin() {
      if (active || disposed) return;
      active = true;
      schedule();
    },
    end(resetBudget = false) {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (resetBudget) attempts = 0;
    },
    dispose() {
      disposed = true;
      active = false;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
