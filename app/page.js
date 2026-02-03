'use client';

import { useState, useEffect } from 'react';
import { Wallet, Users, CheckCircle, AlertCircle, Link as LinkIcon, Shield } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState('');
  const [referrerAddress, setReferrerAddress] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isBound, setIsBound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');

  // 预设团队列表
  const defaultTeams = [
    { id: 'eagle', name: 'Eagle Team', description: '雄鹰战队 - 展翅高飞' },
    { id: 'tiger', name: 'Tiger Team', description: '猛虎战队 - 勇往直前' },
    { id: 'lion', name: 'Lion Team', description: '雄狮战队 - 王者归来' },
    { id: 'wolf', name: 'Wolf Team', description: '战狼战队 - 团结必胜' }
  ];

  // 从URL获取推荐人地址
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setReferrerAddress(ref);
      // 从本地存储获取团队长名称
      const leaders = JSON.parse(localStorage.getItem('teamLeaders') || '[]');
      const leader = leaders.find(l => l.address.toLowerCase() === ref.toLowerCase());
      if (leader) {
        setReferrerName(leader.name);
      }
    }
  }, []);

  // 页面加载时检查钱包连接状态
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          // 检查是否已经连接
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

  // 监听钱包账户变化
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      // 监听账户切换
      const handleAccountsChanged = (accounts) => {
        console.log('账户已切换:', accounts);
        if (accounts.length === 0) {
          // 用户断开连接
          setWalletAddress('');
          setIsConnected(false);
          setIsBound(false);
          setTeamName('');
          setTeamMembers([]);
          showMessage('钱包已断开连接', 'error');
        } else {
          // 切换到新账户
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

      // 监听链切换
      const handleChainChanged = () => {
        console.log('链已切换，刷新页面');
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // 清理函数
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  // 检查用户是否已绑定
  useEffect(() => {
    if (walletAddress) {
      checkUserStatus();
    }
  }, [walletAddress]);

  const checkUserStatus = async () => {
    try {
      const response = await fetch(`/api/user/${walletAddress}`);
      const data = await response.json();
      
      if (data.exists) {
        setIsBound(true);
        setTeamName(data.user.team_name);
        if (data.user.referrer_address) {
          setReferrerAddress(data.user.referrer_address);
          // 从localStorage获取团队长名称
          const leaders = JSON.parse(localStorage.getItem('teamLeaders') || '[]');
          const leader = leaders.find(l => l.address.toLowerCase() === data.user.referrer_address.toLowerCase());
          if (leader) {
            setReferrerName(leader.name);
          }
        }
        setTeamMembers(data.teamMembers || []);
        showMessage('该钱包地址已绑定，无法重复绑定', 'success');
      }
    } catch (error) {
      console.error('检查用户状态失败:', error);
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
      showMessage('钱包连接成功', 'success');
    } catch (error) {
      console.error('连接钱包失败:', error);
      
      if (error.code === 4001) {
        showMessage('您拒绝了连接请求', 'error');
      } else if (error.code === -32002) {
        showMessage('MetaMask已有待处理的连接请求，请检查MetaMask弹窗', 'error');
      } else {
        showMessage(`连接钱包失败: ${error.message}`, 'error');
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

    // 确定团队名称
    let finalTeamName = teamName;
    
    // 如果有推荐人，优先使用推荐人的团队（逻辑上通常跟随推荐人）
    // 或者如果没有推荐人，必须选择一个团队
    if (!referrerAddress && !selectedTeam) {
      showMessage('请先选择一个团队加入', 'error');
      return;
    }

    if (selectedTeam) {
      finalTeamName = selectedTeam;
    } else if (referrerName) {
      finalTeamName = referrerName;
    } else if (referrerAddress) {
      finalTeamName = `团队-${referrerAddress.substring(0, 6)}`;
    } else {
      finalTeamName = '默认团队';
    }

    console.log('绑定参数:', {
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
      console.log('绑定API响应:', data);

      if (data.success) {
        console.log('绑定成功！团队:', data.data.teamName);
        setIsBound(true);
        setTeamName(data.data.teamName);
        showMessage('绑定成功！', 'success');
        // 重新获取用户信息
        setTimeout(() => checkUserStatus(), 500);
      } else if (data.alreadyBound) {
        console.log('钱包已绑定');
        setIsBound(true);
        setTeamName(data.user?.team_name || finalTeamName); // 尝试使用返回的已有团队名
        showMessage('该钱包已经绑定过了', 'error');
      } else {
        console.error('绑定失败:', data.message);
        showMessage(data.message || '绑定失败', 'error');
      }
    } catch (error) {
      console.error('绑定失败:', error);
      showMessage('绑定失败，请重试', 'error');
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
    showMessage('推荐链接已复制', 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">推荐系统</h1>
          <p className="text-xl text-gray-600">连接钱包，加入团队</p>
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
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          {/* 推荐人信息 */}
          {referrerAddress && !isBound && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {referrerName || '团队邀请'}
                  </h2>
                  <p className="text-sm text-blue-600">您收到了团队邀请</p>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg mb-3">
                <p className="text-xs text-gray-500 mb-1">团队长钱包地址:</p>
                <p className="text-gray-800 font-mono text-sm break-all">
                  {referrerAddress}
                </p>
              </div>
              
              <div className="flex items-start gap-2 bg-blue-100 p-3 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  连接钱包并确认后，您将加入 <span className="font-bold text-blue-700">{referrerName || `团队-${referrerAddress.substring(0, 8)}`}</span>
                </p>
              </div>
            </div>
          )}

          {/* 团队选择 - 仅在未绑定且无推荐人时显示 */}
          {!isBound && !referrerAddress && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" />
                选择团队
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {defaultTeams.map((team) => (
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
                    <p className="text-sm text-gray-600">{team.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 钱包连接 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              钱包连接
            </h2>
            
            {!isConnected ? (
              <button
                onClick={connectWallet}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '连接中...' : '连接MetaMask钱包'}
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
                    showMessage('已断开钱包连接', 'success');
                  }}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-all"
                >
                  断开连接
                </button>
              </div>
            )}
          </div>

          {/* 绑定按钮 */}
          {isConnected && !isBound && (
            <div className="mb-8">
              <button
                onClick={bindReferral}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '绑定中...' : '确认绑定'}
              </button>
            </div>
          )}

          {/* 已绑定信息 */}
          {isBound && (
            <div className="mb-8">
              {/* 已绑定警告 */}
              <div className="mb-4 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-300">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-yellow-800">该钱包地址已绑定</p>
                    <p className="text-sm text-yellow-700">每个钱包地址只能绑定一次，无法重复绑定或更改团队</p>
                  </div>
                </div>
              </div>
              
              {/* 绑定详情 */}
              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-300">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-semibold text-gray-800">绑定信息</h3>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">所属团队</p>
                    <p className="text-lg font-bold text-gray-800">{teamName}</p>
                  </div>
                  {referrerAddress && (
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">推荐人</p>
                      {referrerName && (
                        <p className="text-lg font-bold text-gray-800 mb-1">{referrerName}</p>
                      )}
                      <p className="font-mono text-sm text-gray-600 break-all">{referrerAddress}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 推荐链接 */}
          {isBound && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300">
              <p className="text-sm text-gray-700 font-semibold mb-3">分享您的推荐链接:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${walletAddress}`}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono"
                />
                <button
                  onClick={copyReferralLink}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  复制
                </button>
              </div>
            </div>
          )}

          {/* 团队成员 */}
          {teamMembers.length > 0 && (
            <div className="mt-8 p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                我的团队成员 ({teamMembers.length})
              </h3>
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <div key={index} className="p-3 bg-white rounded-lg border border-purple-100">
                    <p className="font-mono text-sm text-gray-700">{member.wallet_address}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      加入时间: {new Date(member.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部导航 */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-lg"
          >
            <Shield className="w-5 h-5" />
            后台管理
          </Link>
          <Link
            href="/stats"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-gray-800 rounded-xl font-semibold hover:shadow-lg transition-all border-2 border-gray-200"
          >
            <Users className="w-5 h-5" />
            查看统计数据
          </Link>
        </div>
      </div>
    </div>
  );
}
