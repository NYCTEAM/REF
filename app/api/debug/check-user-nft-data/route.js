import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('address') || '0xf4f02733696cc3bb2cffe8bb8e9f32058654c622';
    
    console.log('\n🔍 检查用户 NFT 数据...');
    console.log('用户地址:', userAddress);
    
    const database = db.getDatabase();
    
    // 获取用户信息
    const user = database.prepare(
      'SELECT * FROM users WHERE wallet_address = ?'
    ).get(userAddress.toLowerCase());
    
    console.log('\n📊 users 表中的数据:');
    console.log('  nft_count:', user?.nft_count);
    console.log('  nft_mint_amount:', user?.nft_mint_amount);
    
    // 获取 user_nfts 表中的数据
    const userNFTs = database.prepare(
      'SELECT * FROM user_nfts WHERE user_address = ? ORDER BY block_number'
    ).all(userAddress.toLowerCase());
    
    console.log('\n📦 user_nfts 表中的数据:');
    console.log('  记录数:', userNFTs.length);
    
    if (userNFTs.length > 0) {
      let totalValue = 0;
      const grouped = {};
      
      userNFTs.forEach((nft, index) => {
        console.log(`  [${index + 1}] Token ID: ${nft.token_id}, Tier: ${nft.tier_id}, Price: ${nft.mint_price} USDT`);
        totalValue += nft.mint_price || 0;
        
        if (!grouped[nft.tier_id]) {
          grouped[nft.tier_id] = { count: 0, value: 0, tokens: [] };
        }
        grouped[nft.tier_id].count++;
        grouped[nft.tier_id].value += nft.mint_price || 0;
        grouped[nft.tier_id].tokens.push(nft.token_id);
      });
      
      console.log('\n📊 按等级统计:');
      Object.entries(grouped).forEach(([tierId, stats]) => {
        console.log(`  Tier ${tierId}: ${stats.count} 个 (${stats.value} USDT) - Tokens: ${stats.tokens.join(', ')}`);
      });
      
      console.log(`\n💰 user_nfts 表计算的总价值: ${totalValue} USDT`);
      console.log(`💰 users 表中的 nft_mint_amount: ${user?.nft_mint_amount} USDT`);
      
      if (totalValue !== user?.nft_mint_amount) {
        console.log('⚠️ 数据不一致！需要重新同步！');
      }
    }
    
    return NextResponse.json({
      success: true,
      user: {
        nft_count: user?.nft_count,
        nft_mint_amount: user?.nft_mint_amount
      },
      user_nfts: userNFTs,
      summary: {
        nft_count_in_table: userNFTs.length,
        total_value_calculated: userNFTs.reduce((sum, nft) => sum + (nft.mint_price || 0), 0)
      }
    });
    
  } catch (error) {
    console.error('检查失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
