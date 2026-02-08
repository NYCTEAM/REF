// 检查 NFT 等级配置
const { db } = require('./lib/sqlite-db.js');

console.log('🔍 检查 NFT 等级配置...\n');

const tiers = db.getNFTTiers();

console.log(`找到 ${tiers.length} 个等级:\n`);

tiers.forEach(tier => {
  console.log(`ID ${tier.id}: ${tier.tier_name}`);
  console.log(`  价格: ${tier.price} USDT`);
  console.log(`  Token ID 范围: ${tier.token_id_start} - ${tier.token_id_end}`);
  console.log(`  数量: ${tier.token_id_end - tier.token_id_start + 1} 个`);
  console.log('');
});

// 检查 Diamond Node
const diamondNode = tiers.find(t => t.tier_name.includes('Diamond'));
if (diamondNode) {
  console.log('✅ Diamond Node 配置:');
  console.log(`   价格: ${diamondNode.price} USDT`);
  console.log(`   范围: ${diamondNode.token_id_start} - ${diamondNode.token_id_end}`);
  
  // 测试几个 Token ID
  const testTokens = [13301, 13310, 13311, 13312, 13313, 13314, 13900];
  console.log('\n   测试 Token IDs:');
  testTokens.forEach(tokenId => {
    const inRange = tokenId >= diamondNode.token_id_start && tokenId <= diamondNode.token_id_end;
    console.log(`   Token ${tokenId}: ${inRange ? '✅ 在范围内' : '❌ 不在范围内'}`);
  });
} else {
  console.log('❌ 没有找到 Diamond Node 配置！');
}

console.log('\n✅ 检查完成');
