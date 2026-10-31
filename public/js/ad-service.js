/**
 * AdService — PlayGama Bridge advertisement layer.
 *
 * Bridge v2 returns void from showRewarded()/showInterstitial() and reports the
 * outcome through REWARDED_STATE_CHANGED / INTERSTITIAL_STATE_CHANGED, so this
 * class listens for those events instead of passing callbacks.
 *
 * Rules implemented here:
 *  - Rewarded currency is granted only in the `rewarded` state (2.2.5).
 *  - Interstitials are shown only at natural pauses; Bridge decides the actual
 *    frequency, so there is no client-side cooldown (required step 7).
 *  - While a full-screen ad is open, sound and gameplay are paused and restored
 *    afterwards (2.1.6).
 *  - When the host does not support ads, calls fail softly and gameplay goes on
 *    (2.1.7). Standalone web builds simulate the flow for development only.
 */

class AdServiceClass {
  constructor() {
    this.adapterType = 'none';
    this.isInitialized = false;
  }

  async init() {
    this.isInitialized = true;
    await this.ensureAdapter();
  }

  detectAdapter() {
    try {
      if (window.bridge && window.bridge.advertisement) return 'playgama';
    } catch (e) { /* ignore */ }
    return 'none';
  }

  async ensureAdapter() {
    if (!window.bridge) {
      try {
        const platform = window.ChessArenaPlatform;
        if (platform && platform.whenReady) await platform.whenReady;
      } catch (e) { /* local play continues */ }
    }
    this.adapterType = this.detectAdapter();
    return this.adapterType === 'playgama';
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

  // Development fallback only: a real Bridge host always has a platform id.
  _usingLocalMock() {
    return this.adapterType !== 'playgama' || !this._realPlatformId();
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

  _game() {
    return window.app || null;
  }

  _canResumeGame() {
    try {
      const platform = window.ChessArenaPlatform;
      if (platform && typeof platform.isAudioEnabled === 'function' && !platform.isAudioEnabled()) return false;
      if (platform && typeof platform.isPaused === 'function' && platform.isPaused()) return false;
    } catch (e) { /* assume safe */ }
    return true;
  }

  _adOpened() {
    const app = this._game();
    if (app && typeof app.setAdPlaying === 'function') app.setAdPlaying(true);
  }

  _adFinished() {
    const app = this._game();
    if (app && typeof app.setAdPlaying === 'function') app.setAdPlaying(false);
    // If the host keeps reporting a paused state the Bridge resume event will
    // restore audio; never force it back on ourselves.
    if (!this._canResumeGame()) return;
    try {
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

  // --- Rewarded ------------------------------------------------------------

  async showRewarded(rewardId) {
    await this.ensureAdapter();
    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return this._showPlayGamaRewarded(rewardId);
    }
    return this._showLocalRewarded();
  }

  _showLocalRewarded() {
    // Localhost / self-hosted development: keep the reward flow testable
    // without an ad network. Never used on a real platform.
    return new Promise((resolve) => {
      this._adOpened();
      setTimeout(() => {
        this._adFinished();
        resolve({ rewarded: true, mock: true });
      }, 900);
    });
  }

  _showPlayGamaRewarded(placement) {
    return new Promise((resolve) => {
      const ad = window.bridge && window.bridge.advertisement;
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
        this._adFinished();
        if (!rewarded && reason === 'failed') {
          this._toast('Ad not available right now. Try again soon.');
        }
        resolve({ rewarded: !!rewarded, reason: reason || null });
      };

      const onState = (state) => {
        if (state === 'rewarded') {
          // The reward is earned here and only here.
          gotReward = true;
          if (!closeFallback) closeFallback = setTimeout(() => finish(true, 'rewarded'), 1500);
        } else if (state === 'closed') {
          finish(gotReward, gotReward ? 'rewarded' : 'closed');
        } else if (state === 'failed') {
          finish(false, 'failed');
        } else if (state === 'opened') {
          this._adOpened();
        }
      };

      try {
        if (typeof ad.on === 'function') ad.on(eventName, onState);
        ad.showRewarded(placement || null);
      } catch (e) {
        finish(false, 'failed');
        return;
      }

      // Defensive only: real ads resolve through state events.
      hardTimeout = setTimeout(() => finish(false, 'timeout'), 75000);
    });
  }

  // --- Interstitial --------------------------------------------------------

  async showInterstitial(placement = 'game_completed') {
    await this.ensureAdapter();
    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return this._showPlayGamaInterstitial(placement);
    }
    return this._showLocalInterstitial();
  }

  _showLocalInterstitial() {
    return new Promise((resolve) => {
      this._adOpened();
      setTimeout(() => {
        this._adFinished();
        resolve({ shown: true, mock: true });
      }, 600);
    });
  }

  _showPlayGamaInterstitial(placement) {
    return new Promise((resolve) => {
      const ad = window.bridge && window.bridge.advertisement;
      if (!ad) {
        resolve({ shown: false, reason: 'unavailable' });
        return;
      }
      if (ad.isInterstitialSupported !== true) {
        resolve({ shown: false, reason: 'unsupported' });
        return;
      }

      let settled = false;
      let hardTimeout = null;
      const eventName = this._adEventName('interstitial');

      const finish = (shown, reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        this._removeListener(ad, eventName, onState);
        this._adFinished();
        resolve({ shown: !!shown, reason: reason || null });
      };

      const onState = (state) => {
        if (state === 'opened') this._adOpened();
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
