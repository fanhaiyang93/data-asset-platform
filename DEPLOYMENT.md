# 🚀 Vercel 部署指南

本指南详细说明如何将数据资产管理平台部署到 Vercel。

## 📋 前置准备

### 1. 准备工作
- [ ] 拥有 Vercel 账号 (访问 https://vercel.com)
- [ ] 项目代码已推送到 Git 仓库 (GitHub/GitLab/Bitbucket)
- [ ] 准备好生产数据库 (推荐使用 Vercel Postgres 或 Supabase)

### 2. 数据库选择

由于 Vercel 是无状态环境,不支持 SQLite 持久化存储,生产环境需要使用 PostgreSQL。

#### 选项 A: Vercel Postgres (推荐)
1. 登录 Vercel Dashboard
2. 进入你的项目 → Storage → Create Database
3. 选择 Postgres → 选择区域 (Hong Kong 最近)
4. 创建完成后会自动添加 `DATABASE_URL` 环境变量

#### 选项 B: Supabase (免费额度更高)
1. 访问 https://supabase.com
2. 创建新项目,选择香港区域
3. 进入 Settings → Database → Connection String
4. 复制 Connection String (URI 格式)

#### 选项 C: 其他 PostgreSQL 服务
- Railway: https://railway.app
- Neon: https://neon.tech
- PlanetScale: https://planetscale.com (MySQL,需修改 schema)

---

## 🔧 部署步骤

### 步骤 1: 准备代码仓库

确保你的项目已经提交到 Git 仓库:

```bash
# 如果还没有初始化 git
git init
git add .
git commit -m "Initial commit for Vercel deployment"

# 创建 GitHub 仓库并推送
# 方法1: 通过 GitHub CLI
gh repo create data-asset-platform --public --source=. --remote=origin --push

# 方法2: 手动创建
# 1. 访问 https://github.com/new
# 2. 创建仓库后执行:
git remote add origin https://github.com/你的用户名/data-asset-platform.git
git branch -M main
git push -u origin main
```

### 步骤 2: 导入项目到 Vercel

#### 方式 A: 通过 Vercel Dashboard (推荐新手)

1. **登录 Vercel**
   - 访问 https://vercel.com
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 选择你的 Git 仓库 `data-asset-platform`
   - 点击 "Import"

3. **配置项目**
   - Framework Preset: Next.js (自动检测)
   - Root Directory: `./` (如果项目在子目录,需要指定)
   - Build Command: `prisma generate && next build`
   - Install Command: `npm install`

4. **配置环境变量** (重要!)

   在 "Environment Variables" 部分添加以下变量:

   ```env
   # 数据库配置 (必需)
   DATABASE_URL=postgresql://user:password@host:5432/database

   # JWT 配置 (必需 - 必须修改为强密钥!)
   JWT_SECRET=你的超级安全密钥至少32位字符
   JWT_EXPIRES_IN=24h

   # CORS 配置 (部署后替换为实际域名)
   ALLOWED_CORS_ORIGINS=https://你的域名.vercel.app

   # SSO 配置 (可选)
   SSO_STATE_SECRET=另一个超级安全密钥
   # OAUTH_USER_INFO_URL=https://your-oauth-provider.com/userinfo
   # SAML_ENTRY_POINT=https://your-saml-idp.com/sso
   ```

   **生成安全密钥的方法:**
   ```bash
   # 在终端运行生成随机密钥
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **部署**
   - 点击 "Deploy"
   - 等待构建完成 (约 2-5 分钟)

#### 方式 B: 通过 Vercel CLI (推荐开发者)

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录 Vercel
vercel login

# 3. 部署项目
vercel

# 首次部署会询问:
# - Set up and deploy? Y
# - Which scope? 选择你的账号
# - Link to existing project? N
# - What's your project's name? data-asset-platform
# - In which directory is your code located? ./
# - Want to override the settings? N

# 4. 生产部署
vercel --prod
```

### 步骤 3: 初始化生产数据库

部署成功后,需要初始化数据库结构和种子数据。

#### 方法 A: 使用 Vercel CLI (推荐)

```bash
# 1. 拉取环境变量到本地
vercel env pull .env.production

# 2. 使用生产数据库 URL 运行迁移
DATABASE_URL="你的生产数据库URL" npx prisma migrate deploy

# 3. 生成 Prisma 客户端
DATABASE_URL="你的生产数据库URL" npx prisma generate

# 4. (可选) 填充种子数据
DATABASE_URL="你的生产数据库URL" npx tsx prisma/seed.ts
```

#### 方法 B: 修改 Prisma Schema 为 PostgreSQL

如果上面的方法不行,需要修改数据库配置:

1. **临时切换到 PostgreSQL**
   ```bash
   # 复制 PostgreSQL 版本的 schema
   cp prisma/schema.prisma.postgres prisma/schema.prisma
   ```

2. **运行迁移**
   ```bash
   DATABASE_URL="你的生产数据库URL" npx prisma migrate dev --name init
   ```

3. **恢复开发环境 schema**
   ```bash
   git restore prisma/schema.prisma
   ```

### 步骤 4: 验证部署

1. **访问你的网站**
   - Vercel 会提供一个 URL: `https://你的项目名.vercel.app`
   - 打开浏览器访问

2. **测试登录功能**
   - 如果运行了种子脚本,可以使用测试账号:
     - 管理员: `admin@company.com` / `admin123`
     - 资产管理员: `manager@company.com` / `manager123`
     - 业务用户: `user@company.com` / `user123`

3. **检查功能**
   - [ ] 用户登录
   - [ ] 资产浏览
   - [ ] 搜索功能
   - [ ] 申请流程

---

## 🔄 后续更新部署

### 自动部署 (推荐)

一旦项目连接到 Vercel,每次推送到主分支都会自动部署:

```bash
# 修改代码后
git add .
git commit -m "你的更新说明"
git push origin main

# Vercel 会自动检测并部署
```

### 手动部署

```bash
# 使用 Vercel CLI
vercel --prod
```

---

## 🌍 自定义域名配置

### 1. 在 Vercel 添加域名

1. 进入项目 → Settings → Domains
2. 输入你的域名 (例如: `data.yourcompany.com`)
3. 点击 "Add"

### 2. 配置 DNS

根据 Vercel 的提示,在你的域名服务商添加 DNS 记录:

**方式 A: CNAME 记录 (推荐)**
```
Type: CNAME
Name: data
Value: cname.vercel-dns.com
```

**方式 B: A 记录**
```
Type: A
Name: @
Value: 76.76.21.21
```

### 3. 更新环境变量

在 Vercel Dashboard 更新 `ALLOWED_CORS_ORIGINS`:
```
ALLOWED_CORS_ORIGINS=https://data.yourcompany.com,https://www.data.yourcompany.com
```

---

## 🐛 常见问题

### 1. 构建失败: "prisma generate failed"

**原因**: Prisma 客户端未生成

**解决方案**:
- 确保 `vercel.json` 中的 buildCommand 包含 `prisma generate`
- 或在 `package.json` 的 build 脚本中添加:
  ```json
  "scripts": {
    "build": "prisma generate && next build"
  }
  ```

### 2. 数据库连接失败

**原因**: DATABASE_URL 配置错误

**检查清单**:
- [ ] 环境变量 `DATABASE_URL` 是否正确设置
- [ ] 数据库是否允许从 Vercel IP 连接
- [ ] 连接字符串格式是否正确:
  ```
  postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
  ```

### 3. JWT 认证失败

**原因**: JWT_SECRET 未设置或不一致

**解决方案**:
- 确保在 Vercel 环境变量中设置了 `JWT_SECRET`
- 生产和预览环境使用不同的密钥
- 密钥长度至少 32 字符

### 4. CORS 错误

**原因**: 前端域名未在 CORS 白名单

**解决方案**:
- 更新 `ALLOWED_CORS_ORIGINS` 包含你的 Vercel 域名
- 格式: `https://domain1.com,https://domain2.com`

### 5. SSO 登录失败

**原因**: 回调 URL 配置错误

**解决方案**:
- 在 SSO 提供商配置中更新回调 URL:
  - 开发: `http://localhost:3000/api/auth/callback`
  - 生产: `https://你的域名.vercel.app/api/auth/callback`

---

## 📊 监控和日志

### 查看部署日志

**Vercel Dashboard:**
1. 进入项目 → Deployments
2. 点击最新部署 → 查看 Build Logs

**Vercel CLI:**
```bash
vercel logs 你的项目名 --follow
```

### 运行时错误监控

推荐集成:
- **Sentry**: 错误追踪
- **LogRocket**: 用户行为回放
- **Vercel Analytics**: 性能监控

---

## 🔐 安全建议

### 生产环境检查清单

- [ ] 所有环境变量使用强密钥 (至少 32 字符随机字符串)
- [ ] JWT_SECRET 绝对不要暴露在代码中
- [ ] DATABASE_URL 使用 SSL 连接 (`?sslmode=require`)
- [ ] 启用 Vercel 的身份验证保护 (Settings → Deployment Protection)
- [ ] 定期更新依赖包 (`npm audit fix`)
- [ ] 配置 Content Security Policy (CSP)
- [ ] 启用 HTTPS (Vercel 默认启用)

### 生成安全密钥

```bash
# 生成 JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成 SSO_STATE_SECRET
node -e "console.log('SSO_STATE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📚 相关资源

- [Vercel 官方文档](https://vercel.com/docs)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)
- [Prisma 生产最佳实践](https://www.prisma.io/docs/guides/deployment)
- [Vercel Postgres 文档](https://vercel.com/docs/storage/vercel-postgres)

---

## 💡 性能优化建议

### 1. 启用 Edge Runtime (可选)

对于某些 API 路由,可以使用 Edge Runtime 提高响应速度:

```typescript
// src/app/api/某个路由/route.ts
export const runtime = 'edge'
```

### 2. 图片优化

使用 Next.js Image 组件:
```tsx
import Image from 'next/image'

<Image src="/logo.png" width={200} height={200} alt="Logo" />
```

### 3. 数据库连接池

在 Prisma 配置中限制连接数:
```env
DATABASE_URL="postgresql://...?connection_limit=10"
```

### 4. 启用 ISR (增量静态再生)

对于不经常变化的页面:
```typescript
export const revalidate = 3600 // 每小时重新生成
```

---

## 🎉 完成!

恭喜!你的数据资产管理平台已经成功部署到 Vercel。

**下一步:**
1. 配置自定义域名
2. 设置 CI/CD 自动化测试
3. 集成监控和日志服务
4. 配置备份策略

有问题?查看 [Vercel 社区论坛](https://github.com/vercel/vercel/discussions) 或项目 Issues。
