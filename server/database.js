const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, '..', 'referrals.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库表
db.serialize(() => {
  // 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      referrer_address TEXT,
      team_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_address) REFERENCES users(wallet_address)
    )
  `);

  // 创建索引以提高查询性能
  db.run(`CREATE INDEX IF NOT EXISTS idx_wallet ON users(wallet_address)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_referrer ON users(referrer_address)`);
});

// 绑定推荐关系
function bindReferral(walletAddress, referrerAddress, callback) {
  const query = `
    INSERT INTO users (wallet_address, referrer_address, team_name)
    VALUES (?, ?, ?)
    ON CONFLICT(wallet_address) DO NOTHING
  `;
  
  const teamName = referrerAddress ? `团队-${referrerAddress.substring(0, 8)}` : '独立用户';
  
  db.run(query, [walletAddress, referrerAddress, teamName], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { 
        success: this.changes > 0,
        walletAddress,
        referrerAddress,
        teamName
      });
    }
  });
}

// 获取用户信息
function getUserInfo(walletAddress, callback) {
  const query = `SELECT * FROM users WHERE wallet_address = ?`;
  
  db.get(query, [walletAddress], (err, row) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, row);
    }
  });
}

// 获取统计数据
function getStats(callback) {
  const queries = {
    totalUsers: `SELECT COUNT(*) as count FROM users`,
    usersWithReferrer: `SELECT COUNT(*) as count FROM users WHERE referrer_address IS NOT NULL`,
    teams: `SELECT team_name, COUNT(*) as member_count FROM users GROUP BY team_name`,
    allUsers: `SELECT wallet_address, referrer_address, team_name, created_at FROM users ORDER BY created_at DESC`,
    // 推荐人排名：统计每个推荐人的推荐数量
    referrerRanking: `
      SELECT 
        referrer_address,
        COUNT(*) as referral_count,
        MIN(created_at) as first_referral_time
      FROM users 
      WHERE referrer_address IS NOT NULL 
      GROUP BY referrer_address 
      ORDER BY referral_count DESC, first_referral_time ASC
    `
  };

  const stats = {};

  db.get(queries.totalUsers, (err, row) => {
    if (err) return callback(err, null);
    stats.totalUsers = row.count;

    db.get(queries.usersWithReferrer, (err, row) => {
      if (err) return callback(err, null);
      stats.usersWithReferrer = row.count;

      db.all(queries.teams, (err, rows) => {
        if (err) return callback(err, null);
        stats.teams = rows;

        db.all(queries.allUsers, (err, rows) => {
          if (err) return callback(err, null);
          stats.allUsers = rows;

          // 获取推荐人排名
          db.all(queries.referrerRanking, (err, rows) => {
            if (err) return callback(err, null);
            stats.referrerRanking = rows;
            callback(null, stats);
          });
        });
      });
    });
  });
}

// 获取团队成员
function getTeamMembers(referrerAddress, callback) {
  const query = `
    SELECT wallet_address, team_name, created_at 
    FROM users 
    WHERE referrer_address = ?
    ORDER BY created_at DESC
  `;
  
  db.all(query, [referrerAddress], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

module.exports = {
  db,
  bindReferral,
  getUserInfo,
  getStats,
  getTeamMembers
};
