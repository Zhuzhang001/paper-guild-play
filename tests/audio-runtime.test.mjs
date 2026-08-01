import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-audio-"));
const outfile = join(scratch, "audio.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const result = spawnSync(
  esbuild,
  [
    fileURLToPath(new URL("../app/game/world/audio.ts", import.meta.url)),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${outfile}`,
  ],
  {
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)};${process.env.PATH ?? ""}`,
    },
  },
);
assert.equal(result.status, 0, result.stderr);
const audio = await import(pathToFileURL(outfile).href);
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

test("same-frame combat sounds aggregate before voice allocation", () => {
  const plan = audio.planSfxFrame([
    ...Array(24).fill("weapon.abacus.hit"),
    ...Array(16).fill("sfx.pickup"),
    "sfx.player-hit",
  ]);
  assert.equal(
    plan.find((entry) => entry.cue === "weapon.abacus.hit")?.count,
    24,
  );
  assert.equal(plan.find((entry) => entry.cue === "sfx.pickup")?.count, 16);
  assert.equal(plan.find((entry) => entry.cue === "sfx.player-hit")?.count, 1);
});

test("boss entrance wins over solar-term and ambience cues", () => {
  const plan = audio.planSfxFrame([
    "ambience.rain",
    "sfx.term-change",
    "sfx.boss-taotie",
  ]);
  assert.deepEqual(plan.map((entry) => entry.cue), ["sfx.boss-taotie"]);
});

test("fold and unfold share an exclusive player-form lane", () => {
  const plan = audio.planSfxFrame(["sfx.fold", "sfx.unfold"]);
  assert.deepEqual(plan.map((entry) => entry.cue), ["sfx.unfold"]);
});

test("weapon material cues expose three authored variants", () => {
  const weaponCues = Object.entries(audio.AUDIO_CUES).filter(([id]) =>
    id.startsWith("weapon."),
  );
  assert.equal(weaponCues.length, 20);
  for (const [, definition] of weaponCues) {
    assert.ok(Array.isArray(definition.url));
    assert.equal(definition.url.length, 3);
  }
});

test("every crafted weapon has its own restrained attack signature", () => {
  const fusionCues = Object.entries(audio.AUDIO_CUES).filter(([id]) =>
    id.startsWith("fusion."),
  );
  assert.equal(fusionCues.length, 45);
  assert.equal(
    new Set(fusionCues.map(([, definition]) => definition.url)).size,
    45,
  );
  for (const [id, definition] of fusionCues) {
    assert.match(definition.url, /^\/audio\/fusion-.+\.wav$/);
    assert.ok(definition.volume <= 0.42, `${id} should stay beneath the main weapon mix`);
    assert.ok(definition.categoryCooldownMs >= 140);
  }
});

test("mix limits and music priority match mobile and boss rules", () => {
  assert.deepEqual(audio.AUDIO_MIX_LIMITS, {
    mobileSfxVoices: 8,
    desktopSfxVoices: 10,
    reservedPriorityVoices: 2,
  });
  assert.equal(
    audio.getWorldMusicCue({
      season: "spring",
      endless: true,
      bossTier: "mid",
    }),
    "music.boss.taotie",
  );
});

test("a crafted attack suppresses its component fire and hit sounds", () => {
  const plan = audio.planSfxFrame([
    "weapon.fan.fire",
    "weapon.umbrella.hit",
    "fusion.mistCanopy",
  ]);
  assert.deepEqual(plan.map((entry) => entry.cue), ["fusion.mistCanopy"]);
});

test("defaults and old-default migration preserve intentional custom mixes", () => {
  assert.deepEqual(audio.DEFAULT_AUDIO_SETTINGS, {
    muted: false,
    master: 0.68,
    music: 0.5,
    sfx: 0.42,
    ambient: 0.24,
  });
  assert.deepEqual(
    audio.migrateAudioSettings({
      muted: false,
      master: 0.72,
      music: 0.6,
      sfx: 0.56,
      ambient: 0.4,
      mixRevision: 2,
    }),
    audio.DEFAULT_AUDIO_SETTINGS,
  );
  assert.deepEqual(
    audio.migrateAudioSettings({
      muted: true,
      master: 0.61,
      music: 0.47,
      sfx: 0.31,
      ambient: 0.18,
      mixRevision: 2,
    }),
    {
      muted: true,
      master: 0.61,
      music: 0.47,
      sfx: 0.31,
      ambient: 0.18,
    },
  );
  assert.equal(
    audio.migrateAudioSettings({ music: 0.6, mixRevision: audio.AUDIO_MIX_REVISION }).music,
    0.6,
    "a current-revision custom value must not be rewritten",
  );
  assert.deepEqual(audio.migrateAudioSettings({ master: 4, sfx: -2 }), {
    muted: false,
    master: 1,
    music: 0.5,
    sfx: 0,
    ambient: 0.24,
  });
});

test("shared cooldowns and authored variants never detune pitched combat cues", () => {
  const definitions = Object.entries(audio.AUDIO_CUES);
  const fire = definitions.filter(([id]) => /^weapon\..+\.fire$/.test(id));
  const hit = definitions.filter(([id]) => /^weapon\..+\.hit$/.test(id));
  const fusion = definitions.filter(([id]) => id.startsWith("fusion."));
  assert.ok(
    fire.every(([, cue]) =>
      cue.categoryCooldownMs === audio.AUDIO_SHARED_COOLDOWNS_MS.weaponFire &&
      cue.playbackRateVariation === 0),
  );
  assert.ok(
    hit.every(([, cue]) =>
      cue.categoryCooldownMs === audio.AUDIO_SHARED_COOLDOWNS_MS.weaponHit &&
      cue.playbackRateVariation === 0),
  );
  assert.ok(
    fusion.every(([, cue]) =>
      cue.categoryCooldownMs === audio.AUDIO_SHARED_COOLDOWNS_MS.fusion &&
      cue.playbackRateVariation === 0),
  );
  assert.deepEqual(audio.AUDIO_SHARED_COOLDOWNS_MS, {
    weaponFire: 110,
    weaponHit: 150,
    fusion: 260,
  });
});

test("fusion and finish cues own the frame and duck base combat for 180ms", () => {
  for (const cue of ["sfx.fusion", "sfx.ultimate"]) {
    assert.equal(audio.AUDIO_CUES[cue].lane, "combat-accent");
    const plan = audio.planSfxFrame([
      "weapon.sword.fire",
      "weapon.abacus.hit",
      cue,
    ]);
    assert.deepEqual(plan.map((entry) => entry.cue), [cue]);
  }
  assert.equal(audio.AUDIO_COMBAT_ACCENT_DUCK.seconds, 0.18);
  assert.ok(
    Math.abs(20 * Math.log10(audio.AUDIO_COMBAT_ACCENT_DUCK.floor) + 5) < 0.1,
    "base combat duck should be approximately -5dB",
  );
});

test("mobile and desktop reserve two voices for hit, Boss and milestone cues", () => {
  assert.deepEqual(audio.getSfxVoiceBudget(true), {
    total: 8,
    base: 6,
    reserved: 2,
  });
  assert.deepEqual(audio.getSfxVoiceBudget(false), {
    total: 10,
    base: 8,
    reserved: 2,
  });
  for (const cue of [
    "sfx.player-hit",
    "sfx.boss-taotie",
    "sfx.upgrade",
    "sfx.fusion",
    "sfx.ultimate",
  ]) {
    assert.equal(audio.isReservedPriorityCue(cue), true, cue);
  }
  assert.equal(audio.isReservedPriorityCue("weapon.sword.fire"), false);
  assert.equal(audio.isReservedPriorityCue("fusion.mistCanopy"), false);

  const desktopBaseVoices = Array.from({ length: 8 }, (_, index) => ({
    cue: index % 2 === 0 ? "weapon.sword.fire" : "weapon.abacus.hit",
    priority: 30,
    startedAt: index,
  }));
  assert.deepEqual(
    audio.planSfxVoiceAdmission({
      cue: "weapon.fan.fire",
      priority: 30,
      mobile: false,
      live: desktopBaseVoices,
    }),
    { admitted: false, preemptIndex: undefined },
    "ordinary combat cannot consume the two reserved desktop lanes",
  );
  assert.deepEqual(
    audio.planSfxVoiceAdmission({
      cue: "sfx.player-hit",
      priority: 88,
      mobile: false,
      live: desktopBaseVoices,
    }),
    { admitted: true, preemptIndex: undefined },
  );
  const saturated = [
    ...desktopBaseVoices,
    { cue: "sfx.upgrade", priority: 66, startedAt: 8 },
    { cue: "sfx.player-hit", priority: 88, startedAt: 9 },
  ];
  const bossAdmission = audio.planSfxVoiceAdmission({
    cue: "sfx.boss-nian",
    priority: 100,
    mobile: false,
    live: saturated,
  });
  assert.equal(bossAdmission.admitted, true);
  assert.ok(
    bossAdmission.preemptIndex >= 0 && bossAdmission.preemptIndex < 8,
    "Boss entry reclaims an ordinary lane before a reserved voice",
  );
});

test("the pressure planner is deterministic and keeps Boss ambience quiet", () => {
  const pressure = [
    ...Array(40).fill("weapon.abacus.fire"),
    ...Array(30).fill("weapon.sword.hit"),
    ...Array(12).fill("fusion.mistCanopy"),
    ...Array(8).fill("sfx.pickup"),
    "ambience.thunder",
    "sfx.term-change",
    "sfx.player-hit",
    "sfx.boss-nian",
    "sfx.ultimate",
  ];
  const first = audio.planSfxFrame(pressure);
  const second = audio.planSfxFrame(pressure);
  assert.deepEqual(first, second);
  assert.ok(first.some((entry) => entry.cue === "sfx.boss-nian"));
  assert.ok(first.some((entry) => entry.cue === "sfx.player-hit"));
  assert.ok(first.some((entry) => entry.cue === "sfx.ultimate"));
  assert.ok(first.every((entry) => !entry.cue.startsWith("weapon.")));
  assert.ok(first.every((entry) => !entry.cue.startsWith("ambience.")));
  assert.ok(first.every((entry) => entry.cue !== "sfx.term-change"));
  assert.equal(audio.BOSS_ATMOSPHERE_QUIET_MS, 5_000);
});

function childAtoms(buffer, start = 0, end = buffer.length) {
  const atoms = [];
  for (let offset = start; offset + 8 <= end;) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;
    atoms.push({ type, start: offset + header, end: offset + size });
    offset += size;
  }
  return atoms;
}

function findAtom(buffer, path, start = 0, end = buffer.length) {
  for (const atom of childAtoms(buffer, start, end)) {
    if (atom.type !== path[0]) continue;
    if (path.length === 1) return atom;
    const nested = findAtom(buffer, path.slice(1), atom.start, atom.end);
    if (nested) return nested;
  }
  return null;
}

function m4aDurationSeconds(buffer) {
  const atom = findAtom(buffer, ["moov", "mvhd"]);
  assert.ok(atom, "music file should contain an mvhd duration atom");
  const version = buffer[atom.start];
  if (version === 1) {
    const timescale = buffer.readUInt32BE(atom.start + 20);
    const duration = Number(buffer.readBigUInt64BE(atom.start + 24));
    return duration / timescale;
  }
  const timescale = buffer.readUInt32BE(atom.start + 12);
  const duration = buffer.readUInt32BE(atom.start + 16);
  return duration / timescale;
}

test("all seven phase-locked music assets use the shared 72 BPM six-beat system", () => {
  assert.deepEqual(audio.AUDIO_TONAL_SYSTEM, {
    bpm: 72,
    meter: [6, 8],
    tonic: "D",
    pentatonicSemitones: [0, 2, 4, 7, 9],
    loopSeconds: 60,
    phaseLocked: true,
  });
  const music = Object.entries(audio.AUDIO_CUES).filter(([id]) =>
    id.startsWith("music."),
  );
  assert.equal(music.length, 7);
  for (const [id, cue] of music) {
    assert.equal(cue.loop, true, id);
    const path = fileURLToPath(
      new URL(`../public${cue.url}`, import.meta.url),
    );
    const duration = m4aDurationSeconds(readFileSync(path));
    assert.ok(Math.abs(duration - 60) < 0.08, `${id} duration ${duration}`);
  }
  assert.equal(audio.resolveLoopPhase(121.25, 60), 1.25);
  assert.equal(audio.resolveLoopPhase(-0.25, 60), 59.75);
});
