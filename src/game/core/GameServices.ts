import { createServiceToken } from './ServiceRegistry';
import type { InputService } from '../input/InputService';
import type { SaveRepository } from '../saves/SaveRepository';
import type { SaveService } from '../saves/SaveService';
import type { AccessibilitySettings } from '../config/accessibility';

export const GAME_SERVICES_REGISTRY_KEY = 'rivenbloom-services';
export const SAVE_WARNING_REGISTRY_KEY = 'rivenbloom-save-warning';

export const InputServiceToken = createServiceToken<InputService>('input-service');
export const SaveRepositoryToken = createServiceToken<SaveRepository>('save-repository');
export const SaveServiceToken = createServiceToken<SaveService>('save-service');
export const AccessibilitySettingsToken =
  createServiceToken<AccessibilitySettings>('accessibility-settings');
