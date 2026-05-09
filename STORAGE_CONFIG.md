# 反馈系统 - 存储配置指南

## 概述

反馈系统支持两种存储方式：
1. **本地文件系统**（本地开发环境）
2. **PostgreSQL 数据库**（Vercel 生产环境）

## 本地开发（推荐）

在本地开发时，系统自动使用文件系统存储：
- 数据文件位置：`/data/feedback.json`
- 无需额外配置
- 支持所有CRUD操作

### 本地运行步骤
```bash
# 安装依赖（如果还未安装）
npm install

# 启动开发服务器
npm run dev
```

## Vercel 生产环境配置

### 方案 A：使用 Neon PostgreSQL（推荐）

1. **在 Neon 创建数据库**：
   - 访问 [neon.tech](https://neon.tech)
   - 创建新项目和数据库
   - 获取连接字符串（DATABASE_URL）

2. **配置 Vercel 环境变量**：
   ```bash
   vercel env add DATABASE_URL
   # 粘贴您的 Neon 连接字符串
   ```

3. **初始化数据库表**：
   - 运行一次初始化脚本（会在第一次API调用时自动创建表）

4. **部署到 Vercel**：
   ```bash
   vercel --prod
   ```

### 数据库表结构

```sql
CREATE TABLE feedback (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reply TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_status ON feedback(status);
```

## 存储层自动选择逻辑

代码位置：`/lib/storage.js`

- **本地环境**：检测到 `process.env.VERCEL` 为空 → 使用文件系统
- **Vercel 环境**：检测到 `process.env.VERCEL` 存在且 `DATABASE_URL` 已配置 → 使用 PostgreSQL
- **Vercel 环境（无数据库）**：使用文件系统（仅限开发调试）

## API 端点

### POST /api/feedback
提交新反馈

```json
{
  "type": "校园资讯|问题反馈",
  "message": "反馈内容"
}
```

### GET /api/feedback
获取已审核反馈（公开页面）

### PUT /api/admin-feedback
更新反馈状态（需要 x-admin-secret 头）

## 故障排查

### 错误：`ENOENT: no such file or directory, mkdir '/var/task/data'`
- **原因**：在 Vercel 中尝试创建本地目录
- **解决**：配置 `DATABASE_URL` 环境变量，或在本地开发中测试

### 错误：`database not configured`
- **原因**：Vercel 环境未配置 DATABASE_URL
- **解决**：在 Vercel 项目设置中添加环境变量

### 数据丢失
- **原因**：在 Vercel 中使用文件系统（不持久化）
- **解决**：必须配置 PostgreSQL 数据库用于生产环境

## 环境变量

需要在 Vercel 项目设置中配置：

```
DATABASE_URL=postgresql://user:password@host:port/database
```

## 开发建议

1. **本地测试**：使用文件系统，方便调试和日志查看
2. **生产部署**：必须配置 PostgreSQL，确保数据持久化
3. **数据库迁移**：从文件系统迁移到数据库时，需要手动导入现有数据
