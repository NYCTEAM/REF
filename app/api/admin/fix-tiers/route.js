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
    
    // 清空并重新插入正确的配置
    console.log('\n🗑️ 清空旧配置...');
    database.prepare('DELETE FROM nft_tiers').run();
    
    console.log('💾 插入新配置...\n');
    database.exec(`
      INSERT INTO nft_tiers (tier_name, price, token_id_start, token_id_end, description, color) VALUES
      ('Micro Node 🪙', 10, 1, 5000, '入门级节点 - 0.1x 算力 (5000个)', '#94A3B8'),
      ('Mini Node ⚪', 25, 5001, 8000, '初级节点 - 0.3x 算力 (3000个)', '#60A5FA'),
      ('Bronze Node 🥉', 50, 8001, 10000, '青铜节点 - 0.5x 算力 (2000个)', '#CD7F32'),
      ('Silver Node 🥈', 100, 10001, 11500, '白银节点 - 1x 算力 (1500个)', '#C0C0C0'),
      ('Gold Node 🥇', 250, 11501, 12600, '黄金节点 - 3x 算力 (1100个)', '#FFD700'),
      ('Platinum Node 💎', 500, 12601, 13300, '铂金节点 - 7x 算力 (700个)', '#E5E4E2'),
      ('Diamond Node 💠', 1000, 13301, 13900, '钻石节点 - 15x 算力 (600个)', '#B9F2FF');
    `);
    
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
