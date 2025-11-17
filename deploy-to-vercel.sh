#!/bin/bash

# 数据资产管理平台 Vercel 部署脚本
# 使用方法: ./deploy-to-vercel.sh

set -e

echo "🚀 开始部署到 Vercel..."

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否安装了必要的工具
echo "📦 检查依赖..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未安装 Node.js${NC}"
    echo "请访问 https://nodejs.org 安装 Node.js"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ 错误: 未安装 Git${NC}"
    echo "请访问 https://git-scm.com 安装 Git"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 和 Git 已安装${NC}"

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  未安装 Vercel CLI${NC}"
    read -p "是否现在安装? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g vercel
    else
        echo -e "${RED}部署需要 Vercel CLI,退出...${NC}"
        exit 1
    fi
fi

# 检查 Git 仓库状态
echo ""
echo "🔍 检查 Git 状态..."

if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠️  未初始化 Git 仓库${NC}"
    read -p "是否初始化 Git 仓库? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git init
        git add .
        git commit -m "Initial commit for Vercel deployment"
        echo -e "${GREEN}✓ Git 仓库已初始化${NC}"
    fi
else
    echo -e "${GREEN}✓ Git 仓库已存在${NC}"
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  发现未提交的更改${NC}"
    git status --short
    echo ""
    read -p "是否提交这些更改? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "输入提交信息: " commit_message
        git add .
        git commit -m "${commit_message:-Update for deployment}"
        echo -e "${GREEN}✓ 更改已提交${NC}"
    fi
fi

# 检查环境变量配置
echo ""
echo "🔐 检查环境变量配置..."

if [ ! -f .env.production ]; then
    echo -e "${YELLOW}⚠️  未找到 .env.production 文件${NC}"
    echo "请参考 .env.production.example 创建生产环境配置"
    echo ""
    echo "重要提示:"
    echo "1. DATABASE_URL: 必须使用 PostgreSQL (不支持 SQLite)"
    echo "2. JWT_SECRET: 必须使用强密钥 (至少32字符)"
    echo "3. ALLOWED_CORS_ORIGINS: 部署后需要更新为实际域名"
    echo ""
    read -p "按 Enter 继续 (确保已在 Vercel Dashboard 配置环境变量)..."
fi

# 登录 Vercel
echo ""
echo "🔑 登录 Vercel..."
vercel login

# 部署到 Vercel
echo ""
echo "🚢 开始部署..."
vercel --prod

echo ""
echo -e "${GREEN}✅ 部署完成!${NC}"
echo ""
echo "📝 后续步骤:"
echo "1. 访问 Vercel Dashboard 确认部署状态"
echo "2. 配置数据库迁移: DATABASE_URL=\"你的数据库URL\" npx prisma migrate deploy"
echo "3. (可选) 填充种子数据: DATABASE_URL=\"你的数据库URL\" npx tsx prisma/seed.ts"
echo "4. 测试网站功能"
echo "5. 配置自定义域名 (可选)"
echo ""
echo "📚 详细文档: 查看 DEPLOYMENT.md"
echo ""
