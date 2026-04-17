/**
 * Semaphore-based concurrency limiter for routes that interleave
 * DB connections with slow external I/O (email sends, Stripe calls).
 *
 * Prevents connection pool exhaustion by limiting how many of these
 * slow operations run concurrently.
 */

class Semaphore {
  private queue: (() => void)[] = [];
  private current = 0;

  constructor(private max: number) {}

  async acquire(): Promise<() => void> {
    if (this.current < this.max) {
      this.current++;
      return () => {
        this.current--;
        this.queue.shift()?.();
      };
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve(() => {
          this.current--;
          this.queue.shift()?.();
        });
      });
    });
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.current;
  }
}

/** Limits bulk operations (email sends, refund batches) to 2 concurrent executions. */
export const bulkOpSemaphore = new Semaphore(2);
