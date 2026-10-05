export type FocusTarget = Readonly<{ id: string; available: boolean }>;
export type FocusDirection = 'next' | 'previous';

export type FocusModel = Readonly<{
  targets: readonly string[];
  activeId: string | null;
  restoreId: string | null;
  modal: boolean;
}>;

export function createFocusModel(
  targets: readonly FocusTarget[],
  preferredId?: string,
): FocusModel {
  const available = availableIds(targets);
  return freezeModel({
    targets: available,
    activeId: selectTarget(available, preferredId ?? null),
    restoreId: null,
    modal: false,
  });
}

export function replaceFocusTargets(
  model: FocusModel,
  targets: readonly FocusTarget[],
): FocusModel {
  const available = availableIds(targets);
  return freezeModel({
    ...model,
    targets: available,
    activeId: selectTarget(available, model.activeId),
  });
}

export function moveFocus(model: FocusModel, direction: FocusDirection): FocusModel {
  if (model.targets.length === 0) return model;
  const currentIndex = model.activeId === null ? -1 : model.targets.indexOf(model.activeId);
  const delta = direction === 'next' ? 1 : -1;
  const start = currentIndex < 0 ? (direction === 'next' ? -1 : 0) : currentIndex;
  const nextIndex = (start + delta + model.targets.length) % model.targets.length;
  return freezeModel({ ...model, activeId: model.targets[nextIndex] ?? null });
}

export function openFocusModal(
  model: FocusModel,
  targets: readonly FocusTarget[],
  initialId: string,
): FocusModel {
  const available = availableIds(targets);
  return freezeModel({
    targets: available,
    activeId: selectTarget(available, initialId),
    restoreId: model.activeId,
    modal: true,
  });
}

export function closeFocusModal(model: FocusModel, targets: readonly FocusTarget[]): FocusModel {
  const available = availableIds(targets);
  return freezeModel({
    targets: available,
    activeId: selectTarget(available, model.restoreId),
    restoreId: null,
    modal: false,
  });
}

function availableIds(targets: readonly FocusTarget[]): readonly string[] {
  const seen = new Set<string>();
  return Object.freeze(
    targets
      .filter(({ id, available }) => available && id.length > 0 && !seen.has(id) && seen.add(id))
      .map(({ id }) => id),
  );
}

function selectTarget(targets: readonly string[], preferredId: string | null): string | null {
  if (preferredId !== null && targets.includes(preferredId)) return preferredId;
  return targets[0] ?? null;
}

function freezeModel(model: FocusModel): FocusModel {
  return Object.freeze({ ...model, targets: Object.freeze([...model.targets]) });
}
