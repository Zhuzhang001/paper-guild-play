export type PlayerFormState =
  | "human"
  | "foldingToPlane"
  | "plane"
  | "foldingToHuman";

export type PlayerFormModel = {
  formState: PlayerFormState;
  formProgress: number;
  /** Facing captured at the start of a fold/unfold so authored rows do not jump. */
  formFacing: number;
  intentTimer: number;
  releaseTimer: number;
  formCooldown: number;
  lastMoveX: number;
  lastMoveY: number;
};

const TURN_THRESHOLD = Math.cos((70 * Math.PI) / 180);
export const FORM_INTENT_SECONDS = 0.55;
export const FORM_FOLD_SECONDS = 0.3;
export const FORM_RELEASE_SECONDS = 0.1;
export const FORM_UNFOLD_SECONDS = 0.24;

export function createPlayerForm(): PlayerFormModel {
  return {
    formState: "human",
    formProgress: 0,
    formFacing: 0,
    intentTimer: 0,
    releaseTimer: 0,
    formCooldown: 0,
    lastMoveX: 0,
    lastMoveY: 0,
  };
}

export function forceHumanForm(form: PlayerFormModel) {
  form.formState = "foldingToHuman";
  form.intentTimer = 0;
  form.releaseTimer = 0;
  form.formCooldown = Math.max(form.formCooldown, 0.35);
}

export function finishHumanForm(form: PlayerFormModel) {
  form.formState = "human";
  form.formProgress = 0;
  form.intentTimer = 0;
  form.releaseTimer = 0;
  form.formCooldown = Math.max(form.formCooldown, 0.35);
}

export function stepPlayerForm(
  form: PlayerFormModel,
  moving: boolean,
  directionX: number,
  directionY: number,
  dt: number,
) {
  form.formCooldown = Math.max(0, form.formCooldown - dt);

  if (moving) {
    form.releaseTimer = 0;
    const moveFacing = Math.atan2(directionY, directionX);
    const hadDirection = Math.hypot(form.lastMoveX, form.lastMoveY) > 0.5;
    const dot = hadDirection
      ? directionX * form.lastMoveX + directionY * form.lastMoveY
      : 1;

    if (dot < TURN_THRESHOLD && form.formProgress > 0.04) {
      forceHumanForm(form);
    }

    form.lastMoveX = directionX;
    form.lastMoveY = directionY;

    if (form.formState === "human" && form.formCooldown <= 0) {
      form.intentTimer += dt;
      if (form.intentTimer >= FORM_INTENT_SECONDS) {
        form.formFacing = moveFacing;
        form.formState = "foldingToPlane";
        form.intentTimer = 0;
      }
    } else if (form.formState === "plane") {
      // A fully formed plane follows normal steering. Only transition frames
      // freeze their authored direction.
      form.formFacing = moveFacing;
    }
  } else {
    form.intentTimer = 0;
    form.releaseTimer += dt;
    if (
      form.releaseTimer >= FORM_RELEASE_SECONDS &&
      (form.formState === "plane" || form.formState === "foldingToPlane")
    ) {
      forceHumanForm(form);
    }
  }

  if (form.formState === "foldingToPlane") {
    form.formProgress = Math.min(1, form.formProgress + dt / FORM_FOLD_SECONDS);
    if (form.formProgress >= 1) {
      form.formState = "plane";
      form.formProgress = 1;
    }
  } else if (form.formState === "foldingToHuman") {
    form.formProgress = Math.max(0, form.formProgress - dt / FORM_UNFOLD_SECONDS);
    if (form.formProgress <= 0) {
      form.formState = "human";
      form.formProgress = 0;
      form.releaseTimer = 0;
    }
  }
}
