export type WeaponId =
  | "sword"
  | "fan"
  | "umbrella"
  | "scissors"
  | "abacus"
  | "crossbow"
  | "pipa"
  | "inkline"
  | "lantern"
  | "thunderSeal";

export type WeaponRouteKey = "a" | "b" | "c";
export type MasteryKey = "focus" | "chain";
export type WeaponLevel = 1 | 2 | 3 | 4 | 5;
export type WeaponRouteId = `${WeaponId}:${WeaponRouteKey}`;
export type MasteryId = `${WeaponRouteId}:${MasteryKey}`;
export type FusionId =
  | "mistCanopy"
  | "thunderCanopy"
  | "inkGaleRule"
  | "starPiercer"
  | "lanternSword"
  | "swordheartPipa"
  | "heavenlyLedger"
  | "worldTailor"
  | "raincutCanopy"
  | "jadePearlCadence"
  | "linkedLedgerCase"
  | "lanternBallista"
  | "inklineRepeater"
  | "thunderPipa"
  | "myriadLanternCanopy"
  | "galeBamboo"
  | "hiddenSwordCanopy"
  | "twinTailorBlades"
  | "inkRuleSword"
  | "windRepeater"
  | "rainStringCanopy"
  | "windStringPass"
  | "inkRainBoundary"
  | "stringScissor"
  | "shadowScissor"
  | "pearlInkLine"
  | "countedLantern"
  | "pearlThunder"
  | "thunderBoltRoad"
  | "inkScore";

export type EffectTag =
  | "blade"
  | "wind"
  | "rain"
  | "guard"
  | "craft"
  | "ledger"
  | "mechanism"
  | "music"
  | "shadow"
  | "fire"
  | "lightning"
  | "frost"
  | "spirit"
  | "mark"
  | "execute";

export type EffectTrigger =
  | "onAttack"
  | "onHit"
  | "onKill"
  | "onMarkedHit"
  | "onDamageTaken"
  | "periodic"
  | "onWeavePass"
  | "onTerminal";

type EffectBase = {
  id: string;
  trigger: EffectTrigger;
  tags: readonly EffectTag[];
  chance?: number;
  internalCooldown?: number;
  visualKey?: string;
  audioKey?: string;
};

export type ProjectileEffect = EffectBase & {
  kind: "projectile";
  pattern: "single" | "fan" | "radial" | "burst";
  damage: number;
  cooldown: number;
  count: number;
  speed: number;
  lifetime: number;
  radius: number;
  pierce: number;
  spreadDegrees?: number;
  homing?: number;
  markSeconds?: number;
  singleTargetHitCooldown?: number;
};

export type OrbitEffect = EffectBase & {
  kind: "orbit";
  damage: number;
  count: number;
  radius: number;
  angularSpeed: number;
  hitCooldown: number;
  blockStrength?: number;
};

export type ChainEffect = EffectBase & {
  kind: "chain";
  damage: number;
  jumps: number;
  range: number;
  falloff: number;
  preferMarked?: boolean;
};

export type ZoneEffect = EffectBase & {
  kind: "zone";
  damagePerSecond: number;
  radius: number;
  duration: number;
  tickRate: number;
  followsOwner?: boolean;
  slow?: number;
};

export type SummonEffect = EffectBase & {
  kind: "summon";
  summonKey: string;
  count: number;
  duration: number;
  attackDamage: number;
  attackCooldown: number;
  moveSpeed: number;
};

export type DelayedEffect = EffectBase & {
  kind: "delayed";
  damage: number;
  delay: number;
  radius: number;
  repeats?: number;
};

export type MarkEffect = EffectBase & {
  kind: "mark";
  duration: number;
  damageTakenMultiplier: number;
  priority: "nearest" | "highestHp" | "lowestHp";
  maxStacks?: number;
};

export type ExecuteEffect = EffectBase & {
  kind: "execute";
  threshold: number;
  bossThreshold: number;
  bonusDamage: number;
};

export type AccumulatorEffect = EffectBase & {
  kind: "accumulator";
  counter: string;
  required: number;
  resetOnProc: boolean;
  procEffects: readonly EffectSpec[];
};

export type CopyEffect = EffectBase & {
  kind: "copy";
  source: "primaryWeapon" | "previousWeaveNode" | "markedHit";
  damageMultiplier: number;
  maxCopies: number;
};

export type BeamEffect = EffectBase & {
  kind: "beam";
  damage: number;
  length: number;
  width: number;
  duration: number;
  pierce: number;
  sweepDegrees?: number;
};

export type LightningEffect = EffectBase & {
  kind: "lightning";
  damage: number;
  strikes: number;
  radius: number;
  delay: number;
  chainRange?: number;
};

export type EffectSpec =
  | ProjectileEffect
  | OrbitEffect
  | ChainEffect
  | ZoneEffect
  | SummonEffect
  | DelayedEffect
  | MarkEffect
  | ExecuteEffect
  | AccumulatorEffect
  | CopyEffect
  | BeamEffect
  | LightningEffect;

export type EffectPatchTarget = "core" | "route";

/**
 * Upgrade data is authored as complete readable effects, then normalized into
 * patches. A replacement upgrades one logical emitter; append is reserved for
 * a genuinely new trigger or side mechanism.
 */
export type EffectPatch = {
  id: string;
  target: EffectPatchTarget;
  mode: "replace" | "append";
  matchKind?: EffectSpec["kind"];
  matchIndex?: number;
  effect: EffectSpec;
};

export type ResolvedWeaponKit = {
  core: readonly EffectSpec[];
  route: readonly EffectSpec[];
  mastery: readonly EffectSpec[];
  effects: readonly EffectSpec[];
};

/** Public v4 name; `ResolvedWeaponKit` remains as a source-compatible alias. */
export type ResolvedWeapon = ResolvedWeaponKit;

export type MasteryDefinition = {
  id: MasteryId;
  key: MasteryKey;
  name: string;
  description: string;
  effects: readonly EffectSpec[];
  artKey: string;
};

export type WeaponRoute = {
  id: WeaponRouteId;
  key: WeaponRouteKey;
  name: string;
  description: string;
  tier3Effects: readonly EffectSpec[];
  tier4Effects: readonly EffectSpec[];
  masteries: readonly [MasteryDefinition, MasteryDefinition];
  artKeys: {
    tier3: string;
    tier4: string;
  };
};

export type WeaponDefinition = {
  id: WeaponId;
  name: string;
  shortName: string;
  description: string;
  color: string;
  tags: readonly EffectTag[];
  baseEffects: readonly EffectSpec[];
  refinedEffects: readonly EffectSpec[];
  routes: readonly [WeaponRoute, WeaponRoute, WeaponRoute];
  artKeys: {
    icon: string;
    tier1: string;
    tier2: string;
  };
  audioKey: string;
};

export type WeaponState = {
  id: WeaponId;
  level: WeaponLevel;
  routeId?: WeaponRouteId;
  masteryId?: MasteryId;
};

export type RunModifierId =
  | "paperWard"
  | "keenEdge"
  | "gatheringWind"
  | "weaponSoul";

export type CombatBuild = {
  weapons: readonly WeaponState[];
  modifiers: Readonly<Partial<Record<RunModifierId, number>>>;
  synergyCapacity: number;
};

export type UpgradeOption =
  | {
      id: string;
      kind: "acquire";
      weaponId: WeaponId;
      title: string;
      description: string;
      artKey: string;
    }
  | {
      id: string;
      kind: "refine" | "routeEnhancement";
      weaponId: WeaponId;
      title: string;
      description: string;
      artKey: string;
    }
  | {
      id: string;
      kind: "route";
      weaponId: WeaponId;
      routeId: WeaponRouteId;
      title: string;
      description: string;
      artKey: string;
    }
  | {
      id: string;
      kind: "mastery";
      weaponId: WeaponId;
      routeId: WeaponRouteId;
      masteryId: MasteryId;
      title: string;
      description: string;
      artKey: string;
    }
  | {
      id: string;
      kind: "utility";
      modifierId: RunModifierId;
      title: string;
      description: string;
      artKey: string;
    };

export type SynergyRouteVariant = {
  id: string;
  when: Partial<Record<WeaponId, WeaponRouteKey>>;
  nameSuffix: string;
  description: string;
  effects: readonly EffectSpec[];
};

export type CombatEventKind =
  | "weaponAttack"
  | "weaponHit"
  | "weaponKill"
  | "guardBlock";

export type SynergyEventRule = {
  id: string;
  event: CombatEventKind;
  sourceWeapon?: WeaponId;
  every?: number;
  effects: readonly EffectSpec[];
};

export type SynergyDefinition = {
  id: string;
  name: string;
  weapons: readonly [WeaponId, WeaponId];
  description: string;
  effects: readonly EffectSpec[];
  eventRules: readonly SynergyEventRule[];
  routeVariants: readonly SynergyRouteVariant[];
  artKey: string;
};

export type FusionMechanicDefinition = {
  event:
    | "attack"
    | "hit"
    | "markedHit"
    | "block"
    | "kill"
    | "weavePass";
  cadence: number;
  action: string;
};

export type FusionDefinition = {
  id: FusionId;
  name: string;
  canonicalName: string;
  weapons: readonly [WeaponId, WeaponId];
  description: string;
  tags: readonly EffectTag[];
  effects: readonly EffectSpec[];
  weaveVerb: string;
  pairLabel: string;
  action: string;
  mechanic: FusionMechanicDefinition;
  artKey: string;
  terminalArtKey: string;
};

export type WeaveNodeKind = "weapon" | "fusion" | "celestial";
export type WeaveNodeOrigin = "core" | "overflow" | "fusion" | "celestial";

export type WeaveNode = {
  instanceId: string;
  kind: WeaveNodeKind;
  sourceId: WeaponId | FusionId | CelestialIntrusionId;
  name: string;
  tags: readonly EffectTag[];
  passEffects: readonly EffectSpec[];
  origin: WeaveNodeOrigin;
  weaponState?: WeaponState;
  consumedWeapons?: readonly WeaponState[];
};

export type CelestialIntrusionId =
  | "thunderTrial"
  | "galeTrial"
  | "fireTrial"
  | "frostTrial"
  | "ghostMarch"
  | "eclipseTrial";

export type CelestialIntrusion = {
  id: CelestialIntrusionId;
  name: string;
  warning: string;
  avatarName: string;
  baseHp: number;
  duration: number;
  hostileEffects: readonly EffectSpec[];
  capturedName: string;
  capturedTags: readonly EffectTag[];
  capturedEffects: readonly EffectSpec[];
  artKey: string;
};

export type ActiveCelestialIntrusion = {
  id: CelestialIntrusionId;
  phase: "warning" | "active" | "defeated" | "expired";
  timeRemaining: number;
  hp: number;
  maxHp: number;
};

export type WeavePulse = {
  nodeIndex: number;
  nodeProgress: number;
  completedCycles: number;
};

export type WeaveState = {
  nodes: readonly WeaveNode[];
  maxNodes: number;
  maxFusions: number;
  pulse: WeavePulse;
  activeIntrusion?: ActiveCelestialIntrusion;
  nextInstance: number;
};

export type TerminalStep = {
  nodeInstanceId: string;
  label: string;
  ordinal: number;
  tagsAdded: readonly EffectTag[];
};

export type WeaveTerminal = {
  id: string;
  name: string;
  signature: string;
  chargeSeconds: number;
  effects: readonly EffectSpec[];
  steps: readonly TerminalStep[];
  artKey: string;
};

export type EndlessPerkId =
  | "swordMarkReturn"
  | "windDeflectShot"
  | "umbrellaGap"
  | "scissorsCross"
  | "ninePearl"
  | "thirdVolleyTurret"
  | "lastNoteReturn"
  | "inkCrossStay"
  | "lanternStoredFire"
  | "thunderRelay"
  | "reverseCycle"
  | "dualCursor"
  | "emptySlotCharge"
  | "everyThirdBack"
  | "firstNodeTwice"
  | "slowHeavyFinish"
  | "fastLightFinish"
  | "carryFinish"
  | "springHealingLeaf"
  | "rainMergePearls"
  | "lotusConduct"
  | "summerWindShot"
  | "harvestBundle"
  | "autumnSweep"
  | "winterLanternWard"
  | "frostEntrySlow"
  | "highPickupWind"
  | "lastPaperGuard"
  | "humanSteady"
  | "planeCharge"
  | "sharpTurnPush"
  | "idleRecovery";

export type EndlessPerkCategory =
  | "weapon"
  | "weave"
  | "season"
  | "journey";

export type EndlessPerkEvent =
  | "markedTargetKilled"
  | "projectileCrossedWind"
  | "guardSucceeded"
  | "scissorPathsCrossed"
  | "sameTargetPearlHit"
  | "crossbowVolleyCompleted"
  | "musicChainCompleted"
  | "inkLinesCrossed"
  | "summonExpired"
  | "lightningChainCompleted"
  | "weaveCycleStarted"
  | "weaveNodePassed"
  | "weaveFinishReleased"
  | "highTierPickupCollected"
  | "pickupCreated"
  | "zoneHit"
  | "projectileCrossedWeather"
  | "multiKill"
  | "interval"
  | "enemyEnteredZone"
  | "lethalDamage"
  | "formChanged"
  | "formDuration"
  | "sharpTurn"
  | "idleDuration";

export type EndlessPerkActionKind =
  | "returnAndRetarget"
  | "retargetAndAccelerate"
  | "pushAndGuard"
  | "crossCutMarked"
  | "releasePearlRows"
  | "placeTemporaryTurret"
  | "returnChainToFirst"
  | "extendInkAndBurstCross"
  | "storeLanternFire"
  | "leaveLightningRelay"
  | "reverseNextCycle"
  | "addCounterCursor"
  | "chargeNextNode"
  | "repeatPreviousNode"
  | "repeatFirstNode"
  | "replayFinish"
  | "scaleCycleAndFinish"
  | "carryFinishDamage"
  | "spawnHealingLeaf"
  | "acceleratePickupMerge"
  | "conductLightningFromZone"
  | "accelerateAndExtendProjectile"
  | "bundleKillDrops"
  | "sweepDistantPickups"
  | "grantLanternGuard"
  | "slowFirstZoneEntry"
  | "emitPickupWind"
  | "preventLethalDamage"
  | "grantHumanGuard"
  | "empowerNextSignatureAttack"
  | "pushOnSharpTurn"
  | "healWhileIdle";

export type EndlessPerkTrigger = {
  event: EndlessPerkEvent;
  weaponId?: WeaponId;
  requiredWeaponId?: WeaponId;
  every?: number;
  cooldownSeconds?: number;
  minValue?: number;
  maxValue?: number;
  afterSeconds?: number;
  counterScope?: "global" | "target" | "weapon";
  season?: "spring" | "summer" | "autumn" | "winter";
  form?: "human" | "plane";
};

export type EndlessPerkAction = {
  kind: EndlessPerkActionKind;
  count?: number;
  value?: number;
  secondaryValue?: number;
  durationSeconds?: number;
  radius?: number;
  maxActive?: number;
  target?: "nearest" | "highestHp" | "firstTarget" | "nextNode";
};

export type EndlessPerkRule = {
  trigger: EndlessPerkTrigger;
  actions: readonly EndlessPerkAction[];
};

export type EndlessPerkDefinition = {
  id: EndlessPerkId;
  name: string;
  description: string;
  category: EndlessPerkCategory;
  maxRank: number;
  weight: number;
  tags: readonly EffectTag[];
  rules: readonly EndlessPerkRule[];
};
