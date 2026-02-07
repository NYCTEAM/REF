// 检查特定用户的 NFT
const { ethers } = require('ethers');

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC = 'https://bsc.eagleswap.llc';
const EAGLE_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738;

const NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
];

const NFT_TIERS = [
  { name: 'Micro Node 🪙', price: 10, start: 1, end: 5000 },
  { name: 'Mini Node ⚪', price: 25, start: 5001, end: 8000 },
  { name: 'Bronze Node 🥉', price: 50, start: 8001, end: 10000 },
  { name: 'Silver Node 🥈', price: 100, start: 10001, end: 11500 },
  { name: 'Gold Node 🥇', price: 250, start: 11501, end: 12600 },
  { name: 'Platinum Node 💎', price: 500, start: 12601, end: 13300 },
  { name: 'Diamond Node 💠', price: 1000, start: 13301, end: 13900 }
];

const USER_ADDRESS = '0xf4f02733696cc3bb2cffe8bb8e9f32058654c622';

async function checkUserNFT() {
  console.log('🔍 检查用户 NFT 详情...\n');
  console.log(`👤 用户地址: ${USER_ADDRESS}\n`);
  
  const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC);
  fetchRequest.setHeader('X-API-Key', EAGLE_API_KEY);
  const provider = new ethers.JsonRpcProvider(fetchRequest);
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
  
  // 1. 检查余额
  const balance = await contract.balanceOf(USER_ADDRESS);
  const nftCount = Number(balance);
  console.log(`📊 当前持有: ${nftCount} 个 NFT\n`);
  
  // 2. 获取所有 Token IDs
  const tokenIds = [];
  for (let i = 0; i < nftCount; i++) {
    const tokenId = await contract.tokenOfOwnerByIndex(USER_ADDRESS, i);
    tokenIds.push(Number(tokenId));
  }
  
  console.log('📋 Token IDs:', tokenIds.join(', '), '\n');
  
  // 3. 按等级分类
  const tierStats = {};
  let totalValue = 0;
  
  console.log('💎 NFT 详情：');
  console.log('-'.repeat(60));
  
  tokenIds.forEach(tokenId => {
    const tier = NFT_TIERS.find(t => tokenId >= t.start && tokenId <= t.end);
    if (tier) {
      if (!tierStats[tier.name]) {
        tierStats[tier.name] = { count: 0, value: 0, ids: [] };
      }
      tierStats[tier.name].count++;
      tierStats[tier.name].value += tier.price;
      tierStats[tier.name].ids.push(tokenId);
      totalValue += tier.price;
      
      console.log(`Token ${tokenId.toString().padStart(5)} - ${tier.name.padEnd(20)} ${tier.price} USDT`);
    }
  });
  
  console.log('-'.repeat(60));
  console.log(`\n📊 总价值: ${totalValue} USDT\n`);
  
  console.log('📊 按等级统计：');
  console.log('-'.repeat(60));
  Object.entries(tierStats).forEach(([name, stats]) => {
    console.log(`${name.padEnd(25)} ${stats.count} 个 (${stats.value} USDT)`);
    console.log(`   Token IDs: ${stats.ids.join(', ')}`);
  });
  
  // 4. 扫描 MINT 事件
  console.log('\n🔍 扫描 MINT 事件（从区块 79785738 开始）...\n');
  
  const latestBlock = await provider.getBlockNumber();
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
  const userTopic = ethers.zeroPadValue(USER_ADDRESS, 32);
  
  const BATCH_SIZE = 2000;
  let allLogs = [];
  
  for (let fromBlock = START_BLOCK; fromBlock <= latestBlock; fromBlock += BATCH_SIZE) {
    const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, latestBlock);
    
    try {
      const logs = await provider.getLogs({
        address: NFT_CONTRACT_ADDRESS,
        topics: [transferTopic, zeroAddressTopic, userTopic],
        fromBlock,
        toBlock
      });
      
      allLogs = allLogs.concat(logs);
      
      if (logs.length > 0) {
        console.log(`✅ 区块 ${fromBlock}-${toBlock}: 找到 ${logs.length} 个 MINT 事件`);
      }
    } catch (error) {
      console.error(`❌ 区块 ${fromBlock}-${toBlock} 查询失败:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 MINT 事件总数: ${allLogs.length}\n`);
  
  if (allLogs.length > 0) {
    let mintValue = 0;
    console.log('💎 MINT 事件详情：');
    console.log('-'.repeat(60));
    
    for (const log of allLogs) {
      const tokenId = parseInt(log.topics[3], 16);
      const tier = NFT_TIERS.find(t => tokenId >= t.start && tokenId <= t.end);
      
      if (tier) {
        mintValue += tier.price;
        console.log(`Token ${tokenId.toString().padStart(5)} - ${tier.name.padEnd(20)} ${tier.price} USDT (区块 ${log.blockNumber})`);
      }
    }
    
    console.log('-'.repeat(60));
    console.log(`\n📊 MINT 总价值: ${mintValue} USDT`);
  } else {
    console.log('⚠️  未找到 MINT 事件（所有 NFT 都是在区块 79785738 之前购买的）');
  }
}

checkUserNFT().catch(console.error);
