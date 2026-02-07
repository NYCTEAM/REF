// 测试 NFT 扫描
const { ethers } = require('ethers');

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc';
const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
const START_BLOCK = 79785738;

// 测试地址（已知持有 NFT）
const TEST_ADDRESS = '0x4af7f86c70a6fba4ed9d49074d0805a3c63b1e5b';

async function testScan() {
  try {
    console.log('🔍 开始测试 NFT 扫描...\n');
    
    // 1. 测试 RPC 连接
    console.log('1️⃣ 测试 RPC 连接...');
    const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
    fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
    const provider = new ethers.JsonRpcProvider(fetchRequest);
    
    const latestBlock = await provider.getBlockNumber();
    console.log(`✅ RPC 连接成功，当前区块: ${latestBlock}\n`);
    
    // 2. 测试 balanceOf
    console.log('2️⃣ 测试 balanceOf...');
    const NFT_ABI = ['function balanceOf(address owner) view returns (uint256)'];
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    const balance = await contract.balanceOf(TEST_ADDRESS);
    console.log(`✅ ${TEST_ADDRESS} 持有 ${balance} 个 NFT\n`);
    
    // 3. 测试 MINT 事件扫描
    console.log('3️⃣ 测试 MINT 事件扫描...');
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    const userTopic = ethers.zeroPadValue(TEST_ADDRESS, 32);
    
    console.log(`合约地址: ${NFT_CONTRACT_ADDRESS}`);
    console.log(`Transfer Topic: ${transferTopic}`);
    console.log(`From (0x0): ${zeroAddressTopic}`);
    console.log(`To (User): ${userTopic}`);
    console.log(`区块范围: ${START_BLOCK} - ${latestBlock}\n`);
    
    const filter = {
      address: NFT_CONTRACT_ADDRESS,
      topics: [transferTopic, zeroAddressTopic, userTopic],
      fromBlock: START_BLOCK,
      toBlock: latestBlock
    };
    
    const logs = await provider.getLogs(filter);
    console.log(`✅ 找到 ${logs.length} 个 MINT 事件\n`);
    
    if (logs.length > 0) {
      console.log('📝 MINT 事件详情:');
      logs.forEach((log, index) => {
        const tokenId = parseInt(log.topics[3], 16);
        console.log(`  ${index + 1}. Token ID: ${tokenId}, 区块: ${log.blockNumber}, TX: ${log.transactionHash}`);
      });
    } else {
      console.log('⚠️ 没有找到 MINT 事件！');
      console.log('\n可能的原因:');
      console.log('  1. 用户的 NFT 不是通过 MINT 获得的（转账、空投等）');
      console.log('  2. 合约地址错误');
      console.log('  3. 起始区块不对');
      console.log('  4. Topic 计算错误');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testScan();
