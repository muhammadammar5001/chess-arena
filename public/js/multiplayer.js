/**
 * Chess Arena — Multiplayer Client
 * WebSocket-based real-time multiplayer with room codes.
 */

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
    this.onTimerSync = null;
    this.onChatMessage = null;
    this.onCheckRoomResult = null;
  }

  getWebSocketUrl() {
    // 1. Explicit override via window.CHESS_WS_URL
    if (typeof window !== 'undefined' && window.CHESS_WS_URL) {
      return window.CHESS_WS_URL;
    }

    // 2. Self-hosted / local builds serve the WebSocket from the same origin.
    if (typeof window === 'undefined' || !window.location || !window.location.host) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  isSupported() {
    try {
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
      // so the lobby shows a usable error instead of hanging.
      connectTimer = setTimeout(() => {
        if (!settled) {
          try { this.ws.close(); } catch (e) { /* ignore */ }
          finish(new Error('Connection timed out'));
        }
      }, 8000);

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
        if (this.onRematchAccepted) this.onRematchAccepted(data.color);
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
    const avatarSrc = profile && profile.avatarSrc ? profile.avatarSrc : null;
    this.send({ type: 'find_match', timer: timerMinutes, mode: mode, abilities: abilities, avatarId: avatarId, avatarSrc: avatarSrc, profile: profile });
  }

  cancelMatch() {
    this.send({ type: 'cancel_match' });
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





