# Rivenbloom score

Open [the listening page](score-v1/listen.html) to audition ten original compositions. The MP3
files used by the game are in `public/assets/audio/rivenbloom/`. Standard MIDI files and note-level
score JSON live in `score-v1/midi/` and `score-v1/scores/` for editing; GarageBand can import the MIDI.

The six-note seed-song appears in the village, mutates through the world and the Pallid Cantor's
two phases, then resolves in the release cue. Area and boss changes crossfade in
`src/game/audio/AudioDirector.ts`. The Thorn Sentinel cue plays in its room in Brackenreach.

To regenerate on this Mac, run `python3 music/source/compose.py`, compile
`music/source/render-score.swift` to `/tmp/rivenbloom-score-work/render-score`, then run
`python3 music/source/render-all.py`. Rendering uses Apple's installed General MIDI instrument
bank; that bank is not included in the project. `docs/asset-provenance.md` records the source.
