import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

// NFT 扫描配置
const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc';
const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738; // 🔥 强制从这个区块开始
const BLOCK_BATCH_SIZE = 2000;

// 🔥 强制全量扫描单个用户（忽略同步进度）
async function forceRescanUser(walletAddress, provider, tiers, latestBlock) {
  try {
    console.log(`\n🔍 强制重扫 ${walletAddress}`);
    console.log(`   从区块 ${START_BLOCK} 到 ${latestBlock} (共 ${latestBlock - START_BLOCK} 个区块)`);
    
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    const userTopic = ethers.zeroPadValue(walletAddress, 32);
    
    let allLogs = [];
    let scannedBlocks = 0;
    
    // 🔥 从 START_BLOCK 开始完整扫描（不使用同步进度）
    for (let fromBlock = START_BLOCK; fromBlock <= latestBlock; fromBlock += BLOCK_BATCH_SIZE) {
      const toBlock = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, latestBlock);
      
      try {
        const logs = await provider.getLogs({
          address: NFT_CONTRACT_ADDRESS,
          topics: [transferTopic, zeroAddressTopic, userTopic],
          fromBlock,
          toBlock
        });
        
        if (logs.length > 0) {
          console.log(`   ✅ 区块 ${fromBlock}-${toBlock}: 找到 ${logs.length} 个 MINT 事件`);
          allLogs = allLogs.concat(logs);
        }
        
        scannedBlocks += (toBlock - fromBlock + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ 区块 ${fromBlock}-${toBlock} 失败:`, error.message);
      }
    }
    
    console.log(`   📊 扫描完成: ${scannedBlocks} 个区块, 找到 ${allLogs.length} 个 MINT 事件`);
    
    if (allLogs.length === 0) {
      return { 
        wallet_address: walletAddress,
        status: 'no_nfts',
        message: '未找到 MINT 事件'
      };
    }
    
    // 🔥 先清空该用户的旧 NFT 数据
    const database = db.getDatabase();
    const deleted = database.prepare('DELETE FROM user_nfts WHERE user_address = ?').run(walletAddress.toLowerCase());
    console.log(`   🗑️ 清空旧数据: 删除 ${deleted.changes} 条记录`);
    
    // 处理所有 NFT
    const nfts = [];
    const nftsByTier = {};
    const skippedTokens = [];
    
    for (const log of allLogs) {
      const tokenId = parseInt(log.topics[3], 16);
      const tier = tiers.find(t => tokenId >= t.token_id_start && tokenId <= t.token_id_end);
      
      if (tier) {
        const block = await provider.getBlock(log.blockNumber);
        const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
        
        const nft = {
          tokenId,
          tierId: tier.id,
          tierName: tier.tier_name,
          price: tier.price,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp
        };
        
        nfts.push(nft);
        
        // 按等级分组统计
        if (!nftsByTier[tier.tier_name]) {
          nftsByTier[tier.tier_name] = { count: 0, value: 0, tokens: [] };
        }
        nftsByTier[tier.tier_name].count++;
        nftsByTier[tier.tier_name].value += tier.price;
        nftsByTier[tier.tier_name].tokens.push(tokenId);
      } else {
        // 🔥 记录被跳过的 Token ID
        skippedTokens.push(tokenId);
        console.log(`   ⚠️ Token ID ${tokenId} 不在任何等级范围内，已跳过`);
      }
    }
    
    if (skippedTokens.length > 0) {
      console.log(`   ⚠️ 总共跳过 ${skippedTokens.length} 个 Token: ${skippedTokens.join(', ')}`);
    }
    
    // 🔥 保存所有 NFT 到数据库
    console.log(`   💾 保存 ${nfts.length} 个 NFT 到数据库...`);
    
    for (const nft of nfts) {
      db.saveUserNFT(
        walletAddress,
        nft.tokenId,
        nft.tierId,
        nft.price,
        nft.txHash,
        nft.blockNumber,
        nft.timestamp
      );
    }
    
    // 计算总价值
    const totalValue = nfts.reduce((sum, nft) => sum + nft.price, 0);
    
    // 更新用户统计
    db.updateUserNftStats(walletAddress, nfts.length, totalValue);
    db.updateSyncProgress(walletAddress, latestBlock, nfts.length, 'completed');
    
    console.log(`   ✅ 完成: ${nfts.length} 个 NFT, 总价值 ${totalValue} USDT`);
    console.log(`   📊 按等级统计:`);
    Object.entries(nftsByTier).forEach(([tierName, stats]) => {
      console.log(`      ${tierName}: ${stats.count} 个 (${stats.value} USDT) - Token IDs: ${stats.tokens.join(', ')}`);
    });
    
    return {
      wallet_address: walletAddress,
      status: 'success',
      nft_count: nfts.length,
      total_value: totalValue,
      nfts_by_tier: nftsByTier,
      all_nfts: nfts
    };
    
  } catch (error) {
    console.error(`   ❌ 扫描失败:`, error);
    return {
      wallet_address: walletAddress,
      status: 'error',
      error: error.message
    };
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { targetUser } = body; // 可选：只扫描特定用户
    
    console.log('🔥 开始强制全量重扫所有用户...');
    console.log(`📍 起始区块: ${START_BLOCK}`);
    console.log('⚠️ 警告: 将清空并重建所有 NFT 数据\n');
    
    // 连接 RPC
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const latestBlock = await provider.getBlockNumber();
    const tiers = db.getNFTTiers();
    
    console.log(`📊 当前最新区块: ${latestBlock}`);
    console.log(`📊 需要扫描: ${latestBlock - START_BLOCK} 个区块`);
    console.log(`📊 NFT 等级: ${tiers.length} 个\n`);
    
    // 获取用户列表
    const database = db.getDatabase();
    let users;
    
    if (targetUser) {
      // 只扫描特定用户
      users = [{ wallet_address: targetUser.toLowerCase() }];
      console.log(`🎯 只扫描用户: ${targetUser}\n`);
    } else {
      // 扫描所有用户
      users = database.prepare('SELECT wallet_address FROM users ORDER BY created_at').all();
      console.log(`👥 找到 ${users.length} 个用户\n`);
    }
    
    const results = {
      total: users.length,
      success: 0,
      no_nfts: 0,
      errors: 0,
      total_nfts: 0,
      total_value: 0,
      details: []
    };
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[${i + 1}/${users.length}] 处理 ${user.wallet_address}`);
      console.log('='.repeat(60));
      
      const result = await forceRescanUser(user.wallet_address, provider, tiers, latestBlock);
      
      if (result.status === 'success') {
        results.success++;
        results.total_nfts += result.nft_count;
        results.total_value += result.total_value;
        results.details.push(result);
      } else if (result.status === 'no_nfts') {
        results.no_nfts++;
      } else if (result.status === 'error') {
        results.errors++;
        results.details.push(result);
      }
      
      // 每扫描 3 个用户暂停一下
      if ((i + 1) % 3 === 0 && i + 1 < users.length) {
        console.log('\n⏸️ 暂停 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 强制重扫完成！');
    console.log('='.repeat(60));
    console.log(`总用户数: ${results.total}`);
    console.log(`成功: ${results.success}`);
    console.log(`无 NFT: ${results.no_nfts}`);
    console.log(`错误: ${results.errors}`);
    console.log(`总 NFT 数: ${results.total_nfts}`);
    console.log(`总价值: ${results.total_value} USDT`);
    console.log('='.repeat(60));
    
    return NextResponse.json({
      success: true,
      message: `强制重扫完成！找到 ${results.total_nfts} 个 NFT，总价值 ${results.total_value} USDT`,
      results
    });
    
  } catch (error) {
    console.error('强制重扫失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
