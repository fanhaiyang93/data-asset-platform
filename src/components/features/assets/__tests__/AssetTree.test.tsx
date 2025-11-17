import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssetTree } from '../AssetTree'
import { type CategoryTree } from '@/types'

// 模拟 tRPC
jest.mock('@/lib/trpc', () => ({
  trpc: {
    assets: {
      getCategoryTreeWithStats: {
        useQuery: jest.fn()
      }
    }
  }
}))

// 创建测试专用的 QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// 模拟测试数据
const mockTreeData: CategoryTree[] = [
  {
    id: '1',
    name: '人力资源',
    description: '人力资源相关数据',
    code: 'HR',
    depth: 0,
    path: '/HR',
    sortOrder: 0,
    isActive: true,
    assetCount: 15,
    parentId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    children: [
      {
        id: '2',
        name: '员工信息',
        description: '员工基础信息',
        code: 'HR_EMPLOYEE',
        depth: 1,
        path: '/HR/HR_EMPLOYEE',
        sortOrder: 0,
        isActive: true,
        assetCount: 8,
        parentId: '1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        children: [],
        _count: { assets: 8, children: 0 }
      }
    ],
    _count: { assets: 0, children: 1 }
  },
  {
    id: '4',
    name: '财务',
    description: '财务相关数据',
    code: 'FINANCE',
    depth: 0,
    path: '/FINANCE',
    sortOrder: 1,
    isActive: true,
    assetCount: 12,
    parentId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    children: [],
    _count: { assets: 12, children: 0 }
  }
]

describe('AssetTree Component', () => {
  const { trpc } = require('@/lib/trpc')

  beforeEach(() => {
    jest.clearAllMocks()
    // 默认模拟成功的API响应
    trpc.assets.getCategoryTreeWithStats.useQuery.mockReturnValue({
      data: mockTreeData,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    })
  })

  // 基本渲染测试
  it('should render tree structure correctly', async () => {
    render(
      <TestWrapper>
        <AssetTree />
      </TestWrapper>
    )

    // 等待数据加载并检查节点是否显示
    await waitFor(() => {
      expect(screen.getByText('人力资源')).toBeInTheDocument()
      expect(screen.getByText('财务')).toBeInTheDocument()
    })

    // 检查资产数量显示
    expect(screen.getByText('15')).toBeInTheDocument() // 人力资源
    expect(screen.getByText('12')).toBeInTheDocument() // 财务
  })

  // 测试展开/收起功能
  it('should handle expand/collapse functionality', async () => {
    const user = userEvent.setup()

    render(
      <TestWrapper>
        <AssetTree />
      </TestWrapper>
    )

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('人力资源')).toBeInTheDocument()
    })

    // 初始状态下子节点应该不可见
    expect(screen.queryByText('员工信息')).not.toBeInTheDocument()

    // 找到并点击展开按钮
    const expandButtons = screen.getAllByRole('button')
    const hrExpandButton = expandButtons.find(button =>
      button.getAttribute('aria-label')?.includes('展开')
    )

    if (hrExpandButton) {
      await user.click(hrExpandButton)

      // 展开后应该能看到子节点
      await waitFor(() => {
        expect(screen.getByText('员工信息')).toBeInTheDocument()
      })
    }
  })

  // 测试节点选择功能
  it('should handle node selection', async () => {
    const mockOnCategorySelect = jest.fn()
    const user = userEvent.setup()

    render(
      <TestWrapper>
        <AssetTree onCategorySelect={mockOnCategorySelect} />
      </TestWrapper>
    )

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('财务')).toBeInTheDocument()
    })

    // 点击财务节点
    const financeNode = screen.getByText('财务')
    await user.click(financeNode)

    // 检查回调是否被调用
    expect(mockOnCategorySelect).toHaveBeenCalledWith(expect.objectContaining({
      id: '4',
      name: '财务',
      code: 'FINANCE'
    }))
  })

  // 测试加载状态
  it('should display loading state', () => {
    // 模拟加载状态
    trpc.assets.getCategoryTreeWithStats.useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn()
    })

    render(
      <TestWrapper>
        <AssetTree />
      </TestWrapper>
    )

    // 加载状态应该显示骨架屏和提示文字
    expect(screen.getByText('加载分类树...')).toBeInTheDocument()
  })

  // 测试错误状态
  it('should display error state', () => {
    const errorMessage = '加载分类数据失败'
    const mockRefetch = jest.fn()

    // 模拟错误状态
    trpc.assets.getCategoryTreeWithStats.useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: errorMessage },
      refetch: mockRefetch
    })

    render(
      <TestWrapper>
        <AssetTree />
      </TestWrapper>
    )

    // 应该显示错误信息
    expect(screen.getByText('加载分类树失败')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()

    // 测试重试按钮存在
    const retryButton = screen.getByText('重试')
    expect(retryButton).toBeInTheDocument()
  })

  // 测试空状态
  it('should display empty state', () => {
    // 模拟空数据状态
    trpc.assets.getCategoryTreeWithStats.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn()
    })

    render(
      <TestWrapper>
        <AssetTree />
      </TestWrapper>
    )

    // 应该显示空状态提示
    expect(screen.getByText('暂无分类数据')).toBeInTheDocument()
    expect(screen.getByText('请联系管理员创建数据资产分类')).toBeInTheDocument()
  })
})