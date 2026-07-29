#!/usr/bin/env python3
"""Validate v4 audio duration, mix targets, variants and loop seams."""

from __future__ import annotations

import argparse
import math
import re
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile


ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public" / "audio"
SR = 32_000


def decode(ffmpeg: Path, path: Path) -> np.ndarray:
    result = subprocess.run(
        [
            str(ffmpeg),
            "-v",
            "error",
            "-i",
            str(path),
            "-f",
            "f32le",
            "-ac",
            "2",
            "-ar",
            str(SR),
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    )
    return np.frombuffer(result.stdout, dtype=np.float32).reshape(-1, 2)


def ebu(ffmpeg: Path, path: Path) -> tuple[float, float]:
    result = subprocess.run(
        [
            str(ffmpeg),
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-filter_complex",
            "ebur128=peak=true",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    output = result.stderr
    integrated = re.findall(r"I:\s+(-?\d+(?:\.\d+)?) LUFS", output)
    peaks = re.findall(r"Peak:\s+(-?\d+(?:\.\d+)?) dBFS", output)
    if not integrated or not peaks:
        raise RuntimeError(f"unable to parse ebur128 summary for {path.name}")
    return float(integrated[-1]), float(peaks[-1])


def db(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", type=Path, required=True)
    args = parser.parse_args()
    failures: list[str] = []
    report: dict[str, object] = {}

    music_targets = {
        "spring": -18,
        "summer": -18,
        "autumn": -18,
        "winter": -18,
        "endless": -17,
        "boss-taotie": -17,
        "boss-nian": -17,
    }
    music_report: dict[str, object] = {}
    for name, target in music_targets.items():
        path = AUDIO / f"music-{name}.m4a"
        audio = decode(args.ffmpeg, path)
        duration = len(audio) / SR
        loudness, true_peak = ebu(args.ffmpeg, path)
        seam = db(float(np.max(np.abs(audio[0] - audio[-1]))))
        music_report[name] = {
            "duration": round(duration, 3),
            "lufs": loudness,
            "truePeakDbtp": true_peak,
            "seamDbfs": round(seam, 2),
        }
        if not 48 <= duration <= 64:
            failures.append(f"{path.name}: duration {duration:.2f}s outside 48–64s")
        if abs(loudness - target) > 0.8:
            failures.append(
                f"{path.name}: {loudness:.1f} LUFS, target {target}±0.8"
            )
        if true_peak > -1.5:
            failures.append(f"{path.name}: true peak {true_peak:.1f} dBTP")
        if seam > -60:
            failures.append(f"{path.name}: seam {seam:.1f} dBFS")
    report["music"] = music_report

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
    ambience_report: dict[str, object] = {}
    for name in ambience_names:
        path = AUDIO / f"ambience-{name}.m4a"
        audio = decode(args.ffmpeg, path)
        loudness, true_peak = ebu(args.ffmpeg, path)
        ambience_report[name] = {
            "duration": round(len(audio) / SR, 3),
            "lufs": loudness,
            "truePeakDbtp": true_peak,
        }
        if abs(loudness - (-24)) > 1.0:
            failures.append(f"{path.name}: {loudness:.1f} LUFS, target -24±1")
        if true_peak > -1.5:
            failures.append(f"{path.name}: true peak {true_peak:.1f} dBTP")
    report["ambience"] = ambience_report

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
    variant_count = 0
    for weapon in weapons:
        for kind in ["fire", "hit"]:
            variants: list[np.ndarray] = []
            for variant in range(1, 4):
                path = AUDIO / f"weapon-{weapon}-{kind}-{variant}.wav"
                sample_rate, audio = wavfile.read(path)
                if sample_rate != SR:
                    failures.append(f"{path.name}: sample rate {sample_rate}")
                normalized = audio.astype(np.float64) / 32768
                variants.append(normalized)
                variant_count += 1
                if np.max(np.abs(normalized)) > 10 ** (-2.8 / 20):
                    failures.append(f"{path.name}: peak exceeds -2.8 dBFS")
            shortest = min(map(len, variants))
            if np.allclose(
                variants[0][:shortest],
                variants[1][:shortest],
                atol=1e-5,
            ):
                failures.append(f"{weapon}-{kind}: variants are identical")
    report["weaponVariants"] = variant_count

    fusion_ids = {
        "mistCanopy",
        "thunderCanopy",
        "inkGaleRule",
        "starPiercer",
        "lanternSword",
        "swordheartPipa",
        "heavenlyLedger",
        "worldTailor",
        "raincutCanopy",
        "jadePearlCadence",
        "linkedLedgerCase",
        "lanternBallista",
        "inklineRepeater",
        "thunderPipa",
        "myriadLanternCanopy",
        "galeBamboo",
        "hiddenSwordCanopy",
        "twinTailorBlades",
        "inkRuleSword",
        "windRepeater",
        "rainStringCanopy",
        "windStringPass",
        "inkRainBoundary",
        "stringScissor",
        "shadowScissor",
        "pearlInkLine",
        "countedLantern",
        "pearlThunder",
        "thunderBoltRoad",
        "inkScore",
    }
    actual_fusions = {
        path.stem.removeprefix("fusion-")
        for path in AUDIO.glob("fusion-*.wav")
    }
    if actual_fusions != fusion_ids:
        failures.append(
            "Fusion audio mismatch: "
            f"missing={sorted(fusion_ids - actual_fusions)}, "
            f"extra={sorted(actual_fusions - fusion_ids)}"
        )
    fusion_samples: list[bytes] = []
    for fusion_id in sorted(actual_fusions):
        path = AUDIO / f"fusion-{fusion_id}.wav"
        sample_rate, audio = wavfile.read(path)
        if sample_rate != SR:
            failures.append(f"{path.name}: sample rate {sample_rate}")
        if np.max(np.abs(audio.astype(np.float64) / 32768)) > 10 ** (-3.0 / 20):
            failures.append(f"{path.name}: peak exceeds -3 dBFS")
        fusion_samples.append(audio.tobytes())
    if len(set(fusion_samples)) != len(fusion_samples):
        failures.append("fusion attack signatures are not all independent")
    report["fusionSignatures"] = len(actual_fusions)

    expected_sfx = {
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
    }
    actual_sfx = {
        path.stem.removeprefix("sfx-")
        for path in AUDIO.glob("sfx-*.wav")
    }
    if actual_sfx != expected_sfx:
        failures.append(
            f"SFX set mismatch: missing={sorted(expected_sfx - actual_sfx)}, "
            f"extra={sorted(actual_sfx - expected_sfx)}"
        )

    legacy = [
        *AUDIO.glob("music-*.wav"),
        *AUDIO.glob("ambience-*.wav"),
        *(
            path
            for path in AUDIO.glob("weapon-*.wav")
            if not re.search(r"-[123]\.wav$", path.name)
        ),
    ]
    if legacy:
        failures.append(
            "legacy audio remains: " + ", ".join(path.name for path in legacy)
        )

    shipped = [
        *AUDIO.glob("*.m4a"),
        *AUDIO.glob("*.wav"),
    ]
    total_bytes = sum(path.stat().st_size for path in shipped)
    report["shippedFiles"] = len(shipped)
    report["totalMiB"] = round(total_bytes / 1024 / 1024, 2)
    report["failures"] = failures
    print(report)
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
