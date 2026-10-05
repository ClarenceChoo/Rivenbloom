"""Render, level, and package the original soundtrack for Phaser and audition."""

import json
import math
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SCORES = ROOT / "music/score-v1"
GAME = ROOT / "public/assets/audio/rivenbloom"
RENDERER = Path("/tmp/rivenbloom-score-work/render-score")
RATE = 48_000


def run(*args):
    completed = subprocess.run(args, capture_output=True, text=True)
    if completed.returncode:
        raise RuntimeError(f"{' '.join(args[:2])} failed: {completed.stderr[-2000:]}")
    return completed


def measure(path):
    completed = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                    "-filter_complex", "ebur128=peak=true", "-f", "null", "-")
    summary = completed.stderr.rsplit("Summary:", 1)[-1]
    integrated = float(re.search(r"I:\s*([-\d.]+) LUFS", summary).group(1))
    peaks = [float(x) for x in re.findall(r"Peak:\s*([-\d.]+) dBFS", summary)]
    return integrated, max(peaks)


def read_samples(path):
    process = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path),
        "-f", "f32le", "-ac", "2", "-ar", str(RATE), "-"], check=True,
        capture_output=True)
    return np.frombuffer(process.stdout, dtype="<f4").copy().reshape(-1, 2)


def smooth_seam(audio):
    count = 480  # Ten milliseconds, without changing the exact musical loop length.
    midpoint = (audio[0].copy() + audio[-1].copy()) * .5
    ramp = np.linspace(0, 1, count, dtype=np.float32)[:, None]
    audio[:count] = midpoint * (1 - ramp) + audio[:count] * ramp
    audio[-count:] = audio[-count:] * (1 - ramp) + midpoint * ramp


def encode(raw, destination):
    options = ["-c:a", "libmp3lame", "-q:a", "2"]
    run("ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(RATE),
        "-i", str(raw), *options, str(destination))


def main():
    GAME.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((SCORES / "manifest.json").read_text())
    with tempfile.TemporaryDirectory(prefix="rivenbloom-music-") as temp:
        temporary = Path(temp)
        for cue in manifest:
            identifier = cue["id"]
            raw_wav = temporary / "render.wav"
            run(str(RENDERER), str(SCORES / "scores" / f"{identifier}.json"), str(raw_wav))
            integrated, peak = measure(raw_wav)
            if not math.isfinite(integrated) or not math.isfinite(peak):
                raise ValueError(f"Silent or invalid audio: {identifier}")
            target = -22 if cue["style"] in ("cave", "threshold") else -17 if cue["style"] in (
                "sentinel", "verse", "refrain") else -19
            gain_db = min(target - integrated, -1.5 - peak)
            audio = read_samples(raw_wav)
            audio *= 10 ** (gain_db / 20)
            if cue["loop"]:
                smooth_seam(audio)
            if not np.isfinite(audio).all() or np.max(np.abs(audio)) > 1:
                raise ValueError(f"Invalid or clipped audio: {identifier}")
            pcm = temporary / "leveled.raw"
            audio.astype("<f4").tofile(pcm)
            encode(pcm, GAME / f"{identifier}.mp3")
            cue["seconds"] = round(len(audio) / RATE, 3)
            cue["integratedLufs"] = round(integrated + gain_db, 1)
            cue["peakDbfs"] = round(20 * math.log10(max(np.max(np.abs(audio)), 1e-9)), 1)
            print(f'{identifier}: {cue["seconds"]:.1f}s, {cue["integratedLufs"]:.1f} LUFS')
    (SCORES / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
