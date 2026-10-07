import { ABILITIES } from '../src/game/data/abilities';
import { ENEMY_ACTORS, MARA_ACTOR, PALLID_CANTOR_ACTOR } from '../src/game/data/actors';
import { ITEMS } from '../src/game/data/items';
import { SHOP_OFFERS } from '../src/game/data/shops';
import {
  WRENS_REST_AREA,
  BRACKENREACH_AREA,
  SINGING_HOLLOWS_AREA,
  ROOTGLASS_RELIQUARY_AREA,
  HOLLOW_CHOIR_AREA,
} from '../src/game/data/areas/index';

export type Section = Readonly<{ id: string; title: string; html: string; spoiler?: boolean }>;
export type Article = Readonly<{
  id: string;
  title: string;
  description: string;
  sections: readonly Section[];
  sources: readonly string[];
  parent?: string;
}>;

export const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );

const table = (headers: readonly string[], rows: readonly (readonly string[])[]): string =>
  `<div class="table-scroll" role="region" aria-label="${escapeHtml(headers.join(', '))}" tabindex="0"><table><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => (index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;

const abilityNotes: Readonly<Record<string, readonly [string, string]>> = {
  'lumen-bolt': [
    'Available at the start.',
    'A fast ranged projectile. Useful for reaching enemies across a gap.',
  ],
  'wayfinder-dash': [
    'Complete the Wayfinder Circuit beneath the Root-Memory Chamber.',
    'A short burst with 120 ms of invulnerability. Required for the east exit of the Hollows.',
  ],
  'aegis-veil': [
    'Deliver the recovered root-memory to Piri and accept her lesson.',
    'Lasts 5 seconds. While guarding toward a blockable projectile with at least 4 mana, absorb one projectile and gain an Aegis charge.',
  ],
  'resonant-pulse': [
    'Awaken the Rootglass Forge after opening the Index Seal.',
    'A nearby resonance wave that also activates rootglass mechanisms and the boss-arena lenses.',
  ],
};

const enemyNotes: Readonly<Record<string, string>> = {
  'briar-scrapper':
    'A low twig creature with a ceramic mask. Let its lunge finish before closing in for a short attack.',
  duskwing:
    'A translucent-winged moth creature. Watch for its dive; Lumen Bolt can reach it above the ground.',
  'spore-scribe':
    'A walking shelf fungus with a reed focus. Watch for planted pollen projectiles while approaching.',
  barkbound:
    'A defensive husk with a bark shield. Respect its shield bash and use an opening after its attack.',
  rootlurker: 'A bell-jawed root ambusher. Move away from the ground warning before its eruption.',
  'thorn-sentinel':
    'The elite at Reliquary Verge. Its spear sweep has two stages; wait for the second before committing. Defeat it for the Briar Core.',
};

const areas = [
  WRENS_REST_AREA,
  BRACKENREACH_AREA,
  SINGING_HOLLOWS_AREA,
  ROOTGLASS_RELIQUARY_AREA,
  HOLLOW_CHOIR_AREA,
];
const areaNotes = [
  'Your homeward stop: Sela’s chart table, Piri’s remedies, Orin’s forge, and the Village Seed-Lantern.',
  'Rain-soaked woodland, the optional Split Cedar Sanctuary, the Listening Arch shortcut, and the Thorn Sentinel at Reliquary Verge.',
  'Follow the cave east through Echo Pool to recover the root-memory. The Wayfinder Dash Trial lies beneath its chamber.',
  'A botanical archive of copper locks and rootglass lenses. Find the Index Key, awaken the forge, and open the Choir Seal.',
  'The Pallid Cantor’s arena. Rest at the threshold before entering the encounter.',
];

export const ARTICLES: readonly Article[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'A companion for the paths, people, and quiet secrets of Rivenbloom.',
    sources: ['README.md', 'docs/art-direction.md'],
    sections: [],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    description:
      'A blade, a little light, and a map that has begun to forget. Your first steps as Mara Vey.',
    sources: ['README.md', 'src/game/data/actors.ts', 'src/game/world/CheckpointSystem.ts'],
    sections: [
      {
        id: 'first-steps',
        title: 'Before you leave the village',
        html: `<p>You play as <strong>Mara Vey</strong>, a wayfinder in a moss cloak with a luminous thread-scarf and a folding crescent blade. Begin a new journey in one of the three save slots.</p><ol><li>Speak to <strong>Sela Quill</strong> at the chart table and accept <a href="#walkthrough">The Silent Bloom</a>.</li><li>Interact with the <strong>Village Seed-Lantern</strong>. Resting sets your return point and restores health and mana.</li><li>Meet <strong>Piri Moss</strong> and <strong>Orin Fen</strong>. The story-required reforge consumes an earned Briar Core and costs no Resin.</li><li>Head east into Brackenreach. Learn the enemy’s warning before committing to an attack.</li></ol><p>Mara begins with ${MARA_ACTOR.stats.maxHealth} health and ${MARA_ACTOR.stats.maxMana} mana. <strong>Lumen Bolt</strong> is available immediately; Dash, Aegis Veil, and Resonant Pulse are learned along the journey.</p>`,
      },
      {
        id: 'controls',
        title: 'Keep these close at hand',
        html:
          table(
            ['Action', 'Keyboard', 'Common gamepad'],
            [
              ['Move / menus', 'Arrow keys or WASD', 'Left stick / D-pad'],
              ['Jump', '<kbd>Space</kbd>', 'South face button'],
              ['Light attack', '<kbd>J</kbd>', 'West face button'],
              ['Charged heavy attack', 'Hold <kbd>K</kbd>, then release', 'Hold north face button'],
              ['Block / parry', '<kbd>L</kbd>', 'Left shoulder'],
              ['Wayfinder Dash', '<kbd>Left Shift</kbd>', 'East face button'],
              ['Cast selected art', '<kbd>Q</kbd>', 'Right trigger / button 7'],
              ['Cycle cast art', '<kbd>R</kbd>', 'Left trigger / button 6'],
              [
                'Interact / confirm',
                '<kbd>E</kbd> / <kbd>Enter</kbd>',
                'Right shoulder / south face button',
              ],
              [
                'Pause / cancel',
                '<kbd>Esc</kbd> / <kbd>Backspace</kbd>',
                'Menu / east face button',
              ],
            ],
          ) +
          '<p>Hold Up near a ladder to catch it. Change keyboard gameplay bindings in <strong>Pause → Settings</strong>; bindings belong to the current journey. Gamepad labels vary by controller.</p>',
      },
      {
        id: 'travel-well',
        title: 'A few habits for the road',
        html: '<ul><li>Use seed-lanterns often. Death returns you to your saved checkpoint with restored health and mana.</li><li>Open the pause menu for the map, inventory, equipment, journal, and settings. Use recovery items from inventory and equip charms in equipment.</li><li>Read the current journal objective. A quest marker only appears on the map once its destination room is discovered.</li><li>Try a charged heavy attack on a suspicious Root Knot or Silt Wall.</li><li>Wait for the save indicator before closing the game. Export a backup before moving devices or browsers.</li></ul><aside class="note"><strong>About this edition</strong><p>This guide follows the current playable build. The intended first journey is 20–40 minutes, but that duration has not been measured. The game requires keyboard or gamepad; phone touch gameplay is not supported. You can read this wiki on a phone.</p></aside>',
      },
    ],
  },
  {
    id: 'walkthrough',
    title: 'The Silent Bloom',
    description:
      'The complete main-quest route, from Sela’s quiet map to the song’s return. Open each step when you need it.',
    sources: [
      'src/game/data/quests.ts',
      'src/game/data/dialogue.ts',
      'src/game/world/WorldProgression.ts',
      'src/game/data/areas/index.ts',
    ],
    sections: [
      {
        id: 'quiet-map',
        title: 'I. A Quiet Map',
        html: '<p>Talk to <strong>Sela Quill</strong> in Wren’s Rest and accept her request. Travel east along Brackenreach Trail, past the Briar Scrappers, to the <strong>Listening Arch</strong>. Entering the arch’s tracing area advances the quest.</p><p>Activate the <strong>homeward latch</strong> near the Listening Arch lantern. Its nearby doorway provides a useful return to Wren’s Rest.</p>',
      },
      {
        id: 'root-memory',
        title: 'II. A Root Remembers',
        spoiler: true,
        html: '<p>From the Listening Arch, go east into <strong>Singing Hollows</strong>. Cross Hollows Mouth and Echo Pool, then interact with the root-memory in the <strong>Root-Memory Chamber</strong>.</p><p>Return west to the Listening Arch and use the homeward shortcut. Bring the memory to <strong>Piri</strong> at the herb stall and choose <strong>“Let its memory teach me.”</strong> This grants <strong>Aegis Veil</strong> and 40 XP.</p>',
      },
      {
        id: 'dash-trial',
        title: 'III. Learn Wayfinder Dash',
        spoiler: true,
        html: '<p>After recovering the memory, use the interactable passage beneath the <strong>Root-Memory Chamber</strong> to enter the <strong>Wayfinder Dash Trial</strong>.</p><p>The <strong>Wayfinder Circuit</strong> requires all three plates within <strong>9 seconds</strong>. The west and east plates are on the floor; the middle plate is on the raised rib. Use movement, jumping, and the climb route to touch them before the timer expires. Dash is the reward, so you do not need it to solve the trial.</p><p>Return upstairs. Learning Dash opens the east exit to <strong>Reliquary Verge</strong>; use the dash to cross the bramble hazard.</p>',
      },
      {
        id: 'reforge',
        title: 'IV. Heart of the Briar',
        spoiler: true,
        html: '<p>Rest at the Reliquary Verge lantern, then face the <strong>Thorn Sentinel</strong>. Watch both parts of its spear sweep. Defeat it and claim the <strong>Briar Core</strong>.</p><p>Bring <strong>1 Briar Core</strong> to <strong>Orin</strong> in Wren’s Rest. Buy <strong>Reforge Surveyor Edge</strong> from his shop. The reforge costs no Resin. This upgrades the weapon to level 1 and opens the route from Reliquary Verge into the dungeon.</p><aside class="note"><strong>Optional supply caches</strong><p>The Wayfarer Cache on Brackenreach Trail holds 20, the Survey Cache at Listening Arch holds 30, and the optional Split Cedar Resin Cache holds 25.</p></aside>',
      },
      {
        id: 'reliquary',
        title: 'V. The Sealed Reliquary',
        spoiler: true,
        html: '<p>Travel back through the Hollows to Reliquary Verge and continue east into <strong>Rootglass Reliquary</strong>. Retrieve the Index Key from West Archive, unlock the Index Seal, and awaken the Rootglass Forge for <strong>Resonant Pulse</strong> and weapon level 2.</p><p>Align the Threefold Lens, cross the Flooded Stacks, and solve the Choir Seal in Resonance Gallery. The <a href="#dungeon">dungeon guide</a> gives each solution and return route.</p>',
      },
      {
        id: 'song-returned',
        title: 'VI. A Song Returned',
        spoiler: true,
        html: '<p>Rest at the Choir Threshold lantern, then defeat the <a href="#boss">Pallid Cantor</a>. In its second phase, use Resonant Pulse on both arena lenses to expose the heart.</p><p>Use the homeward route after the fight and return to <strong>Sela</strong>. Choose <strong>“Mark the song returned.”</strong> to complete The Silent Bloom and reach the ending. Defeating the boss alone does not complete Sela’s final quest step.</p>',
      },
    ],
  },
  {
    id: 'world',
    title: 'World & places',
    description:
      'Five places connected by an old root-song. A route atlas for the journey out and the way home.',
    sources: [
      'src/game/data/areas/index.ts',
      'src/game/data/areas/brackenreach.ts',
      'src/game/data/areas/rootglassReliquary.ts',
      'src/game/data/npcs.ts',
    ],
    sections: [
      {
        id: 'route',
        title: 'The road through Brackenreach',
        html: '<ol class="route"><li>Wren’s Rest</li><li>Brackenreach</li><li>Singing Hollows</li><li>Reliquary Verge <small>Return to Brackenreach</small></li><li>Rootglass Reliquary</li><li>Hollow Choir</li></ol><p>The main quest loops home to Piri and Orin before the dungeon. Reliquary Verge is part of Brackenreach, reached from the east side of Singing Hollows once Dash is learned.</p>',
      },
      ...areas.map((area, index): Section => ({
        id: area.areaId,
        title: area.displayName,
        html: `<p>${areaNotes[index]}</p><dl><dt>Rooms</dt><dd>${area.rooms.map((room) => escapeHtml(room.displayName)).join(' · ')}</dd><dt>Resting places</dt><dd>${area.checkpoints.map((checkpoint) => escapeHtml(checkpoint.displayName)).join(' · ')}</dd></dl>${area.areaId === 'rootglass-reliquary' ? '<p><a href="#dungeon">Read the dungeon guide</a></p>' : ''}${area.areaId === 'hollow-choir' ? '<p><a href="#boss">Read the boss guide</a></p>' : ''}`,
      })),
      {
        id: 'people',
        title: 'People of Wren’s Rest',
        html: '<dl><dt>Sela Quill · Cartographer</dt><dd>Begins and completes The Silent Bloom. Return her missing folio for Quiet Step, 25 Resin, and 60 XP.</dd><dt>Orin Fen · Smith</dt><dd>Reforges the Surveyor Edge with a Briar Core and no Resin cost.</dd><dt>Piri Moss · Herbalist</dt><dd>Sells remedies and charms, teaches Aegis Veil after the root-memory delivery, and receives the memorial-lantern quest.</dd></dl>',
      },
    ],
  },
  {
    id: 'combat',
    title: 'Combat & abilities',
    description:
      'Read the warning. Find the opening. Let the blade and the root-song answer together.',
    sources: [
      'src/game/data/abilities.ts',
      'src/game/data/attacks.ts',
      'src/game/entities/player/PlayerCombatModel.ts',
      'src/game/combat/GuardResolver.ts',
      'src/game/world/WorldProgression.ts',
    ],
    sections: [
      {
        id: 'blade',
        title: 'The Surveyor Edge',
        html: '<p><strong>Light attack:</strong> press J for the three-part grounded chain. Time follow-up presses as the attack progresses. In the air, J performs an air slash; landing restores your next air attack.</p><p><strong>Heavy attack:</strong> hold K for at least <strong>350 ms</strong>, then release. It releases automatically at <strong>900 ms</strong>. Releasing too early cancels the charge. Charged heavy attacks can open the Root Knot and Silt Wall.</p><p>Orin’s reforge upgrades the weapon from level 0 to 1. The Rootglass Forge upgrades it from 1 to 2 while teaching Resonant Pulse.</p>',
      },
      {
        id: 'guard',
        title: 'Guard, parry, and give ground',
        html: '<p>Face the incoming attack and press L. The first <strong>120 ms</strong> form the parry window; continuing to hold guards. A successful parry can stagger the attacker. Ordinary blocking costs <strong>4 mana</strong> and applies a 0.35 damage multiplier before other combat calculations. With less than 4 mana, the guard breaks.</p><p><strong>Attacks from behind and unblockable attacks bypass the guard.</strong> Move out of their warning zones. Dash grants brief invulnerability, but its full movement duration is longer than that protection.</p>',
      },
      {
        id: 'arts',
        title: 'The four wayfinder arts',
        html:
          '<p>Use <kbd>R</kbd> to cycle learned cast arts and <kbd>Q</kbd> to cast. Wayfinder Dash has its own <kbd>Left Shift</kbd> input.</p>' +
          ABILITIES.map(
            (ability) =>
              `<div class="entry"><h3>${escapeHtml(ability.displayName)}</h3><p class="entry-meta">${ability.manaCost} mana · ${ability.cooldownMs / 1000}s cooldown</p><p>${abilityNotes[ability.abilityId]?.[1] ?? ''}</p><p><strong>Learn it:</strong> ${abilityNotes[ability.abilityId]?.[0] ?? ''}</p></div>`,
          ).join(''),
      },
    ],
  },
  {
    id: 'items',
    title: 'Items & equipment',
    description: 'What to keep, what to spend, and what to carry into the dark.',
    sources: [
      'src/game/data/items.ts',
      'src/game/data/shops.ts',
      'src/game/world/WorldProgression.ts',
    ],
    sections: [
      {
        id: 'charms',
        title: 'Charms for the journey',
        html:
          '<p>Equip charms from <strong>Pause → Equipment</strong>. There are three charm slots. Owning a charm is not enough: its effect applies while equipped.</p>' +
          table(
            ['Charm', 'Effect', 'Where to find it'],
            ITEMS.filter((item) => item.category === 'charm').map((item) => [
              escapeHtml(item.displayName),
              escapeHtml(item.description),
              item.itemId === 'quiet-step'
                ? 'Return Sela’s Lost Folio.'
                : `Piri’s shop · ${SHOP_OFFERS.find((offer) => offer.itemId === item.itemId)?.price} Resin`,
            ]),
          ),
      },
      {
        id: 'remedies',
        title: 'Piri’s remedies',
        html:
          table(
            ['Remedy', 'Effect', 'Price / stack'],
            ITEMS.filter((item) => item.category === 'recovery').map((item) => [
              escapeHtml(item.displayName),
              escapeHtml(item.description),
              `${SHOP_OFFERS.find((offer) => offer.itemId === item.itemId)?.price} Resin · carry up to ${item.maxStack}`,
            ]),
          ) +
          '<p>Use remedies from the pause-menu inventory. Resting at a seed-lantern also restores health and mana. Piri’s remedy stock is repeatable; her charm purchases are one-time.</p>',
      },
      {
        id: 'quest-items',
        title: 'Things with a purpose',
        html: table(
          ['Item', 'Purpose'],
          [
            [
              'Briar Core',
              'Defeat the Thorn Sentinel at Reliquary Verge. Orin consumes one core for the reforge; no Resin is required.',
            ],
            [
              'Rootglass Index Key',
              'Found in the West Archive Index Chest. Consumed when opening the Index Seal in the vestibule.',
            ],
            [
              'Cartographer’s Folio',
              'Found in the optional Folio Vault. Return it to Sela; it is consumed for the quest reward.',
            ],
            [
              'Cantor Sigil',
              'A persistent reward from defeating the Pallid Cantor. Return to Sela to finish the main quest.',
            ],
          ],
        ),
      },
      {
        id: 'permanent-upgrades',
        title: 'Growing stronger',
        html: '<dl><dt>Heart Petal</dt><dd>Echo Pool, near its eastern end. Grants +20 maximum health.</dd><dt>Wellspring Seed</dt><dd>East Lens Vault, beyond the lens dials. Grants +8 maximum mana.</dd><dt>Lanterns for the Absent</dt><dd>Light all three memorial lanterns and return to Piri for another +8 maximum mana and 80 XP.</dd></dl><p>These are one-time progression rewards. See the <a href="#secrets">discovery checklist</a> for locations.</p>',
      },
    ],
  },
  {
    id: 'creatures',
    title: 'Creatures & boss',
    description:
      'Some things in the woodland have forgotten how to listen. Learn their warnings before you draw near.',
    sources: ['src/game/data/actors.ts', 'src/game/data/attacks.ts', 'docs/art-direction.md'],
    sections: [
      {
        id: 'field-notes',
        title: 'A small bestiary',
        html:
          '<p>These are base content stats. Encounter behavior, difficulty, equipment, and damage calculations affect the fight.</p>' +
          ENEMY_ACTORS.map(
            (enemy) =>
              `<div class="entry"><h3>${escapeHtml(enemy.displayName)}</h3><p class="entry-meta">${enemy.stats.maxHealth} health · ${enemy.stats.armour} armour · ${enemy.stats.maxPoise} poise</p><p>${enemyNotes[enemy.actorId] ?? ''}</p></div>`,
          ).join(''),
      },
      {
        id: 'cantor',
        title: 'The Pallid Cantor',
        html: `<p>A rootglass avian effigy with a porcelain throat, copper chimes, and wing-like root fans. It waits in the <strong>Hollow Choir</strong>.</p><p>Base health: <strong>${PALLID_CANTOR_ACTOR.stats.maxHealth}</strong>. Two phases. The second phase’s sealed shell requires the arena lenses.</p><a class="button" href="#boss">Open the boss guide <span aria-hidden="true">→</span></a>`,
      },
    ],
  },
  {
    id: 'secrets',
    title: 'Secrets & side quests',
    description:
      'For those who stop at the side paths. A little wonder is often waiting just out of sight.',
    sources: [
      'src/game/data/areas/wrensRest.ts',
      'src/game/data/areas/brackenreach.ts',
      'src/game/data/areas/singingHollows.ts',
      'src/game/data/areas/rootglassReliquary.ts',
      'src/game/world/WorldProgression.ts',
    ],
    sections: [
      {
        id: 'checklist',
        title: 'Your discovery checklist',
        html: '<p>These notes are saved in this browser when storage is available. They are independent of your game save.</p><div id="discovery-checklist"></div><p id="checklist-status" class="entry-meta" role="status"></p>',
      },
      {
        id: 'lost-folio',
        title: 'The Lost Folio',
        spoiler: true,
        html: '<p>The early quest text sends you to search Brackenreach, but the actual folio is farther along: <strong>Folio Vault in Rootglass Reliquary</strong>.</p><ol><li>Reach the <strong>Flooded Stacks</strong>.</li><li>Break the <strong>Silt Wall</strong> with a charged heavy attack or Resonant Pulse.</li><li>Interact with the opened passage and enter Folio Vault.</li><li>Open the chest to recover the folio, then return to <strong>Sela</strong>.</li></ol><p>Reward: <strong>Quiet Step, 25 Resin, and 60 XP</strong>. If Sela is waiting for the main quest’s final return, finish that conversation and speak to her again.</p>',
      },
      {
        id: 'memorial-lanterns',
        title: 'Lanterns for the Absent',
        spoiler: true,
        html: '<p>Interact with all three memorial lanterns. These are separate from the seed-lantern checkpoints.</p><ol><li><strong>Brackenreach Trail:</strong> near the eastern end, beyond the Root Knot passage.</li><li><strong>Echo Pool:</strong> near its western entrance.</li><li><strong>Flooded Stacks:</strong> toward the eastern side.</li></ol><p>Return to <strong>Piri</strong> for <strong>+8 maximum mana and 80 XP</strong>. If the root-memory delivery is pending, complete that conversation first, then speak again.</p>',
      },
      {
        id: 'hidden-places',
        title: 'Places off the path',
        spoiler: true,
        html: '<dl><dt>The Herb Loft · Wren’s Rest</dt><dd>Explore the village’s upper herb loft to discover Piri’s drying herbs.</dd><dt>The Split Cedar’s Heart · Brackenreach</dt><dd>Break the Root Knot on Brackenreach Trail using a charged heavy attack or Resonant Pulse. Interact with the nearby passage. Entering the sanctuary grants 20 XP; its Resin Cache holds 25 Resin.</dd><dt>Heart Petal · Echo Pool</dt><dd>Look near the eastern end and interact for +20 maximum health.</dd><dt>Wellspring Seed · East Lens Vault</dt><dd>Look beyond the three dials and interact for +8 maximum mana.</dd></dl>',
      },
    ],
  },
  {
    id: 'saves',
    title: 'Saves & settings',
    description: 'Keep your journey safe, and make the game comfortable for the way you play.',
    sources: ['README.md', 'docs/known-issues.md', 'src/game/world/CheckpointSystem.ts'],
    sections: [
      {
        id: 'saving',
        title: 'A journey worth keeping',
        html: '<p>The browser game has <strong>three local save slots</strong>. Autosaves preserve progression and a previous valid recovery record. The title screen provides <strong>export, import preview, recovery, and deletion</strong>.</p><p>Watch the HUD: <strong>Saved</strong> confirms a completed write. A storage failure or session-only warning means the current journey may not survive closing the page.</p><aside class="note"><strong>Before changing browsers or devices</strong><p>Export your save. Saves belong to a browser profile and website address; they do not sync between devices. Clearing site data can remove them. A wiki checklist is only a reading aid and cannot restore a game save.</p></aside>',
      },
      {
        id: 'checkpoint',
        title: 'Resting and returning',
        html: '<p>Interact with a seed-lantern to set the saved checkpoint and refill health and mana. Death restores you to that checkpoint. Opened chests, solved puzzles, activated shortcuts, discoveries, quest facts, and defeated bosses are persistent progression.</p><p>Once the Cantor’s defeat is saved, it remains defeated on return. If a save reports failure, keep the game open and resolve the save warning before leaving.</p>',
      },
      {
        id: 'settings',
        title: 'Make yourself comfortable',
        html: '<p>Open <strong>Pause → Settings</strong> for difficulty, keyboard rebinding, reduced motion, shake and flash intensity, subtitles, text scale, high-contrast prompts, damage numbers, hold/toggle behavior, separate audio channels, and focus mute.</p><p>Settings and keyboard bindings are stored per journey. Try reduced motion and lower flash intensity if effects make attacks difficult to read.</p>',
      },
      {
        id: 'offline',
        title: 'Offline play & supported platforms',
        html: '<p>The production browser game includes install and offline support after its assets have loaded. When a game update is ready, its visible reload action saves first; a failed save keeps the current game open.</p><p>This wiki is a separate static companion. It does not install the game or provide game offline storage.</p><p>Desktop Chromium is the current qualification target. Physical gamepads, Safari/Firefox, and native macOS packaging still need qualification. No mobile touch controls are provided. The wiki illustrations are companion artwork, not screenshots of gameplay.</p>',
      },
    ],
  },
  {
    id: 'dungeon',
    parent: 'world',
    title: 'Rootglass Reliquary',
    description:
      'A step-by-step guide to the flooded botanical archive. Puzzle solutions are folded away until you need them.',
    sources: ['src/game/data/areas/rootglassReliquary.ts', 'src/game/data/areas/index.ts'],
    sections: [
      {
        id: 'preparation',
        title: 'At the vestibule',
        html: '<p>You need <strong>Orin’s reforged Surveyor Edge</strong> to enter from Reliquary Verge. Rest at the Vestibule Seed-Lantern. The first task is to find a copper index tooth in <strong>West Archive</strong>.</p>',
      },
      {
        id: 'index-seal',
        title: '1. The Index Seal & the forge',
        spoiler: true,
        html: '<ol><li>Continue east from the vestibule into <strong>West Archive</strong>.</li><li>Open the <strong>Index Chest</strong> near the far end for the Rootglass Index Key.</li><li>Return to the vestibule and interact with the <strong>Index Lock</strong>. The key is consumed.</li><li>Interact with the <strong>Rootglass Forge anvil</strong>, west of the lock, to learn <strong>Resonant Pulse</strong> and upgrade your weapon to level 2.</li><li>Use the unlocked index passage to enter <strong>East Lens Vault</strong>.</li></ol>',
      },
      {
        id: 'threefold-lens',
        title: '2. The Threefold Lens',
        spoiler: true,
        html: '<p>Interact with the dials in this order:</p><p class="solution">Root → Rain → Bloom</p><p>The forge’s Resonant Pulse awakening must be complete before the puzzle accepts the sequence. This opens the east route to <strong>Flooded Stacks</strong>. Pick up the optional <strong>Wellspring Seed</strong> beyond the dials before leaving.</p>',
      },
      {
        id: 'stacks',
        title: '3. Through the Flooded Stacks',
        spoiler: true,
        html: '<p>Rest at the Flooded Stacks lantern and proceed past the Barkbound and Spore Scribe. Use the ladder and shelf to navigate the room. Watch the silt hazard.</p><p>For the optional <a href="#secrets/lost-folio">Lost Folio</a>, break the <strong>Silt Wall</strong> with a charged heavy attack or Resonant Pulse and interact with the passage. Light the memorial lantern farther east, then continue to <strong>Resonance Gallery</strong>.</p>',
      },
      {
        id: 'choir-seal',
        title: '4. The Choir Seal',
        spoiler: true,
        html: '<p>Rest at the Gallery Seed-Lantern. Activate the mechanisms in this order:</p><ol><li>Cast <strong>Resonant Pulse</strong> near the <strong>Memory lens</strong>.</li><li>Cast <strong>Resonant Pulse</strong> near the <strong>Breath lens</strong>.</li><li><strong>Interact</strong> with the <strong>Song lens</strong>.</li></ol><p>Memory and Breath need the spell; simply pressing Interact is not enough. Each pulse costs 16 mana and has a 3.5-second cooldown. Rest or use a Wellspring Tonic if needed.</p><p>The east exit now leads to <a href="#boss">Hollow Choir</a>. Rest at the threshold before challenging the Cantor.</p>',
      },
    ],
  },
  {
    id: 'boss',
    parent: 'creatures',
    title: 'The Pallid Cantor',
    description:
      'An ancient song, a porcelain throat, and two lenses waiting for an answer. Boss mechanics and preparation.',
    sources: [
      'src/game/entities/bosses/PallidCantorController.ts',
      'src/game/entities/bosses/pallidCantorAttacks.ts',
      'src/game/data/bosses/pallidCantor.ts',
      'src/game/data/attacks.ts',
    ],
    sections: [
      {
        id: 'prepare',
        title: 'Before the first note',
        html: '<p>Rest at the <strong>Choir Threshold Seed-Lantern</strong>. Bring health and mana remedies, equip your charms, and make sure you can select <strong>Resonant Pulse</strong>. Two arena-lens activations will cost a total of <strong>32 mana</strong>.</p><p>These notes describe the authored encounter mechanics. They are not a claim of a verified no-hit strategy or first-time balance.</p>',
      },
      {
        id: 'first-verse',
        title: 'First Verse · phase one',
        spoiler: true,
        html:
          '<p>The Cantor starts with <strong>420 health</strong>. This phase ends at <strong>210</strong>, with the transition preventing damage from skipping directly through phase two.</p>' +
          table(
            ['Attack', 'Response'],
            [
              [
                'Note volley',
                'Face the incoming projectiles to guard or parry, or move out of their path.',
              ],
              [
                'Fan sweep',
                'Read the frontal warning. Leave the sweep or guard with mana available.',
              ],
              [
                'Chime slam',
                'Move away from the marked impact, or face the source and guard with mana available.',
              ],
              ['Spearfall', 'Watch the marked lanes and move into an unmarked space.'],
            ],
          ) +
          '<p>Use the recovery between attacks for damage. Stop committing to long attacks when a new warning begins.</p>',
      },
      {
        id: 'broken-refrain',
        title: 'Broken Refrain · phase two',
        spoiler: true,
        html:
          '<p>The porcelain throat cracks and the Cantor’s shell becomes sealed. <strong>Ordinary damage will not solve this stage.</strong> Move toward the west and east arena lenses and cast <strong>Resonant Pulse near each one</strong>.</p><p>When both lenses latch, the heart opens and the Cantor staggers. Focus your attacks on the exposed heart. In the current implementation, the heart stays exposed for the rest of the encounter.</p>' +
          table(
            ['Attack', 'Response'],
            [
              [
                'Inversion fan',
                'The warning changes zones between two strikes. Move again when the safe area changes.',
              ],
              [
                'Note chain',
                'Expect a longer sequence of projectiles. Keep facing the source if guarding.',
              ],
              ['Hover chime', 'Unblockable. Leave the warned impact area.'],
              [
                'Spear cascade',
                'Three successive spear patterns. Recheck safe lanes after each warning.',
              ],
            ],
          ),
      },
      {
        id: 'homeward',
        title: 'After the quiet',
        spoiler: true,
        html: '<p>The saved defeat persists and awards the <strong>Cantor Sigil</strong>. Take the homeward route and speak to <strong>Sela</strong> in Wren’s Rest. Choose <strong>“Mark the song returned.”</strong> to finish The Silent Bloom.</p>',
      },
    ],
  },
];

export const DISCOVERIES = [
  { id: 'herb-loft', label: 'Explore the Herb Loft', location: 'Wren’s Rest' },
  { id: 'split-cedar', label: 'Find the Split Cedar’s Heart', location: 'Brackenreach' },
  { id: 'heart-petal', label: 'Claim the Heart Petal', location: 'Echo Pool · +20 maximum health' },
  {
    id: 'wellspring-seed',
    label: 'Claim the Wellspring Seed',
    location: 'East Lens Vault · +8 maximum mana',
  },
  { id: 'folio', label: 'Return the Lost Folio to Sela', location: 'Folio Vault → Wren’s Rest' },
  {
    id: 'lantern-trail',
    label: 'Light the trail memorial lantern',
    location: 'Brackenreach Trail',
  },
  { id: 'lantern-hollows', label: 'Light the Hollows memorial lantern', location: 'Echo Pool' },
  {
    id: 'lantern-reliquary',
    label: 'Light the Reliquary memorial lantern',
    location: 'Flooded Stacks',
  },
  {
    id: 'lantern-return',
    label: 'Return to Piri with all three lights',
    location: 'Wren’s Rest · +8 maximum mana',
  },
] as const;
