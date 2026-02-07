// 测试完整的同步流程
const { ethers } = require('ethers');

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC = 'https://bsc.eagleswap.llc';
const EAGLE_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738;
const BLOCK_BATCH_SIZE = 2000;

const NFT_TIERS = [
  { id: 1, name: 'Micro Node 🪙', price: 10, start: 1, end: 5000 },
  { id: 2, name: 'Mini Node ⚪', price: 25, start: 5001, end: 8000 },
  { id: 3, name: 'Bronze Node 🥉', price: 50, start: 8001, end: 10000 },
  { id: 4, name: 'Silver Node 🥈', price: 100, start: 10001, end: 11500 },
  { id: 5, name: 'Gold Node 🥇', price: 250, start: 11501, end: 12600 },
  { id: 6, name: 'Platinum Node 💎', price: 500, start: 12601, end: 13300 },
  { id: 7, name: 'Diamond Node 💠', price: 1000, start: 13301, end: 13900 }
];

const TEST_USER = '0xf4f02733696cc3bb2cffe8bb8e9f32058654c622';

async function testSyncFlow() {
  console.log('🧪 测试完整同步流程\n');
  console.log('='.repeat(60));
  console.log(`测试用户: ${TEST_USER}`);
  console.log('='.repeat(60) + '\n');
  
  // 连接 RPC
  const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC);
  fetchRequest.setHeader('X-API-Key', EAGLE_API_KEY);
  const provider = new ethers.JsonRpcProvider(fetchRequest);
  
  const latestBlock = await provider.getBlockNumber();
  console.log(`📊 当前最新区块: ${latestBlock}\n`);
  
  // 步骤 1: 扫描 MINT 事件
  console.log('🔍 步骤 1: 扫描 MINT 事件...\n');
  
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
  const userTopic = ethers.zeroPadValue(TEST_USER, 32);
  
  let allLogs = [];
  
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
        console.log(`  ✅ 区块 ${fromBlock}-${toBlock}: 找到 ${logs.length} 个事件`);
      }
    } catch (error) {
      console.error(`  ❌ 区块 ${fromBlock}-${toBlock} 失败:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 找到 ${allLogs.length} 个 MINT 事件\n`);
  
  // 步骤 2: 处理 NFT 数据
  console.log('🔍 步骤 2: 处理 NFT 数据...\n');
  
  const nfts = [];
  let totalValue = 0;
  
  for (const log of allLogs) {
    const tokenId = parseInt(log.topics[3], 16);
    const tier = NFT_TIERS.find(t => tokenId >= t.start && tokenId <= t.end);
    
    if (tier) {
      // 获取区块时间戳
      const block = await provider.getBlock(log.blockNumber);
      const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
      
      nfts.push({
        tokenId,
        tierId: tier.id,
        tierName: tier.name,
        price: tier.price,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp
      });
      totalValue += tier.price;
      
      console.log(`  💎 Token ${tokenId} - ${tier.name} (${tier.price} USDT) - 区块 ${log.blockNumber}`);
    }
  }
  
  console.log(`\n📊 处理完成: ${nfts.length} 个 NFT, 总价值 ${totalValue} USDT\n`);
  
  // 步骤 3: 模拟数据库保存
  console.log('🔍 步骤 3: 模拟数据库保存...\n');
  
  console.log('模拟保存到 user_nfts 表:');
  nfts.forEach(nft => {
    console.log(`  INSERT INTO user_nfts (user_address, token_id, tier_id, mint_price, mint_tx_hash, mint_block_number, mint_timestamp)`);
    console.log(`  VALUES ('${TEST_USER}', ${nft.tokenId}, ${nft.tierId}, ${nft.price}, '${nft.txHash}', ${nft.blockNumber}, '${nft.timestamp}')`);
  });
  
  // 步骤 4: 模拟重新计算统计
  console.log('\n🔍 步骤 4: 重新计算用户统计...\n');
  
  // 模拟 getUserNFTs 返回的数据
  const allUserNFTs = nfts.map(nft => ({
    ...nft,
    price: nft.price // COALESCE(mint_price, tier_price)
  }));
  
  const totalNFTCount = allUserNFTs.length;
  const totalNFTValue = allUserNFTs.reduce((sum, nft) => sum + nft.price, 0);
  
  console.log(`  📊 总 NFT 数量: ${totalNFTCount}`);
  console.log(`  📊 总 NFT 价值: ${totalNFTValue} USDT`);
  
  // 计算佣金比例
  let commissionRate = 0.10;
  if (totalNFTValue >= 10000) commissionRate = 0.20;
  else if (totalNFTValue >= 2000) commissionRate = 0.15;
  
  console.log(`  📊 佣金比例: ${(commissionRate * 100).toFixed(0)}%\n`);
  
  console.log('模拟更新 users 表:');
  console.log(`  UPDATE users`);
  console.log(`  SET nft_count = ${totalNFTCount},`);
  console.log(`      nft_mint_amount = ${totalNFTValue},`);
  console.log(`      commission_rate = ${commissionRate}`);
  console.log(`  WHERE wallet_address = '${TEST_USER}'`);
  
  // 步骤 5: 验证结果
  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试结果');
  console.log('='.repeat(60) + '\n');
  
  console.log(`用户地址: ${TEST_USER}`);
  console.log(`NFT 数量: ${totalNFTCount} 个`);
  console.log(`NFT 价值: ${totalNFTValue} USDT`);
  console.log(`佣金比例: ${(commissionRate * 100).toFixed(0)}%`);
  
  // 按等级统计
  const tierStats = {};
  nfts.forEach(nft => {
    if (!tierStats[nft.tierName]) {
      tierStats[nft.tierName] = { count: 0, value: 0 };
    }
    tierStats[nft.tierName].count++;
    tierStats[nft.tierName].value += nft.price;
  });
  
  console.log('\n按等级统计:');
  Object.entries(tierStats).forEach(([name, stats]) => {
    console.log(`  ${name}: ${stats.count} 个 (${stats.value} USDT)`);
  });
  
  console.log('\n✅ 所有步骤完成！');
  
  // 验证期望值
  console.log('\n' + '='.repeat(60));
  console.log('🎯 验证期望值');
  console.log('='.repeat(60) + '\n');
  
  const expectedCount = 10;
  const expectedValue = 7000;
  
  if (totalNFTCount === expectedCount && totalNFTValue === expectedValue) {
    console.log('✅ 测试通过！数据正确！');
    console.log(`   期望: ${expectedCount} 个 NFT, ${expectedValue} USDT`);
    console.log(`   实际: ${totalNFTCount} 个 NFT, ${totalNFTValue} USDT`);
  } else {
    console.log('❌ 测试失败！数据不匹配！');
    console.log(`   期望: ${expectedCount} 个 NFT, ${expectedValue} USDT`);
    console.log(`   实际: ${totalNFTCount} 个 NFT, ${totalNFTValue} USDT`);
  }
}

testSyncFlow().catch(console.error);
