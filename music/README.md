# Rivenbloom score

The title and Brackenreach use `11-where-the-lanterns-wake.mp3`. The Pallid Cantor's
second phase uses its combat variation, `12-a-voice-through-glass.mp3`. Both cues
have an original flute theme, sustained strings with expression automation,
authored plucked-string synthesis, and sparse glass chimes. The combat variation
adds toms and develops the theme at a faster tempo.

The editable scores and export measurements are in `score-v2/`. To regenerate
these two cues on this Mac, run:

```bash
mkdir -p /tmp/rivenbloom-music-v2
swiftc -module-cache-path /tmp/rivenbloom-music-v2/swift-cache music/source/render-score.swift -o /tmp/rivenbloom-music-v2/render-score
python3 music/source/compose-lantern-theme.py
```

Rendering requires Python with NumPy, FFmpeg, and the installed GarageBand flute
and string sample libraries. The generator packages finished compositions only.
It does not copy instrument samples into the project.

Open [the listening page](score-v1/listen.html) to audition the ten earlier compositions. The MP3
files used by the game are in `public/assets/audio/rivenbloom/`. Standard MIDI files and note-level
score JSON live in `score-v1/midi/` and `score-v1/scores/` for editing; GarageBand can import the MIDI.

The six-note seed-song appears in the village, mutates through the world and the Pallid Cantor's
two phases, then resolves in the release cue. Area and boss changes crossfade in
`src/game/audio/AudioDirector.ts`. The Thorn Sentinel cue plays in its room in Brackenreach.

To regenerate on this Mac, run `python3 music/source/compose.py`, compile
`music/source/render-score.swift` to `/tmp/rivenbloom-score-work/render-score`, then run
`python3 music/source/render-all.py`. Rendering uses Apple's installed General MIDI instrument
bank; that bank is not included in the project. `docs/asset-provenance.md` records the source.
