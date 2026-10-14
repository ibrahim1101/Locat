/** Playback timing policies shared by Cinema and its Node regression tests. */
export function getCinemaStartupBufferTarget(streamDuration: number): number {
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
  const baseDelay = Number.isFinite(delayMs) ? Math.max(1, delayMs) : 12_000;
  const retryLimit = Number.isFinite(maxAttempts) ? Math.max(0, Math.floor(maxAttempts)) : 2;

  const schedule = () => {
    if (!active || disposed || timer !== undefined) return;
    const delay = Math.min(baseDelay * 2 ** Math.min(attempts, 10), 60_000);
    timer = setTimeout(() => {
      timer = undefined;
      if (!active || disposed) return;
      if (!isStalled()) {
        active = false;
        return;
      }
      if (attempts >= retryLimit) {
        active = false;
        exhausted();
        return;
      }
      attempts += 1;
      recover(attempts, retryLimit);
      schedule();
    }, delay);
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
