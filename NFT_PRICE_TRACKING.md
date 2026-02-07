# NFT MINT 价格追踪方案

## 当前状态 ⚠️

目前系统使用**固定价格 100 USDT** 来计算 NFT 价值：

```javascript
const NFT_PRICE = 100; // 固定价格
const mintAmount = count * NFT_PRICE;
```

## 问题

- ❌ 无法获取用户实际支付的 USDT 金额
- ❌ 如果 NFT 价格变动，统计数据不准确
- ❌ 无法区分不同价格的 NFT

## 解决方案

### 方案 1: 监听 USDT Transfer 事件（推荐）⭐

NFT MINT 时，用户会向合约或指定地址转账 USDT。我们可以监听 USDT 合约的 Transfer 事件。

#### 实现步骤：

1. **获取 USDT 合约地址**（BSC 主网）
   ```javascript
   const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
   ```

2. **监听 USDT Transfer 事件**
   ```javascript
   // Transfer 事件签名
   const transferTopic = ethers.id("Transfer(address,address,uint256)");
   
   // 过滤条件：from = 用户地址, to = NFT 合约或收款地址
   const filter = {
     address: USDT_CONTRACT,
     topics: [
       transferTopic,
       ethers.zeroPadValue(userAddress, 32), // from
       ethers.zeroPadValue(NFT_CONTRACT_OR_RECEIVER, 32) // to
     ],
     fromBlock: startBlock,
     toBlock: 'latest'
   };
   
   const logs = await provider.getLogs(filter);
   
   // 解析金额
   logs.forEach(log => {
     const amount = ethers.toBigInt(log.data); // USDT 金额（wei）
     const usdtAmount = Number(ethers.formatUnits(amount, 18)); // 转换为 USDT
   });
   ```

3. **匹配 NFT MINT 和 USDT 支付**
   - 通过交易哈希（txHash）关联
   - 通过区块号和时间戳关联
   - 通过用户地址关联

#### 示例代码：

```javascript
async function getMintPriceFromChain(userAddress, nftContract, usdtContract) {
  const provider = new ethers.JsonRpcProvider(CUSTOM_RPC);
  
  // 1. 获取 NFT MINT 事件
  const nftTransferTopic = ethers.id("Transfer(address,address,uint256)");
  const zeroAddress = ethers.zeroPadValue(ethers.ZeroAddress, 32);
  const userTopic = ethers.zeroPadValue(userAddress, 32);
  
  const nftFilter = {
    address: nftContract,
    topics: [nftTransferTopic, zeroAddress, userTopic],
    fromBlock: 0,
    toBlock: 'latest'
  };
  
  const nftLogs = await provider.getLogs(nftFilter);
  
  // 2. 对每个 MINT 事件，查找对应的 USDT 支付
  let totalPaid = 0;
  
  for (const nftLog of nftLogs) {
    const txHash = nftLog.transactionHash;
    const blockNumber = nftLog.blockNumber;
    
    // 查找同一交易中的 USDT Transfer
    const usdtFilter = {
      address: usdtContract,
      topics: [
        ethers.id("Transfer(address,address,uint256)"),
        userTopic // from user
      ],
      fromBlock: blockNumber,
      toBlock: blockNumber
    };
    
    const usdtLogs = await provider.getLogs(usdtFilter);
    
    // 找到同一交易的 USDT 转账
    const matchingTransfer = usdtLogs.find(log => log.transactionHash === txHash);
    
    if (matchingTransfer) {
      const amount = ethers.toBigInt(matchingTransfer.data);
      const usdtAmount = Number(ethers.formatUnits(amount, 18));
      totalPaid += usdtAmount;
      console.log(`MINT ${txHash}: 支付 ${usdtAmount} USDT`);
    }
  }
  
  return {
    nftCount: nftLogs.length,
    totalPaid: totalPaid
  };
}
```

### 方案 2: 从 NFT 合约读取价格

如果 NFT 合约有 `price()` 或 `mintPrice()` 函数：

```javascript
const NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function mintPrice() view returns (uint256)" // 添加价格函数
];

const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
const price = await contract.mintPrice();
const priceInUSDT = Number(ethers.formatUnits(price, 18));
```

### 方案 3: 从后端 API 获取历史价格

如果有价格变动记录：

```javascript
// 创建价格历史表
CREATE TABLE nft_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price DECIMAL(20, 2) NOT NULL,
  effective_date DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

// 根据 MINT 时间查询当时的价格
SELECT price FROM nft_prices 
WHERE effective_date <= ? 
ORDER BY effective_date DESC 
LIMIT 1;
```

## 推荐实现方案 ⭐

### 短期方案（当前）：
- ✅ 使用固定价格 100 USDT
- ✅ 定期手动更新价格常量
- ✅ 已实现佣金比例自动计算和保存

### 长期方案（建议）：
1. **实现方案 1**：监听 USDT Transfer 事件
2. **在管理后台添加"重新计算价格"功能**
3. **定期自动同步（每小时或每天）**

## 当前系统优化 ✅

### 已完成：
1. ✅ 添加 `commission_rate` 字段到数据库
2. ✅ 自动计算佣金比例（10%/15%/20%）
3. ✅ 更新时自动保存佣金比例
4. ✅ 管理后台可以手动触发 NFT 同步

### 佣金计算逻辑：
```javascript
// 在 updateUserNftStats 中自动计算
let commissionRate = 0.10; // < 2000 USDT
if (mintAmount >= 10000) {
  commissionRate = 0.20; // ≥ 10000 USDT
} else if (mintAmount >= 2000) {
  commissionRate = 0.15; // ≥ 2000 USDT
}
```

## 使用说明

### 管理员操作：
1. 登录管理后台 `/admin`
2. 点击"NFT 数据同步"模块的"开始同步"
3. 系统自动：
   - 扫描所有用户的 NFT MINT 事件
   - 计算 NFT 数量和总金额
   - 根据金额自动计算佣金比例
   - 保存到数据库

### 数据库字段：
```sql
users 表:
- nft_count: NFT 数量
- nft_mint_amount: NFT MINT 总金额（USDT）
- total_sales: 总销售额（同 nft_mint_amount）
- commission_rate: 当前佣金比例（0.10/0.15/0.20）
- claimed_amount: 已提现金额
```

## 性能优化

### 当前优化：
- ✅ 数据保存在数据库，读取速度快
- ✅ 前端直接从数据库读取，无需每次查询链上
- ✅ 管理后台可以批量同步所有用户

### 建议优化：
- 🔄 添加缓存层（Redis）
- 🔄 定时任务自动同步（每小时）
- 🔄 增量同步（只同步新的 MINT 事件）

## 总结

✅ **当前系统已实现**：
- 佣金比例自动计算和保存
- 数据库存储 NFT 统计
- 管理后台手动同步
- 快速读取（从数据库）

⚠️ **待优化**：
- 从链上读取实际支付的 USDT 金额
- 自动定时同步
- 支持价格变动历史

**建议**：当前方案已经满足基本需求，可以先上线使用。后续根据实际需求再实现链上价格追踪。
