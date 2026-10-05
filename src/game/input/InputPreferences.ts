import { patchSaveSettings } from '../config/accessibility';
import { InputService } from './InputService';
import type { SaveSettingsPatch } from '../config/accessibility';
import type { HapticsPort } from './Haptics';
import type { InputDevicePort } from './InputService';
import type { SaveService } from '../saves/SaveService';
import type { SaveSlotId, SaveV1 } from '../saves/SaveSchema';

export function createInputServiceFromSave(
  save: SaveV1,
  devicePort: InputDevicePort,
  haptics?: HapticsPort,
): InputService {
  return new InputService(devicePort, {
    bindingOverrides: save.bindingOverrides,
    sustainedAction: save.settings.sustainedAction,
    haptics,
  });
}

export function queueInputPreferences(
  saveService: SaveService,
  slotId: SaveSlotId,
  save: SaveV1,
  input: InputService,
  settingsPatch: SaveSettingsPatch = {},
): SaveV1 {
  if (settingsPatch.sustainedAction !== undefined) {
    input.setSustainedActionMode(settingsPatch.sustainedAction);
  }
  const patched = patchSaveSettings(
    Object.freeze({
      ...save,
      bindingOverrides: input.serializeBindingOverrides(),
    }),
    settingsPatch,
  );
  saveService.queueAutosave(slotId, patched);
  return patched;
}
