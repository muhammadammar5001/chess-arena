/**
 * Chess Arena — App Controller
 * Main application logic: screen management, board rendering, game flow.
 */

const AVATAR_ASSET_VERSION = '2';

// Check cue: a short, seamless one-period loop of the supplied check sound.
// Played through Web Audio so the loop seam is sample accurate (no gap/pause).
const CHECK_LOOP_SRC = '/assets/sounds/check-loop.wav?v=1';
const CHECK_VOLUME = 0.9;
const CHECK_FADE_IN = 0.4;    // seconds — swells in when the king is checked
const CHECK_FADE_OUT = 0.4;   // seconds — cuts away when the king escapes

// Check alert droplets: golden teardrop sprite with bold black stroke matching the reference page.
const CHECK_DROPLET_SVG =
  '<svg viewBox="0 0 100 120" aria-hidden="true" focusable="false">' +
    '<path d="M50 8C50 8 14 52 14 80a36 36 0 0 0 72 0C86 52 50 8 50 8Z" fill="#FFC837" stroke="#050608" stroke-width="22" stroke-linejoin="round"/>' +
    '<path d="M50 8C50 8 14 52 14 80a36 36 0 0 0 72 0C86 52 50 8 50 8Z" fill="#FFC837"/>' +
  '</svg>';


const PLAYER_AVATARS = Array.from({ length: 18 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `pfp-${number}`,
    src: `/assets/avatars/pfp-${number}.webp?v=${AVATAR_ASSET_VERSION}`,
    label: `Avatar ${index + 1}`
  };
});

// Preload all avatar portraits in memory to prevent roulette image flickers
if (typeof window !== 'undefined' && Array.isArray(PLAYER_AVATARS)) {
  PLAYER_AVATARS.forEach((av) => {
    const img = new Image();
    img.src = av.src;
  });
}

class App {
  constructor() {
    this.engine = null;
    this.ai = null;
    this.multiplayer = null;
    this.gameMode = null; // 'ai' or 'online'
    this.playerColor = 'white';
    this.selectedSquare = null;
    this.legalMoves = [];
    this.pendingPromotion = null;
    this.boardFlipped = false;
    this.timerInterval = null;
    this.timers = { white: null, black: null };
    this.lastMoveTime = null;
    this.timerMinutes = null;
    this.lastMove = null;
    this.audioCtx = null;
    this.selectedAIColor = 'white';
    this.pendingJoinData = null;
    this.soundMuted = false;
    this.musicEnabled = true;
    try {
      const savedSettings = JSON.parse(localStorage.getItem('owl_settings') || 'null');
      if (savedSettings && typeof savedSettings === 'object') {
        if (typeof savedSettings.soundMuted === 'boolean') this.soundMuted = savedSettings.soundMuted;
        if (typeof savedSettings.musicEnabled === 'boolean') this.musicEnabled = savedSettings.musicEnabled;
      }
    } catch (e) {}
    this.musicVolume = parseFloat(localStorage.getItem('chessarena_music_volume') || '0.25');
    this.bgMusicRunning = false;
    this.bgMusicNodes = [];
    this.bgMusicGain = null;
    this.isAnimatingMove = false;
    this.platformAudioMuted = false;
    this.platformPaused = false;
    this.platformStateReady = false;
    this.economyPersistenceReady = false;
    this.postGameBreak = false;
    this.economyStorageKey = 'chessarena_progress_v1';
    this.matchType = 'tactical'; // 'standard' or 'tactical'
    this.privateRoom = false;
    this.lastRatingChange = 0;

    // Player progression (local-first; synced from server when available)
    this.playerStats = {
      rating: 1200,
      ai: { wins: 0, losses: 0, draws: 0 },
      online: { wins: 0, losses: 0, draws: 0 },
      hasServerStats: false
    };
    this.statsRecordedForGame = null;
    this.platformProfile = null;

    // Avatar selection is local-first and mirrored into cloud progress so the
    // same portrait follows a signed-in player between sessions/devices.
    this.avatarIdFromStorage = false;
    this.avatarId = this.resolveInitialAvatarId();

    // Cloud-backed player profile (YouTube Playables / PlayGama / localStorage).
    this.cloudProfile = null;
    this.profileReady = null;
    this.pendingProfileDraft = null;
    this.onboardingPending = false;
    this.ratingAtGameStart = null;
    this.lastServerStats = null;
    this.lastServerStatsGameId = null;
    this.lastServerStatsAt = 0;
    this.leaderboardTopPlayers = [];
    this.leaderboardTotalPlayers = 0;
    this.lastLeaderboardSyncAt = 0;
    this.leaderboardSyncAttempts = 0;
    this.leaderboardRetryTimer = null;
    this._leaderboardSyncInFlight = null;
    this._leaderboardSyncQueued = false;
    this._leaderboardSyncDebounce = null;
    this._profileRevision = 0;
    
    try {
      let saved = JSON.parse(localStorage.getItem('owl_selected_abilities') || 'null');
      if (!Array.isArray(saved) || saved.length === 0) {
        saved = JSON.parse(localStorage.getItem('chessarena_abilities') || 'null');
      }
      if (Array.isArray(saved)) {
        saved = saved.filter(s => ['swap', 'freeze', 'second', 'shield', 'jump'].includes(s));
        if (saved.length > 2) saved = saved.slice(0, 2);
        this.selectedAbilities = (saved.length === 2) ? saved : (saved.length === 1 ? saved : ['second']);
      } else {
        this.selectedAbilities = ['second'];
      }
    } catch(e) {
      this.selectedAbilities = ['second'];
    }
    
    this.setupDraggableChat();
    
    // Economy & Monetization state
    this.coins = null;
    this.playerLevel = 1;
    this.playerXP = 0;
    this.slot2Unlocked = false;
    this.slot2AdsWatched = 0;
    this.unlockedSkills = ['second', 'jump'];
    this.skillCharges = { jump: 3, second: 3, freeze: 3, swap: 3, shield: 3 };
    this.unlockedBoards = ['classic-oak'];
    this.adTracking = {
      date: new Date().toISOString().slice(0, 10),
      dailyAdsWatched: 0,
      dailyDoublersUsed: 0,
      firstAdClaimed: false,
      firstWinClaimedToday: false,
      lastWheelDate: null,
      wheelSpinsToday: 0
    };
    this.lastMatchCoinsEarned = 0;
    this.lastMatchDoubled = false;
    this.abilitiesActivatedThisMatch = new Set();
    this.isSpinningWheel = false;
    this.pieceSymbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };

    this.init();
  }

  applySavedCosmetics() {
    const savedBoardTheme = this.getEquippedBoard();
    document.body.dataset.boardTheme = savedBoardTheme;
  }

  // --- Account-linked player profile --------------------------------
  // The cloud profile is the canonical profile for name, rating, totals,
  // coins and the equipped board. Local storage is only the resilient mirror.

  async initializeProfilePersistence() {
    const storage = window.ChessArenaStorage;
    if (!storage) return null;

    try {
      await storage.init();
    } catch (e) {
      console.warn('[Profile] storage init failed', e);
    }

    // Load non-profile progression (level, XP, skills, loadout, ad counters,
    // settings) through the same Bridge/local adapter. This is the key
    // cross-session storage path required by PlayGama.
    try {
      await this.loadEconomyProgress();
    } catch (e) {
      console.warn('[Progress] load failed', e);
    }
    this.economyPersistenceReady = true;
    this.saveEconomyState();

    let profile = null;
    try {
      profile = await storage.loadProfile();
    } catch (e) {
      console.warn('[Profile] load failed', e);
    }

    if (profile && storage.isValidUsername(profile.username)) {
      this.applyCloudProfile(profile);
      this.initEconomy();

    // Pre-warm cloud multiplayer server if running on YouTube Playables / CDN
    try {
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const wsUrl = (window.CHESS_WS_URL || 'wss://chess-arena-262t.onrender.com');
        const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
        fetch(`${httpUrl}/health`, { mode: 'no-cors' }).catch(() => {});
      }
    } catch (e) {}

      this.syncLeaderboardProfile(profile, { silent: true, reason: 'startup' });
      return profile;
    }

    const draft = profile || storage.createDraftProfile();
    this.pendingProfileDraft = draft;
    this.showOnboardingModal(draft);
    return null;
  }

  attachUsernameSanitizer(input) {
    if (!input) return;
    const storage = window.ChessArenaStorage;
    const sanitize = (value) => storage && storage.sanitizeUsername
      ? storage.sanitizeUsername(value)
      : String(value || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
    input.maxLength = 16;
    input.oninput = () => {
      const clean = sanitize(input.value);
      if (input.value !== clean) input.value = clean;
    };
  }

  showOnboardingModal(draft) {
    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input');
    const btn = document.getElementById('btn-submit-username');
    const cancelBtn = document.getElementById('btn-cancel-username');
    const title = document.getElementById('username-modal-title');
    const subtitle = document.getElementById('username-modal-subtitle');
    if (!modal || !input || !btn || !title || !subtitle) return;

    const storage = window.ChessArenaStorage;
    const platform = this.getPlatformProfile();
    const prefill = storage && platform && platform.name
      ? storage.sanitizeUsername(platform.name)
      : '';

    this.onboardingPending = true;
    this.attachUsernameSanitizer(input);
    title.textContent = 'Enter Player Name';
    subtitle.textContent = storage && storage.mode === 'youtube'
      ? 'Your progress is saved to your YouTube account and follows you across devices.'
      : 'Your progress is saved automatically. On YouTube Playables it follows your account.';
    input.value = prefill.length >= 3 ? prefill : '';
    if (cancelBtn) cancelBtn.style.display = 'none';
    btn.textContent = 'Start Playing';
    btn.disabled = false;
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 120);

    input.onkeydown = (event) => {
      if (event.key === 'Enter') btn.click();
    };

    btn.onclick = async () => {
      const username = storage && storage.sanitizeUsername
        ? storage.sanitizeUsername(input.value)
        : String(input.value || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
      if (!storage || !storage.isValidUsername || !storage.isValidUsername(username)) {
        this.showToast('Name must be 3-16 letters or numbers.');
        input.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        const base = this.pendingProfileDraft || storage.createDraftProfile();
        const profile = await storage.createProfile(username, { __draft: base });
        this.pendingProfileDraft = null;
        this.onboardingPending = false;
        this.hideModal('username-modal');
        this.applyCloudProfile(profile);
        this.initEconomy();
        this.showToast(`Welcome, ${profile.username}!`);
        this.syncLeaderboardProfile(profile, { reason: 'onboarding' });
      } catch (e) {
        console.warn('[Profile] onboarding failed', e);
        this.showToast('Could not save your profile. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Start Playing';
      }
    };
  }

  applyCloudProfile(profile) {
    if (!profile) return;
    const storage = window.ChessArenaStorage;
    const clean = storage && storage.normalizeProfile
      ? storage.normalizeProfile(profile)
      : profile;
    if (!clean) return;

    this.cloudProfile = clean;
    if (clean.playerId) {
      this.playerId = clean.playerId;
      try { localStorage.setItem('chessarena_player_id', clean.playerId); } catch (e) { /* ignore */ }
    }

    const displayName = clean.username || (this.userProfile && this.userProfile.username) || '';
    this.userProfile = Object.assign({}, this.userProfile || {}, {
      playerId: clean.playerId,
      username: displayName,
      elo: clean.rating,
      wins: clean.stats.wins,
      losses: clean.stats.losses,
      draws: clean.stats.draws
    });

    // Keep the legacy AI/online bucket shape for the rest of the UI, but all
    // totals now come from the canonical cloud profile.
    this.playerStats = {
      rating: clean.rating,
      ai: { wins: 0, losses: 0, draws: 0 },
      online: {
        wins: clean.stats.wins,
        losses: clean.stats.losses,
        draws: clean.stats.draws
      },
      hasServerStats: true
    };

    // Cloud/Account Profile is the authoritative source of truth on YouTube Playables & cross-device play
    if (clean && Number.isFinite(Number(clean.coins)) && clean.coins >= 0) {
      const cloudBalance = Math.floor(Number(clean.coins));
      // If user earned coins in the active session before cloud profile finished loading,
      // preserve their earnings; otherwise take the account cloud balance.
      if (this._sessionCoinsModified) {
        clean.coins = Math.max(this.coins || 0, cloudBalance);
      } else {
        clean.coins = cloudBalance;
      }
      this.coins = clean.coins;
    } else if (this.coins !== null && Number.isFinite(Number(this.coins)) && this.coins >= 0) {
      clean.coins = this.coins;
    } else {
      let savedLocal = NaN;
      try { savedLocal = parseInt(localStorage.getItem('chessarena_coins'), 10); } catch (e) {}
      if (Number.isFinite(savedLocal) && savedLocal >= 0) {
        clean.coins = savedLocal;
        this.coins = savedLocal;
      } else {
        this.coins = 1000;
        clean.coins = 1000;
      }
    }
    this.updateUserCoins(this.coins, { persist: false });
    if (clean.equipped && clean.equipped.board) {
      const cloudBoard = clean.equipped.board;
      document.body.dataset.boardTheme = cloudBoard;
      try {
        localStorage.setItem('chessarena_board_theme', cloudBoard);
        localStorage.setItem('owl_board_theme', cloudBoard);
        if (Array.isArray(this.unlockedBoards) && !this.unlockedBoards.includes(cloudBoard)) {
          this.unlockedBoards.push(cloudBoard);
          localStorage.setItem('owl_unlocked_boards', JSON.stringify(this.unlockedBoards));
        }
      } catch (e) { /* ignore */ }
    }

    this.savePlayerStats();
    this.renderProfileStats();
    this.applyIdentityToUI(
      this.platformProfile && this.platformProfile.name,
      this.platformProfile && this.platformProfile.avatar,
      this.platformProfile && this.platformProfile.platformLabel
    );
    this.renderProfileRank(clean);
    this.renderLeaderboardMyRank();
  }

  renderProfileRank(profile) {
    const badge = document.getElementById('profile-rank-badge');
    if (!badge) return;
    const rank = profile && Number(profile.rank) > 0 ? Math.floor(Number(profile.rank)) : null;
    badge.textContent = rank ? `#${rank}` : 'Unranked';
    badge.title = rank ? 'Global leaderboard rank' : 'Play a rated match to enter the standings';
  }

  getEloTitle(rating) {
    const value = Math.floor(Number(rating) || 0);
    const tiers = [
      { min: 2600, name: 'Mythic', icon: '✧', color: '#FF7AE0', bg: 'rgba(255, 122, 224, 0.20)', border: 'rgba(255, 122, 224, 0.78)', glow: 'rgba(255, 122, 224, 0.42)' },
      { min: 2400, name: 'Legend', icon: '★', color: '#FFE066', bg: 'rgba(255, 224, 102, 0.20)', border: 'rgba(255, 224, 102, 0.8)', glow: 'rgba(255, 224, 102, 0.42)' },
      { min: 2200, name: 'Grandmaster', icon: '✦', color: '#C9A7FF', bg: 'rgba(201, 167, 255, 0.20)', border: 'rgba(201, 167, 255, 0.76)', glow: 'rgba(201, 167, 255, 0.38)' },
      { min: 2000, name: 'Royal King', icon: '♚', color: '#FF6B5E', bg: 'rgba(255, 107, 94, 0.19)', border: 'rgba(255, 107, 94, 0.76)', glow: 'rgba(255, 107, 94, 0.38)' },
      { min: 1800, name: 'Crimson Queen', icon: '♛', color: '#FF6B9D', bg: 'rgba(255, 107, 157, 0.19)', border: 'rgba(255, 107, 157, 0.76)', glow: 'rgba(255, 107, 157, 0.38)' },
      { min: 1600, name: 'Golden Rook', icon: '♜', color: '#FFD24A', bg: 'rgba(255, 210, 74, 0.20)', border: 'rgba(255, 210, 74, 0.78)', glow: 'rgba(255, 210, 74, 0.4)' },
      { min: 1400, name: 'Azure Bishop', icon: '♝', color: '#5CC8FF', bg: 'rgba(92, 200, 255, 0.18)', border: 'rgba(92, 200, 255, 0.76)', glow: 'rgba(92, 200, 255, 0.36)' },
      { min: 1200, name: 'Silver Knight', icon: '♞', color: '#DCE6F2', bg: 'rgba(220, 230, 242, 0.17)', border: 'rgba(220, 230, 242, 0.74)', glow: 'rgba(220, 230, 242, 0.32)' },
      { min: 1000, name: 'Bronze Pawn', icon: '♟', color: '#E8A25E', bg: 'rgba(232, 162, 94, 0.18)', border: 'rgba(232, 162, 94, 0.74)', glow: 'rgba(232, 162, 94, 0.34)' }
    ];
    return tiers.find(tier => value >= tier.min) || null;
  }

  getEloTitleBadgeHtml(rating) {
    const title = this.getEloTitle(rating);
    if (!title) return '';
    return `<span class="elo-title-badge" style="--title-color:${title.color};--title-bg:${title.bg};--title-border:${title.border};--title-glow:${title.glow};" title="${title.name} · ${title.min}+ Elo"><span class="elo-title-icon">${title.icon}</span>${title.name}</span>`;
  }

  renderProfileTitle(rating) {
    const badge = document.getElementById('profile-title-badge');
    if (!badge) return;
    const title = this.getEloTitle(rating);
    if (!title) {
      badge.style.display = 'none';
      badge.textContent = '';
      return;
    }
    badge.style.display = 'inline-flex';
    badge.style.setProperty('--title-color', title.color);
    badge.style.setProperty('--title-bg', title.bg);
    badge.style.setProperty('--title-border', title.border);
    badge.style.setProperty('--title-glow', title.glow);
    badge.innerHTML = `<span class="elo-title-icon">${title.icon}</span>${title.name}`;
    badge.title = `${title.name} · ${title.min}+ Elo (your rating: ${Math.floor(Number(rating) || 0)})`;
  }

  isOwnLeaderboardPlayer(player) {
    if (!player || !this.cloudProfile || !this.cloudProfile.username) return false;
    if (this.cloudProfile.playerId && player.playerId) {
      return String(this.cloudProfile.playerId) === String(player.playerId);
    }
    return String(player.username || '').toLowerCase() === String(this.cloudProfile.username).toLowerCase();
  }

  getLeaderboardSelfEntry() {
    const profile = this.cloudProfile;
    if (!profile || !profile.username) return null;

    const row = (this.leaderboardTopPlayers || []).find((player) => this.isOwnLeaderboardPlayer(player));
    if (row) return row;

    const rank = Math.floor(Number(profile.rank) || 0);
    if (rank <= 0) return null;

    const stats = profile.stats || {};
    return {
      rank,
      playerId: profile.playerId || null,
      username: profile.username,
      rating: Number(profile.rating) || 1200,
      wins: Math.max(0, Number(stats.wins) || 0),
      losses: Math.max(0, Number(stats.losses) || 0)
    };
  }

  escapeLeaderboardHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  buildLeaderboardPinnedCard(entry) {
    const rank = Math.max(1, Math.floor(Number(entry.rank) || 0));
    const total = Math.max(0, Number(this.leaderboardTotalPlayers) || 0);
    const name = this.escapeLeaderboardHtml(entry.username || 'Player');
    const rating = Number(entry.rating != null ? entry.rating : entry.elo) || 1200;
    const wins = Math.max(0, Number(entry.wins) || 0);
    const losses = Math.max(0, Number(entry.losses) || 0);
    const titleBadge = this.getEloTitleBadgeHtml(rating);
    const totalLabel = total > 0 ? `<small>of ${total}</small>` : '';

    return `<div class="leaderboard-pinned-rank-badge" aria-hidden="true">
        <span class="leaderboard-pinned-rank-number">#${rank}</span>
        ${totalLabel}
      </div>
      <div class="leaderboard-pinned-rank-body">
        <div class="leaderboard-pinned-rank-name">
          <span class="leaderboard-pinned-rank-player">${name}</span>
          ${titleBadge}
          <span class="leaderboard-pinned-you">YOU</span>
        </div>
        <div class="leaderboard-pinned-rank-meta">Rating: <strong>${rating}</strong><span class="leaderboard-pinned-rank-dot">·</span>${wins}W / ${losses}L</div>
      </div>`;
  }

  hideLeaderboardPinnedCard(pinned) {
    if (!pinned) return;
    pinned.classList.add('hidden');
    pinned.innerHTML = '';
    pinned.removeAttribute('aria-label');
    const screen = pinned.closest('#screen-leaderboard');
    if (screen) screen.classList.remove('has-pinned-rank');
  }

  renderLeaderboardMyRank() {
    const el = document.getElementById('leaderboard-my-rank');
    const pinned = document.getElementById('leaderboard-pinned-rank');
    const profile = this.cloudProfile;

    if (!profile || !profile.username) {
      if (el) {
        el.style.display = '';
        el.textContent = 'Enter a player name to join the standings';
      }
      this.hideLeaderboardPinnedCard(pinned);
      return;
    }

    const self = this.getLeaderboardSelfEntry();
    const rank = self ? Math.max(0, Math.floor(Number(self.rank) || 0)) : 0;
    if (!rank) {
      if (el) {
        el.style.display = '';
        el.textContent = 'Unranked — finish a match to enter the standings';
      }
      this.hideLeaderboardPinnedCard(pinned);
      return;
    }

    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }

    if (!pinned) return;
    pinned.innerHTML = this.buildLeaderboardPinnedCard(self);
    pinned.classList.remove('hidden');
    const screen = pinned.closest('#screen-leaderboard');
    if (screen) screen.classList.add('has-pinned-rank');
    const total = Math.max(0, Number(this.leaderboardTotalPlayers) || 0);
    const rating = Number(self.rating != null ? self.rating : self.elo) || 1200;
    pinned.setAttribute(
      'aria-label',
      `Your rank: #${rank}${total > 0 ? ' of ' + total : ''}, ${self.username}, rating ${rating}`
    );
  }

  async ensureProfileReady() {
    if (this.profileReady) {
      try { await this.profileReady; } catch (e) { /* ignore */ }
    }
    if (!this.cloudProfile || !this.cloudProfile.username) {
      if (this.onboardingPending) {
        this.showToast('Enter a player name to continue.');
      }
      return false;
    }
    return true;
  }

  async ensureServerProfileSynced() {
    if (!this.cloudProfile || !this.cloudProfile.username) return false;
    if (Date.now() - (this.lastLeaderboardSyncAt || 0) < 60000) return true;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 2500));
    return Promise.race([
      this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'pre-online' }),
      timeout
    ]);
  }

  async syncLeaderboardProfile(profile = this.cloudProfile, options = {}) {
    if (!profile || !profile.username) return false;
    if (this._leaderboardSyncInFlight) {
      this._leaderboardSyncQueued = true;
      return this._leaderboardSyncInFlight;
    }

    const snapshot = {
      playerId: profile.playerId,
      username: profile.username,
      rating: profile.rating,
      stats: {
        wins: profile.stats ? profile.stats.wins : 0,
        losses: profile.stats ? profile.stats.losses : 0,
        draws: profile.stats ? profile.stats.draws : 0,
        totalMatches: profile.stats ? profile.stats.totalMatches : 0,
        winStreak: profile.stats ? profile.stats.winStreak : 0,
        bestStreak: profile.stats ? profile.stats.bestStreak : 0
      }
    };

    this._leaderboardSyncInFlight = (async () => {
      let controller = null;
      let timeout = null;
      try {
        controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch('/api/leaderboard/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(snapshot),
          signal: controller.signal
        });
        if (!response.ok) {
          const error = new Error('Leaderboard sync failed with ' + response.status);
          error.permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
          throw error;
        }

        const data = await response.json();
        const target = this.cloudProfile || profile;
        const storage = window.ChessArenaStorage;
        const canonical = storage && storage.sanitizeUsername
          ? storage.sanitizeUsername(data.username || target.username)
          : String(data.username || target.username || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);

        // The server keeps the newer profile when a reconnect presents an older
        // cloud snapshot (for example a PvP game finished after the tab closed).
        // Adopt those authoritative totals before saving the profile locally.
        const serverStats = data.stats && typeof data.stats === 'object' ? data.stats : null;
        if (serverStats && target.stats) {
          const count = (value) => {
            const n = Number(value);
            return Number.isFinite(n) && n > 0 ? Math.min(10000000, Math.floor(n)) : 0;
          };
          const wins = count(serverStats.wins);
          const losses = count(serverStats.losses);
          const draws = count(serverStats.draws);
          const serverTotal = wins + losses + draws;
          const targetTotal = count(target.stats.wins) + count(target.stats.losses) + count(target.stats.draws);
          if (serverTotal >= targetTotal) {
            const serverRating = Number(data.rating);
            target.stats = {
              wins,
              losses,
              draws,
              totalMatches: serverTotal,
              winStreak: count(serverStats.winStreak),
              bestStreak: Math.max(count(serverStats.winStreak), count(serverStats.bestStreak))
            };
            if (Number.isFinite(serverRating) && serverRating >= 100) {
              target.rating = Math.min(4000, Math.max(100, Math.floor(serverRating)));
            }
            target.lastUpdated = Date.now();
          }
        }

        if (canonical && canonical.length >= 3) target.username = canonical;
        target.rank = Number(data.currentRank) > 0 ? Math.floor(Number(data.currentRank)) : null;
        target.lastUpdated = Date.now();
        this.cloudProfile = target;
        this.lastLeaderboardSyncAt = Date.now();
        this.leaderboardSyncAttempts = 0;
        if (this.leaderboardRetryTimer) {
          clearTimeout(this.leaderboardRetryTimer);
          this.leaderboardRetryTimer = null;
        }
        this.leaderboardTotalPlayers = Math.max(0, Number(data.totalPlayers) || 0);
        if (Array.isArray(data.topPlayers)) this.leaderboardTopPlayers = data.topPlayers;

        if (storage && storage.saveProfile) {
          storage.saveProfile(target).catch(() => {});
        }
        this.applyCloudProfile(target);
        this.refreshLeaderboardIfVisible();

        if (!options.silent && canonical && canonical !== snapshot.username) {
          this.showToast(`That name was taken — you are now ${canonical}.`);
        }
        return true;
      } catch (e) {
        console.warn('[Leaderboard] sync failed', e && (e.message || e));
        if (!e || !e.permanent) this.scheduleLeaderboardRetry();
        if (!options.silent) this.showToast('Could not update rankings. Retrying in the background.');
        return false;
      } finally {
        if (timeout) clearTimeout(timeout);
        this._leaderboardSyncInFlight = null;
        if (this._leaderboardSyncQueued) {
          this._leaderboardSyncQueued = false;
          setTimeout(() => {
            if (this.cloudProfile) this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'queued' });
          }, 0);
        }
      }
    })();

    return this._leaderboardSyncInFlight;
  }

  queueLeaderboardSync(delay = 250) {
    if (this._leaderboardSyncDebounce) clearTimeout(this._leaderboardSyncDebounce);
    this._leaderboardSyncDebounce = setTimeout(() => {
      this._leaderboardSyncDebounce = null;
      if (this.cloudProfile && this.cloudProfile.username) {
        this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'match' });
      }
    }, Math.max(0, delay));
  }

  scheduleLeaderboardRetry() {
    if (this.leaderboardRetryTimer || !this.cloudProfile || !this.cloudProfile.username) return;
    if (this.leaderboardSyncAttempts >= 8) return;
    const delay = Math.min(30000, 2000 * Math.pow(2, this.leaderboardSyncAttempts));
    this.leaderboardSyncAttempts += 1;
    this.leaderboardRetryTimer = setTimeout(() => {
      this.leaderboardRetryTimer = null;
      if (this.cloudProfile && this.cloudProfile.username) {
        this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'retry' });
      }
    }, delay);
  }

  refreshLeaderboardIfVisible() {
    const screen = document.getElementById('screen-leaderboard');
    if (screen && screen.classList.contains('active')) {
      this.loadLeaderboardData();
    }
  }

  onlinePlayAvailable() {
    try {
      const platform = window.ChessArenaPlatform;
      if (platform && typeof platform.isExternalCallsSupported === 'function' &&
          platform.isExternalCallsSupported() === false) {
        this.showToast('Online play is unavailable on this platform. AI matches still work.');
        return false;
      }
    } catch (e) { /* allow local play */ }
    return true;
  }

  createGuestId() {
    const bytes = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return 'guest_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  init() {
    if (!this.playerId) {
      this.playerId = localStorage.getItem('chessarena_player_id') || this.createGuestId();
      localStorage.setItem('chessarena_player_id', this.playerId);
    }
    if (window.AdService) {
      window.AdService.init();
    }

    // Restore cosmetics, local progression and platform identity (PlayGama / YouTube)
    this.applySavedCosmetics();
    this.loadPlayerStats();
    this.renderProfileStats();
    this.applyPlatformProfile();
    // Load the local economy immediately so the UI is correct even before the
    // cloud profile resolves. The cloud profile then reconciles the coin balance.
    this.initEconomy();
    this.applyAvatarToUI();

    // Load the account-linked profile after the local UI is usable. The prompt
    // is shown only when the cloud profile has no valid player name.
    this.profileReady = this.initializeProfilePersistence();
    if (!this._profileRetryBound) {
      this._profileRetryBound = true;
      window.addEventListener('online', () => {
        if (this.cloudProfile && this.cloudProfile.username) {
          this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'online' });
        }
      });
    }

    // Enter key on room code input
    const roomInput = document.getElementById('room-code-input');
    if (roomInput) {
      roomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.joinRoom();
      });
    }

    // Join Room card click — expand/collapse the code input
    const joinCard = document.getElementById('join-room-card');
    const joinExpand = document.getElementById('join-room-expand');
    if (joinCard && joinExpand) {
      joinCard.addEventListener('click', () => {
        const open = joinExpand.classList.toggle('open');
        joinCard.classList.toggle('expanded', open);
        if (open && roomInput) setTimeout(() => roomInput.focus(), 150);
      });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setTimeout(() => {
        this.showScreen('screen-room');
        if (roomInput) roomInput.value = roomFromUrl.toUpperCase();
        this.joinRoom();
      }, 500);
    }

    // Enter key on chat input
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });
    }

    // Prevent zoom on double tap
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - (this.lastTap || 0) < 300) {
        e.preventDefault();
      }
      this.lastTap = now;
    }, { passive: false });

    // -- Start ambient music on page load or on user gesture --
    if (this.musicEnabled) {
      try { this.startBgMusic(); } catch(e) {}
      this.setupAudioAutoplayUnlock();
    }

    // PlayGama lifecycle: apply the initial audio/pause state and react to
    // later host changes (tab switches, ads, platform mute/pause).
    window.addEventListener('chessarena:platform-state', (event) => {
      this.applyPlatformState(event && event.detail);
    });
    const platform = window.ChessArenaPlatform;
    if (platform && typeof platform.getState === 'function') {
      this.applyPlatformState(platform.getState());
    }
    if (platform && typeof platform.gameReady === 'function') {
      platform.gameReady().catch(() => {});
    }
  }

  applyPlatformState(state) {
    if (!state || typeof state !== 'object') return;
    const initial = !this.platformStateReady;
    this.setPlatformAudioEnabled(state.audioEnabled !== false, { initial });
    this.setPlatformPaused(state.paused === true, { initial });
    this.platformStateReady = true;
  }

  setPlatformAudioEnabled(enabled, options = {}) {
    this.platformAudioMuted = enabled === false;
    if (this.platformAudioMuted) {
      this.stopBgMusic();
      try {
        if (this.audioCtx && this.audioCtx.state === 'running') {
          this.audioCtx.suspend().catch(() => {});
        }
      } catch (e) { /* ignore */ }
      return;
    }
    if (!options.initial && this.musicEnabled && !this.platformPaused && (!this.bgMusicRunning || (this.bgAudio && this.bgAudio.paused))) {
      this.startBgMusic();
    }
  }

  setPlatformPaused(paused, options = {}) {
    const next = paused === true;
    if (this.platformPaused === next) return;
    this.platformPaused = next;
    this.lastMoveTime = Date.now();

    if (next) {
      this.stopBgMusic();
      try {
        if (this.audioCtx && this.audioCtx.state === 'running') {
          this.audioCtx.suspend().catch(() => {});
        }
      } catch (e) { /* ignore */ }
    } else {
      this.lastMoveTime = Date.now();
      if (!options.initial && this.musicEnabled && !this.platformAudioMuted && (!this.bgMusicRunning || (this.bgAudio && this.bgAudio.paused))) {
      this.startBgMusic();
    }
    }
  }

  // --- Audio -----------------------------------------

  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    // Warm the check loop so the first check starts instantly.
    if (!this._checkPreloadStarted && this.audioCtx) {
      this._checkPreloadStarted = true;
      this.loadCheckLoop();
    }
  }

  playSound(type) {
    if (this.soundMuted || this.platformAudioMuted || this.platformPaused) return;
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      if (!ctx) return;

      switch (type) {

        case 'freeze': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
          break;
        }

          case 'tweet': {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);
            break;
          }
        case 'move': {
          // Satisfying wooden piece placement "tock"
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(460, ctx.currentTime);
          osc1.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.075);
          gain1.gain.setValueAtTime(0.18, ctx.currentTime);
          gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.075);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(ctx.currentTime);
          osc1.stop(ctx.currentTime + 0.075);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(280, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.06);
          break;
        }

        case 'capture': {
          this.playShortSound('/assets/sounds/capture.mp3', 0.85);
          break;
        }

        case 'check': {
          this.startCheckSound();
          break;
        }

        case 'gameover': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 320;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.6);
          break;
        }

        case 'your-turn': {
          const t0 = ctx.currentTime;
          // Tone 1: D5 (587 Hz)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, t0);
          gain1.gain.setValueAtTime(0.24, t0);
          gain1.gain.exponentialRampToValueAtTime(0.01, t0 + 0.12);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(t0);
          osc1.stop(t0 + 0.12);

          // Tone 2: A5 (880 Hz) - crisp notification bell
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, t0 + 0.08);
          gain2.gain.setValueAtTime(0.26, t0 + 0.08);
          gain2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(t0 + 0.08);
          osc2.stop(t0 + 0.35);
          break;
        }
      }
    } catch {
      // Audio not available
    }
  }

  // --- Sound helpers (file based) ---------------------

  playShortSound(url, volume = 0.8) {
    if (this.soundMuted || this.platformAudioMuted || this.platformPaused) return;
    try {
      if (!this._shortSoundCache) this._shortSoundCache = new Map();
      let audio = this._shortSoundCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        this._shortSoundCache.set(url, audio);
      }
      audio.volume = volume;
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  // --- Check cue (dynamic gapless loop) ---------------
  // The player supplied a check sound that is itself a short repeating phrase
  // (~0.92s). Instead of playing the whole file once we loop just one clean
  // period with an AudioBufferSourceNode, which is sample accurate: no pause,
  // no silence and no audible cut at the seam. A GainNode handles the fade-in
  // when the king is checked and the quick fade-out the instant it escapes.

  loadCheckLoop() {
    if (this._checkBuffer) return Promise.resolve(this._checkBuffer);
    if (this._checkLoadPromise) return this._checkLoadPromise;
    this.initAudio();
    const ctx = this.audioCtx;
    if (!ctx) return Promise.resolve(null);

    this._checkLoadPromise = fetch(CHECK_LOOP_SRC, { cache: 'force-cache' })
      .then(res => {
        if (!res.ok) throw new Error('check loop ' + res.status);
        return res.arrayBuffer();
      })
      .then(ab => new Promise((resolve, reject) => {
        const p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && typeof p.then === 'function') p.then(resolve, reject);
      }))
      .then(buffer => {
        this._checkBuffer = buffer;
        this._checkLoadPromise = null;
        return buffer;
      })
      .catch(() => {
        this._checkLoadPromise = null;
        return null;
      });
    return this._checkLoadPromise;
  }

  startCheckSound() {
    if (this.soundMuted || this.platformAudioMuted || this.platformPaused) return;
    if (this._checkSource) return; // already looping
    this.initAudio();
    const ctx = this.audioCtx;
    if (!ctx) return;

    this.loadCheckLoop().then(buffer => {
      if (!buffer) return;
      if (this._checkSource) return;
      if (!this._checkAlertOn) return; // king already escaped while decoding
      if (this.soundMuted || this.platformAudioMuted || this.platformPaused) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;

      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // never let the first sample through at full level
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(CHECK_VOLUME, now + CHECK_FADE_IN);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);

      this._checkSource = source;
      this._checkGain = gain;
    });
  }

  stopCheckSound(fadeSec = CHECK_FADE_OUT) {
    const ctx = this.audioCtx;
    const source = this._checkSource;
    const gain = this._checkGain;
    this._checkSource = null;
    this._checkGain = null;
    if (!ctx || !source || !gain) return;

    const now = ctx.currentTime;
    const fade = Math.max(0.02, fadeSec);
    try {
      // Hold whatever level the fade-in currently sits at, then ramp to silence
      // so an early escape never cuts the cue abruptly.
      if (typeof gain.gain.cancelAndHoldAtTime === 'function') {
        gain.gain.cancelAndHoldAtTime(now);
      } else {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
      }
      gain.gain.linearRampToValueAtTime(0.0001, now + fade);
    } catch (e) {}
    try { source.stop(now + fade + 0.02); } catch (e) {}
    setTimeout(() => {
      try { source.disconnect(); gain.disconnect(); } catch (e) {}
    }, (fade + 0.2) * 1000);
  }

  // --- Screen Management -----------------------------

  showScreen(screenId) {
    if (screenId !== 'screen-game' && this._checkAlertOn) {
      this.stopCheckAlert();
    }
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
      // Force reflow for animation
      target.offsetHeight;
      target.classList.add('active');
    }
  }

  // --- AI Game ---------------------------------------

  showAIDifficultySelect() {
    this.showScreen('screen-ai-select');
  }

  selectColor(color) {
    this.selectedAIColor = color;
    document.getElementById('color-white').classList.toggle('active', color === 'white');
    document.getElementById('color-black').classList.toggle('active', color === 'black');
  }

  startAIGame(difficulty) {
    this.opponentAvatarSrc = null;
    this.gameMode = 'ai';
    this.playerColor = this.selectedAIColor;
    this.boardFlipped = this.playerColor === 'black';
    this.engine = new ChessEngine();
    this.ai = new AIEngine(difficulty);
    this.lastMove = null;
    this.gameStartTime = Date.now();
    this.timers = { white: null, black: null };
    this.statsRecordedForGame = null;
    this.lastMatchCoinsEarned = 0;
    this.lastMatchDoubled = false;
    this.abilitiesActivatedThisMatch = new Set();
    this.hintCountInMatch = 0;
    this.undoCountInMatch = 0;
    this.hasUndoneCurrentMove = false;
    this.ratingAtGameStart = this.cloudProfile ? this.cloudProfile.rating : this.getTotalStats().rating;
    this.lastServerStats = null;
    this.lastServerStatsGameId = null;
    this.lastServerStatsAt = 0;

    const aiRating = { easy: 800, medium: 1200, hard: 1600 }[difficulty] || 1200;
    const aiLevel = { easy: 1, medium: 4, hard: 8 }[difficulty] || 4;
    this.setupGameUI(
      this.getPreferredDisplayName() || 'You',
      `AI (${difficulty})`,
      false,
      this.getGameHeaderSelfMeta(),
      { username: `AI (${difficulty})`, rating: aiRating, level: aiLevel }
    );
    this.startBgMusic();
    this.showScreen('screen-game');
        setTimeout(() => this.startBgMusic(), 500);
    this.renderBoard();
    this.updatePlayerBars();

    // If player is black, AI moves first
    if (this.playerColor === 'black') {
      setTimeout(() => this.makeAIMove(), 500);
    }
  }

  makeAIMove() {
    if (!this.engine || this.engine.gameOver) return;
    if (this.platformPaused) {
      setTimeout(() => this.makeAIMove(), 250);
      return;
    }
    if (this.engine.currentTurn === this.playerColor) return;

    this.isAnimatingMove = false;

    // Run computation asynchronously so browser paints and UI stays completely responsive
    setTimeout(() => {
      try {
        if (!this.engine || this.engine.gameOver) return;

        let move = null;
        try {
          move = this.ai ? this.ai.getBestMove(this.engine) : null;
        } catch (e) {
          console.warn('[AI Engine] Search error, using fallback move:', e);
        }

        // Guaranteed fallback if minimax fails or times out
        if (!move) {
          const allMoves = this.engine.getAllLegalMoves(this.engine.currentTurn);
          if (allMoves && allMoves.length > 0) {
            move = allMoves[Math.floor(Math.random() * allMoves.length)];
          }
        }

        if (!move) {
          if (this.engine.isKingInCheck(this.engine.currentTurn)) {
            this.engine.gameOver = true;
            this.engine.gameResult = { winner: this.playerColor, reason: 'checkmate' };
          } else {
            this.engine.gameOver = true;
            this.engine.gameResult = { winner: null, reason: 'stalemate' };
          }
          this.showGameOver();
          return;
        }

        const result = this.engine.makeMove(move.fromRow, move.fromCol, move.row, move.col, move.promotion || null);
        if (result) {
              // User made a move -> reset 1-move undo lock so they can undo this new move if desired
    if (result.piece.color === this.playerColor) {
      this.hasUndoneCurrentMove = false;
      this.updateUndoButtonUI();
    }
    this.animateMoveAndApply(result, () => {
            if (this.engine.gameOver) {
              this.playSound('gameover');
              setTimeout(() => this.showGameOver(), 500);
            }
          });
        } else {
          this.isAnimatingMove = false;
          this.renderBoard();
        }
      } catch (err) {
        console.error('[makeAIMove] Error:', err);
        this.isAnimatingMove = false;
        this.renderBoard();
      }
    }, 50);
  }

  onCreateRoomClick() {
    this.timerMinutes = 10;
    this.createRoom();
  }

  getAvatarById(avatarId) {
    return PLAYER_AVATARS.find((avatar) => avatar.id === avatarId) || null;
  }

  getSelectedAvatar() {
    return this.getAvatarById(this.avatarId) || PLAYER_AVATARS[0] || null;
  }

  getSelectedAvatarSrc() {
    const avatar = this.getSelectedAvatar();
    return avatar ? avatar.src : '/assets/avatar-default.svg';
  }

  getRandomAvatarSrc() {
    const avatar = PLAYER_AVATARS.length
      ? PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]
      : null;
    return avatar ? avatar.src : '/assets/avatar-default.svg';
  }

  readStoredAvatarId() {
    try {
      const saved = localStorage.getItem('chessarena_avatar_id');
      return this.normalizeAvatarId(saved);
    } catch (e) {
      return null;
    }
  }

  persistAvatarId(avatarId = this.avatarId) {
    try {
      localStorage.setItem('chessarena_avatar_id', avatarId);
    } catch (e) { /* localStorage may be unavailable */ }
  }

  resolveInitialAvatarId() {
    const saved = this.readStoredAvatarId();
    if (saved) {
      this.avatarIdFromStorage = true;
      return saved;
    }
    const random = PLAYER_AVATARS.length
      ? PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]
      : null;
    const avatarId = random ? random.id : 'pfp-01';
    this.persistAvatarId(avatarId);
    return avatarId;
  }

  normalizeAvatarId(value) {
    const avatarId = String(value || '').trim();
    return PLAYER_AVATARS.some((avatar) => avatar.id === avatarId) ? avatarId : null;
  }

  buildAvatarStrip(count = 40) {
    const strip = [];
    while (strip.length < count && PLAYER_AVATARS.length) {
      const batch = PLAYER_AVATARS.slice();
      for (let i = batch.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [batch[i], batch[j]] = [batch[j], batch[i]];
      }
      strip.push(...batch.map((avatar) => avatar.src));
    }
    return strip.slice(0, count);
  }

  buildUserAvatar(seed) {
    let hash = 2166136261;
    const source = String(seed || 'player');
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;

    const backgrounds = [
      ['#D98E5C', '#8C4A2F'], ['#6F9C8C', '#2E5C55'], ['#7D85B5', '#3E466F'],
      ['#C47C9E', '#7A3D5E'], ['#8C9A5B', '#4E5E2A'], ['#B58A5A', '#6B4528']
    ];
    const skins = ['#F6D5B8', '#E8B98F', '#C98B62', '#9B6544', '#6E452E'];
    const hairs = ['#2B1A12', '#4A2E1B', '#1B1B1B', '#6B3E1F', '#B07B3F', '#8C8C8C'];
    const shirts = ['#2E6B5E', '#3E5C8C', '#8C3E4B', '#6B4E8C', '#4A6B2E', '#8C6B2E'];

    const bg = backgrounds[hash % backgrounds.length];
    const skin = skins[(hash >>> 3) % skins.length];
    const hair = hairs[(hash >>> 6) % hairs.length];
    const shirt = shirts[(hash >>> 9) % shirts.length];
    const hairStyle = (hash >>> 12) % 4;
    const hasGlasses = ((hash >>> 15) % 5) === 0;

    const hairShapes = [
      `<path d="M27 43c0-17 10-28 23-28s23 11 23 28c-4-8-11-12-23-12s-19 4-23 12z" fill="${hair}"/>`,
      `<path d="M27 44c-1-18 9-29 23-29 15 0 24 12 23 29-5-9-12-12-22-12-8 0-16 4-24 12z" fill="${hair}"/><path d="M28 42c3-10 9-16 18-20-3 8-5 15-4 22z" fill="${hair}" opacity=".85"/>`,
      `<path d="M27 43c0-17 10-28 23-28s23 11 23 28c-4-8-11-12-23-12s-19 4-23 12z" fill="${hair}"/><circle cx="29" cy="30" r="9" fill="${hair}"/><circle cx="71" cy="30" r="9" fill="${hair}"/><circle cx="38" cy="20" r="10" fill="${hair}"/><circle cx="62" cy="20" r="10" fill="${hair}"/><circle cx="50" cy="15" r="10" fill="${hair}"/>`,
      `<path d="M27 43c0-17 10-28 23-28s23 11 23 28c-4-8-11-12-23-12s-19 4-23 12z" fill="${hair}"/><circle cx="50" cy="12" r="10" fill="${hair}"/>`
    ];
    const glasses = hasGlasses
      ? `<g stroke="#2B1A12" stroke-width="1.6" fill="none"><circle cx="42" cy="43" r="6"/><circle cx="58" cy="43" r="6"/><path d="M48 43h4"/></g>`
      : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
      <rect width="100" height="100" fill="url(#bg)"/>
      <circle cx="50" cy="48" r="38" fill="#FFFFFF" opacity=".08"/>
      <path d="M10 100c2-21 17-32 40-32s38 11 40 32z" fill="${shirt}"/>
      <path d="M38 69l12 10 12-10" fill="none" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2"/>
      <circle cx="50" cy="43" r="23" fill="${skin}"/>
      ${hairShapes[hairStyle]}
      <circle cx="42" cy="43" r="2" fill="#2B1A12"/>
      <circle cx="58" cy="43" r="2" fill="#2B1A12"/>
      <path d="M45 53c3 3 7 3 10 0" fill="none" stroke="#7A3B2E" stroke-width="2" stroke-linecap="round"/>
      ${glasses}
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  updateRoulettePlayerAvatar() {
    const avatar = document.getElementById('roulette-you-avatar');
    if (avatar) avatar.src = this.getSelectedAvatarSrc();

    const nameEl = document.getElementById('roulette-you-name');
    if (nameEl) nameEl.textContent = this.getPreferredDisplayName() || 'You';

    const ratingEl = document.getElementById('roulette-you-rating');
    const myRating = (this.cloudProfile && Number.isFinite(Number(this.cloudProfile.rating)))
      ? Number(this.cloudProfile.rating)
      : (this.getTotalStats && this.getTotalStats().rating ? this.getTotalStats().rating : 1200);
    if (ratingEl) ratingEl.textContent = `${myRating} Elo`;
  }

  startSlotMachine() {
    const machine = document.getElementById('avatar-slot-machine');
    const animationEl = document.getElementById('matchmaking-animation');
    const waitingInfo = document.getElementById('waiting-room-info');
    const spinner = document.getElementById('waiting-spinner-container');
    const cancelBtn = document.getElementById('btn-cancel-waiting');

    // Show animation, hide room info
    if (animationEl) animationEl.classList.remove('hidden');
    if (waitingInfo) waitingInfo.classList.add('hidden');
    if (spinner) spinner.classList.add('hidden');

    const titleEl = document.getElementById('waiting-title');
    const subtitleEl = document.getElementById('waiting-subtitle');
    if (titleEl) titleEl.textContent = 'Finding opponent...';
    if (subtitleEl) subtitleEl.textContent = 'Searching for the best match for you';
    if (cancelBtn) cancelBtn.style.display = 'block';

    if (!machine) return;

    this.opponentAvatarSrc = null;
    this.updateRoulettePlayerAvatar();

    const oppNameEl = document.getElementById('match-opponent-name');
    const oppRatingEl = document.getElementById('match-opponent-rating');
    if (oppNameEl) oppNameEl.textContent = 'Searching...';
    if (oppRatingEl) oppRatingEl.textContent = '—';

    // Build a fresh strip from the same portrait pool the player chooses from.
    const avatars = this.buildAvatarStrip(40);
    this.slotAvatarPool = avatars;

    machine.innerHTML = '';
    avatars.forEach((src, index) => {
      const item = document.createElement('div');
      item.className = 'slot-avatar-item';
      item.innerHTML = `<img src="${src}" alt="Opponent ${index}" style="object-fit:cover; border-radius:50%; width:100%; height:100%;">`;
      machine.appendChild(item);
    });

    // Rapid CSS-transition spinning: pick random index every 100ms
    const itemH = 88; // height of each slot item in px
    const total = avatars.length;
    let idx = 0;
    machine.style.transition = 'none';
    machine.style.transform = 'translateY(0px)';

    machine.classList.add('spinning');
    this.slotInterval = setInterval(() => {
      idx = Math.floor(Math.random() * (total - 1));
      machine.style.transition = 'transform 0.08s linear';
      machine.style.transform = `translateY(-${idx * itemH}px)`;
    }, 110);

    // Cycle status messages
    const messages = [
      'Scanning ranked players...',
      'Matching skill levels...',
      'Finding worthy opponent...',
      'Almost there...',
      'Locking in your match...'
    ];
    let msgIdx = 0;
    this.statusInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      const el = document.getElementById('roulette-status-text');
      if (el) el.textContent = messages[msgIdx];
    }, 2200);
  }

  stopSlotMachine(opponentName, opponentRating, opponentAvatarSrc, callback) {
    if (this.slotInterval) {
      clearInterval(this.slotInterval);
      this.slotInterval = null;
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    const finalAvatar = opponentAvatarSrc || this.opponentAvatarSrc || this.getRandomAvatarSrc();
    this.opponentAvatarSrc = finalAvatar;

    const machine = document.getElementById('avatar-slot-machine');
    if (machine) {
      machine.classList.remove('spinning');
      machine.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      const firstChild = machine.firstElementChild;
      if (firstChild) {
        const img = firstChild.querySelector('img');
        if (img) img.src = finalAvatar;
      }
      machine.style.transform = 'translateY(0px)';
      setTimeout(() => {
        machine.innerHTML = `<div class="slot-avatar-item matched"><img src="${finalAvatar}" alt="${opponentName || 'Opponent'}" style="object-fit:cover; border-radius:50%; width:100%; height:100%;"></div>`;
      }, 400);
    }

    const nameEl = document.getElementById('match-opponent-name');
    const ratingEl = document.getElementById('match-opponent-rating');
    if (nameEl) nameEl.textContent = opponentName || 'Opponent';
    if (ratingEl) ratingEl.textContent = opponentRating ? `${opponentRating} Elo` : '1200 Elo';

    const titleEl = document.getElementById('waiting-title');
    const subtitleEl = document.getElementById('waiting-subtitle');
    if (titleEl) titleEl.textContent = 'Match Found!';
    if (subtitleEl) subtitleEl.textContent = 'Preparing your game...';

    const statusEl = document.getElementById('roulette-status-text');
    if (statusEl) statusEl.textContent = 'Match confirmed!';

    const cancelBtn = document.getElementById('btn-cancel-waiting');
    if (cancelBtn) cancelBtn.style.display = 'none';

    setTimeout(() => { if (callback) callback(); }, 1500);
  }

  // --- Online Game -----------------------------------

  async findMatch() {
    if (!this.onlinePlayAvailable()) return;
    if (!(await this.ensureProfileReady())) return;
    await this.ensureServerProfileSynced();
    this.privateRoom = false;
    this.opponentAvatarSrc = null;

    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    
    }

    const timerValue = 10;
    this.timerMinutes = timerValue;

    // Show searching screen immediately for instant feedback
    this.showScreen('screen-waiting');
    this.startSlotMachine();

    try {
      await this.multiplayer.connect();
      const myProfile = {
        username: this.getPreferredDisplayName() || 'Player',
        rating: (this.cloudProfile && Number.isFinite(Number(this.cloudProfile.rating)))
          ? Number(this.cloudProfile.rating)
          : (this.getTotalStats && this.getTotalStats().rating ? this.getTotalStats().rating : 1200),
        avatarId: this.avatarId || 'pfp-01',
        avatarSrc: this.getSelectedAvatarSrc(),
        level: Math.max(1, Number(this.playerLevel) || 1)
      };
      this.multiplayer.findMatch(timerValue, this.matchType, this.matchType === 'tactical' ? (this.selectedAbilities || ['swap', 'freeze']) : [], this.avatarId, myProfile);
    } catch {
      if (this.slotInterval) clearInterval(this.slotInterval);
      if (this.statusInterval) clearInterval(this.statusInterval);
      this.showToast('Failed to connect to server');
      this.showScreen('screen-home');
    }
  }

  async createRoom() {
    if (!this.onlinePlayAvailable()) return;
    if (!(await this.ensureProfileReady())) return;
    await this.ensureServerProfileSynced();
    this.privateRoom = true;
    this.opponentAvatarSrc = null;

    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    }

    try {
      await this.multiplayer.connect();
      const timerValue = 10;
      this.timerMinutes = timerValue;
      const myProfile = {
        username: this.getPreferredDisplayName() || 'Player',
        rating: (this.cloudProfile && Number.isFinite(Number(this.cloudProfile.rating)))
          ? Number(this.cloudProfile.rating)
          : (this.getTotalStats && this.getTotalStats().rating ? this.getTotalStats().rating : 1200),
        avatarId: this.avatarId || 'pfp-01',
        avatarSrc: this.getSelectedAvatarSrc(),
        level: Math.max(1, Number(this.playerLevel) || 1)
      };
      this.multiplayer.createRoom(timerValue, this.matchType, this.matchType === 'tactical' ? (this.selectedAbilities || ['swap', 'freeze']) : [], this.avatarId, myProfile);
    } catch {
      this.showToast('Failed to connect to server');
    }
  }

  async joinRoom() {
    if (!this.onlinePlayAvailable()) return;
    const input = document.getElementById('room-code-input');
    const code = input ? input.value.trim().toUpperCase() : '';

    if (code.length !== 6) {
      this.showToast('Enter a 6-character room code');
      return;
    }

    if (!(await this.ensureProfileReady())) return;
    await this.ensureServerProfileSynced();

    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    }

    try {
      await this.multiplayer.connect();
      this.showToast('Checking room...');
      this.multiplayer.checkRoom(code);
    } catch {
      this.showToast('Failed to connect to server');
    }
  }

  showJoinRoomConfirm(data) {
    const roomCode = data.roomCode;
    const timerMinutes = data.timerMinutes;

    // Populate the styled Room Info modal
    const codeEl = document.getElementById('join-room-code-display');
    const timerEl = document.getElementById('join-room-timer-display');

    if (codeEl) codeEl.textContent = roomCode;
    if (timerEl) timerEl.textContent = timerMinutes ? timerMinutes + ' min' : 'No timer';

    const joinBtn = document.getElementById('btn-confirm-join-room');
    if (joinBtn) joinBtn.onclick = () => this.confirmJoinRoom();

    this.showModal('modal-join-confirm');
  }

  confirmJoinRoom() {
    if (!this.pendingJoinData) return;
    const { roomCode } = this.pendingJoinData;
    this.hideModal('modal-join-confirm');
    this.pendingJoinData = null;
    this.privateRoom = true;
    this.opponentAvatarSrc = null;
    this.multiplayer.joinRoom(roomCode, this.selectedAbilities || ['swap', 'freeze'], this.avatarId);
  }

  cancelJoinRoom() {
    this.hideModal('modal-join-confirm');
    this.pendingJoinData = null;
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    if (this.gameMode === 'online' && this.multiplayer && (this.multiplayer.isConnected || (this.multiplayer.ws && this.multiplayer.ws.readyState === 1))) {
      this.multiplayer.sendChatMessage(text);
    } else {
      this.displayLocalChatMessage(this.playerColor || 'white', 'You', text);
    }
    if (input) input.value = '';
  }

  setupMultiplayerCallbacks() {
    const mp = this.multiplayer;

    mp.onRoomCreated = (code, color) => {
      document.getElementById('display-room-code').textContent = code;
      document.getElementById('waiting-title').textContent = 'Room created — waiting for opponent...';
      document.getElementById('waiting-room-info').style.display = 'block';
      document.getElementById('waiting-room-info').classList.remove('hidden');
      document.getElementById('waiting-spinner-container').classList.remove('hidden');
      
      const animContainer = document.getElementById('matchmaking-animation');
      if (animContainer) animContainer.classList.add('hidden');
      
      const cancelBtn = document.getElementById('btn-cancel-waiting');
      if (cancelBtn) cancelBtn.style.display = 'block';

      this.showScreen('screen-waiting');
    };

    mp.onWaitingForMatch = () => {
      this.showScreen('screen-waiting');
      this.startSlotMachine();
    };

    mp.onCheckRoomResult = (data) => {
      if (!data.success) {
        this.showToast(data.message || 'Room not found');
        return;
      }

      this.pendingJoinData = data;
      // Show join confirmation popup
      this.showJoinRoomConfirm(data);
    };

    mp.onGameStart = (color, opponent, timerMinutes, gameData = {}) => {
      try {
        console.log("onGameStart triggered with", color, opponent, timerMinutes);
        this.gameMode = 'online';
        this.playerColor = color;
        this.boardFlipped = color === 'black';
        this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();
        this.statsRecordedForGame = null;
        this.lastMatchCoinsEarned = 0;
        this.lastMatchDoubled = false;
        this.abilitiesActivatedThisMatch = new Set();
        this.hintCountInMatch = 0;
        this.undoCountInMatch = 0;
        this.hasUndoneCurrentMove = false;
        this.ratingAtGameStart = this.cloudProfile ? this.cloudProfile.rating : this.getTotalStats().rating;
        this.lastServerStats = null;
        this.lastServerStatsGameId = null;
        this.lastServerStatsAt = 0;
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = ''; 

        const resignBtn = document.getElementById('btn-ingame-resign');
        if (resignBtn) resignBtn.classList.remove('hidden');
        const drawBtn = document.getElementById('btn-ingame-draw');
        if (drawBtn) drawBtn.classList.remove('hidden');
        const undoBtn = document.getElementById('btn-ingame-undo');
        if (undoBtn) {
          undoBtn.classList.add('hidden');
          undoBtn.style.display = 'none';
        }
        const hintBtn = document.getElementById('btn-ingame-hint');
        if (hintBtn) {
          hintBtn.classList.add('hidden');
          hintBtn.style.display = 'none';
        }
        const opponentMeta = gameData.opponentProfile || {};
        const oppName = opponentMeta.username || opponent || 'Opponent';
        const oppRating = opponentMeta.rating || 1200;
        const oppAvatarId = opponentMeta.avatarId || gameData.opponentAvatarId;
        const oppAvatarSrc = opponentMeta.avatarSrc || (oppAvatarId ? this.getAvatarById(oppAvatarId)?.src : null) || this.getRandomAvatarSrc();
        this.opponentAvatarSrc = oppAvatarSrc;
        const youName = this.getPreferredDisplayName() || 'Player';

        if (timerMinutes) {
          this.timerMinutes = timerMinutes;
        }
        const serverTimers = gameData.timers;
        if (serverTimers && Number.isFinite(serverTimers.white) && Number.isFinite(serverTimers.black)) {
          this.timers = { white: serverTimers.white, black: serverTimers.black };
        } else if (this.timerMinutes) {
          this.timers = {
            white: this.timerMinutes * 60 * 1000,
            black: this.timerMinutes * 60 * 1000
          };
        } else {
          this.timers = { white: null, black: null };
        }

        this.setupGameUI(
          youName,
          oppName,
          true,
          gameData.selfProfile || null,
          gameData.opponentProfile || null
        );
        
        const startGame = () => {
          try {
            const topAvatar = document.getElementById('top-player-avatar');
            if (topAvatar && this.opponentAvatarSrc) {
               topAvatar.src = this.opponentAvatarSrc;
            }
            this.showScreen('screen-game');
            setTimeout(() => this.startBgMusic(), 500);
            this.renderBoard();
            this.updatePlayerBars();
            this.startTimerTick();
          } catch(err) {
            console.error("startGame inner error:", err);
          }
        };

        const animContainer = document.getElementById('matchmaking-animation');
        if (!this.privateRoom && animContainer && !animContainer.classList.contains('hidden') && typeof this.stopSlotMachine === 'function') {
            this.stopSlotMachine(oppName, oppRating, oppAvatarSrc);
            setTimeout(() => {
                if (typeof this.showMatchmakingFound === 'function') {
                  this.showMatchmakingFound(oppName, oppAvatarSrc);
                }
                setTimeout(startGame, 2500);
            }, 600);
        } else {
            if (animContainer) animContainer.classList.add('hidden');
            startGame();
        }
        
        if (typeof this.initAbilitiesPanel === 'function') {
          this.initAbilitiesPanel();
        }
      } catch (error) {
        console.error("onGameStart wrapper error:", error);
      }
    };

    
      mp.onAbilityUsed = (ability, args, color) => {
        if (color === this.playerColor) this.pendingAbilityCharge = null;
        if (this.engine.validateAbility(ability, args, color)) {
            let abilityName = ability;
            if (ability === 'second') abilityName = 'Second Chance';
            if (ability === 'freeze') abilityName = 'Piece Freeze';
            if (ability === 'swap') abilityName = 'Tactical Swap';
            if (ability === 'shield') abilityName = 'Divine Shield';
            if (ability === 'jump') abilityName = 'Pegasus Jump';
            
            this.showToast((color === this.playerColor ? 'You' : 'Opponent') + ' used ' + abilityName + '!');
            if (ability === 'freeze') {
                this.playSound('freeze');
            }
            
            if (ability === 'second' || ability === 'freeze' || ability === 'swap' || ability === 'jump' || ability === 'shield') {
                if (ability === 'second') this.lastMove = null;
                // Move history is rolled back inside engine
                this.updateMoveHistoryUI();
            this.updatePlayerBars();
            }
            this.hintCountInMatch = 0;
    this.undoCountInMatch = 0; this.hasUndoneCurrentMove = false; this.setupAbilitiesUI(); this.updateUndoButtonUI(); // Re-render ability buttons (to gray them out if used)
            this.renderBoard();
            this.updateCapturedPieces();
            this.updatePlayerBars();
        }
      };
      
      mp.onOpponentMove = (from, to, promotion) => {
      const fromPos = ChessEngine.fromAlgebraic(from);
      const toPos = ChessEngine.fromAlgebraic(to);
      const result = this.engine.makeMove(fromPos.row, fromPos.col, toPos.row, toPos.col, promotion);

      if (result) {
            // User made a move -> reset 1-move undo lock so they can undo this new move if desired
    if (result.piece.color === this.playerColor) {
      this.hasUndoneCurrentMove = false;
      this.updateUndoButtonUI();
    }
    this.animateMoveAndApply(result, () => {
          if (this.engine.gameOver) {
            this.playSound('gameover');
            setTimeout(() => this.showGameOver(), 500);
          }
        });
      }
    };

    mp.onTimerSync = (white, black, moveTimeLeft, activeTurn) => {
      if (Number.isFinite(white) && Number.isFinite(black)) {
        this.timers.white = white;
        this.timers.black = black;
      }
      if (Number.isFinite(moveTimeLeft)) {
        this.moveTimeLeft = moveTimeLeft;
      }
      this.lastMoveTime = Date.now();
      this.updateTimerDisplay();

      // A throttled/background tab can miss ticks. Server sync is authoritative,
      // so always revive the local countdown if it was stopped early.
      const gameScreen = document.getElementById('screen-game');
      const inGame = !!(gameScreen && gameScreen.classList.contains('active'));
      const hasClock = this.timers.white !== null || this.timers.black !== null;
      if (this.gameMode === 'online' && this.engine && !this.engine.gameOver &&
          hasClock && inGame && !this.timerInterval) {
        this.startTimerTick();
      }
    };

    mp.onOpponentDisconnected = (data) => {
      this.showConnectionStatus('disconnected', data && data.forfeitInMs);
      this.showToast('Opponent disconnected');
    };

    mp.onOpponentReconnected = () => {
      this.hideConnectionStatus();
      this.showToast('Opponent reconnected');
    };

    mp.onOpponentResigned = () => {
      // Handled by game_over event directly
    };

    // Handle reconnection with full state recovery
    mp.onGameReconnect = (data) => {
      this.gameMode = 'online';
      this.playerColor = data.color;
      this.boardFlipped = data.color === 'black';
      if (data.abilities && this.multiplayer) {
        this.multiplayer.abilities = data.abilities;
      }
      this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();
      this.lastMatchCoinsEarned = 0;
      this.lastMatchDoubled = false;
      this.abilitiesActivatedThisMatch = new Set();
      this.hintCountInMatch = 0;
      this.undoCountInMatch = 0;
      this.hasUndoneCurrentMove = false;

      // UI setup for players
      document.getElementById('btn-ingame-resign').classList.remove('hidden');
      document.getElementById('btn-ingame-draw').classList.remove('hidden');
      document.getElementById('btn-ingame-undo').classList.add('hidden');
      document.getElementById('btn-ingame-undo').style.display = 'none';
      document.getElementById('btn-ingame-hint').classList.add('hidden');
      document.getElementById('btn-ingame-hint').style.display = 'none';

      // Read timer from server
      if (data.timerMinutes) {
        this.timerMinutes = data.timerMinutes;
      }

      const youName = this.getPreferredDisplayName() || 'Player';
      const oppName = (data.opponentProfile && data.opponentProfile.username) || data.opponent || 'Opponent';

      this.setupGameUI(
        youName,
        oppName,
        true,
        data.selfProfile || null,
        data.opponentProfile || null
      );
      this.showScreen('screen-game');
        setTimeout(() => this.startBgMusic(), 500);
      this.clearMoveHistory();
      this.clearCapturedPieces();

      // Replay all moves to restore board state
      if (data.state && data.state.abilitiesUsed) this.engine.abilitiesUsed = data.state.abilitiesUsed;
      if (data.moves && data.moves.length > 0) {
        for (const move of data.moves) {
          const result = this.applyHistoryEntry(this.engine, move);
          if (result && !move.ability) {
            this.lastMove = { from: result.from, to: result.to };
            this.updateMoveHistory(result);
          }
        }
      }

      // Restore timers from server
      if (data.timers) {
        this.timers.white = data.timers.white;
        this.timers.black = data.timers.black;
      } else {
        this.timers.white = null;
        this.timers.black = null;
      }

      this.renderBoard();
      this.updateCapturedPieces();
      this.updatePlayerBars();
      this.startTimerTick();
      this.showToast('Reconnected!');
    };

    mp.onChatMessage = (sender, senderName, text) => {
      const chatMessages = document.getElementById('chat-messages');
      if (!chatMessages) return;

      const msgDiv = document.createElement('div');
      msgDiv.className = 'chat-message';

      let displaySender = senderName;
      if (sender === this.playerColor) {
        displaySender = 'You';
      }

      const senderSpan = document.createElement('span');
      senderSpan.className = `chat-sender ${sender}`;
      senderSpan.textContent = `${displaySender}: `;
      const textSpan = document.createElement('span');
      textSpan.className = 'chat-text';
      textSpan.textContent = text;
      msgDiv.appendChild(senderSpan);
      msgDiv.appendChild(textSpan);
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Play tweet notification for incoming messages (not own)
      if (sender !== this.playerColor) {
        this.playSound('tweet');
      }

      // Show chat bubble ONLY on opponent's avatar when opponent sends a message
      if (sender && sender !== this.playerColor) {
        const bubble = document.getElementById('top-chat-bubble');
        if (bubble) {
          bubble.textContent = text;
          if (bubble.hideTimeout) clearTimeout(bubble.hideTimeout);
          bubble.classList.remove('show');
          // Force reflow so animation replays
          void bubble.offsetWidth;
          bubble.classList.add('show');
          bubble.hideTimeout = setTimeout(() => {
            bubble.classList.remove('show');
          }, 4500);
        }
      }
    };

        mp.onAfkWarning = (data) => {
      const msgEl = document.getElementById('afk-warning-msg');
      if (msgEl && data && data.message) {
        msgEl.textContent = data.message;
      }
      this.showModal('modal-afk-warning');
      this.playSound('defeat');
    };

    mp.onTurnPassed = (data) => {
      this.selectedSquare = null;
      this.validMoves = [];
      this.isPieceTargeting = false;
      this.targetingAbility = null;

      if (this.engine && this.engine.currentTurn !== data.newTurn) {
        if (typeof this.engine.passTurn === 'function') {
          this.engine.passTurn(data.reason || 'afk_pass');
        } else {
          this.engine.currentTurn = data.newTurn;
        }
      }

      this.moveTimeLeft = 45000;
      if (Number.isFinite(data.white) && Number.isFinite(data.black)) {
        this.timers.white = data.white;
        this.timers.black = data.black;
      }

      this.renderBoard();
      this.updatePlayerBars();

      if (data.passedBy === this.playerColor) {
        this.showToast('You ran out of time! Turn passed to opponent.');
      } else {
        this.showToast('Opponent was inactive for 45s! Turn passed to you.');
        this.playSound('your-turn');
      }
    };

    mp.onGameOver = (reason, winner) => {
      this.hideModal('modal-afk-warning');
      this.hideConnectionStatus();
      if (this.engine) {
        this.engine.gameOver = true;
        this.engine.gameResult = { winner, reason };
      }
      // Force-hide any open modals that might block game over
      this.hideModal('modal-confirm');
      this.hideModal('modal-draw-offer');
      this.playSound('gameover');
      setTimeout(() => this.showGameOver(), 300);
    };

    mp.onStatsUpdate = (stats, gameId) => {
      this.applyServerStats(stats, gameId);
    };

    mp.onDrawOffered = () => {
      // Force-hide any blocking modals first
      this.hideModal('modal-confirm');
      this.showModal('modal-draw-offer');
    };

    mp.onRematchRequested = () => {
      this.showConfirm('Rematch?', 'Your opponent wants a rematch.', () => {
        this.multiplayer.acceptRematch();
      });
    };

    mp.onRematchAccepted = (color) => {
      this.hideModal('modal-confirm');
      this.showScreen('screen-game');
      setTimeout(() => this.startBgMusic(), 500);
      this.playerColor = color;
      this.boardFlipped = color === 'black';
      if (this.multiplayer && this.multiplayer.abilities) {
        const previousAbilities = this.multiplayer.abilities;
        this.multiplayer.abilities = {
          self: Array.isArray(previousAbilities.opponent) ? previousAbilities.opponent : [],
          opponent: Array.isArray(previousAbilities.self) ? previousAbilities.self : []
        };
      }
      this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();
        this.statsRecordedForGame = null;

      if (this.timerMinutes) {
        this.timers.white = this.timerMinutes * 60 * 1000;
        this.timers.black = this.timerMinutes * 60 * 1000;
      }

      this.setupAbilitiesUI();
      this.renderOpponentSkills(this.multiplayer && this.multiplayer.abilities ? this.multiplayer.abilities.opponent : []);
      this.renderBoard();
      this.updatePlayerBars();
      this.clearMoveHistory();
      this.clearCapturedPieces();
      this.startTimerTick();
      this.showToast('Rematch started!');
    };

    mp.onError = (message) => {
      if (this.pendingAbilityCharge) {
        this.restoreSkillCharge(this.pendingAbilityCharge);
        this.pendingAbilityCharge = null;
      }
      this.showToast(message);
    };

    mp.onConnectionChange = (status) => {
      if (status === 'connected') {
        this.hideConnectionStatus();
      } else {
        this.showConnectionStatus(status);
      }
    };
  }

  cancelWaiting() {
    if (this.multiplayer) {
      if (this.multiplayer.roomCode) {
        this.multiplayer.send({ type: 'leave_private_room' });
        this.multiplayer.roomCode = null;
      } else {
        this.multiplayer.cancelMatch();
      }
    }
    if (this.slotInterval) {
      clearInterval(this.slotInterval);
      this.slotInterval = null;
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    this.showScreen('screen-home');
  }



  copyRoomCode() {
    const code = document.getElementById('display-room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.showToast('Code copied!');
    }).catch(() => {
      this.showToast(code);
    });
  }

  // --- Game UI Setup ---------------------------------

    getGameHeaderSelfMeta(fallbackName) {
    let username = this.getPreferredDisplayName();
    if (!username) {
      username = String(fallbackName || '')
        .replace(/\s*\((?:White|Black|Player|You)\)\s*$/i, '')
        .trim();
    }
    if (!username || /^you$/i.test(username)) username = 'Player';
    const stats = typeof this.getTotalStats === 'function' ? this.getTotalStats() : null;
    const rating = Math.max(100, Math.floor(Number(
      (this.cloudProfile && this.cloudProfile.rating) ||
      (stats && stats.rating) ||
      1200
    ) || 1200));
    const level = Math.max(1, Math.floor(Number(this.playerLevel) || 1));
    return { username, rating, level };
  }

  normalizeGameHeaderMeta(meta, fallbackName, fallbackRating, fallbackLevel) {
    const source = meta || {};
    let username = source.username || source.name || fallbackName || 'Player';
    username = String(username)
      .replace(/\s*\((?:White|Black|Player|You)\)\s*$/i, '')
      .trim() || 'Player';
    const rawRating = source.rating != null
      ? source.rating
      : (source.elo != null ? source.elo : fallbackRating);
    const rating = Math.max(100, Math.floor(Number(rawRating) || Number(fallbackRating) || 1200));
    const rawLevel = source.level != null
      ? source.level
      : (source.playerLevel != null ? source.playerLevel : fallbackLevel);
    const level = Math.max(1, Math.floor(Number(rawLevel) || Number(fallbackLevel) || 1));
    const avatarId = this.normalizeAvatarId(source.avatarId);
    return { username, rating, level, avatarId };
  }

  getAvatarSrcById(avatarId) {
    const normalized = this.normalizeAvatarId(avatarId);
    const avatar = normalized ? this.getAvatarById(normalized) : null;
    return avatar ? avatar.src : null;
  }

  syncOpponentAvatarFromMeta(meta) {
    // The server sends the opponent's equipped avatarId with the game state.
    // Prefer it over the roulette/random fallback so every device sees the
    // same portrait for the same player.
    const equippedAvatarSrc = meta ? this.getAvatarSrcById(meta.avatarId) : null;
    if (equippedAvatarSrc) {
      this.opponentAvatarSrc = equippedAvatarSrc;
    } else if (!this.opponentAvatarSrc) {
      this.opponentAvatarSrc = this.getRandomAvatarSrc();
    }

    const topAvatar = document.getElementById('top-player-avatar');
    if (topAvatar && this.opponentAvatarSrc) topAvatar.src = this.opponentAvatarSrc;
    return this.opponentAvatarSrc;
  }

  renderGameHeader(selfMeta, opponentMeta) {
    const apply = (prefix, meta) => {
      const nameEl = document.getElementById(`${prefix}-player-name`);
      const ratingEl = document.getElementById(`${prefix}-player-rating`);
      const titleEl = document.getElementById(`${prefix}-player-title`);
      const levelEl = document.getElementById(`${prefix}-player-level-badge`);

      if (nameEl) {
        nameEl.textContent = meta.username;
        nameEl.title = meta.username;
      }
      if (ratingEl) ratingEl.textContent = `${meta.rating} Elo`;
      if (titleEl) {
        titleEl.innerHTML = this.getEloTitleBadgeHtml(meta.rating);
        titleEl.style.display = titleEl.innerHTML ? 'inline-flex' : 'none';
      }
      if (levelEl) {
        levelEl.textContent = `Lv ${meta.level}`;
        levelEl.title = `Player Level ${meta.level}`;
      }
    };

    apply('bottom', selfMeta);
    apply('top', opponentMeta);
  }

  renderOpponentSkills(abilities = []) {
    const container = document.getElementById('top-player-skills');
    if (!container) return;

    const skillIcons = {
      swap: { src: '/assets/Asset 42.png', label: 'Tactical Swap' },
      freeze: { src: '/assets/Asset 43.png', label: 'Piece Freeze' },
      second: { src: '/assets/Asset 44.png', label: 'Second Chance' },
      shield: { src: '/assets/Asset 45.png', label: 'Divine Shield' },
      jump: { src: '/assets/Asset 46.png', label: 'Pegasus Jump' }
    };

    const equipped = (Array.isArray(abilities) ? abilities : [])
      .map(id => id === 'undo' ? 'second' : id)
      .filter((id, index, all) => skillIcons[id] && all.indexOf(id) === index)
      .slice(0, 2);

    container.innerHTML = equipped.map(id => {
      const skill = skillIcons[id];
      return `<span class="ingame-opponent-skill" title="Equipped: ${skill.label}" aria-label="Equipped: ${skill.label}"><img src="${skill.src}" alt=""></span>`;
    }).join('');
    container.classList.toggle('is-empty', equipped.length === 0);
    container.setAttribute(
      'aria-label',
      equipped.length
        ? `Opponent equipped skills: ${equipped.map(id => skillIcons[id].label).join(', ')}`
        : 'Opponent has no equipped skills'
    );
  }

    setupGameUI(playerName, opponentName, isOnline, playerMeta = null, opponentMeta = null) {
    const localSelf = this.getGameHeaderSelfMeta(playerName);
    const selfMeta = this.normalizeGameHeaderMeta(
      playerMeta,
      localSelf.username,
      localSelf.rating,
      localSelf.level
    );

    let opponentFallbackRating = 1200;
    let opponentFallbackLevel = 1;
    if (this.gameMode === 'ai') {
      const difficulty = (this.ai && this.ai.difficulty) || 'medium';
      opponentFallbackRating = { easy: 800, medium: 1200, hard: 1600 }[difficulty] || 1200;
      opponentFallbackLevel = { easy: 1, medium: 4, hard: 8 }[difficulty] || 4;
    }
    const normalizedOpponent = this.normalizeGameHeaderMeta(
      opponentMeta,
      opponentName,
      opponentFallbackRating,
      opponentFallbackLevel
    );

    this.renderGameHeader(selfMeta, normalizedOpponent);
    const opponentAbilities = (this.gameMode === 'online' && this.multiplayer && this.multiplayer.abilities)
      ? this.multiplayer.abilities.opponent
      : [];
    this.renderOpponentSkills(opponentAbilities);
    this.applyAvatarToUI();
    this.syncOpponentAvatarFromMeta(normalizedOpponent);

    // Show/hide online-only controls
    document.getElementById('btn-ingame-draw').style.display = isOnline ? '' : 'none';
    document.getElementById('btn-ingame-resign').style.display = isOnline ? '' : 'none';

    this.clearMoveHistory();
    this.clearCapturedPieces();
    this.setupMoveTickerScroll();
    
    this.undoCountInMatch = 0; this.hasUndoneCurrentMove = false; this.setupAbilitiesUI(); this.updateUndoButtonUI();
  }

  setupAbilitiesUI() {
    const ab1Btn = document.getElementById('btn-ability-1');
    const ab2Btn = document.getElementById('btn-ability-2');
    const undoBtn = document.getElementById('btn-ingame-undo');
    const hintBtn = document.getElementById('btn-ingame-hint');
    const drawBtn = document.getElementById('btn-ingame-draw');
    const resignBtn = document.getElementById('btn-ingame-resign');

    if (this.gameMode === 'online') {
      const abs = (this.multiplayer && this.multiplayer.abilities && this.multiplayer.abilities.self && this.multiplayer.abilities.self.length > 0)
          ? this.multiplayer.abilities.self
          : (this.selectedAbilities && this.selectedAbilities.length ? this.selectedAbilities : ['second']);

      if (abs && abs.length > 0) {
        if (abs[0] && ab1Btn) {
          this.configureAbilityButton(ab1Btn, abs[0]);
          ab1Btn.style.display = '';
          ab1Btn.classList.remove('hidden');
        }
        if (abs[1] && ab2Btn) {
          this.configureAbilityButton(ab2Btn, abs[1]);
          ab2Btn.style.display = '';
          ab2Btn.classList.remove('hidden');
        } else if (ab2Btn) {
          ab2Btn.style.display = 'none';
          ab2Btn.classList.add('hidden');
        }
      }
      // In online PvP: Show Draw, Hide Undo/Hint. Hints and undos are strictly
      // disabled in competitive play because they are paid advantages.
      if (undoBtn) {
        undoBtn.style.display = 'none';
        undoBtn.classList.add('hidden');
      }
      if (hintBtn) {
        hintBtn.style.display = 'none';
        hintBtn.classList.add('hidden');
      }
      if (drawBtn) {
        drawBtn.style.display = '';
        drawBtn.classList.remove('hidden');
      }
    } else {
      // AI / Practice Mode: standard chess with hints and undos only.
      // Tactical abilities are exclusive to online PvP.
      if (ab1Btn) {
        ab1Btn.style.display = 'none';
        ab1Btn.classList.add('hidden');
      }
      if (ab2Btn) {
        ab2Btn.style.display = 'none';
        ab2Btn.classList.add('hidden');
      }
      if (drawBtn) {
        drawBtn.style.display = 'none';
        drawBtn.classList.add('hidden');
      }
      if (undoBtn) {
        undoBtn.style.display = '';
        undoBtn.classList.remove('hidden');
        undoBtn.onclick = () => this.undoMove();
      }
      if (hintBtn) {
        hintBtn.style.display = '';
        hintBtn.classList.remove('hidden');
        hintBtn.onclick = () => this.getHint();
        this.updateHintButtonUI();
      }
    }

    if (resignBtn) {
      resignBtn.style.display = '';
      resignBtn.classList.remove('hidden');
    }
  }

  configureAbilityButton(btn, abilityId) {
    btn.style.display = '';
    btn.onclick = () => this.activateAbility(abilityId);
    
    if (abilityId === 'swap') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 42.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Swap';
    } else if (abilityId === 'freeze') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 43.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Freeze';
    } else if (abilityId === 'second') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 44.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = '2nd Chance';
    } else if (abilityId === 'shield') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 45.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Shield';
    } else if (abilityId === 'jump') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 46.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Jump';
    }
    
    const id = abilityId === 'undo' ? 'second' : abilityId;
    const charges = this.getSkillCharges(id);
    const label = btn.querySelector('.btn-label');
    if (label) {
      const base = label.textContent.replace(/\s*\(\d+\)$/, '');
      label.textContent = `${base} (${charges})`;
    }

    // Check if ability was used (or has no charges left)
    const used = this.isAbilityUsedThisMatch(id);
    if (used || charges <= 0) {
      btn.classList.add('disabled');
      btn.style.opacity = '0.5';
      btn.onclick = null;
    } else {
      btn.classList.remove('disabled');
      btn.style.opacity = '1';
      btn.onclick = () => this.activateAbility(id);
    }
  }

  activateAbility(abilityId) {
      if (this.gameMode === 'ai') {
        this.showToast('Tactical abilities are only available in online PvP.');
        return;
      }

      if (this.engine.gameOver || (this.engine.currentTurn !== this.playerColor && abilityId !== 'second')) {
        this.showToast('Not your turn!');
        return;
      }

      if (this.activeAbility === abilityId) {
        this.activeAbility = null;
        this.swapSelection = [];
        this.jumpPiece = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.showToast('Ability canceled');
        this.renderBoard();
        return;
      }
      
      this.selectedSquare = null;
      this.legalMoves = [];
      this.renderBoard();

    if (!this.canUseAbility(abilityId)) return;

    if (abilityId === 'second') {
      if (this.gameMode === 'online') {
        const lastMove = this.engine.moveHistory[this.engine.moveHistory.length - 1];
        const lastMoveColor = lastMove ? (lastMove.color || (lastMove.piece && lastMove.piece.color)) : null;
        if (lastMoveColor !== this.playerColor) {
          this.showToast('Can only undo immediately after your own move!');
          return;
        }
        this.pendingAbilityCharge = 'second';
        this.markAbilityUsed('second');
        this.multiplayer.send({ type: 'use_ability', ability: 'second' });
        this.showToast('Second Chance used!');
        this.undoCountInMatch = 0; this.hasUndoneCurrentMove = false; this.setupAbilitiesUI(); this.updateUndoButtonUI();
      } else {
        const ok = this.engine.validateAbility('second', null, this.playerColor);
        if (ok) {
          this.markAbilityUsed('second');
          this.showToast('Second Chance used!');
          this.undoCountInMatch = 0; this.hasUndoneCurrentMove = false; this.setupAbilitiesUI(); this.updateUndoButtonUI();
          this.renderBoard();
          this.updateMoveHistoryUI();
          this.updateCapturedPieces();
          this.updatePlayerBars();
        } else {
          this.showToast('Cannot undo');
        }
      }
    } else if (abilityId === 'freeze' || abilityId === 'swap' || abilityId === 'shield' || abilityId === 'jump') {
      this.activeAbility = abilityId;
      if (abilityId === 'swap') this.swapSelection = [];
      if (abilityId === 'jump') this.jumpPiece = null;
      const msg = abilityId === 'swap' ? 'Select 2 pieces to Swap' :
                  abilityId === 'freeze' ? 'Select opponent piece to Freeze' :
                  abilityId === 'shield' ? 'Select piece for Divine Shield' :
                  'Select piece to Pegasus Jump over hurdle';
      this.showToast(msg);
      this.renderBoard();
    }
  }

  // --- Board Rendering ------------------------------

  renderBoard() {
      const boardEl = document.getElementById('chess-board') || document.getElementById('board');
      if (!boardEl) return;
      boardEl.innerHTML = '';
      if (!this.engine) return;
      
      // If it's online and not our turn, clear selection so pieces don't get stuck hovering
      if ((this.gameMode === 'online' || this.gameMode === 'ai') && this.engine.currentTurn !== this.playerColor) {
        this.selectedSquare = null;
        this.legalMoves = [];
      }

    const files = 'abcdefgh';
    let kingInCheck = false;

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const row = this.boardFlipped ? 7 - displayRow : displayRow;
        const col = this.boardFlipped ? 7 - displayCol : displayCol;

        const square = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        let squareClass = `square ${isLight ? 'light' : 'dark'}`;
        const squareIndex = displayRow * 8 + displayCol;
        if (((squareIndex * 13 + 5) % 17) < 4) {
          squareClass += ' tone-b';
        }
        square.className = squareClass;
        square.dataset.row = row;
        square.dataset.col = col;

        // Coordinate labels
        if (displayCol === 0) {
          const rank = document.createElement('span');
          rank.className = 'coord coord-rank coord-label';
          rank.textContent = 8 - row;
          square.appendChild(rank);
        }
        if (displayRow === 7) {
          const file = document.createElement('span');
          file.className = 'coord coord-file coord-label';
          file.textContent = files[col];
          square.appendChild(file);
        }

        // Last move highlight
        if (this.lastMove) {
          if ((row === this.lastMove.from.row && col === this.lastMove.from.col) ||
            (row === this.lastMove.to.row && col === this.lastMove.to.col)) {
            square.classList.add('last-move');
          }
        }

        // Selected square
        if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
          square.classList.add('selected', 'is-selected');
        }

        // Legal move indicators
        const legalMove = this.legalMoves.find(m => m.row === row && m.col === col);
        if (legalMove) {
          const targetPiece = this.engine.getPiece(row, col);
          if (targetPiece || legalMove.enPassant) {
            square.classList.add('legal-capture', 'capture-target');
          } else {
            square.classList.add('legal-move', 'move-target');
          }
        }

        // Check highlight
        if (this.engine) {
          const piece = this.engine.getPiece(row, col);
          if (piece && piece.type === 'king' && piece.color === this.engine.currentTurn) {
            if (this.engine.isKingInCheck(this.engine.currentTurn)) {
              square.classList.add('check', 'is-check');
              kingInCheck = true;
            }
          }
        }

        // Piece
        const piece = this.engine.getPiece(row, col);

        // Ability highlights
        if (this.engine.isPieceFrozen(row, col)) {
           square.classList.add('frozen');
        }
        if (this.engine.isPieceShielded && this.engine.isPieceShielded(row, col)) {
           square.classList.add('shielded-square');
        }
        if (this.swapSelection && this.swapSelection.some(s => s.row === row && s.col === col)) {
           square.classList.add('swap-selected');
        }
        if (this.activeAbility === 'jump' && this.jumpPiece) {
           if (this.jumpPiece.fromRow === row && this.jumpPiece.fromCol === col) {
              square.classList.add('selected', 'is-selected');
           }
           if (this.jumpPiece.validTargets && this.jumpPiece.validTargets.some(t => t.row === row && t.col === col)) {
              square.classList.add('legal-move', 'move-target');
           }
        }

        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece ${piece.color}-piece`;
          if (typeof PieceSVGs !== 'undefined' && PieceSVGs.getPiece) {
            pieceEl.innerHTML = PieceSVGs.getPiece(piece.color, piece.type);
          } else {
            pieceEl.textContent = this.pieceSymbols[piece.color][piece.type];
          }
          square.appendChild(pieceEl);
        }

        // Click handler
        square.addEventListener('click', () => this.handleSquareClick(row, col));

        boardEl.appendChild(square);
      }
    }

    this.updateCheckAlert(kingInCheck);
  }

  // --- King check alert (board glow + king shake + sound) ---

  updateCheckAlert(inCheck) {
    const boardEl = document.getElementById('chess-board') || document.getElementById('board');

    if (!inCheck) {
      if (!this._checkAlertOn) return;
      this._checkAlertOn = false;
      if (this._checkAlertDelay) {
        clearTimeout(this._checkAlertDelay);
        this._checkAlertDelay = null;
      }
      if (boardEl) boardEl.classList.remove('check-alert');
      this.stopCheckTears();
      // King moved out of check -> cut the cue away immediately.
      this.stopCheckSound(CHECK_FADE_OUT);
      return;
    }

    if (this._checkAlertOn) return;
    this._checkAlertOn = true;

    // Let the moved piece finish landing before the alert fires.
    if (this._checkAlertDelay) clearTimeout(this._checkAlertDelay);
    this._checkAlertDelay = setTimeout(() => {
      this._checkAlertDelay = null;
      this.playSound('check'); // starts the looping check cue
      this.flashCheckAlert();
      this.startCheckTears();
    }, 150);
  }

  stopCheckAlert() {
    if (this._checkAlertDelay) {
      clearTimeout(this._checkAlertDelay);
      this._checkAlertDelay = null;
    }
    this._checkAlertOn = false;
    const boardEl = document.getElementById('chess-board') || document.getElementById('board');
    if (boardEl) boardEl.classList.remove('check-alert');
    const ring = document.querySelector('.board-wrap .check-ring');
    if (ring) ring.remove();
    this.stopCheckTears();
    this.stopCheckSound(0.3);
  }

  flashCheckAlert() {
    const boardEl = document.getElementById('chess-board') || document.getElementById('board');
    if (!boardEl) return;

    // King piece shake only — no red square glow, no check-ring
    boardEl.classList.remove('check-alert');
    void boardEl.offsetWidth;
    boardEl.classList.add('check-alert');

    // Clean up any lingering ring
    const boardWrap = document.querySelector('.board-wrap');
    if (boardWrap) {
      const oldRing = boardWrap.querySelector('.check-ring');
      if (oldRing) oldRing.remove();
    }
  }

  startCheckTears() {
    this.stopCheckTears();
    // Spawn 4 droplets immediately so 4-5 are visible right away
    for (let i = 0; i < 4; i++) {
      this.spawnCheckTear();
    }
    const loop = () => {
      this.spawnCheckTear();
      // Spawning every 160-210ms with 800-1000ms duration keeps 4-5 active droplets concurrently
      const delay = 160 + Math.random() * 50;
      this._tearTimer = setTimeout(loop, delay);
    };
    this._tearTimer = setTimeout(loop, 180);
  }

  stopCheckTears() {
    if (this._tearTimer) {
      clearTimeout(this._tearTimer);
      this._tearTimer = null;
    }
    document.querySelectorAll('.board-wrap .check-tear').forEach(el => {
      try {
        if (el.getAnimations) {
          el.getAnimations().forEach(a => a.cancel());
        }
      } catch (e) {}
      el.remove();
    });
  }

  spawnCheckTear() {
    const boardWrap = document.querySelector('.board-wrap');
    const kingSq = document.querySelector('.square.is-check') || document.querySelector('.square.check');
    if (!boardWrap || !kingSq) return;
    if (boardWrap.querySelectorAll('.check-tear').length > 24) return;

    const wrapRect = boardWrap.getBoundingClientRect();
    const sqRect = kingSq.getBoundingClientRect();
    const kh = sqRect.height;
    if (sqRect.width < 4 || kh < 4) return;

    const rnd = (a, b) => a + Math.random() * (b - a);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cx = sqRect.left - wrapRect.left + sqRect.width / 2;
    const cy = sqRect.top - wrapRect.top + kh / 2;

    // Random point around the checked king's silhouette
    const th = rnd(0, Math.PI * 2);
    const ox = cx + Math.cos(th) * sqRect.width * 0.44;
    const oy = cy + Math.sin(th) * kh * 0.46;

    const a = th * 180 / Math.PI + rnd(-35, 35);
    const dist = rnd(0.75, 1.45); // shoots visibly outward from king
    const sz = rnd(0.70, 0.82);   // consistent visible base size — no tiny specs

    const s = sz * kh * 0.55;
    const rad = a * Math.PI / 180;
    const dx = Math.cos(rad) * dist * kh;
    const dy = Math.sin(rad) * dist * kh;
    const rot = Math.atan2(-Math.cos(rad), Math.sin(rad)) * 180 / Math.PI; // tip trails toward the king

    const drop = document.createElement('div');
    drop.className = 'check-tear d';
    drop.style.width = `${s.toFixed(1)}px`;
    drop.style.height = `${(s * 1.2).toFixed(1)}px`;
    drop.style.marginLeft = `${(-s / 2).toFixed(1)}px`;
    drop.style.marginTop = `${(-s * 0.6).toFixed(1)}px`;
    drop.innerHTML = CHECK_DROPLET_SVG;
    boardWrap.appendChild(drop);

    const T = (f, sc) =>
      `translate(${(ox + dx * f).toFixed(1)}px, ${(oy + dy * f).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sc})`;

    // All droplets emerge small (0.05), grow big (1.15), and shrink back to small (0.05) & disappear fast
    if (drop.animate) {
      const an = drop.animate([
        { transform: T(0, 0.05), opacity: 0.9, offset: 0 },
        { transform: T(0.45, 1.15), opacity: 1, offset: 0.45, easing: 'ease-out' },
        { transform: T(1, 0.05), opacity: 0, offset: 1, easing: 'ease-in' }
      ], {
        duration: reduce ? 1200 : rnd(800, 1000), // 800ms - 1000ms duration per user request
        easing: 'cubic-bezier(.25,.6,.3,1)',
        fill: 'both'
      });
      an.onfinish = () => drop.remove();
    } else {
      setTimeout(() => drop.remove(), 1200);
    }
  }

  // --- Square Click Handling -------------------------

    
  getValidJumpTargets(row, col) {
    if (!this.engine) return [];
    const piece = this.engine.getPiece(row, col);
    if (!piece || piece.color !== this.playerColor) return [];
    if (this.engine.isPieceFrozen(row, col)) return [];

    const dir = this.playerColor === 'white' ? -1 : 1;
    const targetRow = row + 2 * dir;
    if (targetRow < 0 || targetRow > 7) return [];

    let allowedDCols = [0];
    if (piece.type === 'bishop') {
      allowedDCols = [-2, 2];
    } else if (piece.type === 'queen') {
      allowedDCols = [0, -2, 2];
    }

    const targets = [];
    for (const dCol of allowedDCols) {
      const targetCol = col + dCol;
      const hurdleRow = row + dir;
      const hurdleCol = col + dCol / 2;

      if (!this.engine.isInBounds(targetRow, targetCol)) continue;
      if (!this.engine.getPiece(hurdleRow, hurdleCol)) continue; // Must have hurdle obstacle
      if (this.engine.getPiece(targetRow, targetCol)) continue; // Landing square must be empty
      if (piece.type === 'king' && this.engine.isSquareAttacked(targetRow, targetCol, this.playerColor)) continue;

      targets.push({ row: targetRow, col: targetCol, hurdleRow, hurdleCol });
    }
    return targets;
  }

  handleSquareClick(row, col) {
    if (this.isAnimatingMove) return;
    if (this.engine.gameOver) return;

    const clickedPiece = this.engine ? this.engine.getPiece(row, col) : null;
    if (clickedPiece && clickedPiece.type === 'king' && this.engine.isKingInCheck(clickedPiece.color)) {
      for (let i = 0; i < 5; i++) this.spawnCheckTear();
    }

    if (this.activeAbility) {
        if (this.activeAbility === 'shield') {
            const piece = this.engine.getPiece(row, col);
            if (!piece || piece.color !== this.playerColor) {
                this.showToast('Must select your own piece');
                return;
            }
            if (this.gameMode === 'online') {
                this.pendingAbilityCharge = 'shield';
                  this.markAbilityUsed('shield');
                  this.multiplayer.send({ type: 'use_ability', ability: 'shield', args: { row, col } });
                this.showToast('🛡️ Divine Shield sent!');
            } else {
                const ok = this.engine.validateAbility('shield', { row, col }, this.playerColor);
                if (ok) {
                    this.markAbilityUsed('shield');
                    this.showToast('🛡️ Divine Shield active on ' + piece.type + '!');
                    this.undoCountInMatch = 0; this.hasUndoneCurrentMove = false; this.setupAbilitiesUI(); this.updateUndoButtonUI();
                } else {
                    this.showToast('Cannot shield that piece');
                }
            }
            this.activeAbility = null;
            this.renderBoard();
            return;
        }

        if (this.activeAbility === 'jump') {
            if (!this.jumpPiece) {
                const piece = this.engine.getPiece(row, col);
                if (!piece || piece.color !== this.playerColor) {
                    this.showToast('Select your piece to jump');
                    return;
                }
                if (this.engine.isPieceFrozen(row, col)) {
                    this.showToast('This piece is frozen!');
                    return;
                }
                const targets = this.getValidJumpTargets(row, col);
                if (targets.length === 0) {
                    this.showToast('No obstacle in front for ' + piece.type + ' to jump!');
                    return;
                }
                this.jumpPiece = { fromRow: row, fromCol: col, validTargets: targets };
                this.showToast('Tap highlighted square to land');
                this.renderBoard();
                return;
            } else {
                const target = this.jumpPiece.validTargets && this.jumpPiece.validTargets.find(t => t.row === row && t.col === col);
                if (target) {
                    const jumpArgs = { fromRow: this.jumpPiece.fromRow, fromCol: this.jumpPiece.fromCol, toRow: row, toCol: col };
                    if (this.gameMode === 'online') {
                        this.pendingAbilityCharge = 'jump';
                          this.markAbilityUsed('jump');
                          this.multiplayer.send({ type: 'use_ability', ability: 'jump', args: jumpArgs });
                        this.showToast('🪽 Pegasus Jump sent!');
                    } else {
                        const ok = this.engine.validateAbility('jump', jumpArgs, this.playerColor);
                        if (ok) {
                            this.markAbilityUsed('jump');
                            this.showToast('🪽 Pegasus Jump executed!');
                            this.undoCountInMatch = 0; this.hasUndoneCurrentMove = false; this.setupAbilitiesUI(); this.updateUndoButtonUI();
                            if (this.gameMode === 'ai' && this.engine.currentTurn !== this.playerColor) {
                                setTimeout(() => this.makeAIMove(), 500);
                            }
                        } else {
                            this.showToast('Cannot jump to that square');
                        }
                    }
                    this.activeAbility = null;
                    this.jumpPiece = null;
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.renderBoard();
                    return;
                } else {
                    // Check if player tapped another of their own pieces to switch jump piece
                    const clickedPiece = this.engine.getPiece(row, col);
                    if (clickedPiece && clickedPiece.color === this.playerColor) {
                        const newTargets = this.getValidJumpTargets(row, col);
                        if (newTargets.length > 0) {
                            this.jumpPiece = { fromRow: row, fromCol: col, validTargets: newTargets };
                            this.showToast('Tap highlighted square to land');
                            this.renderBoard();
                            return;
                        }
                    }
                    this.jumpPiece = null;
                    this.activeAbility = null;
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.showToast('Jump canceled');
                    this.renderBoard();
                    return;
                }
            }
        }

        if (this.activeAbility === 'freeze') {
            const piece = this.engine.getPiece(row, col);
            if (!piece || piece.color === this.playerColor) {
                this.showToast('Must select an opponent piece');
                return;
            }
            if (piece.type === 'king') {
                this.showToast('Cannot freeze a King');
                return;
            }
            if (this.gameMode === 'online') {
                this.pendingAbilityCharge = 'freeze';
                  this.markAbilityUsed('freeze');
                  this.multiplayer.send({ type: 'use_ability', ability: 'freeze', args: { row, col } });
                this.showToast('❄️ Freeze sent!');
            } else {
                const ok = this.engine.validateAbility('freeze', { row, col }, this.playerColor);
                if (ok) {
                    this.markAbilityUsed('freeze');
                    this.showToast('❄️ Piece Frozen for its next full turn!');
                } else {
                    this.showToast('Cannot freeze that piece');
                }
            }
            this.activeAbility = null;
            this.renderBoard(); // Clear selection UI
            return;
        }
        if (this.activeAbility === 'swap') {
            const piece = this.engine.getPiece(row, col);
            if (!piece || piece.color !== this.playerColor) {
                this.showToast('Must select your own piece');
                return;
            }
            if (this.engine.isPieceFrozen(row, col)) {
                this.showToast('Frozen pieces cannot be swapped');
                return;
            }
            if (piece.type === 'king') {
                this.showToast('Cannot swap a King');
                return;
            }
            
            if (!this.swapSelection) this.swapSelection = [];
            
            // Check if clicking same piece
            if (this.swapSelection.length === 1 && this.swapSelection[0].row === row && this.swapSelection[0].col === col) {
                this.swapSelection = []; // Deselect
                this.renderBoard();
                return;
            }
            
            this.swapSelection.push({ row, col });
            
            if (this.swapSelection.length === 2) {
                const row1 = this.swapSelection[0].row;
                const col1 = this.swapSelection[0].col;
                const row2 = this.swapSelection[1].row;
                const col2 = this.swapSelection[1].col;
                
                const p1 = this.engine.board[row1][col1];
                const p2 = this.engine.board[row2][col2];
                
                const p1WillPromote = p1 && p1.type === 'pawn' && ((p1.color === 'white' && row2 === 0) || (p1.color === 'black' && row2 === 7));
                const p2WillPromote = p2 && p2.type === 'pawn' && ((p2.color === 'white' && row1 === 0) || (p2.color === 'black' && row1 === 7));
                
                if (p1WillPromote || p2WillPromote) {
                    this.pendingSwapPromotion = { row1, col1, row2, col2 };
                    this.showPromotionModal();
                    this.activeAbility = null;
                    this.swapSelection = [];
                    this.renderBoard();
                    return;
                }
                
                const swapArgs = { row1, col1, row2, col2 };
                if (this.gameMode === 'online') {
                    this.pendingAbilityCharge = 'swap';
                      this.markAbilityUsed('swap');
                      this.multiplayer.send({
                          type: 'use_ability',
                          ability: 'swap',
                        args: swapArgs
                    });
                    this.showToast('🔄 Tactical Swap sent!');
                } else {
                    const ok = this.engine.validateAbility('swap', swapArgs, this.playerColor);
                    if (ok) {
                        this.markAbilityUsed('swap');
                        this.showToast('🔄 Tactical Swap executed!');
                        if (this.gameMode === 'ai' && this.engine.currentTurn !== this.playerColor) {
                            setTimeout(() => this.makeAIMove(), 500);
                        }
                    } else {
                        this.showToast('Cannot swap those pieces');
                    }
                }
                this.activeAbility = null;
                this.swapSelection = [];
            }
            this.renderBoard();
            return;
        }
    }

    // In online mode, only allow moves on your turn
    if (this.gameMode === 'online' && this.engine.currentTurn !== this.playerColor) return;

    // In AI mode, can only move on your turn
    if (this.gameMode === 'ai' && this.engine.currentTurn !== this.playerColor) return;

    const piece = this.engine.getPiece(row, col);

    // If clicking on own frozen piece, show toast and return
    if (piece && piece.color === this.engine.currentTurn) {
        if (this.engine.isPieceFrozen(row, col)) {
            this.showToast('This piece is frozen!');
            return;
        }
    }

    // If a square is already selected
    if (this.selectedSquare) {
      // Check if clicking on the same square (deselect)
      if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
        this.deselectSquare();
        return;
      }

      // Check if clicking on own piece (reselect)
      if (piece && piece.color === this.engine.currentTurn) {
        this.selectSquare(row, col);
        return;
      }

      // Try to move
      const isLegal = this.legalMoves.some(m => m.row === row && m.col === col);
      if (isLegal) {
        this.attemptMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
      } else {
        this.deselectSquare();
      }
      return;
    }

    // Select a piece
    if (piece && piece.color === this.engine.currentTurn) {
      this.selectSquare(row, col);
    }
  }

  selectSquare(row, col) {
    this.selectedSquare = { row, col };
    // Get unique legal target squares (deduplicate promotions)
    const allMoves = this.engine.getLegalMoves(row, col);
    const seen = new Set();
    this.legalMoves = allMoves.filter(m => {
      const key = `${m.row},${m.col}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.renderBoard();
  }

  deselectSquare() {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.renderBoard();
  }

  attemptMove(fromRow, fromCol, toRow, toCol) {
    // Check if promotion is needed
    if (this.engine.needsPromotion(fromRow, fromCol, toRow)) {
      this.pendingPromotion = { fromRow, fromCol, toRow, toCol };
      this.showPromotionModal();
      return;
    }

    this.executeMove(fromRow, fromCol, toRow, toCol, null);
  }

  // --- Combat Kill FX & Piece Move Animation ----------

  createCombatKillEffect(toSq) {
    if (!toSq) return;
    const boardEl = document.getElementById('chess-board');
    if (!boardEl) return;

    // Lightweight combat kill overlay on the target square only (zero board-wide reflow)
    const overlay = document.createElement('div');
    overlay.className = 'kill-combat-overlay';
    overlay.style.left = toSq.offsetLeft + 'px';
    overlay.style.top = toSq.offsetTop + 'px';
    overlay.style.width = toSq.offsetWidth + 'px';
    overlay.style.height = toSq.offsetHeight + 'px';

    const flash = document.createElement('div');
    flash.className = 'kill-flash-circle';
    overlay.appendChild(flash);

    const slash = document.createElement('div');
    slash.className = 'kill-slash-line';
    overlay.appendChild(slash);

    // Burst dot particles — 8 dots exploding outward
    const dotColors = ['#ffdd00','#ff8800','#ffffff','#ff4444','#ffaa00','#ffee44','#ff6600','#ffcc00'];
    const dotCount = 8;
    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'capture-burst-dot';
      const angle = (i / dotCount) * 2 * Math.PI;
      const dist = 26 + Math.random() * 14;
      dot.style.setProperty('--bx', Math.round(Math.cos(angle) * dist) + 'px');
      dot.style.setProperty('--by', Math.round(Math.sin(angle) * dist) + 'px');
      dot.style.background = dotColors[i % dotColors.length];
      dot.style.animationDelay = (Math.random() * 0.04).toFixed(3) + 's';
      overlay.appendChild(dot);
    }

    boardEl.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 380);
  }

  animateMoveAndApply(result, onDone) {
    if (!result) {
      if (onDone) onDone();
      return;
    }

    const fromSq = document.querySelector(`.square[data-row="${result.from.row}"][data-col="${result.from.col}"]`);
    const toSq = document.querySelector(`.square[data-row="${result.to.row}"][data-col="${result.to.col}"]`);
    const movingPieceEl = fromSq ? fromSq.querySelector('.piece') : null;

    // Identify victim piece
    let victimPieceEl = null;
    let victimSq = toSq;
    if (result.captured) {
      if (result.enPassant) {
        const epRow = result.piece.color === 'white' ? result.to.row + 1 : result.to.row - 1;
        const epSq = document.querySelector(`.square[data-row="${epRow}"][data-col="${result.to.col}"]`);
        if (epSq) {
          victimSq = epSq;
          victimPieceEl = epSq.querySelector('.piece');
        }
      } else if (toSq) {
        victimPieceEl = toSq.querySelector('.piece');
      }
    }

    this.isAnimatingMove = true;
    // Safety watchdog: ensure isAnimatingMove NEVER remains stuck even if DOM transition fails
    if (this._animWatchdog) clearTimeout(this._animWatchdog);
    this._animWatchdog = setTimeout(() => {
      if (this.isAnimatingMove) {
        this.isAnimatingMove = false;
        this.renderBoard();
      }
    }, 450);

    // Play sound on move start
    if (result.captured) {
      this.playSound('capture');
    } else {
      this.playSound('move');
    }

    if (result.check) {
      // The board glow, king shake and check sound are fired by
      // updateCheckAlert() once the moved piece has landed.
      this._checkAlertOn = false;
    }

    // Check if we can animate DOM pieces
    if (movingPieceEl && fromSq && toSq) {
      const dx = toSq.offsetLeft - fromSq.offsetLeft;
      const dy = toSq.offsetTop - fromSq.offsetTop;

      // Glide moving piece on top of all squares & overlays
      fromSq.classList.add('gliding-source');
      fromSq.style.zIndex = '1000';
      fromSq.style.overflow = 'visible';
      movingPieceEl.classList.add('piece-gliding');
      movingPieceEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;

      // Animate castling rook if castling
      if (result.castling) {
        const rookRow = result.piece.color === 'white' ? 7 : 0;
        const rookFromCol = result.castling === 'kingSide' ? 7 : 0;
        const rookToCol = result.castling === 'kingSide' ? 5 : 3;
        const rookFromSq = document.querySelector(`.square[data-row="${rookRow}"][data-col="${rookFromCol}"]`);
        const rookToSq = document.querySelector(`.square[data-row="${rookRow}"][data-col="${rookToCol}"]`);
        const rookPiece = rookFromSq ? rookFromSq.querySelector('.piece') : null;
        if (rookPiece && rookFromSq && rookToSq) {
          const rdx = rookToSq.offsetLeft - rookFromSq.offsetLeft;
          const rdy = rookToSq.offsetTop - rookFromSq.offsetTop;
          rookFromSq.classList.add('gliding-source');
          rookFromSq.style.zIndex = '999';
          rookFromSq.style.overflow = 'visible';
          rookPiece.classList.add('piece-gliding');
          rookPiece.style.transform = `translate(${rdx}px, ${rdy}px) scale(1.12)`;
        }
      }

      // If capture, trigger victim kill recoil & combat shard burst
      if (result.captured) {
        if (victimPieceEl) {
          victimPieceEl.classList.add('piece-being-killed');
        }
        // At impact (~90ms): trigger smooth lightweight combat effect
        setTimeout(() => {
          if (victimSq) this.createCombatKillEffect(victimSq);
        }, 90);
      }

      // After glide finishes (200ms): commit to engine rendering
      setTimeout(() => {
        this.lastMove = { from: result.from, to: result.to };
        this.renderBoard();
        this.updateMoveHistory(result);
        this.updateCapturedPieces();
        this.updatePlayerBars();
        this.isAnimatingMove = false;

        if (onDone) onDone();
      }, 200);
    } else {
      // Direct render fallback
      this.lastMove = { from: result.from, to: result.to };
      this.renderBoard();
      this.updateMoveHistory(result);
      this.updateCapturedPieces();
      this.updatePlayerBars();
      this.isAnimatingMove = false;

      if (result.captured && victimSq) {
        this.createCombatKillEffect(victimSq);
      }

      if (onDone) onDone();
    }
  }

  executeMove(fromRow, fromCol, toRow, toCol, promotion) {
    const result = this.engine.makeMove(fromRow, fromCol, toRow, toCol, promotion);
    if (!result) return;

    // Send to server if online
    if (this.gameMode === 'online') {
      const from = ChessEngine.toAlgebraic(fromRow, fromCol);
      const to = ChessEngine.toAlgebraic(toRow, toCol);
      this.multiplayer.sendMove(from, to, promotion);
    }

    // Clear selection indicators from DOM without destroying pieces
    this.selectedSquare = null;
    this.legalMoves = [];
    document.querySelectorAll('.square.selected, .square.legal-move, .square.legal-capture').forEach(sq => {
      sq.classList.remove('selected', 'legal-move', 'legal-capture');
    });

        // User made a move -> reset 1-move undo lock so they can undo this new move if desired
    if (result.piece.color === this.playerColor) {
      this.hasUndoneCurrentMove = false;
      this.updateUndoButtonUI();
    }
    this.animateMoveAndApply(result, () => {
      // Check game over
      if (this.engine.gameOver) {
        this.playSound('gameover');
        setTimeout(() => this.showGameOver(), 500);
        return;
      }

      // AI response
      if (this.gameMode === 'ai') {
        setTimeout(() => this.makeAIMove(), 320);
      }
    });
  }

  // --- Promotion -------------------------------------

  showPromotionModal() {
    const modal = document.getElementById('modal-promotion');
    // Show correct color pieces
    const isWhite = this.engine.currentTurn === 'white';
    modal.querySelectorAll('.promo-white').forEach(el => el.style.display = isWhite ? 'inline' : 'none');
    modal.querySelectorAll('.promo-black').forEach(el => el.style.display = isWhite ? 'none' : 'inline');
    modal.classList.remove('hidden');
  }

  selectPromotion(type) {
    document.getElementById('modal-promotion').classList.add('hidden');
    if (this.pendingPromotion) {
      const { fromRow, fromCol, toRow, toCol } = this.pendingPromotion;
      this.pendingPromotion = null;
      this.executeMove(fromRow, fromCol, toRow, toCol, type);
    } else if (this.pendingSwapPromotion) {
      const { row1, col1, row2, col2 } = this.pendingSwapPromotion;
      this.pendingSwapPromotion = null;
      const swapArgs = { row1, col1, row2, col2, promotion: type };
      if (this.gameMode === 'online') {
        this.pendingAbilityCharge = 'swap';
                      this.markAbilityUsed('swap');
                      this.multiplayer.send({
                          type: 'use_ability',
                          ability: 'swap',
          args: swapArgs
        });
      } else {
        const ok = this.engine.validateAbility('swap', swapArgs, this.playerColor);
        if (ok) {
          this.markAbilityUsed('swap');
          this.showToast('🔄 Tactical Swap executed!');
          if (this.gameMode === 'ai' && this.engine.currentTurn !== this.playerColor) {
            setTimeout(() => this.makeAIMove(), 500);
          }
        }
      }
    }
  }

  // --- Timer -----------------------------------------

  startTimerTick() {
    this.stopTimerTick();
    if (!this.timers.white && !this.timers.black) return;
    this.lastMoveTime = Date.now();

    this.timerInterval = setInterval(() => {
      if (this.engine.gameOver) {
        this.stopTimerTick();
        return;
      }

      // Host pause (tab switch, ad, system pause): do not let the local clock
      // run down while the player cannot interact.
      if (this.platformPaused) {
        this.lastMoveTime = Date.now();
        return;
      }

      const now = Date.now();
      const elapsed = now - this.lastMoveTime;
      this.lastMoveTime = now;

      const currentTurn = this.engine.currentTurn;
      if (Number.isFinite(this.moveTimeLeft)) {
        this.moveTimeLeft = Math.max(0, this.moveTimeLeft - elapsed);
      }
      if (this.timers[currentTurn] !== null) {
        this.timers[currentTurn] = Math.max(0, this.timers[currentTurn] - elapsed);

        if (this.timers[currentTurn] <= 0) {
          this.timers[currentTurn] = 0;
          // In AI mode, handle timeout locally. Online timeouts are decided by
          // the server, so keep the tick alive until game_over or the next sync.
          if (this.gameMode === 'ai') {
            this.stopTimerTick();
            const winner = currentTurn === 'white' ? 'black' : 'white';
            this.engine.gameOver = true;
            this.engine.gameResult = { winner, reason: 'timeout' };
            this.playSound('gameover');
            this.showGameOver();
          }
        }
      }

      this.updateTimerDisplay();
    }, 100);
  }

  stopTimerTick() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const formatTime = (ms) => {
      if (ms === null || ms === undefined) return '--:--';
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const topColor = this.boardFlipped ? 'white' : 'black';
    const bottomColor = this.boardFlipped ? 'black' : 'white';

    const topTimer = document.getElementById('top-timer');
    const bottomTimer = document.getElementById('bottom-timer');

    topTimer.textContent = formatTime(this.timers[topColor]);
    bottomTimer.textContent = formatTime(this.timers[bottomColor]);

    // Low time warning (under 30 seconds)
    topTimer.classList.toggle('low-time', this.timers[topColor] !== null && this.timers[topColor] < 30000);
    bottomTimer.classList.toggle('low-time', this.timers[bottomColor] !== null && this.timers[bottomColor] < 30000);

    const turnBadge = document.getElementById('turn-status-badge');
    if (turnBadge && this.engine) {
      const isOnlinePvP = this.gameMode === 'online';
      const moveSecs = (isOnlinePvP && Number.isFinite(this.moveTimeLeft)) ? Math.ceil(this.moveTimeLeft / 1000) : null;
      const secStr = moveSecs !== null ? ` (${moveSecs}s)` : '';
      if (this.isMyTurn) {
        turnBadge.classList.add('your-turn');
        turnBadge.textContent = `Your Turn${secStr}`;
        turnBadge.classList.toggle('low-time', moveSecs !== null && moveSecs <= 10);
      } else {
        turnBadge.classList.remove('your-turn');
        turnBadge.textContent = isOnlinePvP ? `Opponent is thinking...${secStr}` : `Opponent's Turn`;
        turnBadge.classList.remove('low-time');
      }
    }
  }

  // --- Player Bars -----------------------------------

  updatePlayerBars() {
    if (!this.engine) return;

    const topColor = this.boardFlipped ? 'white' : 'black';
    const bottomColor = this.boardFlipped ? 'black' : 'white';

    const topBar = document.getElementById('player-top');
    const bottomBar = document.getElementById('player-bottom');

    const wasMyTurn = this.isMyTurn || false;
    this.isMyTurn = this.engine ? this.engine.currentTurn === this.playerColor : false;

    if (topBar) topBar.classList.toggle('active-turn', this.engine && this.engine.currentTurn === topColor);
    if (bottomBar) bottomBar.classList.toggle('active-turn', this.engine && this.engine.currentTurn === bottomColor);

    // Update in-game Turn Status Badge
    const turnBadge = document.getElementById('turn-status-badge');
    if (turnBadge && this.engine) {
      const isOnlinePvP = this.gameMode === 'online';
      const moveSecs = (isOnlinePvP && Number.isFinite(this.moveTimeLeft)) ? Math.ceil(this.moveTimeLeft / 1000) : null;
      const secStr = moveSecs !== null ? ` (${moveSecs}s)` : '';
      if (this.isMyTurn) {
        turnBadge.classList.add('your-turn');
        turnBadge.textContent = `Your Turn${secStr}`;
        turnBadge.classList.toggle('low-time', moveSecs !== null && moveSecs <= 10);
      } else {
        turnBadge.classList.remove('your-turn');
        turnBadge.textContent = isOnlinePvP ? `Opponent is thinking...${secStr}` : `Opponent's Turn`;
        turnBadge.classList.remove('low-time');
      }
    }

    // Play sound if it just became our turn
    if (this.isMyTurn && !wasMyTurn) {
      setTimeout(() => this.playSound('your-turn'), 100);
    }

    this.updateTimerDisplay();
  }

  // --- Move History ----------------------------------

  updateMoveHistory(moveData) {
    this.updateMoveHistoryUI();
  }

  
  updateMoveHistoryUI() {
    const list = document.getElementById('ticker-content');
    if (list) {
      list.innerHTML = '';
      this.engine.moveHistory.forEach((move, i) => {
        const item = document.createElement('div');
        item.className = 'ticker-item';
        item.textContent = (i % 2 === 0 ? ((Math.floor(i/2) + 1) + '. ') : '') + (move.notation || '');
        list.appendChild(item);
      });
      list.scrollLeft = list.scrollWidth;
    }
  }

  setupMoveTickerScroll() {
    const container = document.getElementById('move-history-ticker');
    const list = document.getElementById('ticker-content');
    if (!container || !list || container.dataset.scrollReady === 'true') return;
    container.dataset.scrollReady = 'true';

    // Translate a mouse-wheel / trackpad gesture into horizontal movement so the
    // move history can be browsed with a normal mouse on desktop as well.
    container.addEventListener('wheel', (event) => {
      const maxScroll = list.scrollWidth - list.clientWidth;
      if (maxScroll <= 0) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      list.scrollLeft = Math.max(0, Math.min(maxScroll, list.scrollLeft + delta));
    }, { passive: false });
  }

  clearMoveHistory() {
    const list = document.getElementById('ticker-content');
    if (list) list.innerHTML = '';
  }



  
  setupDraggableChat() {
    const chatBtn = document.getElementById('btn-toggle-chat');
    if (!chatBtn) return;
    
    let isDragging = false;
    let hasDragged = false;
    let startX, startY, startLeft, startTop;

    const onStart = (e) => {
        if (e.target !== chatBtn && !chatBtn.contains(e.target)) return;
        isDragging = true;
        hasDragged = false;
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        const rect = chatBtn.getBoundingClientRect();
        startX = clientX;
        startY = clientY;
        startLeft = rect.left;
        startTop = rect.top;
        
        // position fixed is set on move
        chatBtn.style.cursor = 'grabbing';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDragged = true;
        }
        
        if (hasDragged) {
            if(e.cancelable) e.preventDefault();
            chatBtn.style.position = 'fixed';
            chatBtn.style.zIndex = '9999';
            chatBtn.style.bottom = 'auto';
            chatBtn.style.right = 'auto';
            chatBtn.style.margin = '0';
            
            // Keep within window bounds
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;
            
            const maxX = window.innerWidth - chatBtn.offsetWidth;
            const maxY = window.innerHeight - chatBtn.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            chatBtn.style.left = newLeft + 'px';
            chatBtn.style.top = newTop + 'px';
        }
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        chatBtn.style.cursor = 'grab';
    };

    chatBtn.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    
    chatBtn.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    
    chatBtn.addEventListener('click', (e) => {
        if (hasDragged) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    
    chatBtn.style.cursor = 'grab';
  }


  toggleChat() {
    const chat = document.querySelector('.chat-container');
    if (chat) {
      chat.classList.toggle('chat-open');
    }
  }

  // --- Captured Pieces ------------------------------

  updateCapturedPieces() {
    const topColor = this.boardFlipped ? 'white' : 'black';
    const bottomColor = this.boardFlipped ? 'black' : 'white';

    const topCaptured = document.getElementById('top-captured');
    const bottomCaptured = document.getElementById('bottom-captured');
    if (!topCaptured || !bottomCaptured) return;

    // Pieces captured by top player (opponent from bottom's perspective)
    const topCaptures = (this.engine && this.engine.capturedPieces) ? this.engine.capturedPieces[bottomColor] : [];
    // Pieces captured by bottom player
    const bottomCaptures = (this.engine && this.engine.capturedPieces) ? this.engine.capturedPieces[topColor] : [];

    const pieceOrder = ['queen', 'rook', 'bishop', 'knight', 'pawn'];

    const renderCapturesHTML = (captures, color) => {
      if (!captures || captures.length === 0) return '';
      const sorted = [...captures].sort((a, b) =>
        pieceOrder.indexOf(a.type) - pieceOrder.indexOf(b.type)
      );
      return sorted.map(p => {
        if (typeof PieceSVGs !== 'undefined' && PieceSVGs.getPiece) {
          return `<span class="cap-piece-item" title="${color} ${p.type}">${PieceSVGs.getPiece(color, p.type)}</span>`;
        }
        const sym = (this.pieceSymbols[color] && this.pieceSymbols[color][p.type]) || p.type.charAt(0).toUpperCase();
        return `<span class="cap-piece-glyph ${color === 'white' ? 'white-cap' : 'black-cap'}">${sym}</span>`;
      }).join('');
    };

    topCaptured.innerHTML = renderCapturesHTML(topCaptures, bottomColor);
    bottomCaptured.innerHTML = renderCapturesHTML(bottomCaptures, topColor);
  }

  clearCapturedPieces() {
    const topCaptured = document.getElementById('top-captured');
    const bottomCaptured = document.getElementById('bottom-captured');
    if (topCaptured) topCaptured.innerHTML = '';
    if (bottomCaptured) bottomCaptured.innerHTML = '';
  }

  // --- Game Over -------------------------------------

  // --- Game Over & Victory Screen ---------------------

  // ------------------------------------------
  //  BACKGROUND MUSIC (Web Audio, procedural)
  // ------------------------------------------

  setupAudioAutoplayUnlock() {
    if (!this.musicEnabled || this.platformAudioMuted || this.platformPaused) return;

    if (this._audioUnlockCleanup) {
      this._audioUnlockCleanup();
      this._audioUnlockCleanup = null;
    }

    const events = ['click', 'touchend', 'pointerup', 'keydown'];
    const tryUnlock = () => {
      if (!this.musicEnabled || this.platformAudioMuted || this.platformPaused) {
        cleanup();
        return;
      }

      if (this.bgAudio && !this.bgAudio.paused) {
        cleanup();
        return;
      }

      const p = this.startBgMusic();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (this.bgAudio && !this.bgAudio.paused) {
            cleanup();
          }
        }).catch(() => {
          // Keep listeners attached so subsequent user taps will unlock playback
        });
      } else if (this.bgAudio && !this.bgAudio.paused) {
        cleanup();
      }
    };

    const cleanup = () => {
      events.forEach(evt => {
        document.removeEventListener(evt, tryUnlock, true);
      });
      this._audioUnlockCleanup = null;
    };

    this._audioUnlockCleanup = cleanup;
    events.forEach(evt => {
      document.addEventListener(evt, tryUnlock, { capture: true, passive: true });
    });
  }

  startBgMusic() {
    if (!this.musicEnabled || this.platformAudioMuted || this.platformPaused) return null;
    if (this.bgMusicRunning && this.bgAudio && !this.bgAudio.paused) return null;

    if (!this.bgAudio) {
      try {
        this.bgAudio = new Audio('/assets/audio/Chess-Arena-BGM.mp3');
        this.bgAudio.loop = true;
        this.bgAudio.volume = (typeof this.musicVolume === 'number') ? this.musicVolume : 0.25;
      } catch (e) {
        console.warn('Audio element creation error:', e);
        return null;
      }
    }

    this.bgAudio.volume = (typeof this.musicVolume === 'number') ? this.musicVolume : 0.25;
    this.bgMusicRunning = true;
    try {
      const playPromise = this.bgAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          // Autoplay policy prevented playback until user interaction
          this.bgMusicRunning = false;
        });
        return playPromise;
      }
    } catch (e) {
      this.bgMusicRunning = false;
    }
    return null;
  }

  stopBgMusic() {
    this.bgMusicRunning = false;
    if (this.bgAudio) {
      try {
        this.bgAudio.pause();
        this.bgAudio.currentTime = 0;
      } catch (e) {}
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.startBgMusic();
      this.setupAudioAutoplayUnlock();
    } else {
      this.stopBgMusic();
      if (this._audioUnlockCleanup) {
        this._audioUnlockCleanup();
        this._audioUnlockCleanup = null;
      }
    }
    this.syncSettingsUI();
    this.saveEconomyState();
    this.showToast(this.musicEnabled ? 'Music enabled' : 'Music muted');
  }

  setMusicVolume(value) {
    const volNum = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    this.musicVolume = volNum / 100;
    try {
      localStorage.setItem('chessarena_music_volume', String(this.musicVolume));
    } catch(e) {}

    if (this.bgAudio) {
      this.bgAudio.volume = this.musicVolume;
    }

    if (volNum === 0 && this.musicEnabled) {
      this.toggleMusic();
    } else if (volNum > 0 && !this.musicEnabled) {
      this.toggleMusic();
    } else {
      this.syncSettingsUI();
    }
  }


  showGameOver() {
    this.stopTimerTick();
    this.stopCheckAlert();
    this.postGameBreak = true;
    const result = (this.engine && this.engine.gameResult) ? this.engine.gameResult : { winner: null, reason: 'completed' };
    this.showVictoryScreen(result);
  }

  async maybeShowPostGameInterstitial() {
    if (!this.postGameBreak) return;
    this.postGameBreak = false;
    if (!window.AdService || typeof window.AdService.showInterstitial !== 'function') return;
    try {
      // Natural breakpoint only: after the result screen, before the next
      // match or a return to the menu. Never during active gameplay/PvP.
      await window.AdService.showInterstitial('game_completed');
    } catch (e) { /* never block the next action on an ad */ }
  }

  showVictoryScreen(result) {
    // Persist the finished game (once per session) before rendering the recap
    this.recordGameResult(result);
    this.updateCoinsDisplay();

    const earnedCoins = Math.max(0, Number(this.lastMatchCoinsEarned) || 0);
    const coinsMeta = document.getElementById('victory-meta-coins');
    if (coinsMeta) {
      coinsMeta.textContent = `+${earnedCoins.toLocaleString()} 🪙`;
    }
    const doublerBtn = document.getElementById('victory-btn-doubler');
    const doublerText = document.getElementById('victory-btn-doubler-text');
    if (doublerBtn) {
      doublerBtn.disabled = this.lastMatchDoubled || earnedCoins <= 0;
      doublerBtn.style.opacity = doublerBtn.disabled ? '0.7' : '1';
    }
    if (doublerText) {
      if (this.lastMatchDoubled) {
        doublerText.textContent = '🌟 3X Bonus Claimed!';
      } else if (earnedCoins > 0) {
        doublerText.textContent = `🎬 Watch Ad for 3X Coins (+${(earnedCoins * 2).toLocaleString()} 🪙)`;
      } else {
        doublerText.textContent = 'No match reward to boost';
      }
    }

    const isPlayerWin = result.winner ? (result.winner === this.playerColor) : false;
    const isDraw = !result.winner;

    const titleEl = document.getElementById('victory-title-heading');
    const subheadingEl = document.getElementById('victory-subheading');
    const scoreEl = document.getElementById('victory-score-display');
    const oppNameEl = document.getElementById('victory-opp-name');
    const oppRatingEl = document.getElementById('victory-opp-rating');
    const modeEl = document.getElementById('victory-meta-mode');
    const durationEl = document.getElementById('victory-meta-duration');
    const movesEl = document.getElementById('victory-meta-moves');
    const ratingEl = document.getElementById('victory-meta-rating');

    const reasonMap = {
      'checkmate': 'Checkmate',
      'stalemate': 'Stalemate',
      'timeout': 'on Time',
      'abandonment': 'by Inactivity / Abandonment',
      'afk_forfeit': 'by Inactivity / Forfeit',
      'resignation': 'by Resignation',
      'draw agreement': 'by Agreement',
      'draw agreed': 'by Agreement',
      '50-move rule': '50-Move Rule',
      'threefold repetition': 'Threefold Repetition'
    };

    let reasonDisplay = reasonMap[result.reason] || (result.reason || 'Checkmate');
    if (result.reason && result.reason.startsWith('insufficient material:')) {
      const details = result.reason.split(': ')[1];
      reasonDisplay = `Insufficient Material (${details})`;
    }

    const heroImg = document.getElementById('victory-hero-img');
    if (heroImg) {
      if (isPlayerWin) {
        heroImg.src = '/assets/victory.jpg';
      } else if (isDraw) {
        heroImg.src = '/assets/draw.jpg';
      } else {
        heroImg.src = '/assets/defeat.jpg';
      }
    }

        if (titleEl) {
      if (isPlayerWin) {
        titleEl.textContent = 'VICTORY';
        titleEl.style.color = '#8F5F00';
      } else if (isDraw) {
        titleEl.textContent = 'DRAW';
        titleEl.style.color = '#20120B';
      } else {
        titleEl.textContent = 'DEFEAT';
        titleEl.style.color = '#8B1E1E';
      }
    }

    if (subheadingEl) {
      subheadingEl.textContent = reasonDisplay;
    }

    if (scoreEl) {
      if (isPlayerWin) scoreEl.textContent = '1 - 0';
      else if (isDraw) scoreEl.textContent = '½ - ½';
      else scoreEl.textContent = '0 - 1';
    }

    const rawOppName = document.getElementById('top-player-name')?.textContent || 'Opponent';
    const cleanOppName = rawOppName.replace(/\s*\(\d+\)/, '').replace(/\s*\((White|Black)\)$/, '');
    const currentOppRating = document.getElementById('top-player-rating')?.textContent || '1200';
    if (oppNameEl) oppNameEl.textContent = cleanOppName;
    if (oppRatingEl) oppRatingEl.textContent = currentOppRating;

    if (modeEl) {
      modeEl.textContent = this.matchType === 'tactical' ? 'Tactical Mode' : 'Standard';
    }

    let durationText = '12 min 34 sec';
    if (this.gameStartTime) {
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - this.gameStartTime) / 1000));
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      durationText = `${mins} min ${secs} sec`;
    }
    if (durationEl) durationEl.textContent = durationText;

    const moveCount = (this.engine && this.engine.moveHistory) ? this.engine.moveHistory.length : 0;
    if (movesEl) movesEl.textContent = moveCount;

    if (ratingEl) {
      const change = Number(this.lastRatingChange) || 0;
      ratingEl.textContent = change > 0 ? '+' + change : (change < 0 ? String(change) : '+0');
      ratingEl.className = change > 0 ? 'recap-meta-value highlight-green' : 'recap-meta-value';
      ratingEl.style.color = change > 0 ? '' : (change < 0 ? '#ef4444' : '#94a3b8');
    }

    
    
    
    // Show/Hide Rematch button based on game mode
    const rematchBtn = document.getElementById('victory-btn-rematch');
    const newMatchBtn = document.getElementById('victory-btn-playagain');
    if (rematchBtn) {
        if (this.gameMode === 'online') {
            rematchBtn.style.display = 'inline-block';
            rematchBtn.disabled = false;
            rematchBtn.innerHTML = '<span>Rematch</span>';
        } else {
            rematchBtn.style.display = 'none';
        }
    }
    if (newMatchBtn) {
        newMatchBtn.innerHTML = this.gameMode === 'online' ? '<span>New Opponent</span>' : '<span>Play Again</span>';
    }
    
    
    
    const playerNameEl = document.getElementById('victory-player-name');
    const playerRatingEl = document.getElementById('victory-player-rating');
    const rawPlayerName = document.getElementById('bottom-player-name')?.textContent || 'Player';
    const currentPlayerName = rawPlayerName.replace(/\s*\(\d+\)/, '');
    const currentPlayerRating = document.getElementById('bottom-player-rating')?.textContent || '1240';
    if (playerNameEl) playerNameEl.textContent = currentPlayerName;
    if (playerRatingEl) playerRatingEl.textContent = currentPlayerRating;
    
    // Sync avatars from in-game UI to victory screen
    const victoryPlayerAvatar = document.getElementById('victory-player-avatar');
    const inGamePlayerAvatar = document.getElementById('bottom-player-avatar');
    if (victoryPlayerAvatar && inGamePlayerAvatar && inGamePlayerAvatar.src) {
        victoryPlayerAvatar.src = inGamePlayerAvatar.src;
    }

    const victoryOppAvatar2 = document.getElementById('victory-opp-avatar');
    const inGameOppAvatar = document.getElementById('top-player-avatar');
    if (victoryOppAvatar2) {
        if (inGameOppAvatar && inGameOppAvatar.src) {
            victoryOppAvatar2.src = inGameOppAvatar.src;
        } else if (this.opponentAvatarSrc) {
            victoryOppAvatar2.src = this.opponentAvatarSrc;
        }
    }
    
    this.showScreen('screen-victory');
  }

  async restartGame() {
    await this.maybeShowPostGameInterstitial();
    if (this.gameMode === 'ai') {
      const difficulty = this.ai ? this.ai.difficulty : 'medium';
      this.startAIGame(difficulty);
    } else if (this.gameMode === 'online') {
      this.findMatch();
    } else {
      this.goHome();
    }
  }

  // --- In-Game 3-Action Controls (Undo, Hint, Resign) --

  getHint() {
    if (this.gameMode === 'online') {
      this.showToast('Hints are disabled in competitive PvP');
      return;
    }
    if (!this.engine || this.engine.gameOver) {
      this.showToast('No active game for hints');
      return;
    }
    if (this.engine.currentTurn !== this.playerColor) {
      this.showToast('Wait for your turn to get a hint');
      return;
    }

    const hintCosts = (window.ECONOMY_CONFIG && window.ECONOMY_CONFIG.hintsAndUndos && window.ECONOMY_CONFIG.hintsAndUndos.hintCosts) || [25, 50, 100, 200];
    const hintIdx = this.hintCountInMatch || 0;
    if (hintIdx >= hintCosts.length) {
      this.showToast('Hint limit reached for this match');
      return;
    }
    const hintCost = hintCosts[hintIdx];

    const hintAI = new AIEngine('hard');
    const bestMove = hintAI.getBestMove(this.engine);
    if (!bestMove) {
      this.showToast('No hints available right now');
      return;
    }

    if (!this.spendCoins(hintCost, 'hint')) {
      this.showToast(`Need ${hintCost} coins for hint! (You have ${this.coins || 0})`);
      return;
    }
    this.hintCountInMatch = hintIdx + 1;
    this.updateHintButtonUI();

    // Clear previous hint highlights
    document.querySelectorAll('.square.hint-move').forEach(sq => {
      sq.classList.remove('hint-move');
    });

    const fromSquare = document.querySelector(`.square[data-row="${bestMove.fromRow}"][data-col="${bestMove.fromCol}"]`);
    const toSquare = document.querySelector(`.square[data-row="${bestMove.row}"][data-col="${bestMove.col}"]`);

    if (fromSquare) fromSquare.classList.add('hint-move');
    if (toSquare) toSquare.classList.add('hint-move');

    const files = 'abcdefgh';
    const fromCoord = `${files[bestMove.fromCol]}${8 - bestMove.fromRow}`;
    const toCoord = `${files[bestMove.col]}${8 - bestMove.row}`;
    this.showToast(`💡 Hint: Move ${fromCoord} to ${toCoord}`);

    setTimeout(() => {
      if (fromSquare) fromSquare.classList.remove('hint-move');
      if (toSquare) toSquare.classList.remove('hint-move');
    }, 3500);
  }

  updateHintButtonUI() {
    const label = document.getElementById('btn-ingame-hint-label');
    if (!label) return;
    const costs = (window.ECONOMY_CONFIG && window.ECONOMY_CONFIG.hintsAndUndos && window.ECONOMY_CONFIG.hintsAndUndos.hintCosts) || [25, 50, 100, 200];
    const idx = this.hintCountInMatch || 0;
    if (idx >= costs.length) {
      label.textContent = 'Hint limit';
    } else {
      label.innerHTML = `Hint <span style="color:#FFD54F;font-size:11px;font-weight:700;">🪙${costs[idx]}</span>`;
    }
  }

  getUserCoins() {
    if (this.coins !== undefined && this.coins !== null && Number.isFinite(Number(this.coins))) return this.coins;
    let saved = localStorage.getItem('chessarena_coins');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return window.ECONOMY_CONFIG?.currency?.startingCoins || 1000;
  }

  updateUserCoins(newAmount, options = {}) {
    const amount = Math.max(0, Math.floor(Number(newAmount) || 0));
    this.coins = amount;
    if (options.persist !== false) {
      this._sessionCoinsModified = true;
    }
    try {
      localStorage.setItem('chessarena_coins', String(amount));
    } catch(e) {}

    if (this.cloudProfile) {
      this.cloudProfile.coins = amount;
      this.cloudProfile.lastUpdated = Date.now();
      if (options.persist !== false && window.ChessArenaStorage) {
        window.ChessArenaStorage.saveProfile(this.cloudProfile).catch(() => {});
      }
    } else if (options.persist !== false && window.ChessArenaStorage) {
      if (window.ChessArenaStorage.current) {
        window.ChessArenaStorage.current.coins = amount;
        window.ChessArenaStorage.saveProfile(window.ChessArenaStorage.current).catch(() => {});
      }
    }

    if (window.ChessArenaStorage && window.ChessArenaStorage.current) {
      window.ChessArenaStorage.current.coins = amount;
    }

    this.updateCoinsDisplay();
    return this.coins;
  }

  getUndoCost() {
    const count = this.undoCountInMatch || 0;
    const costs = (window.ECONOMY_CONFIG && window.ECONOMY_CONFIG.hintsAndUndos && window.ECONOMY_CONFIG.hintsAndUndos.undoCosts) || [50, 100, 200];
    return costs[count] !== undefined ? costs[count] : costs[costs.length - 1] * Math.pow(2, count - (costs.length - 1));
  }

  updateUndoButtonUI() {
    const undoBtn = document.getElementById('btn-ingame-undo');
    if (!undoBtn) return;
    const labelEl = document.getElementById('btn-ingame-undo-label');
    const cost = this.getUndoCost();

    if (this.hasUndoneCurrentMove) {
      undoBtn.classList.add('disabled');
      undoBtn.style.opacity = '0.45';
      if (labelEl) {
        labelEl.innerHTML = `Undo <span style="color: #bbb; font-size: 11px;">(1 only)</span>`;
      }
    } else {
      undoBtn.classList.remove('disabled');
      undoBtn.style.opacity = '1';
      if (labelEl) {
        labelEl.innerHTML = `Undo <span class="undo-cost-badge" style="color: #FFD54F; font-size: 11px; font-weight: 700;">Coins ${cost}</span>`;
      }
    }
  }

  applyHistoryEntry(engine, entry) {
    if (!engine || !entry) return null;
    if (entry.ability === 'second') {
      // The move that Second Chance undid is already absent from the final
      // history, so replay the state it left behind without undoing twice.
      engine.moveHistory.push({
        notation: 'USE_SECOND_CHANCE',
        color: entry.color,
        ability: 'second',
        args: null
      });
      if (engine.abilitiesUsed && engine.abilitiesUsed[entry.color] &&
          !engine.abilitiesUsed[entry.color].includes('second')) {
        engine.abilitiesUsed[entry.color].push('second');
      }
      return true;
    }
    if (entry.ability) {
      return engine.validateAbility(entry.ability, entry.args || null, entry.color);
    }
    const from = typeof entry.from === 'string'
      ? ChessEngine.fromAlgebraic(entry.from)
      : entry.from;
    const to = typeof entry.to === 'string'
      ? ChessEngine.fromAlgebraic(entry.to)
      : entry.to;
    if (!from || !to || from.row == null || from.col == null || to.row == null || to.col == null) {
      return null;
    }
    return engine.makeMove(from.row, from.col, to.row, to.col, entry.promotion || null);
  }

  undoMove() {
    if (this.gameMode === 'online') {
      this.showToast('Undo is disabled in competitive PvP');
      return;
    }
    if (!this.engine || this.engine.moveHistory.length === 0) {
      this.showToast('No moves to undo');
      return;
    }

    // Restriction: Only 1 move undo allowed until player makes another move!
    if (this.hasUndoneCurrentMove) {
      this.showToast('Only 1 move can be undone. Make a new move first!');
      return;
    }

    // Progressive double-down cost, capped by the configured number of undos.
    const undoCosts = (window.ECONOMY_CONFIG && window.ECONOMY_CONFIG.hintsAndUndos && window.ECONOMY_CONFIG.hintsAndUndos.undoCosts) || [50, 100, 200];
    if ((this.undoCountInMatch || 0) >= undoCosts.length) {
      this.showToast('Undo limit reached for this match');
      return;
    }
    const cost = this.getUndoCost();
    if (!this.spendCoins(cost, 'undo')) {
      this.showToast(`Need ${cost} coins to Undo! (You have ${this.coins || 0})`);
      return;
    }

    // Rollback moves (AI move + Player move if both moved, else 1)
    let movesToPop = 1;
    if (this.engine.currentTurn === this.playerColor && this.engine.moveHistory.length >= 2) {
      movesToPop = 2;
    }

    const targetHistory = this.engine.moveHistory.slice(0, this.engine.moveHistory.length - movesToPop);

    // Replay history on fresh engine. Ability entries must be replayed too, or
    // Freeze/Shield/Second Chance state would drift from the real timeline.
    const freshEngine = new ChessEngine();
    for (const m of targetHistory) {
      this.applyHistoryEntry(freshEngine, m);
    }

    this.engine = freshEngine;
    this.lastMove = targetHistory.length > 0 ? {
      from: targetHistory[targetHistory.length - 1].from,
      to: targetHistory[targetHistory.length - 1].to
    } : null;

    this.selectedSquare = null;
    this.legalMoves = [];

    // Mark current move as undone and increment count for double-down next time
    this.hasUndoneCurrentMove = true;
    this.undoCountInMatch = (this.undoCountInMatch || 0) + 1;
    this.updateUndoButtonUI();

    this.renderBoard();
    this.updateCapturedPieces();
    this.rebuildMoveHistoryUI();
    this.updatePlayerBars();
    this.showToast(`Move undone (-${cost} coins)`);
  }
  rebuildMoveHistoryUI() {
    this.updateMoveHistoryUI();
  }

  // --- Navigation & Features ---------------

  updateBottomNav(tabName) {
    const tabIndices = { home: 0, rankings: 1, shop: 2, profile: 3 };
    const targetIdx = tabIndices[tabName] !== undefined ? tabIndices[tabName] : 0;

    document.querySelectorAll('.fantasy-bottom-nav').forEach(nav => {
      nav.setAttribute('data-active-index', targetIdx);
      const tabs = nav.querySelectorAll('.nav-tab');
      tabs.forEach((tab, idx) => {
        tab.classList.toggle('active', idx === targetIdx);
      });
    });
  }

  showProfileScreen() {
    this.updateBottomNav('profile');
    this.loadPlayerStats();
    this.renderProfileStats();
    this.renderProfileRank(this.cloudProfile);
    this.applyPlatformProfile();
    this.showScreen('screen-profile');
  }

  // --- Player stats ---------------------------------
  // Progression is stored locally first so it works in any webview (including
  // YouTube Playables), then reconciled with the server profile when online.
  statsStorageKey() {
    const identity = (this.userProfile && this.userProfile.username)
      ? String(this.userProfile.username).toLowerCase()
      : String(this.playerId || 'guest');
    return 'chessarena_stats_v1_' + identity;
  }

  loadPlayerStats() {
    const toCount = (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    };
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem(this.statsStorageKey()) || 'null'); }
      catch (e) { return null; }
    })();

    const stats = {
      rating: 1200,
      ai: { wins: 0, losses: 0, draws: 0 },
      online: { wins: 0, losses: 0, draws: 0 },
      hasServerStats: false
    };

    if (stored) {
      const rating = Number(stored.rating);
      if (Number.isFinite(rating) && rating > 0) stats.rating = Math.floor(rating);
      ['ai', 'online'].forEach((bucket) => {
        if (!stored[bucket]) return;
        stats[bucket].wins = toCount(stored[bucket].wins);
        stats[bucket].losses = toCount(stored[bucket].losses);
        stats[bucket].draws = toCount(stored[bucket].draws);
      });
      stats.hasServerStats = stored.hasServerStats === true;
    }

    // Server profile is authoritative for online play: merge without ever
    // lowering a locally tracked count (offline play may not have synced yet).
    const user = this.userProfile;
    if (user) {
      if (Number.isFinite(Number(user.elo)) && Number(user.elo) > 0) {
        stats.rating = Math.floor(Number(user.elo));
      }
      stats.online.wins = Math.max(stats.online.wins, toCount(user.wins));
      stats.online.losses = Math.max(stats.online.losses, toCount(user.losses));
      stats.online.draws = Math.max(stats.online.draws, toCount(user.draws));
      stats.hasServerStats = true;
    }

    this.playerStats = stats;
    this.savePlayerStats();
    return stats;
  }

  savePlayerStats() {
    if (!this.playerStats) return;
    try {
      localStorage.setItem(this.statsStorageKey(), JSON.stringify(this.playerStats));
    } catch (e) { /* storage may be unavailable; keep in-memory stats */ }
    if (this.economyPersistenceReady) this.scheduleEconomyPersist();
  }

  getTotalStats() {
    // The cloud profile is the single source of truth for the visible totals.
    if (this.cloudProfile && this.cloudProfile.stats) {
      const stats = this.cloudProfile.stats;
      const wins = Math.max(0, Number(stats.wins) || 0);
      const losses = Math.max(0, Number(stats.losses) || 0);
      const draws = Math.max(0, Number(stats.draws) || 0);
      const total = wins + losses + draws;
      return {
        rating: Math.max(100, Number(this.cloudProfile.rating) || 1200),
        wins,
        losses,
        draws,
        total,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0
      };
    }

    const s = this.playerStats || this.loadPlayerStats();
    const wins = s.ai.wins + s.online.wins;
    const losses = s.ai.losses + s.online.losses;
    const draws = s.ai.draws + s.online.draws;
    const total = wins + losses + draws;
    return {
      rating: s.rating,
      wins,
      losses,
      draws,
      total,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0
    };
  }

  renderProfileStats() {
    const totals = this.getTotalStats();
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('stat-rating', totals.rating);
    setText('stat-wins', totals.wins);
    setText('stat-losses', totals.losses);
    setText('stat-winrate', totals.winRate + '%');
    this.renderProfileTitle(totals.rating);
    this.updateProfileXP();
    document.querySelectorAll('.fantasy-rating').forEach(el => { el.textContent = 'Rating ' + totals.rating; });

    const homeRank = this.getEloTitle(totals.rating);
    const homeRankName = document.getElementById('home-rank-name');
    if (homeRankName) homeRankName.textContent = homeRank ? homeRank.name : 'Unranked';
    const homeRankRating = document.getElementById('home-rank-rating');
    if (homeRankRating) homeRankRating.textContent = totals.rating;
  }

  refreshRecapRating() {
    const ratingEl = document.getElementById('victory-meta-rating');
    if (!ratingEl || this.gameMode !== 'online') return;
    const change = Number(this.lastRatingChange) || 0;
    ratingEl.textContent = change > 0 ? '+' + change : (change < 0 ? String(change) : '+0');
    ratingEl.className = change > 0 ? 'recap-meta-value highlight-green' : 'recap-meta-value';
    ratingEl.style.color = change > 0 ? '' : (change < 0 ? '#ef4444' : '#94a3b8');
  }

  // Applies authoritative stats coming from the server (Mongo profile).
  applyServerStats(stats, gameId) {
    if (!stats) return;
    const current = this.loadPlayerStats();
    const hasRatingStart = this.ratingAtGameStart !== null &&
      this.ratingAtGameStart !== undefined &&
      Number.isFinite(Number(this.ratingAtGameStart));
    const ratingBefore = hasRatingStart
      ? Number(this.ratingAtGameStart)
      : (this.cloudProfile ? this.cloudProfile.rating : current.rating);
    const toCount = (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };
    const wins = toCount(stats.wins);
    const losses = toCount(stats.losses);
    const draws = toCount(stats.draws);
    const elo = toCount(stats.elo);

    const serverWins = wins === null ? 0 : wins;
    const serverLosses = losses === null ? 0 : losses;
    const serverDraws = draws === null ? 0 : draws;
    const explicitServerTotal = Number.isFinite(Number(stats.totalMatches))
      ? Math.max(0, Math.floor(Number(stats.totalMatches)))
      : 0;
    const serverTotal = Math.max(explicitServerTotal, serverWins + serverLosses + serverDraws);
    const cloudStats = this.cloudProfile ? this.cloudProfile.stats : null;
    const cloudTotal = cloudStats
      ? Math.max(
        Number.isFinite(Number(cloudStats.totalMatches)) ? Math.max(0, Math.floor(Number(cloudStats.totalMatches))) : 0,
        (toCount(cloudStats.wins) || 0) + (toCount(cloudStats.losses) || 0) + (toCount(cloudStats.draws) || 0)
      )
      : 0;
    const serverIsCurrent = !this.cloudProfile || serverTotal >= cloudTotal;

    if (wins !== null) current.online.wins = Math.max(current.online.wins, wins);
    if (losses !== null) current.online.losses = Math.max(current.online.losses, losses);
    if (draws !== null) current.online.draws = Math.max(current.online.draws, draws);
    if (elo !== null && elo > 0 && serverIsCurrent) current.rating = elo;
    current.hasServerStats = true;
    this.playerStats = current;
    this.savePlayerStats();

    // The server increments the synced total profile, so those values can be
    // treated as authoritative unless they would erase newer local/cloud totals.
    const canApplyCloud = this.cloudProfile && serverIsCurrent && elo !== null && elo > 0;

    if (canApplyCloud) {
      this._profileRevision += 1;
      const updated = JSON.parse(JSON.stringify(this.cloudProfile));
      updated.rating = elo;
      updated.stats.wins = serverWins;
      updated.stats.losses = serverLosses;
      updated.stats.draws = serverDraws;
      updated.stats.totalMatches = serverWins + serverLosses + serverDraws;
      if (Number.isFinite(Number(stats.winStreak))) updated.stats.winStreak = Math.max(0, Math.floor(Number(stats.winStreak)));
      if (Number.isFinite(Number(stats.bestStreak))) updated.stats.bestStreak = Math.max(0, Math.floor(Number(stats.bestStreak)));
      updated.stats.bestStreak = Math.max(updated.stats.bestStreak || 0, updated.stats.winStreak || 0);
      updated.lastUpdated = Date.now();
      updated.coins = (this.coins !== undefined && this.coins !== null && Number.isFinite(Number(this.coins)))
        ? this.coins
        : (updated.coins || 1000);
      this.cloudProfile = updated;
      this.lastServerStats = stats;
      this.lastServerStatsGameId = gameId || (this.multiplayer && this.multiplayer.gameId) || null;
      this.lastServerStatsAt = Date.now();
      if (window.ChessArenaStorage) {
        window.ChessArenaStorage.saveProfile(updated).catch(() => {});
      }
      this.applyCloudProfile(updated);
      this.queueLeaderboardSync(300);
    } else {
      // Server data is stale relative to the cloud profile (for example a DB
      // reconnect). Let the local match hook update and resync the profile.
      this.lastServerStats = null;
      this.lastServerStatsGameId = null;
      this.lastServerStatsAt = 0;
    }

    this.lastRatingChange = (canApplyCloud ? elo : current.rating) - ratingBefore;
    this.renderProfileStats();
    this.refreshRecapRating();
  }

  /**
   * Match payout: coins + XP + first-win-of-the-day bonus.
   * Called once from recordGameResult, after its idempotency guard.
   */
  awardMatchEconomy(outcome, mode, reason) {
    this.ensureDailyTracking();
    const difficulty = (this.ai && this.ai.difficulty) ? this.ai.difficulty : 'medium';
    const config = window.ECONOMY_CONFIG;
    let reward = { coins: 0, xp: 0 };

    if (config && typeof config.calculateMatchReward === 'function') {
      reward = config.calculateMatchReward(mode, difficulty, outcome, reason);
    } else if (config) {
      const isPvp = mode === 'online' || mode === 'pvp';
      if (isPvp) {
        reward.coins = Number(config.currency?.pvp?.[outcome] || 0);
        reward.xp = Number(config.progression?.pvpXp?.[outcome] || 0);
      } else if (reason === 'resignation' || reason === 'resign') {
        reward.coins = 0;
        reward.xp = 0;
      } else {
        const ai = config.currency?.ai?.[difficulty] || config.currency?.ai?.medium || {};
        reward.coins = Number(ai[outcome] || 0);
        reward.xp = Number(ai.xp?.[outcome] || ai.xp || 0);
      }
    }

    let firstWinBonus = 0;
    if (outcome === 'win' && !this.adTracking.firstWinClaimedToday) {
      firstWinBonus = Number(config?.currency?.firstWinOfDayBonus || 0);
      this.adTracking.firstWinClaimedToday = true;
      this.saveAdTracking();
    }

    const coins = Math.max(0, Number(reward.coins) || 0) + firstWinBonus;
    const xp = Math.max(0, Number(reward.xp) || 0);

    this.lastMatchCoinsEarned = coins;
    this.lastMatchDoubled = false;

    if (coins > 0) {
      this.addCoins(coins, `match_${mode}_${outcome}`);
    }
    if (xp > 0) {
      this.addXP(xp);
    }

    return { coins, xp, firstWinBonus, outcome, mode, difficulty };
  }

  // Records a finished game exactly once per game session.
  recordGameResult(result) {
    if (!result) return;
    const mode = this.gameMode === 'online' ? 'online' : 'ai';
    const gameId = (this.multiplayer && this.multiplayer.gameId) ? this.multiplayer.gameId : null;
    const sessionKey = mode + ':' + (gameId || ('local:' + (this.gameStartTime || 'unknown')));
    if (this.statsRecordedForGame === sessionKey) return;
    this.statsRecordedForGame = sessionKey;

    let outcome = 'draw';
    if (result.winner) outcome = result.winner === this.playerColor ? 'win' : 'loss';

    // Award the match economy exactly once (the session guard above prevents
    // duplicate awards when the recap screen is re-rendered/reconnected).
    this.awardMatchEconomy(outcome, mode, result.reason);

    const fallbackRating = this.loadPlayerStats().rating;
    const hasRatingStart = this.ratingAtGameStart !== null &&
      this.ratingAtGameStart !== undefined &&
      Number.isFinite(Number(this.ratingAtGameStart));
    const ratingBefore = hasRatingStart
      ? Number(this.ratingAtGameStart)
      : (this.cloudProfile ? this.cloudProfile.rating : fallbackRating);
    const opponentName = mode === 'ai'
      ? `AI (${(this.ai && this.ai.difficulty) || 'medium'})`
      : (document.getElementById('top-player-name')?.textContent || 'Opponent');

    // Cloud profile path: update the canonical profile, persist to YouTube
    // Playables cloud storage, then sync the global leaderboard rank.
    if (this.cloudProfile && window.ChessArenaStorage) {
      let authoritative = null;
      if (mode === 'online' && this.lastServerStats) {
        const sameGame = this.lastServerStatsGameId && gameId
          ? this.lastServerStatsGameId === gameId
          : (Date.now() - this.lastServerStatsAt < 20000);
        if (sameGame) authoritative = this.lastServerStats;
      }

      let ratingDelta = 0;
      if (authoritative) {
        const serverElo = Number(authoritative.elo);
        this.lastRatingChange = Number.isFinite(serverElo) ? serverElo - ratingBefore : 0;
      } else if (mode === 'online') {
        ratingDelta = outcome === 'win' ? 24 : outcome === 'loss' ? -24 : 0;
        this.lastRatingChange = ratingDelta;
      } else {
        const difficulty = (this.ai && this.ai.difficulty) || 'medium';
        const opponentRating = { easy: 800, medium: 1200, hard: 1600 }[difficulty] || 1200;
        const expected = 1 / (1 + Math.pow(10, (opponentRating - ratingBefore) / 400));
        const score = outcome === 'win' ? 1 : outcome === 'loss' ? 0 : 0.5;
        ratingDelta = Math.round(16 * (score - expected));
        this.lastRatingChange = ratingDelta;
      }
      this.refreshRecapRating();

      const revision = ++this._profileRevision;
      try {
        window.ChessArenaStorage.updateMatchStats(outcome, ratingDelta, {
          mode,
          opponent: opponentName,
          authoritative,
          ratingBefore,
          coins: this.coins
        }).then((updated) => {
          if (!updated) return;
          if (this._profileRevision !== revision) {
            // A newer authoritative server update landed while the cloud/mirror
            // write was in flight. Keep its rating/stat totals and only merge
            // the freshly recorded match history entry.
            const current = this.cloudProfile;
            if (current && Array.isArray(updated.matchHistory) &&
                updated.matchHistory.length > (current.matchHistory || []).length) {
              current.matchHistory = updated.matchHistory;
              current.coins = this.coins;
              if (window.ChessArenaStorage) {
                window.ChessArenaStorage.saveProfile(current).catch(() => {});
              }
            }
            this.refreshRecapRating();
            this.queueLeaderboardSync(200);
            return;
          }
          updated.coins = this.coins;
          this.cloudProfile = updated;
          this.applyCloudProfile(updated);
          this.lastRatingChange = updated.rating - ratingBefore;
          this.refreshRecapRating();
          this.queueLeaderboardSync(200);
        }).catch((e) => {
          console.warn('[Profile] match save failed', e);
          this.showToast('Profile save failed — your local progress is safe.');
        });
      } catch (e) {
        console.warn('[Profile] match update failed', e);
      }
      return;
    }

    // Legacy local-only fallback (storage service unavailable).
    const stats = this.loadPlayerStats();
    const bucket = stats[mode];
    if (outcome === 'win') bucket.wins += 1;
    else if (outcome === 'loss') bucket.losses += 1;
    else bucket.draws += 1;

    if (mode === 'online') {
      const k = 24;
      stats.rating = Math.max(100, stats.rating + (outcome === 'win' ? k : outcome === 'loss' ? -k : 0));
    } else {
      const difficulty = (this.ai && this.ai.difficulty) || 'medium';
      const opponentRating = { easy: 800, medium: 1200, hard: 1600 }[difficulty] || 1200;
      const expected = 1 / (1 + Math.pow(10, (opponentRating - ratingBefore) / 400));
      const score = outcome === 'win' ? 1 : outcome === 'loss' ? 0 : 0.5;
      const delta = Math.round(16 * (score - expected));
      stats.rating = Math.max(100, ratingBefore + delta);
    }

    this.lastRatingChange = stats.rating - ratingBefore;
    this.playerStats = stats;
    this.savePlayerStats();
    this.renderProfileStats();
  }

  // --- Platform identity (PlayGama / YouTube Playables) ---------------
  getPlatformProfile() {
    if (this.platformProfile) return this.platformProfile;
    const platform = window.ChessArenaPlatform;
    if (platform && typeof platform.getCached === 'function') {
      const cached = platform.getCached();
      if (cached) this.platformProfile = cached;
    }
    return this.platformProfile || null;
  }

  getPreferredDisplayName() {
    if (this.cloudProfile && this.cloudProfile.username) return String(this.cloudProfile.username);
    const profile = this.getPlatformProfile();
    const platformName = profile && profile.name ? String(profile.name).trim() : '';
    if (platformName) return platformName;
    if (this.userProfile && this.userProfile.username) return String(this.userProfile.username);
    return null;
  }

  adoptPlatformIdentity(profile) {
    if (!profile || !profile.id || this.cloudProfile || (this.userProfile && this.userProfile.username)) return;
    if (String(this.playerId || '').startsWith('usr_')) return;
    const platformId = String(profile.platform || 'platform').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'platform';
    const accountId = String(profile.id).toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 48);
    if (!accountId) return;

    const nextId = 'plat_' + platformId + '_' + accountId;
    if (nextId === this.playerId) return;

    const previousId = this.playerId;
    this.playerId = nextId;
    try {
      localStorage.setItem('chessarena_player_id', nextId);
      // Preserve local progress when moving from a generated guest ID to the
      // signed-in platform account for the first time.
      if (previousId && previousId !== nextId) {
        const oldKey = 'chessarena_stats_v1_' + String(previousId).toLowerCase();
        const newKey = 'chessarena_stats_v1_' + nextId.toLowerCase();
        const oldStats = localStorage.getItem(oldKey);
        if (oldStats && !localStorage.getItem(newKey)) localStorage.setItem(newKey, oldStats);
      }
    } catch (e) { /* ignore storage errors */ }
  }

  async applyPlatformProfile() {
    const platform = window.ChessArenaPlatform;
    if (!platform) {
      this.applyIdentityToUI(null, null, null);
      return;
    }
    const cached = typeof platform.getCached === 'function' ? platform.getCached() : null;
    if (cached) {
      this.platformProfile = cached;
      this.adoptPlatformIdentity(cached);
      this.applyIdentityToUI(cached.name, cached.avatar, cached.platformLabel);
    }
    if (!platform.whenReady) return;
    try {
      const profile = await platform.whenReady;
      if (profile) {
        this.platformProfile = profile;
        this.adoptPlatformIdentity(profile);
        this.applyIdentityToUI(profile.name, profile.avatar, profile.platformLabel);
      }
    } catch (e) { /* not on a supported platform — keep local identity */ }
  }

  applyAvatarToUI() {
    const displayAvatar = this.getSelectedAvatarSrc();
    if (!displayAvatar) return;

    const heroAvatar = document.getElementById('profile-hero-avatar');
    if (heroAvatar) heroAvatar.src = displayAvatar;
    document.querySelectorAll('.fantasy-avatar-img').forEach(img => { img.src = displayAvatar; });
    document.querySelectorAll('.nav-profile-avatar-img').forEach(img => { img.src = displayAvatar; });

    const bottomPlayerAvatar = document.getElementById('bottom-player-avatar');
    if (bottomPlayerAvatar) bottomPlayerAvatar.src = displayAvatar;
    const victoryPlayerAvatar = document.getElementById('victory-player-avatar');
    if (victoryPlayerAvatar) victoryPlayerAvatar.src = displayAvatar;
    const rouletteYouAvatar = document.getElementById('roulette-you-avatar');
    if (rouletteYouAvatar) rouletteYouAvatar.src = displayAvatar;
  }

  applyIdentityToUI(platformName, platformAvatar, platformLabel) {
    const localName = (this.userProfile && this.userProfile.username) || null;
    // The cloud/server username is authoritative once authenticated. Before
    // that, fall back to the host platform's display name.
    const displayName = localName || platformName;

    if (displayName) {
      document.querySelectorAll('.fantasy-username').forEach(el => { el.textContent = displayName; });
      document.querySelectorAll('.profile-hero-name').forEach(el => { el.textContent = displayName; });
      const bottomPlayer = document.getElementById('bottom-player-name');
      if (bottomPlayer) bottomPlayer.textContent = displayName;
      const victoryPlayer = document.getElementById('victory-player-name');
      if (victoryPlayer) victoryPlayer.textContent = displayName;
      const mainProfileName = document.getElementById('main-profile-name');
      if (mainProfileName) mainProfileName.textContent = displayName;
    }

    this.applyAvatarToUI();
  }

  syncAbilitiesUI() {
    const valid = ['jump', 'second', 'freeze', 'swap', 'shield'];
    if (!Array.isArray(this.selectedAbilities)) {
      this.selectedAbilities = ['second'];
    }
    const unlocked = this.unlockedSkills || ['second', 'jump'];
    this.selectedAbilities = this.selectedAbilities
      .map(s => s === 'undo' ? 'second' : s)
      .filter(a => valid.includes(a) && unlocked.includes(a));

    if (!this.slot2Unlocked && this.selectedAbilities.length > 1) {
      this.selectedAbilities = [this.selectedAbilities[0]];
    } else if (this.selectedAbilities.length > 2) {
      this.selectedAbilities = this.selectedAbilities.slice(0, 2);
    }

    valid.forEach(id => {
      const card = document.getElementById(`ability-card-${id}`);
      const isUnlocked = unlocked.includes(id);
      const charges = this.getSkillCharges(id);

      if (card) {
        if (this.selectedAbilities.includes(id)) {
          card.classList.add('selected');
          card.setAttribute('aria-pressed', 'true');
        } else {
          card.classList.remove('selected');
          card.setAttribute('aria-pressed', 'false');
        }
        card.classList.toggle('locked', !isUnlocked);

        // Render charges and unlock/refill controls inside card
        let badgeEl = card.querySelector('.ability-economy-badge');
        if (!badgeEl) {
          badgeEl = document.createElement('div');
          badgeEl.className = 'ability-economy-badge';
          const info = card.querySelector('.ability-info');
          if (info) info.appendChild(badgeEl);
        }

        if (isUnlocked) {
          const maxCharges = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
          const singleCost = window.ECONOMY_CONFIG?.skills?.refillSingleCost || 50;
          const packCost = window.ECONOMY_CONFIG?.skills?.refillPackCost || 120;
          const adCharges = window.ECONOMY_CONFIG?.skills?.adRefillCharges || 2;
          const canAdd1 = charges + 1 <= maxCharges;
          const canAdd3 = charges + 3 <= maxCharges;
          const canAddAd = charges + adCharges <= maxCharges;
          const note = charges >= maxCharges
            ? 'Full — use it in online PvP to free a slot.'
            : canAdd3
              ? 'All refill options fit.'
              : canAddAd
                ? 'Only +1 or the ad refill fits.'
                : `Only +1 fits before reaching ${maxCharges}/${maxCharges}.`;

          badgeEl.innerHTML = `
            <div class="ability-charge-summary">
              <span class="ability-charge-label">Skill Charges</span>
              <strong class="ability-charge-value">${charges}<span>/${maxCharges}</span></strong>
            </div>
            <div class="ability-charge-actions">
              <button class="ability-recharge-btn ability-recharge-btn--coin" ${canAdd1 ? '' : 'disabled'}
                onclick="event.stopPropagation(); app.refillSkill('${id}', 1, ${singleCost})"
                aria-label="${canAdd1 ? `Add 1 charge for ${singleCost} coins` : 'Not enough room for +1 charge'}"
                title="${canAdd1 ? `Add 1 charge for ${singleCost} coins` : 'Not enough room for +1 charge'}">+1 <span class="ability-coin-cost">${singleCost}</span></button>
              <button class="ability-recharge-btn ability-recharge-btn--coin" ${canAdd3 ? '' : 'disabled'}
                onclick="event.stopPropagation(); app.refillSkill('${id}', 3, ${packCost})"
                aria-label="${canAdd3 ? `Add 3 charges for ${packCost} coins` : 'Not enough room for +3 charges'}"
                title="${canAdd3 ? `Add 3 charges for ${packCost} coins` : 'Not enough room for +3 charges'}">+3 <span class="ability-coin-cost">${packCost}</span></button>
              <button class="ability-recharge-btn ability-recharge-btn--ad" ${canAddAd ? '' : 'disabled'}
                onclick="event.stopPropagation(); app.refillSkillViaAd('${id}')"
                title="${canAddAd ? `Watch an ad for +${adCharges} charges` : 'Not enough room for the ad refill'}">+${adCharges} <span>AD</span></button>
            </div>
            <div class="ability-charge-note">${note}</div>`;
        } else {
          const catalog = window.ECONOMY_CONFIG?.skills?.catalog || [];
          const skillItem = catalog.find(s => s.id === id);
          const reqLvl = skillItem?.reqLevel || 1;
          const cost = skillItem?.cost || 500;
          badgeEl.innerHTML = `<span class="ability-lock-label">Level ${reqLvl}</span>
            <button class="ability-unlock-btn" onclick="event.stopPropagation(); app.promptUnlockSkill('${id}')">Unlock · ${cost.toLocaleString()}</button>`;
        }
      }

      const medallion = document.getElementById(`preview-medallion-${id}`);
      if (medallion) {
        if (this.selectedAbilities.includes(id)) {
          medallion.style.opacity = '1';
          medallion.style.borderColor = '#FFD54F';
          medallion.style.boxShadow = '0 0 12px rgba(255, 213, 79, 0.7)';
          medallion.style.transform = 'scale(1.1)';
        } else {
          medallion.style.opacity = isUnlocked ? '0.5' : '0.2';
          medallion.style.borderColor = '#5A351C';
          medallion.style.boxShadow = 'none';
          medallion.style.transform = 'scale(1)';
        }
      }
    });

    try {
      localStorage.setItem('owl_selected_abilities', JSON.stringify(this.selectedAbilities));
      localStorage.setItem('chessarena_abilities', JSON.stringify(this.selectedAbilities));
    } catch (e) { /* ignore */ }

    this.syncSlotUI();
    this.updateHomeAbilitiesDisplay();
  }

  showAbilitiesScreen() {
    try {
      let saved = JSON.parse(localStorage.getItem('owl_selected_abilities') || 'null');
      if (!Array.isArray(saved) || saved.length === 0) {
        saved = JSON.parse(localStorage.getItem('chessarena_abilities') || 'null');
      }
      if (Array.isArray(saved) && saved.length > 0) {
        this.selectedAbilities = [...saved];
      }
    } catch(e) {}
    this.syncAbilitiesUI();
    this.showScreen('screen-abilities');
  }

  toggleAbility(abilityId) {
    const valid = ['jump', 'second', 'freeze', 'swap', 'shield'];
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (!valid.includes(id)) return;

    const unlocked = this.unlockedSkills || ['second', 'jump'];
    if (!unlocked.includes(id)) {
      this.promptUnlockSkill(id);
      return;
    }

    if (!Array.isArray(this.selectedAbilities)) {
      this.selectedAbilities = [];
    }

    const idx = this.selectedAbilities.indexOf(id);
    if (idx !== -1) {
      // Deselect
      this.selectedAbilities.splice(idx, 1);
    } else {
      const maxSlots = this.slot2Unlocked ? 2 : 1;
      if (this.selectedAbilities.length >= maxSlots) {
        if (!this.slot2Unlocked) {
          // Only Slot 1 is available: swap its skill instead of interrupting with an ad.
          this.selectedAbilities = [id];
        } else {
          // Replace the oldest equipped skill.
          this.selectedAbilities.shift();
        }
      }
      if (!this.selectedAbilities.includes(id)) {
        this.selectedAbilities.push(id);
      }
    }

    try {
      localStorage.setItem('owl_selected_abilities', JSON.stringify(this.selectedAbilities));
      localStorage.setItem('chessarena_abilities', JSON.stringify(this.selectedAbilities));
    } catch (e) {}

    this.syncAbilitiesUI();
  }

  
    updateHomeAbilitiesDisplay() {
    const container = document.getElementById('home-selected-abilities');
    if (!container) return;
    
    const iconMap = {
      'swap': '/assets/Asset 42.png',
      'freeze': '/assets/Asset 43.png',
      'second': '/assets/Asset 44.png',
      'shield': '/assets/Asset 45.png',
      'jump': '/assets/Asset 46.png'
    };

    const emojiMap = {
      'swap': '🔄', 'freeze': '❄️', 'second': '⏪', 'shield': '🛡️', 'jump': '🪽'
    };
    let html = '';
    const abilities = this.selectedAbilities || ['second'];
    abilities.forEach(ab => {
      if (iconMap[ab]) {
        html += `<div style="width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #C99700; background: #2A170B; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"><img src="${iconMap[ab]}" style="width: 17px; height: 17px; object-fit: contain;"></div>`;
      } else if (emojiMap[ab]) {
        html += `<div style="width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #C99700; background: #2A170B; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">${emojiMap[ab]}</div>`;
      }
    });
    container.innerHTML = html;
  }

  confirmAbilities() {
    const minRequired = 1;
    if (!this.selectedAbilities || this.selectedAbilities.length < minRequired) {
      this.showToast('Please select at least 1 ability to continue!');
      return;
    }
    try {
      localStorage.setItem('owl_selected_abilities', JSON.stringify(this.selectedAbilities));
      localStorage.setItem('chessarena_abilities', JSON.stringify(this.selectedAbilities));
    } catch(e) {}
    this.updateHomeAbilitiesDisplay();
    this.showToast('Loadout saved! Abilities equipped for battle ⚔️');
    this.goHome();
  }

  showMatchmakingScreen(mode = 'matchmaking') {
    this.updateBottomNav('play');
    this.showScreen('screen-matchmaking');
    this.updateRoulettePlayerAvatar();
    

    const estWait = document.getElementById('matchmaking-wait-time');
    if (estWait) estWait.textContent = '~ 15 seconds';

    // Clear any previous auto-match timeout
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
  }

  cancelMatchmaking() {
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.goHome();
  }

  // --- Controls --------------------------------------

  confirmResign() {
    this.showConfirm('Resign?', 'Are you sure you want to resign?', () => {
      if (this.gameMode === 'online') {
        this.multiplayer.resign();
      } else {
        const winner = this.playerColor === 'white' ? 'black' : 'white';
        this.engine.gameOver = true;
        this.engine.gameResult = { winner, reason: 'resignation' };
        this.playSound('gameover');
        this.showGameOver();
      }
    });
  }

  offerDraw() {
    if (this.gameMode !== 'online') {
      this.showToast('Draw offers are for online games');
      return;
    }
    this.showConfirm('Offer Draw?', 'Offer a draw to your opponent?', () => {
      this.multiplayer.offerDraw();
      this.showToast('Draw offered');
    });
  }

  acceptDraw() {
    this.hideModal('modal-draw-offer');
    if (this.multiplayer) this.multiplayer.acceptDraw();
  }

  declineDraw() {
    this.hideModal('modal-draw-offer');
    if (this.multiplayer) this.multiplayer.declineDraw();
    this.showToast('Draw declined');
  }

  requestRematch() {
    if (this.gameMode === 'online' && this.multiplayer) {
      this.multiplayer.requestRematch();
      this.showToast('Rematch requested');
      const rematchBtn = document.getElementById('victory-btn-rematch');
      if (rematchBtn) {
        rematchBtn.disabled = true;
        rematchBtn.textContent = 'Waiting...';
      }
    }
  }

  async goHome(showPostGameAd = false) {
    if (showPostGameAd) await this.maybeShowPostGameInterstitial();
    else this.postGameBreak = false;
    // Keep background music running smoothly in home lobby
    if (this.musicEnabled && (!this.bgMusicRunning || (this.bgAudio && this.bgAudio.paused))) {
      this.startBgMusic();
    }
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.stopTimerTick();
    if (this.multiplayer) {
      this.multiplayer.disconnect();
      this.multiplayer = null;
    }
    
    // Hide all possible open modals
    this.hideModal('modal-confirm');
    this.hideModal('modal-draw-offer');
    
    this.engine = null;
    this.ai = null;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.lastMove = null;

    // Reset UI buttons safely
    try {
      const resignBtn = document.getElementById('btn-ingame-resign');
      if (resignBtn) resignBtn.classList.remove('hidden');
      const drawBtn = document.getElementById('btn-ingame-draw');
      if (drawBtn) drawBtn.classList.remove('hidden');

      // Hide connection status banner
      const connStatus = document.getElementById('connection-status');
      if (connStatus) connStatus.classList.add('hidden');
    } catch (e) {
      console.warn('goHome cleanup error:', e);
    }

    this.syncAbilitiesUI();
    this.isMyTurn = false;
    this.updateBottomNav('home');
    this.showScreen('screen-home');
  }

  // --- Connection Status -----------------------------

  showConnectionStatus(status, forfeitInMs) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    this.stopOpponentDisconnectCountdown();
    el.classList.remove('hidden', 'connected', 'reconnecting', 'disconnected');
    el.classList.add(status);

    const textEl = el.querySelector('.status-text');
    if (!textEl) return;
    if (status === 'reconnecting') {
      textEl.textContent = 'Reconnecting...';
    } else if (status === 'disconnected' && Number(forfeitInMs) > 0) {
      this.startOpponentDisconnectCountdown(Number(forfeitInMs), textEl);
    } else if (status === 'disconnected') {
      textEl.textContent = 'Connection lost';
    } else {
      textEl.textContent = 'Connected';
    }
  }

  startOpponentDisconnectCountdown(ms, textEl) {
    let remaining = Math.ceil(ms / 1000);
    const render = () => {
      textEl.textContent = remaining > 0
        ? `Opponent disconnected - forfeit in ${remaining}s`
        : 'Opponent disconnected - finishing...';
      remaining -= 1;
    };

    render();
    this.opponentDisconnectInterval = setInterval(() => {
      if (remaining < 0) {
        this.stopOpponentDisconnectCountdown();
        return;
      }
      render();
    }, 1000);
  }

  stopOpponentDisconnectCountdown() {
    if (this.opponentDisconnectInterval) {
      clearInterval(this.opponentDisconnectInterval);
      this.opponentDisconnectInterval = null;
    }
  }

  hideConnectionStatus() {
    this.stopOpponentDisconnectCountdown();
    const el = document.getElementById('connection-status');
    if (el) el.classList.add('hidden');
  }

  // --- Modals ----------------------------------------

  renderAvatarPicker() {
    const grid = document.getElementById('avatar-picker-grid');
    if (!grid) return;

    grid.innerHTML = PLAYER_AVATARS.map((avatar) => {
      const selected = avatar.id === this.avatarId;
      return `<button type="button" class="avatar-choice${selected ? ' selected' : ''}"
        onclick="app.selectAvatar('${avatar.id}')"
        aria-label="Use ${avatar.label}"
        aria-pressed="${selected ? 'true' : 'false'}"
        title="${avatar.label}">
        <img src="${avatar.src}" alt="${avatar.label}" loading="lazy" draggable="false">
        <span class="avatar-choice-check" aria-hidden="true">&#10003;</span>
      </button>`;
    }).join('');
  }

  openAvatarPicker() {
    this.renderAvatarPicker();
    this.showModal('modal-avatar-picker');
    setTimeout(() => {
      const selected = document.querySelector('#avatar-picker-grid .avatar-choice.selected');
      if (selected) selected.focus({ preventScroll: true });
    }, 30);
  }

  selectAvatar(avatarId) {
    const normalized = this.normalizeAvatarId(avatarId);
    if (!normalized) return;

    this.avatarId = normalized;
    this.avatarIdFromStorage = true;
    this.persistAvatarId();
    this.applyAvatarToUI();
    this.saveEconomyState();
    this.hideModal('modal-avatar-picker');
    this.showToast('Avatar updated');

    const trigger = document.getElementById('profile-avatar-edit-btn');
    if (trigger) trigger.focus({ preventScroll: true });
  }

  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      if (id === 'modal-settings') this.syncSettingsUI();
    }
  }

  syncSettingsUI() {
    const soundOn = !this.soundMuted;
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.classList.toggle('is-on', soundOn);
      soundBtn.setAttribute('aria-checked', String(soundOn));
      soundBtn.setAttribute('aria-label', `Sound effects ${soundOn ? 'on' : 'off'}`);
      const soundLabel = soundBtn.querySelector('.setting-switch-label');
      if (soundLabel) soundLabel.textContent = soundOn ? 'On' : 'Off';
    }

    const musicOn = Boolean(this.musicEnabled);
    const musicBtn = document.getElementById('btn-toggle-music');
    if (musicBtn) {
      musicBtn.classList.toggle('is-on', musicOn);
      musicBtn.setAttribute('aria-checked', String(musicOn));
      musicBtn.setAttribute('aria-label', `Background music ${musicOn ? 'on' : 'off'}`);
      const musicLabel = musicBtn.querySelector('.setting-switch-label');
      if (musicLabel) musicLabel.textContent = musicOn ? 'On' : 'Off';
    }

    const volumeSlider = document.getElementById('input-music-volume');
    const volumeLabel = document.getElementById('music-volume-label');
    const currentVol = (typeof this.musicVolume === 'number') ? this.musicVolume : 0.25;
    const volPct = Math.round(currentVol * 100);
    if (volumeSlider) {
      volumeSlider.value = volPct;
      volumeSlider.disabled = !musicOn;
      volumeSlider.style.opacity = musicOn ? '1' : '0.4';
    }
    if (volumeLabel) {
      volumeLabel.textContent = musicOn ? `${volPct}%` : 'Muted';
      volumeLabel.style.color = musicOn ? '#FFD54F' : '#8C6538';
    }
  }

  toggleSound() {
    this.soundMuted = !this.soundMuted;
    if (this.soundMuted) this.stopCheckSound(0.25);
    this.syncSettingsUI();
    this.saveEconomyState();
    this.showToast(this.soundMuted ? 'Sound effects muted' : 'Sound effects enabled');
  }

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  }

  showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const yesBtn = document.getElementById('confirm-yes');
    yesBtn.onclick = () => {
      this.hideModal('modal-confirm');
      onConfirm();
    };
    this.showModal('modal-confirm');
  }

  // --- Toast -----------------------------------------

  
  handleAuthRequireUsername(playerId, forceEdit = false) {
    // An existing cloud profile already has a name. Legacy server rows that
    // still lack a username can be repaired silently instead of prompting the
    // player again. The pencil button passes forceEdit=true.
    if (!forceEdit && this.cloudProfile && this.cloudProfile.username &&
        window.ChessArenaStorage && window.ChessArenaStorage.isValidUsername(this.cloudProfile.username)) {
      this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'auth-require' }).then(() => {
        if (this.multiplayer && this.multiplayer.isConnected && this.cloudProfile) {
          this.multiplayer.send({
            type: 'set_username',
            playerId: this.cloudProfile.playerId,
            username: this.cloudProfile.username
          });
        }
      });
      return;
    }

    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input');
    const btn = document.getElementById('btn-submit-username');
    const cancelBtn = document.getElementById('btn-cancel-username');
    const title = document.getElementById('username-modal-title');
    const subtitle = document.getElementById('username-modal-subtitle');
    if (!modal || !input || !btn) {
      this.showToast('Profile editing is unavailable right now.');
      return;
    }

    const storage = window.ChessArenaStorage;
    this.onboardingPending = false;
    this.pendingProfileDraft = null;
    this.attachUsernameSanitizer(input);
    title.textContent = 'Edit Player Name';
    subtitle.textContent = 'This is the name other players see on the leaderboard.';
    input.value = (this.cloudProfile && this.cloudProfile.username) ||
      (this.userProfile && this.userProfile.username) || '';
    if (cancelBtn) cancelBtn.style.display = 'block';
    btn.textContent = 'Save';
    btn.disabled = false;
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 120);

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.classList.add('hidden');
      };
    }
    input.onkeydown = (event) => {
      if (event.key === 'Enter') btn.click();
    };

    btn.onclick = async () => {
      const username = storage && storage.sanitizeUsername
        ? storage.sanitizeUsername(input.value)
        : String(input.value || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
      if (!storage || !storage.isValidUsername || !storage.isValidUsername(username)) {
        this.showToast('Name must be 3-16 letters or numbers.');
        input.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        if (storage) {
          const base = this.cloudProfile || storage.createDraftProfile();
          const profile = await storage.createProfile(username, { __draft: base });
          this.applyCloudProfile(profile);
          modal.classList.add('hidden');
          this.syncLeaderboardProfile(profile, { reason: 'rename' });
          if (this.multiplayer && this.multiplayer.isConnected) {
            this.multiplayer.send({
              type: 'set_username',
              playerId: profile.playerId,
              username: profile.username
            });
          }
        } else {
          // Legacy fallback if storage-service.js is unavailable.
          if (!this.multiplayer) {
            this.multiplayer = new MultiplayerClient();
            this.setupMultiplayerCallbacks();
          }
          if (!this.multiplayer.isConnected) await this.multiplayer.connect();
          this.multiplayer.send({ type: 'set_username', playerId: playerId || this.playerId, username });
          modal.classList.add('hidden');
        }
      } catch (e) {
        console.warn('[Profile] rename failed', e);
        this.showToast('Could not save your name. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Save';
      }
    };
  }

  handleAuthSuccess(user, created) {
    const cloud = this.cloudProfile;
    const previousKey = this.statsStorageKey();
    const previousName = this.userProfile && this.userProfile.username;
    const displayName = (cloud && cloud.username) || (user && user.username) || 'Player';

    this.userProfile = Object.assign({}, user || {}, {
      playerId: cloud ? cloud.playerId : (user && user.playerId),
      username: displayName,
      elo: cloud ? cloud.rating : (user && user.elo),
      wins: cloud ? cloud.stats.wins : (user && user.wins),
      losses: cloud ? cloud.stats.losses : (user && user.losses),
      draws: cloud ? cloud.stats.draws : (user && user.draws)
    });

    const nameChanged = previousName && previousName !== displayName;
    this.showToast(created || nameChanged ? `Playing as ${displayName}` : `Welcome back, ${displayName}!`);

    const newKey = this.statsStorageKey();
    if (previousKey !== newKey) {
      try {
        const guestStats = localStorage.getItem(previousKey);
        if (guestStats && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, guestStats);
        }
      } catch (e) { /* ignore storage errors */ }
    }

    if (cloud) {
      // The cloud profile is canonical; the server will be brought in line by
      // the sync request below instead of overwriting newer local progress.
      this.applyCloudProfile(cloud);
      this.syncLeaderboardProfile(cloud, { silent: true, reason: 'auth' });
    } else {
      if (user && user.playerId) {
        this.playerId = user.playerId;
        try { localStorage.setItem('chessarena_player_id', this.playerId); } catch (e) { /* ignore */ }
      }
      this.loadPlayerStats();
      this.renderProfileStats();
      this.applyIdentityToUI();
    }
  }

  sendEmote(text) {
    if (!text) return;
    if (this.gameMode === 'online' && this.multiplayer && (this.multiplayer.isConnected || (this.multiplayer.ws && this.multiplayer.ws.readyState === 1))) {
      this.multiplayer.sendChatMessage(text);
    } else {
      this.displayLocalChatMessage(this.playerColor || 'white', 'You', text);
    }
    this.showToast(text);
  }

  displayLocalChatMessage(sender, senderName, text) {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'chat-message';
      const senderSpan = document.createElement('span');
      senderSpan.className = `chat-sender ${sender}`;
      senderSpan.textContent = `${senderName}: `;
      const textSpan = document.createElement('span');
      textSpan.className = 'chat-text';
      textSpan.textContent = text;
      msgDiv.appendChild(senderSpan);
      msgDiv.appendChild(textSpan);
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  toggleCoords() {
    this.showCoords = this.showCoords === false ? true : false;
    const labels = document.querySelectorAll('.coord-label');
    labels.forEach(l => l.style.display = this.showCoords ? '' : 'none');
    const btn = document.getElementById('btn-toggle-coords');
    if (btn) btn.textContent = this.showCoords ? '🧭 Coords: On' : '🧭 Coords: Off';
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }


  equipCosmetic(type, id) {
    if (type !== 'board') return;
    document.body.dataset.boardTheme = id;
    try {
      localStorage.setItem('chessarena_board_theme', id);
      localStorage.setItem('owl_board_theme', id);
    } catch (e) { /* ignore */ }
    if (this.cloudProfile) {
      this.cloudProfile.equipped = Object.assign({}, this.cloudProfile.equipped || {}, { board: id });
      this.cloudProfile.lastUpdated = Date.now();
      if (window.ChessArenaStorage) {
        window.ChessArenaStorage.saveProfile(this.cloudProfile).catch(() => {});
      }
    }
    this.showToast('Equipped ' + id.replace('-', ' ') + ' board!');
    const boardPane = document.getElementById('shop-pane-boards');
    if (!boardPane) return;
    boardPane.querySelectorAll('.shop-item-card').forEach(card => {
      const btn = card.querySelector('.btn-shop-action');
      if (card.dataset.id === id) {
        card.classList.add('equipped');
        if (btn) { btn.classList.add('equipped'); btn.textContent = 'Equipped'; }
      } else {
        card.classList.remove('equipped');
        if (btn && btn.classList.contains('equipped')) {
          btn.classList.remove('equipped');
          btn.textContent = 'Equip';
        }
      }
    });
  }

  showShopScreen() {
    this.updateBottomNav('shop');
    this.showScreen('screen-shop');
    this.syncShopUI();
  }
  async showLeaderboardScreen() {
    this.updateBottomNav('rankings');
    this.showScreen('screen-leaderboard');
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    list.innerHTML = '<p style="color: #D6BD9B; text-align: center; margin: 24px 0;">Loading rankings…</p>';
    this.renderLeaderboardMyRank();

    if (this.cloudProfile && this.cloudProfile.username) {
      this.syncLeaderboardProfile(this.cloudProfile, { silent: true, reason: 'view' });
    }
    await this.loadLeaderboardData();
  }

  async loadLeaderboardData() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    try {
      const response = await fetch('/api/leaderboard', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      const players = Array.isArray(data.players) ? data.players : [];
      this.renderLeaderboardData(players, Number(data.totalPlayers) || players.length);
    } catch (e) {
      list.innerHTML = '<p style="color: #D6BD9B; text-align: center; margin: 24px 0;">Rankings are unavailable right now.</p>';
      this.renderLeaderboardMyRank();
    }
  }

  renderLeaderboardData(players, totalPlayers) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    this.leaderboardTopPlayers = Array.isArray(players) ? players : [];
    this.leaderboardTotalPlayers = Math.max(0, Number(totalPlayers) || this.leaderboardTopPlayers.length);

    if (this.leaderboardTopPlayers.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 36px 18px; color: #D6BD9B;">' +
        '<div style="font-size: 34px; margin-bottom: 10px;">♟️</div>' +
        '<p style="margin: 0 0 6px; color: #FDF7EC; font-weight: 700;">No ranked players yet</p>' +
        '<p style="margin: 0; font-size: 13px;">Play a match to claim the first spot.</p></div>';
      this.renderLeaderboardMyRank();
      return;
    }

    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

    const visiblePlayers = this.leaderboardTopPlayers.filter(
      (player) => !this.isOwnLeaderboardPlayer(player)
    );
    if (visiblePlayers.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 36px 18px; color: #D6BD9B;">' +
        '<div style="font-size: 34px; margin-bottom: 10px;">&#9822;</div>' +
        '<p style="margin: 0 0 6px; color: #FDF7EC; font-weight: 700;">You are the only ranked player</p>' +
        '<p style="margin: 0; font-size: 13px;">Your rank is pinned above the navigation.</p></div>';
      this.renderLeaderboardMyRank();
      return;
    }

    const myId = this.cloudProfile && this.cloudProfile.playerId;
    list.innerHTML = visiblePlayers.map((player, i) => {
      const rank = Number(player.rank) > 0 ? Math.floor(Number(player.rank)) : i + 1;
      const medal = ['🥇', '🥈', '🥉'][rank - 1] || '';
      let rankTierClass = '';
      if (rank === 1) rankTierClass = 'rank-gold rank-top-1';
      else if (rank === 2) rankTierClass = 'rank-silver rank-top-2';
      else if (rank === 3) rankTierClass = 'rank-bronze rank-top-3';

      const rankNumColor = rank === 1 ? '#20120B' : rank === 2 ? '#151B26' : rank === 3 ? '#200E05' : '#C99700';
      const name = escapeHtml(player.username || 'Player');
      const rating = Number(player.rating != null ? player.rating : player.elo) || 1200;
      const wins = Number(player.wins) || 0;
      const losses = Number(player.losses) || 0;
      const titleBadge = this.getEloTitleBadgeHtml(rating);
      const isMe = myId && player.playerId === myId;
      const border = isMe ? '2px solid #E9D5FF' : (rank > 3 ? '1.5px solid #8C6538' : '');
      const youTag = isMe
        ? '<span style="font-size:10px; color:#FFFFFF; background:#8728E6; border-radius:9999px; padding:1px 6px; font-weight:800;">YOU</span>'
        : '';
      const cardStyle = rank > 3
        ? `background: linear-gradient(180deg, #4A2E1B 0%, #2A170C 100%); border: ${border}; border-radius: 12px; padding: 12px 18px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(32, 18, 11, 0.15); display: flex; align-items: center; justify-content: space-between;`
        : `margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;`;

      return `<div class="ranking-card ${rankTierClass}" style="${cardStyle}">
        <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
          <div class="ranking-num" style="font-family: 'Georgia', serif; font-size: 20px; font-weight: 800; width: 32px; text-align: center; color: ${rankNumColor};">${rank}</div>
          <div style="display: flex; flex-direction: column;">
            <div class="ranking-name" style="font-family: 'Georgia', serif; font-weight: 700; color: #FDF7EC; font-size: 16px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">${name}${titleBadge}${youTag}</div>
            <div class="ranking-meta" style="font-size: 13px; color: #D6BD9B; font-weight: 600; margin-top: 2px;">Rating: <span class="ranking-rating-val" style="color: #FFD54F; font-weight: 800;">${rating}</span> · ${wins}W / ${losses}L</div>
          </div>
        </div>
        <div class="ranking-medal" style="font-size: 22px; filter: none;">${medal}</div>
      </div>`;
    }).join('');
    this.renderLeaderboardMyRank();
  }


  // --- Economy & Monetization Engine ---
  getEconomyDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  createDefaultAdTracking(lastWheelDate = null, lastChargeRefillDate = null) {
    return {
      date: this.getEconomyDateKey(),
      dailyAdsWatched: 0,
      dailyDoublersUsed: 0,
      firstAdClaimed: false,
      firstWinClaimedToday: false,
      lastWheelDate: lastWheelDate || null,
      wheelSpinsToday: 0,
      lastChargeRefillDate: lastChargeRefillDate || null
    };
  }

  /**
   * Roll the ad/wheel counters over at midnight. This is also called before
   * every reward so an app left open overnight cannot keep yesterday's caps.
   */
  ensureDailyTracking() {
    const today = this.getEconomyDateKey();
    if (!this.adTracking || typeof this.adTracking !== 'object') {
      this.adTracking = this.createDefaultAdTracking();
      this.saveAdTracking();
      return true;
    }

    if (this.adTracking.date !== today) {
      this.adTracking = this.createDefaultAdTracking(
        this.adTracking.lastWheelDate || null,
        this.adTracking.lastChargeRefillDate || null
      );
      this.saveAdTracking();
      return true;
    }

    // Repair old/partial tracking objects without changing today's counters.
    this.adTracking.dailyAdsWatched = Math.max(0, parseInt(this.adTracking.dailyAdsWatched, 10) || 0);
    this.adTracking.dailyDoublersUsed = Math.max(0, parseInt(this.adTracking.dailyDoublersUsed, 10) || 0);
    this.adTracking.wheelSpinsToday = Math.max(0, parseInt(this.adTracking.wheelSpinsToday, 10) || 0);
    this.adTracking.firstAdClaimed = this.adTracking.firstAdClaimed === true;
    this.adTracking.firstWinClaimedToday = this.adTracking.firstWinClaimedToday === true;
    if (this.adTracking.lastWheelDate === undefined) this.adTracking.lastWheelDate = null;
    if (this.adTracking.lastChargeRefillDate === undefined) this.adTracking.lastChargeRefillDate = null;
    return false;
  }

  saveEconomyState() {
    try {
      if (this.coins !== null && Number.isFinite(Number(this.coins))) { localStorage.setItem('chessarena_coins', String(this.coins)); }
      localStorage.setItem('chessarena_avatar_id', this.avatarId);
      localStorage.setItem('owl_player_level', String(this.playerLevel));
      localStorage.setItem('owl_player_xp', String(this.playerXP));
      localStorage.setItem('owl_slot2_unlocked', this.slot2Unlocked ? 'true' : 'false');
      localStorage.setItem('owl_slot2_ads', String(this.slot2AdsWatched));
      localStorage.setItem('owl_unlocked_skills', JSON.stringify(this.unlockedSkills));
      localStorage.setItem('owl_skill_charges', JSON.stringify(this.skillCharges));
      localStorage.setItem('owl_unlocked_boards', JSON.stringify(this.unlockedBoards));
      localStorage.setItem('owl_selected_abilities', JSON.stringify(this.selectedAbilities));
      localStorage.setItem('chessarena_abilities', JSON.stringify(this.selectedAbilities));
      localStorage.setItem('owl_ad_tracking', JSON.stringify(this.adTracking));
      localStorage.setItem('owl_settings', JSON.stringify({
        soundMuted: this.soundMuted,
        musicEnabled: this.musicEnabled
      }));
    } catch (e) { /* localStorage may be unavailable; in-memory state still works */ }

    if (this.economyPersistenceReady) this.scheduleEconomyPersist();
  }

  buildEconomySnapshot() {
    return {
      version: 1,
      updatedAt: Date.now(),
      avatarId: this.avatarId,
      level: Math.max(1, Math.floor(Number(this.playerLevel) || 1)),
      xp: Math.max(0, Math.floor(Number(this.playerXP) || 0)),
      slot2Unlocked: this.slot2Unlocked === true,
      slot2AdsWatched: Math.max(0, Math.min(3, Math.floor(Number(this.slot2AdsWatched) || 0))),
      unlockedSkills: Array.isArray(this.unlockedSkills) ? this.unlockedSkills.slice(0, 12) : [],
      skillCharges: Object.assign({}, this.skillCharges),
      unlockedBoards: Array.isArray(this.unlockedBoards) ? this.unlockedBoards.slice(0, 32) : [],
      selectedAbilities: Array.isArray(this.selectedAbilities) ? this.selectedAbilities.slice(0, 2) : [],
      adTracking: Object.assign({}, this.adTracking),
      stats: this.playerStats ? JSON.parse(JSON.stringify(this.playerStats)) : null,
      settings: {
        soundMuted: this.soundMuted === true,
        musicEnabled: this.musicEnabled !== false
      }
    };
  }

  scheduleEconomyPersist() {
    if (this._economyPersistTimer) return;
    this._economyPersistTimer = setTimeout(() => {
      this._economyPersistTimer = null;
      this.persistEconomyProgress();
    }, 350);
  }

  async persistEconomyProgress() {
    const storage = window.ChessArenaStorage;
    if (!storage || typeof storage.saveValue !== 'function') return false;
    try {
      return await storage.saveValue(
        this.economyStorageKey,
        JSON.stringify(this.buildEconomySnapshot())
      );
    } catch (e) {
      console.warn('[Progress] save failed', e);
      return false;
    }
  }

  async loadEconomyProgress() {
    const storage = window.ChessArenaStorage;
    if (!storage || typeof storage.loadValue !== 'function') return false;
    let raw = null;
    try { raw = await storage.loadValue(this.economyStorageKey); }
    catch (e) { return false; }
    if (raw == null) return false;

    let data = raw;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { return false; }
    }
    if (!data || typeof data !== 'object') return false;

    const validSkills = ['jump', 'second', 'freeze', 'swap', 'shield'];
    const maxCharges = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
    const validBoards = (window.ECONOMY_CONFIG?.boards || []).map((b) => b.id);

    const savedAvatarId = this.normalizeAvatarId(data.avatarId);
    if (savedAvatarId && !this.avatarIdFromStorage) {
      this.avatarId = savedAvatarId;
      this.avatarIdFromStorage = true;
      this.persistAvatarId();
    }

    const level = parseInt(data.level, 10);
    if (Number.isFinite(level) && level > 0) this.playerLevel = Math.min(100, level);
    const xp = parseInt(data.xp, 10);
    if (Number.isFinite(xp) && xp >= 0) this.playerXP = xp;
    this.slot2AdsWatched = Math.max(0, Math.min(3, parseInt(data.slot2AdsWatched, 10) || 0));
    this.slot2Unlocked = data.slot2Unlocked === true || this.slot2AdsWatched >= 3;

    if (Array.isArray(data.unlockedSkills) && data.unlockedSkills.length > 0) {
      this.unlockedSkills = [...new Set(data.unlockedSkills.map((s) => s === 'undo' ? 'second' : s))]
        .filter((s) => validSkills.includes(s));
    }
    if (!this.unlockedSkills || this.unlockedSkills.length === 0) {
      this.unlockedSkills = ['second', 'jump'];
    }

    if (data.skillCharges && typeof data.skillCharges === 'object') {
      const next = {};
      validSkills.forEach((id) => {
        const value = parseInt(data.skillCharges[id], 10);
        next[id] = Number.isFinite(value) ? Math.max(0, Math.min(maxCharges, value)) : 3;
      });
      this.skillCharges = next;
    }

    if (Array.isArray(data.unlockedBoards)) {
      this.unlockedBoards = [...new Set(data.unlockedBoards)].filter((id) => validBoards.includes(id));
    }
    if (!this.unlockedBoards.includes('classic-oak')) this.unlockedBoards.unshift('classic-oak');

    if (Array.isArray(data.selectedAbilities)) {
      const selected = data.selectedAbilities
        .map((s) => s === 'undo' ? 'second' : s)
        .filter((s) => validSkills.includes(s) && this.unlockedSkills.includes(s));
      this.selectedAbilities = this.slot2Unlocked ? selected.slice(0, 2) : selected.slice(0, 1);
    }
    if (!Array.isArray(this.selectedAbilities) || this.selectedAbilities.length === 0) {
      this.selectedAbilities = [this.unlockedSkills[0] || 'second'];
    }

    if (data.adTracking && typeof data.adTracking === 'object') {
      this.adTracking = Object.assign(this.createDefaultAdTracking(), data.adTracking);
    }
    if (data.stats && typeof data.stats === 'object') {
      const count = (value) => Math.max(0, Math.floor(Number(value) || 0));
      this.playerStats = {
        rating: Math.max(100, Math.floor(Number(data.stats.rating) || 1200)),
        ai: {
          wins: count(data.stats.ai && data.stats.ai.wins),
          losses: count(data.stats.ai && data.stats.ai.losses),
          draws: count(data.stats.ai && data.stats.ai.draws)
        },
        online: {
          wins: count(data.stats.online && data.stats.online.wins),
          losses: count(data.stats.online && data.stats.online.losses),
          draws: count(data.stats.online && data.stats.online.draws)
        },
        hasServerStats: data.stats.hasServerStats === true
      };
      this.savePlayerStats();
      this.renderProfileStats();
    }
    if (data.settings && typeof data.settings === 'object') {
      this.soundMuted = data.settings.soundMuted === true;
      this.musicEnabled = data.settings.musicEnabled !== false;
    }

    // Update local mirrors/UI. Cloud progress is now the source of truth for
    // progression; coins remain in the profile record.
    this.saveEconomyState();
    this.applyAvatarToUI();
    this.updateCoinsDisplay();
    this.syncAbilitiesUI();
    this.syncShopUI();
    this.syncSettingsUI();
    this.updateLuckyWheelBadge();
    return true;
  }

  initEconomy() {
    try {
      const startingCoins = window.ECONOMY_CONFIG?.currency?.startingCoins || 1000;
      const cloudCoins = this.cloudProfile && Number.isFinite(Number(this.cloudProfile.coins))
        ? Math.max(0, Math.floor(Number(this.cloudProfile.coins)))
        : null;
      let localCoins = NaN;
      try {
        const raw = localStorage.getItem('chessarena_coins');
        const oldKeyRaw = localStorage.getItem('owl_coins');
        if (raw !== null) {
          localCoins = parseInt(raw, 10);
        } else if (oldKeyRaw !== null) {
          // One-time migration from the removed legacy key, then delete it.
          localCoins = parseInt(oldKeyRaw, 10);
          if (Number.isFinite(localCoins)) {
            localStorage.setItem('chessarena_coins', String(localCoins));
          }
        }
        if (oldKeyRaw !== null) localStorage.removeItem('owl_coins');
      } catch (e) { /* ignore */ }
      if (!Number.isFinite(localCoins) || localCoins < 0) localCoins = startingCoins;
      let activeCoins;
      // Priority 1: Cloud/Account Profile (Authoritative source on YouTube Playables / logged-in accounts)
      if (cloudCoins !== null) {
        activeCoins = cloudCoins;
      // Priority 2: In-memory live balance (if session already has active coins)
      } else if (this.coins !== null && Number.isFinite(Number(this.coins)) && this.coins >= 0) {
        activeCoins = Math.floor(Number(this.coins));
      // Priority 3: Local mirror fallback (offline cache)
      } else if (Number.isFinite(localCoins) && localCoins >= 0) {
        activeCoins = localCoins;
      // Priority 4: Initial starting balance
      } else {
        activeCoins = startingCoins;
      }
      this.coins = activeCoins;
      try { localStorage.setItem('chessarena_coins', String(activeCoins)); } catch (e) {}
      if (this.cloudProfile) this.cloudProfile.coins = activeCoins;

      const parsedLevel = parseInt(localStorage.getItem('owl_player_level'), 10);
      this.playerLevel = Number.isFinite(parsedLevel) && parsedLevel > 0 ? parsedLevel : 1;
      const parsedXp = parseInt(localStorage.getItem('owl_player_xp'), 10);
      this.playerXP = Number.isFinite(parsedXp) && parsedXp > 0 ? parsedXp : 0;
      this.slot2Unlocked = localStorage.getItem('owl_slot2_unlocked') === 'true';
      this.slot2AdsWatched = Math.max(0, Math.min(3, parseInt(localStorage.getItem('owl_slot2_ads'), 10) || 0));
      if (this.slot2AdsWatched >= 3) this.slot2Unlocked = true;

      const validSkills = ['jump', 'second', 'freeze', 'swap', 'shield'];
      let savedSkills = null;
      try { savedSkills = JSON.parse(localStorage.getItem('owl_unlocked_skills') || 'null'); } catch (e) {}
      if (Array.isArray(savedSkills) && savedSkills.length > 0) {
        this.unlockedSkills = [...new Set(savedSkills.map(s => s === 'undo' ? 'second' : s))]
          .filter(s => validSkills.includes(s));
      }
      if (!Array.isArray(this.unlockedSkills) || this.unlockedSkills.length === 0) {
        this.unlockedSkills = ['second', 'jump'];
      }

      let savedCharges = null;
      try { savedCharges = JSON.parse(localStorage.getItem('owl_skill_charges') || 'null'); } catch (e) {}
      const maxCharges = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
      const nextCharges = {};
      validSkills.forEach(id => {
        const raw = savedCharges && typeof savedCharges === 'object' ? parseInt(savedCharges[id], 10) : NaN;
        nextCharges[id] = Number.isFinite(raw) ? Math.max(0, Math.min(maxCharges, raw)) : 3;
      });
      this.skillCharges = nextCharges;

      const validBoards = (window.ECONOMY_CONFIG?.boards || []).map(b => b.id);
      let savedBoards = null;
      try { savedBoards = JSON.parse(localStorage.getItem('owl_unlocked_boards') || 'null'); } catch (e) {}
      this.unlockedBoards = Array.isArray(savedBoards)
        ? [...new Set(savedBoards)].filter(id => validBoards.includes(id))
        : [];
      if (!this.unlockedBoards.includes('classic-oak')) this.unlockedBoards.unshift('classic-oak');

      let tracking = null;
      try { tracking = JSON.parse(localStorage.getItem('owl_ad_tracking') || 'null'); } catch (e) {}
      this.adTracking = tracking && typeof tracking === 'object'
        ? tracking
        : this.createDefaultAdTracking();
      this.ensureDailyTracking();

      try {
        const settings = JSON.parse(localStorage.getItem('owl_settings') || 'null');
        if (settings && typeof settings === 'object') {
          this.soundMuted = settings.soundMuted === true;
          this.musicEnabled = settings.musicEnabled !== false;
          if (!this.musicEnabled) {
            this.stopBgMusic();
            if (this._audioUnlockCleanup) {
              this._audioUnlockCleanup();
              this._audioUnlockCleanup = null;
            }
          }
        }
      } catch (e) { /* ignore */ }

      // Daily free charge: +1 to every unlocked ability, at most once per day.
      const today = this.getEconomyDateKey();
      if (this.adTracking.lastChargeRefillDate !== today) {
        this.unlockedSkills.forEach(id => {
          this.skillCharges[id] = Math.min(maxCharges, (this.skillCharges[id] || 0) + 1);
        });
        this.adTracking.lastChargeRefillDate = today;
        this.saveAdTracking();
      }

      // Selected loadout: prefer the current key, fall back to the legacy key.
      let selected = null;
      try { selected = JSON.parse(localStorage.getItem('owl_selected_abilities') || 'null'); } catch (e) {}
      if (!Array.isArray(selected) || selected.length === 0) {
        try { selected = JSON.parse(localStorage.getItem('chessarena_abilities') || 'null'); } catch (e) {}
      }
      if (!Array.isArray(selected)) selected = this.selectedAbilities;
      if (!Array.isArray(selected)) selected = [];
      this.selectedAbilities = selected
        .map(s => s === 'undo' ? 'second' : s)
        .filter(s => validSkills.includes(s) && this.unlockedSkills.includes(s));
      if (!this.slot2Unlocked && this.selectedAbilities.length > 1) {
        this.selectedAbilities = [this.selectedAbilities[0]];
      } else if (this.selectedAbilities.length > 2) {
        this.selectedAbilities = this.selectedAbilities.slice(0, 2);
      }
      if (this.selectedAbilities.length === 0) {
        this.selectedAbilities = [this.unlockedSkills[0] || 'second'];
      }

      // One-time migration: Second Chance is now the default Slot 1 skill.
      try {
        if (!localStorage.getItem('owl_default_second_v1')) {
          if (this.selectedAbilities.length === 1 && this.selectedAbilities[0] === 'jump') {
            this.selectedAbilities = ['second'];
          }
          localStorage.setItem('owl_default_second_v1', 'true');
        }
      } catch (e) { /* ignore */ }

      this.saveEconomyState();
      this.updateCoinsDisplay();
      this.syncAbilitiesUI();
      this.syncShopUI();
      this.updateLuckyWheelBadge();
    } catch (e) {
      console.warn('initEconomy error:', e);
    }
  }

  saveAdTracking() {
    try {
      localStorage.setItem('owl_ad_tracking', JSON.stringify(this.adTracking));
    } catch (e) {}
    if (this.economyPersistenceReady) this.scheduleEconomyPersist();
  }

  updateProfileXP() {
    const level = Math.max(1, Math.floor(Number(this.playerLevel) || 1));
    const baseXp = Math.max(1, Math.floor(Number(window.ECONOMY_CONFIG?.progression?.baseXpPerLevel) || 100));
    const required = level * baseXp;
    const rawXp = Number(this.playerXP);
    const xp = Number.isFinite(rawXp) ? Math.max(0, Math.min(required, Math.floor(rawXp))) : 0;
    const percent = Math.max(0, Math.min(100, (xp / required) * 100));

    const levelEl = document.getElementById('profile-hero-level');
    if (levelEl) levelEl.textContent = level;

    const fill = document.getElementById('profile-xp-fill');
    if (fill) fill.style.width = `${percent.toFixed(2)}%`;

    const text = document.getElementById('profile-xp-text');
    if (text) text.textContent = `${xp.toLocaleString()} / ${required.toLocaleString()} XP`;

    const track = document.getElementById('profile-xp-track');
    if (track) {
      track.setAttribute('aria-valuemax', String(required));
      track.setAttribute('aria-valuenow', String(xp));
      track.setAttribute('aria-valuetext', `${xp} of ${required} XP toward level ${level + 1}`);
    }
  }

  updateCoinsDisplay() {
    const amount = Math.max(0, Math.floor(Number(this.coins) || 0));
    this.coins = amount;
    const val = amount.toLocaleString();

    const homeEl = document.getElementById('home-coin-balance');
    if (homeEl) homeEl.textContent = `${val} Coins`;

    const shopEl = document.getElementById('shop-coin-balance');
    if (shopEl) shopEl.textContent = `🪙 ${val} Coins`;

    const shopLvl = document.getElementById('shop-player-level');
    if (shopLvl) shopLvl.textContent = this.playerLevel || 1;

    this.updateProfileXP();

    const profileBal = document.getElementById('profile-wallet-balance');
    if (profileBal) profileBal.textContent = val;

    const walletBal = document.getElementById('wallet-balance');
    if (walletBal) walletBal.textContent = `${val} Coins`;

    const joinBal = document.getElementById('join-user-balance-display');
    if (joinBal) joinBal.textContent = `${val} Coins`;

    this.updateGoldVaultButtonUI();
  }

  updateGoldVaultButtonUI() {
    const btn = document.getElementById('shop-gold-vault-btn');
    if (!btn) return;
    this.ensureDailyTracking();
    const maxDaily = window.ECONOMY_CONFIG?.ads?.maxDailyRewarded || 6;
    const used = this.adTracking?.dailyAdsWatched || 0;
    const left = Math.max(0, maxDaily - used);
    const progress = document.getElementById('shop-gold-vault-coins');
    if (progress) {
      progress.textContent = `Today: ${used}/${maxDaily} ads${left > 0 ? ` · ${left} left` : ' · limit reached'}`;
    }
    if (left <= 0) {
      btn.disabled = true;
      btn.textContent = 'Daily ad limit reached';
      return;
    }
    btn.disabled = false;
    const reward = this.adTracking?.firstAdClaimed
      ? (window.ECONOMY_CONFIG?.ads?.rewardCoins || 100)
      : (window.ECONOMY_CONFIG?.ads?.firstAdOfDayBonus || 150);
    btn.textContent = `🎬 Watch Ad · +${reward} 🪙`;
  }

  getEquippedBoard() {
    try {
      return localStorage.getItem('chessarena_board_theme')
        || localStorage.getItem('owl_board_theme')
        || 'classic-oak';
    } catch (e) {
      return 'classic-oak';
    }
  }

  addCoins(amount, reason = '') {
    const delta = Number(amount) || 0;
    if (delta === 0) return this.coins;
    return this.updateUserCoins(Math.max(0, (this.coins || 0) + delta), { reason });
  }

  spendCoins(amount, reason = '') {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    if ((this.coins || 0) < cost) {
      return false;
    }
    this.updateUserCoins(this.coins - cost, { reason });
    return true;
  }

  addXP(amount) {
    this.playerXP = (this.playerXP || 0) + Number(amount);
    const baseXp = window.ECONOMY_CONFIG?.progression?.baseXpPerLevel || 100;
    let leveledUp = false;

    while (this.playerXP >= this.playerLevel * baseXp) {
      this.playerXP -= this.playerLevel * baseXp;
      this.playerLevel = (this.playerLevel || 1) + 1;
      leveledUp = true;
    }

    this.saveEconomyState();
    this.updateProfileXP();

    if (leveledUp) {
      this.showToast(`🎉 Level Up! You reached Level ${this.playerLevel}! Check Shop for new boards & skills.`);
      this.updateCoinsDisplay();
      this.syncShopUI();
    }
  }

  async claimFreeAdCoins() {
    this.ensureDailyTracking();
    const maxDaily = window.ECONOMY_CONFIG?.ads?.maxDailyRewarded || 6;
    if (this.adTracking.dailyAdsWatched >= maxDaily) {
      this.showToast(`Daily Free Coins limit reached (${maxDaily}/${maxDaily}). Come back tomorrow!`);
      return;
    }

    this.showToast('Loading Rewarded Ad...');
    const result = await window.AdService.showRewarded('daily_gold_vault');
    if (result && result.rewarded) {
      const reward = this.adTracking.firstAdClaimed
        ? (window.ECONOMY_CONFIG?.ads?.rewardCoins || 100)
        : (window.ECONOMY_CONFIG?.ads?.firstAdOfDayBonus || 150);
      this.adTracking.firstAdClaimed = true;
      this.adTracking.dailyAdsWatched++;
      this.saveAdTracking();
      this.addCoins(reward, 'daily_gold_vault_ad');
      this.showToast(`🪙 +${reward} Coins added to your balance! (${this.adTracking.dailyAdsWatched}/${maxDaily} today)`);
    } else {
      this.showToast('Ad was not completed. No coins awarded.');
    }
  }

  getSkillCharges(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (!this.skillCharges) this.skillCharges = {};
    if (this.skillCharges[id] === undefined) this.skillCharges[id] = 3;
    return this.skillCharges[id];
  }

  consumeSkillCharge(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (!this.skillCharges) this.skillCharges = {};
    const cur = this.skillCharges[id] || 0;
    this.skillCharges[id] = Math.max(0, cur - 1);
    this.saveEconomyState();
    this.syncAbilitiesUI();
    return this.skillCharges[id];
  }

  restoreSkillCharge(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (!this.skillCharges) this.skillCharges = {};
    const max = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
    const cur = this.skillCharges[id] || 0;
    this.skillCharges[id] = Math.min(max, cur + 1);
    if (this.abilitiesActivatedThisMatch) {
      this.abilitiesActivatedThisMatch.delete(id);
    }
    this.saveEconomyState();
    this.syncAbilitiesUI();
    if (this.engine && !this.engine.gameOver) this.setupAbilitiesUI();
    return this.skillCharges[id];
  }

  isAbilityUsedThisMatch(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (this.abilitiesActivatedThisMatch && this.abilitiesActivatedThisMatch.has(id)) return true;
    const color = this.playerColor;
    return !!(this.engine && this.engine.abilitiesUsed && color &&
      Array.isArray(this.engine.abilitiesUsed[color]) &&
      this.engine.abilitiesUsed[color].includes(id));
  }

  canUseAbility(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (this.isAbilityUsedThisMatch(id)) {
      this.showToast('This ability has already been used in this match');
      return false;
    }
    if (this.getSkillCharges(id) <= 0) {
      this.showToast('No charges left. Refill this ability in the Abilities screen.');
      return false;
    }
    return true;
  }

  markAbilityUsed(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    if (!this.abilitiesActivatedThisMatch) this.abilitiesActivatedThisMatch = new Set();
    this.abilitiesActivatedThisMatch.add(id);
    this.consumeSkillCharge(id);
    if (this.engine && !this.engine.gameOver) this.setupAbilitiesUI();
  }

  refillSkill(abilityId, count = 1, cost = 50) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    const max = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
    const current = this.getSkillCharges(id);
    if (current >= max) {
      this.showToast(`Charges already full (${max}/${max})!`);
      return;
    }
    if (current + count > max) {
      this.showToast(`Not enough room: ${current}/${max}. This refill would exceed the cap (${max}).`);
      return;
    }

    if (!this.spendCoins(cost, `refill_${id}`)) {
      this.showToast(`Need ${cost} Coins! (You have ${this.coins.toLocaleString()})`);
      return;
    }

    this.skillCharges[id] = Math.min(max, current + count);
    this.saveEconomyState();
    this.syncAbilitiesUI();
    this.showToast(`✨ Refilled ${count} charge(s)! Current: ${this.skillCharges[id]}/${max}`);
  }

  async refillSkillViaAd(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    const max = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
    const current = this.getSkillCharges(id);
    if (current >= max) {
      this.showToast(`Charges already full (${max}/${max})!`);
      return;
    }
    const add = window.ECONOMY_CONFIG?.skills?.adRefillCharges || 2;
    if (current + add > max) {
      this.showToast(`Not enough room: ${current}/${max}. The ad refill would exceed the cap (${max}).`);
      return;
    }

    this.showToast('Loading Rewarded Ad...');
    const result = await window.AdService.showRewarded(`skill_refill_${id}`);
    if (result && result.rewarded) {
      this.skillCharges[id] = Math.min(max, current + add);
      this.saveEconomyState();
      this.syncAbilitiesUI();
      this.showToast(`✨ Ad complete! +${add} Charges added! Current: ${this.skillCharges[id]}/${max}`);
    } else {
      this.showToast('Ad was not completed.');
    }
  }

  promptUnlockSkill(abilityId) {
    const id = abilityId === 'undo' ? 'second' : abilityId;
    const catalog = window.ECONOMY_CONFIG?.skills?.catalog || [];
    const skill = catalog.find(s => s.id === id);
    if (!skill) return;

    if (this.playerLevel < skill.reqLevel) {
      this.showToast(`Requires Player Level ${skill.reqLevel}! (Your level: ${this.playerLevel})`);
      return;
    }

    if (this.coins < skill.cost) {
      this.showToast(`Need ${skill.cost.toLocaleString()} Coins to unlock ${skill.name}! (You have ${this.coins.toLocaleString()})`);
      return;
    }

    this.showConfirm(
      'Unlock Ability?',
      `Unlock ${skill.name} for ${skill.cost.toLocaleString()} Coins?`,
      () => {
        if (this.spendCoins(skill.cost, `unlock_skill_${id}`)) {
          if (!this.unlockedSkills.includes(id)) {
            this.unlockedSkills.push(id);
          }
          this.skillCharges[id] = 3;
          this.saveEconomyState();
          this.syncAbilitiesUI();
          this.showToast(`🎉 ${skill.name} unlocked with 3 free charges!`);
        }
      }
    );
  }

  syncSlotUI() {
    const slot1Display = document.getElementById('slot-1-display');
    const slot2Box = document.getElementById('slot-2-box');
    const slot2Header = document.getElementById('slot-2-header');
    const slot2Content = document.getElementById('slot-2-content');

    const nameMap = {
      'jump': 'Pegasus Jump',
      'second': 'Second Chance',
      'undo': 'Second Chance',
      'freeze': 'Piece Freeze',
      'swap': 'Tactical Swap',
      'shield': 'Divine Shield'
    };
    const iconMap = {
      'jump': '/assets/Asset 46.png',
      'second': '/assets/Asset 44.png',
      'undo': '/assets/Asset 44.png',
      'freeze': '/assets/Asset 43.png',
      'swap': '/assets/Asset 42.png',
      'shield': '/assets/Asset 45.png'
    };

    if (slot1Display) {
      const s1 = this.selectedAbilities[0];
      slot1Display.textContent = s1 ? (nameMap[s1] || s1) : 'None';
    }

    if (slot2Box && slot2Header && slot2Content) {
      slot2Box.classList.toggle('is-active', !!this.slot2Unlocked);
      slot2Box.classList.toggle('is-locked', !this.slot2Unlocked);
      slot2Header.classList.toggle('is-active', !!this.slot2Unlocked);

      if (this.slot2Unlocked) {
        slot2Header.textContent = 'SLOT 2 · ACTIVE';
        const s2 = this.selectedAbilities[1];
        slot2Content.innerHTML = s2
          ? `<div class="loadout-slot-skill"><img src="${iconMap[s2] || ''}" alt=""><span>${nameMap[s2] || s2}</span></div>`
          : `<div class="loadout-slot-empty">Empty · select a skill</div>`;
      } else {
        const requiredAds = window.ECONOMY_CONFIG?.skillSlots?.slot2AdsRequired || 3;
        const watched = Math.max(0, Math.min(requiredAds, this.slot2AdsWatched || 0));
        const remaining = Math.max(0, requiredAds - watched);
        const dots = Array.from({ length: requiredAds }, (_, i) =>
          `<span class="slot-progress-dot${i < watched ? ' is-filled' : ''}"></span>`
        ).join('');

        slot2Header.textContent = `SLOT 2 · ${watched}/${requiredAds}`;
        slot2Content.innerHTML = `
          <button type="button" class="slot-unlock-btn" onclick="app.promptUnlockSlot2()" title="${remaining} more ad${remaining === 1 ? '' : 's'} to unlock Slot 2">Unlock</button>
          <span class="slot-progress">${dots}</span>`;
      }
    }
  }

  async promptUnlockSlot2() {
    if (this.slot2Unlocked) {
      this.showToast('Slot 2 is already unlocked!');
      return;
    }

    const requiredAds = window.ECONOMY_CONFIG?.skillSlots?.slot2AdsRequired || 3;
    const watched = Math.max(0, Math.min(requiredAds, this.slot2AdsWatched || 0));
    if (watched >= requiredAds) {
      this.slot2Unlocked = true;
      this.saveEconomyState();
      this.syncSlotUI();
      return;
    }

    this.showToast(`Loading Rewarded Ad (${watched}/${requiredAds})...`);
    const res = await window.AdService.showRewarded('unlock_slot_2');
    if (!res || !res.rewarded) {
      this.showToast('Ad was not completed. No progress was added.');
      return;
    }

    this.slot2AdsWatched = watched + 1;
    if (this.slot2AdsWatched >= requiredAds) {
      this.slot2Unlocked = true;
      this.saveEconomyState();
      this.syncSlotUI();
      this.showToast(`🎉 Slot 2 Unlocked! (${requiredAds}/${requiredAds} ads watched). You can now equip 2 abilities!`);
    } else {
      this.saveEconomyState();
      this.syncSlotUI();
      this.showToast(`🎬 Ad watched! Progress: ${this.slot2AdsWatched}/${requiredAds}. Watch ${requiredAds - this.slot2AdsWatched} more to unlock Slot 2.`);
    }
  }

  buyOrEquipBoard(boardId) {
    const boards = window.ECONOMY_CONFIG?.boards || [];
    const board = boards.find(b => b.id === boardId);
    if (!board) return;

    if (this.unlockedBoards && this.unlockedBoards.includes(boardId)) {
      this.equipCosmetic('board', boardId);
      this.syncShopUI();
      return;
    }

    // Check level requirement
    if (this.playerLevel < board.reqLevel) {
      this.showToast(`Requires Player Level ${board.reqLevel}! (Your level: ${this.playerLevel})`);
      return;
    }

    // Check coins
    if (this.coins < board.cost) {
      this.showToast(`Need ${board.cost.toLocaleString()} Coins for ${board.name}! (You have ${this.coins.toLocaleString()})`);
      return;
    }

    this.showConfirm(
      'Unlock Board?',
      `Unlock ${board.name} for ${board.cost.toLocaleString()} Coins?`,
      () => {
        if (this.spendCoins(board.cost, `unlock_board_${boardId}`)) {
          if (!this.unlockedBoards.includes(boardId)) {
            this.unlockedBoards.push(boardId);
          }
          this.saveEconomyState();
          this.equipCosmetic('board', boardId);
          this.syncShopUI();
          this.showToast(`🎉 Unlocked and equipped ${board.name}!`);
        }
      }
    );
  }

  syncShopUI() {
    this.updateCoinsDisplay();
    const savedBoard = this.getEquippedBoard();
    const boardPane = document.getElementById('shop-pane-boards');
    if (!boardPane) return;

    const boards = window.ECONOMY_CONFIG?.boards || [];

    boardPane.querySelectorAll('.shop-item-card').forEach(card => {
      const id = card.dataset.id;
      const bConfig = boards.find(b => b.id === id);
      const btn = card.querySelector('.btn-shop-action');
      const isUnlocked = this.unlockedBoards && this.unlockedBoards.includes(id);
      const isEquipped = (id === savedBoard);

      if (isEquipped) {
        card.classList.add('equipped');
        card.classList.remove('locked');
        if (btn) {
          btn.classList.add('equipped');
          btn.textContent = 'Equipped';
          btn.style.background = '';
          btn.style.opacity = '1';
          btn.title = 'Currently equipped';
        }
      } else if (isUnlocked) {
        card.classList.remove('equipped', 'locked');
        if (btn) {
          btn.classList.remove('equipped');
          btn.textContent = 'Equip';
          btn.style.background = '';
          btn.style.opacity = '1';
          btn.title = 'Equip this board';
        }
      } else {
        card.classList.remove('equipped');
        card.classList.add('locked');
        if (btn && bConfig) {
          btn.classList.remove('equipped');
          const meetsLvl = this.playerLevel >= bConfig.reqLevel;
          btn.textContent = `Unlock · ${bConfig.cost.toLocaleString()} 🪙`;
          btn.style.opacity = meetsLvl ? '1' : '0.55';
          btn.title = meetsLvl
            ? `Unlock for ${bConfig.cost.toLocaleString()} coins`
            : `Reach player level ${bConfig.reqLevel} to unlock`;
        }
      }
    });
  }

  async claim3XMatchCoins() {
    if (this.lastMatchDoubled || (this.lastMatchCoinsEarned || 0) <= 0) {
      return;
    }
    this.ensureDailyTracking();

    const maxDoublers = window.ECONOMY_CONFIG?.ads?.maxDailyDoublers || 3;
    if (this.adTracking.dailyDoublersUsed >= maxDoublers) {
      this.showToast(`Daily 3X Doubler limit reached (${maxDoublers}/${maxDoublers}).`);
      return;
    }

    this.showToast('Loading Rewarded Ad...');
    const res = await window.AdService.showRewarded('match_3x_doubler');
    if (res && res.rewarded) {
      const bonus = this.lastMatchCoinsEarned * 2;
      this.lastMatchDoubled = true;
      this.adTracking.dailyDoublersUsed++;
      this.saveAdTracking();
      this.addCoins(bonus, 'match_3x_doubler');

      const coinsMeta = document.getElementById('victory-meta-coins');
      if (coinsMeta) {
        coinsMeta.textContent = `+${(this.lastMatchCoinsEarned * 3).toLocaleString()} 🪙 (3X Boosted!)`;
      }

      const doublerBtn = document.getElementById('victory-btn-doubler');
      const doublerText = document.getElementById('victory-btn-doubler-text');
      if (doublerBtn) {
        doublerBtn.disabled = true;
        doublerBtn.style.opacity = '0.7';
      }
      if (doublerText) {
        doublerText.textContent = `🌟 3X Bonus Claimed (+${bonus} 🪙)!`;
      }
      this.showToast(`🎉 3X Match Bonus Claimed! +${bonus} Coins added!`);
    } else {
      this.showToast('Ad was not completed.');
    }
  }

  // --- Lucky Tavern Wheel ---------------------------

  updateLuckyWheelBadge() {
    const badge = document.getElementById('home-lucky-wheel-badge');
    if (!badge) return;
    this.ensureDailyTracking();
    const today = this.getEconomyDateKey();
    const hasFreeSpin = (this.adTracking.lastWheelDate !== today);
    if (hasFreeSpin) {
      badge.textContent = '1 Free Spin Ready!';
      badge.style.color = '#FFD54F';
    } else {
      const adSpinsLeft = Math.max(0, 3 - (this.adTracking.wheelSpinsToday || 0));
      if (adSpinsLeft > 0) {
        badge.textContent = `🎬 ${adSpinsLeft} Extra Spins Available`;
        badge.style.color = '#4ade80';
      } else {
        badge.textContent = 'Spins used today';
        badge.style.color = '#94a3b8';
      }
    }
  }

  showLuckyWheelModal() {
    const modal = document.getElementById('modal-lucky-wheel');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    this.drawLuckyWheel(0);
    this.updateLuckyWheelButtonUI();
  }

  closeLuckyWheelModal() {
    if (this.isSpinningWheel) return;
    const modal = document.getElementById('modal-lucky-wheel');
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.add('hidden');
    this.updateLuckyWheelBadge();
  }

  updateLuckyWheelButtonUI() {
    const btn = document.getElementById('btn-spin-wheel');
    const text = document.getElementById('btn-spin-wheel-text');
    if (!btn || !text) return;
    this.ensureDailyTracking();
    const today = this.getEconomyDateKey();
    const hasFreeSpin = (this.adTracking.lastWheelDate !== today);
    if (hasFreeSpin) {
      btn.disabled = false;
      text.textContent = 'Spin for Free! 🎡';
    } else {
      const spinsLeft = Math.max(0, 3 - (this.adTracking.wheelSpinsToday || 0));
      if (spinsLeft > 0) {
        btn.disabled = false;
        text.textContent = `🎬 Watch Ad to Spin (${spinsLeft}/3 left)`;
      } else {
        btn.disabled = true;
        text.textContent = 'All spins used today. Come back tomorrow!';
      }
    }
  }

  drawLuckyWheel(angle = 0) {
    const canvas = document.getElementById('lucky-wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const sliceAngle = (2 * Math.PI) / 6;

    const slices = [
      { top: '50', bottom: 'COINS', inner: '#5A3820', outer: '#2B160B', text: '#FFE7A3' },
      { top: '+2', bottom: 'CHARGES', inner: '#275061', outer: '#101F28', text: '#A9EBFF' },
      { top: '100', bottom: 'COINS', inner: '#6B4423', outer: '#2B160B', text: '#FFE7A3' },
      { top: '+1', bottom: 'ALL SKILLS', inner: '#33552F', outer: '#152415', text: '#C8F3B8' },
      { top: '200', bottom: 'COINS', inner: '#7A4C24', outer: '#2B160B', text: '#FFE7A3' },
      { top: '500', bottom: 'JACKPOT', inner: '#FFE28A', outer: '#C99700', text: '#20120B' }
    ];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Soft base plate + shadow behind the wheel.
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#160B05';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < slices.length; i++) {
      const start = angle + i * sliceAngle;
      const end = start + sliceAngle;
      const mid = start + sliceAngle / 2;
      const slice = slices[i];

      // Rich radial shading gives each wedge depth without flat banding.
      const fill = ctx.createRadialGradient(centerX, centerY, radius * 0.12, centerX, centerY, radius);
      fill.addColorStop(0, slice.inner);
      fill.addColorStop(0.58, slice.inner);
      fill.addColorStop(1, slice.outer);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      // Fine gold separators, plus a darker inner line for definition.
      ctx.strokeStyle = 'rgba(245, 211, 108, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      // Flip labels on the left half so they read left-to-right instead of upside down.
      const flipLabel = Math.cos(mid) < 0;
      ctx.rotate(mid + (flipLabel ? Math.PI : 0));
      ctx.textAlign = flipLabel ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = slice.text === '#20120B' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = slice.text;

      const labelX = flipLabel ? -(radius - 27) : (radius - 27);
      ctx.font = '900 14px Georgia, serif';
      ctx.fillText(slice.top, labelX, -5);
      ctx.font = '800 7.5px Georgia, serif';
      ctx.fillText(slice.bottom, labelX, 8);
      ctx.restore();
    }

    // Outer bevel and rim ticks.
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = '#5A3A12';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#F5D36C';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 4, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(32, 18, 11, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let i = 0; i < 36; i++) {
      const tickAngle = (i * Math.PI * 2) / 36;
      const isMajor = i % 3 === 0;
      const inner = radius - (isMajor ? 9 : 5);
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(tickAngle) * inner, centerY + Math.sin(tickAngle) * inner);
      ctx.lineTo(centerX + Math.cos(tickAngle) * (radius - 1), centerY + Math.sin(tickAngle) * (radius - 1));
      ctx.strokeStyle = isMajor ? '#FFD54F' : 'rgba(255, 213, 79, 0.42)';
      ctx.lineWidth = isMajor ? 1.8 : 1;
      ctx.stroke();
    }

    // Glossy sheen across the top half.
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 10, Math.PI * 1.08, Math.PI * 1.58);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Gold hub with a dark inner cap and a star.
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#1A0D06';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fill();
    ctx.restore();

    const hub = ctx.createRadialGradient(centerX - 7, centerY - 9, 2, centerX, centerY, 24);
    hub.addColorStop(0, '#FFF5C8');
    hub.addColorStop(0.45, '#F5D36C');
    hub.addColorStop(1, '#8A6500');
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, 2 * Math.PI);
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = '#FFE7A3';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(74, 46, 27, 0.92)';
    ctx.fill();

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', centerX, centerY + 1);
  }

  async spinLuckyWheel() {
    if (this.isSpinningWheel) return;
    this.ensureDailyTracking();

    const today = this.getEconomyDateKey();
    const hasFreeSpin = (this.adTracking.lastWheelDate !== today);

    if (!hasFreeSpin) {
      const spinsLeft = Math.max(0, 3 - (this.adTracking.wheelSpinsToday || 0));
      if (spinsLeft <= 0) {
        this.showToast('All spins used today. Come back tomorrow!');
        return;
      }

      this.showToast('Loading Rewarded Ad...');
      const res = await window.AdService.showRewarded('lucky_wheel_spin');
      if (!res || !res.rewarded) {
        this.showToast('Ad was not completed.');
        return;
      }
      this.adTracking.wheelSpinsToday = (this.adTracking.wheelSpinsToday || 0) + 1;
    } else {
      this.adTracking.lastWheelDate = today;
      this.adTracking.wheelSpinsToday = 0;
    }

    this.saveAdTracking();
    this.isSpinningWheel = true;
    const btn = document.getElementById('btn-spin-wheel');
    if (btn) btn.disabled = true;

    const resEl = document.getElementById('lucky-wheel-result');
    if (resEl) resEl.textContent = 'Spinning... 🍀';

    // Slices config (at top pointer 3*PI/2)
    const rewards = [
      { type: 'coins', amount: 50, label: '50 Coins 🪙' },
      { type: 'charges_random', amount: 2, label: '+2 Skill Charges ⚡' },
      { type: 'coins', amount: 100, label: '100 Coins 🪙' },
      { type: 'charges_all', amount: 1, label: '+1 Charge to All Skills ✨' },
      { type: 'coins', amount: 200, label: '200 Coins 🪙' },
      { type: 'coins', amount: 500, label: 'JACKPOT: 500 Coins 🪙⭐' }
    ];

    // Pick outcome with weighted probabilities (Jackpot is 8%, others balanced)
    const weights = [0.30, 0.20, 0.22, 0.12, 0.08, 0.08];
    const rand = Math.random();
    let cumulative = 0;
    let targetSlice = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        targetSlice = i;
        break;
      }
    }

    const sliceAngle = (2 * Math.PI) / rewards.length;
    // Pointer is at Top = 3*PI/2 (270 deg)
    // When rotation angle = A, slice i center is at A + (i + 0.5) * sliceAngle
    // To align slice i center with 3*PI/2:
    // A = 3*PI/2 - (i + 0.5) * sliceAngle
    const targetBaseAngle = (1.5 * Math.PI) - (targetSlice + 0.5) * sliceAngle;
    const totalSpins = 5 + Math.floor(Math.random() * 3);
    const finalAngle = targetBaseAngle + (totalSpins * 2 * Math.PI);

    const startTime = performance.now();
    const duration = 3500; // 3.5s

    const animateWheel = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentAngle = ease * finalAngle;
      this.drawLuckyWheel(currentAngle);

      if (progress < 1) {
        requestAnimationFrame(animateWheel);
      } else {
        this.isSpinningWheel = false;
        const reward = rewards[targetSlice];
        const maxCharges = window.ECONOMY_CONFIG?.skills?.maxCharges || 5;
        const unlocked = this.unlockedSkills || ['second'];
        const nameMap = {
          second: 'Second Chance', jump: 'Pegasus Jump', freeze: 'Piece Freeze',
          swap: 'Tactical Swap', shield: 'Divine Shield'
        };
        let awardedLabel = reward.label;

        if (reward.type === 'coins') {
          this.addCoins(reward.amount, 'lucky_wheel');
        } else if (reward.type === 'charges_random') {
          const eligible = unlocked.filter(s => this.getSkillCharges(s) < maxCharges);
          if (eligible.length > 0) {
            const randSkill = eligible[Math.floor(Math.random() * eligible.length)];
            const cur = this.getSkillCharges(randSkill);
            const added = Math.min(2, maxCharges - cur);
            this.skillCharges[randSkill] = cur + added;
            awardedLabel = `+${added} ${nameMap[randSkill] || randSkill} Charge${added === 1 ? '' : 's'}`;
            this.saveEconomyState();
            this.syncAbilitiesUI();
          } else {
            this.addCoins(50, 'lucky_wheel_charges_full');
            awardedLabel = '50 Coins (all skill charges full)';
          }
        } else if (reward.type === 'charges_all') {
          let changed = 0;
          unlocked.forEach(s => {
            const cur = this.getSkillCharges(s);
            if (cur < maxCharges) {
              this.skillCharges[s] = Math.min(maxCharges, cur + 1);
              changed++;
            }
          });
          if (changed > 0) {
            awardedLabel = '+1 Charge to All Skills';
            this.saveEconomyState();
            this.syncAbilitiesUI();
          } else {
            this.addCoins(50, 'lucky_wheel_charges_full');
            awardedLabel = '50 Coins (all skill charges full)';
          }
        }

        if (resEl) resEl.textContent = `Won: ${awardedLabel}! 🎉`;
        this.showToast(`🎉 Lucky Wheel: Won ${awardedLabel}!`);
        this.updateLuckyWheelButtonUI();
        this.updateLuckyWheelBadge();
      }
    };

    requestAnimationFrame(animateWheel);
  }

}


// Initialize app
const app = new App();
// Other modules (multiplayer, ads, host integrations) use window.app.
window.app = app;
