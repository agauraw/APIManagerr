const _plugins = new Map();
const _subscribers = new Set();

function notify() {
  _subscribers.forEach((fn) => fn());
}

export function registerPlugin(def) {
  if (!def?.id) throw new Error('Plugin must have an id');
  _plugins.set(def.id, def);
  notify();
}

export function unregisterPlugin(id) {
  _plugins.delete(id);
  notify();
}

export function getPlugin(id) {
  return _plugins.get(id);
}

export function getAllPlugins() {
  return [..._plugins.values()];
}

export function subscribe(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}
