const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  playerId: {
    type: String,
    required: true,
    unique: true,
    sparse: true, // legacy profiles may predate the playerId field
    lowercase: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true // Allows null/undefined until the player picks a name
  },
  elo: {
    type: Number,
    default: 1200
  },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
  winStreak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
