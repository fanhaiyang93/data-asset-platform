import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TagEditor from '../TagEditor'

const mockOnTagsChange = jest.fn()
const mockOnLoadSuggestions = jest.fn()

const defaultProps = {
  tags: [],
  onTagsChange: mockOnTagsChange,
  maxTags: 10,
  maxTagLength: 50,
  placeholder: '输入标签并按回车添加'
}

describe('TagEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染标签编辑器', () => {
      render(<TagEditor {...defaultProps} />)

      expect(screen.getByText('标签管理')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('输入标签并按回车添加')).toBeInTheDocument()
      expect(screen.getByText('0/10')).toBeInTheDocument()
    })

    it('应该显示已有标签', () => {
      const existingTags = ['数据分析', '用户行为', '实时数据']
      render(<TagEditor {...defaultProps} tags={existingTags} />)

      existingTags.forEach(tag => {
        expect(screen.getByText(tag)).toBeInTheDocument()
      })
      expect(screen.getByText('3/10')).toBeInTheDocument()
    })

    it('应该在禁用状态下隐藏输入框', () => {
      render(<TagEditor {...defaultProps} disabled={true} />)

      expect(screen.queryByPlaceholderText('输入标签并按回车添加')).not.toBeInTheDocument()
    })
  })

  describe('标签添加功能', () => {
    it('应该支持通过回车键添加标签', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.type(input, '新标签')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['新标签'])
    })

    it('应该支持通过点击加号按钮添加标签', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.type(input, '新标签')

      // 找到加号按钮并点击
      const addButton = screen.getByRole('button')
      await user.click(addButton)

      expect(mockOnTagsChange).toHaveBeenCalledWith(['新标签'])
    })

    it('应该忽略重复标签', async () => {
      const user = userEvent.setup()
      const existingTags = ['数据分析']
      render(<TagEditor {...defaultProps} tags={existingTags} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.type(input, '数据分析')
      await user.keyboard('{Enter}')

      // 不应该调用onTagsChange，因为标签已存在
      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })

    it('应该忽略空白标签', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.type(input, '   ')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })

    it('应该限制标签数量', async () => {
      const user = userEvent.setup()
      const maxTags = 2
      const existingTags = ['标签1', '标签2']
      render(<TagEditor {...defaultProps} tags={existingTags} maxTags={maxTags} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.type(input, '标签3')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).not.toHaveBeenCalled()
      expect(screen.getByText('已达到最大标签数量限制 (2 个)')).toBeInTheDocument()
    })

    it('应该限制标签长度', async () => {
      const user = userEvent.setup()
      const maxTagLength = 5
      render(<TagEditor {...defaultProps} maxTagLength={maxTagLength} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.type(input, '这是一个很长的标签名称')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })
  })

  describe('标签删除功能', () => {
    it('应该支持删除标签', async () => {
      const user = userEvent.setup()
      const existingTags = ['标签1', '标签2']
      render(<TagEditor {...defaultProps} tags={existingTags} />)

      // 找到第一个标签的删除按钮
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find(button =>
        button.querySelector('svg')?.getAttribute('class')?.includes('w-3')
      )

      if (deleteButton) {
        await user.click(deleteButton)
        expect(mockOnTagsChange).toHaveBeenCalledWith(['标签2'])
      }
    })

    it('应该支持使用退格键删除最后一个标签', async () => {
      const user = userEvent.setup()
      const existingTags = ['标签1', '标签2']
      render(<TagEditor {...defaultProps} tags={existingTags} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')

      await user.click(input)
      await user.keyboard('{Backspace}')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['标签1'])
    })
  })

  describe('标签建议功能', () => {
    it('应该显示热门标签建议', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} showPopularTags={true} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('热门标签')).toBeInTheDocument()
        expect(screen.getByText('数据分析')).toBeInTheDocument()
      })
    })

    it('应该支持自定义建议加载', async () => {
      const user = userEvent.setup()
      const mockSuggestions = [
        { name: '自定义标签1', usage_count: 100, category: 'popular' as const },
        { name: '自定义标签2', usage_count: 50, category: 'recent' as const }
      ]

      mockOnLoadSuggestions.mockResolvedValue(mockSuggestions)

      render(<TagEditor {...defaultProps} onLoadSuggestions={mockOnLoadSuggestions} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.type(input, '自定义')

      await waitFor(() => {
        expect(mockOnLoadSuggestions).toHaveBeenCalledWith('自定义')
      })
    })

    it('应该支持点击建议标签添加', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} showPopularTags={true} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('数据分析')).toBeInTheDocument()
      })

      await user.click(screen.getByText('数据分析'))

      expect(mockOnTagsChange).toHaveBeenCalledWith(['数据分析'])
    })
  })

  describe('键盘导航', () => {
    it('应该支持方向键选择建议', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} showPopularTags={true} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('数据分析')).toBeInTheDocument()
      })

      await user.keyboard('{ArrowDown}')
      await user.keyboard('{Enter}')

      // 应该选择第一个建议
      expect(mockOnTagsChange).toHaveBeenCalled()
    })

    it('应该支持Escape键关闭建议', async () => {
      const user = userEvent.setup()
      render(<TagEditor {...defaultProps} showPopularTags={true} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('热门标签')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByText('热门标签')).not.toBeInTheDocument()
      })
    })
  })

  describe('状态信息显示', () => {
    it('应该显示正确的计数信息', () => {
      const existingTags = ['标签1', '标签2']
      const maxTags = 5
      render(<TagEditor {...defaultProps} tags={existingTags} maxTags={maxTags} />)

      expect(screen.getByText('已添加: 2')).toBeInTheDocument()
      expect(screen.getByText('剩余: 3')).toBeInTheDocument()
    })

    it('应该显示输入字符计数', async () => {
      const user = userEvent.setup()
      const maxTagLength = 20
      render(<TagEditor {...defaultProps} maxTagLength={maxTagLength} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.type(input, '测试标签')

      expect(screen.getByText('字符: 4/20')).toBeInTheDocument()
    })

    it('应该显示使用说明', () => {
      render(<TagEditor {...defaultProps} />)

      expect(screen.getByText(/输入标签名称后按回车添加/)).toBeInTheDocument()
      expect(screen.getByText(/使用方向键选择建议/)).toBeInTheDocument()
      expect(screen.getByText(/标签长度不超过/)).toBeInTheDocument()
    })
  })

  describe('错误处理', () => {
    it('应该处理建议加载失败', async () => {
      const user = userEvent.setup()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      mockOnLoadSuggestions.mockRejectedValue(new Error('加载失败'))

      render(<TagEditor {...defaultProps} onLoadSuggestions={mockOnLoadSuggestions} />)

      const input = screen.getByPlaceholderText('输入标签并按回车添加')
      await user.type(input, '测试')

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('加载标签建议失败:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })
})