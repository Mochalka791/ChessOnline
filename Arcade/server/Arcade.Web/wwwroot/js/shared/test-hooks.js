const hookRegistry = {};

export function registerTestHooks(feature, hooks) {
  hookRegistry[feature] = hooks;
}

export function getTestHooks() {
  return structuredClone(hookRegistry);
}
