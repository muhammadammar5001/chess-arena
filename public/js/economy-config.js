/**
 * Chess Arena — Economy Configuration
 * Centralized settings for currencies, rewards, progression, skills, boards, and ads.
 */

const ECONOMY_CONFIG = {
  currency: {
    startingCoins: 300,
    pvp: {
      win: 90,
      draw: 50,
      loss: 25
    },
    ai: {
      easy: { win: 30, loss: 10, xp: 20 },
      medium: { win: 50, loss: 10, xp: 35 },
      hard: { win: 80, loss: 10, xp: 60 }
    },
    firstWinOfDayBonus: 100
  },

  progression: {
    baseXpPerLevel: 100, // Level N requires N * 100 XP
    pvpXpWin: 50,
    pvpXpLoss: 20
  },

  skillSlots: {
    slot1Unlocked: true,
    slot2Cost: 500,
    slot2AdsRequired: 3
  },

  hintsAndUndos: {
    hintCosts: [25, 50, 100, 200], // Double-down progression
    undoCosts: [50, 100, 200],      // Double-down progression
    aiOnly: true                    // Hints & undos strictly disabled in Ranked PvP
  },

  skills: {
    startingUnlocked: ['jump', 'undo'],
    catalog: [
      { id: 'jump', name: 'Pegasus Jump', icon: '🐴', reqLevel: 1, cost: 0, isDefault: true },
      { id: 'undo', name: 'Second Chance', icon: '↺', reqLevel: 1, cost: 0, isDefault: true },
      { id: 'freeze', name: 'Piece Freeze', icon: '❄️', reqLevel: 4, cost: 600 },
      { id: 'swap', name: 'Tactical Swap', icon: '⚡', reqLevel: 7, cost: 1200 },
      { id: 'shield', name: 'Divine Shield', icon: '🛡️', reqLevel: 10, cost: 2000 }
    ],
    maxCharges: 5,
    refillSingleCost: 50,    // +1 Charge
    refillPackCost: 120,      // +3 Charges
    adRefillCharges: 2        // 1 Ad = +2 Charges
  },

  boards: [
    { id: 'classic-oak', name: 'Classic Oak', reqLevel: 1, cost: 0, isDefault: true },
    { id: 'ember', name: 'Emberwood', reqLevel: 3, cost: 1200 },
    { id: 'moonlit', name: 'Moonlit Grove', reqLevel: 6, cost: 2500 },
    { id: 'sakura', name: 'Sakurawood', reqLevel: 9, cost: 4000 },
    { id: 'walnut-maple', name: 'Walnut & Maple', reqLevel: 12, cost: 6000 },
    { id: 'ebony-ivory', name: 'Royal Ebony & Ivory', reqLevel: 15, cost: 9000 }
  ],

  ads: {
    rewardCoins: 100,
    firstAdOfDayBonus: 150,
    maxDailyRewarded: 6,
    maxDailyDoublers: 3
  }
};

if (typeof window !== 'undefined') {
  window.ECONOMY_CONFIG = ECONOMY_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ECONOMY_CONFIG;
}
