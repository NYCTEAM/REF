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

// 扫描用户 NFT
async function scanUserNFTs(walletAddress) {
  try {
    console.log(`🔍 刷新 ${walletAddress} 的 NFT...`);
    
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    const userTopic = ethers.zeroPadValue(walletAddress, 32);
    
    const tiers = db.getNFTTiers();
    const latestBlock = await provider.getBlockNumber();
    
    let allLogs = [];
    
    for (let fromBlock = START_BLOCK; fromBlock <= latestBlock; fromBlock += BLOCK_BATCH_SIZE) {
      const toBlock = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, latestBlock);
      
      const filter = {
        address: NFT_CONTRACT_ADDRESS,
        topics: [transferTopic, zeroAddressTopic, userTopic],
        fromBlock: fromBlock,
        toBlock: toBlock
      };
      
      try {
        const logs = await provider.getLogs(filter);
        allLogs = allLogs.concat(logs);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (batchError) {
        console.error(`查询区块 ${fromBlock}-${toBlock} 失败:`, batchError);
      }
    }
    
    const nfts = [];
    let totalValue = 0;
    
    for (const log of allLogs) {
      const tokenId = parseInt(log.topics[3], 16);
      const tier = tiers.find(t => 
        tokenId >= t.token_id_start && tokenId <= t.token_id_end
      );
      
      if (tier) {
        nfts.push({
          tokenId,
          tierId: tier.id,
          price: tier.price,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        });
        totalValue += tier.price;
      }
    }
    
    if (nfts.length > 0) {
      db.clearUserNFTs(walletAddress);
      
      for (const nft of nfts) {
        db.saveUserNFT(
          walletAddress,
          nft.tokenId,
          nft.tierId,
          nft.price,
          nft.txHash,
          nft.blockNumber
        );
      }
      
      db.updateUserNftStats(walletAddress, nfts.length, totalValue);
      db.updateSyncProgress(walletAddress, latestBlock, nfts.length, 'completed');
      
      console.log(`✅ ${walletAddress} NFT 刷新完成: ${nfts.length} 个 NFT, 总价值 ${totalValue} USDT`);
    } else {
      // 即使没有 NFT，也要更新统计为 0
      db.updateUserNftStats(walletAddress, 0, 0);
      console.log(`ℹ️ ${walletAddress} 没有持有 NFT`);
    }
    
    return { success: true, nftCount: nfts.length, totalValue };
    
  } catch (error) {
    console.error(`扫描 ${walletAddress} NFT 失败:`, error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { walletAddress, force } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: '缺少钱包地址' },
        { status: 400 }
      );
    }

    // 验证用户是否存在
    const userInfo = db.getUserInfo(walletAddress);
    if (!userInfo.exists) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    // 检查是否需要刷新（如果不是强制刷新）
    if (!force) {
      const syncProgress = db.getSyncProgress(walletAddress);
      if (syncProgress) {
        const lastSyncTime = new Date(syncProgress.updated_at);
        const now = new Date();
        const minutesSinceLastSync = (now - lastSyncTime) / (1000 * 60);
        
        // 如果上次同步在 5 分钟内，跳过
        if (minutesSinceLastSync < 5) {
          console.log(`⏭️ ${walletAddress} 数据较新（${minutesSinceLastSync.toFixed(1)} 分钟前），跳过刷新`);
          return NextResponse.json({
            success: true,
            message: '数据已是最新',
            data: {
              nftCount: syncProgress.nft_count || 0,
              totalValue: userInfo.user.nft_mint_amount || 0,
              skipped: true
            }
          });
        }
      }
    }

    // 扫描 NFT
    const result = await scanUserNFTs(walletAddress);

    return NextResponse.json({
      success: true,
      message: 'NFT 数据已刷新',
      data: result
    });
  } catch (error) {
    console.error('刷新 NFT 失败:', error);
    return NextResponse.json(
      { success: false, message: '刷新失败: ' + error.message },
      { status: 500 }
    );
  }
}
