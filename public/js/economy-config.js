/**
 * Chess Arena — Economy Configuration
 * Centralized settings for currencies, rewards, progression, skills, boards, and ads.
 */

const ECONOMY_CONFIG = {
  currency: {
    startingCoins: 1000,
    pvp: {
      win: 90,
      draw: 50,
      loss: 25
    },
    ai: {
      easy: {
        win: 30, draw: 15, loss: 10,
        xp: { win: 20, draw: 12, loss: 8 }
      },
      medium: {
        win: 50, draw: 25, loss: 10,
        xp: { win: 35, draw: 20, loss: 12 }
      },
      hard: {
        win: 80, draw: 40, loss: 10,
        xp: { win: 60, draw: 35, loss: 20 }
      }
    },
    firstWinOfDayBonus: 100
  },

  progression: {
    baseXpPerLevel: 100, // Level N requires N * 100 XP
    pvpXpWin: 50,
    pvpXpDraw: 25,
    pvpXpLoss: 20,
    pvpXp: { win: 50, draw: 25, loss: 20 }
  },

  skillSlots: {
    slot1Unlocked: true,
    slot2AdsRequired: 3
  },

  hintsAndUndos: {
    hintCosts: [25, 50, 100, 200], // Double-down progression
    undoCosts: [50, 100, 200],      // Double-down progression
    aiOnly: true                    // Hints & undos strictly disabled in Ranked PvP
  },

  skills: {
    startingUnlocked: ['second', 'jump'],
    // Ordered from the most standard ability to the most advanced, and by cost.
    catalog: [
      { id: 'second', name: 'Second Chance', icon: '↺', reqLevel: 1, cost: 0, isDefault: true },
      { id: 'jump', name: 'Pegasus Jump', icon: '🐴', reqLevel: 1, cost: 0, isDefault: true },
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
    { id: 'ember', name: 'Emberwood', reqLevel: 2, cost: 1000 },
    { id: 'moonlit', name: 'Moonlit Grove', reqLevel: 5, cost: 2500 },
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

/**
 * Single source of truth for match payouts. Keeping this pure makes the
 * economy easy to test and prevents the UI/config from drifting apart.
 */
function calculateMatchReward(mode, difficulty, outcome) {
  const result = ['win', 'draw', 'loss'].includes(outcome) ? outcome : 'draw';
  const isPvp = mode === 'online' || mode === 'pvp';

  if (isPvp) {
    const coins = Number(ECONOMY_CONFIG.currency.pvp[result] || 0);
    const xpTable = ECONOMY_CONFIG.progression.pvpXp || {
      win: ECONOMY_CONFIG.progression.pvpXpWin || 50,
      draw: ECONOMY_CONFIG.progression.pvpXpDraw || 25,
      loss: ECONOMY_CONFIG.progression.pvpXpLoss || 20
    };
    return { coins, xp: Number(xpTable[result] || 0) };
  }

  const key = String(difficulty || 'medium').toLowerCase();
  const ai = ECONOMY_CONFIG.currency.ai[key] || ECONOMY_CONFIG.currency.ai.medium;
  const xpTable = ai.xp && typeof ai.xp === 'object'
    ? ai.xp
    : { win: Number(ai.xp) || 0, draw: Number(ai.xp) || 0, loss: Number(ai.xp) || 0 };
  return {
    coins: Number(ai[result] != null ? ai[result] : 0),
    xp: Number(xpTable[result] || 0)
  };
}

ECONOMY_CONFIG.calculateMatchReward = calculateMatchReward;

if (typeof window !== 'undefined') {
  window.ECONOMY_CONFIG = ECONOMY_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ECONOMY_CONFIG;
}
