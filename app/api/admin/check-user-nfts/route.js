import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc';
const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';

const NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

export async function POST(request) {
  try {
    const { walletAddress } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: '缺少钱包地址' },
        { status: 400 }
      );
    }
    
    console.log(`\n🔍 检查用户 ${walletAddress} 当前持有的 NFT...\n`);
    
    // 连接 RPC
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    
    // 获取用户持有的 NFT 数量
    const balance = await nftContract.balanceOf(walletAddress);
    const balanceNum = Number(balance);
    
    console.log(`📊 用户持有 ${balanceNum} 个 NFT\n`);
    
    if (balanceNum === 0) {
      return NextResponse.json({
        success: true,
        balance: 0,
        tokens: []
      });
    }
    
    // 获取所有 Token IDs
    const tokenIds = [];
    for (let i = 0; i < balanceNum; i++) {
      const tokenId = await nftContract.tokenOfOwnerByIndex(walletAddress, i);
      tokenIds.push(Number(tokenId));
    }
    
    console.log(`✅ Token IDs: ${tokenIds.join(', ')}\n`);
    
    // NFT 等级配置
    const tiers = [
      { name: 'Micro Node 🪙', price: 10, start: 1, end: 5000 },
      { name: 'Mini Node ⚪', price: 25, start: 5001, end: 8000 },
      { name: 'Bronze Node 🥉', price: 50, start: 8001, end: 10000 },
      { name: 'Silver Node 🥈', price: 100, start: 10001, end: 11500 },
      { name: 'Gold Node 🥇', price: 250, start: 11501, end: 12600 },
      { name: 'Platinum Node 💎', price: 500, start: 12601, end: 13300 },
      { name: 'Diamond Node 💠', price: 1000, start: 13301, end: 13900 }
    ];
    
    // 匹配等级
    const nfts = tokenIds.map(tokenId => {
      const tier = tiers.find(t => tokenId >= t.start && tokenId <= t.end);
      return {
        tokenId,
        tierName: tier ? tier.name : '未知',
        price: tier ? tier.price : 0
      };
    });
    
    // 按等级分组
    const grouped = {};
    nfts.forEach(nft => {
      if (!grouped[nft.tierName]) {
        grouped[nft.tierName] = { count: 0, value: 0, tokens: [] };
      }
      grouped[nft.tierName].count++;
      grouped[nft.tierName].value += nft.price;
      grouped[nft.tierName].tokens.push(nft.tokenId);
    });
    
    const totalValue = nfts.reduce((sum, nft) => sum + nft.price, 0);
    
    console.log('📊 按等级统计:');
    Object.entries(grouped).forEach(([tierName, stats]) => {
      console.log(`  ${tierName}: ${stats.count} 个 (${stats.value} USDT) - Token IDs: ${stats.tokens.join(', ')}`);
    });
    console.log(`\n💰 总价值: ${totalValue} USDT\n`);
    
    return NextResponse.json({
      success: true,
      wallet_address: walletAddress,
      balance: balanceNum,
      total_value: totalValue,
      tokens: nfts,
      grouped
    });
    
  } catch (error) {
    console.error('检查失败:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
