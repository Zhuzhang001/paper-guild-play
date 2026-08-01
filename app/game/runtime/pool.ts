/** Retains matching entries without allocating a replacement array. */
export function retainInPlace<T>(
  values: T[],
  predicate: (value: T, index: number) => boolean,
): T[] {
  let write = 0;
  for (let read = 0; read < values.length; read += 1) {
    const value = values[read];
    if (!predicate(value, read)) continue;
    values[write] = value;
    write += 1;
  }
  values.length = write;
  return values;
}

/** Keeps only the newest limit entries while preserving the same array. */
export function keepNewestInPlace<T>(values: T[], limit: number): T[] {
  if (values.length <= limit) return values;
  const remove = values.length - Math.max(0, limit);
  values.copyWithin(0, remove);
  values.length -= remove;
  return values;
}

/**
 * Small bounded reuse pool for hot combat actors. The caller supplies the
 * hydrate function so optional fields, Sets and Maps can be cleared without
 * allocating a temporary object on every shot.
 */
export class ObjectPool<T, Seed = T> {
  readonly #free: T[] = [];

  constructor(
    private readonly create: () => T,
    private readonly hydrate: (value: T, seed: Seed) => void,
    private readonly capacity = 256,
    private readonly reset?: (value: T) => void,
  ) {}

  acquire(seed: Seed): T {
    const value = this.#free.pop() ?? this.create();
    this.hydrate(value, seed);
    return value;
  }

  release(value: T) {
    this.reset?.(value);
    if (this.#free.length < this.capacity) this.#free.push(value);
  }

  clear() {
    this.#free.length = 0;
  }

  get available() {
    return this.#free.length;
  }
}

/**
 * Keeps the newest entries, releases every displaced value, and preserves the
 * array identity used by render snapshots.
 */
export function keepNewestAndRecycleInPlace<T, Seed>(
  values: T[],
  limit: number,
  pool: ObjectPool<T, Seed>,
): T[] {
  if (values.length <= limit) return values;
  const remove = values.length - Math.max(0, limit);
  for (let index = 0; index < remove; index += 1) {
    pool.release(values[index]);
  }
  values.copyWithin(0, remove);
  values.length -= remove;
  return values;
}

/** Retains live entries and returns rejected entries to a reuse pool. */
export function recycleRejectedInPlace<T, Seed>(
  values: T[],
  predicate: (value: T, index: number) => boolean,
  pool: ObjectPool<T, Seed>,
): T[] {
  let write = 0;
  for (let read = 0; read < values.length; read += 1) {
    const value = values[read];
    if (predicate(value, read)) {
      values[write] = value;
      write += 1;
    } else {
      pool.release(value);
    }
  }
  values.length = write;
  return values;
}
