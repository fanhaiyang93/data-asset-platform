# ⚡ Vercel 快速部署参考

## 🎯 最快部署方式 (5分钟)

### 方法 1: 一键脚本部署

```bash
./deploy-to-vercel.sh
```

### 方法 2: 手动快速部署

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod
```

---

## 🗄️ 数据库快速配置

### 推荐: Vercel Postgres

1. **创建数据库**
   - 登录 Vercel Dashboard
   - 你的项目 → Storage → Create Database
   - 选择 Postgres

2. **自动配置**
   - DATABASE_URL 会自动添加到环境变量

3. **初始化数据库**
   ```bash
   # 拉取环境变量
   vercel env pull .env.production

   # 切换到 PostgreSQL schema
   cp prisma/schema.prisma.postgres prisma/schema.prisma

   # 运行迁移
   DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npx prisma migrate deploy
   ```

---

## 🔑 必需环境变量

在 Vercel Dashboard → Settings → Environment Variables 添加:

```env
# 1. 数据库 (必需)
DATABASE_URL=postgresql://user:password@host:5432/database

# 2. JWT 密钥 (必需)
JWT_SECRET=你的超级安全密钥至少32位
JWT_EXPIRES_IN=24h

# 3. CORS (必需 - 部署后更新)
ALLOWED_CORS_ORIGINS=https://你的域名.vercel.app
```

**生成安全密钥:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ 部署检查清单

- [ ] 代码已推送到 Git 仓库
- [ ] 已创建 PostgreSQL 数据库
- [ ] 已在 Vercel 配置所有必需环境变量
- [ ] 已生成强密钥用于 JWT_SECRET
- [ ] 项目已导入到 Vercel
- [ ] Build Command: `prisma generate && next build`
- [ ] 部署成功后运行数据库迁移
- [ ] 测试登录和基本功能

---

## 🐛 常见错误快速修复

### 错误: "prisma generate failed"
```json
// package.json
"scripts": {
  "build": "prisma generate && next build"
}
```

### 错误: 数据库连接失败
- 检查 DATABASE_URL 格式
- 确保数据库允许 Vercel IP 连接
- PostgreSQL 连接字符串格式:
  ```
  postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
  ```

### 错误: JWT 认证失败
- 确认 JWT_SECRET 已在 Vercel 环境变量中设置
- 密钥长度至少 32 字符

---

## 📊 部署后操作

```bash
# 查看部署日志
vercel logs 项目名 --follow

# 查看环境变量
vercel env ls

# 重新部署
vercel --prod

# 回滚到上一个版本
# 在 Vercel Dashboard → Deployments → 选择版本 → Promote to Production
```

---

## 🌐 自定义域名 (可选)

1. Vercel Dashboard → 你的项目 → Settings → Domains
2. 添加你的域名: `data.yourcompany.com`
3. 在 DNS 提供商添加 CNAME 记录:
   ```
   Type: CNAME
   Name: data
   Value: cname.vercel-dns.com
   ```
4. 更新 ALLOWED_CORS_ORIGINS 环境变量

---

## 📚 更多帮助

- **完整文档**: 查看 `DEPLOYMENT.md`
- **Vercel 文档**: https://vercel.com/docs
- **问题排查**: https://github.com/vercel/vercel/discussions

---

## 🎉 成功标志

访问你的网站 `https://项目名.vercel.app`:
- ✅ 页面正常加载
- ✅ 可以登录 (使用种子数据的测试账号)
- ✅ 资产列表可以显示
- ✅ 搜索功能正常

**默认测试账号** (如果运行了种子脚本):
- 管理员: `admin@company.com` / `admin123`
- 资产管理员: `manager@company.com` / `manager123`
- 业务用户: `user@company.com` / `user123`
