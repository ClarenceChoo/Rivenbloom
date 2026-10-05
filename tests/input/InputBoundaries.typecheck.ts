import type { Binding } from '../../src/game/input/bindings';
import type { SustainedActionMode } from '../../src/game/input/InputService';
import type { InputBinding, SaveSettings } from '../../src/game/saves/SaveSchema';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

type BindingUsesSaveDomain = Assert<Equal<Binding, InputBinding>>;
type SustainedModeUsesSaveDomain = Assert<
  Equal<SustainedActionMode, SaveSettings['sustainedAction']>
>;

export type InputBoundaryAssertions = BindingUsesSaveDomain | SustainedModeUsesSaveDomain;
