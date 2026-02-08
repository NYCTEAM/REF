// 检查和修复数据库中的 NFT 数据
import Database from 'better-sqlite3';
import { ethers } from 'ethers';

const DB_PATH = './data/referrals.db';
const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC = 'https://bsc.eagleswap.llc';
const EAGLE_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738;

console.log('🔍 检查数据库状态...\n');

// 打开数据库
const db = new Database(DB_PATH);

// 1. 检查 NFT 等级表
console.log('='.repeat(60));
console.log('1️⃣ 检查 NFT 等级表 (nft_tiers)');
console.log('='.repeat(60));

const tiers = db.prepare('SELECT * FROM nft_tiers ORDER BY id').all();
console.log(`\n找到 ${tiers.length} 个等级:\n`);

tiers.forEach(tier => {
  console.log(`ID ${tier.id}: ${tier.tier_name}`);
  console.log(`  价格: ${tier.price} USDT`);
  console.log(`  Token ID 范围: ${tier.token_id_start} - ${tier.token_id_end}`);
  console.log(`  数量: ${tier.token_id_end - tier.token_id_start + 1} 个`);
  console.log('');
});

// 2. 检查用户 NFT 数据
console.log('='.repeat(60));
console.log('2️⃣ 检查用户 NFT 数据 (user_nfts)');
console.log('='.repeat(60));

const userNFTs = db.prepare(`
  SELECT 
    un.user_address,
    COUNT(*) as nft_count,
    SUM(COALESCE(un.mint_price, nt.price)) as total_value,
    GROUP_CONCAT(nt.tier_name) as tiers
  FROM user_nfts un
  LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
  GROUP BY un.user_address
`).all();

console.log(`\n找到 ${userNFTs.length} 个用户有 NFT 记录:\n`);

userNFTs.forEach(user => {
  console.log(`用户: ${user.user_address}`);
  console.log(`  NFT 数量: ${user.nft_count}`);
  console.log(`  总价值: ${user.total_value} USDT`);
  console.log('');
});

// 3. 检查 users 表中的统计数据
console.log('='.repeat(60));
console.log('3️⃣ 检查 users 表统计数据');
console.log('='.repeat(60));

const users = db.prepare(`
  SELECT 
    wallet_address,
    team_name,
    nft_count,
    nft_mint_amount,
    commission_rate
  FROM users
  WHERE nft_count > 0 OR nft_mint_amount > 0
`).all();

console.log(`\n找到 ${users.length} 个用户有 NFT 统计:\n`);

users.forEach(user => {
  console.log(`用户: ${user.wallet_address}`);
  console.log(`  团队: ${user.team_name || '未命名'}`);
  console.log(`  统计 NFT 数量: ${user.nft_count}`);
  console.log(`  统计 NFT 价值: ${user.nft_mint_amount} USDT`);
  console.log(`  佣金比例: ${(user.commission_rate * 100).toFixed(0)}%`);
  console.log('');
});

// 4. 对比检查：user_nfts vs users 表
console.log('='.repeat(60));
console.log('4️⃣ 数据一致性检查');
console.log('='.repeat(60));

let hasInconsistency = false;

users.forEach(user => {
  const actualNFTs = db.prepare(`
    SELECT 
      COUNT(*) as count,
      SUM(COALESCE(un.mint_price, nt.price)) as value
    FROM user_nfts un
    LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
    WHERE un.user_address = ?
  `).get(user.wallet_address.toLowerCase());
  
  if (actualNFTs.count !== user.nft_count || Math.abs(actualNFTs.value - user.nft_mint_amount) > 0.01) {
    hasInconsistency = true;
    console.log(`\n❌ 数据不一致: ${user.wallet_address}`);
    console.log(`  users 表: ${user.nft_count} 个 NFT, ${user.nft_mint_amount} USDT`);
    console.log(`  user_nfts 表: ${actualNFTs.count} 个 NFT, ${actualNFTs.value} USDT`);
  }
});

if (!hasInconsistency) {
  console.log('\n✅ 所有用户数据一致！');
}

// 5. 检查特定用户
console.log('\n' + '='.repeat(60));
console.log('5️⃣ 检查特定用户: 0xf4f02733696cc3bb2cffe8bb8e9f32058654c622');
console.log('='.repeat(60));

const testUser = '0xf4f02733696cc3bb2cffe8bb8e9f32058654c622';

const userInfo = db.prepare(`
  SELECT * FROM users WHERE wallet_address = ?
`).get(testUser.toLowerCase());

console.log('\nusers 表数据:');
console.log(JSON.stringify(userInfo, null, 2));

const userNFTDetails = db.prepare(`
  SELECT 
    un.token_id,
    un.mint_price,
    nt.tier_name,
    nt.price as tier_price,
    COALESCE(un.mint_price, nt.price) as effective_price,
    un.mint_block_number,
    un.mint_timestamp
  FROM user_nfts un
  LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
  WHERE un.user_address = ?
  ORDER BY un.mint_block_number
`).all(testUser.toLowerCase());

console.log(`\nuser_nfts 表数据 (${userNFTDetails.length} 个 NFT):`);
userNFTDetails.forEach(nft => {
  console.log(`  Token ${nft.token_id}: ${nft.tier_name} - ${nft.effective_price} USDT (区块 ${nft.mint_block_number})`);
});

const totalValue = userNFTDetails.reduce((sum, nft) => sum + nft.effective_price, 0);
console.log(`\n计算总价值: ${totalValue} USDT`);

// 6. 提供修复建议
console.log('\n' + '='.repeat(60));
console.log('6️⃣ 修复建议');
console.log('='.repeat(60));

if (hasInconsistency) {
  console.log('\n发现数据不一致，建议执行以下操作:');
  console.log('1. 运行 node resync-all-users.js 重新同步所有用户数据');
  console.log('2. 或在管理后台点击"刷新 NFT"按钮');
} else {
  console.log('\n✅ 数据库状态正常！');
}

db.close();

console.log('\n✅ 检查完成！');
