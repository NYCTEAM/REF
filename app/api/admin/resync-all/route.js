import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔄 开始重新同步所有用户的 NFT 统计...');
    
    const database = db.getDatabase();
    
    // 获取所有用户
    const users = database.prepare('SELECT wallet_address FROM users').all();
    
    console.log(`找到 ${users.length} 个用户`);
    
    let updatedCount = 0;
    const results = [];
    
    for (const user of users) {
      try {
        // 从 user_nfts 表重新计算统计
        const nfts = db.getUserNFTs(user.wallet_address);
        
        const nftCount = nfts.length;
        const nftMintAmount = nfts.reduce((sum, nft) => sum + (nft.price || 0), 0);
        
        // 更新 users 表
        db.updateUserNftStats(user.wallet_address, nftCount, nftMintAmount);
        
        if (nftCount > 0) {
          console.log(`✅ ${user.wallet_address}: ${nftCount} 个 NFT, ${nftMintAmount} USDT`);
          results.push({
            wallet_address: user.wallet_address,
            nft_count: nftCount,
            nft_mint_amount: nftMintAmount,
            status: 'updated'
          });
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ 更新失败 ${user.wallet_address}:`, error.message);
        results.push({
          wallet_address: user.wallet_address,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`\n✅ 重新同步完成！更新了 ${updatedCount} 个用户`);
    
    return NextResponse.json({
      success: true,
      message: `成功重新同步 ${updatedCount} 个用户`,
      total_users: users.length,
      updated_count: updatedCount,
      results
    });
  } catch (error) {
    console.error('重新同步失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
