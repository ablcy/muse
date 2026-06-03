---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 0a9ed6357c9369e0c26fb6fb5f43e499_1d3b27cd5ef111f1b5095254007bceed
    ReservedCode1: ExzyL2iCJIPUnIMWBCuRsdE0QVoU8dnYCiAZXjpcX60oyBCv8QxwelIOrfhZWuQa7k3A14vOZ4r9AmacqrVp0pxsW4Ag4Avis7Tt8DrbGvR1xN927O0Mo+P95pjx8Yb9cExTwl4X2KXJD7dyJafH645ZWsYx0y55qAcc5KAlPRCWT4wWVNwI1Uv33hU=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 0a9ed6357c9369e0c26fb6fb5f43e499_1d3b27cd5ef111f1b5095254007bceed
    ReservedCode2: ExzyL2iCJIPUnIMWBCuRsdE0QVoU8dnYCiAZXjpcX60oyBCv8QxwelIOrfhZWuQa7k3A14vOZ4r9AmacqrVp0pxsW4Ag4Avis7Tt8DrbGvR1xN927O0Mo+P95pjx8Yb9cExTwl4X2KXJD7dyJafH645ZWsYx0y55qAcc5KAlPRCWT4wWVNwI1Uv33hU=
---

# Muse - 灵感记录便签

Muse 是一个极简的灵感记录便签应用，支持用户注册登录，数据保存在云端 PostgreSQL 数据库，随时随地访问你的灵感。

## 功能

- 用户注册 / 登录（JWT 认证，Token 有效期 7 天）
- 快速记录灵感（支持 Ctrl+Enter 快捷提交）
- 云端存储，数据跨设备同步
- 搜索便签内容
- 按时间筛选（全部 / 今日 / 本周）
- 一键复制便签内容
- 响应式设计，适配桌面和移动端

## 技术栈

- **前端**：纯 HTML + CSS + JavaScript，无框架依赖
- **后端**：Node.js + Express + PostgreSQL（Neon）
- **认证**：bcryptjs 密码加密 + jsonwebtoken

## 项目结构

```
muse/
├── index.html      # 主页面（含登录/注册/便签界面）
├── style.css       # 样式文件
├── script.js       # 前端交互逻辑（含认证模块 + API 调用）
├── server.js       # 后端服务（Express + PostgreSQL）
├── package.json    # 项目依赖
├── .env.example    # 环境变量示例
├── db/
│   └── init.sql    # 数据库初始化脚本
└── README.md
```

## 本地开发

### 1. 安装依赖

```bash
cd muse
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=your_random_secret_here
PORT=3000
```

### 3. 初始化数据库

在 Neon 控制台中执行 `db/init.sql` 中的 SQL 语句，创建 `users` 和 `notes` 表。

### 4. 启动服务

```bash
npm start
```

访问 http://localhost:3000 即可使用。

## 云部署（Railway）

1. 将项目推送到 GitHub 仓库
2. 在 Railway 中新建项目，关联该仓库
3. 添加 PostgreSQL 插件（或使用 Neon 外部数据库）
4. 设置环境变量：
   - `DATABASE_URL`：数据库连接字符串（Railway PostgreSQL 自动注入）
   - `JWT_SECRET`：随机生成的密钥
   - `PORT`：Railway 自动注入，无需手动设置
5. 部署完成后访问 `https://muses.up.railway.app/`

## API 文档

### 认证接口

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/api/auth/register` | 用户注册 | `{ username, password }` |
| POST | `/api/auth/login` | 用户登录 | `{ username, password }` |
| GET | `/api/auth/me` | 获取当前用户（需认证） | — |

### 便签接口（均需认证，Header 携带 `Authorization: Bearer <token>`）

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | `/api/notes` | 获取当前用户所有便签 | — |
| POST | `/api/notes` | 创建便签 | `{ content }` |
| DELETE | `/api/notes/:id` | 删除便签 | — |

### 认证响应示例

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "alice",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 错误响应格式

```json
{ "error": "错误信息描述" }
```

状态码说明：`400` 参数错误，`401` 未认证，`409` 用户名已存在，`500` 服务器错误。

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 是 | JWT 签名密钥，生产环境请使用强随机字符串 |
| `PORT` | 否 | 服务端口，默认 3000，Railway 自动注入 |
*（内容由AI生成，仅供参考）*
