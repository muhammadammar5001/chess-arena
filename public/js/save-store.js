/**
 * Chess Arena — SaveStore
 *
 * The single persistence facade for the whole game. It exposes the familiar
 * synchronous localStorage-shaped API (getItem / setItem / removeItem / key /
 * length) so existing game code keeps working, but the data itself lives in
 * PlayGama Bridge Storage whenever the game runs on a real platform.
 *
 * Why this exists
 * ---------------
 * PlayGama requirement 3.2.1 forbids localStorage / sessionStorage / IndexedDB /
 * cookies on the host: progress must go through `bridge.storage` so it reaches
 * cloud saves. Reading is synchronous because the game reads settings in its
 * constructor, so we hydrate the known keys once (`bridge.storage.get`) before
 * the app is created, keep an in-memory cache, and flush writes back in a
 * debounced batch (`bridge.storage.set`).
 *
 * On the standalone web build (no platform id, e.g. localhost or a self-hosted
 * deployment) behaviour falls back to localStorage so development and the
 * desktop build keep their saves. That path is never taken inside PlayGama,
 * YouTube Playables or any other Bridge host.
 *
 * Public API
 * ----------
 *   SaveStore.ready          Promise resolved once storage has been hydrated
 *   SaveStore.getItem(k)     string | null
 *   SaveStore.setItem(k, v)  stores a string value
 *   SaveStore.removeItem(k)  deletes a key
 *   SaveStore.key(i)         key name at index i (insertion order)
 *   SaveStore.length         number of cached keys
 *   SaveStore.getMode()      'bridge' | 'local' | 'memory'
 *   SaveStore.flush()        Promise<boolean> — force pending writes out
 */

(function () {
  'use strict';

  // Every key the game persists. Bridge Storage is read with one batched get,
  // so any new key must be added here as well.
  const KNOWN_KEYS = [
    'chessarena_player_id',
    'player_profile',
    'chessarena_progress_v1',
    'chessarena_coins',
    'chessarena_stats_v1',
    'chessarena_avatar_id',
    'chessarena_board_theme',
    'chessarena_music_volume',
    'chessarena_abilities',
    'owl_settings',
    'owl_board_theme',
    'owl_unlocked_boards',
    'owl_selected_abilities',
    'owl_player_level',
    'owl_player_xp',
    'owl_unlocked_skills',
    'owl_skill_charges',
    'owl_slot2_unlocked',
    'owl_slot2_ads',
    'owl_ad_tracking',
    'owl_default_second_v1'
  ];

  const WRITE_DELAY_MS = 400;
  const RETRY_DELAY_MS = 2000;
  const HYDRATE_TIMEOUT_MS = 15000;

  const values = new Map();
  const dirty = new Set();
  const removed = new Set();

  let mode = 'memory';
  let hydrated = false;
  let resolveReady;
  let writeTimer = null;
  let flushing = false;
  let flushQueued = false;

  const ready = new Promise((resolve) => { resolveReady = resolve; });

  function platformApi() {
    return window.ChessArenaPlatform || null;
  }

  function realPlatformId() {
    const bridge = window.bridge;
    const platform = bridge && bridge.platform;
    const id = platform && platform.id ? String(platform.id) : '';
    return id && id.toLowerCase() !== 'mock' ? id : '';
  }

  function bridgeDelete(keys) {
    const bridge = window.bridge;
    if (!bridge || !bridge.storage || typeof bridge.storage.delete !== 'function') return null;
    try {
      return bridge.storage.delete(keys);
    } catch (e) {
      return null;
    }
  }

  // --- Backends ------------------------------------------------------------

  function readLocalStorage() {
    const snapshot = new Map();
    try {
      const storage = window.localStorage;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key == null) continue;
        const value = storage.getItem(key);
        if (value != null) snapshot.set(key, value);
      }
    } catch (e) { /* storage disabled */ }
    return snapshot;
  }

  function writeLocalStorage(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { /* quota exceeded / private mode */ }
  }

  function adoptLegacyStats() {
    if (values.has('chessarena_stats_v1')) return;
    let bestValue = null;
    let bestTotal = -1;
    values.forEach((value, key) => {
      if (!key.startsWith('chessarena_stats_v1_')) return;
      let parsed = null;
      try { parsed = JSON.parse(value); } catch (e) { return; }
      if (!parsed || typeof parsed !== 'object') return;
      const ai = parsed.ai || {};
      const online = parsed.online || {};
      const total = ['wins', 'losses', 'draws'].reduce((sum, k) => {
        return sum + (Number(ai[k]) || 0) + (Number(online[k]) || 0);
      }, 0);
      if (total > bestTotal) {
        bestTotal = total;
        bestValue = value;
      }
    });
    if (bestValue == null) return;
    values.set('chessarena_stats_v1', bestValue);
    if (mode === 'local') writeLocalStorage('chessarena_stats_v1', bestValue);
  }

  function hydrateLocal() {
    mode = 'local';
    values.clear();
    readLocalStorage().forEach((value, key) => values.set(key, value));
    adoptLegacyStats();
  }

  async function hydrateBridge(api) {
    mode = 'bridge';
    try {
      const result = await api.getStorage(KNOWN_KEYS.slice());
      if (Array.isArray(result)) {
        KNOWN_KEYS.forEach((key, index) => {
          const value = result[index];
          if (value === null || value === undefined) return;
          values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
      } else if (result && typeof result === 'object') {
        KNOWN_KEYS.forEach((key) => {
          const value = result[key];
          if (value === null || value === undefined) return;
          values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
      }
    } catch (e) { /* Offline start: writes will be retried by flush(). */ }
  }

  async function boot() {
    const api = platformApi();
    if (api && api.whenReady) {
      try {
        await Promise.race([
          Promise.resolve(api.whenReady),
          new Promise((resolve) => setTimeout(resolve, HYDRATE_TIMEOUT_MS))
        ]);
      } catch (e) { /* continue with the best backend available */ }
    }

    if (api && realPlatformId()) {
      await hydrateBridge(api);
    } else {
      hydrateLocal();
    }

    hydrated = true;
    resolveReady(mode);
  }

  // --- Write pipeline ------------------------------------------------------

  function scheduleFlush(delay) {
    if (mode !== 'bridge' || writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      flush();
    }, Number.isFinite(delay) ? delay : WRITE_DELAY_MS);
  }

  async function flush() {
    if (mode !== 'bridge') return true;
    const api = platformApi();
    if (!api || typeof api.setStorage !== 'function') return false;
    if (flushing) {
      flushQueued = true;
      return false;
    }

    const setKeys = Array.from(dirty);
    const deleteKeys = Array.from(removed);
    if (!setKeys.length && !deleteKeys.length) return true;

    setKeys.forEach((key) => dirty.delete(key));
    deleteKeys.forEach((key) => removed.delete(key));

    flushing = true;
    let ok = true;
    try {
      if (setKeys.length) {
        const setValues = setKeys.map((key) => (values.has(key) ? values.get(key) : ''));
        ok = (await api.setStorage(setKeys, setValues)) !== false;
      }
      if (deleteKeys.length) {
        const result = bridgeDelete(deleteKeys);
        if (result && typeof result.then === 'function') await result;
      }
    } catch (e) {
      ok = false;
    }
    flushing = false;

    if (!ok) {
      setKeys.forEach((key) => dirty.add(key));
      deleteKeys.forEach((key) => removed.add(key));
      scheduleFlush(RETRY_DELAY_MS);
    } else if (flushQueued || dirty.size || removed.size) {
      flushQueued = false;
      scheduleFlush();
    }
    return ok;
  }

  // --- Public API ----------------------------------------------------------

  function getItem(key) {
    const name = String(key);
    return values.has(name) ? values.get(name) : null;
  }

  function setItem(key, value) {
    const name = String(key);
    const next = String(value);
    values.set(name, next);
    if (mode === 'local') {
      writeLocalStorage(name, next);
      return;
    }
    if (mode === 'bridge') {
      removed.delete(name);
      dirty.add(name);
      scheduleFlush();
    }
  }

  function removeItem(key) {
    const name = String(key);
    values.delete(name);
    if (mode === 'local') {
      writeLocalStorage(name, null);
      return;
    }
    if (mode === 'bridge') {
      dirty.delete(name);
      removed.add(name);
      scheduleFlush();
    }
  }

  function clear() {
    Array.from(values.keys()).forEach(removeItem);
  }

  function keyAt(index) {
    return Array.from(values.keys())[index] || null;
  }

  // Flush pending writes when the page is backgrounded or closed — the host
  // may freeze the iframe right after `pagehide`.
  function flushNow() {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    return flush();
  }

  try {
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow();
    });
  } catch (e) { /* older browsers */ }

  window.SaveStore = {
    ready,
    getMode: () => mode,
    isHydrated: () => hydrated,
    getItem,
    setItem,
    removeItem,
    clear,
    key: keyAt,
    flush: flushNow,
    knownKeys: KNOWN_KEYS.slice()
  };

  Object.defineProperty(window.SaveStore, 'length', {
    get: () => values.size,
    enumerable: true
  });

  boot();
})();
