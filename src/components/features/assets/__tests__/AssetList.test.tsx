import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssetList } from '../AssetList'
import { trpc } from '@/lib/trpc'

// Mock tRPC
jest.mock('@/lib/trpc', () => ({
  trpc: {
    assets: {
      getAssetsByCategory: {
        useQuery: jest.fn()
      }
    }
  }
}))

// Mock icons
jest.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: () => <div>ExclamationTriangleIcon</div>,
  MagnifyingGlassIcon: () => <div>MagnifyingGlassIcon</div>,
  ArrowUpIcon: () => <div>ArrowUpIcon</div>,
  ArrowDownIcon: () => <div>ArrowDownIcon</div>
}))

// Mock AssetCard component
jest.mock('../AssetCard', () => ({
  AssetCard: ({ asset, onClick }: any) => (
    <div data-testid={`asset-card-${asset.id}`} onClick={onClick}>
      <h3>{asset.name}</h3>
      <p>{asset.description}</p>
      <span>{asset.status}</span>
    </div>
  )
}))

// Mock Skeleton components
jest.mock('@/components/ui/Skeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton">Loading...</div>
}))

const mockAssets = [
  {
    id: '1',
    name: '用户数据表',
    description: '存储用户基础信息',
    status: 'AVAILABLE' as const,
    updatedAt: new Date('2023-01-01'),
    owner: '张三',
    viewCount: 100,
    category: {
      id: 'cat1',
      name: '人力资源',
      code: 'HR'
    }
  },
  {
    id: '2',
    name: '订单数据表',
    description: '电商订单数据',
    status: 'MAINTENANCE' as const,
    updatedAt: new Date('2023-01-02'),
    owner: '李四',
    viewCount: 50,
    category: {
      id: 'cat2',
      name: '业务数据',
      code: 'BIZ'
    }
  }
]

const mockQueryResponse = {
  assets: mockAssets,
  total: 2,
  hasMore: false,
  page: 1,
  limit: 20
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('AssetList', () => {
  const defaultProps = {
    categoryId: 'test-category-id',
    categoryName: '测试分类'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AC#1: 实现资产列表页面，显示核心资产信息', () => {
    test('应该正确渲染资产列表', async () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('测试分类')).toBeInTheDocument()
      expect(screen.getByText('共 2 个资产')).toBeInTheDocument()
      expect(screen.getByTestId('asset-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('asset-card-2')).toBeInTheDocument()
    })

    test('应该显示加载状态', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getAllByTestId('card-skeleton')).toHaveLength(20) // 默认limit
    })

    test('应该显示错误状态', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('API Error'),
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('加载失败')).toBeInTheDocument()
      expect(screen.getByText('无法加载资产列表，请稍后重试')).toBeInTheDocument()
    })

    test('应该显示空状态', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: { ...mockQueryResponse, assets: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('暂无资产')).toBeInTheDocument()
      expect(screen.getByText('该分类下还没有任何数据资产')).toBeInTheDocument()
    })
  })

  describe('AC#2: 列表包含资产名称、简要描述、更新频率、负责人、状态', () => {
    test('AssetCard应该接收到正确的资产数据', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      // 验证第一个资产卡片
      const card1 = screen.getByTestId('asset-card-1')
      expect(card1).toHaveTextContent('用户数据表')
      expect(card1).toHaveTextContent('存储用户基础信息')
      expect(card1).toHaveTextContent('AVAILABLE')

      // 验证第二个资产卡片
      const card2 = screen.getByTestId('asset-card-2')
      expect(card2).toHaveTextContent('订单数据表')
      expect(card2).toHaveTextContent('电商订单数据')
      expect(card2).toHaveTextContent('MAINTENANCE')
    })
  })

  describe('AC#3: 支持分页加载，每页显示20-50条记录', () => {
    test('应该支持每页条数选择', async () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      const limitSelect = screen.getByDisplayValue('20')
      expect(limitSelect).toBeInTheDocument()

      // 测试更改每页条数
      fireEvent.change(limitSelect, { target: { value: '50' } })

      await waitFor(() => {
        expect(mockUseQuery).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 50, page: 1 }),
          expect.any(Object)
        )
      })
    })

    test('应该显示分页控件', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: {
          ...mockQueryResponse,
          total: 100,
          hasMore: true
        },
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText((content, element) => {
        return element?.textContent === '显示第 1 - 20 条， 共 100 条记录'
      })).toBeInTheDocument()
      expect(screen.getByText('上一页')).toBeInTheDocument()
      expect(screen.getByText('下一页')).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return element?.textContent === '第 1 页，共 5 页'
      })).toBeInTheDocument()
    })

    test('应该支持分页导航', async () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: {
          ...mockQueryResponse,
          total: 100,
          hasMore: true
        },
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      const nextButton = screen.getByText('下一页')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(mockUseQuery).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 }),
          expect.any(Object)
        )
      })
    })
  })

  describe('AC#5: 支持按更新时间、热门程度排序', () => {
    test('应该显示排序按钮', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('更新时间')).toBeInTheDocument()
      expect(screen.getByText('热门程度')).toBeInTheDocument()
      expect(screen.getByText('名称')).toBeInTheDocument()
    })

    test('应该支持按更新时间排序', async () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      const updateTimeButton = screen.getByText('更新时间')
      fireEvent.click(updateTimeButton)

      await waitFor(() => {
        expect(mockUseQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'updatedAt',
            sortOrder: 'asc' // 因为默认是desc，点击后变成asc
          }),
          expect.any(Object)
        )
      })
    })

    test('应该支持按热门程度排序', async () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      const viewCountButton = screen.getByText('热门程度')
      fireEvent.click(viewCountButton)

      await waitFor(() => {
        expect(mockUseQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'viewCount',
            sortOrder: 'desc'
          }),
          expect.any(Object)
        )
      })
    })
  })

  describe('AC#6: 实现列表项的快速预览功能', () => {
    test('应该支持资产选择回调', () => {
      const mockOnAssetSelect = jest.fn()
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(
        <AssetList {...defaultProps} onAssetSelect={mockOnAssetSelect} />,
        { wrapper: createWrapper() }
      )

      const card1 = screen.getByTestId('asset-card-1')
      fireEvent.click(card1)

      expect(mockOnAssetSelect).toHaveBeenCalledWith(mockAssets[0])
    })
  })

  describe('性能要求', () => {
    test('应该启用查询缓存', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          keepPreviousData: true,
          staleTime: 5 * 60 * 1000 // 5分钟缓存
        })
      )
    })
  })

  describe('组件集成', () => {
    test('应该正确传递categoryId参数', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'test-category-id'
        }),
        expect.any(Object)
      )
    })

    test('当categoryId改变时应该重新查询', () => {
      const mockUseQuery = jest.fn().mockReturnValue({
        data: mockQueryResponse,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

      ;(trpc.assets.getAssetsByCategory.useQuery as jest.Mock) = mockUseQuery

      const { rerender } = render(<AssetList {...defaultProps} />, { wrapper: createWrapper() })

      // 更改categoryId
      rerender(
        <AssetList {...defaultProps} categoryId="new-category-id" />,
      )

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'new-category-id'
        }),
        expect.any(Object)
      )
    })
  })
})