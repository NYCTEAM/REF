// 内存数据库 - Vercel兼容版本
// 注意：数据在每次部署后会重置

let users = [];
let nextId = 1;

export const db = {
  // 绑定推荐关系
  bindReferral: (walletAddress, referrerAddress, teamName) => {
    // 检查是否已存在
    const existing = users.find(u => u.wallet_address.toLowerCase() === walletAddress.toLowerCase());
    if (existing) {
      return { success: false, alreadyBound: true };
    }

    // 添加新用户
    const user = {
      id: nextId++,
      wallet_address: walletAddress,
      referrer_address: referrerAddress || null,
      team_name: teamName,
      created_at: new Date().toISOString()
    };
    
    users.push(user);
    return { success: true, user };
  },

  // 获取用户信息
  getUserInfo: (walletAddress) => {
    const user = users.find(u => u.wallet_address.toLowerCase() === walletAddress.toLowerCase());
    if (!user) {
      return { exists: false };
    }

    // 获取团队成员
    const teamMembers = users.filter(u => 
      u.referrer_address && 
      u.referrer_address.toLowerCase() === walletAddress.toLowerCase()
    );

    return {
      exists: true,
      user,
      teamMembers
    };
  },

  // 获取统计数据
  getStats: () => {
    // 总用户数
    const totalUsers = users.length;

    // 有推荐人的用户数
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

    // 所有用户
    const allUsers = [...users].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    // 推荐人排名
    const referrerMap = {};
    users.forEach(user => {
      if (user.referrer_address) {
        if (!referrerMap[user.referrer_address]) {
          referrerMap[user.referrer_address] = {
            referrer_address: user.referrer_address,
            referral_count: 0,
            first_referral_time: user.created_at
          };
        }
        referrerMap[user.referrer_address].referral_count++;
        if (user.created_at < referrerMap[user.referrer_address].first_referral_time) {
          referrerMap[user.referrer_address].first_referral_time = user.created_at;
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
      allUsers,
      referrerRanking
    };
  },

  // 获取团队成员
  getTeamMembers: (referrerAddress) => {
    return users.filter(u => 
      u.referrer_address && 
      u.referrer_address.toLowerCase() === referrerAddress.toLowerCase()
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
};
