#!/bin/bash

# 修复Next.js 16中params必须是Promise的问题

files=(
  "src/app/api/auth/sso/[provider]/route.ts"
  "src/app/api/platform/callback/[platform]/route.ts"
  "src/app/api/admin/sso/providers/[id]/statistics/route.ts"
  "src/app/api/admin/sso/providers/[id]/test/route.ts"
  "src/app/api/admin/sso/providers/[id]/route.ts"
  "src/app/api/applications/[id]/status/route.ts"
  "src/app/api/applications/[id]/appeal/route.ts"
  "src/app/api/applications/[id]/timeline/route.ts"
)

echo "🔧 修复Next.js 16 params类型问题..."
echo ""

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  修复: $file"
    
    # 使用Python脚本修复
    python3 << PYTHON
import re

file_path = "$file"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 修复函数签名: { params } -> { params: paramsPromise }
# 修复1: export async function GET(request: NextRequest, { params }: { params: { ... } })
pattern1 = r'(export async function (?:GET|POST|PUT|DELETE|PATCH)\s*\(\s*request:\s*NextRequest,\s*)(\{\s*params\s*\}:\s*\{\s*params:\s*\{[^}]+\}\s*\})'
def replace1(match):
    prefix = match.group(1)
    # 提取params类型
    params_type_match = re.search(r'\{\s*params:\s*(\{[^}]+\})', match.group(2))
    if params_type_match:
        params_type = params_type_match.group(1)
        return f"{prefix}context: {{ params: Promise<{params_type}> }}"
    return match.group(0)

content = re.sub(pattern1, replace1, content)

# 添加params解包到函数开头
# 在第一个try或者函数体开始后添加: const params = await context.params
lines = content.split('\n')
new_lines = []
in_function = False
function_indent = ''
added_await = set()

for i, line in enumerate(lines):
    new_lines.append(line)
    
    # 检测函数开始
    if 'export async function' in line and 'context:' in line:
        in_function = True
        # 获取缩进
        function_indent = len(line) - len(line.lstrip())
        function_name = re.search(r'function\s+(\w+)', line).group(1) if re.search(r'function\s+(\w+)', line) else ''
        
        # 找到下一个try或{
        for j in range(i+1, min(i+10, len(lines))):
            if 'try {' in lines[j] or ('{' in lines[j] and 'try' not in lines[j]):
                # 在try块之后或函数体开始后添加params解包
                indent = len(lines[j]) - len(lines[j].lstrip()) + 2
                if function_name not in added_await:
                    new_lines.append(' ' * (indent+2) + '// Await params (Next.js 16)')
                    new_lines.append(' ' * (indent+2) + 'const params = await context.params')
                    new_lines.append('')
                    added_await.add(function_name)
                break

with open(file_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print("    ✅ 完成")
PYTHON

  else
    echo "  ⚠️  文件不存在: $file"
  fi
done

echo ""
echo "✅ 所有文件修复完成!"
