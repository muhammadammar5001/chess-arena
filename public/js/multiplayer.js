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
    // 1. Explicit override via window.CHESS_WS_URL or meta tag
    if (typeof window !== 'undefined' && window.CHESS_WS_URL) {
      return window.CHESS_WS_URL;
    }

    // 2. Local development check
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    );
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    if (isLocal) {
      return `${protocol}//${window.location.host}`;
    }

    // 3. When the game is served by Render, use the same origin so the
    // WebSocket follows the deployed service URL automatically.
    if (hostname.endsWith('.onrender.com')) {
      return `${protocol}//${window.location.host}`;
    }

    // 4. YouTube Playables / Playgama CDN production environment
    // Fallback to our Free Cloud WebSocket Server (Render.com free tier)
    return 'wss://chess-arena-262t.onrender.com';
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.getWebSocketUrl();
      console.log(`[Multiplayer] Connecting to: ${wsUrl}`);
      let settled = false;
      let authTimer = null;

      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (authTimer) clearTimeout(authTimer);
        authTimer = null;
        if (error) reject(error);
        else resolve();
      };
      this._authComplete = () => finish();

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (window.app && window.app.playerId) {
          const displayName = typeof window.app.getPreferredDisplayName === 'function'
            ? window.app.getPreferredDisplayName()
            : null;
          this.send({
            type: 'authenticate',
            playerId: window.app.playerId,
            displayName: displayName || undefined,
            playerLevel: Math.max(1, Number(window.app.playerLevel) || 1),
            rating: window.app.cloudProfile && Number.isFinite(Number(window.app.cloudProfile.rating))
              ? Number(window.app.cloudProfile.rating)
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
        const data = JSON.parse(event.data);
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
    console.log('[Multiplayer] received event:', data.type);
    switch (data.type) {
      
      case 'auth_require_username':
        if (app && app.handleAuthRequireUsername) app.handleAuthRequireUsername(data.playerId);
        break;
      case 'auth_success':
        if (app && app.handleAuthSuccess) app.handleAuthSuccess(data.user, data.created);
        break;
      case 'auth_offline':
        if (app && app.showToast) app.showToast('Playing as guest — online stats stay on this device.');
        break;
      case 'room_created':
        this.roomCode = data.roomCode;
        this.playerColor = data.color;
        this.gameId = data.gameId;
        this.abilities = data.abilities || { self: [], opponent: [] };
          localStorage.setItem('chessarena_active_match', JSON.stringify({ roomCode: data.roomCode, gameId: data.gameId, color: data.color }));
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
        localStorage.setItem('chessarena_active_match', JSON.stringify({ roomCode: this.roomCode, gameId: data.gameId, color: data.color }));
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
        if (this.onOpponentDisconnected) this.onOpponentDisconnected();
        break;

      case 'opponent_reconnected':
        if (this.onOpponentReconnected) this.onOpponentReconnected();
        break;

      case 'game_over':
          localStorage.removeItem('chessarena_active_match');
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

  createRoom(timerMinutes = null, mode = 'standard', abilities = []) {
    this.send({ type: 'create_room', timer: timerMinutes, mode: mode, abilities: abilities });
  }

  checkRoom(roomCode) {
    this.send({ type: 'check_room', roomCode: roomCode.toUpperCase() });
  }

  joinRoom(roomCode, abilities = []) {
    this.roomCode = roomCode.toUpperCase();
    this.send({ type: 'join_room', roomCode: this.roomCode, abilities: abilities });
  }

  sendChatMessage(text) {
    this.send({ type: 'chat_message', text: text });
  }

  findMatch(timerMinutes = null, mode = 'standard', abilities = []) {
    this.send({ type: 'find_match', timer: timerMinutes, mode: mode, abilities: abilities });
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





