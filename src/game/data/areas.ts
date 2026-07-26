import type { AmbienceProfileDefinition, AreaDefinition, StableId } from './types';
import { brackenreachTrailArea } from './areas/brackenreachTrail';
import { hollowChoirArea } from './areas/hollowChoir';
import { reliquaryVergeArea } from './areas/reliquaryVerge';
import { rootglassReliquaryArea } from './areas/rootglassReliquary';
import { singingHollowsArea } from './areas/singingHollows';
import { wrensRestArea } from './areas/wrensRest';

export { BrackenreachAssetKeys } from './areas/shared';

export const INITIAL_WORLD_AREA_ID = 'brackenreach-trail';

export const ambienceProfiles: readonly AmbienceProfileDefinition[] = [
  {
    id: 'brackenreach-rain',
    musicCueId: 'brackenreach-trail-music',
    ambientCueIds: ['soft-rain', 'distant-route-chimes', 'wet-leaves'],
    rain: { enabled: true, density: 0.42, drift: -0.16 },
    colour: { shadow: '#171325', light: '#9ee7d7' }
  },
  {
    id: 'listening-arch-hush',
    musicCueId: 'brackenreach-arch-music',
    ambientCueIds: ['soft-rain', 'hushed-root-hum'],
    rain: { enabled: true, density: 0.3, drift: -0.12 },
    colour: { shadow: '#27213a', light: '#f5c96a' }
  },
  {
    id: 'wrens-rest-evening',
    musicCueId: 'wrens-rest-music',
    ambientCueIds: ['settlement-murmur', 'lantern-crackle'],
    rain: { enabled: false, density: 0, drift: 0 },
    colour: { shadow: '#241d33', light: '#f5c96a' }
  },
  {
    id: 'singing-hollows-echo',
    musicCueId: 'singing-hollows-music',
    ambientCueIds: ['cave-drips', 'far-chime-echo'],
    rain: { enabled: false, density: 0, drift: 0 },
    colour: { shadow: '#120f1f', light: '#9ee7d7' }
  },
  {
    id: 'reliquary-verge-glass',
    musicCueId: 'reliquary-verge-music',
    ambientCueIds: ['glass-wind', 'root-strain'],
    rain: { enabled: true, density: 0.2, drift: -0.08 },
    colour: { shadow: '#1c1730', light: '#ee765f' }
  },
  {
    id: 'reliquary-depths',
    musicCueId: 'rootglass-reliquary-music',
    ambientCueIds: ['deep-water-lap', 'reliquary-hum'],
    rain: { enabled: false, density: 0, drift: 0 },
    colour: { shadow: '#100d1c', light: '#bc8ae8' }
  },
  {
    id: 'hollow-choir-still',
    musicCueId: 'hollow-choir-music',
    ambientCueIds: ['held-breath-silence', 'porcelain-tick'],
    rain: { enabled: false, density: 0, drift: 0 },
    colour: { shadow: '#0d0a18', light: '#f0e3c0' }
  }
];

export const areaDefinitions: readonly AreaDefinition[] = [
  wrensRestArea,
  brackenreachTrailArea,
  singingHollowsArea,
  reliquaryVergeArea,
  rootglassReliquaryArea,
  hollowChoirArea
];

export function getAreaDefinition(id: StableId): AreaDefinition | undefined {
  return areaDefinitions.find((area) => area.id === id);
}
