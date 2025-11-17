#!/bin/bash
echo "🔍 验证构建修复..."
echo ""

# 1. 检查skeleton组件
echo "✓ 检查 skeleton 组件..."
if [ -f "src/components/ui/skeleton.tsx" ]; then
  echo "  ✅ skeleton.tsx 存在"
else
  echo "  ❌ skeleton.tsx 缺失"
  exit 1
fi

# 2. 检查转义引号
echo ""
echo "✓ 检查 JSX 属性中的转义引号..."
ESCAPED_FILES=$(find src/app src/components -name "*.tsx" -exec grep -l '=\\"' {} \; 2>/dev/null)
if [ -z "$ESCAPED_FILES" ]; then
  echo "  ✅ 没有发现 JSX 属性转义引号"
else
  echo "  ❌ 发现转义引号:"
  echo "$ESCAPED_FILES"
  exit 1
fi

# 3. 检查tooltip组件
echo ""
echo "✓ 检查 tooltip 组件..."
if [ -f "src/components/ui/tooltip.tsx" ]; then
  echo "  ✅ tooltip.tsx 存在"
else
  echo "  ❌ tooltip.tsx 缺失"
  exit 1
fi

# 4. 检查session文件
echo ""
echo "✓ 检查 session 文件..."
if [ -f "src/lib/session.ts" ]; then
  echo "  ✅ session.ts 存在"
else
  echo "  ❌ session.ts 缺失"
  exit 1
fi

# 5. 检查trpc客户端导出
echo ""
echo "✓ 检查 tRPC 客户端导出..."
if grep -q "export { trpc } from" src/lib/trpc.ts; then
  echo "  ✅ tRPC 客户端已重新导出"
else
  echo "  ❌ tRPC 客户端导出缺失"
  exit 1
fi

echo ""
echo "🎉 所有检查通过!项目应该可以成功构建了。"
