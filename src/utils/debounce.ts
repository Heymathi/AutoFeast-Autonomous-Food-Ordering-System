/**
 * Throttles/debounces button click events for ~1000ms.
 * Guarantees rapid consecutive clicks within 1s do not trigger duplicate handlers.
 */
export function debounceHandler<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 1000
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delayMs) {
      lastCall = now;
      fn(...args);
    }
  };
}
