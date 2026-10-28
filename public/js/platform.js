/**
 * Chess Arena — Platform Identity Bridge
 *
 * Loads the PlayGama Bridge (which the YouTube Playables adapter is bundled
 * into) and exposes the signed-in player's display name / avatar when the host
 * platform provides it. Always degrades gracefully: on platforms without
 * player authorization (YouTube Playables included) it resolves to `null` and
 * the app keeps using the local guest profile.
 */

(function () {
  'use strict';

  const CACHE_KEY = 'chessarena_platform_profile_v1';
  const BRIDGE_SRC = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  const PLATFORM_LABELS = {
    youtube: 'YouTube',
    playgama: 'PlayGama',
    yandex: 'Yandex Games',
    vk: 'VK Play',
    crazygames: 'CrazyGames',
    poki: 'Poki',
    itch: 'itch.io',
    facebook: 'Facebook',
    telegram: 'Telegram',
    ok: 'OK.ru',
    game_distribution: 'GameDistribution'
  };

  let cachedProfile = null;
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (stored && stored.ts && (Date.now() - stored.ts) < CACHE_TTL_MS &&
        String(stored.platform || '').toLowerCase() !== 'mock') {
      cachedProfile = stored;
    }
  } catch (e) { /* ignore malformed cache */ }

  let resolveReady;
  const whenReady = new Promise((resolve) => { resolveReady = resolve; });

  function platformLabel(platformId, isAuthorized) {
    const id = String(platformId || '').toLowerCase();
    if (id === 'youtube') return 'YouTube';
    if (PLATFORM_LABELS[id]) return PLATFORM_LABELS[id];
    if (isAuthorized) return 'Connected account';
    return '';
  }

  function loadBridgeScript() {
    return new Promise((resolve) => {
      if (window.bridge) return resolve(window.bridge);

      const existing = document.querySelector('script[data-platform-bridge]');
      if (existing) {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve(window.bridge || null);
        };
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', finish, { once: true });
        // In case the script already finished loading before we attached.
        const poll = setInterval(() => {
          if (window.bridge) {
            clearInterval(poll);
            finish();
          }
        }, 100);
        setTimeout(() => { clearInterval(poll); finish(); }, 8000);
        return;
      }

      const script = document.createElement('script');
      script.src = BRIDGE_SRC;
      script.async = true;
      script.dataset.platformBridge = '1';
      script.onload = () => resolve(window.bridge || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
      setTimeout(() => resolve(window.bridge || null), 8000);
    });
  }

  function initializeBridge(bridge) {
    return new Promise((resolve) => {
      if (!bridge || typeof bridge.initialize !== 'function') return resolve(bridge || null);
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(bridge);
      };
      try {
        const result = bridge.initialize(done);
        if (result && typeof result.then === 'function') {
          result.then(done).catch(done);
        }
      } catch (e) {
        done();
      }
      // Never block the game on a slow platform handshake.
      setTimeout(done, 4000);
    });
  }

  function readPlayer(bridge) {
    if (!bridge) return null;
    const player = bridge.player;
    const platform = bridge.platform;
    if (!player) return null;

    const platformId = platform && platform.id ? String(platform.id) : '';
    // The Bridge's "mock" adapter is only a local development fallback — it
    // must never override the game's own guest identity.
    if (!platformId || platformId.toLowerCase() === 'mock') return null;

    const name = (typeof player.name === 'string' && player.name.trim())
      ? player.name.trim()
      : null;
    const photos = Array.isArray(player.photos) ? player.photos : [];
    const avatar = photos.find((p) => typeof p === 'string' && p.trim()) || null;
    const id = player.id ? String(player.id) : null;
    const isAuthorized = player.isAuthorized === true;
    const isGuest = player.isGuest === true;

    // No usable identity on this platform (e.g. YouTube Playables).
    if (!name && !avatar && !id) return null;

    return {
      name,
      avatar,
      id,
      isAuthorized,
      isGuest,
      platform: platformId,
      platformLabel: platformLabel(platformId, isAuthorized),
      ts: Date.now()
    };
  }

  function realPlatformId() {
    const platform = window.bridge && window.bridge.platform;
    const id = platform && platform.id ? String(platform.id) : '';
    return id && id.toLowerCase() !== 'mock' ? id : '';
  }

  async function storageGet(keys) {
    if (!window.bridge || !window.bridge.storage) return null;
    await whenReady;
    if (!realPlatformId()) return null;
    try {
      return await window.bridge.storage.get(keys);
    } catch (e) {
      return null;
    }
  }

  async function storageSet(keys, values) {
    if (!window.bridge || !window.bridge.storage) return false;
    await whenReady;
    if (!realPlatformId()) return false;
    try {
      await window.bridge.storage.set(keys, values);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function boot() {
    try {
      const bridge = await loadBridgeScript();
      if (!bridge) {
        resolveReady(null);
        return;
      }
      await initializeBridge(bridge);
      const profile = readPlayer(bridge);
      if (profile) {
        cachedProfile = profile;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(profile)); } catch (e) {}
      }
      resolveReady(profile);
    } catch (e) {
      resolveReady(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ChessArenaPlatform = {
    whenReady,
    getCached: () => cachedProfile,
    getPlayer: () => cachedProfile,
    isSupported: () => !!(window.bridge && window.bridge.player),
    getStorage: storageGet,
    setStorage: storageSet,
    getPlatformId: () => realPlatformId()
  };
})();
