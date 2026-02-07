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

      CREATE TABLE IF NOT EXISTS nft_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier_name TEXT NOT NULL,
        price DECIMAL(20, 2) NOT NULL,
        token_id_start INTEGER NOT NULL,
        token_id_end INTEGER NOT NULL,
        description TEXT,
        color TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_nfts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        token_id INTEGER NOT NULL,
        tier_id INTEGER,
        mint_price DECIMAL(20, 2),
        mint_tx_hash TEXT,
        mint_block_number INTEGER,
        mint_timestamp DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tier_id) REFERENCES nft_tiers(id)
      );

      CREATE TABLE IF NOT EXISTS sync_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT UNIQUE NOT NULL,
        last_synced_block INTEGER NOT NULL DEFAULT 79785738,
        last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_nfts_found INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending'
      );
    `);
    
    // 创建索引
    try {
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_nfts_address ON user_nfts(user_address);
        CREATE INDEX IF NOT EXISTS idx_user_nfts_token_id ON user_nfts(token_id);
      `);
    } catch (e) {
      // 索引可能已存在
    }
    
    // 插入默认 NFT 等级（如果表为空）
    const tierCount = database.prepare('SELECT COUNT(*) as count FROM nft_tiers').get();
    if (tierCount.count === 0) {
      console.log('插入默认 NFT 等级配置（7个等级，总计13900个）...');
      database.exec(`
        INSERT INTO nft_tiers (tier_name, price, token_id_start, token_id_end, description, color) VALUES
        ('Micro Node 🪙', 10, 1, 5000, '入门级节点 - 0.1x 算力 (5000个)', '#94A3B8'),
        ('Mini Node ⚪', 25, 5001, 8000, '初级节点 - 0.3x 算力 (3000个)', '#60A5FA'),
        ('Bronze Node 🥉', 50, 8001, 10000, '青铜节点 - 0.5x 算力 (2000个)', '#CD7F32'),
        ('Silver Node 🥈', 100, 10001, 11500, '白银节点 - 1x 算力 (1500个)', '#C0C0C0'),
        ('Gold Node 🥇', 250, 11501, 12600, '黄金节点 - 3x 算力 (1100个)', '#FFD700'),
        ('Platinum Node 💎', 500, 12601, 13300, '铂金节点 - 7x 算力 (700个)', '#E5E4E2'),
        ('Diamond Node 💠', 1000, 13301, 13900, '钻石节点 - 15x 算力 (600个)', '#B9F2FF');
      `);
    }
    
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

    try {
      database.prepare('SELECT commission_rate FROM users LIMIT 1').get();
    } catch (e) {
      console.log('添加佣金比例字段到 users 表...');
      database.exec('ALTER TABLE users ADD COLUMN commission_rate DECIMAL(5, 4) DEFAULT 0.10');
    }

    console.log('SQLite数据库初始化完成');
  }
  return database;
}

// 🔥 分阶段计算佣金
// 业绩 0-2000 USDT: 10%
// 业绩 2001-10000 USDT: 15%
// 业绩 10001+ USDT: 20%
function calculateTieredCommission(totalPerformance) {
  let commission = 0;
  
  if (totalPerformance <= 0) {
    return 0;
  }
  
  // 第一阶段: 0-2000 USDT @ 10%
  if (totalPerformance <= 2000) {
    commission = totalPerformance * 0.10;
  } else {
    commission = 2000 * 0.10; // 前 2000 的佣金
    
    // 第二阶段: 2001-10000 USDT @ 15%
    if (totalPerformance <= 10000) {
      commission += (totalPerformance - 2000) * 0.15;
    } else {
      commission += 8000 * 0.15; // 2001-10000 的佣金
      
      // 第三阶段: 10001+ USDT @ 20%
      commission += (totalPerformance - 10000) * 0.20;
    }
  }
  
  return commission;
}

export const db = {
  // --- 用户数据同步 ---
  
  // 分阶段计算佣金（导出供前端使用）
  calculateTieredCommission,
  
  // 更新用户 NFT 统计
  updateUserNftStats(walletAddress, nftCount, nftMintAmount) {
    const database = getDatabase();
    
    // 🔥 分阶段计算佣金比例
    // 0-2000: 10%
    // 2001-10000: 15%
    // 10001+: 20%
    let commissionRate = 0.10; // 默认比例（用于显示当前档位）
    
    if (nftMintAmount >= 10000) {
      commissionRate = 0.20;
    } else if (nftMintAmount >= 2000) {
      commissionRate = 0.15;
    }
    
    return database.prepare(`
      UPDATE users 
      SET nft_count = ?, 
          nft_mint_amount = ?,
          commission_rate = ?
      WHERE wallet_address = ?
    `).run(nftCount, nftMintAmount, commissionRate, walletAddress.toLowerCase());
  },

  // 更新用户 NFT 余额状态（用于显示"持有NFT"或"未持有NFT"）
  updateUserBalanceStatus(walletAddress, balanceCount, hasNFT) {
    const database = getDatabase();
    
    // 如果用户不存在，不做任何操作
    const user = database.prepare('SELECT id FROM users WHERE wallet_address = ?').get(walletAddress.toLowerCase());
    if (!user) {
      console.log(`⚠️ 用户 ${walletAddress} 不存在，跳过余额更新`);
      return;
    }
    
    // 更新余额状态（可以添加一个新字段 nft_balance_count）
    // 这里暂时使用 nft_count 字段，如果需要区分 MINT 数量和余额数量，可以添加新字段
    return database.prepare(`
      UPDATE users 
      SET nft_count = ?
      WHERE wallet_address = ?
    `).run(balanceCount, walletAddress.toLowerCase());
  },  

  // --- NFT 等级管理 ---
  
  // 获取所有 NFT 等级
  getNFTTiers() {
    const database = getDatabase();
    return database.prepare(`
      SELECT * FROM nft_tiers 
      WHERE is_active = 1 
      ORDER BY token_id_start ASC
    `).all();
  },

  // 根据 Token ID 获取等级
  getNFTTierByTokenId(tokenId) {
    const database = getDatabase();
    return database.prepare(`
      SELECT * FROM nft_tiers 
      WHERE token_id_start <= ? AND token_id_end >= ? AND is_active = 1
      LIMIT 1
    `).get(tokenId, tokenId);
  },

  // 保存用户 NFT 记录
  saveUserNFT(userAddress, tokenId, tierId, mintPrice, txHash, blockNumber, timestamp) {
    const database = getDatabase();
    
    // 检查是否已存在
    const existing = database.prepare(`
      SELECT id FROM user_nfts 
      WHERE user_address = ? AND token_id = ?
    `).get(userAddress.toLowerCase(), tokenId);
    
    if (existing) {
      console.log(`NFT ${tokenId} 已存在，跳过`);
      return existing.id;
    }
    
    const result = database.prepare(`
      INSERT INTO user_nfts 
      (user_address, token_id, tier_id, mint_price, mint_tx_hash, mint_block_number, mint_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userAddress.toLowerCase(), tokenId, tierId, mintPrice, txHash, blockNumber, timestamp);
    
    return result.lastInsertRowid;
  },

  // 获取用户所有 NFT
  getUserNFTs(userAddress) {
    const database = getDatabase();
    return database.prepare(`
      SELECT 
        un.*,
        COALESCE(un.mint_price, nt.price) as price,
        nt.tier_name,
        nt.price as tier_price
      FROM user_nfts un
      LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
      WHERE un.user_address = ?
      ORDER BY un.mint_block_number DESC
    `).all(userAddress.toLowerCase());
  },

  // 获取用户 NFT 统计（按等级分组）
  getUserNFTStats(userAddress) {
    const database = getDatabase();
    
    const stats = database.prepare(`
      SELECT 
        nt.tier_name,
        nt.price,
        nt.color,
        COUNT(un.id) as count,
        SUM(COALESCE(un.mint_price, nt.price)) as total_value
      FROM user_nfts un
      LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
      WHERE un.user_address = ?
      GROUP BY nt.id
      ORDER BY nt.token_id_start ASC
    `).all(userAddress.toLowerCase());
    
    const total = database.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(COALESCE(un.mint_price, nt.price)) as total_value
      FROM user_nfts un
      LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
      WHERE un.user_address = ?
    `).get(userAddress.toLowerCase());
    
    return { stats, total: total || { total_count: 0, total_value: 0 } };
  },

  // 清除用户 NFT 记录（用于重新同步）
  clearUserNFTs(userAddress) {
    const database = getDatabase();
    return database.prepare(`
      DELETE FROM user_nfts WHERE user_address = ?
    `).run(userAddress.toLowerCase());
  },

  // --- 同步进度管理 ---

  // 获取用户同步进度
  getSyncProgress(userAddress) {
    const database = getDatabase();
    const progress = database.prepare(`
      SELECT * FROM sync_progress WHERE user_address = ?
    `).get(userAddress.toLowerCase());
    
    // 如果没有记录，返回默认起始区块
    return progress || {
      user_address: userAddress.toLowerCase(),
      last_synced_block: 79785738, // NFT 合约部署区块
      last_sync_time: null,
      total_nfts_found: 0,
      sync_status: 'pending'
    };
  },

  // 更新同步进度
  updateSyncProgress(userAddress, lastBlock, nftCount, status = 'completed') {
    const database = getDatabase();
    return database.prepare(`
      INSERT INTO sync_progress (user_address, last_synced_block, last_sync_time, total_nfts_found, sync_status)
      VALUES (?, ?, datetime('now'), ?, ?)
      ON CONFLICT(user_address) 
      DO UPDATE SET 
        last_synced_block = excluded.last_synced_block,
        last_sync_time = excluded.last_sync_time,
        total_nfts_found = excluded.total_nfts_found,
        sync_status = excluded.sync_status
    `).run(userAddress.toLowerCase(), lastBlock, nftCount, status);
  },

  // 重置同步进度（从头开始）
  resetSyncProgress(userAddress) {
    const database = getDatabase();
    return database.prepare(`
      DELETE FROM sync_progress WHERE user_address = ?
    `).run(userAddress.toLowerCase());
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

      // --- 只在推荐人是团队长时才继承团队 ---
      // 这样允许独立的直推关系，每个人可以有自己的团队
      if (referrerAddress && !teamName) {
        // 只检查推荐人是否为团队长
        const referrerTeam = database.prepare(
          'SELECT name FROM teams WHERE leader_address = ?'
        ).get(referrerAddress.toLowerCase());
        
        if (referrerTeam) {
          console.log(`推荐人是团队长，继承团队: ${referrerTeam.name}`);
          teamName = referrerTeam.name;
        } else {
          console.log(`推荐人不是团队长，保持用户选择的团队: ${teamName}`);
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

      // NFT 销售统计（只统计 MINT 事件，从 user_nfts 表）
      const nftStats = database.prepare(`
        SELECT 
          COUNT(*) as total_nft_sold,
          SUM(COALESCE(un.mint_price, nt.price)) as total_nft_value
        FROM user_nfts un
        LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
      `).get();

      // NFT 销售排名 (个人) - 基于 MINT 价值
      const nftSalesRanking = database.prepare(`
        SELECT 
          wallet_address,
          nft_count,
          nft_mint_amount,
          team_name,
          created_at
        FROM users
        WHERE nft_mint_amount > 0
        ORDER BY nft_mint_amount DESC, nft_count DESC
        LIMIT 20
      `).all();

      // 团队 NFT 销售统计（基于 MINT 价值）
      const teamNFTStats = database.prepare(`
        SELECT 
          team_name,
          COUNT(*) as member_count,
          SUM(nft_count) as team_nft_count,
          SUM(nft_mint_amount) as team_nft_value
        FROM users
        GROUP BY team_name
        HAVING team_nft_value > 0
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
  },

  // 🔥 获取推荐人排名（按直推业绩排序）
  getReferrerRanking(limit = 20) {
    const database = getDatabase();
    
    try {
      // 查询所有推荐人及其直推团队的总业绩
      const ranking = database.prepare(`
        SELECT 
          u.wallet_address,
          u.team_name,
          u.created_at,
          COUNT(t.id) as referral_count,
          SUM(COALESCE(t.nft_mint_amount, 0)) as total_performance,
          SUM(COALESCE(t.nft_count, 0)) as total_nft_count
        FROM users u
        LEFT JOIN users t ON t.referrer_address = u.wallet_address
        WHERE u.wallet_address IS NOT NULL
        GROUP BY u.wallet_address
        HAVING referral_count > 0
        ORDER BY total_performance DESC, referral_count DESC
        LIMIT ?
      `).all(limit);
      
      // 计算每个推荐人的预计佣金
      return ranking.map(item => {
        const commission = calculateTieredCommission(item.total_performance || 0);
        
        return {
          ...item,
          estimated_commission: commission
        };
      });
    } catch (error) {
      console.error('getReferrerRanking error:', error);
      return [];
    }
  }
};
