# Rivenbloom trailer revision

Create a 36.2-second, 1920 × 1080, 30 FPS gameplay trailer using four continuous
source takes. The longer duration responds to the request for fewer scene cuts.
Keep native game camera movement. Remove the added gameplay zooms and all cuts
within the forest and boss takes. Retain the existing typography and title card.

| Timeline | Source | Source start | Kept duration |
| --- | --- | --- | --- |
| 0–3.8 s | Wren's Rest | 1 s | 3.8 s |
| 3.8–11.4 s | Brackenreach | 0.8 s | 7.6 s |
| 11.4–19 s | Thorn Sentinel | 6.5 s | 7.6 s |
| 19–32.3 s | Pallid Cantor | 2.5 s | 13.3 s |
| 32.3–36.2 s | Rivenbloom title | Existing art | 3.9 s |

The boss take includes phase one, the phase transition, and phase two without a
source jump. The source captures run at 30 FPS. Preserve their playback speed.

Use the new original combat arrangement, `12-a-voice-through-glass.mp3`, starting
at 24.752375 seconds. Its fuller theme arrives during the Sentinel fight and its
closing passage accompanies the boss-to-title ending. Apply a 0.35-second opening
fade and a 2.1-second closing fade. Keep the recorded sword, magic, and enemy sounds.
The final export applies 3.82 dB of master gain, measuring -16.03 LUFS and
-2.71 dBTP.

Render `brag.mp4` and replace `brag.jpg` with a settled title frame. Preserve the
previous export as `before-smoothing-brag.mp4`. Verify the edit, frame pacing,
source ranges, final audio levels, media decode, and absence of unintended freezes.

Gameplay was re-recorded after the directional camera fix using Apple M4 Metal
hardware rendering. Raw captures average about 30 FPS. Source files include
recording timestamps, renderer metadata, and a measured capture report.
The earlier export and its footage are preserved in `before-movement-fix/`.
