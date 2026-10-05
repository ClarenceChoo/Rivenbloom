export function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

export function immutableClone<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}
