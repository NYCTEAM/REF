import { NextResponse } from 'next/server';
import { db } from '../../../../lib/sqlite-db.js';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

// NFT 合约配置
const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc';
const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';

const NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
];

// 扫描用户当前持有的 NFT（使用 balanceOf + tokenOfOwnerByIndex）
async function scanUserBalance(walletAddress) {
  try {
    console.log(`🔍 扫描 ${walletAddress} 的 NFT 余额...`);
    
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    
    // 1. 获取用户持有的 NFT 数量
    const balance = await contract.balanceOf(walletAddress);
    const nftCount = Number(balance);
    
    console.log(`📊 ${walletAddress} 持有 ${nftCount} 个 NFT`);
    
    if (nftCount === 0) {
      // 用户没有 NFT，更新数据库
      db.updateUserBalanceStatus(walletAddress, 0, false);
      return { success: true, hasNFT: false, nftCount: 0 };
    }
    
    // 2. 获取每个 Token ID
    const tokenIds = [];
    for (let i = 0; i < nftCount; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
        tokenIds.push(Number(tokenId));
      } catch (error) {
        console.error(`获取 Token ID ${i} 失败:`, error);
      }
    }
    
    console.log(`✅ 获取到 Token IDs: ${tokenIds.join(', ')}`);
    
    // 3. 更新数据库状态
    db.updateUserBalanceStatus(walletAddress, nftCount, true);
    
    return { 
      success: true, 
      hasNFT: true, 
      nftCount, 
      tokenIds 
    };
    
  } catch (error) {
    console.error(`扫描 ${walletAddress} 余额失败:`, error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: '缺少钱包地址' },
        { status: 400 }
      );
    }

    // 扫描用户余额
    const result = await scanUserBalance(walletAddress);

    return NextResponse.json({
      success: true,
      message: result.hasNFT ? `持有 ${result.nftCount} 个 NFT` : '未持有 NFT',
      data: result
    });
  } catch (error) {
    console.error('扫描余额失败:', error);
    return NextResponse.json(
      { success: false, message: '扫描失败: ' + error.message },
      { status: 500 }
    );
  }
}
