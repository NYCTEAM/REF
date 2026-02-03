const express = require('express');
const cors = require('cors');
const { bindReferral, getUserInfo, getStats, getTeamMembers } = require('./database');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 绑定推荐关系
app.post('/api/bind', (req, res) => {
  const { walletAddress, referrerAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: '钱包地址不能为空' });
  }

  // 验证地址格式 (简单验证)
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: '无效的钱包地址格式' });
  }

  if (referrerAddress && !/^0x[a-fA-F0-9]{40}$/.test(referrerAddress)) {
    return res.status(400).json({ error: '无效的推荐人地址格式' });
  }

  // 防止自己推荐自己
  if (referrerAddress && walletAddress.toLowerCase() === referrerAddress.toLowerCase()) {
    return res.status(400).json({ error: '不能推荐自己' });
  }

  bindReferral(walletAddress, referrerAddress || null, (err, result) => {
    if (err) {
      console.error('绑定错误:', err);
      return res.status(500).json({ error: '绑定失败' });
    }

    if (!result.success) {
      return res.json({ 
        success: false, 
        message: '该钱包地址已经绑定过了',
        alreadyBound: true
      });
    }

    res.json({
      success: true,
      message: '绑定成功',
      data: result
    });
  });
});

// 获取用户信息
app.get('/api/user/:address', (req, res) => {
  const { address } = req.params;

  getUserInfo(address, (err, user) => {
    if (err) {
      console.error('查询错误:', err);
      return res.status(500).json({ error: '查询失败' });
    }

    if (!user) {
      return res.json({ exists: false });
    }

    // 获取团队成员
    getTeamMembers(address, (err, members) => {
      if (err) {
        console.error('查询团队成员错误:', err);
        members = [];
      }

      res.json({
        exists: true,
        user,
        teamMembers: members
      });
    });
  });
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
  getStats((err, stats) => {
    if (err) {
      console.error('统计错误:', err);
      return res.status(500).json({ error: '获取统计数据失败' });
    }

    res.json(stats);
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 API端点:`);
  console.log(`   - POST /api/bind - 绑定推荐关系`);
  console.log(`   - GET /api/user/:address - 获取用户信息`);
  console.log(`   - GET /api/stats - 获取统计数据`);
});
