/**
 * Chess Arena — Multiplayer Client
 * WebSocket-based real-time multiplayer with room codes.
 */

/**
 * Resolve the shared Chess Arena backend origin.
 *
 * The game runs from three kinds of hosts:
 *   1. Its own Node server (localhost / *.onrender.com) — same origin has the
 *      HTTP API and the WebSocket server.
 *   2. A static host such as the PlayGama sandbox (*.games.playgama.net) — the
 *      static host has no backend, so both the API and the WebSocket must use
 *      the deployed production backend.
 *   3. Any other custom static host — same as (2).
 *
 * `app.getServerApiUrl()` and the WebSocket URL both use this helper so the
 * HTTP API and realtime server can never drift apart.
 */
const CHESS_SERVER_BASE_DEFAULT = 'https://chess-arena-262t.onrender.com';

function resolveChessServerBase() {
  if (typeof window === 'undefined') return CHESS_SERVER_BASE_DEFAULT;

  const override = window.CHESS_SERVER_BASE;
  if (override) return String(override).replace(/\/+$/, '');

  const loc = window.location;
  if (!loc) return CHESS_SERVER_BASE_DEFAULT;

  const hostname = String(loc.hostname || '').toLowerCase();
  const origin = loc.origin;
  const isPrivate = (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.onrender.com')
  );

  if (isPrivate && origin && origin !== 'null') return origin;
  return CHESS_SERVER_BASE_DEFAULT;
}

/**
 * PlayGama's sandbox is a development host: testers must be able to exercise
 * online play there even when the emulated target platform (for example
 * YouTube) blocks external calls in production. Both the UI capability gate
 * and the realtime client use this helper so they cannot disagree.
 */
function isPlaygamaSandboxHost() {
  if (typeof window === 'undefined') return false;
  try {
    const hostname = String(window.location.hostname || '').toLowerCase();
    if (hostname.endsWith('.games.playgama.net')) return true;
    const platform = window.ChessArenaPlatform;
    const id = platform && typeof platform.getPlatformId === 'function'
      ? String(platform.getPlatformId() || '').toLowerCase()
      : '';
    return id === 'playgama_sandbox';
  } catch (e) {
    return false;
  }
}

class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.roomCode = null;
    this.playerColor = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.gameId = null;
    this.keepAliveInterval = null;
    this.intentionalClose = false;

    // Event callbacks
    this.onRoomCreated = null;
    this.onWaitingForMatch = null;
    this.onGameStart = null;
    this.onOpponentMove = null;
    this.onOpponentDisconnected = null;
    this.onOpponentReconnected = null;
    this.onGameOver = null;
    this.onAfkWarning = null;
    this.onTurnPassed = null;
    this.onGameReconnect = null;
    this.onDrawOffered = null;
    this.onStatsUpdate = null;
    this.onError = null;
    this.onConnectionChange = null;
    this.onOpponentResigned = null;
    this.onRematchRequested = null;
    this.onRematchAccepted = null;
    this.onRematchDeclined = null;
    this.onTimerSync = null;
    this.onChatMessage = null;
    this.onCheckRoomResult = null;
    this._isSearching = false;
    this._pendingCancelMatch = false;
  }

  getWebSocketUrl() {
    // 1. Explicit override via window.CHESS_WS_URL
    if (typeof window !== 'undefined' && window.CHESS_WS_URL) {
      return window.CHESS_WS_URL;
    }

    const base = resolveChessServerBase();
    try {
      const url = new URL(base);
      const scheme = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${scheme}//${url.host}`;
    } catch (e) {
      const secure = /^https:/i.test(base);
      return (secure ? 'wss://' : 'ws://') + String(base)
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '');
    }
  }

  isSupported() {
    try {
      // The sandbox is a development host and keeps online play available even
      // when the emulated target platform reports external calls as blocked.
      if (isPlaygamaSandboxHost()) return !!this.getWebSocketUrl();
      const platform = window.ChessArenaPlatform;
      if (platform && typeof platform.isExternalCallsSupported === 'function' &&
          platform.isExternalCallsSupported() === false) {
        return false;
      }
    } catch (e) { /* assume supported when the platform is unknown */ }
    return !!this.getWebSocketUrl();
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Online play is not available on this platform'));
        return;
      }
      const wsUrl = this.getWebSocketUrl();
      let settled = false;
      let authTimer = null;
      let connectTimer = null;

      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (authTimer) clearTimeout(authTimer);
        if (connectTimer) clearTimeout(connectTimer);
        authTimer = null;
        connectTimer = null;
        if (error) reject(error);
        else resolve();
      };
      this._authComplete = () => finish();

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        finish(e instanceof Error ? e : new Error('Connection failed'));
        return;
      }

      // A dead endpoint can leave the socket in CONNECTING forever. Fail fast
      // so the lobby shows a usable error instead of hanging. Cross-origin
      // hosts (PlayGama sandbox) may need a few seconds to reach the backend.
      connectTimer = setTimeout(() => {
        if (!settled) {
          try { this.ws.close(); } catch (e) { /* ignore */ }
          finish(new Error('Connection timed out'));
        }
      }, 15000);

      this.ws.onopen = () => {
        if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
        const app = window.app;
        if (app && app.playerId) {
          const displayName = typeof app.getPreferredDisplayName === 'function'
            ? app.getPreferredDisplayName()
            : null;
          this.send({
            type: 'authenticate',
            playerId: app.playerId,
            displayName: displayName || undefined,
            avatarId: (app && app.avatarId) ? app.avatarId : undefined,
            playerLevel: Math.max(1, Number(app.playerLevel) || 1),
            rating: app.cloudProfile && Number.isFinite(Number(app.cloudProfile.rating))
              ? Number(app.cloudProfile.rating)
              : undefined
          });
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.intentionalClose = false;
        if (this.onConnectionChange) this.onConnectionChange('connected');

        // Start client-side keepalive — sends ping every 25s to survive proxies/tunnels
        this.startKeepAlive();

        if (this._pendingCancelMatch) {
          this._pendingCancelMatch = false;
          this.send({ type: 'cancel_match' });
        }

        // Don't let a missing auth reply block room creation forever.
        authTimer = setTimeout(() => finish(), 2500);
      };

      this.ws.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch (e) { return; }
        if (!data || typeof data !== 'object') return;
        this.handleMessage(data);
        if (data.type === 'auth_success' || data.type === 'auth_offline' || data.type === 'auth_require_username') {
          finish();
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopKeepAlive();
        if (this.onConnectionChange) this.onConnectionChange('disconnected');
        if (!settled) finish(new Error('Connection closed'));
        // Only auto-reconnect if we didn't close on purpose
        if (this.roomCode && !this.intentionalClose) this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        if (this.onError) this.onError('Connection error');
        finish(error);
      };
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.onError) this.onError('Failed to reconnect');
      return;
    }

    this.reconnectAttempts++;
    if (this.onConnectionChange) this.onConnectionChange('reconnecting');

    setTimeout(async () => {
      try {
        await this.connect();
        if (this.roomCode && this.gameId) {
          
          this.send({
            type: 'reconnect',
            roomCode: this.roomCode,
            gameId: this.gameId,
            color: this.playerColor
          });
        }
      } catch {
        this.attemptReconnect();
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  handleMessage(data) {
    switch (data.type) {
      
      case 'auth_require_username':
        if (window.app && window.app.handleAuthRequireUsername) window.app.handleAuthRequireUsername(data.playerId);
        break;
      case 'auth_success':
        if (window.app && window.app.handleAuthSuccess) window.app.handleAuthSuccess(data.user, data.created);
        break;
      case 'auth_offline':
        if (window.app && window.app.showToast) window.app.showToast('Playing as guest — online stats stay on this device.');
        break;
      case 'room_created':
        this.roomCode = data.roomCode;
        this.playerColor = data.color;
        this.gameId = data.gameId;
        this.abilities = data.abilities || { self: [], opponent: [] };
          if (this.onRoomCreated) this.onRoomCreated(data.roomCode, data.color);
        break;

      case 'check_room_result':
        if (this.onCheckRoomResult) this.onCheckRoomResult(data);
        break;

      case 'waiting_for_match':
        if (this.onWaitingForMatch) this.onWaitingForMatch();
        break;

      case 'game_start':
        if (!this._isSearching && !this.roomCode) {
          console.log('[MultiplayerClient] Matchmaking was cancelled, ignoring game_start');
          this.send({ type: 'leave_room', roomCode: data.roomCode });
          this.send({ type: 'resign' });
          return;
        }
        this._isSearching = false;
        if (data.roomCode) this.roomCode = data.roomCode;
        this.playerColor = data.color;
        this.gameId = data.gameId;
        this.abilities = data.abilities || { self: [], opponent: [] };
          if (this.onGameStart) this.onGameStart(data.color, data.opponent, data.timerMinutes, data);
        break;

      case 'ability_used':
          if (this.onAbilityUsed) this.onAbilityUsed(data.ability, data.args, data.color);
          break;

        case 'opponent_move':
        if (this.onOpponentMove) {
          this.onOpponentMove(data.from, data.to, data.promotion);
        }
        break;

      case 'opponent_disconnected':
        if (this.onOpponentDisconnected) this.onOpponentDisconnected(data);
        break;

      case 'opponent_reconnected':
        if (this.onOpponentReconnected) this.onOpponentReconnected();
        break;

      case 'game_over':
          if (this.onGameOver) this.onGameOver(data.reason, data.winner, data.settlement);
        break;

      case 'stats_update':
        if (this.onStatsUpdate) this.onStatsUpdate(data.stats, data.gameId);
        break;

      case 'draw_offered':
        if (this.onDrawOffered) this.onDrawOffered();
        break;

      case 'opponent_resigned':
        // Handled via game_over event
        break;

      case 'game_reconnect':
        this.playerColor = data.color;
        this.gameId = data.gameId;
        if (this.onGameReconnect) this.onGameReconnect(data);
        break;

      case 'rematch_requested':
        if (this.onRematchRequested) this.onRematchRequested();
        break;

      case 'rematch_accepted':
        this.playerColor = data.color;
        this.gameId = data.gameId;
        if (data.abilities) this.abilities = data.abilities;
        if (this.onRematchAccepted) this.onRematchAccepted(data.color);
        break;

      case 'rematch_declined':
        if (this.onRematchDeclined) this.onRematchDeclined();
        break;

              case 'afk_warning':
          if (this.onAfkWarning) this.onAfkWarning(data);
          break;

        case 'turn_passed':
          if (this.onTurnPassed) this.onTurnPassed(data);
          break;

        case 'timer_sync':
        if (this.onTimerSync) this.onTimerSync(data.white, data.black, data.moveTimeLeft, data.activeTurn);
        break;

      case 'chat_message':
        if (this.onChatMessage) this.onChatMessage(data.sender, data.senderName, data.text);
        break;

      case 'error':
        if (this.onError) this.onError(data.message);
        break;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  createRoom(timerMinutes = null, mode = 'standard', abilities = [], avatarId = null, profile = null) {
    const avatarSrc = profile && profile.avatarSrc ? profile.avatarSrc : null;
    this.send({ type: 'create_room', timer: timerMinutes, mode: mode, abilities: abilities, avatarId: avatarId, avatarSrc: avatarSrc, profile: profile });
  }

  checkRoom(roomCode) {
    this.send({ type: 'check_room', roomCode: roomCode.toUpperCase() });
  }

  joinRoom(roomCode, abilities = [], avatarId = null, profile = null) {
    this.roomCode = roomCode.toUpperCase();
    const avatarSrc = profile && profile.avatarSrc ? profile.avatarSrc : null;
    this.send({ type: 'join_room', roomCode: this.roomCode, abilities: abilities, avatarId: avatarId, avatarSrc: avatarSrc, profile: profile });
  }

  sendChatMessage(text) {
    this.send({ type: 'chat_message', text: text, roomCode: this.roomCode });
  }

  findMatch(timerMinutes = null, mode = 'standard', abilities = [], avatarId = null, profile = null) {
    this._isSearching = true;
    this._pendingCancelMatch = false;
    const avatarSrc = profile && profile.avatarSrc ? profile.avatarSrc : null;
    this.send({ type: 'find_match', timer: timerMinutes, mode: mode, abilities: abilities, avatarId: avatarId, avatarSrc: avatarSrc, profile: profile });
  }

  cancelMatch() {
    this._isSearching = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'cancel_match' });
    } else {
      this._pendingCancelMatch = true;
    }
  }

  sendMove(from, to, promotion = null) {
    this.send({
      type: 'move',
      from: from,
      to: to,
      promotion: promotion
    });
  }

  resign() {
    this.send({ type: 'resign' });
  }

  offerDraw() {
    this.send({ type: 'offer_draw' });
  }

  acceptDraw() {
    this.send({ type: 'accept_draw' });
  }

  declineDraw() {
    this.send({ type: 'decline_draw' });
  }

  requestRematch() {
    this.send({ type: 'request_rematch' });
  }

  acceptRematch() {
    this.send({ type: 'accept_rematch' });
  }

  declineRematch() {
    this.send({ type: 'decline_rematch' });
  }

  disconnect() {
    this.intentionalClose = true;
    this.roomCode = null;
    this.gameId = null;
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (window.app && window.app.platformPaused) return;
      this.send({ type: 'ping' });
    }, 20000);
  }

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}





