# Coolify 部署指南

## 🚀 快速部署

### 1. 在Coolify中创建新应用

1. **登录Coolify控制台**
2. **点击 "New Resource"**
3. **选择 "Application"**
4. **选择 "Public Repository"**

### 2. 配置Git仓库

```
Repository URL: https://github.com/NYCTEAM/REF
Branch: main
```

### 3. 构建配置

根据您的截图，配置如下：

#### General（通用设置）
- **Name**: `practice-main-nycteam-ref-jx04wkc5z0j88kgc540wgc90`（自动生成）
- **Build Pack**: `Nixpacks`（推荐）或 `Dockerfile`
- **Is it a static site?**: ❌ 否

#### Domains（域名）
- **Domains**: `https://gotlaweb3.com`
- **Directive**: `Allow www & non-www`

#### Build（构建设置）
- **Install Command**: 留空（使用默认）
- **Build Command**: 留空（使用默认 `npm run build`）
- **Start Command**: 留空（使用默认 `npm start`）
- **Base Directory**: `/`（根目录）
- **Publish Directory**: `/`

#### Network（网络设置）
- **Ports Exposes**: `3000`
- **Port Mappings**: 留空（自动映射）
- **Network Aliases**: 留空

### 4. 环境变量（可选）

如果需要，可以添加：
```
NODE_ENV=production
PORT=3000
```

### 5. 部署

点击 **"Deploy"** 按钮，Coolify会自动：
1. 克隆GitHub仓库
2. 安装依赖
3. 构建Next.js应用
4. 启动应用
5. 配置反向代理

## 📋 Coolify配置选项

### 选项1: 使用Nixpacks（推荐）

**优点：**
- ✅ 自动检测Next.js
- ✅ 配置简单
- ✅ 构建快速

**配置：**
- Build Pack: `Nixpacks`
- 其他保持默认

### 选项2: 使用Dockerfile

**优点：**
- ✅ 完全控制
- ✅ 优化镜像大小
- ✅ 生产环境优化

**配置：**
- Build Pack: `Dockerfile`
- Dockerfile已包含在项目中

## 🔧 重要配置

### 端口设置
```
Ports Exposes: 3000
```
Next.js默认运行在3000端口

### 域名设置
根据您的需求配置：
- `gotlaweb3.com`
- `www.gotlaweb3.com`

### 健康检查
Coolify会自动配置，无需手动设置

## ⚠️ 数据库说明

**当前版本使用内存数据库：**
- ✅ 可以正常运行
- ⚠️ 数据在重启后会丢失
- 🎯 适合演示和测试

**如需数据持久化：**

### 选项1: 添加PostgreSQL数据库

1. 在Coolify中添加PostgreSQL服务
2. 获取连接字符串
3. 修改代码使用PostgreSQL
4. 重新部署

### 选项2: 添加Redis

1. 在Coolify中添加Redis服务
2. 使用Redis存储数据
3. 修改代码使用Redis
4. 重新部署

### 选项3: 挂载卷（Volume）

如果想保留SQLite数据：
```
Volume Path: /app/data
Mount Path: /app
```

## 📊 部署流程

```
GitHub仓库
    ↓
Coolify克隆代码
    ↓
安装依赖 (npm ci)
    ↓
构建应用 (npm run build)
    ↓
启动服务 (npm start)
    ↓
配置反向代理
    ↓
应用运行在 gotlaweb3.com
```

## 🎯 部署后检查

1. **访问应用**
   - https://gotlaweb3.com

2. **测试功能**
   - ✅ 主页加载
   - ✅ 连接MetaMask
   - ✅ 绑定推荐关系
   - ✅ 后台管理 `/admin`
   - ✅ 统计页面 `/stats`

3. **查看日志**
   - 在Coolify控制台查看应用日志
   - 检查是否有错误

## 🔄 更新部署

### 自动部署
Coolify可以配置GitHub Webhook自动部署：
1. 在Coolify中启用 "Auto Deploy"
2. 推送代码到GitHub
3. Coolify自动检测并重新部署

### 手动部署
1. 推送代码到GitHub
2. 在Coolify控制台点击 "Redeploy"

## 🐛 常见问题

### 问题1: 构建失败
**解决：**
- 检查日志
- 确认依赖安装成功
- 检查Node.js版本

### 问题2: 应用无法访问
**解决：**
- 检查端口配置（3000）
- 检查域名DNS设置
- 检查防火墙规则

### 问题3: 数据丢失
**原因：** 使用内存数据库
**解决：** 迁移到持久化数据库

## 📝 推荐配置

### 生产环境配置

```yaml
Build Pack: Nixpacks
Port: 3000
Domain: gotlaweb3.com
Auto Deploy: ✅ 启用
Health Check: ✅ 启用
Restart Policy: always
```

### 环境变量

```
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

## 🎉 部署完成

部署成功后，您可以：
- 访问 https://gotlaweb3.com
- 使用所有功能
- 分享推荐链接
- 查看统计数据

## 🔗 相关链接

- **GitHub仓库**: https://github.com/NYCTEAM/REF
- **Coolify文档**: https://coolify.io/docs
- **Next.js文档**: https://nextjs.org/docs

## 💡 提示

1. **首次部署**可能需要5-10分钟
2. **后续更新**通常2-3分钟
3. **数据不持久化**，适合演示
4. **生产环境**建议添加数据库

现在可以在Coolify中点击 "Deploy" 开始部署了！🚀
