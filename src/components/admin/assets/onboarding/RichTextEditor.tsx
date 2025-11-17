'use client';

import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Unlink,
  Redo,
  Undo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileText,
  Eye,
  Edit3
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  showWordCount?: boolean;
  templates?: Array<{ name: string; content: string }>;
}

const COMMON_TEMPLATES = [
  {
    name: '基础描述模板',
    content: `<h3>资产概述</h3>
<p>该资产包含...</p>

<h3>数据内容</h3>
<ul>
  <li>主要字段：</li>
  <li>数据来源：</li>
  <li>更新频率：</li>
</ul>

<h3>使用场景</h3>
<p>适用于...</p>

<h3>注意事项</h3>
<ul>
  <li>数据质量：</li>
  <li>访问权限：</li>
  <li>使用限制：</li>
</ul>`
  },
  {
    name: '业务表描述模板',
    content: `<h3>业务背景</h3>
<p>该表用于存储...</p>

<h3>核心字段说明</h3>
<ul>
  <li><strong>主键</strong>：唯一标识字段</li>
  <li><strong>业务键</strong>：业务相关的关键字段</li>
  <li><strong>状态字段</strong>：记录数据状态</li>
  <li><strong>时间字段</strong>：创建和更新时间</li>
</ul>

<h3>数据质量要求</h3>
<ul>
  <li>完整性：所有必填字段不能为空</li>
  <li>准确性：数据格式符合业务规范</li>
  <li>时效性：数据更新及时</li>
</ul>

<h3>关联关系</h3>
<p>与以下表存在关联：</p>
<ul>
  <li>关联表1：关联关系说明</li>
  <li>关联表2：关联关系说明</li>
</ul>`
  },
  {
    name: 'API接口描述模板',
    content: `<h3>接口概述</h3>
<p>该API提供...</p>

<h3>请求参数</h3>
<ul>
  <li><code>参数1</code>：参数说明</li>
  <li><code>参数2</code>：参数说明</li>
</ul>

<h3>响应格式</h3>
<pre><code>{
  "code": 200,
  "message": "success",
  "data": {}
}</code></pre>

<h3>错误码说明</h3>
<ul>
  <li><code>400</code>：请求参数错误</li>
  <li><code>401</code>：权限不足</li>
  <li><code>500</code>：服务器错误</li>
</ul>

<h3>使用示例</h3>
<pre><code>curl -X GET "https://api.example.com/endpoint" \\
  -H "Authorization: Bearer token"</code></pre>`
  }
];

export default function RichTextEditor({
  content,
  onChange,
  placeholder = '请输入详细的资产描述...',
  maxLength = 5000,
  disabled = false,
  showWordCount = true,
  templates = COMMON_TEMPLATES
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // 修复 SSR 水合不匹配错误
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800'
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editable: !disabled
  });

  // 获取纯文本长度（用于字数统计）
  const getTextLength = useCallback(() => {
    if (!editor) return 0;
    return editor.getText().length;
  }, [editor]);

  // 设置链接
  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('链接地址', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // 应用模板
  const applyTemplate = useCallback((templateContent: string) => {
    if (!editor) return;

    if (editor.getText().length > 0) {
      const confirmed = window.confirm('当前内容将被模板替换，确定继续吗？');
      if (!confirmed) return;
    }

    editor.commands.setContent(templateContent);
  }, [editor]);

  if (!editor) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  const currentLength = getTextLength();
  const isOverLimit = currentLength > maxLength;

  return (
    <div className="space-y-4">
      {/* 模板选择 */}
      {templates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                快速模板
              </h4>
              <Badge variant="outline" className="text-xs">
                {templates.length} 个模板
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((template, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template.content)}
                  className="text-xs"
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 编辑器 */}
      <Card>
        <CardContent className="p-0">
          {/* 工具栏 */}
          <div className="border-b bg-gray-50 p-3 flex flex-wrap gap-1">
            {/* 撤销重做 */}
            <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-8 w-8 p-0"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-8 w-8 p-0"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>

            {/* 格式化 */}
            <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('code') ? 'bg-gray-200' : ''}`}
              >
                <Code className="h-4 w-4" />
              </Button>
            </div>

            {/* 标题 */}
            <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`h-8 px-2 text-xs ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
              >
                H1
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`h-8 px-2 text-xs ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
              >
                H2
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`h-8 px-2 text-xs ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''}`}
              >
                H3
              </Button>
            </div>

            {/* 列表 */}
            <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>

            {/* 引用和链接 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
              >
                <Quote className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={setLink}
                className={`h-8 w-8 p-0 ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
              {editor.isActive('link') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  className="h-8 w-8 p-0"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* 编辑区域 */}
          <div className="prose prose-sm max-w-none p-4 min-h-[300px] focus-within:outline-none">
            <EditorContent
              editor={editor}
              className="outline-none focus:outline-none"
            />
          </div>

          {/* 底部状态栏 */}
          {showWordCount && (
            <div className="border-t bg-gray-50 px-4 py-2 flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>字数统计</span>
                <Badge
                  variant={isOverLimit ? "destructive" : "secondary"}
                  className="font-mono"
                >
                  {currentLength} / {maxLength}
                </Badge>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="flex items-center">
                  <Edit3 className="w-3 h-3 mr-1" />
                  支持 Markdown 语法
                </span>
                <span className="flex items-center">
                  <Eye className="w-3 h-3 mr-1" />
                  实时预览
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 超出字数限制提示 */}
      {isOverLimit && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          ⚠️ 内容长度超出限制 {currentLength - maxLength} 个字符，请适当精简内容
        </div>
      )}

      {/* 编写提示 */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">📝 编写建议</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 使用标题结构化内容，便于阅读和理解</li>
            <li>• 重要概念可以使用**粗体**或<code>代码格式</code>标记</li>
            <li>• 适当使用列表来组织要点信息</li>
            <li>• 添加相关链接可以提供更多参考信息</li>
            <li>• 包含具体的使用示例和注意事项</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}