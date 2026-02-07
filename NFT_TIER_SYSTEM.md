# NFT 等级价格系统设计

## 📊 系统概述

通过 NFT 的 Token ID 范围或属性来区分不同等级，每个等级对应不同的价格。

## 🎨 等级方案示例

### 方案 A: 按 Token ID 范围划分

```javascript
const NFT_TIERS = {
  BRONZE: {
    name: '青铜级',
    price: 100,
    range: [1, 1000],      // Token ID 1-1000
    color: '#CD7F32'
  },
  SILVER: {
    name: '白银级',
    price: 200,
    range: [1001, 5000],   // Token ID 1001-5000
    color: '#C0C0C0'
  },
  GOLD: {
    name: '黄金级',
    price: 500,
    range: [5001, 8000],   // Token ID 5001-8000
    color: '#FFD700'
  },
  PLATINUM: {
    name: '铂金级',
    price: 1000,
    range: [8001, 9500],   // Token ID 8001-9500
    color: '#E5E4E2'
  },
  DIAMOND: {
    name: '钻石级',
    price: 2000,
    range: [9501, 10000],  // Token ID 9501-10000
    color: '#B9F2FF'
  }
};
```

### 方案 B: 简化版（3个等级）

```javascript
const NFT_TIERS = [
  { name: '普通版', price: 100, range: [1, 5000] },
  { name: '高级版', price: 300, range: [5001, 9000] },
  { name: '限量版', price: 1000, range: [9001, 10000] }
];
```

## 🗄️ 数据库设计

### 创建 NFT 等级配置表

```sql
CREATE TABLE nft_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier_name TEXT NOT NULL,           -- 等级名称
  price DECIMAL(20, 2) NOT NULL,     -- 价格（USDT）
  token_id_start INTEGER NOT NULL,   -- Token ID 起始
  token_id_end INTEGER NOT NULL,     -- Token ID 结束
  description TEXT,                  -- 描述
  color TEXT,                        -- 显示颜色
  is_active BOOLEAN DEFAULT 1,       -- 是否启用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认数据
INSERT INTO nft_tiers (tier_name, price, token_id_start, token_id_end, description, color) VALUES
('青铜级', 100, 1, 1000, '入门级 NFT', '#CD7F32'),
('白银级', 200, 1001, 5000, '进阶级 NFT', '#C0C0C0'),
('黄金级', 500, 5001, 8000, '高级 NFT', '#FFD700'),
('铂金级', 1000, 8001, 9500, '稀有 NFT', '#E5E4E2'),
('钻石级', 2000, 9501, 10000, '传奇 NFT', '#B9F2FF');
```

### 创建用户 NFT 持有记录表

```sql
CREATE TABLE user_nfts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,        -- 用户地址
  token_id INTEGER NOT NULL,         -- NFT Token ID
  tier_id INTEGER,                   -- 等级 ID（外键）
  mint_price DECIMAL(20, 2),         -- MINT 时的价格
  mint_tx_hash TEXT,                 -- MINT 交易哈希
  mint_block_number INTEGER,         -- MINT 区块号
  mint_timestamp DATETIME,           -- MINT 时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tier_id) REFERENCES nft_tiers(id)
);

-- 创建索引
CREATE INDEX idx_user_nfts_address ON user_nfts(user_address);
CREATE INDEX idx_user_nfts_token_id ON user_nfts(token_id);
```

## 💻 实现代码

### 1. 数据库方法（lib/sqlite-db.js）

```javascript
// 获取所有 NFT 等级配置
getNFTTiers() {
  const database = getDatabase();
  return database.prepare(`
    SELECT * FROM nft_tiers 
    WHERE is_active = 1 
    ORDER BY token_id_start ASC
  `).all();
},

// 根据 Token ID 获取等级和价格
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
  return database.prepare(`
    INSERT INTO user_nfts 
    (user_address, token_id, tier_id, mint_price, mint_tx_hash, mint_block_number, mint_timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userAddress.toLowerCase(), tokenId, tierId, mintPrice, txHash, blockNumber, timestamp);
},

// 获取用户所有 NFT 及总价值
getUserNFTsWithValue(userAddress) {
  const database = getDatabase();
  return database.prepare(`
    SELECT 
      un.*,
      nt.tier_name,
      nt.price as tier_price,
      COALESCE(un.mint_price, nt.price) as effective_price
    FROM user_nfts un
    LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
    WHERE un.user_address = ?
    ORDER BY un.created_at DESC
  `).all(userAddress.toLowerCase());
},

// 获取用户 NFT 统计（按等级分组）
getUserNFTStats(userAddress) {
  const database = getDatabase();
  const stats = database.prepare(`
    SELECT 
      nt.tier_name,
      nt.price,
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
  
  return { stats, total };
}
```

### 2. 链上同步逻辑（增强版）

```javascript
async function syncUserNFTsWithTiers(userAddress) {
  const provider = new ethers.JsonRpcProvider(CUSTOM_RPC);
  const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
  
  // 1. 获取 NFT 等级配置
  const tiers = await fetch('/api/nft-tiers').then(r => r.json());
  
  // 2. 获取用户的所有 MINT 事件
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
  const userTopic = ethers.zeroPadValue(userAddress, 32);
  
  const filter = {
    address: NFT_CONTRACT_ADDRESS,
    topics: [transferTopic, zeroAddressTopic, userTopic],
    fromBlock: 0,
    toBlock: 'latest'
  };
  
  const logs = await provider.getLogs(filter);
  
  // 3. 解析每个 MINT 事件
  const nfts = [];
  for (const log of logs) {
    // 解析 Token ID（通常在 data 或 topics[3]）
    const tokenId = parseInt(log.topics[3], 16);
    
    // 根据 Token ID 查找等级
    const tier = tiers.find(t => 
      tokenId >= t.token_id_start && tokenId <= t.token_id_end
    );
    
    // 获取交易详情
    const tx = await provider.getTransaction(log.transactionHash);
    const block = await provider.getBlock(log.blockNumber);
    
    nfts.push({
      tokenId,
      tierId: tier?.id,
      tierName: tier?.tier_name,
      price: tier?.price || 100, // 默认价格
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: new Date(block.timestamp * 1000).toISOString()
    });
  }
  
  // 4. 保存到数据库
  await fetch('/api/user/sync-nfts-detailed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      nfts
    })
  });
  
  return nfts;
}
```

### 3. API 路由

#### `/api/nft-tiers` - 获取等级配置

```javascript
// app/api/nft-tiers/route.js
import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tiers = db.getNFTTiers();
    return NextResponse.json({ success: true, tiers });
  } catch (error) {
    console.error('获取 NFT 等级失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

#### `/api/user/sync-nfts-detailed` - 详细同步

```javascript
// app/api/user/sync-nfts-detailed/route.js
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userAddress, nfts } = await request.json();
    
    // 清除旧记录（可选）
    // db.clearUserNFTs(userAddress);
    
    // 保存每个 NFT
    let totalValue = 0;
    for (const nft of nfts) {
      db.saveUserNFT(
        userAddress,
        nft.tokenId,
        nft.tierId,
        nft.price,
        nft.txHash,
        nft.blockNumber,
        nft.timestamp
      );
      totalValue += nft.price;
    }
    
    // 更新用户统计
    db.updateUserNftStats(userAddress, nfts.length, totalValue);
    
    return NextResponse.json({
      success: true,
      count: nfts.length,
      totalValue
    });
  } catch (error) {
    console.error('同步 NFT 详情失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 🎨 前端显示

### 用户 NFT 列表（按等级分组）

```javascript
// 获取用户 NFT 统计
const { stats, total } = await fetch(`/api/user/${walletAddress}/nft-stats`)
  .then(r => r.json());

// 显示
<div className="space-y-4">
  <div className="text-2xl font-bold">
    总计: {total.total_count} 个 NFT，价值 {total.total_value} USDT
  </div>
  
  {stats.map(tier => (
    <div key={tier.tier_name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div 
          className="w-4 h-4 rounded-full" 
          style={{ backgroundColor: tier.color }}
        />
        <span className="font-semibold">{tier.tier_name}</span>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold">{tier.count} 个</div>
        <div className="text-sm text-gray-600">{tier.total_value} USDT</div>
      </div>
    </div>
  ))}
</div>
```

## 🔧 管理后台功能

### NFT 等级管理

```javascript
// 管理员可以：
1. 查看所有等级配置
2. 添加新等级
3. 修改等级价格
4. 修改 Token ID 范围
5. 启用/禁用等级
```

### 批量同步功能增强

```javascript
// 在管理后台的同步功能中：
1. 扫描所有用户
2. 获取每个用户的 NFT Token ID
3. 根据 Token ID 匹配等级
4. 计算准确的总价值
5. 更新数据库
```

## ✅ 优势

1. **准确性**: 每个 NFT 都有准确的价格记录
2. **灵活性**: 可以随时调整等级和价格
3. **可追溯**: 保留完整的 MINT 历史
4. **可扩展**: 支持未来添加更多等级
5. **性能**: 数据库查询快速，无需每次查链上

## 📊 数据流程

```
链上 MINT 事件
  ↓
解析 Token ID
  ↓
匹配 NFT 等级
  ↓
获取等级价格
  ↓
保存到 user_nfts 表
  ↓
更新 users 表统计
  ↓
计算佣金比例
```

## 🚀 实施步骤

### 第一步：数据库迁移
```sql
-- 创建 nft_tiers 表
-- 创建 user_nfts 表
-- 插入默认等级数据
```

### 第二步：添加数据库方法
```javascript
// 在 lib/sqlite-db.js 中添加方法
```

### 第三步：创建 API 路由
```javascript
// /api/nft-tiers
// /api/user/sync-nfts-detailed
```

### 第四步：更新同步逻辑
```javascript
// 修改前端和管理后台的同步代码
```

### 第五步：更新 UI 显示
```javascript
// 显示等级信息
// 显示详细的 NFT 列表
```

## 💡 建议

**推荐使用方案 B（3个等级）**，因为：
- 简单易懂
- 容易管理
- 满足大部分需求
- 可以后续扩展

**Token ID 范围示例**：
- 普通版 (100 USDT): Token ID 1-5000
- 高级版 (300 USDT): Token ID 5001-9000  
- 限量版 (1000 USDT): Token ID 9001-10000

这样系统会更加准确和灵活！
