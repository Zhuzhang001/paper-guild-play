export const PLAYER_HIT_RADIUS = 18;

export type EnemyActionPhase =
  | "telegraph"
  | "active"
  | "impact"
  | "recovery";

export type CloseMovementFallback =
  | { kind: "stomp" }
  | { kind: "sideHop"; distance: number };

/**
 * Authored movement targeting is intentionally explicit. A landing attack,
 * a crossing dash and a fly-by do not share the same stopping rules.
 */
export type MovementTargetSpec =
  | {
      kind: "landShort";
      maxTravel: number;
      minTravel: number;
      clearance: number;
      closeFallback: CloseMovementFallback;
    }
  | {
      kind: "crossTarget";
      maxTravel: number;
      overshoot: number;
      clearance: number;
      sweptDamage: true;
    }
  | {
      kind: "flyby";
      exitMargin: number;
      arcHeight: number;
      sweptDamage: true;
    };

export type HostileTelegraph = {
  kind: "landing" | "swept";
  locked: boolean;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  radius: number;
  artKey: string;
  movementKind: MovementTargetSpec["kind"] | "stationary";
  arcHeight?: number;
};
