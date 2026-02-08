import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔧 修复 NFT 等级配置...\n');
    
    const database = db.getDatabase();
    
    // 先查看当前配置
    const currentTiers = database.prepare('SELECT * FROM nft_tiers ORDER BY id').all();
    console.log('当前配置:');
    currentTiers.forEach(tier => {
      console.log(`  ${tier.tier_name}: ${tier.price} USDT, Token ${tier.token_id_start}-${tier.token_id_end}`);
    });
    
    // � 使用 UPDATE 而不是 DELETE，避免外键约束问题
    console.log('\n� 更新等级配置...\n');
    
    const correctTiers = [
      { id: 1, name: 'Micro Node 🪙', price: 10, start: 1, end: 5000, desc: '入门级节点 - 0.1x 算力 (5000个)', color: '#94A3B8' },
      { id: 2, name: 'Mini Node ⚪', price: 25, start: 5001, end: 8000, desc: '初级节点 - 0.3x 算力 (3000个)', color: '#60A5FA' },
      { id: 3, name: 'Bronze Node 🥉', price: 50, start: 8001, end: 10000, desc: '青铜节点 - 0.5x 算力 (2000个)', color: '#CD7F32' },
      { id: 4, name: 'Silver Node 🥈', price: 100, start: 10001, end: 11500, desc: '白银节点 - 1x 算力 (1500个)', color: '#C0C0C0' },
      { id: 5, name: 'Gold Node 🥇', price: 250, start: 11501, end: 12600, desc: '黄金节点 - 3x 算力 (1100个)', color: '#FFD700' },
      { id: 6, name: 'Platinum Node 💎', price: 500, start: 12601, end: 13300, desc: '铂金节点 - 7x 算力 (700个)', color: '#E5E4E2' },
      { id: 7, name: 'Diamond Node 💠', price: 1000, start: 13301, end: 13900, desc: '钻石节点 - 15x 算力 (600个)', color: '#B9F2FF' }
    ];
    
    const updateStmt = database.prepare(`
      UPDATE nft_tiers 
      SET tier_name = ?, price = ?, token_id_start = ?, token_id_end = ?, description = ?, color = ?
      WHERE id = ?
    `);
    
    const insertStmt = database.prepare(`
      INSERT INTO nft_tiers (id, tier_name, price, token_id_start, token_id_end, description, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    correctTiers.forEach(tier => {
      const exists = currentTiers.find(t => t.id === tier.id);
      if (exists) {
        updateStmt.run(tier.name, tier.price, tier.start, tier.end, tier.desc, tier.color, tier.id);
        console.log(`  ✅ 更新 ID ${tier.id}: ${tier.name}`);
      } else {
        insertStmt.run(tier.id, tier.name, tier.price, tier.start, tier.end, tier.desc, tier.color);
        console.log(`  ➕ 插入 ID ${tier.id}: ${tier.name}`);
      }
    });
    
    // 验证新配置
    const newTiers = database.prepare('SELECT * FROM nft_tiers ORDER BY id').all();
    console.log('✅ 新配置:');
    newTiers.forEach(tier => {
      console.log(`  ${tier.tier_name}: ${tier.price} USDT, Token ${tier.token_id_start}-${tier.token_id_end}`);
    });
    
    // 测试 Diamond Node Token IDs
    const diamondNode = newTiers.find(t => t.tier_name.includes('Diamond'));
    const testTokens = [13307, 13310, 13311, 13312, 13313, 13314];
    
    console.log('\n🔍 测试 Diamond Node Token IDs:');
    testTokens.forEach(tokenId => {
      const inRange = tokenId >= diamondNode.token_id_start && tokenId <= diamondNode.token_id_end;
      console.log(`  Token ${tokenId}: ${inRange ? '✅ 在范围内' : '❌ 不在范围内'}`);
    });
    
    console.log('\n✅ 等级配置已修复！');
    console.log('⚠️ 请重新运行"强制全量重扫"以更新所有用户数据。');
    
    return NextResponse.json({
      success: true,
      message: '等级配置已修复',
      tiers: newTiers
    });
    
  } catch (error) {
    console.error('修复失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
