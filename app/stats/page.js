'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, Link as LinkIcon, ArrowLeft, RefreshCw, Trophy, Award, Medal, Copy, Download, CheckCircle2, Eye } from 'lucide-react';
import Link from 'next/link';

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedAddress, setCopiedAddress] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/stats');
      
      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError('无法加载统计数据，请确保后端服务器正在运行');
    } finally {
      setLoading(false);
    }
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

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Award className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-orange-600" />;
    return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-orange-400 to-orange-600';
    return 'from-blue-400 to-blue-600';
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(''), 2000);
  };

  const exportToCSV = () => {
    if (!stats?.referrerRanking || stats.referrerRanking.length === 0) return;

    const teamLeaders = typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem('teamLeaders') || '[]')
      : [];

    // CSV 标题
    const headers = ['排名', '团队名称', '钱包地址', '推荐人数', '首次推荐时间'];
    
    // CSV 数据行
    const rows = stats.referrerRanking.map((referrer, index) => {
      const leader = teamLeaders.find(l => l.address.toLowerCase() === referrer.referrer_address.toLowerCase());
      return [
        index + 1,
        leader ? leader.name : '未命名',
        referrer.referrer_address,
        referrer.referral_count,
        formatDate(referrer.first_referral_time)
      ];
    });

    // 组合CSV内容
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `推荐人排名_${new Date().toLocaleDateString('zh-CN')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-700">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">加载失败</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchStats}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">统计数据</h1>
            <p className="text-gray-600">实时查看推荐系统数据</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchStats}
              className="px-6 py-3 bg-white text-gray-800 rounded-xl font-semibold hover:shadow-lg transition-all border-2 border-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              刷新
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              返回首页
            </Link>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* 总用户数 */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">{stats?.totalUsers || 0}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">总用户数</h3>
            <p className="text-sm text-gray-500 mt-1">所有注册用户</p>
          </div>

          {/* 有推荐人的用户 */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">{stats?.usersWithReferrer || 0}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">推荐用户数</h3>
            <p className="text-sm text-gray-500 mt-1">通过推荐加入</p>
          </div>

          {/* 团队数量 */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-gray-800">{stats?.teams?.length || 0}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">团队数量</h3>
            <p className="text-sm text-gray-500 mt-1">不同的团队</p>
          </div>
        </div>

        {/* 推荐人排名 */}
        {stats?.referrerRanking && stats.referrerRanking.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                推荐人排名榜
              </h2>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                导出表格
              </button>
            </div>
            
            {/* 排名说明 */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <strong>排名规则：</strong>按推荐人数降序排列，推荐人数相同时按首次推荐时间排序。点击钱包地址可复制，方便分配奖励。
              </p>
            </div>

            <div className="space-y-4">
              {stats.referrerRanking.map((referrer, index) => {
                const rank = index + 1;
                const teamLeaders = typeof window !== 'undefined' 
                  ? JSON.parse(localStorage.getItem('teamLeaders') || '[]')
                  : [];
                const leader = teamLeaders.find(l => l.address.toLowerCase() === referrer.referrer_address.toLowerCase());
                
                return (
                  <div 
                    key={index} 
                    className={`p-6 rounded-xl border-2 transition-all hover:shadow-xl ${
                      rank === 1 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-lg' :
                      rank === 2 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 shadow-md' :
                      rank === 3 ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 shadow-md' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* 主要信息行 */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* 排名徽章 */}
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRankBadgeColor(rank)} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        {rank <= 3 ? (
                          getRankIcon(rank)
                        ) : (
                          <span className="text-white font-bold text-xl">#{rank}</span>
                        )}
                      </div>
                      
                      {/* 推荐人详细信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {leader && (
                            <h3 className="text-xl font-bold text-gray-800">{leader.name}</h3>
                          )}
                          {rank <= 3 && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              rank === 1 ? 'bg-yellow-200 text-yellow-800' :
                              rank === 2 ? 'bg-gray-300 text-gray-800' :
                              'bg-orange-200 text-orange-800'
                            }`}>
                              {rank === 1 ? '🥇 冠军' : rank === 2 ? '🥈 亚军' : '🥉 季军'}
                            </span>
                          )}
                        </div>
                        
                        {/* 钱包地址 - 可复制 */}
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-mono text-sm text-gray-700 break-all flex-1">
                            {referrer.referrer_address}
                          </p>
                          <button
                            onClick={() => copyToClipboard(referrer.referrer_address, leader?.name)}
                            className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                              copiedAddress === referrer.referrer_address
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                            title="复制钱包地址"
                          >
                            {copiedAddress === referrer.referrer_address ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        
                        {/* 时间信息 */}
                        <p className="text-xs text-gray-500">
                          首次推荐时间: {formatDate(referrer.first_referral_time)}
                        </p>
                      </div>
                      
                      {/* 推荐数量统计 */}
                      <div className="text-center flex-shrink-0">
                        <div className={`inline-flex flex-col items-center gap-1 px-6 py-3 rounded-xl shadow-md ${
                          rank === 1 ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 border-2 border-yellow-400' :
                          rank === 2 ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-400' :
                          rank === 3 ? 'bg-gradient-to-br from-orange-100 to-orange-200 border-2 border-orange-400' :
                          'bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-400'
                        }`}>
                          <Users className={`w-6 h-6 ${
                            rank === 1 ? 'text-yellow-700' :
                            rank === 2 ? 'text-gray-700' :
                            rank === 3 ? 'text-orange-700' :
                            'text-blue-700'
                          }`} />
                          <span className={`text-3xl font-bold ${
                            rank === 1 ? 'text-yellow-800' :
                            rank === 2 ? 'text-gray-800' :
                            rank === 3 ? 'text-orange-800' :
                            'text-blue-800'
                          }`}>
                            {referrer.referral_count}
                          </span>
                          <p className="text-xs text-gray-600 font-semibold">推荐人数</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 奖励建议 */}
                    {rank <= 3 && (
                      <div className={`mt-4 p-3 rounded-lg border ${
                        rank === 1 ? 'bg-yellow-50 border-yellow-200' :
                        rank === 2 ? 'bg-gray-50 border-gray-200' :
                        'bg-orange-50 border-orange-200'
                      }`}>
                        <p className="text-sm font-semibold text-gray-700">
                          💰 建议奖励: 
                          <span className={`ml-2 ${
                            rank === 1 ? 'text-yellow-700' :
                            rank === 2 ? 'text-gray-700' :
                            'text-orange-700'
                          }`}>
                            {rank === 1 ? '特等奖' : rank === 2 ? '一等奖' : '二等奖'}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 团队列表 */}
        {stats?.teams && stats.teams.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6" />
              团队分布
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.teams.map((team, index) => (
                <div key={index} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <h3 className="font-semibold text-gray-800 mb-2">{team.team_name}</h3>
                  <p className="text-2xl font-bold text-blue-600">{team.member_count} 人</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 用户列表 */}
        {stats?.allUsers && stats.allUsers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6" />
              所有用户 ({stats.allUsers.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">序号</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">钱包地址</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">推荐人</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">团队</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">加入时间</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.allUsers.map((user, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-600">{index + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-gray-800" title={user.wallet_address}>
                          {formatAddress(user.wallet_address)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {user.referrer_address ? (
                          <span className="font-mono text-sm text-gray-600" title={user.referrer_address}>
                            {formatAddress(user.referrer_address)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">无</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {user.team_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {stats?.allUsers && stats.allUsers.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无用户数据</h3>
            <p className="text-gray-500">还没有用户加入系统</p>
          </div>
        )}
      </div>
    </div>
  );
}
