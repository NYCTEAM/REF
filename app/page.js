'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wallet, Users, CheckCircle, AlertCircle, Link as LinkIcon, Shield, Copy, Info, Loader2, Coins, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { ethers } from 'ethers';

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

// 🔥 使用 Eagle Swap 专用 RPC（更快，更稳定）
const EAGLE_BSC_RPC = 'https://bsc.eagleswap.llc';
const EAGLE_API_KEY = '26119c762d57f906602c2d4bed374e05bab696dccdd2c8708cfacd4303f71c5f';

// 备用公共 RPC（如果专用 RPC 失败）
const PUBLIC_BSC_RPC = 'https://bsc-dataseed1.binance.org/';

function HomeContent() {
  const searchParams = useSearchParams();
  const [walletAddress, setWalletAddress] = useState('');
  const [referrerAddress, setReferrerAddress] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [invitingTeamName, setInvitingTeamName] = useState(''); 
  const [teamName, setTeamName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isBound, setIsBound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true); // 默认为 true，直到首次检查完成
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); 
  const [teamMembers, setTeamMembers] = useState([]); 
  const [teammates, setTeammates] = useState([]); 
  const [selectedTeam, setSelectedTeam] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [copiedTeammate, setCopiedTeammate] = useState('');
  const [isCopied, setIsCopied] = useState(false); // 复制按钮状态
  
  // NFT & 佣金状态
  const [memberNFTs, setMemberNFTs] = useState({}); 
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState(0);
  const [myNFTBalance, setMyNFTBalance] = useState(0); // 当前用户的 NFT 余额
  const [commissionStats, setCommissionStats] = useState({
    totalPerformance: 0,
    currentRate: 0.10,
    totalCommission: 0,
    available: 0
  });
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [referrerRanking, setReferrerRanking] = useState([]); // 推荐人排行榜
  const [showAllReferrers, setShowAllReferrers] = useState(false); // 是否显示全部排名

  // 🔥 获取推荐人排行榜
  const fetchReferrerRanking = async () => {
    try {
      const res = await fetch('/api/referrer-ranking');
      const data = await res.json();
      if (data.success) {
        setReferrerRanking(data.data || []);
      }
    } catch (error) {
      console.error('获取推荐人排行榜失败:', error);
    }
  };

  // 从API加载团队列表
  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      if (Array.isArray(data)) {
        setAvailableTeams(data);
      }
    } catch (error) {
      console.error('获取列表失败:', error);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchReferrerRanking(); // 获取推荐人排行榜
  }, []);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerAddress(ref);
      
      const fetchTeamInfo = async () => {
        try {
          const res = await fetch(`/api/team-info?address=${ref}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.team) {
              setReferrerName(data.team.name);
              setInvitingTeamName(data.team.name);
            }
          }
        } catch (error) {
          console.error('获取信息失败:', error);
        }
      };
      
      fetchTeamInfo();
    }
  }, [searchParams]);

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
          });
          
          if (accounts.length > 0) {
            console.log('检测到已连接的钱包:', accounts[0]);
            setWalletAddress(accounts[0]);
            setIsConnected(true);
          } else {
            console.log('未检测到已连接的钱包');
          }
        } catch (error) {
          console.error('检查钱包连接失败:', error);
        }
      }
    };

    checkWalletConnection();
  }, []);

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts) => {
        console.log('账户已切换:', accounts);
        if (accounts.length === 0) {
          setWalletAddress('');
          setIsConnected(false);
          setIsBound(false);
          setTeamName('');
          setTeamMembers([]);
          showMessage('钱包已断开连接', 'error');
        } else {
          const newAddress = accounts[0];
          console.log('新账户地址:', newAddress);
          setWalletAddress(newAddress);
          setIsConnected(true);
          // 不要立即重置 isBound，让 checkUserStatus 来判断
          // setIsBound(false);
          // setTeamName('');
          // setTeamMembers([]);
          showMessage('已切换到新钱包，正在检查状态...', 'success');
          // checkUserStatus 会在 walletAddress 变化时自动执行
        }
      };

      const handleChainChanged = () => {
        console.log('链已切换，刷新页面');
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      checkUserStatus();
      fetchMyNFTBalance(); // 检查自己的 NFT 余额
      
      // 🔥 扫描用户余额状态（balanceOf + tokenOfOwnerByIndex）
      scanUserBalance();
      
      // 🔥 自动刷新 NFT 数据（如果需要）
      autoRefreshNFTData();
    }
  }, [walletAddress]);
  
  // 扫描用户余额状态
  const scanUserBalance = async () => {
    try {
      const res = await fetch('/api/user/scan-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      const data = await res.json();
      if (data.success) {
        console.log(`✅ 余额扫描完成: ${data.message}`);
        // 🔥 扫描完成后重新加载用户状态，显示最新的 NFT 数据
        await checkUserStatus();
      }
    } catch (error) {
      console.error('余额扫描失败:', error);
    }
  };
  
  // 自动刷新 NFT 数据
  const autoRefreshNFTData = async (forceRefresh = false) => {
    try {
      // 静默刷新，不显示加载状态
      const res = await fetch('/api/user/refresh-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress,
          force: forceRefresh // 强制刷新，忽略缓存
        })
      });
      const data = await res.json();
      if (data.success) {
        if (!data.data.skipped) {
          console.log(`✅ NFT 数据已自动刷新: ${data.data.nftCount} 个 NFT`);
          // 重新加载用户状态
          await checkUserStatus();
          await fetchMyNFTBalance();
        }
      }
    } catch (error) {
      console.error('自动刷新 NFT 失败:', error);
      // 静默失败，不打扰用户
    }
  };

  useEffect(() => {
    if (teamMembers.length > 0) {
      fetchMemberNFTs();
    }
  }, [teamMembers]);

  // 🔥 分阶段计算佣金
  // 业绩 0-2000 USDT: 10%
  // 业绩 2001-10000 USDT: 15%
  // 业绩 10001+ USDT: 20%
  const calculateTieredCommission = (totalPerformance) => {
    let commission = 0;
    
    if (totalPerformance <= 0) {
      return 0;
    }
    
    // 第一阶段: 0-2000 USDT @ 10%
    if (totalPerformance <= 2000) {
      commission = totalPerformance * 0.10;
    } else {
      commission = 2000 * 0.10; // 前 2000 的佣金 = 200
      
      // 第二阶段: 2001-10000 USDT @ 15%
      if (totalPerformance <= 10000) {
        commission += (totalPerformance - 2000) * 0.15;
      } else {
        commission += 8000 * 0.15; // 2001-10000 的佣金 = 1200
        
        // 第三阶段: 10001+ USDT @ 20%
        commission += (totalPerformance - 10000) * 0.20;
      }
    }
    
    return commission;
  };

  // 计算佣金统计
  useEffect(() => {
    if (teamMembers.length > 0) {
      // 🔥 使用数据库中的实际 NFT 价值，而不是固定价格
      let totalPerformance = 0;
      teamMembers.forEach(member => {
        // nft_mint_amount 是数据库中保存的实际 NFT 总价值
        totalPerformance += member.nft_mint_amount || 0;
      });

      // 🔥 使用分阶段计算佣金
      const totalCommission = calculateTieredCommission(totalPerformance);
      const available = Math.max(0, totalCommission - claimedAmount);
      
      // 当前档位比例（用于显示）
      let currentRate = 0.10;
      if (totalPerformance >= 10000) currentRate = 0.20;
      else if (totalPerformance >= 2000) currentRate = 0.15;

      setCommissionStats({
        totalPerformance,
        currentRate,
        totalCommission,
        available
      });
    }
  }, [teamMembers, claimedAmount]);

  const fetchMyNFTBalance = async () => {
    if (!walletAddress) return;
    try {
      let provider;
      
      // 🔥 尝试使用 Eagle Swap 专用 RPC
      try {
        const fetchRequest = new ethers.FetchRequest(EAGLE_BSC_RPC);
        fetchRequest.setHeader('X-API-Key', EAGLE_API_KEY);
        provider = new ethers.JsonRpcProvider(fetchRequest);
        
        // 测试连接
        await provider.getBlockNumber();
        console.log('✅ 前端使用 Eagle Swap RPC');
      } catch (error) {
        console.log('⚠️ Eagle Swap RPC 失败，切换到公共 RPC');
        provider = new ethers.JsonRpcProvider(PUBLIC_BSC_RPC);
      }
      
      const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);
      setMyNFTBalance(Number(balance));
    } catch (error) {
      console.error('Check my NFT failed:', error);
    }
  };

  const fetchMemberNFTs = async () => {
    try {
      setLoadingNFTs(true);
      
      // 🔥 直接从数据库读取 NFT 数据，不查询区块链
      const balances = {};
      
      teamMembers.forEach((member) => {
        // 使用数据库中已保存的 NFT 数量
        balances[member.wallet_address] = member.nft_count || 0;
      });

      setMemberNFTs(balances);
    } catch (error) {
      console.error('读取NFT数据失败:', error);
    } finally {
      setLoadingNFTs(false);
    }
  };

  const checkUserStatus = async () => {
    if (!walletAddress) {
      setIsCheckingStatus(false);
      return;
    }
    
    try {
      setIsCheckingStatus(true);
      const response = await fetch(`/api/user/${walletAddress}`);
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      
      if (data.exists) {
        setIsBound(true);
        setTeamName(data.user.team_name);
        setClaimedAmount(data.user.claimed_amount || 0); // 获取已提现金额
        if (data.user.referrer_address) {
          console.log('✅ 数据库中的推荐人地址:', data.user.referrer_address);
          console.log('🔗 URL 参数中的推荐人地址:', searchParams.get('ref'));
          
          // 显示数据库中实际保存的推荐人地址
          setReferrerAddress(data.user.referrer_address);
          
          const leaders = JSON.parse(localStorage.getItem('teamLeaders') || '[]');
          const leader = leaders.find(l => l.address.toLowerCase() === data.user.referrer_address.toLowerCase());
          if (leader) {
            setReferrerName(leader.name);
          }
        }
        setTeamMembers(data.teamMembers || []);
        setTeammates(data.teammates || []); 
        
        // 🔥 如果用户的 NFT 数据是 null（从未扫描过），强制刷新
        if (data.user.nft_count === null || data.user.nft_count === undefined) {
          console.log('⚠️ 用户 NFT 数据为空，强制刷新...');
          autoRefreshNFTData(true); // 强制刷新
        }
        // showMessage('验证成功', 'success'); // 减少打扰
      }
    } catch (error) {
      console.error('检查用户状态失败:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleWithdraw = async () => {
    if (commissionStats.available <= 0) {
      showMessage('暂无可提现金额', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          amount: commissionStats.available
        })
      });
      const data = await res.json();
      if (data.success) {
        showMessage('申请已提交，请等待管理员审核', 'success');
        setIsWithdrawModalOpen(false);
        // 乐观更新：暂时增加已提现金额（实际应等待刷新，但为了体验先扣除）
        setClaimedAmount(prev => prev + commissionStats.available);
      } else {
        showMessage(data.message || '提交失败', 'error');
      }
    } catch (error) {
      showMessage('网络错误', 'error');
    } finally {
      setLoading(false);
    }
  };


  const copyAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedTeammate(address);
      showMessage('✅ 地址已复制到剪贴板！', 'success');
      setTimeout(() => setCopiedTeammate(''), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      showMessage('❌ 复制失败，请手动复制', 'error');
    }
  };

  const connectWallet = async () => {
    console.log('开始连接钱包...');
    console.log('window.ethereum:', window.ethereum);
    
    if (typeof window.ethereum === 'undefined') {
      alert('未检测到MetaMask！\n\n请确保：\n1. 已安装MetaMask浏览器插件\n2. MetaMask已启用\n3. 刷新页面后重试');
      showMessage('请安装MetaMask钱包', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('请求连接MetaMask...');
      
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      console.log('连接成功，账户:', accounts);
      
      const address = accounts[0];
      setWalletAddress(address);
      setIsConnected(true);
      showMessage('连接成功', 'success');
    } catch (error) {
      console.error('连接钱包失败:', error);
      
      if (error.code === 4001) {
        showMessage('连接被拒绝', 'error');
      } else if (error.code === -32002) {
        showMessage('请求处理中，请检查钱包', 'error');
      } else {
        showMessage(`连接失败: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const bindReferral = async () => {
    if (!walletAddress) {
      showMessage('请先连接钱包', 'error');
      return;
    }

    let finalTeamName = teamName;
    
    if (!referrerAddress && !selectedTeam) {
      showMessage('请选择一个接入点', 'error');
      return;
    }

    if (selectedTeam) {
      finalTeamName = selectedTeam;
    } else if (referrerName) {
      finalTeamName = referrerName;
    } else if (referrerAddress) {
      finalTeamName = `Node-${referrerAddress.substring(0, 6)}`;
    } else {
      finalTeamName = 'Default Node';
    }

    console.log('🔵 准备绑定，参数如下:');
    console.log('  - 钱包地址:', walletAddress);
    console.log('  - 推荐人地址:', referrerAddress);
    console.log('  - URL ref 参数:', searchParams.get('ref'));
    console.log('  - 团队名称:', finalTeamName);

    try {
      setLoading(true);
      const response = await fetch('/api/bind', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          referrerAddress: referrerAddress || null,
          teamName: finalTeamName,
        }),
      });

      const data = await response.json();
      console.log('Bind API response:', data);

      if (data.success) {
        setIsBound(true);
        setTeamName(data.data.teamName);
        showMessage('加入成功', 'success');
        
        // setTimeout(() => {
        //   window.location.href = 'https://eagleswap.llc/swap';
        // }, 1500);
        
        setTimeout(() => checkUserStatus(), 500);
      } else if (data.alreadyBound) {
        setIsBound(true);
        // setTeamName(data.user?.team_name || finalTeamName);
        showMessage('绑定失败：该钱包已绑定过推荐关系。每个钱包只能绑定一个社区/推荐人，不可重复或跨社区绑定。', 'error');
        // 立即刷新状态以显示正确的已绑定信息
        setTimeout(() => checkUserStatus(), 500);
      } else {
        console.error('Bind failed:', data.message);
        showMessage('加入失败，请重试', 'error');
      }
    } catch (error) {
      console.error('Bind error:', error);
      showMessage('网络错误，请重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const copyReferralLink = async () => {
    if (!walletAddress) return;
    
    try {
      const link = `${window.location.origin}?ref=${walletAddress}`;
      await navigator.clipboard.writeText(link);
      
      // 🔥 显示复制成功状态
      setIsCopied(true);
      showMessage('✅ 推荐链接已复制到剪贴板！', 'success');
      
      // 2秒后恢复按钮状态
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
      showMessage('❌ 复制失败，请手动复制', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Eagle Swap</h1>
          <p className="text-xl text-gray-600">欢迎使用 Eagle Swap</p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            {messageType === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message}</span>
          </div>
        )}

        {/* 主卡片 */}
        {isCheckingStatus && isConnected ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 mb-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">正在加载用户信息...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          
          {/* 接入点选择 - 仅在未绑定且无推荐人时显示 */}
          {!isBound && !referrerAddress && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" />
                选择接入点
              </h2>
              
              {availableTeams.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 text-center">
                  <p className="text-gray-500 mb-2">暂无可用接入点</p>
                  <p className="text-sm text-gray-400">请联系客服</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTeams.map((team) => (
                    <div 
                      key={team.id}
                      onClick={() => setSelectedTeam(team.name)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                        selectedTeam === team.name 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`font-bold ${selectedTeam === team.name ? 'text-blue-700' : 'text-gray-800'}`}>
                          {team.name}
                        </h3>
                        {selectedTeam === team.name && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{team.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/50 px-2 py-1 rounded w-fit">
                        <Users className="w-3 h-3" />
                        <span>{team.member_count || 0} 已加入</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 钱包连接 */}
          {!isBound && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Wallet className="w-6 h-6" />
                连接钱包
              </h2>
              
              {!isConnected ? (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '连接中...' : '连接钱包'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                    <p className="text-sm text-gray-600 mb-2">已连接钱包:</p>
                    <p className="font-mono text-sm text-gray-800 break-all">{walletAddress}</p>
                  </div>
                  <button
                    onClick={() => {
                      setWalletAddress('');
                      setIsConnected(false);
                      setIsBound(false);
                      setTeamName('');
                      setTeamMembers([]);
                      showMessage('已断开连接', 'success');
                    }}
                    className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-all"
                  >
                    断开连接
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 推荐人信息显示 */}
          {isConnected && !isBound && referrerAddress && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UserPlus className="w-6 h-6" />
                您的推荐人
              </h2>
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                {referrerName && (
                  <p className="text-sm text-gray-600 mb-2 font-semibold">{referrerName}</p>
                )}
                <p className="text-xs text-gray-500 mb-1">推荐人钱包地址:</p>
                <p className="font-mono text-sm text-gray-800 break-all bg-white px-3 py-2 rounded-lg border border-blue-100">
                  {referrerAddress}
                </p>
              </div>
            </div>
          )}

          {/* 绑定按钮 */}
          {isConnected && !isBound && (
            <div className="mb-8">
              <button
                onClick={bindReferral}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '处理中...' : '确认加入'}
              </button>
            </div>
          )}

          {/* 已绑定 - 显示推荐详情 */}
          {isBound && (
            <div className="space-y-8">
              <div className="text-center p-6 bg-green-50 rounded-2xl border border-green-100">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">已成功绑定</h2>
                <p className="text-gray-600">您已成为 Eagle Swap 社区的一员</p>
              </div>

              {/* 佣金看板 */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white mb-6 shadow-lg">
                
                {myNFTBalance === 0 && (
                  <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-2 text-sm font-bold shadow-sm backdrop-blur-sm border border-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>您当前未持有 NFT，无法领取直推奖励。请先购买 NFT 激活权益。</span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Coins className="w-6 h-6" /> 直推佣金统计
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const res = await fetch('/api/user/refresh-nft', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ walletAddress, force: true }) // 强制刷新
                          });
                          const data = await res.json();
                          if (data.success) {
                            if (data.data.skipped) {
                              showMessage('数据已是最新', 'success');
                            } else {
                              showMessage(`NFT 数据已刷新: ${data.data.nftCount} 个 NFT`, 'success');
                            }
                            // 重新加载用户状态
                            await checkUserStatus();
                            await fetchMyNFTBalance();
                          } else {
                            showMessage('刷新失败: ' + data.message, 'error');
                          }
                        } catch (error) {
                          showMessage('刷新失败', 'error');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm transition-colors disabled:opacity-50"
                      title="刷新我的 NFT 数据"
                    >
                      🔄 刷新
                    </button>
                    <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                      当前奖励比例: {(commissionStats.currentRate * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-white/70 text-sm mb-1">直推总业绩 (USDT)</p>
                    <p className="text-2xl font-bold">{commissionStats.totalPerformance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">预计佣金 (USDT)</p>
                    <p className="text-2xl font-bold">{commissionStats.totalCommission.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">已提现 (USDT)</p>
                    <p className="text-2xl font-bold">{claimedAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">可提现 (USDT)</p>
                    <p className={`text-2xl font-bold ${myNFTBalance > 0 ? 'text-yellow-300' : 'text-gray-300'}`}>
                      {commissionStats.available.toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  disabled={commissionStats.available <= 0 || myNFTBalance === 0}
                  className="w-full bg-white text-indigo-600 py-3 rounded-lg font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {myNFTBalance === 0 ? '需持有 NFT 才能提现' : '申请提现'}
                </button>
              </div>

              {/* 🔥 佣金等级进度条 */}
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📊</span> 佣金等级进度
                </h3>
                
                {(() => {
                  const performance = commissionStats.totalPerformance;
                  let currentTier, nextTier, progress, remaining;
                  
                  if (performance < 2000) {
                    currentTier = { name: '初级', rate: '10%', color: 'bg-blue-500' };
                    nextTier = { name: '中级', rate: '15%', threshold: 2000 };
                    progress = (performance / 2000) * 100;
                    remaining = 2000 - performance;
                  } else if (performance < 10000) {
                    currentTier = { name: '中级', rate: '15%', color: 'bg-purple-500' };
                    nextTier = { name: '高级', rate: '20%', threshold: 10000 };
                    progress = ((performance - 2000) / 8000) * 100;
                    remaining = 10000 - performance;
                  } else {
                    currentTier = { name: '高级', rate: '20%', color: 'bg-yellow-500' };
                    nextTier = null;
                    progress = 100;
                    remaining = 0;
                  }
                  
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${currentTier.color}`}>
                            {currentTier.name} {currentTier.rate}
                          </span>
                          {nextTier && (
                            <>
                              <span className="text-gray-400">→</span>
                              <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-sm font-bold">
                                {nextTier.name} {nextTier.rate}
                              </span>
                            </>
                          )}
                        </div>
                        {nextTier && (
                          <span className="text-sm text-gray-600 font-medium">
                            还需 {remaining.toLocaleString()} USDT
                          </span>
                        )}
                      </div>
                      
                      <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${currentTier.color} transition-all duration-500 flex items-center justify-end pr-2`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        >
                          {progress > 10 && (
                            <span className="text-white text-xs font-bold">
                              {progress.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {nextTier ? (
                        <p className="text-xs text-gray-500 mt-2">
                          当前业绩: {performance.toLocaleString()} USDT / {nextTier.threshold.toLocaleString()} USDT
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 mt-2 font-bold">
                          🎉 恭喜！您已达到最高等级！
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 提现确认弹窗 */}
              {isWithdrawModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl w-full max-w-md p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">确认提现</h3>
                    <p className="text-gray-600 mb-6">
                      您当前可提现金额为 <span className="font-bold text-indigo-600">{commissionStats.available} USDT</span>。
                      提交申请后，管理员将进行人工审核。
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsWithdrawModalOpen(false)}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleWithdraw}
                        disabled={loading}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {loading ? '提交中...' : '确认提交'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 推荐人信息 */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-6 h-6 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-800">您的推荐人</h3>
                  </div>
                  {referrerAddress ? (
                    <div>
                      {referrerName && (
                        <div className="mb-2 text-sm font-semibold text-gray-700">
                          {referrerName}
                        </div>
                      )}
                      <div className="p-3 bg-gray-50 rounded-lg break-all font-mono text-xs text-gray-600">
                        {referrerAddress}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
                      无推荐人
                    </div>
                  )}
                </div>

                {/* 推荐统计 */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-800">您的推荐</h3>
                  </div>
                  <div className="text-3xl font-bold text-gray-800">
                    {teamMembers.length} <span className="text-base font-normal text-gray-500">人</span>
                  </div>
                  
                  {/* 推荐列表 */}
                  {teamMembers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500 mb-2 font-medium">推荐名单:</p>
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {teamMembers.map((member, index) => (
                          <div key={member.id || index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg text-xs hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
                            <div className="flex flex-col gap-1">
                              <a 
                                href={`https://bscscan.com/token/${NFT_CONTRACT_ADDRESS}?a=${member.wallet_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium"
                                title="在 BSCScan 查看 NFT 持有情况"
                              >
                                {member.wallet_address.substring(0, 8)}...{member.wallet_address.substring(member.wallet_address.length - 6)}
                                <LinkIcon className="w-3 h-3" />
                              </a>
                              <span className="text-gray-400 text-[10px]">
                                加入: {new Date(member.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                {loadingNFTs ? (
                                  <span className="text-gray-400 flex items-center gap-1 scale-90">
                                    <Loader2 className="w-3 h-3 animate-spin" /> 查询中
                                  </span>
                                ) : (
                                  // 🔥 区分旧 NFT 和新购买的 NFT
                                  (member.nft_mint_amount > 0) ? (
                                    // 有新购买记录 - 显示数量
                                    <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200 shadow-sm">
                                        <Coins className="w-3 h-3" />
                                        <span className="font-bold">持有: {Math.round(member.nft_mint_amount / 10)}</span>
                                      </div>
                                    </div>
                                  ) : (memberNFTs[member.wallet_address] > 0) ? (
                                    // 只有旧 NFT（余额 > 0 但没有新购买记录）- 只显示"持有NFT"
                                    <div className="flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 shadow-sm">
                                      <Coins className="w-3 h-3" />
                                      <span className="font-bold text-[10px]">持有NFT</span>
                                    </div>
                                  ) : (
                                    // 没有 NFT
                                    <span className="text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full text-[10px]">未持有NFT</span>
                                  )
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 您的钱包 */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <Wallet className="w-6 h-6 text-purple-500" />
                  <h3 className="text-lg font-semibold text-gray-800">您的钱包地址</h3>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg">
                  <code className="text-sm text-gray-600 break-all font-mono">{walletAddress}</code>
                  <button 
                    onClick={() => copyAddress(walletAddress)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 推广链接 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <LinkIcon className="w-6 h-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">您的专属推广链接</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${walletAddress}`}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={copyReferralLink}
                    disabled={isCopied}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md whitespace-nowrap flex items-center gap-2 ${
                      isCopied 
                        ? 'bg-green-500 text-white scale-105' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        已复制！
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        复制链接
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 购买 NFT 链接 */}
              <div className="text-center pt-4">
                <a
                  href="https://eagleswap.llc/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  前往购买 NFT
                  <LinkIcon className="w-5 h-5" />
                </a>
              </div>

              {/* 🔥 推荐人排行榜 */}
              {referrerRanking.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border-2 border-yellow-200 shadow-lg mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🏆</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">推荐人排行榜</h3>
                        <p className="text-sm text-gray-600">直推业绩排名 · 实时更新</p>
                      </div>
                    </div>
                    {referrerRanking.length > 3 && (
                      <button
                        onClick={() => setShowAllReferrers(!showAllReferrers)}
                        className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-lg font-bold text-sm transition-colors"
                      >
                        {showAllReferrers ? '收起' : `查看全部 (${referrerRanking.length})`}
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {(showAllReferrers ? referrerRanking : referrerRanking.slice(0, 3)).map((referrer, index) => {
                      const isTop3 = index < 3;
                      const medals = ['🥇', '🥈', '🥉'];
                      
                      return (
                        <div 
                          key={referrer.wallet_address}
                          className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                            isTop3 
                              ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 shadow-md' 
                              : 'bg-white border border-gray-200 hover:border-yellow-300'
                          }`}
                        >
                          <div className="flex-shrink-0 w-12 text-center">
                            {isTop3 ? (
                              <span className="text-3xl">{medals[index]}</span>
                            ) : (
                              <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-800 truncate">
                                {referrer.team_name || '未命名团队'}
                              </span>
                              {isTop3 && (
                                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                                  TOP {index + 1}
                                </span>
                              )}
                            </div>
                            <code className="text-xs text-gray-500 font-mono">
                              {referrer.wallet_address.substring(0, 10)}...{referrer.wallet_address.substring(38)}
                            </code>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-orange-600">
                              {referrer.total_performance.toLocaleString()} USDT
                            </div>
                            <div className="text-xs text-gray-500">
                              {referrer.referral_count} 人 · {referrer.total_nft_count} NFT
                            </div>
                            <div className="text-xs text-green-600 font-bold mt-1">
                              预计佣金: {referrer.estimated_commission.toFixed(2)} USDT
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-yellow-200">
                    <p className="text-xs text-gray-600 text-center">
                      💡 推荐更多用户购买 NFT，冲击排行榜前三名，赢取额外奖励！
                    </p>
                  </div>
                </div>
              )}

              {/* 推荐规则说明 */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-800">推荐规则说明</h3>
                </div>
                <div className="space-y-4 text-sm text-gray-700">
                  <div className="flex gap-3">
                    <span className="font-bold text-red-600 min-w-[20px]">1.</span>
                    <p className="font-bold text-red-600">推荐人地址必须持有NFT 才能获取奖励。 任何等级NFT 。</p>
                  </div>

                  <div className="flex gap-3">
                    <span className="font-bold text-blue-600 min-w-[20px]">2.</span>
                    <p><span className="font-bold">基础奖励：</span>通过您推荐的地址购买 NFT，您将获得购买金额对应的返还（详见阶梯奖励）。</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold text-blue-600 min-w-[20px]">3.</span>
                    <p><span className="font-bold">唯一性限制：</span>每个 Token ID 对应的奖励只能领取一次，不可重复。</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold text-blue-600 min-w-[20px]">4.</span>
                    <p><span className="font-bold">领取方式：</span>请加入 QQ 群：<span className="select-all font-mono bg-white px-1 rounded border">203765559</span> 或联系电报：<a href="https://t.me/EagleSwapLLC" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://t.me/EagleSwapLLC</a>，发送您的钱包地址。我们会核实后为您发放对应等级的奖励。</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold text-blue-600 min-w-[20px]">5.</span>
                    <div>
                      <p className="mb-1"><span className="font-bold">阶梯奖励机制：</span>根据累计销售业绩计算奖励比例：</p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-600 text-xs">
                        <li>业绩 <span className="font-bold text-orange-600">2000 USDT 以内</span>：享受 <span className="font-bold text-orange-600">10%</span> 奖励。</li>
                        <li>业绩 <span className="font-bold text-blue-600">2000 - 10000 USDT</span>：享受 <span className="font-bold text-blue-600">15%</span> 奖励。</li>
                        <li>业绩 <span className="font-bold text-green-600">10000 USDT 以上</span>：享受 <span className="font-bold text-green-600">20%</span> 奖励。</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold text-blue-600 min-w-[20px]">6.</span>
                    <div>
                      <p className="mb-1"><span className="font-bold">反作弊机制：</span></p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-600 text-xs">
                        <li>对应 Token ID 只能结算一次。</li>
                        <li>若购买后 NFT 被转移，以 <span className="font-bold text-red-500">第一次购买 NFT 的地址</span> 为准进行推荐关系结算，防止作弊和混乱。</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
