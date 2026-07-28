export type PlayerFormState =
  | "human"
  | "foldingToPlane"
  | "plane"
  | "foldingToHuman";

export type PlayerFormModel = {
  formState: PlayerFormState;
  formProgress: number;
  intentTimer: number;
  releaseTimer: number;
  formCooldown: number;
  lastMoveX: number;
  lastMoveY: number;
};

const TURN_THRESHOLD = Math.cos((70 * Math.PI) / 180);

export function createPlayerForm(): PlayerFormModel {
  return {
    formState: "human",
    formProgress: 0,
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
      if (form.intentTimer >= 0.55) {
        form.formState = "foldingToPlane";
        form.intentTimer = 0;
      }
    }
  } else {
    form.intentTimer = 0;
    form.releaseTimer += dt;
    if (
      form.releaseTimer >= 0.12 &&
      (form.formState === "plane" || form.formState === "foldingToPlane")
    ) {
      forceHumanForm(form);
    }
  }

  if (form.formState === "foldingToPlane") {
    form.formProgress = Math.min(1, form.formProgress + dt / 0.22);
    if (form.formProgress >= 1) {
      form.formState = "plane";
      form.formProgress = 1;
    }
  } else if (form.formState === "foldingToHuman") {
    form.formProgress = Math.max(0, form.formProgress - dt / 0.2);
    if (form.formProgress <= 0) {
      form.formState = "human";
      form.formProgress = 0;
      form.releaseTimer = 0;
    }
  }
}
