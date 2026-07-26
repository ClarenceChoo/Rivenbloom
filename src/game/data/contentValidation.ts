import type { ContentIssue, ContentRegistry } from './types';

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateContent(registry: ContentRegistry): readonly ContentIssue[] {
  const issues: ContentIssue[] = [];
  const validateStableId = (id: string, path: string): void => {
    if (STABLE_ID_PATTERN.test(id)) return;
    issues.push({
      code: 'invalid-stable-id',
      path,
      id,
      message: 'Stable IDs must use lowercase kebab-case.'
    });
  };
  const validateStableIdGroup = (
    definitions: readonly { readonly id: string }[],
    path: string
  ): void => {
    definitions.forEach((definition, index) => {
      validateStableId(definition.id, `${path}[${index}].id`);
    });
  };
  const collections = [
    ['areas', registry.areas],
    ['actors', registry.actors],
    ['attacks', registry.attacks],
    ['abilities', registry.abilities],
    ['items', registry.items],
    ['quests', registry.quests],
    ['dialogues', registry.dialogues],
    ['ambienceProfiles', registry.ambienceProfiles]
  ] as const;

  for (const [collectionName, definitions] of collections) {
    const seenIds = new Set<string>();
    definitions.forEach((definition, index) => {
      validateStableId(definition.id, `${collectionName}[${index}].id`);
      if (seenIds.has(definition.id)) {
        issues.push({
          code: 'duplicate-id',
          path: `${collectionName}[${index}].id`,
          id: definition.id,
          message: `Duplicate ${collectionName} ID "${definition.id}".`
        });
      }
      seenIds.add(definition.id);
    });
  }

  registry.areas.forEach((area, areaIndex) => {
    const areaPath = `areas[${areaIndex}]`;
    validateStableIdGroup(area.rooms, `${areaPath}.rooms`);
    validateStableIdGroup(area.layers, `${areaPath}.layers`);
    validateStableIdGroup(area.surfaces, `${areaPath}.surfaces`);
    validateStableIdGroup(area.playerSpawns, `${areaPath}.playerSpawns`);
    validateStableIdGroup(area.actorSpawns, `${areaPath}.actorSpawns`);
    validateStableIdGroup(area.triggers, `${areaPath}.triggers`);
    validateStableIdGroup(area.mechanisms, `${areaPath}.mechanisms`);
    validateStableIdGroup(area.checkpoints, `${areaPath}.checkpoints`);
    validateStableIdGroup(area.transitions, `${areaPath}.transitions`);
    validateStableIdGroup(area.props, `${areaPath}.props`);
    area.rooms.forEach((room, roomIndex) => {
      validateStableId(room.discoveryId, `${areaPath}.rooms[${roomIndex}].discoveryId`);
    });
    area.mechanisms.forEach((mechanism, mechanismIndex) => {
      validateStableId(
        mechanism.persistentFlagId,
        `${areaPath}.mechanisms[${mechanismIndex}].persistentFlagId`
      );
    });
  });
  registry.quests.forEach((quest, questIndex) => {
    validateStableIdGroup(quest.stages, `quests[${questIndex}].stages`);
  });
  registry.dialogues.forEach((dialogue, dialogueIndex) => {
    validateStableIdGroup(dialogue.nodes, `dialogues[${dialogueIndex}].nodes`);
    dialogue.nodes.forEach((node, nodeIndex) => {
      validateStableIdGroup(
        node.choices,
        `dialogues[${dialogueIndex}].nodes[${nodeIndex}].choices`
      );
    });
  });

  const ids = {
    areas: new Set(registry.areas.map(({ id }) => id)),
    actors: new Set(registry.actors.map(({ id }) => id)),
    attacks: new Set(registry.attacks.map(({ id }) => id)),
    abilities: new Set(registry.abilities.map(({ id }) => id)),
    items: new Set(registry.items.map(({ id }) => id)),
    quests: new Set(registry.quests.map(({ id }) => id)),
    dialogues: new Set(registry.dialogues.map(({ id }) => id)),
    ambienceProfiles: new Set(registry.ambienceProfiles.map(({ id }) => id))
  };

  const addUnresolved = (
    referenceId: string | undefined,
    knownIds: ReadonlySet<string>,
    path: string,
    registryName: string
  ): void => {
    if (referenceId === undefined || knownIds.has(referenceId)) return;
    issues.push({
      code: 'unresolved-reference',
      path,
      id: referenceId,
      message: `Unresolved ${registryName} reference "${referenceId}".`
    });
  };

  const addMissing = (path: string, message: string, id?: string): void => {
    issues.push({
      code: 'missing-required-field',
      path,
      ...(id === undefined ? {} : { id }),
      message
    });
  };

  registry.actors.forEach((actor, actorIndex) => {
    if (actor.displayName.trim().length === 0) {
      addMissing(`actors[${actorIndex}].displayName`, 'Actors require a display name.', actor.id);
    }
    if (actor.hurtboxes.length === 0) {
      addMissing(
        `actors[${actorIndex}].hurtboxes`,
        'Actors require at least one authored hurtbox.',
        actor.id
      );
    }
    if (actor.kind === 'boss') {
      if (actor.boss === undefined) {
        addMissing(
          `actors[${actorIndex}].boss`,
          'Boss actors require a boss content contract.',
          actor.id
        );
      } else {
        if (actor.boss.phaseOneAttackIds.length === 0) {
          addMissing(
            `actors[${actorIndex}].boss.phaseOneAttackIds`,
            'Boss actors require at least one phase-one attack.',
            actor.id
          );
        }
        if (actor.boss.phaseTwoAttackIds.length === 0) {
          addMissing(
            `actors[${actorIndex}].boss.phaseTwoAttackIds`,
            'Boss actors require at least one phase-two attack.',
            actor.id
          );
        }
        if (actor.boss.transitionAttackId.length === 0) {
          addMissing(
            `actors[${actorIndex}].boss.transitionAttackId`,
            'Boss actors require a transition attack.',
            actor.id
          );
        }
        if (actor.boss.requiredMechanismIds.length === 0) {
          addMissing(
            `actors[${actorIndex}].boss.requiredMechanismIds`,
            'Boss actors require at least one phase-two mechanism.',
            actor.id
          );
        }
        if (actor.boss.defeatItemId.length === 0) {
          addMissing(
            `actors[${actorIndex}].boss.defeatItemId`,
            'Boss actors require a defeat reward item.',
            actor.id
          );
        }
        if (actor.boss.defeatQuestId.length === 0) {
          addMissing(
            `actors[${actorIndex}].boss.defeatQuestId`,
            'Boss actors require a defeat quest.',
            actor.id
          );
        }
        actor.boss.phaseOneAttackIds.forEach((attackId, attackIndex) => {
          addUnresolved(
            attackId,
            ids.attacks,
            `actors[${actorIndex}].boss.phaseOneAttackIds[${attackIndex}]`,
            'attacks'
          );
        });
        actor.boss.phaseTwoAttackIds.forEach((attackId, attackIndex) => {
          addUnresolved(
            attackId,
            ids.attacks,
            `actors[${actorIndex}].boss.phaseTwoAttackIds[${attackIndex}]`,
            'attacks'
          );
        });
        addUnresolved(
          actor.boss.transitionAttackId,
          ids.attacks,
          `actors[${actorIndex}].boss.transitionAttackId`,
          'attacks'
        );
        addUnresolved(
          actor.boss.defeatItemId,
          ids.items,
          `actors[${actorIndex}].boss.defeatItemId`,
          'items'
        );
        addUnresolved(
          actor.boss.defeatQuestId,
          ids.quests,
          `actors[${actorIndex}].boss.defeatQuestId`,
          'quests'
        );
      }
    }
    actor.attackIds.forEach((attackId, attackIndex) => {
      addUnresolved(
        attackId,
        ids.attacks,
        `actors[${actorIndex}].attackIds[${attackIndex}]`,
        'attacks'
      );
    });
    actor.abilityIds.forEach((abilityId, abilityIndex) => {
      addUnresolved(
        abilityId,
        ids.abilities,
        `actors[${actorIndex}].abilityIds[${abilityIndex}]`,
        'abilities'
      );
    });
    actor.drops.forEach((drop, dropIndex) => {
      addUnresolved(
        drop.itemId,
        ids.items,
        `actors[${actorIndex}].drops[${dropIndex}].itemId`,
        'items'
      );
    });
  });

  registry.abilities.forEach((ability, abilityIndex) => {
    if (ability.displayName.trim().length === 0) {
      addMissing(
        `abilities[${abilityIndex}].displayName`,
        'Abilities require a display name.',
        ability.id
      );
    }
    addUnresolved(ability.attackId, ids.attacks, `abilities[${abilityIndex}].attackId`, 'attacks');
    addUnresolved(
      ability.requiredQuestId,
      ids.quests,
      `abilities[${abilityIndex}].requiredQuestId`,
      'quests'
    );
  });

  registry.items.forEach((item, itemIndex) => {
    if (item.displayName.trim().length === 0) {
      addMissing(`items[${itemIndex}].displayName`, 'Items require a display name.', item.id);
    }
    if (item.description.trim().length === 0) {
      addMissing(`items[${itemIndex}].description`, 'Items require a description.', item.id);
    }
    item.abilityIds.forEach((abilityId, abilityIndex) => {
      addUnresolved(
        abilityId,
        ids.abilities,
        `items[${itemIndex}].abilityIds[${abilityIndex}]`,
        'abilities'
      );
    });
  });

  const questStageIds = new Set(
    registry.quests.flatMap(({ stages }) => stages.map(({ id }) => id))
  );
  registry.quests.forEach((quest, questIndex) => {
    if (quest.displayName.trim().length === 0) {
      addMissing(`quests[${questIndex}].displayName`, 'Quests require a display name.', quest.id);
    }
    if (quest.stages.length === 0) {
      addMissing(`quests[${questIndex}].stages`, 'Quests require at least one stage.', quest.id);
    }
    const localStageIds = new Set(quest.stages.map(({ id }) => id));
    addUnresolved(
      quest.initialStageId,
      localStageIds,
      `quests[${questIndex}].initialStageId`,
      'quest stages'
    );
    quest.prerequisiteQuestIds.forEach((questId, prerequisiteIndex) => {
      addUnresolved(
        questId,
        ids.quests,
        `quests[${questIndex}].prerequisiteQuestIds[${prerequisiteIndex}]`,
        'quests'
      );
    });
    quest.stages.forEach((stage, stageIndex) => {
      const stagePath = `quests[${questIndex}].stages[${stageIndex}]`;
      addUnresolved(stage.dialogueId, ids.dialogues, `${stagePath}.dialogueId`, 'dialogues');
      stage.requiredItemIds.forEach((itemId, itemIndex) => {
        addUnresolved(itemId, ids.items, `${stagePath}.requiredItemIds[${itemIndex}]`, 'items');
      });
      stage.grantedItemIds.forEach((itemId, itemIndex) => {
        addUnresolved(itemId, ids.items, `${stagePath}.grantedItemIds[${itemIndex}]`, 'items');
      });
      stage.grantedAbilityIds.forEach((abilityId, abilityIndex) => {
        addUnresolved(
          abilityId,
          ids.abilities,
          `${stagePath}.grantedAbilityIds[${abilityIndex}]`,
          'abilities'
        );
      });
    });
  });

  registry.dialogues.forEach((dialogue, dialogueIndex) => {
    if (dialogue.nodes.length === 0) {
      addMissing(
        `dialogues[${dialogueIndex}].nodes`,
        'Dialogues require at least one node.',
        dialogue.id
      );
    }
    const nodeIds = new Set(dialogue.nodes.map(({ id }) => id));
    addUnresolved(
      dialogue.entryNodeId,
      nodeIds,
      `dialogues[${dialogueIndex}].entryNodeId`,
      'dialogue nodes'
    );
    dialogue.nodes.forEach((node, nodeIndex) => {
      const nodePath = `dialogues[${dialogueIndex}].nodes[${nodeIndex}]`;
      addUnresolved(node.speakerActorId, ids.actors, `${nodePath}.speakerActorId`, 'actors');
      addUnresolved(node.nextNodeId, nodeIds, `${nodePath}.nextNodeId`, 'dialogue nodes');
      addUnresolved(node.questId, ids.quests, `${nodePath}.questId`, 'quests');
      addUnresolved(node.questStageId, questStageIds, `${nodePath}.questStageId`, 'quest stages');
      node.choices.forEach((choice, choiceIndex) => {
        const choicePath = `${nodePath}.choices[${choiceIndex}]`;
        addUnresolved(choice.nextNodeId, nodeIds, `${choicePath}.nextNodeId`, 'dialogue nodes');
        addUnresolved(
          choice.requiredQuestId,
          ids.quests,
          `${choicePath}.requiredQuestId`,
          'quests'
        );
      });
    });
  });

  const areasById = new Map(registry.areas.map((area) => [area.id, area] as const));
  registry.areas.forEach((area, areaIndex) => {
    const areaPath = `areas[${areaIndex}]`;
    const roomIds = new Set(area.rooms.map(({ id }) => id));
    const spawnIds = new Set(area.playerSpawns.map(({ id }) => id));
    const triggerIds = new Set(area.triggers.map(({ id }) => id));
    const surfaceIds = new Set(area.surfaces.map(({ id }) => id));
    const mechanismIds = new Set(area.mechanisms.map(({ id }) => id));

    if (area.displayName.trim().length === 0) {
      addMissing(`${areaPath}.displayName`, 'Areas require a display name.');
    }
    if (area.rooms.length === 0) {
      addMissing(`${areaPath}.rooms`, 'Areas require at least one room.');
    }
    if (area.layers.length === 0) {
      addMissing(`${areaPath}.layers`, 'Areas require at least one visual layer.');
    }
    if (area.surfaces.length === 0) {
      addMissing(`${areaPath}.surfaces`, 'Areas require at least one collision surface.');
    }
    if (area.playerSpawns.length === 0) {
      addMissing(`${areaPath}.playerSpawns`, 'Areas require at least one player spawn.');
    }
    addUnresolved(area.defaultSpawnId, spawnIds, `${areaPath}.defaultSpawnId`, 'player spawns');
    addUnresolved(
      area.ambienceProfileId,
      ids.ambienceProfiles,
      `${areaPath}.ambienceProfileId`,
      'ambience profiles'
    );
    area.rooms.forEach((room, roomIndex) => {
      addUnresolved(
        room.ambienceProfileId,
        ids.ambienceProfiles,
        `${areaPath}.rooms[${roomIndex}].ambienceProfileId`,
        'ambience profiles'
      );
    });
    area.layers.forEach((layer, layerIndex) => {
      addUnresolved(
        layer.roomId,
        roomIds,
        `${areaPath}.layers[${layerIndex}].roomId`,
        'area rooms'
      );
    });
    area.surfaces.forEach((surface, surfaceIndex) => {
      addUnresolved(
        surface.roomId,
        roomIds,
        `${areaPath}.surfaces[${surfaceIndex}].roomId`,
        'area rooms'
      );
    });
    area.playerSpawns.forEach((spawn, spawnIndex) => {
      addUnresolved(
        spawn.roomId,
        roomIds,
        `${areaPath}.playerSpawns[${spawnIndex}].roomId`,
        'area rooms'
      );
    });
    area.actorSpawns.forEach((spawn, spawnIndex) => {
      const spawnPath = `${areaPath}.actorSpawns[${spawnIndex}]`;
      addUnresolved(spawn.roomId, roomIds, `${spawnPath}.roomId`, 'area rooms');
      addUnresolved(spawn.actorId, ids.actors, `${spawnPath}.actorId`, 'actors');
    });
    area.triggers.forEach((trigger, triggerIndex) => {
      addUnresolved(
        trigger.roomId,
        roomIds,
        `${areaPath}.triggers[${triggerIndex}].roomId`,
        'area rooms'
      );
    });
    area.mechanisms.forEach((mechanism, mechanismIndex) => {
      const mechanismPath = `${areaPath}.mechanisms[${mechanismIndex}]`;
      addUnresolved(mechanism.roomId, roomIds, `${mechanismPath}.roomId`, 'area rooms');
      addUnresolved(mechanism.triggerId, triggerIds, `${mechanismPath}.triggerId`, 'area triggers');
      addUnresolved(
        mechanism.requiredAbilityId,
        ids.abilities,
        `${mechanismPath}.requiredAbilityId`,
        'abilities'
      );
      addUnresolved(mechanism.questId, ids.quests, `${mechanismPath}.questId`, 'quests');
      addUnresolved(mechanism.rewardItemId, ids.items, `${mechanismPath}.rewardItemId`, 'items');
    });
    area.checkpoints.forEach((checkpoint, checkpointIndex) => {
      const checkpointPath = `${areaPath}.checkpoints[${checkpointIndex}]`;
      addUnresolved(checkpoint.roomId, roomIds, `${checkpointPath}.roomId`, 'area rooms');
      addUnresolved(
        checkpoint.triggerId,
        triggerIds,
        `${checkpointPath}.triggerId`,
        'area triggers'
      );
      addUnresolved(checkpoint.spawnId, spawnIds, `${checkpointPath}.spawnId`, 'player spawns');
    });
    area.transitions.forEach((transition, transitionIndex) => {
      const transitionPath = `${areaPath}.transitions[${transitionIndex}]`;
      addUnresolved(transition.roomId, roomIds, `${transitionPath}.roomId`, 'area rooms');
      addUnresolved(
        transition.triggerId,
        triggerIds,
        `${transitionPath}.triggerId`,
        'area triggers'
      );
      addUnresolved(
        transition.destinationAreaId,
        ids.areas,
        `${transitionPath}.destinationAreaId`,
        'areas'
      );
      const destinationSpawnIds = new Set(
        areasById.get(transition.destinationAreaId)?.playerSpawns.map(({ id }) => id) ?? []
      );
      addUnresolved(
        transition.destinationSpawnId,
        destinationSpawnIds,
        `${transitionPath}.destinationSpawnId`,
        'player spawns'
      );
    });
    area.props.forEach((prop, propIndex) => {
      const propPath = `${areaPath}.props[${propIndex}]`;
      addUnresolved(prop.roomId, roomIds, `${propPath}.roomId`, 'area rooms');
      addUnresolved(prop.surfaceId, surfaceIds, `${propPath}.surfaceId`, 'area surfaces');
      addUnresolved(prop.mechanismId, mechanismIds, `${propPath}.mechanismId`, 'area mechanisms');
    });
  });

  return issues;
}
