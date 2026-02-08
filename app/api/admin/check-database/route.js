import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    // 1. 检查 NFT 等级表
    const tiers = db.getNFTTiers();
    report.checks.push({
      name: 'NFT 等级表',
      status: 'success',
      data: tiers,
      summary: `找到 ${tiers.length} 个等级`
    });

    // 2. 检查用户 NFT 数据
    const database = db.getDatabase();
    const userNFTStats = database.prepare(`
      SELECT 
        un.user_address,
        COUNT(*) as nft_count,
        SUM(COALESCE(un.mint_price, nt.price)) as total_value,
        GROUP_CONCAT(DISTINCT nt.tier_name) as tier_names
      FROM user_nfts un
      LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
      GROUP BY un.user_address
    `).all();

    report.checks.push({
      name: '用户 NFT 数据',
      status: 'success',
      data: userNFTStats,
      summary: `${userNFTStats.length} 个用户有 NFT 记录`
    });

    // 3. 检查 users 表统计
    const userStats = database.prepare(`
      SELECT 
        wallet_address,
        team_name,
        nft_count,
        nft_mint_amount,
        commission_rate
      FROM users
      WHERE nft_count > 0 OR nft_mint_amount > 0
    `).all();

    report.checks.push({
      name: 'users 表统计',
      status: 'success',
      data: userStats,
      summary: `${userStats.length} 个用户有 NFT 统计`
    });

    // 4. 数据一致性检查
    const inconsistencies = [];
    
    userStats.forEach(user => {
      const actualNFTs = database.prepare(`
        SELECT 
          COUNT(*) as count,
          SUM(COALESCE(un.mint_price, nt.price)) as value
        FROM user_nfts un
        LEFT JOIN nft_tiers nt ON un.tier_id = nt.id
        WHERE un.user_address = ?
      `).get(user.wallet_address.toLowerCase());
      
      if (actualNFTs.count !== user.nft_count || Math.abs(actualNFTs.value - user.nft_mint_amount) > 0.01) {
        inconsistencies.push({
          wallet_address: user.wallet_address,
          users_table: {
            nft_count: user.nft_count,
            nft_mint_amount: user.nft_mint_amount
          },
          user_nfts_table: {
            nft_count: actualNFTs.count,
            total_value: actualNFTs.value
          }
        });
      }
    });

    report.checks.push({
      name: '数据一致性',
      status: inconsistencies.length === 0 ? 'success' : 'warning',
      data: inconsistencies,
      summary: inconsistencies.length === 0 
        ? '所有数据一致' 
        : `发现 ${inconsistencies.length} 个不一致`
    });

    // 5. 检查特定用户
    const testUser = '0xf4f02733696cc3bb2cffe8bb8e9f32058654c622';
    const userInfo = database.prepare(`
      SELECT * FROM users WHERE wallet_address = ?
    `).get(testUser.toLowerCase());

    const userNFTDetails = database.prepare(`
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

    const calculatedTotal = userNFTDetails.reduce((sum, nft) => sum + nft.effective_price, 0);

    report.checks.push({
      name: '测试用户详情',
      status: 'info',
      data: {
        user_info: userInfo,
        nft_details: userNFTDetails,
        calculated_total: calculatedTotal
      },
      summary: `用户有 ${userNFTDetails.length} 个 NFT，总价值 ${calculatedTotal} USDT`
    });

    return NextResponse.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('数据库检查失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
