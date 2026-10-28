/**
 * AdService - Unified Ad and Platform SDK Layer
 * Designed for YouTube Playables / Playgama with a local mock fallback.
 *
 * The PlayGama bridge is loaded asynchronously by platform.js. init() is called
 * early by app.js, so both init() and the request methods re-check the bridge
 * before deciding an ad is unavailable. This prevents the game from being
 * permanently stuck in mock mode when the bridge finishes after app startup.
 */

class AdServiceClass {
  constructor() {
    this.adapterType = 'mock'; // 'mock' | 'playgama'
    this.lastInterstitialTime = 0;
    this.interstitialCooldownMs = 60000; // 60 seconds
    this.isInitialized = false;
  }

  async init(adapterType = null) {
    if (adapterType) {
      this.adapterType = adapterType;
    } else {
      this.adapterType = this.detectAdapter();
    }
    this.isInitialized = true;
    console.log(`[AdService] Initialized with adapter: ${this.adapterType}`);

    // Call platform game ready signal if available.
    try {
      if (typeof window.ytgame !== 'undefined' && typeof window.ytgame.gameReady === 'function') {
        window.ytgame.gameReady();
      }
    } catch (e) {
      console.warn('[AdService] gameReady failed:', e);
    }

    // If the bridge was not loaded yet, wait for it in the background so the
    // first ad request already sees the real adapter.
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
      if (window.ChessArenaPlatform && typeof window.ChessArenaPlatform.whenReady === 'object') {
        // whenReady is a Promise; don't block forever if the platform is slow.
        await Promise.race([
          window.ChessArenaPlatform.whenReady,
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      } else if (window.ChessArenaPlatform && typeof window.ChessArenaPlatform.whenReady === 'function') {
        await Promise.race([
          window.ChessArenaPlatform.whenReady(),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      }
    } catch (e) {
      // The bridge is optional; local/mock play must continue.
    }

    if (window.bridge && window.bridge.advertisement) {
      this.adapterType = 'playgama';
      return true;
    }
    return false;
  }

  isRewardedAvailable() {
    return true;
  }

  _pauseAudio() {
    try {
      const app = window.app;
      if (app && app.audioCtx && app.audioCtx.state === 'running') {
        app.audioCtx.suspend().catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  _resumeAudio() {
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

  _isRewardState(state) {
    return state === true ||
      state === 'rewarded' ||
      state === 'completed' ||
      state === 'finished' ||
      (state && (state.rewarded === true || state.state === 'rewarded' || state.state === 'completed'));
  }

  async showRewarded(rewardId) {
    console.log(`[AdService] Requesting rewarded ad for: ${rewardId}`);
    this._pauseAudio();
    await this.ensureAdapter();

    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return this._showPlayGamaRewarded();
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[AdService] Mock rewarded ad completed for: ${rewardId}`);
        this._resumeAudio();
        resolve({ rewarded: true });
      }, 1200);
    });
  }

  _showPlayGamaRewarded() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (rewarded, error) => {
        if (settled) return;
        settled = true;
        this._resumeAudio();
        if (error) {
          console.warn('[AdService] PlayGama rewarded ad failed:', error);
          this._toast('Ad not available right now. Try again soon.');
        }
        resolve({ rewarded: !!rewarded });
      };

      try {
        const result = window.bridge.advertisement.showRewarded({
          onRewarded: () => finish(true),
          onClose: (state) => {
            // Some bridge versions only report the result through onClose.
            if (!settled) finish(this._isRewardState(state));
          },
          onError: (err) => finish(false, err)
        });
        if (result && typeof result.then === 'function') {
          result.then((state) => {
            // The bridge may return void/undefined and report the result via
            // callbacks. Only settle here on an explicit state.
            if (state === false) finish(false);
            else if (this._isRewardState(state)) finish(true);
            else if (typeof state === 'string') finish(false);
          }).catch((err) => finish(false, err));
        }
      } catch (err) {
        finish(false, err);
      }

      // Defensive fallback: never leave a pending reward forever.
      setTimeout(() => finish(false), 120000);
    });
  }

  async showInterstitial() {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldownMs) {
      console.log('[AdService] Interstitial cooldown active. Skipping.');
      return;
    }

    this.lastInterstitialTime = now;
    console.log('[AdService] Showing interstitial ad at natural breakpoint');
    this._pauseAudio();
    await this.ensureAdapter();

    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          this._resumeAudio();
          resolve();
        };
        try {
          const result = window.bridge.advertisement.showInterstitial({
            onClose: finish,
            onError: finish
          });
          if (result && typeof result.then === 'function') result.then(finish).catch(finish);
        } catch (e) {
          finish();
        }
        setTimeout(finish, 120000);
      });
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('[AdService] Mock interstitial finished');
        this._resumeAudio();
        resolve();
      }, 800);
    });
  }
}

window.AdService = new AdServiceClass();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdServiceClass;
}
