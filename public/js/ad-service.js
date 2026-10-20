/**
 * AdService - Unified Ad and Platform SDK Layer
 * Designed for YouTube Playables / Playgama with Mock Development Adapter
 */

class AdServiceClass {
  constructor() {
    this.adapterType = 'mock'; // 'mock' | 'playgama' | 'youtube'
    this.lastInterstitialTime = 0;
    this.interstitialCooldownMs = 60000; // 60 seconds
    this.isInitialized = false;
  }

  async init(adapterType = 'mock') {
    this.adapterType = adapterType;
    this.isInitialized = true;
    console.log(`[AdService] Initialized with adapter: ${this.adapterType}`);

    // Call platform game ready signal if available
    if (typeof window.ytgame !== 'undefined' && window.ytgame.gameReady) {
      window.ytgame.gameReady();
    }
  }

  isRewardedAvailable() {
    return true;
  }

  async showRewarded(rewardId) {
    console.log(`[AdService] Requesting rewarded ad for: ${rewardId}`);
    
    // Pause game audio if available
    if (window.app && window.app.pauseAudio) {
      window.app.pauseAudio();
    }

    if (this.adapterType === 'mock') {
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log(`[AdService] Mock rewarded ad completed for: ${rewardId}`);
          if (window.app && window.app.resumeAudio) {
            window.app.resumeAudio();
          }
          resolve({ rewarded: true });
        }, 1200);
      });
    }

    // Playgama Bridge Adapter
    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return new Promise((resolve) => {
        window.bridge.advertisement.showRewarded({
          onRewarded: () => {
            if (window.app && window.app.resumeAudio) window.app.resumeAudio();
            resolve({ rewarded: true });
          },
          onClose: () => {
            if (window.app && window.app.resumeAudio) window.app.resumeAudio();
          },
          onError: (err) => {
            console.warn('[AdService] Playgama rewarded ad failed:', err);
            if (window.app && window.app.resumeAudio) window.app.resumeAudio();
            if (window.app && window.app.showToast) {
              window.app.showToast('Ad not available right now. Try again soon.');
            }
            resolve({ rewarded: false });
          }
        });
      });
    }

    return { rewarded: false };
  }

  async showInterstitial() {
    const now = Date.now();
    if (now - this.lastInterstitialTime < this.interstitialCooldownMs) {
      console.log('[AdService] Interstitial cooldown active. Skipping.');
      return;
    }

    this.lastInterstitialTime = now;
    console.log('[AdService] Showing interstitial ad at natural breakpoint');

    if (this.adapterType === 'mock') {
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('[AdService] Mock interstitial finished');
          resolve();
        }, 800);
      });
    }

    if (this.adapterType === 'playgama' && window.bridge && window.bridge.advertisement) {
      return new Promise((resolve) => {
        window.bridge.advertisement.showInterstitial({
          onClose: () => resolve(),
          onError: () => resolve()
        });
      });
    }
  }
}

window.AdService = new AdServiceClass();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdServiceClass;
}
