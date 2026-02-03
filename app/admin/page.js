'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Copy, Link as LinkIcon, Users, Trash2, CheckCircle, Mail, Lock, LogOut } from 'lucide-react';
import Link from 'next/link';

// 管理员邮箱列表（实际项目中应该存储在后端数据库）
const ADMIN_EMAILS = [
  'admin@example.com',
  'manager@example.com'
];

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [newLeaderAddress, setNewLeaderAddress] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState(''); // 新增描述字段
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    // 检查登录状态
    const savedEmail = localStorage.getItem('adminEmail');
    if (savedEmail) {
      setIsLoggedIn(true);
      setAdminEmail(savedEmail);
      fetchTeams();
    }
  }, []);

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

  const handleLogin = (e) => {
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

    // 简单验证（实际项目中应该调用后端API验证）
    if (ADMIN_EMAILS.includes(email) && password === 'admin123') {
      localStorage.setItem('adminEmail', email);
      setIsLoggedIn(true);
      setAdminEmail(email);
      showMessage('登录成功', 'success');
      loadTeamLeaders();
    } else {
      showMessage('邮箱或密码错误', 'error');
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
                  placeholder="admin@example.com"
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
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
              >
                登录
              </button>
            </form>

            {/* 提示信息 */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 text-center">
                <strong>测试账号:</strong><br />
                邮箱: admin@example.com<br />
                密码: admin123
              </p>
            </div>
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
                      <p className="text-xs text-gray-500">
                        创建时间: {new Date(leader.created_at).toLocaleString('zh-CN')}
                      </p>
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
