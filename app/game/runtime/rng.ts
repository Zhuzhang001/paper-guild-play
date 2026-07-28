export type RngState = number;

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRngState(seed: number | string): RngState {
  const resolved = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return resolved || 0x6d2b79f5;
}

export function nextRandom(state: RngState): { value: number; state: RngState } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
    state: nextState,
  };
}

export function randomInt(
  state: RngState,
  maxExclusive: number,
): { value: number; state: RngState } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive integer");
  }
  const next = nextRandom(state);
  return { value: Math.floor(next.value * maxExclusive), state: next.state };
}

export function randomRange(
  state: RngState,
  minInclusive: number,
  maxExclusive: number,
): { value: number; state: RngState } {
  if (!(maxExclusive > minInclusive)) {
    throw new RangeError("maxExclusive must be greater than minInclusive");
  }
  const next = nextRandom(state);
  return {
    value: minInclusive + next.value * (maxExclusive - minInclusive),
    state: next.state,
  };
}

export function shuffleDeterministic<T>(
  values: readonly T[],
  initialState: RngState,
): { values: T[]; state: RngState } {
  const shuffled = [...values];
  let state = initialState;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const result = randomInt(state, index + 1);
    state = result.state;
    [shuffled[index], shuffled[result.value]] = [shuffled[result.value], shuffled[index]];
  }
  return { values: shuffled, state };
}

export function sampleDeterministic<T>(
  values: readonly T[],
  count: number,
  initialState: RngState,
): { values: T[]; state: RngState } {
  if (count < 0) {
    throw new RangeError("count must not be negative");
  }
  const result = shuffleDeterministic(values, initialState);
  return { values: result.values.slice(0, count), state: result.state };
}

export class DeterministicRng {
  private currentState: RngState;

  constructor(seed: number | string) {
    this.currentState = createRngState(seed);
  }

  get state(): RngState {
    return this.currentState;
  }

  next(): number {
    const result = nextRandom(this.currentState);
    this.currentState = result.state;
    return result.value;
  }

  int(maxExclusive: number): number {
    const result = randomInt(this.currentState, maxExclusive);
    this.currentState = result.state;
    return result.value;
  }

  range(minInclusive: number, maxExclusive: number): number {
    const result = randomRange(this.currentState, minInclusive, maxExclusive);
    this.currentState = result.state;
    return result.value;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = shuffleDeterministic(values, this.currentState);
    this.currentState = result.state;
    return result.values;
  }

  fork(label: string): DeterministicRng {
    return new DeterministicRng(`${this.currentState}:${label}`);
  }
}
