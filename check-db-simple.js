// 简单检查数据库 - 不需要 better-sqlite3
const { db } = require('./lib/sqlite-db.js');

console.log('🔍 检查数据库状态...\n');

// 1. 检查 NFT 等级
console.log('='.repeat(60));
console.log('1️⃣ NFT 等级表');
console.log('='.repeat(60));

const tiers = db.getNFTTiers();
console.log(`\n找到 ${tiers.length} 个等级:\n`);

tiers.forEach(tier => {
  console.log(`ID ${tier.id}: ${tier.tier_name}`);
  console.log(`  价格: ${tier.price} USDT`);
  console.log(`  Token ID: ${tier.token_id_start} - ${tier.token_id_end}`);
  console.log(`  数量: ${tier.token_id_end - tier.token_id_start + 1} 个`);
  console.log('');
});

// 2. 检查特定用户
console.log('='.repeat(60));
console.log('2️⃣ 检查用户: 0xf4f02733696cc3bb2cffe8bb8e9f32058654c622');
console.log('='.repeat(60));

const testUser = '0xf4f02733696cc3bb2cffe8bb8e9f32058654c622';

// 获取用户信息
const database = db.getDatabase();
const userInfo = database.prepare(`
  SELECT * FROM users WHERE wallet_address = ?
`).get(testUser.toLowerCase());

console.log('\n📊 users 表数据:');
if (userInfo) {
  console.log(`  团队: ${userInfo.team_name || '未命名'}`);
  console.log(`  NFT 数量: ${userInfo.nft_count}`);
  console.log(`  NFT 价值: ${userInfo.nft_mint_amount} USDT`);
  console.log(`  佣金比例: ${(userInfo.commission_rate * 100).toFixed(0)}%`);
} else {
  console.log('  ❌ 用户不存在');
}

// 获取用户的 NFT 详情
const userNFTs = db.getUserNFTs(testUser);

console.log(`\n📦 user_nfts 表数据 (${userNFTs.length} 个 NFT):`);

if (userNFTs.length > 0) {
  // 按等级分组
  const tierGroups = {};
  userNFTs.forEach(nft => {
    const tierName = nft.tier_name || '未知';
    if (!tierGroups[tierName]) {
      tierGroups[tierName] = {
        count: 0,
        value: 0,
        tokens: []
      };
    }
    tierGroups[tierName].count++;
    tierGroups[tierName].value += nft.price || 0;
    tierGroups[tierName].tokens.push(nft.token_id);
  });
  
  console.log('\n按等级统计:');
  Object.entries(tierGroups).forEach(([tierName, stats]) => {
    console.log(`  ${tierName}:`);
    console.log(`    数量: ${stats.count} 个`);
    console.log(`    价值: ${stats.value} USDT`);
    console.log(`    Token IDs: ${stats.tokens.join(', ')}`);
  });
  
  const totalValue = userNFTs.reduce((sum, nft) => sum + (nft.price || 0), 0);
  console.log(`\n💰 计算总价值: ${totalValue} USDT`);
  
  // 检查是否一致
  console.log('\n🔍 数据一致性检查:');
  if (userInfo) {
    const countMatch = userInfo.nft_count === userNFTs.length;
    const valueMatch = Math.abs(userInfo.nft_mint_amount - totalValue) < 0.01;
    
    console.log(`  NFT 数量: ${countMatch ? '✅' : '❌'} (users: ${userInfo.nft_count}, user_nfts: ${userNFTs.length})`);
    console.log(`  NFT 价值: ${valueMatch ? '✅' : '❌'} (users: ${userInfo.nft_mint_amount}, user_nfts: ${totalValue})`);
    
    if (!countMatch || !valueMatch) {
      console.log('\n⚠️ 发现数据不一致！需要重新同步。');
    } else {
      console.log('\n✅ 数据一致！');
    }
  }
} else {
  console.log('  ❌ 没有找到 NFT 记录');
}

// 3. 检查所有用户统计
console.log('\n' + '='.repeat(60));
console.log('3️⃣ 所有用户统计');
console.log('='.repeat(60));

const allUsersWithNFTs = database.prepare(`
  SELECT 
    wallet_address,
    team_name,
    nft_count,
    nft_mint_amount
  FROM users
  WHERE nft_count > 0
  ORDER BY nft_mint_amount DESC
`).all();

console.log(`\n找到 ${allUsersWithNFTs.length} 个用户有 NFT:\n`);

allUsersWithNFTs.forEach((user, index) => {
  console.log(`${index + 1}. ${user.wallet_address.substring(0, 10)}...${user.wallet_address.substring(38)}`);
  console.log(`   团队: ${user.team_name || '未命名'}`);
  console.log(`   NFT: ${user.nft_count} 个, 价值: ${user.nft_mint_amount} USDT`);
  console.log('');
});

console.log('✅ 检查完成！');
