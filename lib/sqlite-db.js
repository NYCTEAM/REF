import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径 - 使用持久化存储目录
const DB_DIR = process.env.DB_PATH || '/data';
const DB_FILE = path.join(DB_DIR, 'referrals.db');

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('SQLite数据库路径:', DB_FILE);

// 初始化数据库
let database = null;

function getDatabase() {
  if (!database) {
    database = new Database(DB_FILE);
    
    // 创建表
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT UNIQUE NOT NULL,
        referrer_address TEXT,
        team_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('SQLite数据库初始化完成');
  }
  return database;
}

export const db = {
  bindReferral(walletAddress, referrerAddress, teamName) {
    try {
      const database = getDatabase();
      
      // 检查是否已存在
      const existing = database.prepare(
        'SELECT * FROM users WHERE wallet_address = ?'
      ).get(walletAddress.toLowerCase());
      
      if (existing) {
        return { success: false, alreadyBound: true };
      }
      
      // 插入新用户
      const stmt = database.prepare(`
        INSERT INTO users (wallet_address, referrer_address, team_name)
        VALUES (?, ?, ?)
      `);
      
      const result = stmt.run(
        walletAddress.toLowerCase(),
        referrerAddress ? referrerAddress.toLowerCase() : null,
        teamName
      );
      
      console.log('绑定成功，插入ID:', result.lastInsertRowid);
      
      return {
        success: true,
        user: {
          id: result.lastInsertRowid,
          wallet_address: walletAddress,
          referrer_address: referrerAddress,
          team_name: teamName
        }
      };
    } catch (error) {
      console.error('bindReferral error:', error);
      throw error;
    }
  },
  
  getUserInfo(walletAddress) {
    try {
      const database = getDatabase();
      
      // 获取用户信息
      const user = database.prepare(
        'SELECT * FROM users WHERE wallet_address = ?'
      ).get(walletAddress.toLowerCase());
      
      if (!user) {
        return { exists: false };
      }
      
      // 获取团队成员
      const teamMembers = database.prepare(
        'SELECT * FROM users WHERE referrer_address = ? ORDER BY created_at DESC'
      ).all(walletAddress.toLowerCase());
      
      return {
        exists: true,
        user,
        teamMembers
      };
    } catch (error) {
      console.error('getUserInfo error:', error);
      throw error;
    }
  },
  
  getStats() {
    try {
      const database = getDatabase();
      
      // 总用户数
      const totalUsers = database.prepare('SELECT COUNT(*) as count FROM users').get().count;
      
      // 有推荐人的用户数
      const usersWithReferrer = database.prepare(
        'SELECT COUNT(*) as count FROM users WHERE referrer_address IS NOT NULL'
      ).get().count;
      
      // 团队分布
      const teams = database.prepare(`
        SELECT team_name, COUNT(*) as member_count 
        FROM users 
        GROUP BY team_name
        ORDER BY member_count DESC
      `).all();
      
      // 所有用户
      const allUsers = database.prepare(
        'SELECT * FROM users ORDER BY created_at DESC'
      ).all();
      
      // 推荐人排名
      const referrerRanking = database.prepare(`
        SELECT 
          referrer_address,
          COUNT(*) as referral_count,
          MIN(created_at) as first_referral_time
        FROM users
        WHERE referrer_address IS NOT NULL
        GROUP BY referrer_address
        ORDER BY referral_count DESC, first_referral_time ASC
      `).all();
      
      console.log('统计数据:', {
        totalUsers,
        usersWithReferrer,
        teamsCount: teams.length,
        rankingCount: referrerRanking.length
      });
      
      return {
        totalUsers,
        usersWithReferrer,
        teams,
        allUsers,
        referrerRanking
      };
    } catch (error) {
      console.error('getStats error:', error);
      throw error;
    }
  }
};
