export const SOLAR_TERM_SECONDS = 20;
export const SOLAR_YEAR_SECONDS = 24 * SOLAR_TERM_SECONDS;
export const TERM_TRANSITION_SECONDS = 1.2;
export const SEASON_TRANSITION_SECONDS = 6;

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

export type SolarTermId =
  | "lichun"
  | "yushui"
  | "jingzhe"
  | "chunfen"
  | "qingming"
  | "guyu"
  | "lixia"
  | "xiaoman"
  | "mangzhong"
  | "xiazhi"
  | "xiaoshu"
  | "dashu"
  | "liqiu"
  | "chushu"
  | "bailu"
  | "qiufen"
  | "hanlu"
  | "shuangjiang"
  | "lidong"
  | "xiaoxue"
  | "daxue"
  | "dongzhi"
  | "xiaohan"
  | "dahan";

export type TermAmbienceCue =
  | "birds"
  | "rain"
  | "thunder"
  | "insects"
  | "water"
  | "harvest"
  | "wind"
  | "frost"
  | "snow"
  | "bells";

export type SolarTermParticleId =
  | "plum-petals"
  | "fine-rain"
  | "distant-lightning"
  | "swallows"
  | "willow-seeds"
  | "tea-rain"
  | "dragonflies"
  | "wheat-pollen"
  | "rice-chaff"
  | "heat-motes"
  | "lotus-ripples"
  | "storm-splashes"
  | "first-leaves"
  | "reed-fluff"
  | "dew-sparks"
  | "returning-geese"
  | "cold-dew"
  | "frost-specks"
  | "chimney-smoke"
  | "first-snow"
  | "heavy-snow"
  | "lantern-breath"
  | "ice-dust"
  | "market-snow";

export type SpawnBias =
  | "none"
  | "lanterns"
  | "lantern-bugs"
  | "paper-fish"
  | "abacus-spirits"
  | "umbrella-bones"
  | "elite-puppets";

export type SolarTermVisualCue = {
  /**
   * Semantic art-atlas key. A renderer should resolve this to authored art and
   * omit it when unavailable; it must not replace it with procedural geometry.
   */
  overlaySprite: `term.${SolarTermId}.overlay`;
  particleSprite: `term.${SolarTermParticleId}`;
  edgeMotif: string;
  intensity: number;
};

export type SolarTermCue = {
  index: number;
  id: SolarTermId;
  name: string;
  season: SeasonId;
  startsAt: number;
  endsAt: number;
  visual: SolarTermVisualCue;
  ambience: TermAmbienceCue;
  spawnBias: SpawnBias;
};

type TermSeed = Omit<SolarTermCue, "index" | "startsAt" | "endsAt" | "visual"> & {
  particle: SolarTermParticleId;
  edgeMotif: string;
  intensity?: number;
};

const TERM_SEEDS: readonly TermSeed[] = [
  { id: "lichun", name: "立春", season: "spring", particle: "plum-petals", edgeMotif: "初绽梅枝与解冻土痕", ambience: "birds", spawnBias: "none" },
  { id: "yushui", name: "雨水", season: "spring", particle: "fine-rain", edgeMotif: "檐滴、润土与细雨帘", ambience: "rain", spawnBias: "umbrella-bones" },
  { id: "jingzhe", name: "惊蛰", season: "spring", particle: "distant-lightning", edgeMotif: "远雷云脚与新醒虫影", ambience: "thunder", spawnBias: "lantern-bugs", intensity: 0.82 },
  { id: "chunfen", name: "春分", season: "spring", particle: "swallows", edgeMotif: "燕尾、平分日影与花信", ambience: "birds", spawnBias: "paper-fish" },
  { id: "qingming", name: "清明", season: "spring", particle: "willow-seeds", edgeMotif: "柳烟、纸鸢与淡青远山", ambience: "wind", spawnBias: "paper-fish" },
  { id: "guyu", name: "谷雨", season: "spring", particle: "tea-rain", edgeMotif: "茶芽、谷苗与密雨水纹", ambience: "rain", spawnBias: "umbrella-bones", intensity: 0.72 },
  { id: "lixia", name: "立夏", season: "summer", particle: "dragonflies", edgeMotif: "新荷、蜻蜓与青梅盘", ambience: "insects", spawnBias: "lantern-bugs" },
  { id: "xiaoman", name: "小满", season: "summer", particle: "wheat-pollen", edgeMotif: "微满麦穗与蚕箔竹影", ambience: "insects", spawnBias: "abacus-spirits" },
  { id: "mangzhong", name: "芒种", season: "summer", particle: "rice-chaff", edgeMotif: "插秧倒影与扬起谷芒", ambience: "harvest", spawnBias: "abacus-spirits", intensity: 0.74 },
  { id: "xiazhi", name: "夏至", season: "summer", particle: "heat-motes", edgeMotif: "最长日影、蒲扇与高日", ambience: "insects", spawnBias: "lantern-bugs" },
  { id: "xiaoshu", name: "小暑", season: "summer", particle: "lotus-ripples", edgeMotif: "荷亭、莲蓬与浮萍涟漪", ambience: "water", spawnBias: "paper-fish" },
  { id: "dashu", name: "大暑", season: "summer", particle: "storm-splashes", edgeMotif: "骤雨、远雷与低压荷叶", ambience: "thunder", spawnBias: "umbrella-bones", intensity: 0.9 },
  { id: "liqiu", name: "立秋", season: "autumn", particle: "first-leaves", edgeMotif: "初黄梧叶与凉风稻浪", ambience: "wind", spawnBias: "none" },
  { id: "chushu", name: "处暑", season: "autumn", particle: "reed-fluff", edgeMotif: "褪热霞色与芦花新白", ambience: "insects", spawnBias: "lantern-bugs" },
  { id: "bailu", name: "白露", season: "autumn", particle: "dew-sparks", edgeMotif: "草叶露珠与低伏蛛网", ambience: "water", spawnBias: "umbrella-bones" },
  { id: "qiufen", name: "秋分", season: "autumn", particle: "returning-geese", edgeMotif: "归雁、晒架与平分暮色", ambience: "birds", spawnBias: "abacus-spirits" },
  { id: "hanlu", name: "寒露", season: "autumn", particle: "cold-dew", edgeMotif: "寒芦、菊影与深青露气", ambience: "wind", spawnBias: "paper-fish" },
  { id: "shuangjiang", name: "霜降", season: "autumn", particle: "frost-specks", edgeMotif: "瓦缘初霜与枯荷残梗", ambience: "frost", spawnBias: "elite-puppets", intensity: 0.76 },
  { id: "lidong", name: "立冬", season: "winter", particle: "chimney-smoke", edgeMotif: "收仓木门与屋脊炊烟", ambience: "bells", spawnBias: "none" },
  { id: "xiaoxue", name: "小雪", season: "winter", particle: "first-snow", edgeMotif: "疏雪、腌菜绳与薄冰", ambience: "snow", spawnBias: "lanterns" },
  { id: "daxue", name: "大雪", season: "winter", particle: "heavy-snow", edgeMotif: "压瓦积雪与静默灯棚", ambience: "snow", spawnBias: "elite-puppets", intensity: 0.86 },
  { id: "dongzhi", name: "冬至", season: "winter", particle: "lantern-breath", edgeMotif: "长夜灯笼、团食与白息", ambience: "bells", spawnBias: "lanterns" },
  { id: "xiaohan", name: "小寒", season: "winter", particle: "ice-dust", edgeMotif: "冰凌、梅苞与斜风细雪", ambience: "frost", spawnBias: "umbrella-bones" },
  { id: "dahan", name: "大寒", season: "winter", particle: "market-snow", edgeMotif: "岁市红灯、梅花与厚雪", ambience: "bells", spawnBias: "lanterns", intensity: 0.88 },
] as const;

export const SOLAR_TERMS: readonly SolarTermCue[] = TERM_SEEDS.map((seed, index) => ({
  index,
  id: seed.id,
  name: seed.name,
  season: seed.season,
  startsAt: index * SOLAR_TERM_SECONDS,
  endsAt: (index + 1) * SOLAR_TERM_SECONDS,
  ambience: seed.ambience,
  spawnBias: seed.spawnBias,
  visual: {
    overlaySprite: `term.${seed.id}.overlay`,
    particleSprite: `term.${seed.particle}`,
    edgeMotif: seed.edgeMotif,
    intensity: seed.intensity ?? 0.58,
  },
}));

export type SolarTermState = {
  current: SolarTermCue;
  next: SolarTermCue;
  season: SeasonId;
  cycle: number;
  elapsedInTerm: number;
  termProgress: number;
  wetInkProgress: number;
  seasonScrollProgress: number;
};

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export function getSolarTermCue(elapsed: number, looping = true): SolarTermCue {
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const cycleElapsed = looping
    ? positiveModulo(safeElapsed, SOLAR_YEAR_SECONDS)
    : Math.min(safeElapsed, SOLAR_YEAR_SECONDS - Number.EPSILON);
  return SOLAR_TERMS[Math.min(23, Math.floor(cycleElapsed / SOLAR_TERM_SECONDS))];
}

export function getSolarTermState(elapsed: number, looping = true): SolarTermState {
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const cycle = looping ? Math.floor(safeElapsed / SOLAR_YEAR_SECONDS) : 0;
  const current = getSolarTermCue(safeElapsed, looping);
  const next = SOLAR_TERMS[(current.index + 1) % SOLAR_TERMS.length];
  const cycleElapsed = looping
    ? positiveModulo(safeElapsed, SOLAR_YEAR_SECONDS)
    : Math.min(safeElapsed, SOLAR_YEAR_SECONDS - Number.EPSILON);
  const elapsedInTerm = cycleElapsed - current.startsAt;
  const atTermBoundary = current.index > 0 || cycle > 0;
  const seasonBoundary = current.index % 6 === 0 && atTermBoundary;

  return {
    current,
    next,
    season: current.season,
    cycle,
    elapsedInTerm,
    termProgress: Math.min(1, elapsedInTerm / SOLAR_TERM_SECONDS),
    wetInkProgress: atTermBoundary
      ? Math.min(1, elapsedInTerm / TERM_TRANSITION_SECONDS)
      : 1,
    seasonScrollProgress: seasonBoundary
      ? Math.min(1, elapsedInTerm / SEASON_TRANSITION_SECONDS)
      : 1,
  };
}

export function getTermsBetween(startSeconds: number, endSeconds: number): SolarTermCue[] {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    return [];
  }
  const result: SolarTermCue[] = [];
  const firstBoundary = Math.floor(Math.max(0, startSeconds) / SOLAR_TERM_SECONDS);
  const lastBoundary = Math.floor(Math.max(0, endSeconds - 1e-9) / SOLAR_TERM_SECONDS);
  for (let boundary = firstBoundary; boundary <= lastBoundary; boundary += 1) {
    const term = SOLAR_TERMS[boundary % SOLAR_TERMS.length];
    if (result.at(-1)?.id !== term.id) result.push(term);
  }
  return result;
}

export const SEASON_NAMES: Readonly<Record<SeasonId, string>> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};
