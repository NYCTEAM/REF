import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

// NFT 扫描配置
const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc';
const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738;
const BLOCK_BATCH_SIZE = 2000;

// 扫描单个用户的 NFT
async function scanUserNFTs(walletAddress, provider, tiers, latestBlock) {
  try {
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    const userTopic = ethers.zeroPadValue(walletAddress, 32);
    
    // 获取上次同步的区块
    const syncProgress = db.getSyncProgress(walletAddress);
    const startBlock = syncProgress && syncProgress.last_block ? syncProgress.last_block + 1 : START_BLOCK;
    
    // 如果已经是最新的，跳过
    if (startBlock > latestBlock) {
      return { skipped: true, reason: '已是最新' };
    }
    
    console.log(`  📊 扫描 ${walletAddress.substring(0, 10)}... 从区块 ${startBlock} 到 ${latestBlock}`);
    
    let allLogs = [];
    
    for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += BLOCK_BATCH_SIZE) {
      const toBlock = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, latestBlock);
      
      try {
        const logs = await provider.getLogs({
          address: NFT_CONTRACT_ADDRESS,
          topics: [transferTopic, zeroAddressTopic, userTopic],
          fromBlock,
          toBlock
        });
        allLogs = allLogs.concat(logs);
        await new Promise(resolve => setTimeout(resolve, 100)); // 避免 RPC 限流
      } catch (error) {
        console.error(`    ❌ 区块 ${fromBlock}-${toBlock} 失败:`, error.message);
      }
    }
    
    if (allLogs.length === 0) {
      // 更新同步进度（即使没有新 NFT）
      db.updateSyncProgress(walletAddress, latestBlock, 0, 'completed');
      return { skipped: true, reason: '无新 NFT' };
    }
    
    // 处理 NFT 数据
    const nfts = [];
    for (const log of allLogs) {
      const tokenId = parseInt(log.topics[3], 16);
      const tier = tiers.find(t => tokenId >= t.token_id_start && tokenId <= t.token_id_end);
      
      if (tier) {
        const block = await provider.getBlock(log.blockNumber);
        const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
        
        nfts.push({
          tokenId,
          tierId: tier.id,
          tierName: tier.tier_name,
          price: tier.price,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp
        });
      }
    }
    
    // 保存到数据库
    let savedCount = 0;
    for (const nft of nfts) {
      const saved = db.saveUserNFT(
        walletAddress,
        nft.tokenId,
        nft.tierId,
        nft.price,
        nft.txHash,
        nft.blockNumber,
        nft.timestamp
      );
      if (saved) savedCount++;
    }
    
    // 重新计算统计
    const allUserNFTs = db.getUserNFTs(walletAddress);
    const totalNFTCount = allUserNFTs.length;
    const totalNFTValue = allUserNFTs.reduce((sum, nft) => sum + nft.price, 0);
    
    db.updateUserNftStats(walletAddress, totalNFTCount, totalNFTValue);
    db.updateSyncProgress(walletAddress, latestBlock, totalNFTCount, 'completed');
    
    return {
      success: true,
      newNFTs: savedCount,
      totalNFTs: totalNFTCount,
      totalValue: totalNFTValue,
      nftDetails: nfts
    };
    
  } catch (error) {
    console.error(`  ❌ 扫描 ${walletAddress} 失败:`, error.message);
    return { error: error.message };
  }
}

export async function POST() {
  try {
    console.log('🔍 开始扫描所有用户的 NFT...\n');
    
    // 连接 RPC
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const latestBlock = await provider.getBlockNumber();
    const tiers = db.getNFTTiers();
    
    console.log(`📊 当前最新区块: ${latestBlock}`);
    console.log(`📊 NFT 等级: ${tiers.length} 个\n`);
    
    // 获取所有用户
    const database = db.getDatabase();
    const users = database.prepare('SELECT wallet_address FROM users ORDER BY created_at').all();
    
    console.log(`👥 找到 ${users.length} 个用户\n`);
    
    const results = {
      total: users.length,
      scanned: 0,
      skipped: 0,
      updated: 0,
      errors: 0,
      newNFTsTotal: 0,
      details: []
    };
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] 扫描 ${user.wallet_address.substring(0, 10)}...`);
      
      const result = await scanUserNFTs(user.wallet_address, provider, tiers, latestBlock);
      results.scanned++;
      
      if (result.error) {
        results.errors++;
        results.details.push({
          wallet_address: user.wallet_address,
          status: 'error',
          error: result.error
        });
      } else if (result.skipped) {
        results.skipped++;
        console.log(`  ⏭️ ${result.reason}`);
      } else if (result.success) {
        results.updated++;
        results.newNFTsTotal += result.newNFTs;
        
        console.log(`  ✅ 新增 ${result.newNFTs} 个 NFT, 总计 ${result.totalNFTs} 个 (${result.totalValue} USDT)`);
        
        if (result.newNFTs > 0) {
          results.details.push({
            wallet_address: user.wallet_address,
            status: 'updated',
            new_nfts: result.newNFTs,
            total_nfts: result.totalNFTs,
            total_value: result.totalValue,
            nft_details: result.nftDetails
          });
        }
      }
      
      // 每扫描 5 个用户暂停一下，避免 RPC 限流
      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 扫描完成！');
    console.log('='.repeat(60));
    console.log(`总用户数: ${results.total}`);
    console.log(`已扫描: ${results.scanned}`);
    console.log(`已跳过: ${results.skipped}`);
    console.log(`已更新: ${results.updated}`);
    console.log(`错误数: ${results.errors}`);
    console.log(`新增 NFT 总数: ${results.newNFTsTotal}`);
    console.log('='.repeat(60));
    
    return NextResponse.json({
      success: true,
      message: `扫描完成！新增 ${results.newNFTsTotal} 个 NFT`,
      results
    });
    
  } catch (error) {
    console.error('扫描失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
