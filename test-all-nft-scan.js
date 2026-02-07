// 测试扫描所有用户的 NFT MINT 事件
const { ethers } = require('ethers');

// 配置
const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC = 'https://bsc.eagleswap.llc';
const EAGLE_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738;
const BLOCK_BATCH_SIZE = 2000;

// 测试用户列表（从你的截图和日志中提取）
const TEST_USERS = [
  '0x29ea2055ce84d18f13229c3c8067d6acad1d0233',
  '0x04e2e260fb8108985a21cf9ed36cdc90a273afa4',
  '0xc6c923cbf60051207ce439badba3094a5da0cd19',
  '0xe4724592897fb5773ea049bc4010d2e30aa1bd9c',
  '0xcd459fc1105432a2e6c7c7b9535898a4a78fa23e'
];

// NFT 等级配置
const NFT_TIERS = [
  { name: 'Micro Node 🪙', price: 10, start: 1, end: 5000 },
  { name: 'Mini Node ⚪', price: 25, start: 5001, end: 8000 },
  { name: 'Bronze Node 🥉', price: 50, start: 8001, end: 10000 },
  { name: 'Silver Node 🥈', price: 100, start: 10001, end: 11500 },
  { name: 'Gold Node 🥇', price: 250, start: 11501, end: 12600 },
  { name: 'Platinum Node 💎', price: 500, start: 12601, end: 13300 },
  { name: 'Diamond Node 💠', price: 1000, start: 13301, end: 13900 }
];

async function scanAllUsers() {
  console.log('🚀 开始扫描所有用户的 NFT MINT 事件...\n');
  
  // 使用测试用户列表
  const users = TEST_USERS.map(addr => ({ wallet_address: addr }));
  console.log(`📊 测试用户数: ${users.length}\n`);
  
  // 连接 RPC
  const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC);
  fetchRequest.setHeader('X-API-Key', EAGLE_API_KEY);
  const provider = new ethers.JsonRpcProvider(fetchRequest);
  
  // 获取最新区块
  const latestBlock = await provider.getBlockNumber();
  console.log(`📊 当前最新区块: ${latestBlock}`);
  console.log(`📊 扫描范围: ${START_BLOCK} → ${latestBlock} (${latestBlock - START_BLOCK} 个区块)\n`);
  
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
  
  // 统计数据
  let totalNFTs = 0;
  let totalValue = 0;
  const userStats = {};
  const tierStats = {};
  
  // 初始化等级统计
  NFT_TIERS.forEach(tier => {
    tierStats[tier.name] = { count: 0, value: 0 };
  });
  
  console.log('🔍 开始扫描 MINT 事件...\n');
  
  for (const user of users) {
    const userAddress = user.wallet_address;
    const userTopic = ethers.zeroPadValue(userAddress, 32);
    
    console.log(`🔍 扫描用户: ${userAddress.substring(0, 10)}...`);
    
    let allLogs = [];
    
    // 分批查询
    for (let fromBlock = START_BLOCK; fromBlock <= latestBlock; fromBlock += BLOCK_BATCH_SIZE) {
      const toBlock = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, latestBlock);
      
      try {
        const logs = await provider.getLogs({
          address: NFT_CONTRACT_ADDRESS,
          topics: [transferTopic, zeroAddressTopic, userTopic],
          fromBlock,
          toBlock
        });
        
        allLogs = allLogs.concat(logs);
        
        if (logs.length > 0) {
          console.log(`  ✅ 区块 ${fromBlock}-${toBlock}: 找到 ${logs.length} 个 MINT 事件`);
        }
      } catch (error) {
        console.error(`  ❌ 区块 ${fromBlock}-${toBlock} 查询失败:`, error.message);
      }
      
      // 延迟避免 RPC 限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 处理找到的 NFT
    let userNFTCount = 0;
    let userNFTValue = 0;
    
    for (const log of allLogs) {
      const tokenId = parseInt(log.topics[3], 16);
      
      // 查找等级
      const tier = NFT_TIERS.find(t => tokenId >= t.start && tokenId <= t.end);
      
      if (tier) {
        userNFTCount++;
        userNFTValue += tier.price;
        totalNFTs++;
        totalValue += tier.price;
        
        tierStats[tier.name].count++;
        tierStats[tier.name].value += tier.price;
        
        console.log(`  💎 Token ID ${tokenId} - ${tier.name} (${tier.price} USDT)`);
      }
    }
    
    if (userNFTCount > 0) {
      userStats[userAddress] = { count: userNFTCount, value: userNFTValue };
      console.log(`  📊 用户总计: ${userNFTCount} 个 NFT, 价值 ${userNFTValue} USDT\n`);
    } else {
      console.log(`  ℹ️  未找到 MINT 事件\n`);
    }
  }
  
  // 输出总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 扫描完成！统计结果：');
  console.log('='.repeat(60) + '\n');
  
  console.log(`🎯 总用户数: ${users.length}`);
  console.log(`🎯 有购买记录的用户: ${Object.keys(userStats).length}`);
  console.log(`🎯 总 NFT 数量: ${totalNFTs} 个`);
  console.log(`🎯 总价值: ${totalValue} USDT\n`);
  
  console.log('📊 按等级统计：');
  console.log('-'.repeat(60));
  NFT_TIERS.forEach(tier => {
    const stats = tierStats[tier.name];
    if (stats.count > 0) {
      console.log(`${tier.name.padEnd(25)} ${stats.count} 个 (${stats.value} USDT)`);
    }
  });
  
  console.log('\n📊 用户购买排行（前 10）：');
  console.log('-'.repeat(60));
  const topUsers = Object.entries(userStats)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10);
  
  topUsers.forEach(([address, stats], index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${address.substring(0, 10)}... ${stats.count} 个 NFT (${stats.value} USDT)`);
  });
  
  console.log('\n✅ 测试完成！');
}

// 运行测试
scanAllUsers().catch(console.error);
