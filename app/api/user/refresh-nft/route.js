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
    
    // 🔥 获取上次同步的区块，实现增量扫描
    const syncProgress = db.getSyncProgress(walletAddress);
    const startBlock = syncProgress && syncProgress.last_block ? syncProgress.last_block + 1 : START_BLOCK;
    
    console.log(`📊 刷新扫描: 最新区块 ${latestBlock}, 起始区块 ${startBlock}${syncProgress ? ' (增量)' : ' (首次)'}`);
    
    // 如果已经是最新的，跳过扫描
    if (startBlock > latestBlock) {
      console.log(`✅ ${walletAddress} 已是最新数据`);
      const allUserNFTs = db.getUserNFTs(walletAddress);
      const totalNFTCount = allUserNFTs.length;
      const totalNFTValue = allUserNFTs.reduce((sum, nft) => sum + nft.price, 0);
      return { success: true, nftCount: totalNFTCount, totalValue: totalNFTValue };
    }
    
    let allLogs = [];
    
    for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += BLOCK_BATCH_SIZE) {
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
        // 获取区块时间戳
        const block = await provider.getBlock(log.blockNumber);
        const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
        
        nfts.push({
          tokenId,
          tierId: tier.id,
          price: tier.price,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp
        });
        totalValue += tier.price;
      }
    }
    
    // 🔥 增量保存到数据库（不删除旧数据）
    if (nfts.length > 0) {
      console.log(`📝 发现 ${nfts.length} 个新 NFT，保存到数据库...`);
      
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
      
      console.log(`✅ ${walletAddress} 新增 ${nfts.length} 个 NFT, 价值 ${totalValue} USDT`);
    } else {
      console.log(`ℹ️ ${walletAddress} 本次扫描没有新 NFT`);
    }
    
    // 🔥 重新计算用户的总 NFT 数量和价值
    const allUserNFTs = db.getUserNFTs(walletAddress);
    const totalNFTCount = allUserNFTs.length;
    const totalNFTValue = allUserNFTs.reduce((sum, nft) => sum + nft.price, 0);
    
    // 更新用户统计和同步进度
    db.updateUserNftStats(walletAddress, totalNFTCount, totalNFTValue);
    db.updateSyncProgress(walletAddress, latestBlock, totalNFTCount, 'completed');
    
    console.log(`📊 ${walletAddress} 总计: ${totalNFTCount} 个 NFT, 总价值 ${totalNFTValue} USDT`);
    
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
        
        // 如果上次同步在 1 分钟内，跳过
        if (minutesSinceLastSync < 1) {
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
