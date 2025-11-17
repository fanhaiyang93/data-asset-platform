'use client'

import React, { useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Save,
  Type,
  Undo,
  Redo,
  AlignLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeRichTextContent, validateRichTextContent, countRichTextCharacters } from '@/lib/contentSecurity'

interface RichTextEditorProps {
  content?: string
  placeholder?: string
  onContentChange?: (content: string) => void
  onSave?: (content: string) => void
  readOnly?: boolean
  maxLength?: number
  autoSave?: boolean
  autoSaveInterval?: number
  className?: string
}

export function RichTextEditor({
  content = '',
  placeholder = '请输入内容...',
  onContentChange,
  onSave,
  readOnly = false,
  maxLength = 100000, // 100KB限制
  autoSave = true,
  autoSaveInterval = 3000,
  className
}: RichTextEditorProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const [wordCount, setWordCount] = React.useState(0)

  const editor = useEditor({
    immediatelyRender: false, // 修复 SSR 水合不匹配错误
    extensions: [
      StarterKit.configure({
        // 配置基础功能
        heading: {
          levels: [1, 2, 3]
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800'
        }
      }),
      Placeholder.configure({
        placeholder: placeholder
      })
    ],
    content: content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()

      // 内容安全验证
      const validation = validateRichTextContent(html)
      if (!validation.isValid) {
        console.warn('内容安全验证失败:', validation.errors)
        // 撤销不安全的更改
        editor.commands.undo()
        return
      }

      // 使用安全的字符计数
      const charCount = countRichTextCharacters(html)
      setWordCount(charCount)

      // 长度限制检查
      if (charCount > maxLength) {
        // 如果超出限制，撤销最后一次更改
        editor.commands.undo()
        return
      }

      // 内容变更回调 - 传递清理后的内容
      const cleanContent = validation.cleanContent || html
      onContentChange?.(cleanContent)
    }
  })

  // 自动保存功能
  useEffect(() => {
    if (!autoSave || !editor || readOnly) return

    const interval = setInterval(() => {
      const html = editor.getHTML()
      if (html !== content && onSave) {
        handleSave()
      }
    }, autoSaveInterval)

    return () => clearInterval(interval)
  }, [autoSave, autoSaveInterval, editor, content, readOnly, onSave])

  // 手动保存
  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return

    setIsSaving(true)
    try {
      const html = editor.getHTML()

      // 保存前进行最终的安全验证和清理
      const validation = validateRichTextContent(html)
      if (!validation.isValid) {
        throw new Error(`内容安全验证失败: ${validation.errors.join(', ')}`)
      }

      const cleanContent = validation.cleanContent || html
      await onSave(cleanContent)
      setLastSaved(new Date())
    } catch (error) {
      console.error('保存失败:', error)
      // 可以在这里显示用户友好的错误提示
    } finally {
      setIsSaving(false)
    }
  }, [editor, onSave])

  // 格式化工具栏按钮
  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 p-0",
        isActive && "bg-primary text-primary-foreground"
      )}
    >
      {children}
    </Button>
  )

  // 插入链接
  const handleLinkClick = useCallback(() => {
    if (!editor) return

    const url = window.prompt('请输入链接地址:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) {
    return <div className="h-48 bg-muted animate-pulse rounded-md" />
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {readOnly ? '内容详情' : '内容编辑'}
          </CardTitle>
          {!readOnly && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{wordCount}/{maxLength}</span>
              {lastSaved && (
                <span>最后保存: {lastSaved.toLocaleTimeString()}</span>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* 工具栏 */}
        {!readOnly && (
          <div className="border-b p-3 flex flex-wrap items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="粗体"
            >
              <Bold className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="斜体"
            >
              <Italic className="w-4 h-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="无序列表"
            >
              <List className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="有序列表"
            >
              <ListOrdered className="w-4 h-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1" />

            <ToolbarButton
              onClick={handleLinkClick}
              isActive={editor.isActive('link')}
              title="插入链接"
            >
              <LinkIcon className="w-4 h-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="撤销"
            >
              <Undo className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="重做"
            >
              <Redo className="w-4 h-4" />
            </ToolbarButton>

            {/* 保存按钮 */}
            <div className="ml-auto">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        )}

        {/* 编辑器内容区域 */}
        <div className="min-h-[200px] p-4">
          <EditorContent
            editor={editor}
            className={cn(
              "prose prose-sm max-w-none focus:outline-none",
              readOnly ? "cursor-default" : "cursor-text",
              "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px]",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
            )}
          />
        </div>

        {/* 底部状态栏 */}
        {!readOnly && (
          <div className="border-t px-4 py-2 bg-muted/50 text-xs text-muted-foreground flex justify-between items-center">
            <span>支持粗体、斜体、列表和链接格式</span>
            <div className="flex items-center gap-4">
              {autoSave && <span>✓ 自动保存已启用</span>}
              <span>字符数: {wordCount}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default RichTextEditor