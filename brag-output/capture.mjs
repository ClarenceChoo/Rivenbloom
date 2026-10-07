import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.env.RIVENBLOOM_CAPTURE_OUTPUT ?? 'brag-output/composition/assets/footage');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: [
  '--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--use-gl=angle',
  '--use-angle=metal', '--enable-gpu-rasterization', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
] });
const selected = process.argv.slice(2);
const shots = [
  { name: 'village', area: 'wren-rest', checkpoint: 'village-well', mode: 'travel', seconds: 8 },
  { name: 'forest', area: 'brackenreach', checkpoint: 'brackenreach-trailhead', mode: 'fight', seconds: 14 },
  { name: 'sentinel', area: 'brackenreach', checkpoint: 'reliquary-verge-lantern', mode: 'fight', seconds: 16 },
  { name: 'hollows', area: 'singing-hollows', checkpoint: 'hollows-mouth-lantern', mode: 'travel', seconds: 10 },
  { name: 'reliquary', area: 'rootglass-reliquary', checkpoint: 'resonance-gallery-lantern', mode: 'travel', seconds: 9 },
  { name: 'boss', area: 'hollow-choir', checkpoint: 'choir-threshold-lantern', mode: 'boss', seconds: 26 },
].filter(s => !selected.length || selected.includes(s.name));

try {
  for (const shot of shots) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...rest) {
        if (destination instanceof AudioDestinationNode) {
          const capture = this.context.createMediaStreamDestination();
          connect.call(this, capture);
          window.__trailerAudio = capture.stream;
        }
        return connect.call(this, destination, ...rest);
      };
    });
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady);
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null;
    });
    const envelope = await page.evaluate(async ({ area, checkpoint }) => {
      const { CONTENT_REGISTRY } = await import('/src/game/data/areas.ts');
      const { createNewSave, validateSaveV1 } = await import('/src/game/saves/SaveSchema.ts');
      const { createSaveEnvelopeJson } = await import('/src/game/saves/SaveEnvelope.ts');
      const { debugPallidCantorSave } = await import('/src/game/testing/debugBossEncounter.ts');
      const definition = CONTENT_REGISTRY.areas.find(a => a.areaId === area);
      const point = definition.checkpoints.find(c => c.checkpointId === checkpoint);
      const defaults = CONTENT_REGISTRY.newGame;
      const fresh = createNewSave({
        nowEpochMs: Date.now(),
        location: { regionId: definition.regionId, areaId: area, checkpointId: checkpoint, safePosition: point.canonicalPosition },
        baseStats: defaults.baseStats, initialQuests: defaults.initialQuests, startingAbilities: defaults.startingAbilities,
      });
      const staged = debugPallidCantorSave(fresh);
      const save = {
        ...staged, location: fresh.location,
        quests: { ...staged.quests, flags: staged.quests.flags.filter(flag => area === 'hollow-choir' || flag !== 'briar-core-claimed') },
        player: { ...staged.player, baseStats: { ...fresh.player.baseStats, maxHealth: 120, maxMana: 48 }, currentHealth: 120, currentMana: 48, weaponLevel: 2 },
        settings: { ...fresh.settings, subtitles: false, musicVolume: 0, muteWhenUnfocused: false, shakeIntensity: 0.5, flashIntensity: 0.5 },
      };
      const validation = validateSaveV1(save);
      if (validation.kind !== 'valid') throw new Error(JSON.stringify(validation));
      return createSaveEnvelopeJson(validation.value, Date.now());
    }, shot);
    await page.getByLabel('Import save for Journey 1').setInputFiles({ name: 'trailer-session.json', mimeType: 'application/json', buffer: Buffer.from(envelope) });
    await page.getByRole('button', { name: 'Import save', exact: true }).click();
    await page.getByRole('button', { name: 'Continue Journey 1' }).click();
    await page.getByRole('button', { name: /^Enter / }).click();
    await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().player?.grounded);
    await page.waitForTimeout(400);
    const read = () => page.evaluate(() => window.__RIVENBLOOM_TEST__.read());
    // Select the projectile art using the ordinary cycle-art input.
    for (let i = 0; i < 4 && (await read()).combat?.selectedAbilityId !== 'lumen-bolt'; i++) {
      await page.keyboard.press('KeyR');
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => {
      const stream = document.querySelector('canvas').captureStream(30);
      window.__trailerAudio?.getAudioTracks().forEach(track => stream.addTrack(track));
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 14000000 });
      window.__trailerRecorder = recorder;
      window.__trailerDone = new Promise(resolve => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = async () => {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
          let result = '';
          for (let i = 0; i < bytes.length; i += 32768) result += String.fromCharCode(...bytes.subarray(i, i + 32768));
          resolve(btoa(result));
        };
      });
      recorder.start(1000);
    });
    const start = Date.now();
    const samples = [];
    let lastAttack = 0, lastCast = 0, lastJump = 0, lastDash = 0;
    let moving = null;
    const move = async key => {
      if (key === moving) return;
      if (moving) await page.keyboard.up(moving);
      moving = key;
      if (moving) await page.keyboard.down(moving);
    };
    while (Date.now() - start < shot.seconds * 1000) {
      const time = (Date.now() - start) / 1000;
      const state = await read();
      const player = state.player;
      if (!player || player.state === 'dead' || state.deathReload) break;
      if (samples.length === 0 || time - samples.at(-1).t > 0.25) samples.push({ t: time, player, camera: state.camera, combat: state.combat, encounter: state.encounter });
      const boss = state.encounter?.boss;
      const enemies = (state.encounter?.enemies ?? []).filter(e => e.health > 0 && e.state !== 'dead');
      const target = shot.mode === 'boss' ? boss : enemies.sort((a,b) => Math.abs(a.position.x-player.position.x)-Math.abs(b.position.x-player.position.x))[0];
      if (shot.mode === 'travel') {
        await move('ArrowRight');
        if (time - lastJump > 1.8) { await page.keyboard.press('Space'); lastJump = time; }
        if (time > 3 && time - lastDash > 3.5) { await page.keyboard.press('ShiftLeft'); lastDash = time; }
        if (time > 5 && time - lastCast > 4) { await page.keyboard.press('KeyQ'); lastCast = time; }
      } else if (target?.position) {
        const dx = target.position.x - player.position.x;
        const reach = shot.mode === 'boss' ? 132 : 62;
        await move(Math.abs(dx) > reach ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null);
        if (Math.abs(dx) < 360 && time-lastCast > 3.5) { await page.keyboard.press('KeyQ'); lastCast = time; }
        if (Math.abs(dx) < reach + 30 && time-lastAttack > 0.4) { await page.keyboard.press('KeyJ'); lastAttack = time; }
        if (shot.mode === 'boss' && time-lastJump > 3) { await page.keyboard.press('Space'); lastJump = time; }
      } else await move('ArrowRight');
      await page.waitForTimeout(65);
    }
    await move(null);
    await page.screenshot({ path: `/tmp/rivenbloom-${shot.name}.png` });
    const data = await page.evaluate(async () => { window.__trailerRecorder.stop(); return window.__trailerDone; });
    await writeFile(resolve(output, `${shot.name}.webm`), Buffer.from(data, 'base64'));
    await writeFile(resolve(output, `${shot.name}.capture.json`), JSON.stringify({ recordedAt: new Date().toISOString(), renderer, captureFps: 30, shot, errors, samples }, null, 2));
    const last = samples.at(-1);
    console.log(JSON.stringify({ shot: shot.name, seconds: last?.t, errors, hits: last?.combat?.confirmedHitCount, boss: last?.encounter?.boss?.state, health: last?.encounter?.playerVitality?.currentHealth }));
    await context.close();
  }
} finally { await browser.close(); }
