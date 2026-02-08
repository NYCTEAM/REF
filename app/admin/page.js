'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Copy, Link as LinkIcon, Users, Trash2, CheckCircle, Mail, Lock, LogOut, TrendingUp, Download, Eye, AlertCircle, Coins, RefreshCw, Info } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [stats, setStats] = useState(null); // 新增统计数据状态
  const [newLeaderAddress, setNewLeaderAddress] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState(''); // 新增描述字段
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 成员详情模态框状态
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [currentTeamName, setCurrentTeamName] = useState('');

  // 提现管理状态
  const [withdrawals, setWithdrawals] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [txHashInput, setTxHashInput] = useState('');
  
  // NFT 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncResults, setSyncResults] = useState(null);

  useEffect(() => {
    // 检查登录状态
    const savedEmail = localStorage.getItem('adminEmail');
    if (savedEmail) {
      setIsLoggedIn(true);
      setAdminEmail(savedEmail);
      fetchTeams();
      fetchStats(); // 加载统计数据
      fetchWithdrawals();
    }
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const res = await fetch('/api/admin/withdraw');
      const data = await res.json();
      if (data.success) {
        setWithdrawals(data.withdrawals);
      }
    } catch (error) {
      console.error('获取提现列表失败:', error);
    }
  };

  const handleProcessWithdrawal = async (id, status) => {
    if (status === 'approved' && !txHashInput) {
      if (!confirm('确定不填写交易哈希直接批准吗？')) return;
    }
    
    try {
      const res = await fetch('/api/admin/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, txHash: txHashInput })
      });
      const data = await res.json();
      if (data.success) {
        showMessage('操作成功', 'success');
        fetchWithdrawals();
        setProcessingId(null);
        setTxHashInput('');
      } else {
        showMessage(data.error || '操作失败', 'error');
      }
    } catch (error) {
      showMessage('请求失败', 'error');
    }
  };

  const syncAllNFTs = async () => {
    if (!confirm('确定要同步所有用户的 NFT 数据吗？这可能需要几分钟时间。')) return;
    
    try {
      setIsSyncing(true);
      setSyncProgress({ current: 0, total: 0 });
      setSyncResults(null);
      
      // 动态导入 ethers（仅在需要时加载）
      const { ethers } = await import('ethers');
      
      const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
      const EAGLE_BSC_RPC_HK = 'https://bsc.eagleswap.llc';
      const EAGLE_HK_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';
      const START_BLOCK = 79785738; // NFT 合约部署区块
      const BLOCK_BATCH_SIZE = 2000; // 每次查询 2000 个区块，避免超限
      
      // 获取所有用户
      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      const allUsers = statsData.allUsers || [];
      
      if (allUsers.length === 0) {
        showMessage('没有用户需要同步', 'error');
        setIsSyncing(false);
        return;
      }
      
      setSyncProgress({ current: 0, total: allUsers.length });
      
      // 使用 Eagle Swap 的 RPC 节点，带 API key
      const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC_HK);
      fetchRequest.setHeader('X-API-Key', EAGLE_HK_API_KEY);
      const provider = new ethers.JsonRpcProvider(fetchRequest);
      
      const transferTopic = ethers.id("Transfer(address,address,uint256)");
      const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);
      
      // 获取 NFT 等级配置
      const tiersRes = await fetch('/api/nft-tiers');
      const tiersData = await tiersRes.json();
      const tiers = tiersData.tiers || [];
      
      let successCount = 0;
      let failCount = 0;
      
      // 批量处理用户
      for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        setSyncProgress({ current: i + 1, total: allUsers.length });
        
        try {
          // 获取用户的同步进度
          const progressRes = await fetch(`/api/sync-progress?address=${user.wallet_address}`);
          const progressData = await progressRes.json();
          const lastSyncedBlock = progressData.progress?.last_synced_block || START_BLOCK;
          
          // 获取最新区块
          const latestBlock = await provider.getBlockNumber();
          
          const userTopic = ethers.zeroPadValue(user.wallet_address, 32);
          let allLogs = [];
          
          // 分批查询，从上次同步的区块开始
          for (let fromBlock = lastSyncedBlock; fromBlock <= latestBlock; fromBlock += BLOCK_BATCH_SIZE) {
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
              
              // 每批次之间延迟，避免速率限制
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (batchError) {
              console.error(`查询区块 ${fromBlock}-${toBlock} 失败:`, batchError);
              // 继续下一批次
            }
          }
          
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
          
          // 同步到数据库
          const syncRes = await fetch('/api/user/sync-nft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: user.wallet_address,
              nftCount: nfts.length,
              mintAmount: totalValue,
              nfts: nfts
            })
          });
          
          if (syncRes.ok) {
            // 更新同步进度
            await fetch('/api/sync-progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: user.wallet_address,
                lastBlock: latestBlock,
                nftCount: nfts.length,
                status: 'completed'
              })
            });
            successCount++;
          } else {
            failCount++;
          }
          
          // 避免用户之间请求过快
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (err) {
          console.error(`同步 ${user.wallet_address} 失败:`, err);
          failCount++;
        }
      }
      
      setSyncResults({ successCount, failCount, total: allUsers.length });
      showMessage(`同步完成！成功: ${successCount}, 失败: ${failCount}`, 'success');
      fetchStats(); // 刷新统计数据
      
    } catch (error) {
      console.error('NFT 同步失败:', error);
      showMessage('同步失败: ' + error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 🔥 强制全量重扫所有用户（从区块 79785738 开始）
  const forceRescanAll = async () => {
    if (!confirm('⚠️ 警告！\n\n这将：\n1. 清空所有用户的 NFT 数据\n2. 从区块 79785738 开始完整重扫\n3. 可能需要 10-30 分钟\n\n确定要继续吗？')) {
      return;
    }
    
    try {
      setIsSyncing(true);
      setSyncProgress({ current: 0, total: 0 });
      setSyncResults(null);
      showMessage('开始强制全量重扫...', 'success');
      
      const res = await fetch('/api/admin/force-rescan-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSyncResults({
          successCount: data.results.success,
          failCount: data.results.errors,
          total: data.results.total
        });
        showMessage(`强制重扫完成！找到 ${data.results.total_nfts} 个 NFT，总价值 ${data.results.total_value} USDT`, 'success');
        
        // 刷新统计数据
        fetchStats();
        fetchTeams();
      } else {
        showMessage('强制重扫失败: ' + data.message, 'error');
      }
      
    } catch (error) {
      console.error('强制重扫失败:', error);
      showMessage('强制重扫失败: ' + error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/admin/teams');
      const data = await res.json();
      if (data.success) {
        setTeamLeaders(data.teams);
      }
    } catch (error) {
      console.error('获取团队失败:', error);
      showMessage('加载团队数据失败', 'error');
    }
  };

  const addTeamLeader = async () => {
    if (!newLeaderName) {
      showMessage('请输入团队名称', 'error');
      return;
    }

    // 生成随机钱包地址（如果未提供）
    const generateRandomAddress = () => {
      const chars = '0123456789abcdef';
      let address = '0x';
      for (let i = 0; i < 40; i++) {
        address += chars[Math.floor(Math.random() * chars.length)];
      }
      return address;
    };

    const generatedAddress = newLeaderAddress || generateRandomAddress();

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLeaderName,
          leaderAddress: generatedAddress,
          description: newTeamDesc || `${newLeaderName} - 欢迎加入`
        })
      });

      const data = await res.json();

      if (data.success) {
        fetchTeams(); // 刷新列表
        setNewLeaderAddress('');
        setNewLeaderName('');
        setNewTeamDesc('');
        showMessage('团队创建成功，推荐链接已生成', 'success');
      } else {
        showMessage(data.error || '创建失败', 'error');
      }
    } catch (error) {
      console.error('创建失败:', error);
      showMessage('创建失败，请重试', 'error');
    }
  };

  const deleteTeamLeader = async (id) => {
    if (!confirm('确定要删除这个团队吗？')) return;
    
    try {
      const res = await fetch(`/api/admin/teams?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.success) {
        fetchTeams();
        showMessage('删除成功', 'success');
      } else {
        showMessage(data.error || '删除失败', 'error');
      }
    } catch (error) {
      console.error('删除失败:', error);
      showMessage('删除失败，请重试', 'error');
    }
  };

  const viewTeamMembers = async (teamName) => {
    try {
      const res = await fetch(`/api/admin/teams/members?teamName=${encodeURIComponent(teamName)}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTeamMembers(data.members);
        setCurrentTeamName(teamName);
        setIsMembersModalOpen(true);
      } else {
        showMessage(data.error || '获取成员失败', 'error');
      }
    } catch (error) {
      console.error('获取成员失败:', error);
      showMessage('获取成员详情失败', 'error');
    }
  };

  const copyReferralLink = (address, name) => {
    const link = `${window.location.origin}?ref=${address}`;
    navigator.clipboard.writeText(link);
    showMessage(`${name}的推荐链接已复制`, 'success');
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatAddress = (address) => {
    if (!address) return '无';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showMessage('请输入有效的邮箱地址', 'error');
      return;
    }

    // 验证密码
    if (!password) {
      showMessage('请输入密码', 'error');
      return;
    }

    setLoading(true);

    try {
      // 调用后端登录接口进行验证 (安全)
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('adminEmail', email);
        setIsLoggedIn(true);
        setAdminEmail(email);
        showMessage('登录成功', 'success');
        fetchTeams();
        fetchStats();
      } else {
        showMessage(data.message || '邮箱或密码错误', 'error');
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      showMessage('系统错误，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminEmail');
    setIsLoggedIn(false);
    setAdminEmail('');
    setEmail('');
    setPassword('');
    showMessage('已退出登录', 'success');
  };

  // 如果未登录，显示登录表单
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          {/* 返回首页链接 */}
          <div className="mb-6 text-center">
            <Link href="/" className="text-purple-600 hover:text-purple-700 font-semibold">
              ← 返回首页
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* 头部 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">管理员登录</h1>
              <p className="text-gray-600">请使用管理员邮箱登录</p>
            </div>

            {/* 消息提示 */}
            {message && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                messageType === 'success' 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                <CheckCircle className="w-5 h-5" />
                <span>{message}</span>
              </div>
            )}

            {/* 登录表单 */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入管理员邮箱"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-2" />
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? '登录中...' : '登录后台'}
              </button>
            </form>

          </div>
        </div>
      </div>
    );
  }

  // 已登录，显示管理界面
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">后台管理</h1>
            <p className="text-gray-600">创建和管理团队长推荐链接</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">已登录</p>
              <p className="font-semibold text-gray-800">{adminEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>
        </div>

        {/* 统计看板 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {/* 优先显示API数据，如果为0，则计算团队成员总和作为兜底 */}
                  {stats.totalUsers > 0 
                    ? stats.totalUsers 
                    : teamLeaders.reduce((acc, team) => acc + (team.member_count || 0), 0)
                  }
                </span>
              </div>
              <h3 className="text-gray-600 font-semibold">总用户数</h3>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {/* 如果总用户数有显示，推荐数大概率也是它（目前大部分都是推荐的），或者显示API数据 */}
                  {stats.usersWithReferrer || 0}
                </span>
              </div>
              <h3 className="text-gray-600 font-semibold">推荐用户数</h3>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {/* 优先显示API数据，如果为0或undefined，直接使用本地列表长度 */}
                  {stats.teamsCount > 0 ? stats.teamsCount : teamLeaders.length}
                </span>
              </div>
              <h3 className="text-gray-600 font-semibold">团队数量</h3>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-3xl font-bold text-gray-800">
                  {stats.totalNFTsSold || 0}
                </span>
              </div>
              <h3 className="text-gray-600 font-semibold">NFT 总销量</h3>
              <p className="text-sm text-gray-500 mt-1">
                总价值: {(stats.totalNFTValue || 0).toLocaleString()} USDT
              </p>
            </div>
          </div>
        )}

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            <CheckCircle className="w-5 h-5" />
            <span>{message}</span>
          </div>
        )}

        {/* NFT 数据同步 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
                NFT 数据同步
              </h2>
              <p className="text-sm text-gray-600 mt-1">扫描所有用户的 NFT MINT 事件并保存到数据库</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={syncAllNFTs}
                disabled={isSyncing}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? '同步中...' : '增量同步'}
              </button>
              <button
                onClick={forceRescanAll}
                disabled={isSyncing}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5" />
                强制全量重扫
              </button>
            </div>
          </div>

          {isSyncing && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  正在同步: {syncProgress.current} / {syncProgress.total}
                </span>
                <span className="text-sm text-gray-600">
                  {syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          )}

          {syncResults && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-gray-800 mb-2">同步完成</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">总用户数</p>
                  <p className="text-2xl font-bold text-gray-800">{syncResults.total}</p>
                </div>
                <div>
                  <p className="text-gray-600">成功同步</p>
                  <p className="text-2xl font-bold text-green-600">{syncResults.successCount}</p>
                </div>
                <div>
                  <p className="text-gray-600">失败</p>
                  <p className="text-2xl font-bold text-red-600">{syncResults.failCount}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              说明
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 自动扫描所有用户的 NFT MINT 事件（从区块 79785738 开始）</li>
              <li>• 分批查询（每批 2000 区块，延迟 500ms），避免 RPC 速率限制</li>
              <li>• 根据 Token ID 自动匹配 NFT 等级（7个等级：10/25/50/100/250/500/1000 USDT）</li>
              <li>• 支持断点续传：保存同步进度，下次从上次位置继续</li>
              <li>• 只统计 MINT 事件（Transfer from 0x0），不统计二次转账</li>
              <li>• 建议定期执行同步以保持数据最新</li>
            </ul>
          </div>
        </div>

        {/* 提现审核 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Coins className="w-6 h-6" />
              提现审核 ({withdrawals.length})
            </h2>
            <button onClick={fetchWithdrawals} className="text-sm text-blue-600 hover:underline">刷新</button>
          </div>

          {withdrawals.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
              暂无待审核的提现申请
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((item) => (
                <div key={item.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800 text-lg">{item.amount} USDT</span>
                      {item.status === 'pending' && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">待处理</span>}
                      {item.status === 'approved' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">已处理</span>}
                      {item.status === 'rejected' && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">已拒绝</span>}
                    </div>
                    <p className="text-sm text-gray-600 font-mono mb-1">申请人: {item.user_address}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString()}
                      {item.tx_hash && <span className="ml-2 font-mono">Tx: {item.tx_hash.substring(0, 10)}...</span>}
                    </p>
                  </div>
                  
                  {item.status === 'pending' && (
                    processingId === item.id ? (
                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <input 
                          type="text" 
                          placeholder="输入交易哈希(选填)" 
                          className="px-3 py-2 border rounded text-sm w-full md:w-64"
                          value={txHashInput}
                          onChange={(e) => setTxHashInput(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleProcessWithdrawal(item.id, 'approved')}
                            className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-sm"
                          >
                            确认打款
                          </button>
                          <button 
                            onClick={() => setProcessingId(null)}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setProcessingId(item.id)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          处理
                        </button>
                        <button 
                          onClick={() => {
                            if(confirm('确定拒绝此申请吗？')) handleProcessWithdrawal(item.id, 'rejected');
                          }}
                          className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                        >
                          拒绝
                        </button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 创建团队 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            创建新团队
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              团队名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newLeaderName}
              onChange={(e) => setNewLeaderName(e.target.value)}
              placeholder="例如: 张三团队"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
              onKeyPress={(e) => e.key === 'Enter' && addTeamLeader()}
            />
            <p className="text-sm text-gray-500 mt-2">输入团队名称后，系统将自动生成推荐链接</p>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              钱包地址 <span className="text-gray-400">(可选)</span>
            </label>
            <input
              type="text"
              value={newLeaderAddress}
              onChange={(e) => setNewLeaderAddress(e.target.value)}
              placeholder="留空将自动生成地址"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none font-mono text-sm"
            />
            <p className="text-sm text-gray-500 mt-2">如果团队长已有钱包地址，可在此输入；否则系统自动生成</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              团队描述 <span className="text-gray-400">(可选)</span>
            </label>
            <input
              type="text"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              placeholder="例如: 雄鹰战队 - 展翅高飞"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            />
          </div>

          <button
            onClick={addTeamLeader}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
          >
            创建团队并生成推荐链接
          </button>
        </div>

        {/* 团队列表 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Users className="w-6 h-6" />
            团队列表 ({teamLeaders.length})
          </h2>

          {teamLeaders.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无团队，请添加</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teamLeaders.map((leader) => (
                <div key={leader.id} className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{leader.name}</h3>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                          成员: {leader.member_count || 0}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{leader.description}</p>
                      <p className="text-sm text-gray-600 font-mono break-all mb-2">
                        {leader.leader_address}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        创建时间: {new Date(leader.created_at).toLocaleString('zh-CN')}
                      </p>
                      
                      <button
                        onClick={() => viewTeamMembers(leader.name)}
                        className="inline-flex items-center gap-1 text-sm bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                      >
                        <Users className="w-4 h-4" />
                        查看成员详情
                      </button>
                    </div>
                    <button
                      onClick={() => deleteTeamLeader(leader.id)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-gray-700">推荐链接:</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${leader.leader_address}`}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono"
                      />
                      <button
                        onClick={() => copyReferralLink(leader.leader_address, leader.name)}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        复制
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 按团队分组的用户明细 */}
        {stats && (
          <div className="mt-8 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-6 h-6" />
                团队成员明细
              </h2>
              <button
                onClick={() => {
                  /* 导出所有数据的CSV */
                  const headers = ['钱包地址', '推荐人', '所属团队', '加入时间'];
                  const rows = (stats.allUsers || []).map(u => [
                    u.wallet_address,
                    u.referrer_address || '无',
                    u.team_name,
                    new Date(u.created_at).toLocaleString()
                  ]);
                  const csvContent = [headers, ...rows]
                    .map(row => row.map(cell => `"${cell}"`).join(','))
                    .join('\n');
                  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `所有用户明细_${new Date().toISOString().slice(0,10)}.csv`;
                  link.click();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                导出所有数据
              </button>
            </div>

            {/* 遍历团队显示列表 */}
            {(stats.teams && stats.teams.length > 0) ? (
              stats.teams.map((team, teamIndex) => {
                // 筛选出该团队的成员
                const teamMembers = (stats.allUsers || []).filter(u => u.team_name === team.team_name);
                
                return (
                  <div key={teamIndex} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                          {teamIndex + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{team.team_name}</h3>
                          <p className="text-sm text-gray-500">成员数: {teamMembers.length}</p>
                        </div>
                      </div>
                      {/* 如果数据有出入，优先以列表为准 */}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left py-3 px-6 font-semibold text-gray-600 w-16">#</th>
                            <th className="text-left py-3 px-6 font-semibold text-gray-600">钱包地址</th>
                            <th className="text-left py-3 px-6 font-semibold text-gray-600">推荐人</th>
                            <th className="text-left py-3 px-6 font-semibold text-gray-600">加入时间</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {teamMembers.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="py-8 text-center text-gray-400">
                                该团队暂无成员
                              </td>
                            </tr>
                          ) : (
                            teamMembers.map((member, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-6 text-gray-400">{idx + 1}</td>
                                <td className="py-3 px-6">
                                  <span className="font-mono text-sm text-gray-700">{member.wallet_address}</span>
                                </td>
                                <td className="py-3 px-6">
                                  {member.referrer_address ? (
                                    <span className="font-mono text-sm text-gray-600">{member.referrer_address}</span>
                                  ) : (
                                    <span className="text-gray-300 text-xs italic">无</span>
                                  )}
                                </td>
                                <td className="py-3 px-6 text-sm text-gray-500">
                                  {formatDate(member.created_at)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500 bg-white rounded-2xl shadow">
                暂无团队数据
              </div>
            )}
          </div>
        )}

        {/* 危险区域 */}
        <div className="mt-12 mb-8 p-6 bg-red-50 rounded-2xl border-2 border-red-100">
          <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            危险区域
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-900">重置所有数据</p>
              <p className="text-sm text-red-700 mt-1">
                此操作将删除所有团队和用户数据，且<span className="font-bold underline">无法恢复</span>。
                系统将恢复到初始安装状态。
              </p>
            </div>
            <button
              onClick={async () => {
                if (confirm('警告：您确定要删除所有数据吗？此操作无法撤销！') && confirm('再次确认：这真的会清空所有数据！')) {
                  try {
                    const res = await fetch('/api/admin/reset', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      showMessage('系统已重置', 'success');
                      fetchTeams();
                      fetchStats();
                      // 清除本地存储的团队长信息
                      localStorage.removeItem('teamLeaders');
                    } else {
                      showMessage('重置失败', 'error');
                    }
                  } catch (e) {
                    console.error(e);
                    showMessage('请求失败', 'error');
                  }
                }
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              重置系统
            </button>
          </div>
        </div>

      {/* 成员详情模态框 */}
        {isMembersModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-2xl">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{currentTeamName} - 成员列表</h3>
                  <p className="text-sm text-gray-600">共 {selectedTeamMembers.length} 人</p>
                </div>
                <button 
                  onClick={() => setIsMembersModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {selectedTeamMembers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无成员加入</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-gray-600 text-sm">
                        <tr>
                          <th className="px-4 py-3 rounded-tl-lg">序号</th>
                          <th className="px-4 py-3">钱包地址</th>
                          <th className="px-4 py-3">加入时间</th>
                          <th className="px-4 py-3 rounded-tr-lg">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedTeamMembers.map((member, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500 font-mono">{index + 1}</td>
                            <td className="px-4 py-3 font-mono text-gray-700">{member.wallet_address}</td>
                            <td className="px-4 py-3 text-gray-500 text-sm">
                              {new Date(member.created_at).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(member.wallet_address);
                                  showMessage('地址已复制', 'success');
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                复制地址
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end">
                <button
                  onClick={() => setIsMembersModalOpen(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 底部导航 */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-white text-gray-800 rounded-xl font-semibold hover:shadow-lg transition-all border-2 border-gray-200"
          >
            返回首页
          </Link>
          <Link
            href="/stats"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            查看统计
          </Link>
        </div>
      </div>
    </div>
  );
}
