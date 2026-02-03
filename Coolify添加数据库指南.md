# Coolify 添加数据库指南

## 🗄️ 在Coolify中添加PostgreSQL数据库

### 步骤1: 创建数据库服务

1. **在Coolify左侧菜单中**
   - 点击 **"+ Add Resource"** 或 **"Resources"**
   - 选择 **"Database"**

2. **选择数据库类型**
   - 选择 **PostgreSQL**（推荐）
   - 或者选择 **MySQL/MariaDB**

3. **配置数据库**
   ```
   Name: referral-db
   Version: 16 (PostgreSQL最新稳定版)
   Database Name: referral_system
   Username: referral_user
   Password: (自动生成或自定义)
   ```

4. **点击 "Create"**

### 步骤2: 获取数据库连接信息

数据库创建后，在数据库详情页面可以看到：

```
Host: referral-db (内部网络名称)
Port: 5432
Database: referral_system
Username: referral_user
Password: ********
```

**连接字符串格式：**
```
postgresql://referral_user:password@referral-db:5432/referral_system
```

### 步骤3: 配置应用环境变量

1. **返回您的应用配置页面**
2. **找到 "Environment Variables" 部分**
3. **添加以下环境变量：**

```
DATABASE_URL=postgresql://referral_user:password@referral-db:5432/referral_system
```

### 步骤4: 修改代码使用PostgreSQL

需要修改 `lib/db.js` 使用PostgreSQL而不是内存数据库。

## 🔄 快速方案：使用Redis（更简单）

### 为什么选择Redis？
- ✅ 配置更简单
- ✅ 代码修改更少
- ✅ 性能更好
- ✅ 适合当前数据结构

### 在Coolify中添加Redis

1. **点击 "+ Add Resource"**
2. **选择 "Database"**
3. **选择 "Redis"**
4. **配置：**
   ```
   Name: referral-redis
   Version: 7
   ```
5. **点击 "Create"**

### 获取Redis连接信息

```
Host: referral-redis
Port: 6379
URL: redis://referral-redis:6379
```

### 配置环境变量

在应用中添加：
```
REDIS_URL=redis://referral-redis:6379
```

## 📝 最简单的方案：使用内存数据库（当前方案）

**优点：**
- ✅ 无需额外配置
- ✅ 立即可用
- ✅ 适合演示

**缺点：**
- ⚠️ 重启后数据丢失

**如果您的应用不需要长期保存数据，当前方案已经足够！**

## 🎯 推荐方案对比

| 方案 | 难度 | 数据持久化 | 适用场景 |
|------|------|-----------|---------|
| 内存数据库（当前） | ⭐ 简单 | ❌ | 演示、测试 |
| Redis | ⭐⭐ 中等 | ✅ | 生产环境 |
| PostgreSQL | ⭐⭐⭐ 复杂 | ✅ | 大型应用 |

## 🚀 如果选择Redis方案

### 1. 在Coolify添加Redis

左侧菜单 → **Resources** → **+ Add** → **Database** → **Redis**

### 2. 安装Redis依赖

修改 `package.json`：
```json
"dependencies": {
  "redis": "^4.6.0",
  ...其他依赖
}
```

### 3. 创建Redis数据库模块

创建 `lib/redis-db.js`：
```javascript
import { createClient } from 'redis';

let client = null;

async function getRedisClient() {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await client.connect();
  }
  return client;
}

export const db = {
  async bindReferral(walletAddress, referrerAddress, teamName) {
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
    
    // 添加到推荐人的团队成员列表
    if (referrerAddress) {
      await client.sAdd(`team:${referrerAddress.toLowerCase()}`, walletAddress);
    }
    
    return { success: true, user };
  },
  
  async getUserInfo(walletAddress) {
    const client = await getRedisClient();
    const key = `user:${walletAddress.toLowerCase()}`;
    const userData = await client.get(key);
    
    if (!userData) {
      return { exists: false };
    }
    
    const user = JSON.parse(userData);
    
    // 获取团队成员
    const teamMemberAddresses = await client.sMembers(`team:${walletAddress.toLowerCase()}`);
    const teamMembers = await Promise.all(
      teamMemberAddresses.map(async (addr) => {
        const memberData = await client.get(`user:${addr.toLowerCase()}`);
        return memberData ? JSON.parse(memberData) : null;
      })
    );
    
    return {
      exists: true,
      user,
      teamMembers: teamMembers.filter(m => m !== null)
    };
  },
  
  async getStats() {
    const client = await getRedisClient();
    const keys = await client.keys('user:*');
    
    const users = await Promise.all(
      keys.map(async (key) => {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
      })
    );
    
    const validUsers = users.filter(u => u !== null);
    
    // 统计数据
    const totalUsers = validUsers.length;
    const usersWithReferrer = validUsers.filter(u => u.referrer_address).length;
    
    // 团队分布
    const teamMap = {};
    validUsers.forEach(user => {
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
    validUsers.forEach(user => {
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
      allUsers: validUsers.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ),
      referrerRanking
    };
  }
};
```

### 4. 更新API路由

将所有API路由中的导入改为：
```javascript
import { db } from '../../../lib/redis-db.js';
```

### 5. 添加环境变量

在Coolify应用配置中添加：
```
REDIS_URL=redis://referral-redis:6379
```

### 6. 重新部署

推送代码到GitHub，Coolify会自动重新部署。

## 💡 我的建议

### 如果只是演示/测试
**使用当前的内存数据库方案**
- 无需任何额外配置
- 立即可用
- 重启后数据重置（可接受）

### 如果需要生产环境
**使用Redis方案**
1. 在Coolify添加Redis服务（2分钟）
2. 我帮您修改代码使用Redis（5分钟）
3. 推送并重新部署（3分钟）

**总共只需10分钟即可实现数据持久化！**

## 🔧 需要我帮您实现Redis方案吗？

如果您决定使用Redis，告诉我，我会：
1. 修改代码使用Redis
2. 更新package.json
3. 提供详细的Coolify配置步骤
4. 推送代码到GitHub

现在您可以：
1. **继续使用内存数据库**（无需任何操作，当前已可用）
2. **添加Redis**（我帮您完成代码修改）
3. **添加PostgreSQL**（需要更多代码修改）

您想选择哪个方案？
