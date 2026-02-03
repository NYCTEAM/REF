import { createClient } from 'redis';

let client = null;
let isConnecting = false;

async function getRedisClient() {
  if (client && client.isOpen) {
    return client;
  }

  if (isConnecting) {
    // 等待连接完成
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  isConnecting = true;
  
  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    client.on('error', (err) => console.error('Redis Client Error', err));
    
    await client.connect();
    isConnecting = false;
    return client;
  } catch (error) {
    isConnecting = false;
    console.error('Redis connection failed:', error);
    throw error;
  }
}

export const db = {
  async bindReferral(walletAddress, referrerAddress, teamName) {
    try {
      const client = await getRedisClient();
      const key = `user:${walletAddress.toLowerCase()}`;
      
      // 检查是否已存在
      const exists = await client.exists(key);
      if (exists) {
        return { success: false, alreadyBound: true };
      }
      
      // 保存用户数据
      const user = {
        wallet_address: walletAddress,
        referrer_address: referrerAddress || null,
        team_name: teamName,
        created_at: new Date().toISOString()
      };
      
      await client.set(key, JSON.stringify(user));
      
      // 添加到所有用户列表
      await client.sAdd('all_users', walletAddress.toLowerCase());
      
      // 添加到推荐人的团队成员列表
      if (referrerAddress) {
        await client.sAdd(`team:${referrerAddress.toLowerCase()}`, walletAddress.toLowerCase());
      }
      
      return { success: true, user };
    } catch (error) {
      console.error('bindReferral error:', error);
      throw error;
    }
  },
  
  async getUserInfo(walletAddress) {
    try {
      const client = await getRedisClient();
      const key = `user:${walletAddress.toLowerCase()}`;
      const userData = await client.get(key);
      
      if (!userData) {
        return { exists: false };
      }
      
      const user = JSON.parse(userData);
      
      // 获取团队成员
      const teamMemberAddresses = await client.sMembers(`team:${walletAddress.toLowerCase()}`);
      const teamMembers = [];
      
      for (const addr of teamMemberAddresses) {
        const memberData = await client.get(`user:${addr}`);
        if (memberData) {
          teamMembers.push(JSON.parse(memberData));
        }
      }
      
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
  
  async getStats() {
    try {
      const client = await getRedisClient();
      
      // 获取所有用户地址
      const userAddresses = await client.sMembers('all_users');
      
      // 获取所有用户数据
      const users = [];
      for (const addr of userAddresses) {
        const userData = await client.get(`user:${addr}`);
        if (userData) {
          users.push(JSON.parse(userData));
        }
      }
      
      // 统计数据
      const totalUsers = users.length;
      const usersWithReferrer = users.filter(u => u.referrer_address).length;
      
      // 团队分布
      const teamMap = {};
      users.forEach(user => {
        if (!teamMap[user.team_name]) {
          teamMap[user.team_name] = 0;
        }
        teamMap[user.team_name]++;
      });
      const teams = Object.keys(teamMap).map(team_name => ({
        team_name,
        member_count: teamMap[team_name]
      }));
      
      // 推荐人排名
      const referrerMap = {};
      users.forEach(user => {
        if (user.referrer_address) {
          const refAddr = user.referrer_address.toLowerCase();
          if (!referrerMap[refAddr]) {
            referrerMap[refAddr] = {
              referrer_address: user.referrer_address,
              referral_count: 0,
              first_referral_time: user.created_at
            };
          }
          referrerMap[refAddr].referral_count++;
          if (user.created_at < referrerMap[refAddr].first_referral_time) {
            referrerMap[refAddr].first_referral_time = user.created_at;
          }
        }
      });
      
      const referrerRanking = Object.values(referrerMap).sort((a, b) => {
        if (b.referral_count !== a.referral_count) {
          return b.referral_count - a.referral_count;
        }
        return new Date(a.first_referral_time) - new Date(b.first_referral_time);
      });
      
      return {
        totalUsers,
        usersWithReferrer,
        teams,
        allUsers: users.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        ),
        referrerRanking
      };
    } catch (error) {
      console.error('getStats error:', error);
      throw error;
    }
  }
};
