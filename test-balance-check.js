// 验证用户的 NFT 余额
const { ethers } = require('ethers');

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC = 'https://bsc.eagleswap.llc';
const EAGLE_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';

const NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
];

const TEST_USERS = [
  '0x29ea2055ce84d18f13229c3c8067d6acad1d0233',
  '0x04e2e260fb8108985a21cf9ed36cdc90a273afa4',
  '0xc6c923cbf60051207ce439badba3094a5da0cd19',
  '0xe4724592897fb5773ea049bc4010d2e30aa1bd9c',
  '0xcd459fc1105432a2e6c7c7b9535898a4a78fa23e'
];

async function checkBalances() {
  console.log('🔍 检查用户 NFT 余额...\n');
  
  const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC);
  fetchRequest.setHeader('X-API-Key', EAGLE_API_KEY);
  const provider = new ethers.JsonRpcProvider(fetchRequest);
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
  
  let totalNFTs = 0;
  
  for (const userAddress of TEST_USERS) {
    const balance = await contract.balanceOf(userAddress);
    const nftCount = Number(balance);
    
    console.log(`👤 ${userAddress.substring(0, 10)}... 持有 ${nftCount} 个 NFT`);
    
    if (nftCount > 0) {
      const tokenIds = [];
      for (let i = 0; i < nftCount; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(userAddress, i);
        tokenIds.push(Number(tokenId));
      }
      console.log(`   Token IDs: ${tokenIds.join(', ')}`);
      totalNFTs += nftCount;
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log(`📊 总计: ${totalNFTs} 个 NFT (所有用户)`);
  console.log('='.repeat(60));
}

checkBalances().catch(console.error);
