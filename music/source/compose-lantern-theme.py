"""Compose and render the original Lanterns theme and its combat variation."""

import json
import math
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SCORES = ROOT / "music/score-v2"
GAME = ROOT / "public/assets/audio/rivenbloom"
RENDERER = Path("/tmp/rivenbloom-music-v2/render-score")
RATE = 48_000
GARAGE = Path("/Library/Application Support/GarageBand/Instrument Library/Sampler")
INSTRUMENTS = {
    "flute": sorted((GARAGE / "Sampler Files/Flute Solo/Flute_LV_na_sus_mf").glob("*.wav")),
    "strings": [Path("/Library/Application Support/Logic/Sampler Instruments/09 Orchestral/09 Strings/String Ensemble.exs")],
}

HARMONY = [
    (38, [50, 57, 64, 65]),
    (40, [52, 55, 62, 64]),
    (41, [53, 57, 60, 64]),
    (43, [55, 59, 62, 69]),
    (45, [50, 57, 62, 65]),
    (45, [52, 57, 60, 67]),
    (43, [50, 55, 59, 64]),
    (45, [52, 57, 61, 67]),
]

THEME = [
    [(0, 74, .9), (1, 81, .8), (2, 84, 1.25), (3.4, 83, .65)],
    [(0, 79, 1.4), (1.6, 76, .8), (2.6, 74, 1.2)],
    [(0, 77, 1.3), (1.5, 81, .8), (2.5, 79, 1.1)],
    [(0, 76, 1.9), (2.25, 74, 1.3)],
    [(0, 74, .7), (.85, 76, .6), (1.6, 77, 1.1), (2.85, 81, .9)],
    [(0, 79, 1.2), (1.5, 76, .7), (2.5, 72, 1.2)],
    [(0, 74, 1.15), (1.4, 71, .6), (2.2, 69, 1.1)],
    [(0, 73, .75), (1, 76, 1), (2.4, 81, 1.1)],
]

ANSWER = [
    [(0, 69, 1.25), (1.6, 74, 1.8)],
    [(0, 72, 1.2), (1.5, 71, .8), (2.65, 67, 1)],
    [(0, 69, .7), (1, 72, .7), (2, 76, 1.5)],
    [(0, 74, 1.4), (1.75, 71, 1.7)],
    [(0, 69, 1.3), (1.7, 65, .8), (2.8, 64, .8)],
    [(0, 67, 1.4), (1.8, 72, 1.5)],
    [(0, 71, 1.1), (1.4, 74, .75), (2.55, 76, .9)],
    [(0, 73, 1.2), (1.7, 69, 1.5)],
]


def part(name, instrument, gain, pan, reverb, program=0, percussion=False):
    result = dict(name=name, program=program, percussion=percussion,
                  gain=gain, pan=pan, reverb=reverb, notes=[], expression=[])
    if instrument is not None:
        result["instrumentFiles"] = [str(sample) for sample in INSTRUMENTS[instrument]]
        result["sampleGainDb"] = 10 if instrument == "flute" else 12
    return result


def add(track, beat, pitch, duration, velocity, beats=128):
    start = max(0, beat)
    length = min(duration, beats - start - .025)
    if length > 0:
        track["notes"].append(dict(beat=round(start, 4), pitch=pitch,
                                  duration=round(length, 4), velocity=velocity))


def compose(combat):
    flute = part("wayfinder-flute", "flute", .42, -.12, 16)
    upper = part("lantern-strings", "strings", .18, .24, 18)
    lower = part("root-strings", "strings", .23, -.18, 12)
    plucks = dict(notes=[])
    drums = part("earth-percussion", None, .28 if combat else .12, .05, 8,
                 percussion=True)
    tracks = [flute, upper, lower, drums]
    chimes = []
    section = [(.70, .88, .74, .56), (.90, .72, 1.0, .70)][combat]
    for bar in range(32):
        chord_index = bar % 8
        bass, chord = HARMONY[chord_index]
        if bar >= 28:
            bass, chord = [(38, [50, 57, 64, 65]), (43, [50, 55, 59, 64]),
                           (45, [52, 57, 61, 67]), (38, [50, 57, 62, 65])][bar - 28]
        start = bar * 4
        strength = section[bar // 8]
        add(lower, start + .014, bass, 3.75, round(60 + strength * 16))
        if combat:
            add(lower, start + 2.1, bass + 12, 1.5, 66)
        for voice, pitch in enumerate(chord):
            add(upper, start + .045 + voice * .009, pitch + 12, 3.7,
                round(48 + strength * 19) - voice)
        positions = [0, 1.45, 2.5] if not combat else [0, .75, 1.5, 2.5, 3.25]
        if bar >= 28:
            positions = [0, 2.4]
        for index, offset in enumerate(positions):
            pitch = chord[(index + bar) % len(chord)] + 12
            add(plucks, start + offset + .016, pitch, .75 if combat else 1.25,
                [66, 50, 58, 53, 60][index])
        if 4 <= bar < 12 or 20 <= bar < 28:
            phrase = THEME[chord_index]
            for index, (offset, pitch, duration) in enumerate(phrase):
                accent = [74, 67, 78, 60][index % 4]
                add(flute, start + offset + .022, pitch, duration + .06,
                    accent + (4 if 20 <= bar < 28 else 0))
        elif 12 <= bar < 20:
            for index, (offset, pitch, duration) in enumerate(ANSWER[chord_index]):
                add(flute, start + offset + .025, pitch, duration,
                    [68, 74, 62][index % 3])
        elif bar in [1, 3, 29, 31]:
            add(flute, start + .6, [74, 76, 74, 74][[1, 3, 29, 31].index(bar)],
                2.35, 61)
        if combat and bar < 28:
            rhythm = [(0, 36, 82), (1.5, 43, 56), (2.75, 41, 66)]
            if bar % 2:
                rhythm = [(0, 36, 72), (.75, 45, 54), (2, 43, 70), (3.5, 41, 50)]
            if 20 <= bar < 28:
                rhythm += [(1, 42, 37), (3, 42, 42)]
            if bar % 8 == 7:
                rhythm += [(3.25, 45, 54), (3.75, 43, 67)]
            for offset, pitch, velocity in rhythm:
                add(drums, start + offset, pitch, .22, velocity)
        elif bar in [8, 12, 20, 24]:
            add(drums, start, 41, .35, 50)
        if bar in [0, 4, 11, 16, 20, 27, 31]:
            chimes.append(dict(beat=start + .2, pitch=chord[-1] + 24,
                               gain=.018 if combat else .026))
        for tick in range(16):
            beat = start + tick * .25
            breath = math.sin(math.pi * (tick / 16))
            phrase_swell = math.sin(math.pi * (bar % 4 + tick / 16) / 4)
            values = [70 + 30 * breath, 61 + 35 * strength + 10 * phrase_swell,
                      82 + 18 * phrase_swell, 105]
            for track, value in zip(tracks, values):
                track["expression"].append(dict(beat=beat, value=min(127, round(value))))
    return dict(id="12-a-voice-through-glass" if combat else "11-where-the-lanterns-wake",
                title="A Voice Through Glass" if combat else "Where the Lanterns Wake",
                bpm=126 if combat else 92, beats=128, loop=True,
                tracks=tracks, chimes=chimes, plucks=plucks["notes"])


def run(*args):
    return subprocess.run(args, check=True, capture_output=True)


def decode(path):
    return np.frombuffer(run("ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
                             "-ac", "2", "-ar", str(RATE), "-").stdout,
                         dtype="<f4").copy().reshape(-1, 2)


def measure(path):
    report = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                 "-af", "ebur128=peak=true", "-f", "null", "-").stderr.decode()
    summary = report.rsplit("Summary:", 1)[-1]
    return float(re.search(r"I:\s*([-\d.]+) LUFS", summary)[1]), float(
        re.search(r"Peak:\s*([-\d.]+) dBFS", summary)[1])


def render(score, work):
    score_path = SCORES / f'{score["id"]}.json'
    score_path.write_text(json.dumps(score, indent=2) + "\n")
    raw = work / f'{score["id"]}.wav'
    run(str(RENDERER), str(score_path), str(raw))
    audio = decode(raw)
    part_loudness = {}
    for track in score["tracks"]:
        if "instrumentFiles" in track:
            solo = work / "solo.wav"
            run(str(RENDERER), str(score_path), str(solo), track["name"])
            level, _ = measure(solo)
            if not math.isfinite(level) or level < -65:
                raise ValueError(f'Silent instrument part: {track["name"]}')
            part_loudness[track["name"]] = level
    for note in score["plucks"]:
        time = np.arange(round(2.8 * RATE)) / RATE
        frequency = 440 * 2 ** ((note["pitch"] - 69) / 12)
        signal = np.zeros(len(time))
        for harmonic in range(1, 22):
            signal += np.cos(2 * np.pi * frequency * harmonic * time) / harmonic ** 1.65 * np.exp(
                -time * (1.2 + harmonic * .48))
        signal *= np.minimum(time / .004, 1) * .052 * note["velocity"] / 70
        offset = round(note["beat"] * 60 / score["bpm"] * RATE)
        indices = (offset + np.arange(len(signal))) % len(audio)
        audio[indices, 0] += signal
        audio[indices, 1] += signal * .68
    for note in score["chimes"]:
        seconds = 3.5
        time = np.arange(round(seconds * RATE)) / RATE
        frequency = 440 * 2 ** ((note["pitch"] - 69) / 12)
        signal = np.zeros(len(time))
        for ratio, gain, decay in [(1, 1, 1.5), (2.01, .28, .9), (4.13, .10, .4)]:
            signal += gain * np.sin(2 * np.pi * frequency * ratio * time) * np.exp(-time / decay)
        signal *= np.minimum(time / .012, 1) * note["gain"]
        offset = round(note["beat"] * 60 / score["bpm"] * RATE)
        indices = (offset + np.arange(len(signal))) % len(audio)
        audio[indices, 0] += signal * .82
        audio[indices, 1] += signal
    pcm = work / "mix.raw"
    audio.astype("<f4").tofile(pcm)
    equalized = work / "equalized.wav"
    run("ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", "2",
        "-i", str(pcm), "-af", "highpass=f=38,equalizer=f=280:t=q:w=0.8:g=-1.8,lowpass=f=12500",
        "-c:a", "pcm_f32le", str(equalized))
    loudness, peak = measure(equalized)
    gain = min((-17.5 if score["bpm"] == 126 else -20) - loudness, -2.5 - peak)
    audio = decode(equalized) * 10 ** (gain / 20)
    seam = round(.005 * RATE)
    midpoint = (audio[0] + audio[-1]) * .5
    ramp = np.linspace(0, 1, seam)[:, None]
    audio[:seam] = midpoint * (1 - ramp) + audio[:seam] * ramp
    audio[-seam:] = audio[-seam:] * (1 - ramp) + midpoint * ramp
    if not np.isfinite(audio).all() or np.max(np.abs(audio)) >= 1:
        raise ValueError("Invalid or clipped music export")
    audio.astype("<f4").tofile(pcm)
    output = GAME / f'{score["id"]}.mp3'
    run("ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", "2",
        "-i", str(pcm), "-c:a", "libmp3lame", "-q:a", "2", str(output))
    measured_loudness, measured_peak = measure(output)
    decoded = decode(output)
    if abs(len(decoded) - len(audio)) > 1:
        raise ValueError("MP3 gapless decoding changed the musical loop length")
    report = dict(id=score["id"], title=score["title"], bpm=score["bpm"], bars=32,
                  seconds=round(len(decoded) / RATE, 4), integratedLufs=measured_loudness,
                  truePeakDbfs=measured_peak,
                  seamJump=float(np.max(np.abs(decoded[0] - decoded[-1]))),
                  notes=sum(len(track["notes"]) for track in score["tracks"]),
                  expressionPoints=sum(len(track["expression"]) for track in score["tracks"]))
    report["nativePartLufs"] = part_loudness
    print(json.dumps(report), flush=True)
    return report


def main():
    SCORES.mkdir(parents=True, exist_ok=True)
    GAME.mkdir(parents=True, exist_ok=True)
    for name, samples in INSTRUMENTS.items():
        if not samples or any(not sample.is_file() for sample in samples):
            raise FileNotFoundError(f"Install the GarageBand instrument library for {name}")
    with tempfile.TemporaryDirectory(prefix="rivenbloom-lanterns-") as temp:
        reports = [render(compose(combat), Path(temp)) for combat in [False, True]]
    (SCORES / "manifest.json").write_text(json.dumps(reports, indent=2) + "\n")


if __name__ == "__main__":
    main()
