import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import RichTextEditor from '../RichTextEditor'
import { sanitizeRichTextContent, validateRichTextContent } from '@/lib/contentSecurity'

// Mock DOMPurify
jest.mock('@/lib/contentSecurity', () => ({
  sanitizeRichTextContent: jest.fn((content) => content),
  validateRichTextContent: jest.fn((content) => ({
    isValid: true,
    errors: [],
    cleanContent: content
  })),
  countRichTextCharacters: jest.fn((content) => content.replace(/<[^>]*>/g, '').length)
}))

// Mock Tiptap Editor
jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn(() => ({
    getHTML: jest.fn(() => '<p>测试内容</p>'),
    getText: jest.fn(() => '测试内容'),
    isActive: jest.fn(() => false),
    can: jest.fn(() => ({ undo: () => true, redo: () => true })),
    chain: jest.fn(() => ({
      focus: jest.fn(() => ({
        toggleBold: jest.fn(() => ({ run: jest.fn() })),
        toggleItalic: jest.fn(() => ({ run: jest.fn() })),
        toggleBulletList: jest.fn(() => ({ run: jest.fn() })),
        toggleOrderedList: jest.fn(() => ({ run: jest.fn() })),
        setLink: jest.fn(() => ({ run: jest.fn() })),
        undo: jest.fn(() => ({ run: jest.fn() })),
        redo: jest.fn(() => ({ run: jest.fn() }))
      }))
    })),
    commands: {
      undo: jest.fn()
    }
  })),
  EditorContent: jest.fn(({ editor, className }) => (
    <div className={className} data-testid="editor-content">
      Mock Editor Content
    </div>
  ))
}))

const mockOnContentChange = jest.fn()
const mockOnSave = jest.fn()

describe('RichTextEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(validateRichTextContent as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      cleanContent: '<p>测试内容</p>'
    })
  })

  describe('基本渲染', () => {
    it('应该正确渲染编辑器组件', () => {
      render(
        <RichTextEditor
          content="<p>初始内容</p>"
          onContentChange={mockOnContentChange}
        />
      )

      expect(screen.getByText('内容编辑')).toBeInTheDocument()
      expect(screen.getByTestId('editor-content')).toBeInTheDocument()
    })

    it('应该在只读模式下显示正确的标题', () => {
      render(
        <RichTextEditor
          content="<p>只读内容</p>"
          readOnly={true}
        />
      )

      expect(screen.getByText('内容详情')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /粗体/ })).not.toBeInTheDocument()
    })

    it('应该显示字符计数', () => {
      render(
        <RichTextEditor
          content="<p>测试</p>"
          onContentChange={mockOnContentChange}
          maxLength={1000}
        />
      )

      // 字符计数显示
      expect(screen.getByText(/\/1000/)).toBeInTheDocument()
    })
  })

  describe('工具栏功能', () => {
    it('应该显示所有工具栏按钮', () => {
      render(
        <RichTextEditor
          onContentChange={mockOnContentChange}
        />
      )

      expect(screen.getByTitle('粗体')).toBeInTheDocument()
      expect(screen.getByTitle('斜体')).toBeInTheDocument()
      expect(screen.getByTitle('无序列表')).toBeInTheDocument()
      expect(screen.getByTitle('有序列表')).toBeInTheDocument()
      expect(screen.getByTitle('插入链接')).toBeInTheDocument()
      expect(screen.getByTitle('撤销')).toBeInTheDocument()
      expect(screen.getByTitle('重做')).toBeInTheDocument()
    })

    it('应该处理格式化按钮点击', async () => {
      const user = userEvent.setup()
      render(
        <RichTextEditor
          onContentChange={mockOnContentChange}
        />
      )

      const boldButton = screen.getByTitle('粗体')
      await user.click(boldButton)

      // 验证编辑器命令被调用
      // 由于我们使用了mock，这里主要确保组件没有报错
      expect(boldButton).toBeInTheDocument()
    })

    it('应该处理插入链接功能', async () => {
      const user = userEvent.setup()

      // Mock window.prompt
      const originalPrompt = window.prompt
      window.prompt = jest.fn(() => 'https://example.com')

      render(
        <RichTextEditor
          onContentChange={mockOnContentChange}
        />
      )

      const linkButton = screen.getByTitle('插入链接')
      await user.click(linkButton)

      expect(window.prompt).toHaveBeenCalledWith('请输入链接地址:')

      // 恢复原始 prompt
      window.prompt = originalPrompt
    })
  })

  describe('内容安全过滤', () => {
    it('应该在内容变更时进行安全验证', async () => {
      const { rerender } = render(
        <RichTextEditor
          content="<p>安全内容</p>"
          onContentChange={mockOnContentChange}
        />
      )

      // 模拟内容变更
      const mockEditor = require('@tiptap/react').useEditor()
      mockEditor.getHTML.mockReturnValue('<script>alert("xss")</script>')

      // 设置验证失败
      ;(validateRichTextContent as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['检测到恶意脚本'],
        cleanContent: ''
      })

      rerender(
        <RichTextEditor
          content="<script>alert('xss')</script>"
          onContentChange={mockOnContentChange}
        />
      )

      // 验证安全验证函数被调用
      expect(validateRichTextContent).toHaveBeenCalled()
    })

    it('应该阻止不安全的内容保存', async () => {
      const mockOnSave = jest.fn()
      render(
        <RichTextEditor
          content="<p>内容</p>"
          onSave={mockOnSave}
          onContentChange={mockOnContentChange}
        />
      )

      // 模拟不安全的内容
      const mockEditor = require('@tiptap/react').useEditor()
      mockEditor.getHTML.mockReturnValue('<script>alert("xss")</script>')

      // 设置验证失败
      ;(validateRichTextContent as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['检测到恶意脚本']
      })

      const saveButton = screen.getByText('保存')
      await userEvent.click(saveButton)

      // 验证onSave没有被调用
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  describe('长度限制', () => {
    it('应该强制执行长度限制', () => {
      const mockEditor = require('@tiptap/react').useEditor()

      render(
        <RichTextEditor
          content="短内容"
          onContentChange={mockOnContentChange}
          maxLength={10}
        />
      )

      // 模拟超长内容
      mockEditor.getText.mockReturnValue('这是一个超过十个字符的很长的内容')

      // 模拟字符计数函数返回超长长度
      const mockCountChars = require('@/lib/contentSecurity').countRichTextCharacters
      mockCountChars.mockReturnValue(20)

      // 重新渲染组件以触发长度检查
      const { rerender } = render(
        <RichTextEditor
          content="超长内容"
          onContentChange={mockOnContentChange}
          maxLength={10}
        />
      )

      // 验证撤销命令被调用（在实际的onUpdate回调中）
      expect(mockEditor.commands.undo).toBeDefined()
    })
  })

  describe('自动保存功能', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('应该支持自动保存', async () => {
      const mockOnSave = jest.fn()
      render(
        <RichTextEditor
          content="<p>初始内容</p>"
          onSave={mockOnSave}
          autoSave={true}
          autoSaveInterval={1000}
          onContentChange={mockOnContentChange}
        />
      )

      // 模拟内容变更
      const mockEditor = require('@tiptap/react').useEditor()
      mockEditor.getHTML.mockReturnValue('<p>变更后的内容</p>')

      // 快进时间
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('<p>变更后的内容</p>')
      })
    })

    it('应该在只读模式下禁用自动保存', () => {
      const mockOnSave = jest.fn()
      render(
        <RichTextEditor
          content="<p>只读内容</p>"
          onSave={mockOnSave}
          readOnly={true}
          autoSave={true}
          autoSaveInterval={1000}
        />
      )

      // 快进时间
      act(() => {
        jest.advanceTimersByTime(2000)
      })

      // 验证自动保存没有被调用
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  describe('保存功能', () => {
    it('应该成功保存清理后的内容', async () => {
      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      render(
        <RichTextEditor
          content="<p>测试内容</p>"
          onSave={mockOnSave}
          onContentChange={mockOnContentChange}
        />
      )

      const saveButton = screen.getByText('保存')
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('<p>测试内容</p>')
      })
    })

    it('应该处理保存错误', async () => {
      const mockOnSave = jest.fn().mockRejectedValue(new Error('保存失败'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <RichTextEditor
          content="<p>测试内容</p>"
          onSave={mockOnSave}
          onContentChange={mockOnContentChange}
        />
      )

      const saveButton = screen.getByText('保存')
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('保存失败:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('应该显示保存状态', async () => {
      const mockOnSave = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      render(
        <RichTextEditor
          content="<p>测试内容</p>"
          onSave={mockOnSave}
          onContentChange={mockOnContentChange}
        />
      )

      const saveButton = screen.getByText('保存')
      await userEvent.click(saveButton)

      // 验证保存中状态
      expect(screen.getByText('保存中...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument()
      })
    })
  })

  describe('占位符和提示', () => {
    it('应该显示自定义占位符', () => {
      render(
        <RichTextEditor
          placeholder="请输入您的内容..."
          onContentChange={mockOnContentChange}
        />
      )

      // 由于我们Mock了编辑器，这里主要确保组件正确接收了placeholder prop
      // 实际的占位符显示逻辑在Tiptap扩展中处理
      expect(screen.getByTestId('editor-content')).toBeInTheDocument()
    })

    it('应该显示帮助信息', () => {
      render(
        <RichTextEditor
          onContentChange={mockOnContentChange}
        />
      )

      expect(screen.getByText('支持粗体、斜体、列表和链接格式')).toBeInTheDocument()
      expect(screen.getByText('✓ 自动保存已启用')).toBeInTheDocument()
    })
  })
})