const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
let db;

const run = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const get = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const all = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

async function connectDB() {
    db = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
            console.error('? SQLite connection error:', err);
            return;
        }
        console.log('? Successfully connected to Local SQLite Database!');
        
        await run("CREATE TABLE IF NOT EXISTS users (walletAddress TEXT PRIMARY KEY, username TEXT DEFAULT 'Anonymous Owl', rating INTEGER DEFAULT 1200, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0)");
        await run("CREATE TABLE IF NOT EXISTS matches (matchId TEXT PRIMARY KEY, winnerAddress TEXT, loserAddress TEXT, reason TEXT, mode TEXT DEFAULT 'Standard', stake INTEGER DEFAULT 0, duration TEXT DEFAULT '0 min 0 sec', moves INTEGER DEFAULT 0, ratingChange INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)");
    });
}

async function getOrCreateUser(walletAddress) {
    if (!walletAddress) return null;
    const addr = walletAddress.toLowerCase();
    let user = await get("SELECT * FROM users WHERE walletAddress = ?", [addr]);
    if (!user) {
        await run("INSERT INTO users (walletAddress) VALUES (?)", [addr]);
        user = await get("SELECT * FROM users WHERE walletAddress = ?", [addr]);
    }
    return user;
}

async function recordMatch(matchData) {
    try {
        const ratingChange = 25;
        if (matchData.winnerAddress && matchData.winnerAddress !== 'draw') {
            const wAddr = matchData.winnerAddress.toLowerCase();
            await getOrCreateUser(wAddr);
            await run("UPDATE users SET wins = wins + 1, rating = rating + ? WHERE walletAddress = ?", [ratingChange, wAddr]);
        }
        if (matchData.loserAddress && matchData.loserAddress !== 'draw') {
            const lAddr = matchData.loserAddress.toLowerCase();
            await getOrCreateUser(lAddr);
            await run("UPDATE users SET losses = losses + 1, rating = rating - ? WHERE walletAddress = ?", [ratingChange, lAddr]);
        }
        await run("INSERT INTO matches (matchId, winnerAddress, loserAddress, reason, stake, moves, duration, ratingChange) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            matchData.matchId,
            matchData.winnerAddress ? matchData.winnerAddress.toLowerCase() : null,
            matchData.loserAddress ? matchData.loserAddress.toLowerCase() : null,
            matchData.reason,
            matchData.stake,
            matchData.moves || 0,
            matchData.duration || '0 min',
            ratingChange
        ]);
    } catch (err) {
        console.error("Failed to record match in SQLite DB:", err);
    }
}

async function getProfileStats(walletAddress) {
    if (!walletAddress) return null;
    const user = await getOrCreateUser(walletAddress);
    const addr = walletAddress.toLowerCase();
    const recentMatches = await all("SELECT * FROM matches WHERE winnerAddress = ? OR loserAddress = ? ORDER BY createdAt DESC LIMIT 5", [addr, addr]);
    return { user, recentMatches };
}

module.exports = { connectDB, getOrCreateUser, recordMatch, getProfileStats };
