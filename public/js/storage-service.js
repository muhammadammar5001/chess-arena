/**
 * Chess Arena — Player Persistence Service
 *
 * Prefers the YouTube Playables native cloud store (`YT.getCloudStorage()`),
 * then the hosted PlayGama store when available, and finally localStorage for
 * localhost/standalone play. The public API is always async and always returns
 * a sanitized profile, so the rest of the game does not need to know which
 * storage backend is active.
 *
 * Cloud writes are coalesced and rate-limited to at most one write per second.
 * A localStorage mirror is written immediately on every save, so a quota or
 * network error never destroys the in-memory/local profile.
 */

(function () {
  'use strict';

  const CLOUD_KEY = 'player_profile';
  const MIRROR_KEY = 'chessarena_player_profile_mirror_v1';
  const MAX_HISTORY = 30;
  const MIN_WRITE_INTERVAL_MS = 1000;
  const MAX_CLOUD_RETRIES = 5;
  const MAX_STAT_COUNT = 10000000;
  const ALLOWED_BOARDS = new Set([
    'classic-oak', 'ember', 'moonlit', 'sakura',
    'walnut-maple', 'cherry-rosewood', 'ebony-ivory'
  ]);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (e) { return value; }
  }

  function toInt(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  function generatePlayerId() {
    const bytes = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return 'usr_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function sanitizeUsername(value) {
    return String(value || '')
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 16);
  }

  function isValidUsername(value) {
    const name = sanitizeUsername(value);
    return name.length >= 3 && name.length <= 16;
  }

  function sanitizeText(value, maxLength = 32) {
    return String(value || '')
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function parseRaw(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); }
      catch (e) { return null; }
    }
    return (typeof raw === 'object') ? raw : null;
  }

  function totalMatches(stats) {
    return (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0);
  }

  class ChessArenaStorageManager {
    constructor(options = {}) {
      this.cloudKey = options.cloudKey || CLOUD_KEY;
      this.mirrorKey = options.mirrorKey || MIRROR_KEY;
      this.adapter = null;
      this.mode = 'local';
      this.current = null;
      this.lastError = null;
      this.readyPromise = null;

      this._lastCloudWrite = 0;
      this._pending = null;
      this._deferred = null;
      this._writeTimer = null;
      this._writing = false;
      this._retryTimer = null;
      this._retryAttempt = 0;
      this._readFailed = false;
    }

    async init() {
      if (!this.readyPromise) this.readyPromise = this._detectAdapter();
      return this.readyPromise;
    }

    async _detectAdapter() {
      const youtube = await this._waitForYouTubeStorage();
      if (youtube) {
        this.adapter = youtube;
        this.mode = 'youtube';
        return this.mode;
      }

      // On Playgama the bridge initializes asynchronously. Wait for its
      // handshake before deciding the storage backend, otherwise the first
      // profile read/write falls back to localStorage and cloud progress is
      // lost on the next device/session.
      const platformApi = window.ChessArenaPlatform;
      if (platformApi && platformApi.whenReady) {
        try {
          await Promise.race([
            Promise.resolve(platformApi.whenReady),
            sleep(5000)
          ]);
        } catch (e) { /* local fallback */ }
      }

      const platform = this._playgamaAdapter();
      if (platform) {
        this.adapter = platform;
        this.mode = 'platform';
        return this.mode;
      }

      this.adapter = this._localAdapter();
      this.mode = 'local';
      return this.mode;
    }

    _isYouTubeHost() {
      try {
        const host = String(window.location.hostname || '').toLowerCase();
        const referrer = String(document.referrer || '').toLowerCase();
        return /(^|\.)youtube\.com$/.test(host) ||
          /(^|\.)youtube-nocookie\.com$/.test(host) ||
          referrer.includes('youtube.com');
      } catch (e) {
        return false;
      }
    }

    _readYouTubeStorage() {
      try {
        const yt = window.YT;
        if (!yt || typeof yt.getCloudStorage !== 'function') return null;
        const storage = yt.getCloudStorage();
        if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
        return {
          getItem: async (key) => {
            const value = await storage.getItem(key);
            return value == null ? null : value;
          },
          setItem: async (key, value) => await storage.setItem(key, value),
          removeItem: typeof storage.removeItem === 'function'
            ? async (key) => await storage.removeItem(key)
            : null
        };
      } catch (e) {
        this.lastError = e;
        return null;
      }
    }

    async _waitForYouTubeStorage() {
      // YouTube injects the SDK asynchronously. Wait briefly on a YouTube host,
      // but never delay local development or standalone deployments.
      const deadline = Date.now() + (this._isYouTubeHost() ? 5000 : 0);
      do {
        const adapter = this._readYouTubeStorage();
        if (adapter) return adapter;
        if (!this._isYouTubeHost()) return null;
        await sleep(150);
      } while (Date.now() < deadline);
      return null;
    }

    _playgamaAdapter() {
      const platform = window.ChessArenaPlatform;
      if (!platform || typeof platform.getStorage !== 'function' || typeof platform.setStorage !== 'function') return null;
      try {
        if (typeof platform.getPlatformId === 'function' && !platform.getPlatformId()) return null;
      } catch (e) {
        return null;
      }
      return {
        getItem: async (key) => {
          const value = await platform.getStorage(key);
          if (Array.isArray(value)) return value[0] == null ? null : value[0];
          if (value && typeof value === 'object' && !(value instanceof String)) {
            if (value[key] !== undefined) return value[key];
            if (value[0] !== undefined) return value[0];
            return null;
          }
          return value == null ? null : value;
        },
        setItem: async (key, value) => await platform.setStorage(key, value)
      };
    }

    _localAdapter() {
      const memory = new Map();
      const safeStorage = () => {
        try { return window.localStorage; }
        catch (e) { return null; }
      };
      return {
        getItem: async (key) => {
          const storage = safeStorage();
          if (storage) {
            try { return storage.getItem(key); }
            catch (e) { /* fall through to memory */ }
          }
          return memory.has(key) ? memory.get(key) : null;
        },
        setItem: async (key, value) => {
          const storage = safeStorage();
          if (storage) {
            try { storage.setItem(key, value); return true; }
            catch (e) { /* fall through to memory */ }
          }
          memory.set(key, value);
          return true;
        }
      };
    }

    getStatus() {
      return {
        mode: this.mode,
        cloud: this.mode === 'youtube' || this.mode === 'platform',
        pending: !!this._pending,
        lastError: this.lastError ? String(this.lastError.message || this.lastError) : null
      };
    }

    // Generic Bridge-backed values for game progress that is not part of the
    // public player profile (economy, settings, ad-trackers). On the host this
    // uses Bridge Storage; in local play the local adapter is used.
    async loadValue(key) {
      await this.init();
      try {
        return await this.adapter.getItem(key);
      } catch (e) {
        this.lastError = e;
        return null;
      }
    }

    async saveValue(key, value) {
      await this.init();
      try {
        await this.adapter.setItem(key, value);
        return true;
      } catch (e) {
        this.lastError = e;
        return false;
      }
    }

    sanitizeUsername(value) {
      return sanitizeUsername(value);
    }

    isValidUsername(value) {
      return isValidUsername(value);
    }

    generatePlayerId() {
      return generatePlayerId();
    }

    normalizeProfile(raw) {
      const parsed = parseRaw(raw);
      if (!parsed) return null;

      const count = (value) => Math.min(MAX_STAT_COUNT, Math.max(0, toInt(value, 0)));
      const sourceStats = parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {};
      const stats = {
        wins: count(sourceStats.wins),
        losses: count(sourceStats.losses),
        draws: count(sourceStats.draws),
        totalMatches: 0,
        winStreak: count(sourceStats.winStreak),
        bestStreak: count(sourceStats.bestStreak)
      };
      stats.totalMatches = totalMatches(stats);
      stats.bestStreak = Math.max(stats.bestStreak, stats.winStreak);

      let playerId = String(parsed.playerId || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!/^usr_[a-z0-9]{6,64}$/.test(playerId)) {
        // Accept older IDs only while they are safe; otherwise repair the record.
        if (!/^[a-z0-9_:-]{6,64}$/.test(playerId)) playerId = generatePlayerId();
        else if (!playerId.startsWith('usr_')) playerId = generatePlayerId();
      }

      const username = sanitizeUsername(parsed.username);
      const rating = Math.min(4000, Math.max(100, toInt(parsed.rating != null ? parsed.rating : parsed.elo, 1200)));
      const rankValue = Math.min(MAX_STAT_COUNT, toInt(parsed.rank, 0));
      const rank = rankValue > 0 ? rankValue : null;

      const coins = Math.min(1000000000, Math.max(0, toInt(parsed.coins, 1000)));
      const equipped = parsed.equipped && typeof parsed.equipped === 'object' ? parsed.equipped : {};
      const candidateBoard = sanitizeText(equipped.board || 'classic-oak', 32)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '') || 'classic-oak';
      const board = ALLOWED_BOARDS.has(candidateBoard) ? candidateBoard : 'classic-oak';

      const history = Array.isArray(parsed.matchHistory) ? parsed.matchHistory : [];
      const matchHistory = history
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const result = ['win', 'loss', 'draw'].includes(entry.result) ? entry.result : null;
          if (!result) return null;
          return {
            result,
            mode: entry.mode === 'ai' ? 'ai' : 'online',
            ratingDelta: Math.max(-4000, Math.min(4000, toInt(entry.ratingDelta, 0))),
            opponent: sanitizeText(entry.opponent, 32),
            timestamp: Math.max(0, toInt(entry.timestamp, 0))
          };
        })
        .filter(Boolean)
        .slice(0, MAX_HISTORY);

      return {
        playerId,
        username,
        rating,
        rank,
        stats,
        coins,
        equipped: { board },
        matchHistory,
        lastUpdated: Math.max(0, toInt(parsed.lastUpdated, Date.now()))
      };
    }

    createDraftProfile(overrides = {}) {
      return this.normalizeProfile(Object.assign({
        playerId: generatePlayerId(),
        username: '',
        rating: 1200,
        rank: null,
        stats: { wins: 0, losses: 0, draws: 0 },
        coins: 1000,
        equipped: { board: 'classic-oak' },
        matchHistory: [],
        lastUpdated: Date.now()
      }, overrides)) || null;
    }

    loadLegacyProfile() {
      let stats = null;
      let rating = 1200;
      try {
        const oldId = String(localStorage.getItem('chessarena_player_id') || '').toLowerCase();
        let best = null;
        let bestTotal = -1;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('chessarena_stats_v1_')) continue;
          let parsed;
          try { parsed = JSON.parse(localStorage.getItem(key) || 'null'); }
          catch (e) { continue; }
          if (!parsed || typeof parsed !== 'object') continue;
          const ai = parsed.ai || {};
          const online = parsed.online || {};
          const candidate = {
            wins: Math.max(0, toInt(ai.wins, 0)) + Math.max(0, toInt(online.wins, 0)),
            losses: Math.max(0, toInt(ai.losses, 0)) + Math.max(0, toInt(online.losses, 0)),
            draws: Math.max(0, toInt(ai.draws, 0)) + Math.max(0, toInt(online.draws, 0))
          };
          const total = totalMatches(candidate);
          const matchesOldId = oldId && key.toLowerCase().includes(oldId);
          if (matchesOldId || (!best && total > 0) || total > bestTotal) {
            best = candidate;
            bestTotal = total;
            rating = Math.min(4000, Math.max(100, toInt(parsed.rating, 1200)));
          }
        }
        if (best) stats = best;
      } catch (e) { /* localStorage unavailable */ }

      let coins = 1000;
      try {
        const savedCoins = parseInt(localStorage.getItem('chessarena_coins'), 10);
        if (Number.isFinite(savedCoins) && savedCoins >= 0) coins = savedCoins;
      } catch (e) { /* ignore */ }

      let board = 'classic-oak';
      try {
        const savedBoard = localStorage.getItem('chessarena_board_theme');
        if (savedBoard) board = sanitizeText(savedBoard, 32).toLowerCase().replace(/[^a-z0-9-]/g, '');
      } catch (e) { /* ignore */ }

      return this.createDraftProfile({
        playerId: generatePlayerId(),
        username: '',
        rating,
        stats: stats || { wins: 0, losses: 0, draws: 0 },
        coins,
        equipped: { board: board || 'classic-oak' }
      });
    }

    _mirrorLocal(profile) {
      try {
        const json = JSON.stringify(profile);
        localStorage.setItem(this.mirrorKey, json);
        localStorage.setItem(this.cloudKey, json);
      } catch (e) { /* storage may be full or unavailable */ }
    }

    _readMirror() {
      try {
        const raw = localStorage.getItem(this.mirrorKey) || localStorage.getItem(this.cloudKey);
        return parseRaw(raw);
      } catch (e) {
        return null;
      }
    }

    async loadProfile() {
      await this.init();
      let raw = null;
      let cloudReadOk = false;
      let source = 'cloud';
      this._readFailed = false;

      try {
        raw = await this.adapter.getItem(this.cloudKey);
        cloudReadOk = true;
      } catch (e) {
        this._readFailed = true;
        this.lastError = e;
      }

      let profile = this.normalizeProfile(raw);

      // A cloud-backed account with an empty record is a genuinely new player.
      // Do not leak another account's local mirror into it. The local mirror and
      // legacy keys are only used for local play or when a cloud read failed.
      if (!profile && (!cloudReadOk || this.mode === 'local')) {
        source = 'mirror';
        profile = this.normalizeProfile(this._readMirror());
      }
      if (!profile && (!cloudReadOk || this.mode === 'local')) {
        source = 'legacy';
        profile = this.loadLegacyProfile();
      }
      if (!profile) return null;

      this.current = profile;
      this._mirrorLocal(profile);

      // Migrate a local/mirror profile into the cloud only when the cloud read
      // actually succeeded and returned nothing. A read error must not clobber
      // a potentially newer cloud profile.
      if (source !== 'cloud' && !this._readFailed && this.mode !== 'local' && profile.username) {
        this.saveProfile(profile).catch(() => {});
      }
      return profile;
    }

    async createProfile(username, overrides = {}) {
      const name = sanitizeUsername(username);
      if (!isValidUsername(name)) {
        throw new Error('Username must be 3-16 alphanumeric characters');
      }
      const base = overrides.__draft || this.current || this.createDraftProfile(overrides);
      const profile = this.normalizeProfile(Object.assign({}, base, overrides, {
        username: name,
        playerId: (base && base.playerId) || generatePlayerId(),
        lastUpdated: Date.now()
      }));
      if (!profile) throw new Error('Could not create player profile');
      this.current = profile;
      await this.saveProfile(profile);
      return profile;
    }

    async saveProfile(profileData) {
      await this.init();
      const profile = this.normalizeProfile(profileData);
      if (!profile) throw new Error('Invalid player profile');
      profile.lastUpdated = Date.now();
      this.current = profile;
      this._mirrorLocal(profile);

      return new Promise((resolve) => {
        this._pending = profile;
        if (!this._deferred) {
          this._deferred = { promise: null, resolve };
          this._deferred.promise = new Promise((res) => { this._deferred.resolve = res; });
        }
        const pendingPromise = this._deferred.promise;
        this._scheduleFlush();
        pendingPromise.then(() => resolve(profile));
      });
    }

    _scheduleFlush(delay) {
      if (this._writeTimer || this._writing) return;
      const wait = Number.isFinite(delay)
        ? Math.max(0, delay)
        : (this._lastCloudWrite ? Math.max(0, MIN_WRITE_INTERVAL_MS - (Date.now() - this._lastCloudWrite)) : 0);
      this._writeTimer = setTimeout(() => {
        this._writeTimer = null;
        this._flush();
      }, wait);
    }

    async _flush() {
      if (this._writing || !this._pending) return;
      this._writing = true;
      const snapshot = this._pending;
      this._pending = null;
      let ok = false;

      try {
        await this.adapter.setItem(this.cloudKey, JSON.stringify(snapshot));
        ok = true;
        this._lastCloudWrite = Date.now();
        this._retryAttempt = 0;
        if (this._retryTimer) {
          clearTimeout(this._retryTimer);
          this._retryTimer = null;
        }
        this.lastError = null;
      } catch (e) {
        this.lastError = e;
        if (!this._pending) this._pending = snapshot;
        this._scheduleRetry();
      }

      this._writing = false;

      if (ok) {
        if (this._pending) {
          this._scheduleFlush();
        } else if (this._deferred) {
          const deferred = this._deferred;
          this._deferred = null;
          deferred.resolve();
        }
      } else if (this._deferred) {
        // Do not block gameplay on a bad cloud connection. The local mirror is
        // current and the next save/retry will eventually flush.
        const deferred = this._deferred;
        this._deferred = null;
        deferred.resolve();
      }
    }

    _scheduleRetry() {
      if (this._retryTimer || this._retryAttempt >= MAX_CLOUD_RETRIES) return;
      const delay = Math.min(30000, 2000 * Math.pow(2, this._retryAttempt));
      this._retryAttempt++;
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        this._flush();
      }, delay);
    }

    flushProfile() {
      if (this._writeTimer) {
        clearTimeout(this._writeTimer);
        this._writeTimer = null;
      }
      return this._flush();
    }

    async updateMatchStats(result, ratingDelta = 0, options = {}) {
      const normalizedResult = ['win', 'loss', 'draw'].includes(result) ? result : 'draw';
      let profile = this.current ? this.normalizeProfile(this.current) : await this.loadProfile();
      if (!profile) profile = this.createDraftProfile();
      if (!profile) return null;

      // Preserve active coin balance from caller or localStorage
      if (options.coins !== undefined && options.coins !== null && Number.isFinite(Number(options.coins))) {
        profile.coins = Math.max(0, Math.floor(Number(options.coins)));
      } else {
        try {
          const savedCoins = parseInt(localStorage.getItem('chessarena_coins'), 10);
          if (Number.isFinite(savedCoins) && savedCoins >= 0) {
            profile.coins = savedCoins;
          }
        } catch (e) { /* ignore */ }
      }

      const beforeRating = Number.isFinite(Number(options.ratingBefore))
        ? Math.min(4000, Math.max(100, toInt(options.ratingBefore, profile.rating)))
        : profile.rating;
      const absolute = options.authoritative && typeof options.authoritative === 'object'
        ? options.authoritative
        : null;
      const stats = Object.assign({}, profile.stats);

      if (absolute) {
        stats.wins = Math.max(0, toInt(absolute.wins, stats.wins));
        stats.losses = Math.max(0, toInt(absolute.losses, stats.losses));
        stats.draws = Math.max(0, toInt(absolute.draws, stats.draws));
        stats.winStreak = Math.max(0, toInt(absolute.winStreak, stats.winStreak));
        stats.bestStreak = Math.max(0, toInt(absolute.bestStreak, stats.bestStreak));
        const absoluteRating = absolute.rating != null ? absolute.rating : absolute.elo;
        if (absoluteRating != null) {
          profile.rating = Math.min(4000, Math.max(100, toInt(absoluteRating, profile.rating)));
        }
      } else {
        if (normalizedResult === 'win') stats.wins += 1;
        else if (normalizedResult === 'loss') stats.losses += 1;
        else stats.draws += 1;

        if (normalizedResult === 'win') stats.winStreak += 1;
        else stats.winStreak = 0;
        profile.rating = Math.min(4000, Math.max(100, toInt(profile.rating + toInt(ratingDelta, 0), profile.rating)));
      }

      stats.bestStreak = Math.max(stats.bestStreak, stats.winStreak);
      stats.totalMatches = totalMatches(stats);
      profile.stats = stats;

      const historyEntry = {
        result: normalizedResult,
        mode: options.mode === 'ai' ? 'ai' : 'online',
        ratingDelta: profile.rating - beforeRating,
        opponent: sanitizeText(options.opponent, 32),
        timestamp: Date.now()
      };
      profile.matchHistory = [historyEntry].concat(profile.matchHistory || []).slice(0, MAX_HISTORY);
      profile.lastUpdated = Date.now();
      profile = this.normalizeProfile(profile);
      await this.saveProfile(profile);
      return profile;
    }

    async removeProfile() {
      this.current = null;
      try {
        localStorage.removeItem(this.mirrorKey);
        localStorage.removeItem(this.cloudKey);
      } catch (e) { /* ignore */ }
      if (this.adapter && typeof this.adapter.removeItem === 'function') {
        try { await this.adapter.removeItem(this.cloudKey); }
        catch (e) { /* ignore */ }
      }
    }
  }

  window.ChessArenaStorageManager = ChessArenaStorageManager;
  window.ChessArenaStorage = new ChessArenaStorageManager();

  window.addEventListener('pagehide', () => {
    if (window.ChessArenaStorage && window.ChessArenaStorage._pending) {
      window.ChessArenaStorage.flushProfile();
    }
  });

  window.addEventListener('online', () => {
    const storage = window.ChessArenaStorage;
    if (!storage || !storage._pending) return;
    storage._retryAttempt = 0;
    if (storage._retryTimer) {
      clearTimeout(storage._retryTimer);
      storage._retryTimer = null;
    }
    storage.flushProfile().catch(() => {});
  });
})();
