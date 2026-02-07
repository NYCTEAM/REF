// import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径 - 使用持久化存储目录
const DB_DIR = process.env.DB_PATH || path.join(process.cwd(), 'data');
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
    const Database = require('better-sqlite3');
    database = new Database(DB_FILE);
    
    // 创建表
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT UNIQUE NOT NULL,
        referrer_address TEXT,
        team_name TEXT NOT NULL,
        total_sales DECIMAL(20, 2) DEFAULT 0,
        claimed_amount DECIMAL(20, 2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        leader_address TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        amount DECIMAL(20, 2) NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, approved, rejected
        tx_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 检查 users 表是否有新字段，如果没有则添加 (用于迁移)
    try {
      database.prepare('SELECT claimed_amount FROM users LIMIT 1').get();
    } catch (e) {
      console.log('添加新字段到 users 表...');
      database.exec('ALTER TABLE users ADD COLUMN total_sales DECIMAL(20, 2) DEFAULT 0');
      database.exec('ALTER TABLE users ADD COLUMN claimed_amount DECIMAL(20, 2) DEFAULT 0');
    }

    try {
      database.prepare('SELECT nft_mint_amount FROM users LIMIT 1').get();
    } catch (e) {
      console.log('添加 NFT 统计字段到 users 表...');
      database.exec('ALTER TABLE users ADD COLUMN nft_count INTEGER DEFAULT 0');
      database.exec('ALTER TABLE users ADD COLUMN nft_mint_amount DECIMAL(20, 2) DEFAULT 0');
    }

    console.log('SQLite数据库初始化完成');
  }
  return database;
}

export const db = {
  // --- 用户数据同步 ---
  
  // 更新用户 NFT 统计数据
  updateUserNftStats(walletAddress, count, mintAmount) {
    const database = getDatabase();
    const result = database.prepare(`
      UPDATE users 
      SET nft_count = ?, nft_mint_amount = ?, total_sales = ?
      WHERE wallet_address = ?
    `).run(count, mintAmount, mintAmount, walletAddress.toLowerCase());
    return result.changes > 0;
  },

  // --- 提现/工单相关 ---
  
  // 创建提现申请
  createWithdrawal(userAddress, amount) {
    const database = getDatabase();
    return database.transaction(() => {
        // 插入提现记录
        const stmt = database.prepare(`
          INSERT INTO withdrawals (user_address, amount, status)
          VALUES (?, ?, 'pending')
        `);
        const result = stmt.run(userAddress.toLowerCase(), amount);
        return { success: true, id: result.lastInsertRowid };
    })();
  },

  // 获取用户已提现总额
  getUserClaimedAmount(userAddress) {
    const database = getDatabase();
    const user = database.prepare('SELECT claimed_amount FROM users WHERE wallet_address = ?').get(userAddress.toLowerCase());
    return user ? user.claimed_amount : 0;
  },

  // 获取所有待审核提现 (管理员用)
  getPendingWithdrawals() {
    const database = getDatabase();
    return database.prepare(`
      SELECT * FROM withdrawals WHERE status = 'pending' ORDER BY created_at ASC
    `).all();
  },

  // 获取所有提现记录 (管理员用 - 历史记录)
  getAllWithdrawals() {
    const database = getDatabase();
    return database.prepare(`
      SELECT * FROM withdrawals ORDER BY created_at DESC
    `).all();
  },

  // 处理提现 (管理员用)
  processWithdrawal(id, status, txHash = null) {
    const database = getDatabase();
    return database.transaction(() => {
      const withdrawal = database.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
      if (!withdrawal) throw new Error('工单不存在');
      
      if (status === 'approved') {
        // 更新用户已提现金额
        database.prepare(`
          UPDATE users 
          SET claimed_amount = claimed_amount + ? 
          WHERE wallet_address = ?
        `).run(withdrawal.amount, withdrawal.user_address);
      }
      
      // 更新工单状态
      database.prepare(`
        UPDATE withdrawals 
        SET status = ?, tx_hash = ? 
        WHERE id = ?
      `).run(status, txHash, id);
      
      return true;
    })();
  },

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
    
    // 1. 获取团队名称
    const team = database.prepare('SELECT name FROM teams WHERE id = ?').get(id);
    if (!team) return false;

    // 2. 删除该团队下的所有成员 (释放这些钱包地址，使其可以重新绑定)
    database.prepare('DELETE FROM users WHERE team_name = ?').run(team.name);
    
    // 3. 删除团队
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

  // 根据团队长地址获取团队信息
  getTeamByLeader(address) {
    const database = getDatabase();
    return database.prepare(`
      SELECT * FROM teams 
      WHERE leader_address = ? COLLATE NOCASE
    `).get(address);
  },

  // 重置数据库 (危险操作)
  resetDatabase() {
    const database = getDatabase();
    const deleteUsers = database.prepare('DELETE FROM users');
    const deleteTeams = database.prepare('DELETE FROM teams');
    const resetSeq = database.prepare('DELETE FROM sqlite_sequence'); // 重置自增ID

    database.transaction(() => {
      deleteUsers.run();
      deleteTeams.run();
      resetSeq.run();
    })();
    
    return true;
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

      // --- 关键修改：自动继承推荐人的团队 ---
      if (referrerAddress) {
        // 1. 检查推荐人是否为现有用户
        const referrerUser = database.prepare(
          'SELECT team_name FROM users WHERE wallet_address = ?'
        ).get(referrerAddress.toLowerCase());

        if (referrerUser) {
          console.log(`继承推荐人(${referrerAddress})的团队: ${referrerUser.team_name}`);
          teamName = referrerUser.team_name;
        } else {
          // 2. 检查推荐人是否为团队长
          const referrerTeam = database.prepare(
            'SELECT name FROM teams WHERE leader_address = ?'
          ).get(referrerAddress.toLowerCase());
          
          if (referrerTeam) {
            console.log(`继承团队长(${referrerAddress})的团队: ${referrerTeam.name}`);
            teamName = referrerTeam.name;
          }
        }
      }
      // ---------------------------------------
      
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
      
      // 获取所有正式定义的团队
      const definedTeams = database.prepare(`
        SELECT t.name as team_name, t.description, t.leader_address,
               (SELECT COUNT(*) FROM users u WHERE u.team_name = t.name) as member_count
        FROM teams t
      `).all();

      // 获取所有非正式团队 (Ad-hoc teams, e.g. Node-xxx)
      const adhocTeams = database.prepare(`
        SELECT team_name, COUNT(*) as member_count
        FROM users
        WHERE team_name NOT IN (SELECT name FROM teams)
        GROUP BY team_name
      `).all();

      // 合并列表并排序
      const teams = [...definedTeams, ...adhocTeams.map(t => ({
        ...t,
        description: '自动生成节点', // 标记为自动生成的节点
        leader_address: null
      }))].sort((a, b) => b.member_count - a.member_count);
      
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

      // NFT 销售统计
      const nftStats = database.prepare(`
        SELECT 
          SUM(nft_count) as total_nft_sold,
          SUM(nft_mint_amount) as total_nft_value
        FROM users
      `).get();

      // NFT 销售排名 (个人)
      const nftSalesRanking = database.prepare(`
        SELECT 
          wallet_address,
          nft_count,
          nft_mint_amount,
          team_name,
          created_at
        FROM users
        WHERE nft_count > 0
        ORDER BY nft_count DESC, nft_mint_amount DESC
        LIMIT 20
      `).all();

      // 团队 NFT 销售统计
      const teamNFTStats = database.prepare(`
        SELECT 
          team_name,
          COUNT(*) as member_count,
          SUM(nft_count) as team_nft_count,
          SUM(nft_mint_amount) as team_nft_value
        FROM users
        GROUP BY team_name
        HAVING team_nft_count > 0
        ORDER BY team_nft_value DESC
      `).all();
      
      console.log('统计数据:', {
        totalUsers,
        usersWithReferrer,
        teamsCount: teams.length,
        rankingCount: referrerRanking.length,
        totalNFTsSold: nftStats.total_nft_sold || 0,
        totalNFTValue: nftStats.total_nft_value || 0
      });
      
      return {
        totalUsers,
        usersWithReferrer,
        teams,
        teamsCount: teams.length,
        allUsers,
        referrerRanking,
        totalNFTsSold: nftStats.total_nft_sold || 0,
        totalNFTValue: nftStats.total_nft_value || 0,
        nftSalesRanking,
        teamNFTStats
      };
    } catch (error) {
      console.error('getStats error:', error);
      throw error;
    }
  }
};
