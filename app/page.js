'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wallet, Users, CheckCircle, AlertCircle, Link as LinkIcon, Shield, Copy, Info, Loader2, Coins } from 'lucide-react';
import Link from 'next/link';
import { ethers } from 'ethers';

const NFT_CONTRACT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
const NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const CUSTOM_RPC = 'https://bsc.eagleswap.llc/';
const NFT_PRICE = 100; // 假设每个 NFT 价值 100 USDT (用于计算业绩)

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
          setIsBound(false);
          setTeamName('');
          setTeamMembers([]);
          showMessage('已切换到新钱包', 'success');
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
    }
  }, [walletAddress]);

  useEffect(() => {
    if (teamMembers.length > 0) {
      fetchMemberNFTs();
    }
  }, [teamMembers]);

  // 计算佣金统计
  useEffect(() => {
    if (Object.keys(memberNFTs).length > 0) {
      let totalHoldings = 0;
      Object.values(memberNFTs).forEach(bal => {
        if (bal > 0) totalHoldings += bal;
      });

      const totalPerformance = totalHoldings * NFT_PRICE;
      let rate = 0.10;
      if (totalPerformance >= 10000) rate = 0.20;
      else if (totalPerformance >= 2000) rate = 0.15;

      const totalCommission = totalPerformance * rate;
      const available = Math.max(0, totalCommission - claimedAmount);

      setCommissionStats({
        totalPerformance,
        currentRate: rate,
        totalCommission,
        available
      });
    }
  }, [memberNFTs, claimedAmount]);

  const fetchMyNFTBalance = async () => {
    if (!walletAddress) return;
    try {
      const provider = new ethers.JsonRpcProvider(CUSTOM_RPC);
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
      // 使用自定义 RPC 连接
      const provider = new ethers.JsonRpcProvider(CUSTOM_RPC);
      
      // Transfer 事件 Topic
      const transferTopic = ethers.id("Transfer(address,address,uint256)");
      const zeroAddressTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32);

      const balances = {};
      
      // 并行查询所有成员的 MINT 记录
      await Promise.all(teamMembers.map(async (member) => {
        try {
          // 构造过滤器：From = 0x00...00 (Mint), To = Member Address
          const userTopic = ethers.zeroPadValue(member.wallet_address, 32);
          const filter = {
            address: NFT_CONTRACT_ADDRESS,
            topics: [
              transferTopic,
              zeroAddressTopic, // From: 0x0
              userTopic         // To: User
            ],
            fromBlock: 0, 
            toBlock: 'latest'
          };

          // 获取日志数量作为 MINT 数量
          const logs = await provider.getLogs(filter);
          const count = logs.length;
          balances[member.wallet_address] = count;

          // 同步到数据库
          // 注意：这会让当前浏览者的浏览器发起大量请求，生产环境建议用队列或防抖
          // 但为了满足 "保存到数据库" 的需求，我们直接调用
          if (count >= 0) {
            const mintAmount = count * NFT_PRICE;
            fetch('/api/user/sync-nft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: member.wallet_address,
                nftCount: count,
                mintAmount: mintAmount
              })
            }).catch(e => console.error('Sync error:', e));
          }
        } catch (err) {
          console.error(`查询 ${member.wallet_address} Mint记录失败:`, err);
          balances[member.wallet_address] = -1; 
        }
      }));

      setMemberNFTs(balances);
    } catch (error) {
      console.error('批量查询NFT记录失败:', error);
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
          setReferrerAddress(data.user.referrer_address);
          const leaders = JSON.parse(localStorage.getItem('teamLeaders') || '[]');
          const leader = leaders.find(l => l.address.toLowerCase() === data.user.referrer_address.toLowerCase());
          if (leader) {
            setReferrerName(leader.name);
          }
        }
        setTeamMembers(data.teamMembers || []);
        setTeammates(data.teammates || []); 
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


  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopiedTeammate(address);
    setTimeout(() => setCopiedTeammate(''), 2000);
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

    console.log('Bind params:', {
      walletAddress,
      referrerAddress,
      teamName: finalTeamName
    });

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

  const copyReferralLink = () => {
    if (!walletAddress) return;
    const link = `${window.location.origin}?ref=${walletAddress}`;
    navigator.clipboard.writeText(link);
    showMessage('链接已复制', 'success');
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
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                    当前奖励比例: {(commissionStats.currentRate * 100).toFixed(0)}%
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
                  <div className="p-3 bg-gray-50 rounded-lg break-all font-mono text-sm text-gray-600">
                    {referrerName || referrerAddress || '无推荐人'}
                  </div>
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
                                href={`https://etherscan.io/address/${member.wallet_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium"
                                title="在浏览器查看"
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
                                  (memberNFTs[member.wallet_address] > 0) ? (
                                     <div className="flex flex-col items-end">
                                       <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200 shadow-sm">
                                          <Coins className="w-3 h-3" />
                                          <span className="font-bold">持有: {memberNFTs[member.wallet_address]}</span>
                                       </div>
                                     </div>
                                  ) : (
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
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md whitespace-nowrap"
                  >
                    复制链接
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
