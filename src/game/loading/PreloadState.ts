export type PreloadAssetKind = 'image' | 'audio' | 'json';

export type PreloadManifestEntry = Readonly<{
  key: string;
  group: string;
  kind: PreloadAssetKind;
  url: string;
}>;

export type PreloadManifest = readonly PreloadManifestEntry[];
export type PreloadOutcome = 'loaded' | 'failed';

export type PreloadState = Readonly<{
  manifest: PreloadManifest;
  outcomes: readonly Readonly<{ key: string; outcome: PreloadOutcome }>[];
}>;

export type PreloadProgress = Readonly<{
  completed: number;
  total: number;
  percentage: number;
  currentGroup: string | null;
  failedGroups: readonly string[];
  failedKeys: readonly string[];
  complete: boolean;
  successful: boolean;
}>;

export function createPreloadState(manifest: PreloadManifest): PreloadState {
  return Object.freeze({ manifest: uniqueManifest(manifest), outcomes: Object.freeze([]) });
}

export function restartPreloadState(manifest: PreloadManifest): PreloadState {
  return createPreloadState(manifest);
}

export function recordPreloadOutcome(
  state: PreloadState,
  key: string,
  outcome: PreloadOutcome,
): PreloadState {
  if (!state.manifest.some((entry) => entry.key === key)) return state;
  if (state.outcomes.some((entry) => entry.key === key)) return state;
  return Object.freeze({
    manifest: state.manifest,
    outcomes: Object.freeze([...state.outcomes, Object.freeze({ key, outcome })]),
  });
}

export function preparePreloadRetry(state: PreloadState): PreloadState {
  return Object.freeze({
    manifest: state.manifest,
    outcomes: Object.freeze(
      state.outcomes.filter(({ outcome }) => outcome === 'loaded').map((entry) => entry),
    ),
  });
}

export function selectPendingAssets(
  manifest: PreloadManifest,
  state: PreloadState,
): PreloadManifest {
  const loadedKeys = new Set(
    state.outcomes.filter(({ outcome }) => outcome === 'loaded').map(({ key }) => key),
  );
  return Object.freeze(uniqueManifest(manifest).filter(({ key }) => !loadedKeys.has(key)));
}

export function preloadProgress(state: PreloadState): PreloadProgress {
  const outcomeByKey = new Map(state.outcomes.map(({ key, outcome }) => [key, outcome]));
  const total = state.manifest.length;
  const completed = outcomeByKey.size;
  const failedEntries = state.manifest.filter(({ key }) => outcomeByKey.get(key) === 'failed');
  const currentEntry =
    state.manifest.find(({ key }) => !outcomeByKey.has(key)) ?? state.manifest.at(-1) ?? null;
  const complete = completed === total;
  return Object.freeze({
    completed,
    total,
    percentage: total === 0 ? 100 : Math.floor((completed / total) * 100),
    currentGroup: currentEntry?.group ?? null,
    failedGroups: Object.freeze(uniqueStrings(failedEntries.map(({ group }) => group))),
    failedKeys: Object.freeze(failedEntries.map(({ key }) => key)),
    complete,
    successful: complete && failedEntries.length === 0,
  });
}

function uniqueManifest(manifest: PreloadManifest): PreloadManifest {
  const keys = new Set<string>();
  const unique: PreloadManifestEntry[] = [];
  for (const entry of manifest) {
    if (keys.has(entry.key)) continue;
    keys.add(entry.key);
    unique.push(Object.freeze({ ...entry }));
  }
  return Object.freeze(unique);
}

function uniqueStrings(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
