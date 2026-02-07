# NFT 同步方案（简化版）

## ✅ 使用 NFT 等级系统

### 核心逻辑

```javascript
// 1. 获取 NFT 等级配置
const tiers = [
  { id: 1, name: '普通版', price: 100, token_id_start: 1, token_id_end: 5000 },
  { id: 2, name: '高级版', price: 300, token_id_start: 5001, token_id_end: 9000 },
  { id: 3, name: '限量版', price: 1000, token_id_start: 9001, token_id_end: 10000 }
];

// 2. 扫描用户的 NFT MINT 事件
const nftLogs = await provider.getLogs({
  address: NFT_CONTRACT_ADDRESS,
  topics: [
    ethers.id("Transfer(address,address,uint256)"),
    ethers.zeroPadValue(ethers.ZeroAddress, 32), // from 0x0
    ethers.zeroPadValue(userAddress, 32)          // to user
  ],
  fromBlock: 0,
  toBlock: 'latest'
});

// 3. 解析每个 MINT 事件，根据 Token ID 匹配等级
let totalValue = 0;
const nfts = [];

for (const log of nftLogs) {
  // 解析 Token ID（在 topics[3] 或 data 中）
  const tokenId = parseInt(log.topics[3], 16);
  
  // 根据 Token ID 查找等级
  const tier = tiers.find(t => 
    tokenId >= t.token_id_start && tokenId <= t.token_id_end
  );
  
  if (tier) {
    nfts.push({
      tokenId,
      tierId: tier.id,
      tierName: tier.name,
      price: tier.price,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber
    });
    
    totalValue += tier.price;
  }
}

// 4. 保存到数据库
await fetch('/api/user/sync-nft', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: userAddress,
    nftCount: nfts.length,
    mintAmount: totalValue,
    nfts: nfts // 详细的 NFT 列表
  })
});
```

## 📊 数据流程

```
1. 扫描链上 MINT 事件
   ↓
2. 获取 Token ID
   ↓
3. 匹配 NFT 等级（根据 Token ID 范围）
   ↓
4. 使用等级价格（100/300/1000 USDT）
   ↓
5. 保存到数据库
   - user_nfts 表：每个 NFT 的详细信息
   - users 表：汇总统计（nft_count, nft_mint_amount）
```

## 🎯 优势

✅ **简单高效**：不需要查询 USDT 合约  
✅ **准确可靠**：等级价格由管理员配置  
✅ **灵活可控**：可以随时调整等级和价格  
✅ **性能优秀**：只需要查询一次 NFT Transfer 事件  

## 💾 数据库结构

### nft_tiers 表（等级配置）
```sql
id | tier_name | price | token_id_start | token_id_end | color
---|-----------|-------|----------------|--------------|--------
1  | 普通版    | 100   | 1              | 5000         | #3B82F6
2  | 高级版    | 300   | 5001           | 9000         | #8B5CF6
3  | 限量版    | 1000  | 9001           | 10000        | #F59E0B
```

### user_nfts 表（用户持有记录）
```sql
id | user_address | token_id | tier_id | mint_price | mint_tx_hash | created_at
---|--------------|----------|---------|------------|--------------|------------
1  | 0xAAA...    | 123      | 1       | 100        | 0x123...     | 2024-01-01
2  | 0xAAA...    | 5678     | 2       | 300        | 0x456...     | 2024-01-02
3  | 0xBBB...    | 9999     | 3       | 1000       | 0x789...     | 2024-01-03
```

### users 表（汇总统计）
```sql
wallet_address | nft_count | nft_mint_amount | commission_rate
---------------|-----------|-----------------|----------------
0xAAA...      | 2         | 400             | 0.10
0xBBB...      | 1         | 1000            | 0.10
```

## 🔧 管理后台功能

### NFT 等级管理
- 查看所有等级配置
- 修改等级价格
- 修改 Token ID 范围
- 添加新等级

### 批量同步功能
```javascript
// 管理员点击"开始同步"
1. 获取所有用户列表
2. 获取 NFT 等级配置
3. 对每个用户：
   - 扫描 MINT 事件
   - 解析 Token ID
   - 匹配等级
   - 计算总价值
   - 保存到数据库
4. 显示同步结果
```

## 📱 前端显示

### 用户 NFT 列表（按等级分组）
```javascript
普通版 (100 USDT)
  ├─ Token #123
  ├─ Token #456
  └─ 小计: 2 个，200 USDT

高级版 (300 USDT)
  ├─ Token #5678
  └─ 小计: 1 个，300 USDT

总计: 3 个 NFT，价值 500 USDT
```

## 🚀 实施步骤

### ✅ 已完成
1. ✅ 创建 nft_tiers 表
2. ✅ 创建 user_nfts 表
3. ✅ 插入默认等级数据（3个等级）
4. ✅ 添加数据库方法
5. ✅ 创建 /api/nft-tiers 路由

### 🔄 下一步
1. 更新管理后台同步逻辑（使用等级系统）
2. 更新前端同步逻辑（使用等级系统）
3. 添加 NFT 详情显示（按等级分组）
4. 测试完整流程

## 💡 总结

**不需要查询 USDT 支付金额**，直接使用 NFT 等级系统：
- Token ID 1-5000 → 100 USDT
- Token ID 5001-9000 → 300 USDT
- Token ID 9001-10000 → 1000 USDT

这样系统更简单、更快速、更容易维护！
