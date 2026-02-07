import { NextResponse } from 'next/server';
import { db } from '../../../lib/sqlite-db.js';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

// NFT 扫描配置
const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc'; // Eagle Swap HK 节点
const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738; // NFT 合约部署区块
const BLOCK_BATCH_SIZE = 2000; // 每次查询 2000 个区块

// 自动扫描用户 NFT 的函数
async function scanUserNFTs(walletAddress) {
  try {
    console.log(`🔍 开始扫描 ${walletAddress} 的 NFT...`);
    
    // 使用 Eagle Swap 的 RPC 节点，带 API key
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    const userTopic = ethers.zeroPadValue(walletAddress, 32);
    
    // 获取 NFT 等级配置
    const tiers = db.getNFTTiers();
    
    // 获取最新区块
    const latestBlock = await provider.getBlockNumber();
    console.log(`📊 当前最新区块: ${latestBlock}, 起始区块: ${START_BLOCK}`);
    
    let allLogs = [];
    
    // 分批查询
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
        if (logs.length > 0) {
          console.log(`✅ 区块 ${fromBlock}-${toBlock}: 找到 ${logs.length} 个 MINT 事件`);
        }
        allLogs = allLogs.concat(logs);
        
        // 延迟避免速率限制
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (batchError) {
        console.error(`❌ 查询区块 ${fromBlock}-${toBlock} 失败:`, batchError);
      }
    }
    
    console.log(`📝 总共找到 ${allLogs.length} 个 MINT 事件`);
    
    // 解析 NFT 并匹配等级
    const nfts = [];
    let totalValue = 0;
    
    for (const log of allLogs) {
      const tokenId = parseInt(log.topics[3], 16);
      
      // 根据 Token ID 查找等级
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
    
    // 保存到数据库
    // 清除旧数据
    db.clearUserNFTs(walletAddress);
    
    if (nfts.length > 0) {
      // 保存新数据
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
      
      console.log(`✅ ${walletAddress} NFT 扫描完成: ${nfts.length} 个 NFT, 总价值 ${totalValue} USDT`);
    } else {
      console.log(`ℹ️ ${walletAddress} 没有持有 NFT`);
    }
    
    // 🔥 无论是否有 NFT，都要更新统计和同步进度
    db.updateUserNftStats(walletAddress, nfts.length, totalValue);
    db.updateSyncProgress(walletAddress, latestBlock, nfts.length, 'completed');
    
  } catch (error) {
    console.error(`扫描 ${walletAddress} NFT 失败:`, error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { walletAddress, referrerAddress, teamName } = await request.json();

    if (!walletAddress || !teamName) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, message: '无效的钱包地址格式' },
        { status: 400 }
      );
    }

    // 不能推荐自己
    if (referrerAddress && walletAddress.toLowerCase() === referrerAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: '不能推荐自己' },
        { status: 400 }
      );
    }

    // 绑定推荐关系
    const result = db.bindReferral(walletAddress, referrerAddress, teamName);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: '该钱包地址已经绑定过了', alreadyBound: true },
        { status: 400 }
      );
    }

    // 🔥 同步扫描用户的 NFT，确保绑定后立即有正确的 NFT 状态
    try {
      await scanUserNFTs(walletAddress);
      console.log(`✅ ${walletAddress} 绑定成功，NFT 数据已同步`);
    } catch (scanError) {
      console.error(`⚠️ ${walletAddress} 绑定成功，但 NFT 扫描失败:`, scanError);
      // 即使扫描失败，也返回绑定成功（用户可以稍后手动刷新）
    }

    return NextResponse.json({
      success: true,
      message: '绑定成功',
      data: { teamName }
    });
  } catch (error) {
    console.error('绑定失败:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
