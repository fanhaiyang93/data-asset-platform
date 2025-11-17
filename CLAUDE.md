# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

企业级数据资产管理平台,基于 Next.js 16 (App Router) + Prisma + tRPC 构建。支持多角色权限系统、SSO 集成、资产元数据管理、申请审批流程。

## 核心技术栈

- **Next.js 16 (App Router)**: 使用新的 app 目录结构,支持 Server Components
- **TypeScript**: 全栈类型安全
- **Ant Design**: 主要 UI 组件库 (管理后台)
- **Radix UI**: 无障碍 UI 基础组件 (用户端)
- **Tailwind CSS**: 样式系统
- **tRPC**: 端到端类型安全 API
- **Prisma**: ORM 和数据库管理,SQLite 开发库
- **JWT 认证**: 基于角色的访问控制 (RBAC)

## 开发命令

### 基础开发
```bash
npm run dev              # 启动开发服务器 (localhost:3000)
npm run build           # 构建生产版本
npm run start           # 启动生产服务器
npm run lint            # ESLint 代码检查
```

### 数据库管理
```bash
npm run db:generate     # 生成 Prisma 客户端
npm run db:push         # 同步数据库结构(开发用)
npm run db:migrate      # 创建数据库迁移(生产用)
npm run db:studio       # 打开 Prisma Studio 数据库管理界面
npx tsx prisma/seed.ts  # 运行种子数据脚本
```

### 测试
```bash
npm run test            # 运行 Jest 测试套件
npm run test:watch      # 监听模式运行测试
npm run test:coverage   # 生成测试覆盖率报告
```

## 核心架构

### Next.js App Router 路由分组

项目使用路由分组实现不同的布局和权限控制:

- **(auth)**: 认证相关页面 (登录、SSO 回调),无主布局
- **(main)**: 主应用页面,使用 DashboardLayout 布局
  - `/` - 首页仪表板
  - `/assets/*` - 资产浏览、收藏
  - `/applications/*` - 申请管理
  - `/admin/*` - 管理后台 (需要管理员权限)
- **api/**: Next.js API 路由 (tRPC、认证等)

### tRPC 架构

项目使用 tRPC 实现端到端类型安全:

**服务端** (`src/server/routers/`):
- 定义 API 路由和业务逻辑
- 使用 Zod 进行输入验证
- 通过 Prisma 访问数据库

**客户端** (`src/lib/trpc-client.ts`):
```typescript
import { trpc } from '@/lib/trpc-client'

// 在组件中使用
const { data, isLoading } = trpc.assets.getAssets.useQuery({ skip: 0, take: 10 })
const createAsset = trpc.assets.createAsset.useMutation()
```

**主要路由模块**:
- `auth.ts` - 认证、用户管理、SSO
- `assets.ts` - 资产 CRUD、搜索
- `application.ts` - 申请流程
- `search.ts` - 全局搜索
- `platform.ts` - 平台配置

### 权限系统架构

三层权限检查机制:

1. **中间件级别** (`src/middleware.ts`)
   - 路由级权限检查
   - 保护管理后台路由 `/admin/*`

2. **tRPC 程序级别** (`src/lib/trpc.ts`)
   - `publicProcedure` - 公开访问
   - `protectedProcedure` - 需要登录
   - `adminProcedure` - 需要管理员权限 (ASSET_MANAGER 或 SYSTEM_ADMIN)
   - `systemAdminProcedure` - 需要系统管理员权限

3. **组件级别** (`src/components/auth/RouteGuard.tsx`)
   - UI 级别的权限控制
   - 基于用户角色显示/隐藏组件

**角色定义**:
- `BUSINESS_USER` - 业务用户,只读资产和创建申请
- `ASSET_MANAGER` - 资产管理员,管理资产和审核申请
- `SYSTEM_ADMIN` - 系统管理员,全部权限

### 认证流程

JWT 认证流程:
1. 用户登录 → `src/server/routers/auth.ts`
2. 生成 JWT Token → `src/lib/auth.ts`
3. Token 存储在 cookie (`auth-token`)
4. 中间件验证 → `src/middleware.ts`
5. tRPC 上下文注入用户信息 → `src/lib/trpc.ts`

SSO 集成支持:
- SAML 2.0 (企业单点登录)
- OAuth 2.0 (第三方认证)
- LDAP (活动目录集成)

### 数据库架构

Prisma Schema (`prisma/schema.prisma`):
- SQLite 用于开发,支持切换到 PostgreSQL/MySQL
- 完整的关系模型和约束
- 审计日志和版本控制
- 软删除支持

重要表:
- `users` - 用户信息和角色
- `assets` - 数据资产元数据
- `categories` - 资产分类
- `applications` - 访问申请
- `audit_logs` - 审计日志
- `permissions` - 细粒度权限

### 组件架构

**UI 组件**:
- `src/components/ui/` - Radix UI 封装的基础组件
- 使用 Tailwind CSS + CVA 实现变体管理
- 主题通过 CSS 变量统一管理

**业务组件**:
- `src/components/features/` - 功能组件 (搜索、表单等)
- `src/components/auth/` - 认证相关组件
- `src/components/layout/` - 布局组件

**关键组件**:
- `DashboardLayout.tsx` - 主应用布局,包含侧边栏和顶栏
- `RouteGuard.tsx` - 路由权限守卫
- `TRPCProvider.tsx` - tRPC 客户端提供者

## 测试用户账号

种子数据包含三个测试用户:
- **系统管理员**: `admin@company.com` / `admin123`
- **资产管理员**: `manager@company.com` / `manager123`
- **业务用户**: `user@company.com` / `user123`

## 环境变量配置

关键环境变量 (`.env`):
```env
# 数据库
DATABASE_URL="file:./dev.db"

# JWT 安全
JWT_SECRET=your_super_secure_jwt_secret_key
JWT_EXPIRES_IN=24h

# SSO 配置
SSO_STATE_SECRET=your-secure-random-secret-key
OAUTH_USER_INFO_URL=https://your-oauth-provider.com/userinfo
SAML_ENTRY_POINT=https://your-saml-idp.com/sso

# CORS
ALLOWED_CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## 数据库开发流程

### 修改数据库 Schema
1. 编辑 `prisma/schema.prisma`
2. 运行 `npm run db:push` (开发环境快速同步)
   - 或 `npm run db:migrate` (生产环境创建迁移)
3. 运行 `npm run db:generate` 更新 Prisma 客户端

### 查看数据
- 使用 `npm run db:studio` 打开可视化界面
- 或直接查询: `sqlite3 prisma/dev.db "SELECT * FROM users"`

### 重置数据库
```bash
rm prisma/dev.db        # 删除数据库文件
npm run db:push         # 重新创建结构
npx tsx prisma/seed.ts  # 重新填充种子数据
```

## 常见问题和注意事项

### Ant Design 组件使用
- 管理后台主要使用 Ant Design
- 已弃用的 API 需要更新:
  - `Tabs.TabPane` → 使用 `items` prop
  - `<Link><a></a></Link>` → 直接使用 `<Link>`

### tRPC 调用注意事项
- 客户端组件必须用 `'use client'` 标记
- 使用 `trpc.router.procedure.useQuery()` 获取数据
- 使用 `trpc.router.procedure.useMutation()` 修改数据
- 所有 API 调用都是类型安全的,IDE 会提供自动完成

### 权限检查
- 修改管理后台页面时确保使用正确的 tRPC 程序 (`adminProcedure` 或 `systemAdminProcedure`)
- 菜单项的 key 必须唯一,避免 Ant Design 警告
- 在 `DashboardLayout.tsx` 中根据用户角色动态显示菜单

### 数据库查询
- 使用 Prisma 的类型安全查询
- 注意 SQLite 的 BigInt 字段在 JavaScript 中是 `bigint` 类型
- 审计日志会自动记录重要操作

### 调试
- 使用浏览器开发工具查看 tRPC 网络请求
- 服务端日志在终端输出
- React Query DevTools 可用于调试 tRPC 查询状态
