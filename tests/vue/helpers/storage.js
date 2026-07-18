function createMemoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    get length() {
      return data.size;
    },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
  };
}

export function installMemoryStorage(entries = {}) {
  const storage = createMemoryStorage(entries);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  });
  return storage;
}
