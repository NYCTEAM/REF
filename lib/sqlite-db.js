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
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        leader_address TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('SQLite数据库初始化完成');
  }
  return database;
}

export const db = {
  // --- 团队管理相关 ---
  
  // 添加新团队
  addTeam(name, leaderAddress, description = '') {
    try {
      const database = getDatabase();
      const stmt = database.prepare(`
        INSERT INTO teams (name, leader_address, description)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(name, leaderAddress, description);
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('团队名称已存在');
      }
      throw error;
    }
  },

  // 删除团队
  deleteTeam(id) {
    const database = getDatabase();
    // 检查是否有用户
    // const hasUsers = database.prepare('SELECT COUNT(*) as count FROM users WHERE team_name = (SELECT name FROM teams WHERE id = ?)').get(id);
    // if (hasUsers.count > 0) throw new Error('该团队下已有成员，无法删除');
    
    const result = database.prepare('DELETE FROM teams WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // 获取所有团队（带人数统计）
  getTeams() {
    const database = getDatabase();
    return database.prepare(`
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM users u WHERE u.team_name = t.name) as member_count
      FROM teams t
      ORDER BY member_count DESC, t.created_at DESC
    `).all();
  },

  // 获取指定团队的所有成员 (管理员用)
  getTeamMembers(teamName) {
    const database = getDatabase();
    return database.prepare(`
      SELECT * FROM users 
      WHERE team_name = ? 
      ORDER BY created_at DESC
    `).all(teamName);
  },

  // --- 用户相关 ---

  bindReferral(walletAddress, referrerAddress, teamName) {
    try {
      console.log('开始绑定，数据库路径:', DB_FILE);
      const database = getDatabase();
      
      // 检查是否已存在
      const existing = database.prepare(
        'SELECT * FROM users WHERE wallet_address = ?'
      ).get(walletAddress.toLowerCase());
      
      console.log('检查已存在用户:', existing);
      
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
      
      // 验证插入
      const count = database.prepare('SELECT COUNT(*) as count FROM users').get();
      console.log('当前数据库总用户数:', count.count);
      
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
      
      // 获取直推成员 (My Referrals)
      const teamMembers = database.prepare(
        'SELECT * FROM users WHERE referrer_address = ? ORDER BY created_at DESC'
      ).all(walletAddress.toLowerCase());
      
      // 获取同战队成员 (Team Mates - 同一个team_name的所有人)
      const teammates = database.prepare(
        'SELECT wallet_address, created_at FROM users WHERE team_name = ? ORDER BY created_at DESC'
      ).all(user.team_name);

      return {
        exists: true,
        user,
        teamMembers, // 直推下级
        teammates    // 战队队友
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
      
      // 团队分布 - 改为从 teams 表查询，确保显示所有团队
      const teams = database.prepare(`
        SELECT t.name as team_name, 
               (SELECT COUNT(*) FROM users u WHERE u.team_name = t.name) as member_count
        FROM teams t
        ORDER BY member_count DESC
      `).all();
      
      // 如果 teams 表为空（兼容旧数据），尝试从 users 表聚合
      if (teams.length === 0) {
        const legacyTeams = database.prepare(`
          SELECT team_name, COUNT(*) as member_count 
          FROM users 
          GROUP BY team_name
          ORDER BY member_count DESC
        `).all();
        if (legacyTeams.length > 0) {
          teams.push(...legacyTeams);
        }
      }
      
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
