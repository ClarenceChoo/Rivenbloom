import { isNonNegativeSafeInteger, isSupportedDamageValue } from '../combat/DamageResolver';
import { isStableId } from '../core/StableId';
import { QuestStore } from '../quests/QuestStore';
import { DialogueController } from '../dialogue/DialogueController';
import { buildWorldGraph, reachableWorldNodes } from '../world/WorldGraph';
import type { AreaId, RoomId } from '../saves/SaveSchema';
import { rectContainsPoint, rectContainsRect } from './types';
import type {
  ActorDefinition,
  AreaDefinition,
  BossEncounterDefinition,
  ContentIssue,
  ContentRegistry,
  PuzzleDefinition,
  Rect,
  Vec2,
  WorldPredicate,
} from './types';

type MutableIssue = {
  severity: ContentIssue['severity'];
  code: ContentIssue['code'];
  path: string;
  message: string;
};

type ContentIndexes = Readonly<{
  assets: ReadonlySet<string>;
  backgrounds: ReadonlySet<string>;
  ambience: ReadonlySet<string>;
  music: ReadonlySet<string>;
  animations: ReadonlySet<string>;
  audio: ReadonlySet<string>;
  ai: ReadonlySet<string>;
  drops: ReadonlySet<string>;
  areas: ReadonlySet<string>;
  actors: ReadonlySet<string>;
  bosses: ReadonlySet<string>;
  attacks: ReadonlySet<string>;
  abilities: ReadonlySet<string>;
  items: ReadonlySet<string>;
  quests: ReadonlySet<string>;
  dialogue: ReadonlySet<string>;
  facts: ReadonlySet<string>;
  puzzles: ReadonlySet<string>;
  shortcuts: ReadonlySet<string>;
  rooms: ReadonlyMap<string, AreaId>;
  surfaces: ReadonlyMap<string, AreaId>;
  checkpoints: ReadonlyMap<string, AreaId>;
  mechanisms: ReadonlyMap<string, AreaId>;
  spawns: ReadonlyMap<string, AreaId>;
  encounters: ReadonlyMap<string, AreaId>;
  chests: ReadonlyMap<string, AreaId>;
  discoveries: ReadonlyMap<string, AreaId>;
  breakables: ReadonlyMap<string, AreaId>;
  npcActorsBySpawn: ReadonlyMap<string, string>;
}>;

export function validateContent(registry: ContentRegistry): readonly ContentIssue[] {
  const issues: MutableIssue[] = [];
  try {
    const indexes = buildIndexes(registry, issues);
    validateSupportingContent(registry, indexes, issues);
    registry.areas.forEach((area, index) => validateArea(area, index, indexes, issues));
    registry.puzzles.forEach((puzzle, index) =>
      validatePuzzle(puzzle, index, registry, indexes, issues),
    );
    if (issues.length === 0) validateWorldReachability(registry, issues);
    registry.actors.forEach((actor, index) =>
      validateActor(actor, index, registry, indexes, issues),
    );
    registry.bossEncounters.forEach((encounter, index) =>
      validateBossEncounter(encounter, index, indexes, issues),
    );
    registry.attacks.forEach((attack, index) => {
      const path = `/attacks/${index}`;
      validatePositiveInteger(attack.totalFrames, `${path}/totalFrames`, issues);
      validateNonNegative(attack.cooldownMs, `${path}/cooldownMs`, issues);
      validateVec(attack.movementImpulse, `${path}/movementImpulse`, issues);
      validateVec(attack.knockback, `${path}/knockback`, issues);
      validateRange(attack.hitStopMs, 45, 80, `${path}/hitStopMs`, issues);
      if (!['melee', 'projectile', 'radial', 'hazard'].includes(attack.delivery)) {
        issue(issues, `${path}/delivery`, 'invalid-value', 'Unknown attack delivery.');
      }
      const attackTags = new Set<string>();
      attack.tags.forEach((tag, tagIndex) => {
        const tagPath = `${path}/tags/${tagIndex}`;
        if (
          !['blockable', 'parryable', 'projectile', 'unblockable', 'rootglass-affecting'].includes(
            tag,
          )
        ) {
          issue(issues, tagPath, 'invalid-value', 'Unknown attack tag.');
        }
        if (attackTags.has(tag)) {
          issue(issues, tagPath, 'duplicate-id', 'Attack tags must be unique.');
        }
        attackTags.add(tag);
      });
      if (
        (attack.delivery === 'projectile' && !attackTags.has('projectile')) ||
        (attack.delivery !== 'projectile' && attackTags.has('projectile'))
      ) {
        issue(
          issues,
          `${path}/tags`,
          'invalid-value',
          'Projectile delivery and projectile tag must agree.',
        );
      }
      if (
        attackTags.has('unblockable') &&
        (attackTags.has('blockable') || attackTags.has('parryable'))
      ) {
        issue(
          issues,
          `${path}/tags`,
          'invalid-value',
          'Unblockable attacks cannot also be blockable or parryable.',
        );
      }
      if (attack.hitPolicy.kind === 'interval') {
        validatePositive(
          attack.hitPolicy.rehitIntervalMs,
          `${path}/hitPolicy/rehitIntervalMs`,
          issues,
        );
      } else if (attack.hitPolicy.kind !== 'once') {
        issue(issues, `${path}/hitPolicy/kind`, 'invalid-value', 'Unknown hit policy.');
      }
      if (attack.charge !== null) {
        validatePositive(attack.charge.minimumMs, `${path}/charge/minimumMs`, issues);
        validatePositive(attack.charge.maximumMs, `${path}/charge/maximumMs`, issues);
        if (attack.charge.maximumMs < attack.charge.minimumMs) {
          issue(
            issues,
            `${path}/charge/maximumMs`,
            'invalid-value',
            'Maximum charge must be at least the minimum charge.',
          );
        }
      }
      const validBaseDamage = validateNonNegativeSafeInteger(
        attack.damage.baseDamage,
        `${path}/damage/baseDamage`,
        issues,
      );
      validateNonNegativeSafeInteger(
        attack.damage.poiseDamage,
        `${path}/damage/poiseDamage`,
        issues,
      );
      validateId(attack.damage.damageType, `${path}/damage/damageType`, issues);
      if (attack.damage.critical.kind === 'eligible') {
        const validMultiplier = validatePositive(
          attack.damage.critical.multiplier,
          `${path}/damage/critical/multiplier`,
          issues,
        );
        if (
          validBaseDamage &&
          validMultiplier &&
          !isSupportedDamageValue(attack.damage.baseDamage * attack.damage.critical.multiplier)
        ) {
          issue(
            issues,
            `${path}/damage/critical/multiplier`,
            'invalid-value',
            'Critical damage exceeds the supported range.',
          );
        }
      }
      const hitboxIds = new Set<string>();
      attack.hitboxes.forEach((hitbox, hitboxIndex) => {
        const hitboxPath = `${path}/hitboxes/${hitboxIndex}`;
        collectId(hitbox.hitboxId, `${hitboxPath}/hitboxId`, hitboxIds, issues);
        validateFrameRange(
          hitbox.fromFrame,
          hitbox.toFrame,
          attack.totalFrames,
          hitboxPath,
          issues,
        );
        validateRect(hitbox.bounds, `${hitboxPath}/bounds`, issues);
      });
      attack.cancelWindows.forEach((window, windowIndex) => {
        const windowPath = `${path}/cancelWindows/${windowIndex}`;
        validateFrameRange(
          window.fromFrame,
          window.toFrame,
          attack.totalFrames,
          windowPath,
          issues,
        );
        window.intoAttackIds.forEach((attackId, targetIndex) =>
          reference(
            attackId,
            indexes.attacks,
            `${windowPath}/intoAttackIds/${targetIndex}`,
            'attack',
            issues,
          ),
        );
      });
      nullableReference(
        attack.animationSetId,
        indexes.animations,
        `${path}/animationSetId`,
        'animation set',
        issues,
      );
      nullableReference(
        attack.audioSetId,
        indexes.audio,
        `${path}/audioSetId`,
        'audio set',
        issues,
      );
    });
    registry.abilities.forEach((ability, index) => {
      const path = `/abilities/${index}`;
      validateDisplayName(ability.displayName, `${path}/displayName`, issues);
      validateNonNegativeSafeInteger(ability.manaCost, `${path}/manaCost`, issues);
      validateNonNegativeSafeInteger(ability.cooldownMs, `${path}/cooldownMs`, issues);
      nullableReference(
        ability.unlockFactId,
        indexes.facts,
        `${path}/unlockFactId`,
        'quest fact',
        issues,
      );
      const actionPath = `${path}/action`;
      switch (ability.action.kind) {
        case 'attack':
          reference(
            ability.action.attackId,
            indexes.attacks,
            `${actionPath}/attackId`,
            'attack',
            issues,
          );
          break;
        case 'projectile':
          {
            const attackId = ability.action.attackId;
            validateId(ability.action.projectileId, `${actionPath}/projectileId`, issues);
            reference(attackId, indexes.attacks, `${actionPath}/attackId`, 'attack', issues);
            validatePositive(ability.action.speed, `${actionPath}/speed`, issues);
            validatePositive(ability.action.lifetimeMs, `${actionPath}/lifetimeMs`, issues);
            validateRelativeRect(ability.action.bounds, `${actionPath}/bounds`, issues);
            if (
              registry.attacks.find((attack) => attack.attackId === attackId)?.delivery !==
              'projectile'
            ) {
              issue(
                issues,
                `${actionPath}/attackId`,
                'invalid-reference',
                'Projectile abilities require a projectile-delivery attack.',
              );
            }
          }
          break;
        case 'dash':
          validatePositive(ability.action.speed, `${actionPath}/speed`, issues);
          validatePositive(ability.action.durationMs, `${actionPath}/durationMs`, issues);
          validateNonNegative(
            ability.action.invulnerableMs,
            `${actionPath}/invulnerableMs`,
            issues,
          );
          validateId(
            ability.action.invulnerabilityStatusId,
            `${actionPath}/invulnerabilityStatusId`,
            issues,
          );
          if (ability.action.invulnerableMs > ability.action.durationMs) {
            issue(
              issues,
              `${actionPath}/invulnerableMs`,
              'invalid-value',
              'Dash invulnerability cannot exceed dash duration.',
            );
          }
          break;
        case 'barrier':
          validateId(ability.action.statusId, `${actionPath}/statusId`, issues);
          validatePositive(ability.action.durationMs, `${actionPath}/durationMs`, issues);
          validatePositiveInteger(
            ability.action.projectileAbsorptions,
            `${actionPath}/projectileAbsorptions`,
            issues,
          );
          break;
        case 'pulse':
          {
            const attackId = ability.action.attackId;
            reference(attackId, indexes.attacks, `${actionPath}/attackId`, 'attack', issues);
            validatePositive(ability.action.radius, `${actionPath}/radius`, issues);
            const attack = registry.attacks.find((candidate) => candidate.attackId === attackId);
            if (
              attack !== undefined &&
              (attack.delivery !== 'radial' || !attack.tags.includes('rootglass-affecting'))
            ) {
              issue(
                issues,
                `${actionPath}/attackId`,
                'invalid-reference',
                'Pulse abilities require a rootglass-affecting radial attack.',
              );
            }
            if (ability.action.mechanismTag !== 'rootglass-affecting') {
              issue(
                issues,
                `${actionPath}/mechanismTag`,
                'invalid-value',
                'Pulse mechanism tag must be rootglass-affecting.',
              );
            }
          }
          break;
        case 'restore':
          validatePositive(ability.action.amount, `${actionPath}/amount`, issues);
          break;
        default:
          issue(issues, `${actionPath}/kind`, 'invalid-value', 'Unknown ability action.');
          break;
      }
    });
    registry.items.forEach((item, index) => {
      const path = `/items/${index}`;
      validateDisplayName(item.displayName, `${path}/displayName`, issues);
      validateDisplayName(item.description ?? '', `${path}/description`, issues);
      if (!['material', 'quest', 'charm', 'recovery'].includes(item.category ?? '')) {
        issue(issues, `${path}/category`, 'invalid-value', 'Unknown item category.');
      }
      validatePositiveInteger(item.maxStack, `${path}/maxStack`, issues);
      if (item.equipment !== null) {
        if ('slotIds' in item.equipment) {
          if (item.equipment.slotIds.length === 0) {
            issue(
              issues,
              `${path}/equipment/slotIds`,
              'invalid-value',
              'Equipment requires a slot.',
            );
          }
          item.equipment.slotIds.forEach((slotId, slotIndex) =>
            validateId(slotId, `${path}/equipment/slotIds/${slotIndex}`, issues),
          );
        } else {
          validateId(item.equipment.slotId, `${path}/equipment/slotId`, issues);
        }
      }
    });
    validateNpcAndShopContent(registry, indexes, issues);
    validateQuestContent(registry, indexes, issues);
    validateDialogueContent(registry, indexes, issues);
    validateNewGame(registry, indexes, issues);
  } catch {
    issue(issues, '/', 'invalid-value', 'Content registry structure could not be validated.');
  }

  return sortContentIssues(issues);
}

function validateNpcAndShopContent(
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  const shopIds = new Set<string>();
  const offerIds = new Set<string>();
  registry.shopOffers.forEach((offer, index) => {
    const path = `/shopOffers/${index}`;
    collectId(offer.offerId, `${path}/offerId`, offerIds, issues);
    if (validateId(offer.shopId, `${path}/shopId`, issues)) shopIds.add(offer.shopId);
    validateDisplayName(offer.displayName, `${path}/displayName`, issues);
    validateDisplayName(offer.description, `${path}/description`, issues);
    validateNonNegativeSafeInteger(offer.price, `${path}/price`, issues);
    nullableReference(offer.itemId, indexes.items, `${path}/itemId`, 'item', issues);
    nullableReference(
      offer.soldOutFactId,
      indexes.facts,
      `${path}/soldOutFactId`,
      'quest fact',
      issues,
    );
    offer.prerequisites.forEach((factId, factIndex) =>
      reference(factId, indexes.facts, `${path}/prerequisites/${factIndex}`, 'quest fact', issues),
    );
    if (!['repeatable', 'one-time'].includes(offer.stockPolicy)) {
      issue(issues, `${path}/stockPolicy`, 'invalid-value', 'Unknown stock policy.');
    }
    if (offer.stockPolicy === 'repeatable' && offer.soldOutFactId !== null) {
      issue(
        issues,
        `${path}/soldOutFactId`,
        'invalid-value',
        'Repeatable offers cannot have a sold-out fact.',
      );
    }
    if (offer.stockPolicy === 'one-time' && offer.soldOutFactId === null) {
      issue(
        issues,
        `${path}/soldOutFactId`,
        'invalid-value',
        'One-time offers require a durable sold-out fact.',
      );
    }
    offer.commands.forEach((command, commandIndex) => {
      const commandPath = `${path}/commands/${commandIndex}`;
      validateProgressionCommand(command, commandPath, indexes, issues);
    });
    if (
      offer.stockPolicy === 'one-time' &&
      offer.rewardId === null &&
      offer.soldOutFactId !== null &&
      !offer.commands.some(
        (command) =>
          command !== null &&
          typeof command === 'object' &&
          'kind' in command &&
          command.kind === 'set-fact' &&
          'factId' in command &&
          command.factId === offer.soldOutFactId,
      )
    ) {
      issue(
        issues,
        `${path}/commands`,
        'invalid-reference',
        'One-time offer commands must set their sold-out fact atomically.',
      );
    }
  });

  const npcSpawns = new Set<string>();
  registry.npcs.forEach((npc, index) => {
    const path = `/npcs/${index}`;
    collectId(npc.spawnId, `${path}/spawnId`, npcSpawns, issues);
    reference(npc.actorId, indexes.actors, `${path}/actorId`, 'actor', issues);
    const actor = registry.actors.find(({ actorId }) => actorId === npc.actorId);
    if (actor !== undefined && actor.kind !== 'npc') {
      issue(
        issues,
        `${path}/actorId`,
        'invalid-reference',
        'NPC definition requires an NPC actor.',
      );
    }
    reference(npc.dialogueId, indexes.dialogue, `${path}/dialogueId`, 'dialogue', issues);
    validateDisplayName(npc.prompt, `${path}/prompt`, issues);
    nullableReference(npc.shopId, shopIds, `${path}/shopId`, 'shop', issues);
  });
}

function validateProgressionCommand(
  candidate: unknown,
  path: string,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    issue(issues, path, 'invalid-value', 'Progression command must be an object.');
    return;
  }
  const command = candidate as Readonly<Record<string, unknown>>;
  const kind = command.kind;
  if (typeof kind !== 'string') {
    issue(issues, `${path}/kind`, 'invalid-value', 'Progression command kind must be text.');
    return;
  }

  switch (kind) {
    case 'set-fact':
      validateCommandShape(command, ['kind', 'factId'], path, issues);
      commandReference(command.factId, indexes.facts, `${path}/factId`, 'quest fact', issues);
      return;
    case 'grant-item':
    case 'consume-item':
      validateCommandShape(command, ['kind', 'itemId', 'quantity'], path, issues);
      commandReference(command.itemId, indexes.items, `${path}/itemId`, 'item', issues);
      commandPositiveInteger(command.quantity, `${path}/quantity`, issues);
      return;
    case 'grant-currency':
    case 'spend-currency':
    case 'grant-xp':
    case 'increase-health':
    case 'increase-mana':
      validateCommandShape(command, ['kind', 'amount'], path, issues);
      commandPositiveInteger(command.amount, `${path}/amount`, issues);
      return;
    case 'unlock-ability':
      validateCommandShape(command, ['kind', 'abilityId'], path, issues);
      commandReference(
        command.abilityId,
        indexes.abilities,
        `${path}/abilityId`,
        'ability',
        issues,
      );
      return;
    case 'upgrade-weapon': {
      validateCommandShape(command, ['kind', 'fromLevel', 'toLevel'], path, issues);
      const validFrom = commandNonNegativeInteger(command.fromLevel, `${path}/fromLevel`, issues);
      const validTo = commandNonNegativeInteger(command.toLevel, `${path}/toLevel`, issues);
      if (validFrom !== null && validTo !== null && validTo !== validFrom + 1) {
        issue(
          issues,
          `${path}/toLevel`,
          'invalid-value',
          'Weapon upgrades must advance exactly one level.',
        );
      }
      return;
    }
    case 'open-chest':
      validateCommandReference(
        command,
        'chestId',
        new Set(indexes.chests.keys()),
        'chest',
        path,
        issues,
      );
      return;
    case 'activate-shortcut':
      validateCommandReference(command, 'shortcutId', indexes.shortcuts, 'shortcut', path, issues);
      return;
    case 'solve-puzzle':
      validateCommandReference(command, 'puzzleId', indexes.puzzles, 'puzzle', path, issues);
      return;
    case 'discover-room':
      validateCommandReference(
        command,
        'roomId',
        new Set(indexes.rooms.keys()),
        'room',
        path,
        issues,
      );
      return;
    case 'claim-discovery':
      validateCommandReference(
        command,
        'discoveryId',
        new Set(indexes.discoveries.keys()),
        'discovery',
        path,
        issues,
      );
      return;
    case 'defeat-boss':
      validateCommandReference(command, 'bossId', indexes.bosses, 'boss', path, issues);
      return;
    case 'rest':
      validateCommandShape(command, ['kind'], path, issues);
      return;
    default:
      issue(issues, `${path}/kind`, 'invalid-value', 'Unknown progression command.');
  }
}

function validateCommandReference(
  command: Readonly<Record<string, unknown>>,
  field: string,
  ids: ReadonlySet<string>,
  label: string,
  path: string,
  issues: MutableIssue[],
): void {
  validateCommandShape(command, ['kind', field], path, issues);
  commandReference(command[field], ids, `${path}/${field}`, label, issues);
}

function commandReference(
  value: unknown,
  ids: ReadonlySet<string>,
  path: string,
  label: string,
  issues: MutableIssue[],
): void {
  if (typeof value === 'string') reference(value, ids, path, label, issues);
  else issue(issues, path, 'invalid-id', 'Value must be a lowercase kebab-case stable ID.');
}

function commandPositiveInteger(value: unknown, path: string, issues: MutableIssue[]): void {
  if (typeof value === 'number') validatePositiveInteger(value, path, issues);
  else issue(issues, path, 'invalid-value', 'Value must be a positive safe integer.');
}

function commandNonNegativeInteger(
  value: unknown,
  path: string,
  issues: MutableIssue[],
): number | null {
  if (typeof value === 'number' && validateNonNegativeSafeInteger(value, path, issues))
    return value;
  if (typeof value !== 'number') {
    issue(issues, path, 'invalid-value', 'Value must be a non-negative safe integer.');
  }
  return null;
}

function validateCommandShape(
  command: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  path: string,
  issues: MutableIssue[],
): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(command)) {
    if (!allowed.has(key)) {
      issue(issues, `${path}/${key}`, 'invalid-value', 'Unknown progression command field.');
    }
  }
}

export function sortContentIssues(issues: readonly ContentIssue[]): readonly ContentIssue[] {
  return Object.freeze([...issues].sort(compareIssues).map((entry) => Object.freeze({ ...entry })));
}

function buildIndexes(registry: ContentRegistry, issues: MutableIssue[]): ContentIndexes {
  const assets = collectFlatIds(registry.assetKeys, (value) => value, '/assetKeys', '', issues);
  const backgrounds = collectFlatIds(
    registry.backgroundSets,
    ({ backgroundSetId }) => backgroundSetId,
    '/backgroundSets',
    'backgroundSetId',
    issues,
  );
  const ambience = collectFlatIds(
    registry.ambienceProfiles,
    ({ ambienceProfileId }) => ambienceProfileId,
    '/ambienceProfiles',
    'ambienceProfileId',
    issues,
  );
  const music = collectFlatIds(
    registry.musicCues,
    ({ musicCueId }) => musicCueId,
    '/musicCues',
    'musicCueId',
    issues,
  );
  const animations = collectFlatIds(
    registry.animationSets,
    ({ animationSetId }) => animationSetId,
    '/animationSets',
    'animationSetId',
    issues,
  );
  const audio = collectFlatIds(
    registry.audioSets,
    ({ audioSetId }) => audioSetId,
    '/audioSets',
    'audioSetId',
    issues,
  );
  const ai = collectFlatIds(
    registry.aiProfiles,
    ({ aiProfileId }) => aiProfileId,
    '/aiProfiles',
    'aiProfileId',
    issues,
  );
  const drops = collectFlatIds(
    registry.dropTables,
    ({ dropTableId }) => dropTableId,
    '/dropTables',
    'dropTableId',
    issues,
  );
  const areas = collectFlatIds(registry.areas, ({ areaId }) => areaId, '/areas', 'areaId', issues);
  const actors = collectFlatIds(
    registry.actors,
    ({ actorId }) => actorId,
    '/actors',
    'actorId',
    issues,
  );
  const bossIds = new Set<string>();
  registry.actors.forEach((actor, index) => {
    if (actor.kind === 'boss') {
      collectId(actor.bossId, `/actors/${index}/bossId`, bossIds, issues);
    }
  });
  const attacks = collectFlatIds(
    registry.attacks,
    ({ attackId }) => attackId,
    '/attacks',
    'attackId',
    issues,
  );
  const abilities = collectFlatIds(
    registry.abilities,
    ({ abilityId }) => abilityId,
    '/abilities',
    'abilityId',
    issues,
  );
  const items = collectFlatIds(registry.items, ({ itemId }) => itemId, '/items', 'itemId', issues);
  const quests = collectFlatIds(
    registry.quests,
    ({ definition }) => definition.questId,
    '/quests',
    'definition/questId',
    issues,
  );
  const dialogue = collectFlatIds(
    registry.dialogue,
    ({ dialogueId }) => dialogueId,
    '/dialogue',
    'dialogueId',
    issues,
  );
  const facts = new Set<string>();
  registry.quests.forEach((quest, questIndex) => {
    quest.declaredFacts.forEach((factId, factIndex) =>
      collectId(factId, `/quests/${questIndex}/declaredFacts/${factIndex}`, facts, issues),
    );
  });
  const puzzleIds = collectFlatIds(
    registry.puzzles,
    ({ puzzleId }) => puzzleId,
    '/puzzles',
    'puzzleId',
    issues,
  );

  const roomIds = new Set<string>();
  const surfaceIds = new Set<string>();
  const checkpointIds = new Set<string>();
  const mechanismIds = new Set<string>();
  const layerIds = new Set<string>();
  const zoneIds = new Set<string>();
  const spawnIds = new Set<string>();
  const triggerIds = new Set<string>();
  const transitionIds = new Set<string>();
  const propIds = new Set<string>();
  const discoveryIds = new Set<string>();
  const shortcutIds = new Set<string>();
  const encounterIds = new Set<string>();
  const chestIds = new Set<string>();
  const breakableIds = new Set<string>();
  const rooms = new Map<string, AreaId>();
  const surfaces = new Map<string, AreaId>();
  const checkpoints = new Map<string, AreaId>();
  const mechanisms = new Map<string, AreaId>();
  const spawns = new Map<string, AreaId>();
  const encounters = new Map<string, AreaId>();
  const chests = new Map<string, AreaId>();
  const discoveries = new Map<string, AreaId>();
  const breakables = new Map<string, AreaId>();
  const npcActorsBySpawn = new Map(
    registry.npcs.map(({ spawnId, actorId }) => [spawnId, actorId] as const),
  );

  registry.areas.forEach((area, areaIndex) => {
    area.rooms.forEach((room, index) => {
      collectId(room.roomId, `/areas/${areaIndex}/rooms/${index}/roomId`, roomIds, issues);
      if (room.discoveryId !== null)
        validateId(room.discoveryId, `/areas/${areaIndex}/rooms/${index}/discoveryId`, issues);
      if (!rooms.has(room.roomId)) rooms.set(room.roomId, area.areaId);
    });
    area.surfaces.forEach((surface, index) => {
      collectId(
        surface.surfaceId,
        `/areas/${areaIndex}/surfaces/${index}/surfaceId`,
        surfaceIds,
        issues,
      );
      if (!surfaces.has(surface.surfaceId)) surfaces.set(surface.surfaceId, area.areaId);
    });
    area.checkpoints.forEach((checkpoint, index) => {
      collectId(
        checkpoint.checkpointId,
        `/areas/${areaIndex}/checkpoints/${index}/checkpointId`,
        checkpointIds,
        issues,
      );
      if (!checkpoints.has(checkpoint.checkpointId)) {
        checkpoints.set(checkpoint.checkpointId, area.areaId);
      }
    });
    area.mechanisms.forEach((mechanism, index) => {
      collectId(
        mechanism.mechanismId,
        `/areas/${areaIndex}/mechanisms/${index}/mechanismId`,
        mechanismIds,
        issues,
      );
      if (mechanism.kind === 'shortcut') {
        collectId(
          mechanism.shortcutId,
          `/areas/${areaIndex}/mechanisms/${index}/shortcutId`,
          shortcutIds,
          issues,
        );
      }
      if (!mechanisms.has(mechanism.mechanismId)) {
        mechanisms.set(mechanism.mechanismId, area.areaId);
      }
    });
    area.layers.forEach((layer, index) =>
      collectId(layer.layerId, `/areas/${areaIndex}/layers/${index}/layerId`, layerIds, issues),
    );
    area.zones.forEach((zone, index) =>
      collectId(zone.zoneId, `/areas/${areaIndex}/zones/${index}/zoneId`, zoneIds, issues),
    );
    area.actorSpawns.forEach((spawn, index) => {
      collectId(
        spawn.spawnId,
        `/areas/${areaIndex}/actorSpawns/${index}/spawnId`,
        spawnIds,
        issues,
      );
      if (!spawns.has(spawn.spawnId)) spawns.set(spawn.spawnId, area.areaId);
    });
    area.triggers.forEach((trigger, index) =>
      collectId(
        trigger.triggerId,
        `/areas/${areaIndex}/triggers/${index}/triggerId`,
        triggerIds,
        issues,
      ),
    );
    area.transitions.forEach((transition, index) =>
      collectId(
        transition.transitionId,
        `/areas/${areaIndex}/transitions/${index}/transitionId`,
        transitionIds,
        issues,
      ),
    );
    area.encounters.forEach((encounter, index) => {
      collectId(
        encounter.encounterId,
        `/areas/${areaIndex}/encounters/${index}/encounterId`,
        encounterIds,
        issues,
      );
      if (!encounters.has(encounter.encounterId))
        encounters.set(encounter.encounterId, area.areaId);
    });
    area.chests.forEach((chest, index) => {
      collectId(chest.chestId, `/areas/${areaIndex}/chests/${index}/chestId`, chestIds, issues);
      if (!chests.has(chest.chestId)) chests.set(chest.chestId, area.areaId);
    });
    area.discoveries.forEach((discovery, index) => {
      collectId(
        discovery.discoveryId,
        `/areas/${areaIndex}/discoveries/${index}/discoveryId`,
        discoveryIds,
        issues,
      );
      if (!discoveries.has(discovery.discoveryId)) {
        discoveries.set(discovery.discoveryId, area.areaId);
      }
    });
    area.breakables.forEach((breakable, index) => {
      collectId(
        breakable.breakableId,
        `/areas/${areaIndex}/breakables/${index}/breakableId`,
        breakableIds,
        issues,
      );
      collectId(
        breakable.shortcutId,
        `/areas/${areaIndex}/breakables/${index}/shortcutId`,
        shortcutIds,
        issues,
      );
      if (!breakables.has(breakable.breakableId)) {
        breakables.set(breakable.breakableId, area.areaId);
      }
    });
    area.props.forEach((prop, index) =>
      collectId(prop.propId, `/areas/${areaIndex}/props/${index}/propId`, propIds, issues),
    );
  });

  return {
    assets,
    backgrounds,
    ambience,
    music,
    animations,
    audio,
    ai,
    drops,
    areas,
    actors,
    bosses: bossIds,
    attacks,
    abilities,
    items,
    quests,
    dialogue,
    facts,
    puzzles: puzzleIds,
    shortcuts: shortcutIds,
    rooms,
    surfaces,
    checkpoints,
    mechanisms,
    spawns,
    encounters,
    chests,
    discoveries,
    breakables,
    npcActorsBySpawn,
  };
}

function validateBossEncounter(
  encounter: BossEncounterDefinition,
  index: number,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  const path = `/bossEncounters/${index}`;
  validateId(encounter.encounterId, `${path}/encounterId`, issues);
  reference(encounter.bossId, indexes.bosses, `${path}/bossId`, 'boss', issues);
  reference(encounter.actorId, indexes.actors, `${path}/actorId`, 'actor', issues);
  validateId(encounter.spawnId, `${path}/spawnId`, issues);
  reference(encounter.areaId, indexes.areas, `${path}/areaId`, 'area', issues);
  referenceInArea(
    encounter.roomId,
    encounter.areaId,
    indexes.rooms,
    `${path}/roomId`,
    'room',
    issues,
  );
  referenceInArea(
    encounter.entryCheckpointId,
    encounter.areaId,
    indexes.checkpoints,
    `${path}/entryCheckpointId`,
    'checkpoint',
    issues,
  );
  validateRect(encounter.roomBounds, `${path}/roomBounds`, issues);
  validateContainedRect(
    encounter.combatBounds,
    encounter.roomBounds,
    `${path}/combatBounds`,
    issues,
  );
  validatePointInRoom(
    encounter.spawnPosition,
    encounter.roomBounds,
    `${path}/spawnPosition`,
    issues,
  );
  validatePointInRoom(
    encounter.phaseTwoBaseline,
    encounter.roomBounds,
    `${path}/phaseTwoBaseline`,
    issues,
  );
  encounter.hoverAnchors.forEach((anchor, anchorIndex) =>
    validatePointInRoom(
      anchor,
      encounter.roomBounds,
      `${path}/hoverAnchors/${anchorIndex}`,
      issues,
    ),
  );
  validatePositive(encounter.body.halfWidth, `${path}/body/halfWidth`, issues);
  validatePositive(encounter.body.height, `${path}/body/height`, issues);
  validatePositiveInteger(encounter.projectileCapacity, `${path}/projectileCapacity`, issues);
  validatePositiveInteger(encounter.hazardCapacity, `${path}/hazardCapacity`, issues);
  for (const [key, bounds] of [
    ['groundedHurtbox', encounter.groundedHurtbox],
    ['throatHurtbox', encounter.throatHurtbox],
    ['sealedShellHurtbox', encounter.sealedShellHurtbox],
    ['exposedHeartHurtbox', encounter.exposedHeartHurtbox],
  ] as const)
    validateRect(bounds, `${path}/${key}`, issues);
  const lensIds = new Set<string>();
  encounter.lenses.forEach((lens, lensIndex) => {
    validateId(lens.mechanismId, `${path}/lenses/${lensIndex}/mechanismId`, issues);
    if (lensIds.has(lens.mechanismId)) {
      issue(
        issues,
        `${path}/lenses/${lensIndex}/mechanismId`,
        'duplicate-id',
        'Boss lens IDs must be unique.',
      );
    }
    lensIds.add(lens.mechanismId);
    validatePointInRoom(
      lens.center,
      encounter.roomBounds,
      `${path}/lenses/${lensIndex}/center`,
      issues,
    );
    validatePositive(lens.activationRadius, `${path}/lenses/${lensIndex}/activationRadius`, issues);
  });
}

function validateSupportingContent(
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  registry.backgroundSets.forEach((background, index) =>
    background.textureKeys.forEach((assetKey, assetIndex) =>
      reference(
        assetKey,
        indexes.assets,
        `/backgroundSets/${index}/textureKeys/${assetIndex}`,
        'asset',
        issues,
      ),
    ),
  );
  registry.ambienceProfiles.forEach((ambience, index) =>
    nullableReference(
      ambience.audioSetId,
      indexes.audio,
      `/ambienceProfiles/${index}/audioSetId`,
      'audio set',
      issues,
    ),
  );
  registry.musicCues.forEach((cue, index) =>
    nullableReference(
      cue.assetKey,
      indexes.assets,
      `/musicCues/${index}/assetKey`,
      'asset',
      issues,
    ),
  );
  registry.animationSets.forEach((set, index) =>
    set.textureKeys.forEach((assetKey, assetIndex) =>
      reference(
        assetKey,
        indexes.assets,
        `/animationSets/${index}/textureKeys/${assetIndex}`,
        'asset',
        issues,
      ),
    ),
  );
  registry.audioSets.forEach((set, index) =>
    set.assetKeys.forEach((assetKey, assetIndex) =>
      reference(
        assetKey,
        indexes.assets,
        `/audioSets/${index}/assetKeys/${assetIndex}`,
        'asset',
        issues,
      ),
    ),
  );
  const profiledActors = new Set<string>();
  registry.aiProfiles.forEach((profile, profileIndex) => {
    const path = `/aiProfiles/${profileIndex}`;
    reference(profile.actorId, indexes.actors, `${path}/actorId`, 'actor', issues);
    const profileActor = registry.actors.find(({ actorId }) => actorId === profile.actorId);
    if (profileActor !== undefined && profileActor.kind !== 'enemy') {
      issue(
        issues,
        `${path}/actorId`,
        'invalid-reference',
        'AI profiles must reference an enemy actor.',
      );
    }
    if (profiledActors.has(profile.actorId)) {
      issue(issues, `${path}/actorId`, 'duplicate-id', 'An actor may own only one AI profile.');
    }
    profiledActors.add(profile.actorId);
    validateRect(profile.bodyBounds, `${path}/bodyBounds`, issues);
    if (profile.hurtboxes.length === 0) {
      issue(issues, `${path}/hurtboxes`, 'invalid-geometry', 'AI profiles require a hurtbox.');
    }
    profile.hurtboxes.forEach((hurtbox, index) =>
      validateRect(hurtbox, `${path}/hurtboxes/${index}`, issues),
    );
    validateVec(profile.eyeOffset, `${path}/eyeOffset`, issues);
    validateNonNegative(profile.awareness.wakeRange, `${path}/awareness/wakeRange`, issues);
    validateNonNegative(profile.awareness.sightRange, `${path}/awareness/sightRange`, issues);
    validateNonNegative(profile.awareness.verticalRange, `${path}/awareness/verticalRange`, issues);
    validateNonNegativeSafeInteger(
      profile.awareness.suspectMs,
      `${path}/awareness/suspectMs`,
      issues,
    );
    validateNonNegativeSafeInteger(
      profile.awareness.lostSightMs,
      `${path}/awareness/lostSightMs`,
      issues,
    );
    validateNonNegative(
      profile.awareness.cameraSleepMargin,
      `${path}/awareness/cameraSleepMargin`,
      issues,
    );
    validateNonNegative(profile.territory.patrolRange, `${path}/territory/patrolRange`, issues);
    validateNonNegative(profile.territory.leashRange, `${path}/territory/leashRange`, issues);
    if (profile.territory.leashRange < profile.territory.patrolRange) {
      issue(
        issues,
        `${path}/territory/leashRange`,
        'invalid-value',
        'Leash range must include the patrol range.',
      );
    }
    if (profile.territory.ledgeProbe !== null) {
      validatePositive(
        profile.territory.ledgeProbe.ahead,
        `${path}/territory/ledgeProbe/ahead`,
        issues,
      );
      validatePositive(
        profile.territory.ledgeProbe.depth,
        `${path}/territory/ledgeProbe/depth`,
        issues,
      );
    }
    validateNonNegative(profile.locomotion.speed, `${path}/locomotion/speed`, issues);
    if (profile.locomotion.kind === 'stationary' && profile.locomotion.speed !== 0) {
      issue(issues, `${path}/locomotion/speed`, 'invalid-value', 'Stationary speed must be zero.');
    }
    if (profile.frontalDefense !== null) {
      validateRange(
        profile.frontalDefense.multiplier,
        0,
        1,
        `${path}/frontalDefense/multiplier`,
        issues,
      );
      if (profile.frontalDefense.exposeCoreMs !== null) {
        validatePositiveInteger(
          profile.frontalDefense.exposeCoreMs,
          `${path}/frontalDefense/exposeCoreMs`,
          issues,
        );
      }
    }
    if (profile.attacks.length === 0) {
      issue(issues, `${path}/attacks`, 'invalid-reference', 'AI profiles require an attack.');
    }
    const profileAttackIds = new Set<string>();
    profile.attacks.forEach((pattern, patternIndex) => {
      const patternPath = `${path}/attacks/${patternIndex}`;
      reference(pattern.attackId, indexes.attacks, `${patternPath}/attackId`, 'attack', issues);
      if (profileAttackIds.has(pattern.attackId)) {
        issue(issues, `${patternPath}/attackId`, 'duplicate-id', 'Profile attacks must be unique.');
      }
      profileAttackIds.add(pattern.attackId);
      validateNonNegativeSafeInteger(pattern.telegraphMs, `${patternPath}/telegraphMs`, issues);
      validatePositiveInteger(pattern.activeMs, `${patternPath}/activeMs`, issues);
      validateNonNegativeSafeInteger(pattern.recoveryMs, `${patternPath}/recoveryMs`, issues);
      if (
        !Number.isFinite(pattern.band.minimumX) ||
        !Number.isFinite(pattern.band.maximumX) ||
        !Number.isFinite(pattern.band.vertical) ||
        pattern.band.minimumX < 0 ||
        pattern.band.maximumX < pattern.band.minimumX ||
        pattern.band.vertical < 0
      ) {
        issue(issues, `${patternPath}/band`, 'invalid-value', 'Attack band is invalid.');
      }
      if (
        (pattern.slotClass === 'elite') !== (pattern.pressureCost === 2) ||
        !['close', 'ranged', 'elite'].includes(pattern.slotClass)
      ) {
        issue(
          issues,
          `${patternPath}/pressureCost`,
          'invalid-value',
          'Elite pressure must be two and other pressure must be one.',
        );
      }
      validateNonNegative(pattern.cameraInset, `${patternPath}/cameraInset`, issues);
      validateAiMotion(pattern.motion, `${patternPath}/motion`, issues);

      const attack = registry.attacks.find(({ attackId }) => attackId === pattern.attackId);
      if (attack !== undefined) {
        const activeFrames = attack.hitboxes.reduce(
          (maximum, hitbox) => Math.max(maximum, hitbox.toFrame - hitbox.fromFrame + 1),
          0,
        );
        const authoredActiveMs = activeFrames * (1_000 / 60);
        if (activeFrames === 0 || Math.abs(authoredActiveMs - pattern.activeMs) > 1_000 / 60) {
          issue(
            issues,
            `${patternPath}/activeMs`,
            'invalid-reference',
            'Profile active timing must agree with attack hitbox frames within one fixed frame.',
          );
        }
      }
    });
  });
  registry.dropTables.forEach((table, tableIndex) => {
    table.entries.forEach((entry, entryIndex) => {
      const path = `/dropTables/${tableIndex}/entries/${entryIndex}`;
      reference(entry.itemId, indexes.items, `${path}/itemId`, 'item', issues);
      validatePositiveInteger(entry.quantity, `${path}/quantity`, issues);
      validatePositive(entry.weight, `${path}/weight`, issues);
    });
  });
}

function validateAiMotion(
  motion: import('./types').AiAttackMotion,
  path: string,
  issues: MutableIssue[],
): void {
  switch (motion.kind) {
    case 'melee':
    case 'hide':
      return;
    case 'lunge':
      validatePositive(motion.recoilSpeed, `${path}/recoilSpeed`, issues);
      return;
    case 'dive':
      validateNonNegativeSafeInteger(motion.hoverMs, `${path}/hoverMs`, issues);
      validatePositive(motion.arcDepth, `${path}/arcDepth`, issues);
      return;
    case 'plant':
      validateNonNegativeSafeInteger(motion.armsMs, `${path}/armsMs`, issues);
      validatePositiveInteger(motion.lifetimeMs, `${path}/lifetimeMs`, issues);
      validatePositiveInteger(motion.roomCap, `${path}/roomCap`, issues);
      validatePositiveInteger(motion.maxHits, `${path}/maxHits`, issues);
      return;
  }
}

function validateArea(
  area: AreaDefinition,
  areaIndex: number,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  const path = `/areas/${areaIndex}`;
  validateId(area.regionId, `${path}/regionId`, issues);
  validateDisplayName(area.displayName, `${path}/displayName`, issues);
  validateRect(area.bounds, `${path}/bounds`, issues);
  validatePositiveInteger(area.authoringGrid, `${path}/authoringGrid`, issues);
  nullableReference(
    area.backgroundSetId,
    indexes.backgrounds,
    `${path}/backgroundSetId`,
    'background set',
    issues,
  );
  nullableReference(
    area.ambienceProfileId,
    indexes.ambience,
    `${path}/ambienceProfileId`,
    'ambience profile',
    issues,
  );
  nullableReference(area.musicCueId, indexes.music, `${path}/musicCueId`, 'music cue', issues);

  area.layers.forEach((layer, index) => {
    const itemPath = `${path}/layers/${index}`;
    validateFinite(layer.depth, `${itemPath}/depth`, issues);
    validateVec(layer.parallax, `${itemPath}/parallax`, issues);
    validateVec(layer.offset, `${itemPath}/offset`, issues);
    if (layer.scope.kind === 'room') {
      referenceInArea(
        layer.scope.roomId,
        area.areaId,
        indexes.rooms,
        `${itemPath}/scope/roomId`,
        'room',
        issues,
      );
    }
    nullableReference(layer.textureKey, indexes.assets, `${itemPath}/textureKey`, 'asset', issues);
  });

  area.rooms.forEach((room, index) => {
    const itemPath = `${path}/rooms/${index}`;
    validateDisplayName(room.displayName, `${itemPath}/displayName`, issues);
    validateContainedRect(room.bounds, area.bounds, `${itemPath}/bounds`, issues);
    validateContainedRect(room.cameraBounds, room.bounds, `${itemPath}/cameraBounds`, issues);
    if (room.discoveryId !== null) {
      referenceInArea(
        room.discoveryId,
        area.areaId,
        indexes.discoveries,
        `${itemPath}/discoveryId`,
        'discovery',
        issues,
      );
    }
  });
  area.rooms.forEach((room, index) => {
    if (
      area.rooms.slice(0, index).some((previous) => rectanglesOverlap(previous.bounds, room.bounds))
    ) {
      issue(
        issues,
        `${path}/rooms/${index}/bounds`,
        'invalid-geometry',
        'Rooms within an area must not overlap.',
      );
    }
  });

  area.surfaces.forEach((surface, index) => {
    const itemPath = `${path}/surfaces/${index}`;
    const room = areaRoom(area, surface.roomId);
    referenceInArea(
      surface.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    if (room !== null)
      validateContainedRect(surface.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(surface.bounds, `${itemPath}/bounds`, issues);
    validateId(surface.materialId, `${itemPath}/materialId`, issues);
  });

  area.zones.forEach((zone, index) => {
    const itemPath = `${path}/zones/${index}`;
    const room = areaRoom(area, zone.roomId);
    referenceInArea(zone.roomId, area.areaId, indexes.rooms, `${itemPath}/roomId`, 'room', issues);
    if (room !== null)
      validateContainedRect(zone.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(zone.bounds, `${itemPath}/bounds`, issues);
    if (zone.kind === 'hazard') {
      reference(zone.attackId, indexes.attacks, `${itemPath}/attackId`, 'attack', issues);
    }
  });

  area.actorSpawns.forEach((spawn, index) => {
    const itemPath = `${path}/actorSpawns/${index}`;
    const room = areaRoom(area, spawn.roomId);
    referenceInArea(spawn.roomId, area.areaId, indexes.rooms, `${itemPath}/roomId`, 'room', issues);
    reference(spawn.actorId, indexes.actors, `${itemPath}/actorId`, 'actor', issues);
    validatePointInRoom(spawn.position, room?.bounds ?? null, `${itemPath}/position`, issues);
    if (spawn.encounterId !== null)
      validateId(spawn.encounterId, `${itemPath}/encounterId`, issues);
  });

  area.triggers.forEach((trigger, index) => {
    const itemPath = `${path}/triggers/${index}`;
    const room = areaRoom(area, trigger.roomId);
    referenceInArea(
      trigger.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    if (room !== null)
      validateContainedRect(trigger.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(trigger.bounds, `${itemPath}/bounds`, issues);
    const action = trigger.action;
    switch (action.kind) {
      case 'set-fact':
        reference(action.factId, indexes.facts, `${itemPath}/action/factId`, 'quest fact', issues);
        break;
      case 'start-dialogue':
        reference(
          action.dialogueId,
          indexes.dialogue,
          `${itemPath}/action/dialogueId`,
          'dialogue',
          issues,
        );
        break;
      case 'activate-mechanism':
        referenceInArea(
          action.mechanismId,
          area.areaId,
          indexes.mechanisms,
          `${itemPath}/action/mechanismId`,
          'mechanism',
          issues,
        );
        break;
      case 'start-boss':
        reference(action.bossId, indexes.bosses, `${itemPath}/action/bossId`, 'boss', issues);
        if (trigger.activation !== 'enter') {
          issue(
            issues,
            `${itemPath}/activation`,
            'invalid-value',
            'Boss thresholds require enter activation.',
          );
        }
        break;
      case 'interact-npc': {
        const spawn = area.actorSpawns.find(({ spawnId }) => spawnId === action.spawnId);
        if (spawn === undefined) {
          issue(
            issues,
            `${itemPath}/action/spawnId`,
            'missing-reference',
            'NPC interaction spawn does not exist in this area.',
          );
        } else {
          const npcActorId = indexes.npcActorsBySpawn.get(action.spawnId);
          if (
            npcActorId === undefined ||
            npcActorId !== spawn.actorId ||
            spawn.roomId !== trigger.roomId
          ) {
            issue(
              issues,
              `${itemPath}/action/spawnId`,
              'invalid-reference',
              'NPC interaction must reference a same-room authored NPC spawn.',
            );
          }
        }
        if (trigger.activation !== 'interact') {
          issue(
            issues,
            `${itemPath}/activation`,
            'invalid-value',
            'NPC interactions require interact activation.',
          );
        }
        break;
      }
      case 'activate-checkpoint':
        referenceInArea(
          action.checkpointId,
          area.areaId,
          indexes.checkpoints,
          `${itemPath}/action/checkpointId`,
          'checkpoint',
          issues,
        );
        if (action.areaId !== area.areaId) {
          issue(
            issues,
            `${itemPath}/action/areaId`,
            'invalid-reference',
            'Checkpoint interactions must remain in their authored area.',
          );
        }
        if (trigger.activation !== 'interact') {
          issue(
            issues,
            `${itemPath}/activation`,
            'invalid-value',
            'Checkpoint interactions require interact activation.',
          );
        }
        break;
    }
  });

  area.mechanisms.forEach((mechanism, index) => {
    const itemPath = `${path}/mechanisms/${index}`;
    const room = areaRoom(area, mechanism.roomId);
    referenceInArea(
      mechanism.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    if (room !== null)
      validateContainedRect(mechanism.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(mechanism.bounds, `${itemPath}/bounds`, issues);
    if (mechanism.kind === 'puzzle') {
      reference(mechanism.puzzleId, indexes.puzzles, `${itemPath}/puzzleId`, 'puzzle', issues);
    } else if (mechanism.kind === 'shortcut') {
      validateId(mechanism.shortcutId, `${itemPath}/shortcutId`, issues);
    } else {
      reference(mechanism.bossId, indexes.bosses, `${itemPath}/bossId`, 'boss', issues);
    }
    nullableReference(
      mechanism.requiredAbilityId,
      indexes.abilities,
      `${itemPath}/requiredAbilityId`,
      'ability',
      issues,
    );
    nullableReference(
      mechanism.requiredFactId,
      indexes.facts,
      `${itemPath}/requiredFactId`,
      'quest fact',
      issues,
    );
  });

  area.checkpoints.forEach((checkpoint, index) => {
    const itemPath = `${path}/checkpoints/${index}`;
    const room = areaRoom(area, checkpoint.roomId);
    validateDisplayName(checkpoint.displayName, `${itemPath}/displayName`, issues);
    referenceInArea(
      checkpoint.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    validatePointInRoom(
      checkpoint.interactionPosition,
      room?.bounds ?? null,
      `${itemPath}/interactionPosition`,
      issues,
    );
    if (room !== null) {
      validateContainedRect(checkpoint.safeZone, room.bounds, `${itemPath}/safeZone`, issues);
      validatePointInRoom(
        checkpoint.canonicalPosition,
        room.bounds,
        `${itemPath}/canonicalPosition`,
        issues,
      );
    } else {
      validateRect(checkpoint.safeZone, `${itemPath}/safeZone`, issues);
      validateVec(checkpoint.canonicalPosition, `${itemPath}/canonicalPosition`, issues);
    }
    if (
      isValidRect(checkpoint.safeZone) &&
      isValidVec(checkpoint.canonicalPosition) &&
      !rectContainsPoint(checkpoint.safeZone, checkpoint.canonicalPosition)
    ) {
      issue(
        issues,
        `${itemPath}/canonicalPosition`,
        'inaccessible-checkpoint',
        'Checkpoint canonical position must be inside its safe zone.',
      );
    }
  });

  area.transitions.forEach((transition, index) => {
    const itemPath = `${path}/transitions/${index}`;
    const room = areaRoom(area, transition.roomId);
    referenceInArea(
      transition.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    if (room !== null)
      validateContainedRect(transition.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(transition.bounds, `${itemPath}/bounds`, issues);
    validateWorldPredicate(transition.predicate, `${itemPath}/predicate`, indexes, issues);
    if (transition.kind === 'room') {
      const targetRoom = areaRoom(area, transition.targetRoomId);
      referenceInArea(
        transition.targetRoomId,
        area.areaId,
        indexes.rooms,
        `${itemPath}/targetRoomId`,
        'room',
        issues,
      );
      validatePointInRoom(
        transition.targetPosition,
        targetRoom?.bounds ?? null,
        `${itemPath}/targetPosition`,
        issues,
      );
      if (
        targetRoom !== null &&
        isValidVec(transition.targetPosition) &&
        !area.surfaces.some(
          (surface) =>
            surface.roomId === targetRoom.roomId &&
            transition.targetPosition.x >= surface.bounds.x &&
            transition.targetPosition.x < surface.bounds.x + surface.bounds.width &&
            transition.targetPosition.y === surface.bounds.y,
        )
      ) {
        issue(
          issues,
          `${itemPath}/targetPosition`,
          'inaccessible-checkpoint',
          'Room transition target must be supported by an authored surface.',
        );
      }
    } else {
      reference(transition.targetAreaId, indexes.areas, `${itemPath}/targetAreaId`, 'area', issues);
      const checkpointArea = indexes.checkpoints.get(transition.targetCheckpointId);
      if (checkpointArea === undefined) {
        missingReference(
          transition.targetCheckpointId,
          `${itemPath}/targetCheckpointId`,
          'checkpoint',
          issues,
        );
      } else if (checkpointArea !== transition.targetAreaId) {
        issue(
          issues,
          `${itemPath}/targetCheckpointId`,
          'invalid-reference',
          'Transition checkpoint does not belong to its target area.',
        );
      }
    }
  });

  area.encounters.forEach((encounter, index) => {
    const itemPath = `${path}/encounters/${index}`;
    const room = areaRoom(area, encounter.roomId);
    referenceInArea(
      encounter.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    if (room !== null) {
      validateContainedRect(
        encounter.activationBounds,
        room.bounds,
        `${itemPath}/activationBounds`,
        issues,
      );
    } else {
      validateRect(encounter.activationBounds, `${itemPath}/activationBounds`, issues);
    }
    validateWorldPredicate(encounter.predicate, `${itemPath}/predicate`, indexes, issues);
    const seen = new Set<string>();
    encounter.spawnIds.forEach((spawnId, spawnIndex) => {
      referenceInArea(
        spawnId,
        area.areaId,
        indexes.spawns,
        `${itemPath}/spawnIds/${spawnIndex}`,
        'actor spawn',
        issues,
      );
      if (seen.has(spawnId)) {
        issue(
          issues,
          `${itemPath}/spawnIds/${spawnIndex}`,
          'duplicate-id',
          'Encounter spawn IDs must be unique.',
        );
      }
      seen.add(spawnId);
      const spawn = area.actorSpawns.find((candidate) => candidate.spawnId === spawnId);
      if (
        spawn !== undefined &&
        (spawn.encounterId !== encounter.encounterId || spawn.roomId !== encounter.roomId)
      ) {
        issue(
          issues,
          `${itemPath}/spawnIds/${spawnIndex}`,
          'invalid-reference',
          'Encounter spawn must name this encounter in the same room.',
        );
      }
    });
    encounter.completionCommands.forEach((command, commandIndex) =>
      validateProgressionCommand(
        command,
        `${itemPath}/completionCommands/${commandIndex}`,
        indexes,
        issues,
      ),
    );
  });

  area.actorSpawns.forEach((spawn, spawnIndex) => {
    if (spawn.encounterId === null) return;
    const encounter = area.encounters.find(({ encounterId }) => encounterId === spawn.encounterId);
    if (encounter === undefined || !encounter.spawnIds.includes(spawn.spawnId)) {
      issue(
        issues,
        `${path}/actorSpawns/${spawnIndex}/encounterId`,
        'invalid-reference',
        'Encounter-owned spawn must appear exactly once in its encounter definition.',
      );
    }
  });

  area.chests.forEach((chest, index) => {
    const itemPath = `${path}/chests/${index}`;
    const room = areaRoom(area, chest.roomId);
    referenceInArea(chest.roomId, area.areaId, indexes.rooms, `${itemPath}/roomId`, 'room', issues);
    if (room !== null)
      validateContainedRect(chest.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(chest.bounds, `${itemPath}/bounds`, issues);
    validateDisplayName(chest.prompt, `${itemPath}/prompt`, issues);
    validateWorldPredicate(chest.predicate, `${itemPath}/predicate`, indexes, issues);
    chest.rewardCommands.forEach((command, commandIndex) => {
      if (command.kind === 'open-chest') {
        issue(
          issues,
          `${itemPath}/rewardCommands/${commandIndex}/kind`,
          'invalid-value',
          'Chest rewards must not author their derived ledger command.',
        );
      }
      validateProgressionCommand(
        command,
        `${itemPath}/rewardCommands/${commandIndex}`,
        indexes,
        issues,
      );
    });
  });

  area.discoveries.forEach((discovery, index) => {
    const itemPath = `${path}/discoveries/${index}`;
    const room = areaRoom(area, discovery.roomId);
    referenceInArea(
      discovery.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    validateDisplayName(discovery.displayName, `${itemPath}/displayName`, issues);
    validateDisplayName(discovery.description, `${itemPath}/description`, issues);
    if (discovery.activation === 'interact') {
      if (discovery.bounds === null) {
        issue(
          issues,
          `${itemPath}/bounds`,
          'invalid-geometry',
          'Interactive discovery needs bounds.',
        );
      } else if (room !== null) {
        validateContainedRect(discovery.bounds, room.bounds, `${itemPath}/bounds`, issues);
      }
    } else if (discovery.bounds !== null) {
      issue(
        issues,
        `${itemPath}/bounds`,
        'invalid-geometry',
        'Room-entry discovery cannot have bounds.',
      );
    }
    validateWorldPredicate(discovery.predicate, `${itemPath}/predicate`, indexes, issues);
    discovery.rewardCommands.forEach((command, commandIndex) => {
      if (command.kind === 'claim-discovery') {
        issue(
          issues,
          `${itemPath}/rewardCommands/${commandIndex}/kind`,
          'invalid-value',
          'Discovery rewards must not author their derived ledger command.',
        );
      }
      validateProgressionCommand(
        command,
        `${itemPath}/rewardCommands/${commandIndex}`,
        indexes,
        issues,
      );
    });
  });

  area.breakables.forEach((breakable, index) => {
    const itemPath = `${path}/breakables/${index}`;
    const room = areaRoom(area, breakable.roomId);
    referenceInArea(
      breakable.roomId,
      area.areaId,
      indexes.rooms,
      `${itemPath}/roomId`,
      'room',
      issues,
    );
    if (room !== null)
      validateContainedRect(breakable.bounds, room.bounds, `${itemPath}/bounds`, issues);
    else validateRect(breakable.bounds, `${itemPath}/bounds`, issues);
    validateDisplayName(breakable.displayName, `${itemPath}/displayName`, issues);
    reference(
      breakable.shortcutId,
      indexes.shortcuts,
      `${itemPath}/shortcutId`,
      'shortcut',
      issues,
    );
    breakable.acceptedAttackIds.forEach((attackId, attackIndex) =>
      reference(
        attackId,
        indexes.attacks,
        `${itemPath}/acceptedAttackIds/${attackIndex}`,
        'attack',
        issues,
      ),
    );
  });

  area.props.forEach((prop, index) => {
    const itemPath = `${path}/props/${index}`;
    const room = areaRoom(area, prop.roomId);
    referenceInArea(prop.roomId, area.areaId, indexes.rooms, `${itemPath}/roomId`, 'room', issues);
    validatePointInRoom(prop.position, room?.bounds ?? null, `${itemPath}/position`, issues);
    validateFinite(prop.depth, `${itemPath}/depth`, issues);
    nullableReference(prop.textureKey, indexes.assets, `${itemPath}/textureKey`, 'asset', issues);
    if (prop.surfaceId !== null) {
      referenceInArea(
        prop.surfaceId,
        area.areaId,
        indexes.surfaces,
        `${itemPath}/surfaceId`,
        'surface',
        issues,
      );
    }
  });
}

function validatePuzzle(
  puzzle: PuzzleDefinition,
  puzzleIndex: number,
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  const path = `/puzzles/${puzzleIndex}`;
  validateDisplayName(puzzle.displayName, `${path}/displayName`, issues);
  validateDisplayName(puzzle.description, `${path}/description`, issues);
  reference(puzzle.roomId, new Set(indexes.rooms.keys()), `${path}/roomId`, 'room', issues);
  validateWorldPredicate(puzzle.predicate, `${path}/predicate`, indexes, issues);

  const steps =
    puzzle.program.kind === 'item-lock' || puzzle.program.kind === 'single'
      ? [puzzle.program.step]
      : puzzle.program.steps;
  const seen = new Set<string>();
  steps.forEach((step, stepIndex) => {
    const stepPath = `${path}/program/${puzzle.program.kind === 'item-lock' || puzzle.program.kind === 'single' ? 'step' : `steps/${stepIndex}`}`;
    reference(
      step.mechanismId,
      new Set(indexes.mechanisms.keys()),
      `${stepPath}/mechanismId`,
      'mechanism',
      issues,
    );
    if (seen.has(step.mechanismId)) {
      issue(issues, `${stepPath}/mechanismId`, 'duplicate-id', 'Puzzle mechanisms must be unique.');
    }
    seen.add(step.mechanismId);
    const mechanism = registry.areas
      .flatMap(({ mechanisms }) => mechanisms)
      .find(({ mechanismId }) => mechanismId === step.mechanismId);
    if (
      mechanism !== undefined &&
      (mechanism.kind !== 'puzzle' ||
        mechanism.puzzleId !== puzzle.puzzleId ||
        mechanism.roomId !== puzzle.roomId)
    ) {
      issue(
        issues,
        `${stepPath}/mechanismId`,
        'invalid-reference',
        'Puzzle step must reference a same-room mechanism owned by this puzzle.',
      );
    }
    if (!['enter', 'interact', 'resonant-pulse'].includes(step.activation)) {
      issue(issues, `${stepPath}/activation`, 'invalid-value', 'Unknown puzzle activation.');
    }
  });

  for (const area of registry.areas) {
    for (const mechanism of area.mechanisms) {
      if (
        mechanism.kind === 'puzzle' &&
        mechanism.puzzleId === puzzle.puzzleId &&
        !seen.has(mechanism.mechanismId)
      ) {
        issue(
          issues,
          `${path}/program`,
          'invalid-reference',
          'Every puzzle-owned mechanism must appear exactly once in its program.',
        );
      }
    }
  }

  switch (puzzle.program.kind) {
    case 'timed-set':
      validatePositiveInteger(puzzle.program.windowMs, `${path}/program/windowMs`, issues);
      if (puzzle.program.steps.length < 2) {
        issue(
          issues,
          `${path}/program/steps`,
          'invalid-value',
          'Timed puzzle needs at least two steps.',
        );
      }
      break;
    case 'item-lock':
      reference(puzzle.program.itemId, indexes.items, `${path}/program/itemId`, 'item', issues);
      validatePositiveInteger(puzzle.program.quantity, `${path}/program/quantity`, issues);
      break;
    case 'single':
      if (puzzle.program.requiredWeaponLevel !== null) {
        validateNonNegativeSafeInteger(
          puzzle.program.requiredWeaponLevel,
          `${path}/program/requiredWeaponLevel`,
          issues,
        );
      }
      break;
    case 'ordered':
      if (puzzle.program.steps.length < 2) {
        issue(
          issues,
          `${path}/program/steps`,
          'invalid-value',
          'Ordered puzzle needs at least two steps.',
        );
      }
      break;
  }

  puzzle.rewardCommands.forEach((command, commandIndex) => {
    if (command.kind === 'solve-puzzle') {
      issue(
        issues,
        `${path}/rewardCommands/${commandIndex}/kind`,
        'invalid-value',
        'Puzzle rewards must not author their derived ledger command.',
      );
    }
    validateProgressionCommand(command, `${path}/rewardCommands/${commandIndex}`, indexes, issues);
  });
}

function validateWorldReachability(registry: ContentRegistry, issues: MutableIssue[]): void {
  const initialArea = registry.areas.find(
    ({ areaId }) => areaId === registry.newGame.initialAreaId,
  );
  const checkpoint = initialArea?.checkpoints.find(
    ({ checkpointId }) => checkpointId === registry.newGame.initialCheckpointId,
  );
  if (initialArea === undefined || checkpoint === undefined) return;

  const reachable = new Set(
    reachableWorldNodes(buildWorldGraph(registry), {
      areaId: initialArea.areaId,
      roomId: checkpoint.roomId,
    }).map(({ key }) => key),
  );
  registry.areas.forEach((area, areaIndex) => {
    area.rooms.forEach((room, roomIndex) => {
      if (!reachable.has(`${area.areaId}/${room.roomId}`)) {
        issue(
          issues,
          `/areas/${areaIndex}/rooms/${roomIndex}/roomId`,
          'invalid-reference',
          'Authored room is unreachable from the new-game world graph.',
        );
      }
    });
  });
}

function validateWorldPredicate(
  predicate: WorldPredicate,
  path: string,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  validatePredicateIds(
    predicate.requiresFacts,
    indexes.facts,
    `${path}/requiresFacts`,
    'quest fact',
    issues,
  );
  validatePredicateIds(
    predicate.excludesFacts,
    indexes.facts,
    `${path}/excludesFacts`,
    'quest fact',
    issues,
  );
  validatePredicateIds(
    predicate.requiresAbilities,
    indexes.abilities,
    `${path}/requiresAbilities`,
    'ability',
    issues,
  );
  validatePredicateIds(
    predicate.requiresSolvedPuzzles,
    indexes.puzzles,
    `${path}/requiresSolvedPuzzles`,
    'puzzle',
    issues,
  );
  validatePredicateIds(
    predicate.requiresActivatedShortcuts,
    indexes.shortcuts,
    `${path}/requiresActivatedShortcuts`,
    'shortcut',
    issues,
  );
  validatePredicateIds(
    predicate.requiresDefeatedBosses,
    indexes.bosses,
    `${path}/requiresDefeatedBosses`,
    'boss',
    issues,
  );
  validatePredicateIds(
    predicate.excludesDefeatedBosses,
    indexes.bosses,
    `${path}/excludesDefeatedBosses`,
    'boss',
    issues,
  );
  if (!Array.isArray(predicate.requiresItems)) {
    issue(issues, `${path}/requiresItems`, 'invalid-value', 'Predicate items must be an array.');
    return;
  }
  predicate.requiresItems.forEach((requirement, index) => {
    reference(
      requirement.itemId,
      indexes.items,
      `${path}/requiresItems/${index}/itemId`,
      'item',
      issues,
    );
    validatePositiveInteger(
      requirement.quantity,
      `${path}/requiresItems/${index}/quantity`,
      issues,
    );
  });
}

function rectanglesOverlap(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function validatePredicateIds(
  values: readonly string[],
  known: ReadonlySet<string>,
  path: string,
  label: string,
  issues: MutableIssue[],
): void {
  if (!Array.isArray(values)) {
    issue(issues, path, 'invalid-value', `Predicate ${label} requirements must be an array.`);
    return;
  }
  values.forEach((value, index) => reference(value, known, `${path}/${index}`, label, issues));
}

function validateActor(
  actor: ActorDefinition,
  actorIndex: number,
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  const path = `/actors/${actorIndex}`;
  validateDisplayName(actor.displayName, `${path}/displayName`, issues);
  validatePositive(actor.visualHeight, `${path}/visualHeight`, issues);
  validatePositive(actor.stats.maxHealth, `${path}/stats/maxHealth`, issues);
  validateNonNegative(actor.stats.maxMana, `${path}/stats/maxMana`, issues);
  validateNonNegative(actor.stats.attackPower, `${path}/stats/attackPower`, issues);
  validateNonNegativeSafeInteger(actor.stats.armour, `${path}/stats/armour`, issues);
  validateNonNegativeSafeInteger(actor.stats.maxPoise, `${path}/stats/maxPoise`, issues);
  validateNonNegative(actor.movement.maxSpeed, `${path}/movement/maxSpeed`, issues);
  validateNonNegative(actor.movement.jumpSpeed, `${path}/movement/jumpSpeed`, issues);
  validateNonNegative(actor.perception.range, `${path}/perception/range`, issues);
  const actorAttackIds = new Set<string>();
  actor.attackIds.forEach((attackId, index) => {
    reference(attackId, indexes.attacks, `${path}/attackIds/${index}`, 'attack', issues);
    if (actorAttackIds.has(attackId)) {
      issue(
        issues,
        `${path}/attackIds/${index}`,
        'duplicate-id',
        'Actor attack IDs must be unique.',
      );
    }
    actorAttackIds.add(attackId);
  });
  const resistanceIds = new Set<string>();
  actor.resistances.forEach((resistance, index) => {
    validateId(resistance.damageTypeId, `${path}/resistances/${index}/damageTypeId`, issues);
    if (resistanceIds.has(resistance.damageTypeId)) {
      issue(
        issues,
        `${path}/resistances/${index}/damageTypeId`,
        'duplicate-id',
        'Actor resistance damage types must be unique.',
      );
    }
    resistanceIds.add(resistance.damageTypeId);
    validateRange(resistance.multiplier, -1, 1, `${path}/resistances/${index}/multiplier`, issues);
  });
  nullableReference(actor.dropTableId, indexes.drops, `${path}/dropTableId`, 'drop table', issues);
  nullableReference(
    actor.animationSetId,
    indexes.animations,
    `${path}/animationSetId`,
    'animation set',
    issues,
  );
  nullableReference(actor.audioSetId, indexes.audio, `${path}/audioSetId`, 'audio set', issues);
  nullableReference(actor.aiProfileId, indexes.ai, `${path}/aiProfileId`, 'AI profile', issues);
  if (actor.kind === 'enemy') {
    if (actor.aiProfileId === null) {
      issue(
        issues,
        `${path}/aiProfileId`,
        'missing-reference',
        'Enemy actors require an AI profile.',
      );
    } else {
      const profile = registry.aiProfiles.find(
        ({ aiProfileId }) => aiProfileId === actor.aiProfileId,
      );
      if (profile !== undefined && profile.actorId !== actor.actorId) {
        issue(
          issues,
          `${path}/aiProfileId`,
          'invalid-reference',
          'Enemy actor and AI profile must reference each other.',
        );
      }
      if (profile !== undefined && actor.perception.range !== profile.awareness.sightRange) {
        issue(
          issues,
          `${path}/perception/range`,
          'invalid-reference',
          'Enemy sight range must agree with its AI profile.',
        );
      }
      if (profile !== undefined && actor.movement.maxSpeed !== profile.locomotion.speed) {
        issue(
          issues,
          `${path}/movement/maxSpeed`,
          'invalid-reference',
          'Enemy movement speed must agree with its AI locomotion profile.',
        );
      }
      if (
        profile !== undefined &&
        (actor.attackIds.length !== profile.attacks.length ||
          actor.attackIds.some((attackId) =>
            profile.attacks.every((pattern) => pattern.attackId !== attackId),
          ))
      ) {
        issue(
          issues,
          `${path}/attackIds`,
          'invalid-reference',
          'Enemy actor attacks must agree with its AI profile.',
        );
      }
    }
  }
  if (actor.kind !== 'boss') return;
  validateId(actor.bossId, `${path}/bossId`, issues);
  if (actor.phases.length === 0) {
    issue(issues, `${path}/phases`, 'invalid-boss', 'Boss actors require at least one phase.');
  }
  const phaseIds = new Set<string>();
  actor.phases.forEach((phase, phaseIndex) => {
    const phasePath = `${path}/phases/${phaseIndex}`;
    collectId(phase.phaseId, `${phasePath}/phaseId`, phaseIds, issues);
    if (phase.attackIds.length === 0) {
      issue(
        issues,
        `${phasePath}/attackIds`,
        'invalid-boss',
        'Boss phases require at least one attack.',
      );
    }
    phase.attackIds.forEach((attackId, attackIndex) =>
      reference(
        attackId,
        indexes.attacks,
        `${phasePath}/attackIds/${attackIndex}`,
        'attack',
        issues,
      ),
    );
  });
}

function validateQuestContent(
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  registry.quests.forEach((quest, questIndex) => {
    const path = `/quests/${questIndex}`;
    const stageIds = new Set<string>();
    quest.definition.stages.forEach((stage, stageIndex) => {
      const stagePath = `${path}/definition/stages/${stageIndex}`;
      collectId(stage.stageId, `${stagePath}/stageId`, stageIds, issues);
      validateDisplayName(stage.title ?? '', `${stagePath}/title`, issues);
      validateDisplayName(stage.objective ?? '', `${stagePath}/objective`, issues);
      stage.transitions.forEach((transition, transitionIndex) => {
        const transitionPath = `${stagePath}/transitions/${transitionIndex}`;
        validateId(transition.toStageId, `${transitionPath}/toStageId`, issues);
        transition.requiresAll.forEach((factId, factIndex) =>
          reference(
            factId,
            indexes.facts,
            `${transitionPath}/requiresAll/${factIndex}`,
            'quest fact',
            issues,
          ),
        );
        (transition.requiresAny ?? []).forEach((factId, factIndex) =>
          reference(
            factId,
            indexes.facts,
            `${transitionPath}/requiresAny/${factIndex}`,
            'quest fact',
            issues,
          ),
        );
      });
    });
    validateDisplayName(
      quest.definition.displayName ?? '',
      `${path}/definition/displayName`,
      issues,
    );
    try {
      new QuestStore([quest.definition]);
    } catch {
      issue(issues, `${path}/definition`, 'invalid-reference', 'Quest graph is invalid.');
    }
  });
}

function validateDialogueContent(
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  registry.dialogue.forEach((dialogue, dialogueIndex) => {
    const path = `/dialogue/${dialogueIndex}`;
    const nodeIds = new Set<string>();
    dialogue.nodes.forEach((node, nodeIndex) =>
      collectId(node.nodeId, `${path}/nodes/${nodeIndex}/nodeId`, nodeIds, issues),
    );
    reference(dialogue.entryNodeId, nodeIds, `${path}/entryNodeId`, 'dialogue node', issues);
    (dialogue.entryNodeIds ?? []).forEach((entryNodeId, entryIndex) =>
      reference(
        entryNodeId,
        nodeIds,
        `${path}/entryNodeIds/${entryIndex}`,
        'dialogue node',
        issues,
      ),
    );
    dialogue.nodes.forEach((node, nodeIndex) => {
      const nodePath = `${path}/nodes/${nodeIndex}`;
      reference(node.speakerActorId, indexes.actors, `${nodePath}/speakerActorId`, 'actor', issues);
      validateDisplayName(node.text, `${nodePath}/text`, issues);
      node.requiresAll.forEach((factId, factIndex) =>
        reference(
          factId,
          indexes.facts,
          `${nodePath}/requiresAll/${factIndex}`,
          'quest fact',
          issues,
        ),
      );
      validateDialogueCondition(node.condition, `${nodePath}/condition`, registry, indexes, issues);
      const choiceIds = new Set<string>();
      node.choices.forEach((choice, choiceIndex) => {
        const choicePath = `${nodePath}/choices/${choiceIndex}`;
        collectId(choice.choiceId, `${choicePath}/choiceId`, choiceIds, issues);
        validateDisplayName(choice.text, `${choicePath}/text`, issues);
        validateDialogueCondition(
          choice.condition,
          `${choicePath}/condition`,
          registry,
          indexes,
          issues,
        );
        nullableReference(
          choice.targetNodeId,
          nodeIds,
          `${choicePath}/targetNodeId`,
          'dialogue node',
          issues,
        );
        if (
          choice.rewardId !== undefined &&
          choice.rewardId !== null &&
          ![
            'aegis-veil',
            'lost-folio',
            'lanterns-for-the-absent',
            'heart-petal',
            'wellspring-seed',
            'blade-reforge',
          ].includes(choice.rewardId)
        ) {
          issue(
            issues,
            `${choicePath}/rewardId`,
            'invalid-value',
            'Dialogue reward ID is not supported.',
          );
        }
        choice.effects.forEach((effect, effectIndex) => {
          const effectPath = `${choicePath}/effects/${effectIndex}`;
          validateProgressionCommand(effect, effectPath, indexes, issues);
        });
      });
    });
    const entries = (dialogue.entryNodeIds ?? [dialogue.entryNodeId])
      .map((entryId) => dialogue.nodes.find(({ nodeId }) => nodeId === entryId))
      .filter((entry): entry is (typeof dialogue.nodes)[number] => entry !== undefined);
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        if (dialogueConditionsOverlap(entries[left]!, entries[right]!)) {
          issue(
            issues,
            `${path}/entryNodeIds`,
            'invalid-reference',
            'Dialogue entry conditions are ambiguous.',
          );
        }
      }
    }
  });
  try {
    new DialogueController(registry.dialogue);
  } catch {
    issue(issues, '/dialogue', 'invalid-reference', 'Dialogue graph is invalid.');
  }
}

function validateDialogueCondition(
  condition: import('./types').DialogueCondition | undefined,
  path: string,
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  if (condition === undefined) return;
  for (const [key, values] of [
    ['requiresFacts', condition.requiresFacts ?? []],
    ['excludesFacts', condition.excludesFacts ?? []],
  ] as const) {
    values.forEach((factId, index) =>
      reference(factId, indexes.facts, `${path}/${key}/${index}`, 'quest fact', issues),
    );
  }
  for (const [key, values] of [
    ['requiresDefeatedBosses', condition.requiresDefeatedBosses ?? []],
    ['excludesDefeatedBosses', condition.excludesDefeatedBosses ?? []],
  ] as const)
    values.forEach((bossId, index) => validateId(bossId, `${path}/${key}/${index}`, issues));
  for (const [key, requirements] of [
    ['questStages', condition.questStages ?? []],
    ['excludesQuestStages', condition.excludesQuestStages ?? []],
  ] as const)
    requirements.forEach((requirement, index) => {
      reference(
        requirement.questId,
        indexes.quests,
        `${path}/${key}/${index}/questId`,
        'quest',
        issues,
      );
      const quest = registry.quests.find(
        ({ definition }) => definition.questId === requirement.questId,
      );
      requirement.stageIds.forEach((stageId, stageIndex) => {
        if (!quest?.definition.stages.some((stage) => stage.stageId === stageId)) {
          missingReference(
            stageId,
            `${path}/${key}/${index}/stageIds/${stageIndex}`,
            'quest stage',
            issues,
          );
        }
      });
    });
}

function dialogueConditionsOverlap(
  left: import('./types').DialogueNodeDefinition,
  right: import('./types').DialogueNodeDefinition,
): boolean {
  const leftRequires = new Set([...left.requiresAll, ...(left.condition?.requiresFacts ?? [])]);
  const rightRequires = new Set([...right.requiresAll, ...(right.condition?.requiresFacts ?? [])]);
  if ([...(left.condition?.excludesFacts ?? [])].some((id) => rightRequires.has(id))) return false;
  if ([...(right.condition?.excludesFacts ?? [])].some((id) => leftRequires.has(id))) return false;
  const leftBosses = new Set(left.condition?.requiresDefeatedBosses ?? []);
  const rightBosses = new Set(right.condition?.requiresDefeatedBosses ?? []);
  if ((left.condition?.excludesDefeatedBosses ?? []).some((id) => rightBosses.has(id)))
    return false;
  if ((right.condition?.excludesDefeatedBosses ?? []).some((id) => leftBosses.has(id)))
    return false;
  for (const leftStage of left.condition?.questStages ?? []) {
    const rightStage = (right.condition?.questStages ?? []).find(
      ({ questId }) => questId === leftStage.questId,
    );
    if (
      rightStage !== undefined &&
      !leftStage.stageIds.some((id) => rightStage.stageIds.includes(id))
    )
      return false;
  }
  if (
    requiredStagesAreExcluded(
      left.condition?.questStages ?? [],
      right.condition?.excludesQuestStages ?? [],
    ) ||
    requiredStagesAreExcluded(
      right.condition?.questStages ?? [],
      left.condition?.excludesQuestStages ?? [],
    )
  )
    return false;
  return true;
}

function requiredStagesAreExcluded(
  required: readonly Readonly<{
    questId: import('../core/StableId').StableId<'quest'>;
    stageIds: readonly import('../core/StableId').StableId<'quest-stage'>[];
  }>[],
  excluded: readonly Readonly<{
    questId: import('../core/StableId').StableId<'quest'>;
    stageIds: readonly import('../core/StableId').StableId<'quest-stage'>[];
  }>[],
): boolean {
  return required.some((requirement) => {
    const exclusion = excluded.find(({ questId }) => questId === requirement.questId);
    return (
      exclusion !== undefined &&
      requirement.stageIds.every((stageId) => exclusion.stageIds.includes(stageId))
    );
  });
}

function validateNewGame(
  registry: ContentRegistry,
  indexes: ContentIndexes,
  issues: MutableIssue[],
): void {
  const definition = registry.newGame;
  const path = '/newGame';
  validateId(definition.initialRegionId, `${path}/initialRegionId`, issues);
  reference(definition.initialAreaId, indexes.areas, `${path}/initialAreaId`, 'area', issues);
  const area = registry.areas.find(({ areaId }) => areaId === definition.initialAreaId);
  if (area !== undefined && area.regionId !== definition.initialRegionId) {
    issue(
      issues,
      `${path}/initialRegionId`,
      'invalid-reference',
      'New-game region does not own its initial area.',
    );
  }
  const checkpointArea = indexes.checkpoints.get(definition.initialCheckpointId);
  if (checkpointArea === undefined) {
    missingReference(
      definition.initialCheckpointId,
      `${path}/initialCheckpointId`,
      'checkpoint',
      issues,
    );
  } else if (checkpointArea !== definition.initialAreaId) {
    issue(
      issues,
      `${path}/initialCheckpointId`,
      'invalid-reference',
      'New-game checkpoint does not belong to its initial area.',
    );
  }
  validatePositiveInteger(definition.baseStats.maxHealth, `${path}/baseStats/maxHealth`, issues);
  validatePositiveInteger(definition.baseStats.maxMana, `${path}/baseStats/maxMana`, issues);
  validatePositiveInteger(
    definition.baseStats.attackPower,
    `${path}/baseStats/attackPower`,
    issues,
  );
  validateNonNegativeSafeInteger(definition.baseStats.armour, `${path}/baseStats/armour`, issues);
  const startingAbilities = new Set<string>();
  definition.startingAbilities.forEach((abilityId, index) => {
    const abilityPath = `${path}/startingAbilities/${index}`;
    reference(abilityId, indexes.abilities, abilityPath, 'ability', issues);
    collectReferenceId(abilityId, abilityPath, startingAbilities, issues);
  });
  const initialQuestIds = new Set<string>();
  definition.initialQuests.stages.forEach((questState, index) => {
    const statePath = `${path}/initialQuests/stages/${index}`;
    const validStageId = validateId(questState.stageId, `${statePath}/stageId`, issues);
    collectReferenceId(questState.questId, `${statePath}/questId`, initialQuestIds, issues);
    validateSortedEntry(
      definition.initialQuests.stages,
      index,
      ({ questId }) => questId,
      `${statePath}/questId`,
      issues,
    );
    if (!indexes.quests.has(questState.questId)) {
      missingReference(questState.questId, `${statePath}/questId`, 'quest', issues);
      return;
    }
    const quest = registry.quests.find(
      ({ definition: questDefinition }) => questDefinition.questId === questState.questId,
    );
    if (
      validStageId &&
      !quest?.definition.stages.some(({ stageId }) => stageId === questState.stageId)
    ) {
      missingReference(questState.stageId, `${statePath}/stageId`, 'quest stage', issues);
    }
  });
  const initialFacts = new Set<string>();
  definition.initialQuests.flags.forEach((factId, index) => {
    const factPath = `${path}/initialQuests/flags/${index}`;
    reference(factId, indexes.facts, factPath, 'quest fact', issues);
    collectReferenceId(factId, factPath, initialFacts, issues);
    validateSortedEntry(definition.initialQuests.flags, index, (value) => value, factPath, issues);
  });
}

function collectFlatIds<Value>(
  values: readonly Value[],
  readId: (value: Value) => string,
  rootPath: string,
  fieldPath: string,
  issues: MutableIssue[],
): Set<string> {
  const ids = new Set<string>();
  values.forEach((value, index) => {
    const suffix = fieldPath.length === 0 ? '' : `/${fieldPath}`;
    collectId(readId(value), `${rootPath}/${index}${suffix}`, ids, issues);
  });
  return ids;
}

function collectId(value: string, path: string, ids: Set<string>, issues: MutableIssue[]): void {
  if (!validateId(value, path, issues)) return;
  if (ids.has(value)) {
    issue(issues, path, 'duplicate-id', 'Stable ID is duplicated in its namespace.');
    return;
  }
  ids.add(value);
}

function collectReferenceId(
  value: string,
  path: string,
  ids: Set<string>,
  issues: MutableIssue[],
): void {
  if (!isStableId(value)) return;
  if (ids.has(value)) {
    issue(issues, path, 'duplicate-id', 'Stable ID is duplicated in this reference list.');
  } else {
    ids.add(value);
  }
}

function validateSortedEntry<Value>(
  values: readonly Value[],
  index: number,
  readId: (value: Value) => string,
  path: string,
  issues: MutableIssue[],
): void {
  if (index === 0) return;
  const previous = values[index - 1];
  const current = values[index];
  if (previous !== undefined && current !== undefined && readId(previous) > readId(current)) {
    issue(issues, path, 'invalid-value', 'Stable-ID references must be sorted.');
  }
}

function validateId(value: unknown, path: string, issues: MutableIssue[]): value is string {
  if (isStableId(value)) return true;
  issue(issues, path, 'invalid-id', 'Value must be a lowercase kebab-case stable ID.');
  return false;
}

function reference(
  value: string,
  ids: ReadonlySet<string>,
  path: string,
  label: string,
  issues: MutableIssue[],
): void {
  if (!validateId(value, path, issues) || ids.has(value)) return;
  missingReference(value, path, label, issues);
}

function nullableReference(
  value: string | null,
  ids: ReadonlySet<string>,
  path: string,
  label: string,
  issues: MutableIssue[],
): void {
  if (value !== null) reference(value, ids, path, label, issues);
}

function missingReference(
  value: string,
  path: string,
  label: string,
  issues: MutableIssue[],
): void {
  if (!validateId(value, path, issues)) return;
  issue(issues, path, 'missing-reference', `Referenced ${label} does not exist.`);
}

function referenceInArea(
  value: string,
  areaId: AreaId,
  owners: ReadonlyMap<string, AreaId>,
  path: string,
  label: string,
  issues: MutableIssue[],
): void {
  if (!validateId(value, path, issues)) return;
  const owner = owners.get(value);
  if (owner === undefined) {
    issue(issues, path, 'missing-reference', `Referenced ${label} does not exist.`);
  } else if (owner !== areaId) {
    issue(issues, path, 'invalid-reference', `Referenced ${label} belongs to another area.`);
  }
}

function validateDisplayName(value: string, path: string, issues: MutableIssue[]): void {
  if (typeof value === 'string' && value.trim().length > 0) return;
  issue(issues, path, 'invalid-value', 'Display text must not be empty.');
}

function validateFinite(value: number, path: string, issues: MutableIssue[]): boolean {
  if (Number.isFinite(value)) return true;
  issue(issues, path, 'invalid-value', 'Value must be finite.');
  return false;
}

function validateNonNegative(value: number, path: string, issues: MutableIssue[]): boolean {
  if (validateFinite(value, path, issues) && value >= 0) return true;
  if (Number.isFinite(value)) issue(issues, path, 'invalid-value', 'Value must not be negative.');
  return false;
}

function validateNonNegativeSafeInteger(
  value: number,
  path: string,
  issues: MutableIssue[],
): boolean {
  if (isNonNegativeSafeInteger(value)) return true;
  issue(issues, path, 'invalid-value', 'Value must be a non-negative safe integer.');
  return false;
}

function validateRange(
  value: number,
  minimum: number,
  maximum: number,
  path: string,
  issues: MutableIssue[],
): boolean {
  if (Number.isFinite(value) && value >= minimum && value <= maximum) return true;
  issue(issues, path, 'invalid-value', `Value must be between ${minimum} and ${maximum}.`);
  return false;
}

function validatePositive(value: number, path: string, issues: MutableIssue[]): boolean {
  if (validateFinite(value, path, issues) && value > 0) return true;
  if (Number.isFinite(value)) issue(issues, path, 'invalid-value', 'Value must be positive.');
  return false;
}

function validatePositiveInteger(value: number, path: string, issues: MutableIssue[]): boolean {
  if (Number.isSafeInteger(value) && value > 0) return true;
  issue(issues, path, 'invalid-value', 'Value must be a positive safe integer.');
  return false;
}

function validateVec(value: Vec2, path: string, issues: MutableIssue[]): boolean {
  const validX = validateFinite(value.x, `${path}/x`, issues);
  const validY = validateFinite(value.y, `${path}/y`, issues);
  return validX && validY;
}

function isValidVec(value: Vec2): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validateRect(value: Rect, path: string, issues: MutableIssue[]): boolean {
  if (isValidRect(value)) return true;
  issue(
    issues,
    path,
    'invalid-geometry',
    'Rectangle coordinates must be finite and dimensions must be positive.',
  );
  return false;
}

function validateRelativeRect(value: Rect, path: string, issues: MutableIssue[]): boolean {
  const validX = validateFinite(value.x, `${path}/x`, issues);
  const validY = validateFinite(value.y, `${path}/y`, issues);
  const validWidth = validatePositive(value.width, `${path}/width`, issues);
  const validHeight = validatePositive(value.height, `${path}/height`, issues);
  return validX && validY && validWidth && validHeight;
}

function isValidRect(value: Rect): boolean {
  return (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    Number.isFinite(value.x + value.width) &&
    Number.isFinite(value.y + value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

function validateContainedRect(
  value: Rect,
  container: Rect,
  path: string,
  issues: MutableIssue[],
): void {
  if (!validateRect(value, path, issues)) return;
  if (!isValidRect(container) || !rectContainsRect(container, value)) {
    issue(issues, path, 'invalid-geometry', 'Rectangle must be inside its declared bounds.');
  }
}

function validatePointInRoom(
  value: Vec2,
  roomBounds: Rect | null,
  path: string,
  issues: MutableIssue[],
): void {
  if (!validateVec(value, path, issues) || roomBounds === null || !isValidRect(roomBounds)) return;
  if (!rectContainsPoint(roomBounds, value)) {
    issue(issues, path, 'invalid-geometry', 'Position must be inside its declared room.');
  }
}

function validateFrameRange(
  fromFrame: number,
  toFrame: number,
  totalFrames: number,
  path: string,
  issues: MutableIssue[],
): void {
  if (
    Number.isSafeInteger(fromFrame) &&
    Number.isSafeInteger(toFrame) &&
    fromFrame >= 0 &&
    toFrame >= fromFrame &&
    toFrame < totalFrames
  ) {
    return;
  }
  issue(
    issues,
    path,
    'invalid-value',
    'Frame range must be ordered and inside the attack duration.',
  );
}

function areaRoom(area: AreaDefinition, roomId: RoomId) {
  return area.rooms.find((room) => room.roomId === roomId) ?? null;
}

function issue(
  issues: MutableIssue[],
  path: string,
  code: ContentIssue['code'],
  message: string,
): void {
  issues.push({ severity: 'error', code, path, message });
}

function compareIssues(left: MutableIssue, right: MutableIssue): number {
  return (
    compareCodeUnits(left.path, right.path) ||
    compareCodeUnits(left.code, right.code) ||
    compareCodeUnits(left.message, right.message)
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
