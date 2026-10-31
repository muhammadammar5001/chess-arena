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

  let bridgeRef = null;
  let gameReadySent = false;
  let readyResolved = false;
  const lifecycle = {
    platformId: '',
    language: 'en',
    audioEnabled: true,
    paused: false,
    externalCallsSupported: true
  };

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
    // The Bridge SDK is the first script in <head> (a PlayGama requirement), so
    // it is already present here. Wait briefly for it rather than injecting it
    // late, which the host rejects during moderation.
    return new Promise((resolve) => {
      if (window.bridge) return resolve(window.bridge);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(poll);
        resolve(window.bridge || null);
      };
      const poll = setInterval(() => {
        if (window.bridge) finish();
      }, 50);
      setTimeout(finish, 6000);
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

  function emitLifecycleState() {
    const detail = Object.assign({}, lifecycle);
    try {
      window.dispatchEvent(new CustomEvent('chessarena:platform-state', { detail }));
    } catch (e) { /* older browsers */ }

    // The app object is created near the end of app.js, while the bridge can
    // initialize before or after that point. Push the current state whenever it
    // becomes available so the game always starts with the host's real state.
    const app = window.app;
    if (!app) return;
    try {
      if (typeof app.setPlatformAudioEnabled === 'function') {
        app.setPlatformAudioEnabled(lifecycle.audioEnabled);
      }
      if (typeof app.setPlatformPaused === 'function') {
        app.setPlatformPaused(lifecycle.paused);
      }
    } catch (e) { /* keep platform boot alive */ }
  }

  function subscribeLifecycle(bridge) {
    const platform = bridge && bridge.platform;
    if (!platform || typeof platform.on !== 'function') return;
    const events = bridge.EVENT_NAME || {};
    try {
      if (events.AUDIO_STATE_CHANGED) {
        platform.on(events.AUDIO_STATE_CHANGED, (enabled) => {
          lifecycle.audioEnabled = enabled !== false;
          emitLifecycleState();
        });
      }
      if (events.PAUSE_STATE_CHANGED) {
        platform.on(events.PAUSE_STATE_CHANGED, (paused) => {
          lifecycle.paused = paused === true;
          emitLifecycleState();
        });
      }
    } catch (e) {
      console.warn('[Platform] Lifecycle subscription failed', e);
    }
  }

  function applyInitialLifecycle(bridge) {
    const platform = bridge && bridge.platform;
    if (!platform) return;
    lifecycle.platformId = platform.id ? String(platform.id) : '';
    lifecycle.language = (typeof platform.language === 'string' && platform.language)
      ? platform.language.slice(0, 8).toLowerCase()
      : 'en';
    lifecycle.audioEnabled = platform.isAudioEnabled !== false;
    lifecycle.paused = platform.isPaused === true;
    // External networking (the optional online chess backend) is only allowed
    // when the host explicitly supports it. On YouTube Playables it is blocked,
    // so the game must stay fully playable offline. The local mock adapter is
    // development-only and keeps the self-hosted server usable.
    const isMock = !lifecycle.platformId || lifecycle.platformId.toLowerCase() === 'mock';
    lifecycle.externalCallsSupported = isMock ? true : platform.isExternalCallsSupported === true;

    try {
      document.documentElement.lang = lifecycle.language;
      document.documentElement.dataset.platform = lifecycle.platformId || 'web';
    } catch (e) { /* ignore */ }

    emitLifecycleState();
  }

  async function sendGameReady() {
    if (gameReadySent || !bridgeRef || !bridgeRef.platform) return false;
    if (typeof bridgeRef.platform.sendMessage !== 'function') return false;
    gameReadySent = true;
    try {
      const result = bridgeRef.platform.sendMessage('game_ready');
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return true;
    } catch (e) {
      console.warn('[Platform] game_ready failed', e);
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
      bridgeRef = bridge;
      applyInitialLifecycle(bridge);
      subscribeLifecycle(bridge);
      const profile = readPlayer(bridge);
      if (profile) {
        cachedProfile = profile;
      }
      if (!readyResolved) {
        readyResolved = true;
        resolveReady(profile);
      }

      // Send game_ready after the first playable document is interactive. The
      // app also calls gameReady() after its own init as a safety net; the
      // bridge message is intentionally sent only once.
      const fireReady = () => setTimeout(() => { sendGameReady(); }, 50);
      if (document.readyState === 'complete') fireReady();
      else window.addEventListener('load', fireReady, { once: true });
    } catch (e) {
      if (!readyResolved) {
        readyResolved = true;
        resolveReady(null);
      }
    }
  }

  // Start immediately: this script is loaded after the Bridge script, and the
  // app initializes its storage before DOMContentLoaded. Waiting for
  // DOMContentLoaded here made Playgama storage silently fall back to
  // localStorage on the first run.
  boot();

  window.ChessArenaPlatform = {
    whenReady,
    getCached: () => cachedProfile,
    getPlayer: () => cachedProfile,
    isSupported: () => !!bridgeRef,
    getStorage: storageGet,
    setStorage: storageSet,
    getPlatformId: () => realPlatformId(),
    getLanguage: () => lifecycle.language,
    isAudioEnabled: () => lifecycle.audioEnabled,
    isPaused: () => lifecycle.paused,
    isExternalCallsSupported: () => lifecycle.externalCallsSupported,
    getState: () => Object.assign({}, lifecycle),
    isGameReadySent: () => gameReadySent,
    gameReady: sendGameReady
  };
})();
