// 检查数据库状态
const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'referrals.db');
const db = new Database(DB_FILE);

console.log('📊 检查数据库状态\n');

// 1. 检查 users 表
console.log('1️⃣ Users 表:');
const users = db.prepare('SELECT wallet_address, nft_count, nft_mint_amount FROM users').all();
users.forEach(user => {
  console.log(`  ${user.wallet_address.substring(0, 10)}... nft_count=${user.nft_count}, nft_mint_amount=${user.nft_mint_amount}`);
});

// 2. 检查 user_nfts 表
console.log('\n2️⃣ User NFTs 表:');
const userNFTs = db.prepare(`
  SELECT user_address, COUNT(*) as count, SUM(mint_price) as total_value
  FROM user_nfts
  GROUP BY user_address
`).all();

if (userNFTs.length > 0) {
  userNFTs.forEach(nft => {
    console.log(`  ${nft.user_address.substring(0, 10)}... ${nft.count} 个 NFT, 总价值 ${nft.total_value} USDT`);
  });
} else {
  console.log('  ⚠️ user_nfts 表为空！需要运行同步。');
}

// 3. 检查 sync_progress 表
console.log('\n3️⃣ Sync Progress 表:');
const syncProgress = db.prepare('SELECT * FROM sync_progress').all();
if (syncProgress.length > 0) {
  syncProgress.forEach(sp => {
    console.log(`  ${sp.user_address.substring(0, 10)}... last_block=${sp.last_synced_block}, status=${sp.sync_status}`);
  });
} else {
  console.log('  ⚠️ sync_progress 表为空！从未同步过。');
}

// 4. 推荐关系
console.log('\n4️⃣ 推荐关系:');
const referrals = db.prepare(`
  SELECT 
    referrer_address,
    COUNT(*) as referral_count,
    SUM(nft_mint_amount) as total_performance
  FROM users
  WHERE referrer_address IS NOT NULL
  GROUP BY referrer_address
`).all();

if (referrals.length > 0) {
  referrals.forEach(ref => {
    console.log(`  ${ref.referrer_address.substring(0, 10)}... ${ref.referral_count} 个下线, 业绩 ${ref.total_performance || 0} USDT`);
  });
} else {
  console.log('  ⚠️ 没有推荐关系。');
}

db.close();
console.log('\n✅ 检查完成');
