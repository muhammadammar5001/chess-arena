const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true 
  },
  username: { 
    type: String, 
    unique: true, 
    sparse: true // Allows null/undefined if they haven't set a username yet
  },
  elo: { 
    type: Number, 
    default: 1200 
  },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('User', userSchema);
