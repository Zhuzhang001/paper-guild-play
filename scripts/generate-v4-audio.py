#!/usr/bin/env python3
"""Build the Paper Guild v4 score and material-led sound set.

The score and effects use deterministic modal, string, breath, paper and wood
models. Two explicitly credited public-domain/CC0 field recordings provide a
quiet weather bed; no unclear sample license is embedded in shipped files.
"""

from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt


SR = 32_000
ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / "work" / "audio-v4-wav"
PUBLIC = ROOT / "public" / "audio"
RNG = np.random.default_rng(2404)


def midi(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def envelope(length: int, attack: float, release: float) -> np.ndarray:
    t = np.arange(length) / SR
    duration = length / SR
    attack_curve = np.clip(t / max(attack, 1 / SR), 0, 1)
    release_curve = np.clip((duration - t) / max(release, 1 / SR), 0, 1)
    return np.sin(attack_curve * math.pi / 2) * np.sin(
        release_curve * math.pi / 2
    )


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    sos = butter(4, cutoff / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, signal, axis=0)


def bandpass(signal: np.ndarray, low: float, high: float) -> np.ndarray:
    sos = butter(
        3,
        [low / (SR / 2), high / (SR / 2)],
        btype="band",
        output="sos",
    )
    return sosfilt(sos, signal, axis=0)


def stereo(mono: np.ndarray, pan: float = 0) -> np.ndarray:
    pan = float(np.clip(pan, -1, 1))
    angle = (pan + 1) * math.pi / 4
    return np.column_stack((mono * math.cos(angle), mono * math.sin(angle)))


def add_cyclic(
    track: np.ndarray,
    sound: np.ndarray,
    start_seconds: float,
    pan: float = 0,
    gain: float = 1,
) -> None:
    source = stereo(sound, pan) if sound.ndim == 1 else sound
    source = source * gain
    start = int(round(start_seconds * SR)) % len(track)
    cursor = 0
    while cursor < len(source):
        chunk = min(len(source) - cursor, len(track) - start)
        track[start : start + chunk] += source[cursor : cursor + chunk]
        cursor += chunk
        start = 0


def pluck(
    note: float,
    duration: float = 2.2,
    brightness: float = 0.55,
    damping: float = 1.0,
    seed: int = 0,
) -> np.ndarray:
    length = max(8, int(duration * SR))
    t = np.arange(length) / SR
    f = midi(note)
    phase_rng = np.random.default_rng(seed + int(note * 17))
    signal = np.zeros(length)
    harmonic_count = 7
    for harmonic in range(1, harmonic_count + 1):
        amplitude = (brightness ** (harmonic - 1)) / harmonic**0.38
        phase = phase_rng.uniform(-0.25, 0.25)
        detune = 1 + (harmonic - 1) * 0.0007
        signal += amplitude * np.sin(
            2 * math.pi * f * harmonic * detune * t + phase
        )
    body = (1 - np.exp(-t * 95)) * np.exp(-t * (2.2 / damping))
    pick = lowpass(phase_rng.normal(0, 1, length), 4_800)
    pick *= np.exp(-t * 42) * 0.13
    return lowpass((signal * body + pick) * 0.34, 7_200)


def flute(note: float, duration: float = 2.6, seed: int = 0) -> np.ndarray:
    length = int(duration * SR)
    t = np.arange(length) / SR
    f = midi(note)
    vibrato = 1 + 0.0028 * np.sin(2 * math.pi * 5.1 * t)
    phase = 2 * math.pi * np.cumsum(f * vibrato) / SR
    tone = np.sin(phase) + 0.16 * np.sin(2 * phase) + 0.045 * np.sin(3 * phase)
    breath_rng = np.random.default_rng(700 + seed)
    breath = bandpass(breath_rng.normal(0, 1, length), 650, 5_800)
    breath *= 0.025 + 0.012 * np.sin(2 * math.pi * 1.7 * t)
    return (tone * 0.3 + breath) * envelope(length, 0.18, 0.38)


def reed_pad(notes: list[float], duration: float = 4.2) -> np.ndarray:
    length = int(duration * SR)
    t = np.arange(length) / SR
    result = np.zeros(length)
    for index, note in enumerate(notes):
        f = midi(note)
        phase = 2 * math.pi * f * t + index * 0.27
        result += (
            np.sin(phase)
            + 0.19 * np.sin(2 * phase)
            + 0.065 * np.sin(3 * phase)
        )
    result /= max(1, len(notes))
    result *= 1 + 0.035 * np.sin(2 * math.pi * 0.37 * t)
    return lowpass(result * envelope(length, 0.42, 0.7) * 0.25, 5_200)


def wood(strength: float = 1, duration: float = 0.22, seed: int = 0) -> np.ndarray:
    length = int(duration * SR)
    t = np.arange(length) / SR
    local = np.random.default_rng(900 + seed)
    click = bandpass(local.normal(0, 1, length), 450, 3_200)
    body = (
        np.sin(2 * math.pi * 420 * t)
        + 0.52 * np.sin(2 * math.pi * 715 * t)
    )
    return (body * 0.23 + click * 0.07) * np.exp(-t * 22) * strength


def drum(strength: float = 1, duration: float = 0.82, seed: int = 0) -> np.ndarray:
    length = int(duration * SR)
    t = np.arange(length) / SR
    local = np.random.default_rng(1_300 + seed)
    phase = 2 * math.pi * np.cumsum(92 * np.exp(-t * 5.2) + 48) / SR
    skin = lowpass(local.normal(0, 1, length), 900)
    signal = np.sin(phase) * 0.72 + skin * 0.11
    return signal * (1 - np.exp(-t * 65)) * np.exp(-t * 5.1) * strength


def bell(note: float, duration: float = 2.8, seed: int = 0) -> np.ndarray:
    length = int(duration * SR)
    t = np.arange(length) / SR
    f = midi(note)
    ratios = [1.0, 2.01, 2.72, 3.91, 5.16]
    amps = [1.0, 0.34, 0.2, 0.12, 0.06]
    result = np.zeros(length)
    for ratio, amp in zip(ratios, amps):
        result += amp * np.sin(2 * math.pi * f * ratio * t + seed * 0.13)
    return lowpass(result * np.exp(-t * 2.3) * 0.2, 7_000)


def periodic_reverb(track: np.ndarray, amount: float = 0.12) -> np.ndarray:
    result = track.copy()
    for seconds, gain in [(0.137, amount), (0.283, amount * 0.68), (0.419, amount * 0.38)]:
        result += np.roll(track, int(seconds * SR), axis=0) * gain
    return result


def master(signal: np.ndarray, peak_db: float = -4) -> np.ndarray:
    signal = signal - np.mean(signal, axis=0, keepdims=True)
    peak = max(1e-9, float(np.max(np.abs(signal))))
    return signal * (10 ** (peak_db / 20) / peak)


def write_wav(path: Path, signal: np.ndarray, peak_db: float = -3) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    shaped = master(signal, peak_db)
    wavfile.write(path, SR, np.int16(np.clip(shaped, -1, 1) * 32767))


def decode_recording(ffmpeg: Path, path: Path) -> np.ndarray:
    decoded = subprocess.run(
        [
            str(ffmpeg),
            "-v",
            "error",
            "-i",
            str(path),
            "-f",
            "f32le",
            "-ac",
            "1",
            "-ar",
            str(SR),
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    )
    signal = np.frombuffer(decoded.stdout, dtype=np.float32).astype(np.float64)
    signal -= np.mean(signal)
    rms = math.sqrt(float(np.mean(signal**2))) or 1
    return lowpass(signal / rms, 6_200)


def fit_recording(signal: np.ndarray, length: int, offset_seconds: float) -> np.ndarray:
    start = int(offset_seconds * SR) % len(signal)
    rolled = np.roll(signal, -start)
    repeats = math.ceil(length / len(rolled))
    return np.tile(rolled, repeats)[:length]


D_GONG = [38, 40, 42, 45, 47, 50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88, 90]


def gong_note(index: int) -> int:
    return D_GONG[index % len(D_GONG)]


def make_score(style: str, duration: float = 60.0) -> np.ndarray:
    """A shared, sparse 72 BPM 6/8 score; styles swap timbre, not harmony."""
    track = np.zeros((int(duration * SR), 2), dtype=np.float64)
    bar = 2.5  # 72 quarter notes per minute, three quarter notes per 6/8 bar.
    bars = int(round(duration / bar))
    root_cycle = [50, 57, 59, 52, 50, 54, 57, 52]
    phrase = [74, 76, 78, 81, 78, 76, 74, 71]

    for bar_index in range(bars):
        start = bar_index * bar
        root = root_cycle[(bar_index // 2) % len(root_cycle)]
        phrase_note = phrase[(bar_index + (1 if style == "summer" else 0)) % len(phrase)]

        if style == "spring":
            if bar_index % 2 == 0:
                add_cyclic(track, pluck(root, 2.1, 0.34, 1.45, bar_index), start, -0.3, 0.36)
            if bar_index % 4 in {1, 2}:
                add_cyclic(track, flute(phrase_note, 1.65, bar_index), start + 0.72, 0.24, 0.27)
            if bar_index % 8 == 6:
                add_cyclic(track, pluck(81, 1.4, 0.42, 1.2, bar_index), start + 1.7, 0.12, 0.2)

        elif style == "summer":
            add_cyclic(track, pluck(root, 1.7, 0.4, 1.0, bar_index), start, -0.22, 0.3)
            add_cyclic(track, wood(0.24, 0.18, bar_index), start + 0.82, 0.12, 0.25)
            if bar_index % 2 == 0:
                add_cyclic(track, flute(phrase_note, 1.25, bar_index), start + 1.35, 0.28, 0.22)

        elif style == "autumn":
            if bar_index % 4 in {0, 1}:
                add_cyclic(track, pluck(phrase_note, 1.65, 0.57, 0.9, bar_index), start + 0.18, 0.2, 0.34)
                add_cyclic(track, pluck(root, 1.9, 0.42, 1.15, bar_index + 90), start + 1.28, -0.26, 0.24)
            if bar_index % 2 == 0:
                add_cyclic(track, wood(0.18, 0.2, bar_index), start + 2.0, -0.08, 0.2)

        elif style == "winter":
            if bar_index % 2 == 0:
                add_cyclic(track, reed_pad([root, root + 7, root + 12], 3.85), start, -0.08, 0.26)
                add_cyclic(track, drum(0.24, 0.74, bar_index), start + 0.08, -0.16, 0.24)
            if bar_index % 8 == 4:
                add_cyclic(track, bell(78, 2.1, bar_index), start + 1.2, 0.28, 0.14)

        elif style == "endless":
            add_cyclic(track, drum(0.19, 0.58, bar_index), start + 0.12, -0.18, 0.2)
            if bar_index % 2 == 0:
                add_cyclic(track, reed_pad([root - 12, root, root + 7], 3.5), start, -0.12, 0.18)
            if bar_index % 4 == 1:
                add_cyclic(track, pluck(phrase_note, 1.55, 0.46, 0.9, bar_index), start + 1.28, 0.24, 0.25)

        else:
            # Boss tracks are compatible low/rhythm layers, not a second tune.
            strength = 0.36 if style == "taotie" else 0.42
            add_cyclic(track, drum(strength, 0.74, bar_index), start + 0.08, -0.12, 0.32)
            add_cyclic(track, wood(0.2, 0.2, bar_index + 30), start + 1.25, 0.14, 0.2)
            if bar_index % 2 == 0:
                add_cyclic(track, reed_pad([root - 12, root, root + 7], 3.7), start, -0.08, 0.2)
            if bar_index % 4 == (1 if style == "nian" else 3):
                add_cyclic(track, pluck(phrase_note, 1.5, 0.5, 0.9, bar_index), start + 1.65, 0.22, 0.22)

    reverb = 0.07 if style not in {"taotie", "nian"} else 0.045
    return master(periodic_reverb(track, reverb), -6)


def noise_swell(duration: float, low: float, high: float, seed: int) -> np.ndarray:
    length = int(duration * SR)
    local = np.random.default_rng(seed)
    noise = bandpass(local.normal(0, 1, length), low, high)
    return noise * envelope(length, duration * 0.12, duration * 0.26)


def make_ambience(name: str, duration: float = 8.0) -> np.ndarray:
    length = int(duration * SR)
    t = np.arange(length) / SR
    local = np.random.default_rng(3_000 + sum(map(ord, name)))
    base = np.zeros(length)
    if name in {"rain", "snow"}:
        base += lowpass(local.normal(0, 1, length), 4_800) * (0.13 if name == "rain" else 0.04)
        density = 24 if name == "rain" else 9
        for hit in range(density):
            start = int(local.uniform(0, duration - 0.12) * SR)
            drop = wood(0.2 if name == "rain" else 0.08, 0.12, hit)
            base[start : start + len(drop)] += drop[: max(0, min(len(drop), length - start))]
    elif name in {"wind", "frost"}:
        noise = lowpass(local.normal(0, 1, length), 1_600 if name == "wind" else 3_200)
        base += noise * (0.08 + 0.035 * np.sin(2 * math.pi * 0.21 * t))
        if name == "frost":
            for index in range(3):
                start = int((1.2 + index * 2.1) * SR)
                tone = bell(84 + index * 2, 1.4, index) * 0.13
                base[start : start + len(tone)] += tone[: max(0, min(len(tone), length - start))]
    elif name == "thunder":
        base += lowpass(local.normal(0, 1, length), 260) * np.exp(-np.maximum(0, t - 1.2) * 1.3) * (t > 1.2) * 0.2
        rumble = drum(0.65, 2.4, 22)
        start = int(1.05 * SR)
        base[start : start + len(rumble)] += rumble[
            : max(0, min(len(rumble), length - start))
        ]
    elif name in {"birds", "insects"}:
        base += lowpass(local.normal(0, 1, length), 1_200) * 0.018
        count = 8 if name == "birds" else 22
        for index in range(count):
            start = int(local.uniform(0.2, duration - 0.3) * SR)
            chirp_length = int((0.16 if name == "birds" else 0.08) * SR)
            ct = np.arange(chirp_length) / SR
            f0 = (1_900 if name == "birds" else 3_200) + local.uniform(-250, 350)
            chirp = np.sin(2 * math.pi * (f0 * ct + 900 * ct**2))
            chirp *= envelope(chirp_length, 0.015, 0.05) * (0.09 if name == "birds" else 0.025)
            base[start : start + chirp_length] += chirp[: max(0, min(chirp_length, length - start))]
    elif name == "water":
        base += lowpass(local.normal(0, 1, length), 1_800) * (0.055 + 0.02 * np.sin(2 * math.pi * 0.35 * t))
        for index in range(10):
            start = int(local.uniform(0, duration - 0.2) * SR)
            drop = bell(84 + index % 4, 0.32, index) * 0.09
            base[start : start + len(drop)] += drop[: max(0, min(len(drop), length - start))]
    elif name == "harvest":
        base += lowpass(local.normal(0, 1, length), 900) * 0.025
        for index in range(7):
            start = int((0.5 + index * 1.03) * SR)
            hit = wood(0.32, 0.28, index)
            base[start : start + len(hit)] += hit[: max(0, min(len(hit), length - start))]
    elif name == "bells":
        for index, when in enumerate([0.5, 2.7, 5.2]):
            tone = bell(77 + index * 2, 2.4, index) * 0.24
            start = int(when * SR)
            base[start : start + len(tone)] += tone[: max(0, min(len(tone), length - start))]
    return master(stereo(base, 0), -8)


def material_weapon(weapon: str, kind: str, variant: int) -> np.ndarray:
    seed = 5_000 + variant * 97 + sum(map(ord, weapon + kind))
    local = np.random.default_rng(seed)
    if kind == "fire":
        duration = {
            "umbrella": 0.48,
            "inkline": 0.46,
            "lantern": 0.52,
            "thunder": 0.68,
        }.get(weapon, 0.36)
    else:
        duration = 0.28 if weapon != "thunder" else 0.48
    length = int(duration * SR)
    signal = np.zeros(length)
    variant_note = {
        1: 74,
        2: 76,
        3: 78,
    }[variant]

    if weapon == "sword":
        signal += noise_swell(duration, 900, 5_200, seed) * (0.18 if kind == "fire" else 0.08)
        signal += pluck(variant_note, duration, 0.68, 0.45, seed)[:length] * 0.34
    elif weapon == "fan":
        signal += noise_swell(duration, 240, 2_800, seed) * (0.28 if kind == "fire" else 0.17)
        signal += wood(0.18, duration, seed)[:length]
    elif weapon == "umbrella":
        signal += noise_swell(duration, 350, 2_300, seed) * 0.17
        for offset in [0.02, 0.09, 0.17]:
            hit = wood(0.34 if kind == "fire" else 0.24, 0.2, seed + int(offset * 100))
            start = int(offset * SR)
            signal[start : start + min(len(hit), length - start)] += hit[: max(0, min(len(hit), length - start))]
    elif weapon == "scissors":
        upper_note = [86, 88, 90][variant - 1]
        for offset, note in [(0.01, variant_note), (0.095, upper_note)]:
            hit = bell(note, 0.26, seed) * (0.3 if kind == "fire" else 0.22)
            start = int(offset * SR)
            signal[start : start + min(len(hit), length - start)] += hit[: max(0, min(len(hit), length - start))]
    elif weapon == "abacus":
        for index in range(4 if kind == "fire" else 2):
            hit = wood(0.25, 0.16, seed + index)
            start = int((0.025 + index * 0.047) * SR)
            signal[start : start + min(len(hit), length - start)] += hit[: max(0, min(len(hit), length - start))]
    elif weapon == "crossbow":
        signal += pluck([50, 52, 54][variant - 1], duration, 0.74, 0.42, seed)[:length] * 0.32
        signal += wood(0.43, duration, seed)[:length]
    elif weapon == "pipa":
        signal += pluck(variant_note, duration, 0.7, 0.55, seed)[:length] * 0.42
    elif weapon == "inkline":
        signal += pluck([62, 64, 66][variant - 1], duration, 0.45, 0.52, seed)[:length] * 0.3
        signal += bandpass(local.normal(0, 1, length), 180, 1_900) * np.exp(-np.arange(length) / SR * 8) * 0.05
    elif weapon == "lantern":
        signal += wood(0.24, duration, seed)[:length]
        signal += noise_swell(duration, 180, 1_500, seed) * 0.15
        signal += bell(variant_note, duration, seed)[:length] * 0.1
    elif weapon == "thunder":
        t = np.arange(length) / SR
        crack = bandpass(local.normal(0, 1, length), 140, 4_200)
        signal += crack * np.exp(-t * (7 if kind == "fire" else 11)) * 0.13
        signal += drum(0.5, duration, seed)[:length] * 0.45
    return lowpass(signal, 7_000)


def material_fusion(
    fusion_id: str,
    first_weapon: str,
    second_weapon: str,
    index: int,
) -> np.ndarray:
    """Author one restrained composite gesture instead of stacking two cues."""
    duration = 0.78 if "thunder" in (first_weapon, second_weapon) else 0.62
    length = int(duration * SR)
    result = np.zeros(length)
    seed = 11_000 + index
    pair = {first_weapon, second_weapon}
    note = [62, 64, 66, 69, 71][index % 5]
    family = index % 8

    if "thunder" in pair:
        crack = noise_swell(duration, 170, 3_600, seed)
        result += crack[:length] * 0.095
        result += drum(0.26, duration, seed)[:length] * 0.24
    elif pair & {"fan", "umbrella"}:
        result += noise_swell(duration, 260, 2_300, seed)[:length] * 0.12
        result += wood(0.17, duration, seed)[:length]
    elif pair & {"pipa", "crossbow"}:
        result += pluck(note, duration, 0.54, 0.72, seed)[:length] * 0.28
    else:
        result += wood(0.22, duration, seed)[:length]

    if family in {0, 3, 6}:
        accent = pluck(note + 12, 0.38, 0.4, 0.52, seed) * 0.13
        accent_start = int(0.16 * SR)
        result[
            accent_start : accent_start + min(len(accent), length - accent_start)
        ] += accent[: max(0, min(len(accent), length - accent_start))]
    elif family in {1, 4}:
        accent = wood(0.18, 0.22, seed + 1)
        accent_start = int(0.2 * SR)
        result[
            accent_start : accent_start + min(len(accent), length - accent_start)
        ] += accent[: max(0, min(len(accent), length - accent_start))]
    else:
        result += noise_swell(duration, 480, 2_800, seed + 2)[:length] * 0.045
    return lowpass(result, 6_800)


def make_sfx(name: str) -> np.ndarray:
    seed = 8_000 + sum(map(ord, name))
    if name in {"fold", "unfold"}:
        duration = 0.42
        paper = noise_swell(duration, 260, 3_500, seed) * 0.2
        creases = np.zeros(int(duration * SR))
        offsets = [0.04, 0.13, 0.24] if name == "fold" else [0.03, 0.16, 0.29]
        for index, offset in enumerate(offsets):
            hit = wood(0.14, 0.13, seed + index)
            start = int(offset * SR)
            creases[start : start + min(len(hit), len(creases) - start)] += hit[: max(0, min(len(hit), len(creases) - start))]
        return paper + creases
    if name == "pickup":
        return pluck(86, 0.24, 0.5, 0.45, seed) * 0.36
    if name in {"ui-confirm", "ui-back"}:
        note = 76 if name == "ui-confirm" else 69
        return wood(0.22, 0.18, seed) + pluck(note, 0.18, 0.38, 0.35, seed)[: int(0.18 * SR)] * 0.2
    if name == "enemy-death":
        return noise_swell(0.42, 120, 1_700, seed) * 0.13 + wood(0.2, 0.42, seed)
    if name == "player-hit":
        return drum(0.42, 0.46, seed) + wood(0.28, 0.46, seed)
    if name == "term-change":
        return flute(78, 1.1, seed) * 0.22 + bell(74, 1.1, seed) * 0.09
    if name in {"upgrade", "synergy", "fusion", "ultimate"}:
        duration = {"upgrade": 1.1, "synergy": 1.35, "fusion": 1.7, "ultimate": 2.1}[name]
        result = np.zeros(int(duration * SR))
        notes = {
            "upgrade": [62, 66, 69],
            "synergy": [57, 62, 66, 69],
            "fusion": [50, 57, 62, 66],
            "ultimate": [50, 57, 62, 69, 74],
        }[name]
        for index, note in enumerate(notes):
            tone = pluck(note, duration - index * 0.12, 0.5, 1.2, seed + index)
            start = int(index * 0.11 * SR)
            result[start : start + min(len(tone), len(result) - start)] += tone[: max(0, min(len(tone), len(result) - start))] * 0.32
        if name in {"fusion", "ultimate"}:
            result += drum(0.24, duration, seed)[: len(result)]
        return result
    if name in {"boss-taotie", "boss-nian"}:
        duration = 2.6
        result = np.zeros(int(duration * SR))
        result += drum(0.7, duration, seed)[: len(result)]
        result += bell(38 if name == "boss-taotie" else 45, duration, seed)[: len(result)] * 0.26
        if name == "boss-nian":
            for index, offset in enumerate([0.55, 1.05, 1.55]):
                hit = wood(0.55, 0.35, seed + index)
                start = int(offset * SR)
                result[start : start + min(len(hit), len(result) - start)] += hit[: max(0, min(len(hit), len(result) - start))]
        return result
    raise ValueError(name)


def encode_aac(
    ffmpeg: Path,
    source: Path,
    target: Path,
    loudness: float,
    bitrate: str,
    loop_seconds: float | None = None,
) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    filters = f"loudnorm=I={loudness}:TP=-1.5:LRA=7"
    if loop_seconds is not None:
        seam_fade = 0.064
        filters += (
            f",afade=t=in:st=0:d={seam_fade},"
            f"afade=t=out:st={loop_seconds - seam_fade}:d={seam_fade}"
        )
    command = [
        str(ffmpeg),
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-af",
        filters,
        "-ar",
        str(SR),
        "-ac",
        "2",
        "-c:a",
        "aac",
        "-b:a",
        bitrate,
        "-movflags",
        "+faststart",
        str(target),
    ]
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", type=Path, required=True)
    args = parser.parse_args()
    TEMP.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    cc0_directory = ROOT / "work" / "cc0-audio"
    rain_recording = decode_recording(
        args.ffmpeg,
        cc0_directory / "rain-thunder-birds.ogg",
    )
    wind_recording = decode_recording(
        args.ffmpeg,
        cc0_directory / "howling-wind.ogg",
    )

    styles = {
        "spring": -18,
        "summer": -18,
        # Sparse two-bars-on/two-bars-off phrasing reads quieter to EBU
        # gating, so the encoder target is offset to land near -18 LUFS-I.
        "autumn": -16.5,
        "winter": -18,
        "endless": -17,
        "boss-taotie": -17,
        "boss-nian": -17,
    }
    for name, loudness in styles.items():
        style = name.removeprefix("boss-")
        score = make_score(style)
        if style in {"spring", "summer"}:
            bed = fit_recording(
                rain_recording,
                len(score),
                18 if style == "spring" else 63,
            )
            score += stereo(bed, -0.08) * (0.009 if style == "spring" else 0.014)
        elif style in {"autumn", "winter"}:
            bed = fit_recording(
                wind_recording,
                len(score),
                34 if style == "autumn" else 79,
            )
            score += stereo(bed, 0.1) * (0.011 if style == "autumn" else 0.008)
        wav_path = TEMP / f"music-{name}.wav"
        write_wav(wav_path, score, -4)
        encode_aac(
            args.ffmpeg,
            wav_path,
            PUBLIC / f"music-{name}.m4a",
            loudness,
            "96k",
            60.0,
        )

    ambience_names = [
        "birds",
        "rain",
        "thunder",
        "insects",
        "water",
        "harvest",
        "wind",
        "frost",
        "snow",
        "bells",
    ]
    for name in ambience_names:
        ambience_signal = make_ambience(name)
        if name in {"birds", "rain", "thunder"}:
            bed = fit_recording(
                rain_recording,
                len(ambience_signal),
                {"birds": 9, "rain": 47, "thunder": 102}[name],
            )
            ambience_signal += stereo(bed, 0) * 0.035
        elif name in {"wind", "frost", "snow"}:
            bed = fit_recording(
                wind_recording,
                len(ambience_signal),
                {"wind": 22, "frost": 54, "snow": 91}[name],
            )
            ambience_signal += stereo(bed, 0) * 0.03
        wav_path = TEMP / f"ambience-{name}.wav"
        write_wav(wav_path, ambience_signal, -7)
        encode_aac(
            args.ffmpeg,
            wav_path,
            PUBLIC / f"ambience-{name}.m4a",
            -22.4 if name == "thunder" else -24,
            "64k",
        )

    weapons = [
        "sword",
        "fan",
        "umbrella",
        "scissors",
        "abacus",
        "crossbow",
        "pipa",
        "inkline",
        "lantern",
        "thunder",
    ]
    for weapon_name in weapons:
        for kind in ["fire", "hit"]:
            for variant in range(1, 4):
                target = PUBLIC / f"weapon-{weapon_name}-{kind}-{variant}.wav"
                write_wav(
                    target,
                    stereo(material_weapon(weapon_name, kind, variant), (variant - 2) * 0.08),
                    -7 if kind == "fire" else -8,
                )

    fusion_materials = [
        ("mistCanopy", "fan", "umbrella"),
        ("thunderCanopy", "umbrella", "thunder"),
        ("inkGaleRule", "fan", "inkline"),
        ("starPiercer", "sword", "crossbow"),
        ("lanternSword", "sword", "lantern"),
        ("swordheartPipa", "sword", "pipa"),
        ("heavenlyLedger", "scissors", "abacus"),
        ("worldTailor", "scissors", "inkline"),
        ("raincutCanopy", "scissors", "umbrella"),
        ("jadePearlCadence", "abacus", "pipa"),
        ("linkedLedgerCase", "abacus", "crossbow"),
        ("lanternBallista", "crossbow", "lantern"),
        ("inklineRepeater", "crossbow", "inkline"),
        ("thunderPipa", "pipa", "thunder"),
        ("myriadLanternCanopy", "umbrella", "lantern"),
        ("galeBamboo", "sword", "fan"),
        ("hiddenSwordCanopy", "sword", "umbrella"),
        ("twinTailorBlades", "sword", "scissors"),
        ("inkRuleSword", "sword", "inkline"),
        ("windRepeater", "fan", "crossbow"),
        ("rainStringCanopy", "umbrella", "pipa"),
        ("windStringPass", "fan", "pipa"),
        ("inkRainBoundary", "umbrella", "inkline"),
        ("stringScissor", "scissors", "pipa"),
        ("shadowScissor", "scissors", "lantern"),
        ("pearlInkLine", "abacus", "inkline"),
        ("countedLantern", "abacus", "lantern"),
        ("pearlThunder", "abacus", "thunder"),
        ("thunderBoltRoad", "crossbow", "thunder"),
        ("inkScore", "pipa", "inkline"),
        ("countedSword", "sword", "abacus"),
        ("markedThunderSword", "sword", "thunder"),
        ("windScissors", "fan", "scissors"),
        ("windAbacus", "fan", "abacus"),
        ("windLantern", "fan", "lantern"),
        ("windThunder", "fan", "thunder"),
        ("beadCanopy", "umbrella", "abacus"),
        ("canopyVolley", "umbrella", "crossbow"),
        ("boltScissors", "scissors", "crossbow"),
        ("thunderScissors", "scissors", "thunder"),
        ("stringCrossbow", "crossbow", "pipa"),
        ("lanternStrings", "pipa", "lantern"),
        ("inkShadow", "inkline", "lantern"),
        ("inkThunderRoad", "inkline", "thunder"),
        ("lanternThunder", "lantern", "thunder"),
    ]
    for index, (fusion_id, first_weapon, second_weapon) in enumerate(
        fusion_materials
    ):
        write_wav(
            PUBLIC / f"fusion-{fusion_id}.wav",
            stereo(
                material_fusion(
                    fusion_id,
                    first_weapon,
                    second_weapon,
                    index,
                ),
                ((index % 5) - 2) * 0.035,
            ),
            -8,
        )

    sfx_names = [
        "fold",
        "unfold",
        "pickup",
        "upgrade",
        "synergy",
        "fusion",
        "ultimate",
        "player-hit",
        "enemy-death",
        "ui-confirm",
        "ui-back",
        "term-change",
        "boss-taotie",
        "boss-nian",
    ]
    for name in sfx_names:
        peak = -4 if name in {"boss-taotie", "boss-nian", "ultimate"} else -7
        write_wav(PUBLIC / f"sfx-{name}.wav", stereo(make_sfx(name), 0), peak)

    for obsolete in [
        *(PUBLIC / f"music-{name}.wav" for name in styles),
        *(PUBLIC / f"ambience-{name}.wav" for name in ambience_names),
        *(
            PUBLIC / f"weapon-{weapon}-{kind}.wav"
            for weapon in weapons
            for kind in ["fire", "hit"]
        ),
    ]:
        if obsolete.exists():
            obsolete.unlink()

    print(
        {
            "music": len(styles),
            "ambience": len(ambience_names),
            "weapon_variants": len(weapons) * 2 * 3,
            "fusion_signatures": len(fusion_materials),
            "sfx": len(sfx_names),
            "sample_rate": SR,
        }
    )


if __name__ == "__main__":
    main()
