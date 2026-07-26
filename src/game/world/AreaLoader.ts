import type { AreaDefinition, LoadedArea, LoadedRoom } from '../data/types';

export class AreaLoader {
  public load(definition: AreaDefinition): LoadedArea {
    const initialSpawn = definition.playerSpawns.find(
      (spawn) => spawn.id === definition.defaultSpawnId
    );
    if (initialSpawn === undefined) {
      throw new Error(
        `Area "${definition.id}" default spawn "${definition.defaultSpawnId}" does not exist.`
      );
    }

    return {
      areaId: definition.id,
      displayName: definition.displayName,
      regionId: definition.regionId,
      bounds: definition.bounds,
      ambienceProfileId: definition.ambienceProfileId,
      initialSpawn,
      layers: [...definition.layers].sort((left, right) => left.depth - right.depth),
      rooms: definition.rooms.map((room): LoadedRoom => {
        const belongsToRoom = (entry: { readonly roomId?: string }): boolean =>
          entry.roomId === room.id;
        return {
          id: room.id,
          displayName: room.displayName,
          bounds: room.bounds,
          discoveryId: room.discoveryId,
          ambienceProfileId: room.ambienceProfileId ?? definition.ambienceProfileId,
          layerIds: definition.layers.filter(belongsToRoom).map(({ id }) => id),
          surfaceIds: definition.surfaces.filter(belongsToRoom).map(({ id }) => id),
          playerSpawnIds: definition.playerSpawns.filter(belongsToRoom).map(({ id }) => id),
          actorSpawnIds: definition.actorSpawns.filter(belongsToRoom).map(({ id }) => id),
          triggerIds: definition.triggers.filter(belongsToRoom).map(({ id }) => id),
          mechanismIds: definition.mechanisms.filter(belongsToRoom).map(({ id }) => id),
          checkpointIds: definition.checkpoints.filter(belongsToRoom).map(({ id }) => id),
          transitionIds: definition.transitions.filter(belongsToRoom).map(({ id }) => id),
          propIds: definition.props.filter(belongsToRoom).map(({ id }) => id)
        };
      })
    };
  }
}
