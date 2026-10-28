/**
 * AdService - unified PlayGama / local ad layer.
 *
 * PlayGama Bridge v2 returns void from showRewarded()/showInterstitial() and
 * reports the result through REWARDED_STATE_CHANGED /
 * INTERSTITIAL_STATE_CHANGED. The previous callback-object implementation is
 * intentionally gone: on a real host it never resolved and could hang the game
 * until the 120s safety timeout.
 */

class AdServiceClass {
  constructor() {
    this.adapterType = 'mock'; // 'mock' | 'playgama'
    this.lastInterstitialTime = 0;
    this.interstitialCooldownMs = 60000;
    this.isInitialized = false;
  }

  async init(adapterType = null) {
    // Do not touch bridge.advertisement before the Bridge handshake finishes;
    // the SDK logs an initialization error and can expose an unready adapter.
    this.adapterType = adapterType || 'mock';
    this.isInitialized = true;
    console.log(`[AdService] Initialized with adapter: ${this.adapterType}`);

    // The Bridge owns game_ready on real hosts; this is only a compatibility
    // fallback for a bare YouTube Playables environment without the Bridge.
    if (!window.bridge && window.ytgame && typeof window.ytgame.gameReady === 'function') {
      try { window.ytgame.gameReady(); } catch (e) { /* ignore */ }
    }

    if (this.adapterType === 'mock') {
      this.ensureAdapter().catch(() => {});
    }
  }

  detectAdapter() {
    try {
      if (window.bridge && window.bridge.advertisement) return 'playgama';
    } catch (e) { /* ignore */ }
    return 'mock';
  }

  async ensureAdapter() {
    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return true;
    }

    try {
      const platform = window.ChessArenaPlatform;
      if (platform && platform.whenReady) {
        await Promise.race([
          Promise.resolve(platform.whenReady),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
      }
    } catch (e) { /* local play continues */ }

    if (window.bridge && window.bridge.advertisement) {
      this.adapterType = 'playgama';
      return true;
    }
    return false;
  }

  _realPlatformId() {
    try {
      return window.ChessArenaPlatform && typeof window.ChessArenaPlatform.getPlatformId === 'function'
        ? String(window.ChessArenaPlatform.getPlatformId() || '')
        : '';
    } catch (e) {
      return '';
    }
  }

  _usingLocalMock() {
    // The Bridge mock adapter is a local/standalone development fallback. It
    // reports ads as unsupported, but local players should still be able to
    // exercise reward flows. A real host always has a non-empty platform id.
    return this.adapterType === 'mock' || !this._realPlatformId();
  }

  isRewardedAvailable() {
    if (this._usingLocalMock()) return true;
    try {
      return window.bridge.advertisement.isRewardedSupported === true;
    } catch (e) {
      return false;
    }
  }

  isInterstitialAvailable() {
    if (this._usingLocalMock()) return true;
    try {
      return window.bridge.advertisement.isInterstitialSupported === true;
    } catch (e) {
      return false;
    }
  }

  _pauseAudio() {
    try {
      const app = window.app;
      if (app && app.audioCtx && app.audioCtx.state === 'running') {
        app.audioCtx.suspend().catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  _canResumeAudio() {
    try {
      if (window.app && (window.app.platformAudioMuted || window.app.platformPaused)) return false;
      const platform = window.ChessArenaPlatform;
      if (platform && typeof platform.isAudioEnabled === 'function' && !platform.isAudioEnabled()) return false;
      if (platform && typeof platform.isPaused === 'function' && platform.isPaused()) return false;
    } catch (e) { /* assume safe */ }
    return true;
  }

  _resumeAudio() {
    if (!this._canResumeAudio()) return;
    try {
      const app = window.app;
      if (app && app.audioCtx && app.audioCtx.state === 'suspended') {
        app.audioCtx.resume().catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  _toast(message) {
    try {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(message);
      }
    } catch (e) { /* ignore */ }
  }

  _adEventName(kind) {
    const bridge = window.bridge;
    const names = (bridge && bridge.EVENT_NAME) || {};
    if (kind === 'rewarded') return names.REWARDED_STATE_CHANGED || 'rewarded_state_changed';
    return names.INTERSTITIAL_STATE_CHANGED || 'interstitial_state_changed';
  }

  _removeListener(ad, eventName, handler) {
    try {
      if (ad && typeof ad.off === 'function') ad.off(eventName, handler);
    } catch (e) { /* ignore */ }
  }

  async showRewarded(rewardId) {
    console.log(`[AdService] Requesting rewarded ad for: ${rewardId}`);
    await this.ensureAdapter();

    if (!this._usingLocalMock() && this.adapterType === 'playgama' &&
        window.bridge && window.bridge.advertisement) {
      return this._showPlayGamaRewarded(rewardId);
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[AdService] Mock rewarded ad completed for: ${rewardId}`);
        this._resumeAudio();
        resolve({ rewarded: true, mock: true });
      }, 1200);
    });
  }

  _showPlayGamaRewarded(placement) {
    return new Promise((resolve) => {
      const bridge = window.bridge;
      const ad = bridge && bridge.advertisement;
      if (!ad) {
        resolve({ rewarded: false, reason: 'unavailable' });
        return;
      }

      if (ad.isRewardedSupported !== true) {
        this._toast('Rewarded ads are not available on this platform.');
        resolve({ rewarded: false, reason: 'unsupported' });
        return;
      }

      let settled = false;
      let gotReward = false;
      let closeFallback = null;
      let hardTimeout = null;
      const eventName = this._adEventName('rewarded');

      const finish = (rewarded, reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        clearTimeout(closeFallback);
        this._removeListener(ad, eventName, onState);
        this._resumeAudio();
        if (!rewarded && reason === 'failed') {
          this._toast('Ad not available right now. Try again soon.');
        }
        resolve({ rewarded: !!rewarded, reason: reason || null });
      };

      const onState = (state) => {
        if (state === 'rewarded') {
          // The reward is earned here. Wait briefly for `closed` so the ad's
          // own pause/audio state is fully cleared before gameplay resumes.
          gotReward = true;
          if (!closeFallback) {
            closeFallback = setTimeout(() => finish(true, 'rewarded'), 1500);
          }
        } else if (state === 'closed') {
          finish(gotReward, gotReward ? 'rewarded' : 'closed');
        } else if (state === 'failed') {
          finish(false, 'failed');
        } else if (state === 'opened') {
          this._pauseAudio();
        }
      };

      try {
        if (typeof ad.on === 'function') ad.on(eventName, onState);
        // Bridge API: showRewarded(placement) -> void. Never pass a callback
        // object as the placement.
        ad.showRewarded(placement || null);
      } catch (e) {
        finish(false, 'failed');
        return;
      }

      // Defensive fallback only. Real ads resolve through state events.
      hardTimeout = setTimeout(() => finish(false, 'timeout'), 75000);
    });
  }

  async showInterstitial(placement = 'game_completed') {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldownMs) return { shown: false, reason: 'cooldown' };

    await this.ensureAdapter();

    if (!this._usingLocalMock() && this.adapterType === 'playgama' &&
        window.bridge && window.bridge.advertisement) {
      return this._showPlayGamaInterstitial(placement);
    }

    this.lastInterstitialTime = now;
    return new Promise((resolve) => {
      setTimeout(() => {
        this._resumeAudio();
        resolve({ shown: true, mock: true });
      }, 800);
    });
  }

  _showPlayGamaInterstitial(placement) {
    return new Promise((resolve) => {
      const bridge = window.bridge;
      const ad = bridge && bridge.advertisement;
      if (!ad) {
        resolve({ shown: false, reason: 'unavailable' });
        return;
      }

      if (ad.isInterstitialSupported !== true) {
        resolve({ shown: false, reason: 'unsupported' });
        return;
      }

      this.lastInterstitialTime = Date.now();
      let settled = false;
      let hardTimeout = null;
      const eventName = this._adEventName('interstitial');

      const finish = (shown, reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        this._removeListener(ad, eventName, onState);
        this._resumeAudio();
        resolve({ shown: !!shown, reason: reason || null });
      };

      const onState = (state) => {
        if (state === 'opened') this._pauseAudio();
        else if (state === 'closed') finish(true, 'closed');
        else if (state === 'failed') finish(false, 'failed');
      };

      try {
        if (typeof ad.on === 'function') ad.on(eventName, onState);
        ad.showInterstitial(placement || null);
      } catch (e) {
        finish(false, 'failed');
        return;
      }

      hardTimeout = setTimeout(() => finish(false, 'timeout'), 60000);
    });
  }
}

window.AdService = new AdServiceClass();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdServiceClass;
}
