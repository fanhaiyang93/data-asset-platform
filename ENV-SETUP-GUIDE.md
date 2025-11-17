# 🔐 Vercel 环境变量配置指南

## 📋 必需环境变量配置

你已经创建了 Supabase 数据库,现在需要在 Vercel 中配置这些环境变量。

---

## 1️⃣ DATABASE_URL (必需) ⭐

### 这是什么?
PostgreSQL 数据库连接字符串,用于连接你的 Supabase 数据库。

### 如何获取?

#### 步骤 1: 登录 Supabase
访问 https://app.supabase.com

#### 步骤 2: 进入你的项目
选择你创建的 `data-asset-platform` 项目

#### 步骤 3: 获取连接字符串
1. 左侧菜单 → **Settings** (设置图标)
2. 点击 **Database**
3. 找到 **Connection string** 部分
4. 选择 **URI** 标签 (不是 Transaction pooler)
5. 复制连接字符串

#### 步骤 4: 替换密码
连接字符串格式如下:
```
postgresql://postgres.[项目ID]:[YOUR-PASSWORD]@aws-0-ap-east-1.pooler.supabase.com:6543/postgres
```

**重要**: 将 `[YOUR-PASSWORD]` 替换为你创建 Supabase 项目时设置的数据库密码!

### 最终配置值示例:
```env
DATABASE_URL=postgresql://postgres.abcdefghijklmn:MySecureP@ssw0rd@aws-0-ap-east-1.pooler.supabase.com:6543/postgres
```

---

## 2️⃣ JWT_SECRET (必需) ⭐

### 这是什么?
用于加密和验证 JWT Token 的密钥,必须是强随机字符串。

### 如何生成?

#### 方法 1: 使用 Node.js (推荐)
在终端运行:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

会输出类似这样的随机字符串:
```
a7f3e9b2c1d4f8a6e5b9c3d7f1a8e4b2c6d9f3a7e1b5c8d2f6a9e3b7c1d4f8a6
```

#### 方法 2: 在线生成
访问 https://generate-secret.vercel.app/32
点击生成,复制随机字符串

#### 方法 3: 使用 OpenSSL
```bash
openssl rand -hex 32
```

### 最终配置值示例:
```env
JWT_SECRET=a7f3e9b2c1d4f8a6e5b9c3d7f1a8e4b2c6d9f3a7e1b5c8d2f6a9e3b7c1d4f8a6
```

⚠️ **安全提示**:
- 必须至少 32 位字符
- 绝对不要使用示例中的密钥
- 每个环境使用不同的密钥

---

## 3️⃣ JWT_EXPIRES_IN (必需)

### 这是什么?
JWT Token 的有效期。

### 配置值:
```env
JWT_EXPIRES_IN=24h
```

可选值:
- `1h` - 1小时
- `24h` - 24小时 (推荐)
- `7d` - 7天
- `30d` - 30天

---

## 4️⃣ ALLOWED_CORS_ORIGINS (必需)

### 这是什么?
允许跨域请求的域名白名单。

### 部署前配置:
首次部署时,先使用占位符:
```env
ALLOWED_CORS_ORIGINS=https://your-app.vercel.app
```

### 部署后更新:
Vercel 部署完成后,会给你一个域名,例如:
```
https://data-asset-platform-abc123.vercel.app
```

然后在 Vercel Dashboard 更新这个环境变量:
```env
ALLOWED_CORS_ORIGINS=https://data-asset-platform-abc123.vercel.app
```

如果有多个域名(包括自定义域名):
```env
ALLOWED_CORS_ORIGINS=https://data-asset-platform-abc123.vercel.app,https://data.yourcompany.com
```

---

## 5️⃣ SSO_STATE_SECRET (可选)

### 这是什么?
SSO 单点登录的状态加密密钥。

### 是否需要?
- ❌ 如果不使用 SSO 功能,**可以不配置**
- ✅ 如果使用企业 SSO 登录,**必须配置**

### 如何生成?
与 JWT_SECRET 相同的方法:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 配置值示例:
```env
SSO_STATE_SECRET=b8e4f0c3d5a9f7b2e6c1d8f4a3e7b9c2d6f1a8e4b7c3d9f2a6e8b1c5d7f3a9
```

---

## 6️⃣ OAUTH_USER_INFO_URL (可选)

### 这是什么?
OAuth 2.0 提供商的用户信息接口地址。

### 是否需要?
- ❌ 不使用 OAuth 登录则不需要
- ✅ 使用 OAuth 登录则必须配置

### 配置值示例:
```env
# 企业 OAuth 服务
OAUTH_USER_INFO_URL=https://oauth.yourcompany.com/api/userinfo

# 第三方 OAuth (如果使用)
# GitHub: https://api.github.com/user
# Google: https://www.googleapis.com/oauth2/v2/userinfo
```

---

## 7️⃣ SAML_ENTRY_POINT (可选)

### 这是什么?
SAML 2.0 单点登录的入口地址。

### 是否需要?
- ❌ 不使用 SAML SSO 则不需要
- ✅ 使用企业 SAML 登录则必须配置

### 配置值示例:
```env
SAML_ENTRY_POINT=https://sso.yourcompany.com/saml/login
```

---

## 🚀 在 Vercel 中配置环境变量

### 方法 1: 通过 Vercel Dashboard (推荐)

1. **登录 Vercel**
   访问 https://vercel.com/dashboard

2. **选择你的项目**
   - 如果还未导入,先导入 GitHub 仓库
   - 如果已导入,点击项目名称

3. **进入设置**
   - 点击顶部 **Settings** 标签
   - 左侧菜单选择 **Environment Variables**

4. **添加变量**
   对于每个必需的环境变量:

   - 点击 "Add New"
   - **Key**: 输入变量名 (如 `DATABASE_URL`)
   - **Value**: 输入变量值
   - **Environments**:
     - ✅ Production (生产环境)
     - ✅ Preview (预览环境,可选)
     - ❌ Development (本地开发不需要)
   - 点击 "Save"

5. **重复添加所有必需变量**

### 方法 2: 通过 Vercel CLI

```bash
# 添加单个变量
vercel env add DATABASE_URL production

# 系统会提示你输入值
# 输入后按 Enter

# 重复以上步骤添加其他变量
```

---

## ✅ 配置检查清单

在部署之前,确保配置了以下必需变量:

### 基础配置 (必需)
- [ ] `DATABASE_URL` - Supabase 连接字符串
- [ ] `JWT_SECRET` - 至少 32 位随机字符串
- [ ] `JWT_EXPIRES_IN` - Token 有效期 (推荐 `24h`)
- [ ] `ALLOWED_CORS_ORIGINS` - 先用占位符,部署后更新

### SSO 配置 (如果需要)
- [ ] `SSO_STATE_SECRET` - SSO 状态密钥
- [ ] `OAUTH_USER_INFO_URL` - OAuth 用户信息接口
- [ ] `SAML_ENTRY_POINT` - SAML 入口地址

---

## 📝 完整配置示例 (仅作参考,请使用你自己的值!)

```env
# ========== 必需配置 ==========

# 1. 数据库连接
DATABASE_URL=postgresql://postgres.abcdefghijklmn:YourDatabasePassword123@aws-0-ap-east-1.pooler.supabase.com:6543/postgres

# 2. JWT 配置
JWT_SECRET=a7f3e9b2c1d4f8a6e5b9c3d7f1a8e4b2c6d9f3a7e1b5c8d2f6a9e3b7c1d4f8a6
JWT_EXPIRES_IN=24h

# 3. CORS 配置 (部署后更新为实际域名)
ALLOWED_CORS_ORIGINS=https://data-asset-platform-abc123.vercel.app

# ========== 可选配置 (SSO) ==========

# 仅在使用 SSO 时配置
SSO_STATE_SECRET=b8e4f0c3d5a9f7b2e6c1d8f4a3e7b9c2d6f1a8e4b7c3d9f2a6e8b1c5d7f3a9
# OAUTH_USER_INFO_URL=https://oauth.yourcompany.com/api/userinfo
# SAML_ENTRY_POINT=https://sso.yourcompany.com/saml/login
```

---

## 🔄 配置后的步骤

1. **保存所有环境变量**
2. **触发重新部署** (如果已经部署过)
   - Vercel Dashboard → Deployments → 右上角 "Redeploy"
   - 或推送新的 Git commit
3. **运行数据库迁移** (首次部署)
   ```bash
   # 方法见 DEPLOYMENT.md 的 "步骤 3: 初始化生产数据库"
   ```
4. **测试登录功能**

---

## 🆘 遇到问题?

### 数据库连接失败
- 检查 `DATABASE_URL` 密码是否正确
- 确认在 Supabase 选择了 "URI" 而不是 "Transaction pooler"
- 尝试在 Supabase Dashboard → Settings → Database → Reset Database Password

### JWT 认证失败
- 确认 `JWT_SECRET` 已配置且长度足够
- 检查是否在 Production 环境配置了该变量
- 尝试重新生成并更新 JWT_SECRET

### CORS 错误
- 确认 `ALLOWED_CORS_ORIGINS` 包含你的 Vercel 域名
- 确保没有多余的空格
- 确保使用 `https://` 而不是 `http://`

---

## 🎉 完成!

配置完所有必需的环境变量后,你就可以开始部署了!

**下一步**: 查看 `QUICKSTART-VERCEL.md` 继续部署流程。
