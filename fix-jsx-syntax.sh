#!/bin/bash

# JSX 语法修复脚本
# 修复缺少闭合符号 > 和多余的 } 的问题

FILES=(
  "src/components/features/applications/ApplicationReceipt.tsx"
  "src/app/(main)/applications/receipt/[applicationId]/page.tsx"
  "src/app/(main)/applications/success/[applicationId]/page.tsx"
)

echo "🔧 开始修复 JSX 语法错误..."

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  修复: $file"

    # 1. 修复 variant="..."}  → variant="..."
    # 2. 修复 className="..."}  → className="..."
    # 3. 修复 href="..."}  → href="..."
    perl -i -pe 's/="([^"]*)"}>/="$1">/g' "$file"
    perl -i -pe 's/="([^"]*)"}$/="$1">/g' "$file"

    # 4. 修复行尾缺少 > 的情况: className="..." (后面是换行) → className="...">
    # 需要看下一行是否是其他内容

  else
    echo "  ⚠️  文件不存在: $file"
  fi
done

echo "✅ JSX 语法修复完成!"
echo ""
echo "验证修复结果:"
grep -n '}$' "${FILES[@]}" | grep -E '(variant|className|href)=' || echo "  ✓ 没有发现多余的 }"
