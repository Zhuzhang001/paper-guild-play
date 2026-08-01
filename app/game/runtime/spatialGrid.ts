export type SpatialActor = {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
};

/**
 * A compact broad-phase shared by targeting, overlap, fields and summons.
 * Buckets are rebuilt once per fixed simulation step; callers then filter the
 * small candidate set with their exact collision rule.
 */
export class SpatialGrid<T extends SpatialActor> {
  readonly cellSize: number;
  private readonly buckets = new Map<number, T[]>();
  private readonly activeBuckets: T[][] = [];
  private readonly seenAtQuery = new Map<number, number>();
  private querySerial = 0;

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  rebuild(actors: readonly T[]) {
    for (const bucket of this.activeBuckets) bucket.length = 0;
    this.activeBuckets.length = 0;
    this.buckets.clear();
    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      const minX = Math.floor((actor.x - actor.radius) / this.cellSize);
      const maxX = Math.floor((actor.x + actor.radius) / this.cellSize);
      const minY = Math.floor((actor.y - actor.radius) / this.cellSize);
      const maxY = Math.floor((actor.y + actor.radius) / this.cellSize);
      for (let cy = minY; cy <= maxY; cy += 1) {
        for (let cx = minX; cx <= maxX; cx += 1) {
          const key = SpatialGrid.key(cx, cy);
          let bucket = this.buckets.get(key);
          if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
            this.activeBuckets.push(bucket);
          }
          bucket.push(actor);
        }
      }
    }
  }

  query(x: number, y: number, radius: number, output: T[] = []): T[] {
    output.length = 0;
    this.querySerial += 1;
    if (this.querySerial >= Number.MAX_SAFE_INTEGER) {
      this.querySerial = 1;
      this.seenAtQuery.clear();
    }
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const bucket = this.buckets.get(SpatialGrid.key(cx, cy));
        if (!bucket) continue;
        for (const actor of bucket) {
          if (this.seenAtQuery.get(actor.id) === this.querySerial) continue;
          this.seenAtQuery.set(actor.id, this.querySerial);
          output.push(actor);
        }
      }
    }
    return output;
  }

  nearest(
    x: number,
    y: number,
    maxRadius: number,
    predicate?: (actor: T) => boolean,
  ): T | undefined {
    let nearestActor: T | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const actor of this.query(x, y, maxRadius)) {
      if (predicate && !predicate(actor)) continue;
      const dx = actor.x - x;
      const dy = actor.y - y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestActor = actor;
      }
    }
    return nearestActor;
  }

  private static key(x: number, y: number) {
    // World actors are kept near the 1280×720 play area; an offset keeps
    // transient off-screen spawn cells positive without allocating strings.
    return (y + 64) * 256 + (x + 64);
  }
}
