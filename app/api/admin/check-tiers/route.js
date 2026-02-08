import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tiers = db.getNFTTiers();
    
    console.log('\n🔍 NFT 等级配置:\n');
    
    tiers.forEach(tier => {
      console.log(`ID ${tier.id}: ${tier.tier_name}`);
      console.log(`  价格: ${tier.price} USDT`);
      console.log(`  Token ID: ${tier.token_id_start} - ${tier.token_id_end}`);
      console.log(`  数量: ${tier.token_id_end - tier.token_id_start + 1} 个`);
      console.log('');
    });
    
    // 检查 Diamond Node
    const diamondNode = tiers.find(t => t.tier_name.includes('Diamond'));
    
    if (diamondNode) {
      console.log('✅ Diamond Node 配置正确');
      console.log(`   价格: ${diamondNode.price} USDT`);
      console.log(`   范围: ${diamondNode.token_id_start} - ${diamondNode.token_id_end}\n`);
      
      // 测试 Token IDs
      const testTokens = [13301, 13310, 13311, 13312, 13313, 13314, 13900];
      const testResults = testTokens.map(tokenId => ({
        tokenId,
        inRange: tokenId >= diamondNode.token_id_start && tokenId <= diamondNode.token_id_end
      }));
      
      console.log('测试 Token IDs:');
      testResults.forEach(result => {
        console.log(`  Token ${result.tokenId}: ${result.inRange ? '✅' : '❌'}`);
      });
    }
    
    return NextResponse.json({
      success: true,
      tiers,
      diamondNode
    });
    
  } catch (error) {
    console.error('检查失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
