"""Original Rivenbloom compositions. Standard-library-only MIDI and score export."""

from pathlib import Path
import json
import math
import random
import struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "score-v1"
PPQ = 960

# The seed-song: D–A–C–B–E–D. Each tuple is pitch, duration in a 3/4 phrase.
THEME = [
    [(74, 1.5), (69, .5), (72, 1)],
    [(71, 1), (76, 1), (74, 1)],
    [(79, 1), (76, .5), (74, .5), (72, 1)],
    [(71, .5), (72, .5), (76, 1), (69, 1)],
    [(77, 1.5), (76, .5), (72, 1)],
    [(74, 1), (71, .5), (67, .5), (64, 1)],
    [(67, 1), (69, .5), (71, .5), (74, 1)],
    [(76, .5), (72, .5), (69, .5), (74, 1.5)],
]
ANSWER = [
    [(81, 1), (79, .5), (76, .5), (77, 1)],
    [(76, 1.5), (74, .5), (72, 1)],
    [(74, .5), (76, .5), (79, 1), (83, 1)],
    [(81, 1), (76, 1), (72, 1)],
    [(77, .5), (76, .5), (74, 1), (69, 1)],
    [(71, 1), (74, .5), (76, .5), (79, 1)],
    [(76, 1), (73, .5), (71, .5), (69, 1)],
    [(72, 1), (69, .5), (64, .5), (62, 1)],
]

# Bass and deliberately spaced inner voices, rather than stacked root-position triads.
CHORDS = {
    "dm": (38, [53, 57, 60, 64]), "g": (43, [55, 59, 62, 64]),
    "c": (36, [52, 55, 59, 62]), "am": (33, [52, 55, 59, 60]),
    "f": (41, [53, 57, 60, 64]), "bb": (34, [53, 57, 62, 65]),
    "em": (40, [55, 58, 62, 65]), "a": (33, [55, 61, 64, 67]),
    "eb": (39, [55, 58, 62, 65]), "gm": (43, [55, 58, 62, 65]),
    "d": (38, [54, 57, 61, 64]), "bm": (35, [54, 57, 61, 66]),
}
HOME = ["dm", "g", "c", "am", "f", "c", "g", "dm"]
JOURNEY = ["f", "c", "g", "am", "bb", "g", "a", "dm"]
DARK = ["dm", "bb", "gm", "a", "dm", "eb", "bb", "a"]


def part(name, program, gain=.7, pan=0, reverb=20, percussion=False):
    return dict(name=name, program=program, gain=gain, pan=pan,
                reverb=reverb, percussion=percussion, notes=[])


def note(track, beat, pitch, duration, velocity, rng, total):
    # Small timing and touch differences; the written rhythm remains intact.
    beat = max(0, beat + rng.uniform(-.012, .012))
    duration = min(duration, total - beat - .012)
    if duration <= 0:
        return
    track["notes"].append(dict(beat=round(beat, 5), pitch=int(pitch),
        duration=round(duration, 5), velocity=max(12, min(110, int(velocity + rng.uniform(-4, 4))))))


def melody(track, start_bar, phrase, bar_beats, rng, total, velocity=66,
           transpose=0, transform=None, spacious=False):
    for bar, notes in enumerate(phrase):
        at = (start_bar + bar) * bar_beats
        for index, (pitch, length) in enumerate(notes):
            duration = length * bar_beats / 3
            actual = transform(pitch) if transform else pitch
            if not spacious or index == 0 or (bar % 2 == 1 and index == len(notes) - 1):
                note(track, at, actual + transpose, duration * .84,
                     velocity + (3 if index == 0 else -2), rng, total)
            at += duration


def midi_vlq(number):
    result = [number & 127]
    while number >> 7:
        number >>= 7
        result.insert(0, (number & 127) | 128)
    return bytes(result)


def midi_chunk(events, end):
    events.sort(key=lambda event: (event[0], event[1]))
    data = bytearray()
    last = 0
    for tick, _, message in events:
        data.extend(midi_vlq(tick - last))
        data.extend(message)
        last = tick
    data.extend(midi_vlq(max(0, end - last)) + b"\xff\x2f\x00")
    return b"MTrk" + struct.pack(">I", len(data)) + data


def meta(kind, value):
    return b"\xff" + bytes([kind]) + midi_vlq(len(value)) + value


def export_midi(score, path):
    end = round(score["beats"] * PPQ)
    tempo = round(60_000_000 / score["bpm"])
    num, den = score["meter"]
    conductor = [
        (0, 0, meta(3, score["title"].encode())),
        (0, 1, meta(81, tempo.to_bytes(3, "big"))),
        (0, 2, meta(88, bytes([num, int(math.log2(den)), 24, 8]))),
        (0, 3, meta(1, b"Original Rivenbloom composition; created with Codex, 2026-09-23")),
    ]
    for section in score["sections"]:
        conductor.append((round(section["bar"] * score["barBeats"] * PPQ), 4,
                          meta(6, section["label"].encode())))
    chunks = [midi_chunk(conductor, end)]
    channels = iter([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15])
    for track in score["tracks"]:
        channel = 9 if track["percussion"] else next(channels)
        events = [(0, 0, meta(3, track["name"].encode())),
                  (0, 1, bytes([0xC0 | channel, track["program"]])),
                  (0, 2, bytes([0xB0 | channel, 7, min(127, round(track["gain"] * 100))])),
                  (0, 3, bytes([0xB0 | channel, 10, round((track["pan"] + 1) * 63.5)])),
                  (0, 4, bytes([0xB0 | channel, 91, round(track["reverb"] * 1.27)]))]
        for n in track["notes"]:
            events.append((round(n["beat"] * PPQ), 10,
                           bytes([0x90 | channel, n["pitch"], n["velocity"]])))
            events.append((round((n["beat"] + n["duration"]) * PPQ), 9,
                           bytes([0x80 | channel, n["pitch"], 0])))
        chunks.append(midi_chunk(events, end))
    path.write_bytes(b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), PPQ) + b"".join(chunks))


def compose(cue):
    rng = random.Random(cue["id"])
    style = cue["style"]
    bars, bpm, b = cue["bars"], cue["bpm"], cue["barBeats"]
    total = bars * b
    battle = style in ("sentinel", "verse", "refrain")
    quiet = style in ("cave", "threshold")
    tracks = {
        "lead": part("Seed melody", cue["lead"], .84, -.12, 25 if quiet else 16),
        "harp": part("Woven plucks", 46 if style != "archive" else 15, .72, -.36, 20),
        "strings": part("Inner strings", 48 if battle else 44, .38, .25, 28),
        "cello": part("Root cello", 42, .68, -.06, 16),
        "bells": part("Copper and glass", 14 if battle else 8, .43, .38, 32),
        "answer": part("Answering voice", 60 if battle else 71, .55, .22, 22),
    }
    if battle or style == "wood":
        tracks["pulse"] = part("Moving strings", 45, .72, -.25, 10)
        tracks["drums"] = part("Earth percussion", 0, .55, .03, 12, True)
    if style in ("verse", "refrain", "threshold"):
        tracks["choir"] = part("Wordless resonance", 52, .25, 0, 34)
    sections = []
    for bar in range(bars):
        block, step = divmod(bar, 8)
        if step == 0:
            labels = ["Opening", "Seed-song", "Answer", "Changed light", "Return", "Last turn", "Afterimage", "Homeward"]
            sections.append(dict(bar=bar, label=labels[block]))
        if style in ("verse", "refrain", "threshold", "sentinel"):
            progression = DARK if block % 3 != 2 else ["bb", "gm", "dm", "a", "eb", "bb", "a", "dm"]
        elif style == "release":
            progression = ["d", "g", "bm", "g", "d", "g", "a", "d"]
        else:
            progression = HOME if block % 3 != 2 else JOURNEY
        # A settled final harmony makes the next loop entrance musically natural.
        harmony = ("d" if style == "release" else "dm") if bar >= bars - 2 else progression[step]
        bass, voices = CHORDS[harmony]
        section_gain = [.72, .9, 1.0, .82, .94, .76, .88, .78][block]
        if quiet:
            section_gain *= .8
        if style == "refrain":
            section_gain = [.8, .94, 1.0, .84, 1.0, .9][block]
        at = bar * b
        v = lambda n: n * section_gain
        if not quiet or bar % 2 == 0:
            note(tracks["cello"], at, bass + 12, b * (1.65 if quiet else .88), v(53), rng, total)
        if battle and bar % 2 == 1:
            note(tracks["cello"], at + b * .5, bass + 19, b * .4, v(49), rng, total)
        if style != "threshold" or bar % 4 == 0:
            for i, pitch in enumerate(voices[:3]):
                if block == 0 and i == 1:
                    continue
                note(tracks["strings"], at + .03 * i, pitch,
                     b * (1.6 if quiet else .92), v(37 if quiet else 46), rng, total)
        # Three distinct accompaniment vocabularies: folk lilt, submerged gears, combat pulse.
        if style not in ("threshold", "cave"):
            if style == "archive":
                pattern = [(0, 0), (.75, 2), (1.5, 1), (2.5, 3), (3.25, 2), (4, 1), (4.5, 2)]
            elif battle:
                pattern = [(0, 0), (b / 2, 2)]
            else:
                pattern = [(i * .5, [0, 2, 1, 3, 2, 1, 3, 2][i % 8]) for i in range(round(b * 2))]
            for j, (offset, index) in enumerate(pattern):
                if block == 0 and bar < 4 and j % 2 == 1:
                    continue
                note(tracks["harp"], at + offset, voices[index] + 12,
                     .7 if battle else 1.05, v(49 if j % 3 == 0 else 39), rng, total)
        elif bar % 2 == 0:
            for j, index in enumerate([0, 2, 3]):
                note(tracks["harp"], at + j * .75, voices[index] + 12, 1.6, v(39), rng, total)
        if bar % (4 if quiet else 8) == 0:
            note(tracks["bells"], at + (b * .5 if quiet else 0),
                 voices[2] + (24 if quiet else 12), 2.8, v(38 if quiet else 44), rng, total)
        if "choir" in tracks and (block > 0 or style == "threshold") and bar % 2 == 0:
            for pitch in (voices[0] + 12, voices[2] + 12):
                note(tracks["choir"], at + .08, pitch, b * 1.75, v(38), rng, total)
        if "pulse" in tracks and (bar >= 4 or battle):
            subdivision = .25 if style == "refrain" and step >= 4 else .5
            count = round(b / subdivision)
            order = [0, 2, 1, 2, 3, 2, 1, 2]
            for k in range(count):
                pitch = voices[order[k % 8]] + (12 if style == "wood" else 0)
                note(tracks["pulse"], at + k * subdivision, pitch,
                     subdivision * .62, v(54 if k % 3 == 0 else 42), rng, total)
            drum = tracks["drums"]
            if style == "wood":
                hits = [(0, 64, 36), (1.5, 62, 30), (2.5, 69, 25)]
            elif style == "verse":
                hits = [(0, 36, 66), (1, 41, 45), (2, 45, 48), (2.5, 37, 34)]
            else:
                hits = [(0, 36, 71), (1, 41, 49), (1.5, 36, 47), (2, 43, 57), (3, 45, 49), (3.5, 37, 40)]
            for offset, pitch, velocity in hits:
                if offset < b:
                    note(drum, at + offset, pitch, .18, v(velocity), rng, total)
            if battle and step == 7:
                for k, pitch in enumerate([45, 43, 41, 36]):
                    note(drum, at + b - 1 + k * .25, pitch, .16, v(43 + k * 5), rng, total)
    # Melodies are authored phrases; the arrangement decides where to leave silence.
    def damaged(pitch):
        return pitch - (1 if pitch % 12 in (9, 11, 4) else 0)

    def restored(pitch):
        return pitch + (1 if pitch % 12 in (0, 5) else 0)

    for block in range(bars // 8):
        start = block * 8
        phrase = ANSWER if block % 3 == 2 else THEME
        if style == "threshold":
            melody(tracks["lead"], start, THEME[:4], b * 2, rng, total,
                   velocity=41, transpose=-12, transform=damaged, spacious=True)
            # The second block is intentionally only instrumental resonance.
            break
        if style == "cave":
            if block % 2 == 0:
                melody(tracks["lead"], start, phrase, b, rng, total, 48, -12, spacious=True)
            else:
                melody(tracks["bells"], start, ANSWER, b, rng, total, 40, spacious=True)
            continue
        if style == "archive":
            melody(tracks["lead"], start, phrase, b, rng, total, 53, -12,
                   spacious=block % 2 == 0)
            if block == 2:
                melody(tracks["answer"], start, THEME[4:], b, rng, total, 40)
            continue
        if style == "title" and block == 0:
            melody(tracks["harp"], start, THEME, b, rng, total, 68)
        elif style == "release":
            melody(tracks["cello"] if block == 0 else tracks["lead"], start,
                   phrase, b, rng, total, 58, -12 if block == 0 else 0, restored)
        else:
            melody(tracks["lead"], start, phrase, b, rng, total,
                   76 if battle else 65, -12 if style == "verse" else 0,
                   damaged if style in ("verse", "refrain", "sentinel") else None,
                   spacious=style == "wood" and block % 3 == 0)
        if block % 3 == 2 and style not in ("release", "archive"):
            # A lower, slower response appears only in the contrasting section.
            for j, pitch in enumerate([62, 65, 67, 69]):
                note(tracks["answer"], (start + j * 2) * b + b * .5,
                     pitch, b * 1.25, 48 if battle else 43, rng, total)
    if style == "release":
        # A genuine cadence and tail, rather than fading an unresolved loop.
        for track in tracks.values():
            track["notes"] = [n for n in track["notes"] if n["beat"] < total - b * 2]
            for n in track["notes"]:
                n["duration"] = min(n["duration"], total - b * 2 - n["beat"])
        for pitch in (50, 57, 62, 66, 69, 76):
            note(tracks["harp"], total - b * 2 + (pitch - 50) * .016,
                 pitch, b * 1.65, 47, rng, total)
        note(tracks["cello"], total - b * 2, 50, b * 1.7, 45, rng, total)
    score = {**cue, "beats": total, "loop": style != "release", "sections": sections,
             "tracks": [track for track in tracks.values() if track["notes"]]}
    for track in score["tracks"]:
        track["notes"].sort(key=lambda n: (n["beat"], n["pitch"]))
        # Never overlap the same note on one MIDI channel: a note-off would cut its successor.
        last = {}
        for n in track["notes"]:
            previous = last.get(n["pitch"])
            if previous and previous["beat"] + previous["duration"] >= n["beat"]:
                previous["duration"] = round(max(.001, n["beat"] - previous["beat"] - .005), 5)
            last[n["pitch"]] = n
    return score


CUES = [
    ("01-a-thread-of-amber", "A Thread of Amber", "Title screen", "title", 32, 72, 4, (4, 4), 73,
     "Harp opens the seed-song; woodwind and strings answer with quiet curiosity."),
    ("02-lanterns-above-the-rain", "Lanterns Above the Rain", "Wren’s Rest", "village", 48, 84, 3, (3, 4), 73,
     "A gentle village waltz: warm harp, flute, cello, and small pools of light."),
    ("03-the-listening-wood", "The Listening Wood", "Brackenreach", "wood", 64, 104, 3, (6, 8), 73,
     "A swaying exploration theme with plucked strings and restrained hand percussion."),
    ("04-what-the-roots-remember", "What the Roots Remember", "Singing Hollows", "cave", 32, 64, 4, (4, 4), 11,
     "Spacious mallet phrases, glass-like celesta, bowed textures, and long silences."),
    ("05-an-archive-under-water", "An Archive Under Water", "Rootglass Reliquary", "archive", 32, 88, 5, (5, 4), 71,
     "A five-beat mechanical pattern beneath low clarinet and suspended strings."),
    ("06-copper-and-briar", "Copper and Briar", "Thorn Sentinel", "sentinel", 32, 132, 4, (4, 4), 60,
     "A compact guardian battle with horn, plucked strings, and dry low percussion."),
    ("07-the-unanswered-note", "The Unanswered Note", "Hollow Choir approach", "threshold", 16, 58, 4, (4, 4), 71,
     "The familiar song slows and fractures among distant bells and wordless resonance."),
    ("08-first-verse-of-the-hollow", "First Verse of the Hollow", "Pallid Cantor · phase one", "verse", 48, 100, 3, (3, 4), 60,
     "A stately, threatening three-beat ritual: low horn, strings, chimes, and choir patch."),
    ("09-the-throat-of-glass", "The Throat of Glass", "Pallid Cantor · phase two", "refrain", 48, 144, 4, (4, 4), 48,
     "The broken seed-song rises over accelerating string figures and earth percussion."),
    ("10-the-song-released", "The Song Released", "Victory / return", "release", 24, 72, 4, (4, 4), 73,
     "Solo cello restores the theme; a warm major-colour cadence closes the journey."),
]


def main():
    (OUT / "midi").mkdir(parents=True, exist_ok=True)
    (OUT / "scores").mkdir(exist_ok=True)
    manifest = []
    keys = ("id", "title", "area", "style", "bars", "bpm", "barBeats", "meter", "lead", "description")
    for row in CUES:
        score = compose(dict(zip(keys, row)))
        (OUT / "scores" / f'{score["id"]}.json').write_text(json.dumps(score, indent=2) + "\n")
        export_midi(score, OUT / "midi" / f'{score["id"]}.mid')
        manifest.append({key: value for key, value in score.items() if key != "tracks"})
        print(f'{score["title"]}: {sum(len(p["notes"]) for p in score["tracks"])} notes')
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
