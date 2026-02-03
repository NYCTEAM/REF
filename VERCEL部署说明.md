# Vercel 部署说明

## 📦 项目准备

### 1. 代码已优化
- ✅ Express后端已转换为Next.js API路由
- ✅ 所有API调用改为相对路径
- ✅ 使用better-sqlite3替代sqlite3
- ✅ 添加vercel.json配置文件

### 2. 数据库说明

**重要：Vercel是无服务器(Serverless)平台**

- ❌ **不支持SQLite持久化存储**
- ❌ 每次函数调用都是独立的，文件系统是临时的
- ❌ 数据库文件会在函数执行完后丢失

**解决方案：**

需要使用外部数据库服务，推荐以下选项：

#### 选项1: Vercel Postgres（推荐）
- Vercel官方提供的PostgreSQL数据库
- 完全托管，自动扩展
- 与Vercel项目无缝集成

#### 选项2: PlanetScale
- 免费的MySQL兼容数据库
- Serverless架构
- 易于集成

#### 选项3: Supabase
- 开源的Firebase替代品
- 提供PostgreSQL数据库
- 免费套餐足够使用

#### 选项4: MongoDB Atlas
- 免费的MongoDB云数据库
- 适合NoSQL需求

## 🚀 部署步骤

### 方式1: 通过GitHub部署（推荐）

1. **推送代码到GitHub**
```bash
cd g:/推荐
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/NYCTEAM/REF.git
git branch -M main
git push -u origin main
```

2. **连接Vercel**
- 访问 https://vercel.com
- 点击 "New Project"
- 导入GitHub仓库 `NYCTEAM/REF`
- Vercel会自动检测Next.js项目

3. **配置环境变量（如果使用外部数据库）**
```
DATABASE_URL=your_database_connection_string
```

4. **部署**
- 点击 "Deploy"
- 等待构建完成
- 获得部署URL

### 方式2: 使用Vercel CLI

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

## ⚠️ 当前项目的限制

### SQLite在Vercel上的问题

当前项目使用SQLite，在Vercel上会遇到以下问题：

1. **数据不持久化**
   - 每次API调用创建新的数据库实例
   - 数据在函数执行完后丢失
   - 无法在不同请求间共享数据

2. **文件系统只读**
   - Vercel的文件系统在部署后是只读的
   - 只有`/tmp`目录可写，但不持久

3. **冷启动问题**
   - 每次冷启动都需要重新创建数据库
   - 影响性能

## 🔧 迁移到云数据库

### 使用Vercel Postgres

1. **在Vercel项目中添加Postgres**
```bash
vercel postgres create
```

2. **安装依赖**
```bash
npm install @vercel/postgres
```

3. **修改API路由**
```javascript
import { sql } from '@vercel/postgres';

// 查询示例
const result = await sql`SELECT * FROM users WHERE wallet_address = ${address}`;
```

### 使用Supabase

1. **创建Supabase项目**
- 访问 https://supabase.com
- 创建新项目
- 获取数据库连接字符串

2. **安装依赖**
```bash
npm install @supabase/supabase-js
```

3. **配置环境变量**
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📝 推荐的部署流程

### 短期测试方案（当前可用）

如果只是测试，可以暂时使用SQLite：
- 数据会在每次部署后重置
- 适合演示和开发
- 不适合生产环境

### 长期生产方案

1. **选择数据库服务**（推荐Vercel Postgres）
2. **创建数据库表结构**
3. **修改API路由使用新数据库**
4. **配置环境变量**
5. **部署到Vercel**

## 🎯 立即部署（使用当前SQLite版本）

虽然有限制，但可以立即部署用于演示：

```bash
# 1. 推送到GitHub
git init
git add .
git commit -m "Ready for Vercel deployment"
git remote add origin https://github.com/NYCTEAM/REF.git
git push -u origin main

# 2. 在Vercel导入项目
# 访问 vercel.com 并导入GitHub仓库

# 3. 部署完成
# 获得类似 https://ref-xxx.vercel.app 的URL
```

## 📊 功能对比

| 功能 | 本地开发 | Vercel (SQLite) | Vercel (云数据库) |
|------|---------|-----------------|-------------------|
| 数据持久化 | ✅ | ❌ | ✅ |
| 多用户访问 | ✅ | ❌ | ✅ |
| 性能 | ✅ | ⚠️ | ✅ |
| 成本 | 免费 | 免费 | 免费/付费 |
| 适用场景 | 开发 | 演示 | 生产 |

## 💡 建议

1. **立即部署演示版本**
   - 使用当前SQLite版本
   - 用于展示功能和UI
   - 告知用户数据会重置

2. **计划迁移到云数据库**
   - 选择合适的数据库服务
   - 修改代码使用云数据库
   - 重新部署生产版本

3. **保留本地开发环境**
   - 继续使用SQLite进行本地开发
   - 使用环境变量区分开发/生产环境

## 🔗 相关链接

- Vercel文档: https://vercel.com/docs
- Vercel Postgres: https://vercel.com/docs/storage/vercel-postgres
- Supabase: https://supabase.com
- PlanetScale: https://planetscale.com
- MongoDB Atlas: https://www.mongodb.com/atlas

## ❓ 常见问题

**Q: 可以直接部署当前版本吗？**
A: 可以，但数据不会持久化。适合演示，不适合生产。

**Q: 必须使用云数据库吗？**
A: 如果需要数据持久化和多用户访问，是的。

**Q: 哪个数据库最容易集成？**
A: Vercel Postgres，因为它与Vercel原生集成。

**Q: 迁移到云数据库需要多久？**
A: 大约1-2小时，主要是修改API路由和数据库查询。
