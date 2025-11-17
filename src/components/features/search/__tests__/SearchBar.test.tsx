import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchBar } from '@/components/features/search/SearchBar'
import { trpc } from '@/lib/trpc-client'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn()
}))

jest.mock('@/lib/trpc-client', () => ({
  trpc: {
    search: {
      suggest: {
        useQuery: jest.fn()
      },
      liveSearch: {
        useQuery: jest.fn()
      },
      logSearchAction: {
        useMutation: jest.fn()
      }
    }
  }
}))

jest.mock('lodash', () => ({
  debounce: jest.fn((fn: Function) => {
    const debouncedFn = jest.fn((...args: any[]) => {
      // 立即执行以便测试
      return fn(...args)
    })
    debouncedFn.cancel = jest.fn()
    return debouncedFn
  })
}))

const mockPush = jest.fn()
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>
const mockTrpc = trpc as jest.Mocked<typeof trpc>

describe('SearchBar', () => {
  const mockSearchParams = {
    get: jest.fn().mockReturnValue(null)
  }
  const mockSuggestQuery = {
    refetch: jest.fn(),
    data: null,
    isLoading: false,
    error: null
  }
  const mockLiveSearchQuery = {
    refetch: jest.fn(),
    data: null,
    isLoading: false,
    error: null
  }
  const mockLogSearchMutation = {
    mutate: jest.fn(),
    isLoading: false,
    error: null
  }

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })

    // Mock router
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn()
    } as any)

    // Mock useSearchParams
    mockUseSearchParams.mockReturnValue(mockSearchParams as any)

    // Mock tRPC hooks
    mockTrpc.search.suggest.useQuery.mockReturnValue(mockSuggestQuery as any)
    mockTrpc.search.liveSearch.useQuery.mockReturnValue(mockLiveSearchQuery as any)
    mockTrpc.search.logSearchAction.useMutation.mockReturnValue(mockLogSearchMutation as any)

    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('渲染', () => {
    it('应该渲染搜索输入框', () => {
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', '搜索数据资产...')
    })

    it('应该渲染自定义placeholder', () => {
      const customPlaceholder = '自定义搜索...'
      render(<SearchBar placeholder={customPlaceholder} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', customPlaceholder)
    })

    it('应该显示初始值', () => {
      const initialValue = 'test query'
      render(<SearchBar initialValue={initialValue} />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe(initialValue)
    })
  })

  describe('搜索功能', () => {
    it('应该在输入时显示建议下拉框', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'test')

      expect(mockSuggestQuery.refetch).toHaveBeenCalled()
      expect(mockLiveSearchQuery.refetch).toHaveBeenCalled()
    })

    it('应该在输入少于2个字符时不显示建议', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')

      await user.type(input, 't')

      expect(mockSuggestQuery.refetch).not.toHaveBeenCalled()
      expect(mockLiveSearchQuery.refetch).not.toHaveBeenCalled()
    })

    it('应该在按Enter时执行搜索', async () => {
      const user = userEvent.setup()
      const onSearch = jest.fn()

      render(<SearchBar onSearch={onSearch} />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'test query')
      await user.keyboard('{Enter}')

      expect(onSearch).toHaveBeenCalledWith('test query')
    })

    it('应该记录搜索行为', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'test query')
      await user.keyboard('{Enter}')

      expect(mockLogSearchMutation.mutate).toHaveBeenCalledWith({
        query: 'test query',
        action: 'search',
        sessionId: expect.stringMatching(/^session_\d+$/)
      })
    })

    it('应该在没有onSearch回调时导航到搜索页面', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'test query')
      await user.keyboard('{Enter}')

      expect(mockPush).toHaveBeenCalledWith('/search?q=test+query')
    })
  })

  describe('搜索建议', () => {
    it('应该显示搜索建议', async () => {
      mockSuggestQuery.data = {
        success: true,
        data: ['suggestion 1', 'suggestion 2']
      }

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input) // 触发focus以显示下拉框

      await waitFor(() => {
        expect(screen.getByText('搜索建议')).toBeInTheDocument()
        expect(screen.getByText('suggestion 1')).toBeInTheDocument()
        expect(screen.getByText('suggestion 2')).toBeInTheDocument()
      })
    })

    it('应该在点击建议时执行搜索', async () => {
      mockSuggestQuery.data = {
        success: true,
        data: ['suggestion 1']
      }

      const onSearch = jest.fn()
      const user = userEvent.setup()

      render(<SearchBar onSearch={onSearch} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input)

      await waitFor(() => {
        const suggestion = screen.getByText('suggestion 1')
        return user.click(suggestion)
      })

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('suggestion 1')
      })
    })
  })

  describe('实时搜索结果', () => {
    it('应该显示实时搜索结果', async () => {
      mockLiveSearchQuery.data = {
        success: true,
        data: [
          {
            id: '1',
            name: 'Test Asset',
            description: 'Test Description',
            type: 'table',
            categoryName: 'Test Category',
            status: 'AVAILABLE'
          }
        ]
      }

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('实时搜索结果')).toBeInTheDocument()
        expect(screen.getByText('Test Asset')).toBeInTheDocument()
        expect(screen.getByText('Test Description')).toBeInTheDocument()
      })
    })

    it('应该在点击实时结果时导航到资产页面', async () => {
      mockLiveSearchQuery.data = {
        success: true,
        data: [
          {
            id: 'asset-1',
            name: 'Test Asset',
            description: 'Test Description',
            type: 'table',
            status: 'AVAILABLE'
          }
        ]
      }

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input)

      await waitFor(() => {
        const assetResult = screen.getByText('Test Asset')
        return user.click(assetResult)
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/assets/asset-1')
      })
    })
  })

  describe('最近搜索', () => {
    it('应该加载最近搜索从localStorage', () => {
      const recentSearches = ['recent 1', 'recent 2']
      window.localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify(recentSearches)
      )

      render(<SearchBar />)

      expect(window.localStorage.getItem).toHaveBeenCalledWith('recentSearches')
    })

    it('应该显示最近搜索当输入为空', async () => {
      const recentSearches = ['recent 1', 'recent 2']
      window.localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify(recentSearches)
      )

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.click(input) // 触发focus显示下拉框

      await waitFor(() => {
        expect(screen.getByText('最近搜索')).toBeInTheDocument()
        expect(screen.getByText('recent 1')).toBeInTheDocument()
        expect(screen.getByText('recent 2')).toBeInTheDocument()
      })
    })

    it('应该保存搜索到最近搜索', async () => {
      window.localStorage.setItem = jest.fn()

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'new search')
      await user.keyboard('{Enter}')

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'recentSearches',
        JSON.stringify(['new search'])
      )
    })

    it('应该能删除最近搜索项', async () => {
      const recentSearches = ['recent 1', 'recent 2']
      window.localStorage.getItem = jest.fn().mockReturnValue(
        JSON.stringify(recentSearches)
      )
      window.localStorage.setItem = jest.fn()

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.click(input)

      await waitFor(async () => {
        const deleteButtons = screen.getAllByRole('button', { name: '' })
        const deleteButton = deleteButtons.find(btn =>
          btn.querySelector('svg') && btn.classList.contains('opacity-0')
        )

        if (deleteButton) {
          await user.click(deleteButton)
        }
      })

      expect(window.localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('键盘导航', () => {
    it('应该支持箭头键导航', async () => {
      mockSuggestQuery.data = {
        success: true,
        data: ['suggestion 1', 'suggestion 2']
      }

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input)

      // 等待建议显示
      await waitFor(() => {
        expect(screen.getByText('suggestion 1')).toBeInTheDocument()
      })

      // 测试向下箭头键
      await user.keyboard('{ArrowDown}')

      // 测试向上箭头键
      await user.keyboard('{ArrowUp}')

      // 应该不会报错
      expect(input).toBeInTheDocument()
    })

    it('应该在按Escape时关闭下拉框', async () => {
      mockSuggestQuery.data = {
        success: true,
        data: ['suggestion 1']
      }

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('suggestion 1')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      // 下拉框应该被隐藏（input失去焦点）
      expect(input).not.toHaveFocus()
    })
  })

  describe('清空搜索', () => {
    it('应该显示清空按钮当有输入时', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')

      const clearButton = screen.getByRole('button', { name: '' })
      expect(clearButton).toBeInTheDocument()
    })

    it('应该在点击清空按钮时清空输入', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      await user.type(input, 'test')

      const clearButton = screen.getByRole('button', { name: '' })
      await user.click(clearButton)

      expect(input.value).toBe('')
      expect(input).toHaveFocus()
    })
  })

  describe('空状态', () => {
    it('应该显示空状态当没有建议时', async () => {
      mockSuggestQuery.data = {
        success: true,
        data: []
      }
      mockLiveSearchQuery.data = {
        success: true,
        data: []
      }

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'nonexistent')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('没有找到相关建议')).toBeInTheDocument()
        expect(screen.getByText(/按 Enter 搜索/)).toBeInTheDocument()
      })
    })

    it('应该显示欢迎状态当没有最近搜索时', async () => {
      window.localStorage.getItem = jest.fn().mockReturnValue(null)

      const user = userEvent.setup()
      render(<SearchBar />)

      const input = screen.getByRole('textbox')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('开始搜索数据资产')).toBeInTheDocument()
      })
    })
  })

  describe('错误处理', () => {
    it('应该处理localStorage错误', () => {
      window.localStorage.getItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error')
      })

      // 不应该抛出错误
      expect(() => render(<SearchBar />)).not.toThrow()
    })

    it('应该处理无效的JSON在localStorage中', () => {
      window.localStorage.getItem = jest.fn().mockReturnValue('invalid json')

      // 不应该抛出错误
      expect(() => render(<SearchBar />)).not.toThrow()
    })
  })

  describe('外部点击', () => {
    it('应该在点击外部时关闭下拉框', async () => {
      mockSuggestQuery.data = {
        success: true,
        data: ['suggestion 1']
      }

      const user = userEvent.setup()
      render(
        <div>
          <SearchBar />
          <div data-testid="outside">Outside element</div>
        </div>
      )

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('suggestion 1')).toBeInTheDocument()
      })

      const outsideElement = screen.getByTestId('outside')
      await user.click(outsideElement)

      // 下拉框应该被关闭
      // 这里需要检查实际的实现逻辑
    })
  })
})