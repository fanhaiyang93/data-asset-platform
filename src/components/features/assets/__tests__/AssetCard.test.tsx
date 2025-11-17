import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetCard } from '../AssetCard'
import { type AssetSummary } from '@/types'

// Mock icons
jest.mock('@heroicons/react/24/outline', () => ({
  ClockIcon: () => <div>ClockIcon</div>,
  EyeIcon: () => <div>EyeIcon</div>,
  UserIcon: () => <div>UserIcon</div>,
  DocumentIcon: () => <div>DocumentIcon</div>,
  ExclamationTriangleIcon: () => <div>ExclamationTriangleIcon</div>,
  CheckCircleIcon: () => <div>CheckCircleIcon</div>,
  WrenchScrewdriverIcon: () => <div>WrenchScrewdriverIcon</div>
}))

// Mock AssetPreviewModal
jest.mock('../AssetPreviewModal', () => ({
  AssetPreviewModal: ({ isOpen, onClose, assetName }: any) =>
    isOpen ? (
      <div data-testid="preview-modal">
        <h3>{assetName}</h3>
        <button onClick={onClose}>关闭</button>
      </div>
    ) : null
}))

const mockAsset: AssetSummary = {
  id: 'asset-1',
  name: '用户数据表',
  description: '存储用户基础信息的数据表',
  status: 'AVAILABLE',
  updatedAt: new Date('2023-06-01T10:00:00Z'),
  owner: '张三',
  viewCount: 150,
  category: {
    id: 'cat-1',
    name: '人力资源',
    code: 'HR'
  }
}

describe('AssetCard', () => {
  describe('AC#2: 列表包含资产名称、简要描述、更新频率、负责人、状态', () => {
    test('应该显示资产基本信息', () => {
      render(<AssetCard asset={mockAsset} />)

      expect(screen.getByText('用户数据表')).toBeInTheDocument()
      expect(screen.getByText('存储用户基础信息的数据表')).toBeInTheDocument()
      expect(screen.getByText('张三')).toBeInTheDocument()
      expect(screen.getByText('150 次浏览')).toBeInTheDocument()
    })

    test('应该显示格式化的更新时间', () => {
      render(<AssetCard asset={mockAsset} />)

      // 检查日期是否被格式化显示（具体格式可能因locale而异）
      expect(screen.getByText(/2023/)).toBeInTheDocument()
      expect(screen.getByText(/6月/)).toBeInTheDocument()
    })

    test('应该显示分类信息', () => {
      render(<AssetCard asset={mockAsset} />)

      expect(screen.getByText('分类：人力资源')).toBeInTheDocument()
    })
  })

  describe('AC#4: 提供资产状态的视觉标识（颜色标签）', () => {
    test('应该显示AVAILABLE状态', () => {
      const availableAsset = { ...mockAsset, status: 'AVAILABLE' as const }
      render(<AssetCard asset={availableAsset} />)

      expect(screen.getByText('可用')).toBeInTheDocument()
      const statusElement = screen.getByText('可用').closest('span')
      expect(statusElement).toHaveClass('bg-green-100', 'text-green-800')
    })

    test('应该显示MAINTENANCE状态', () => {
      const maintenanceAsset = { ...mockAsset, status: 'MAINTENANCE' as const }
      render(<AssetCard asset={maintenanceAsset} />)

      expect(screen.getByText('维护中')).toBeInTheDocument()
      const statusElement = screen.getByText('维护中').closest('span')
      expect(statusElement).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    test('应该显示DEPRECATED状态', () => {
      const deprecatedAsset = { ...mockAsset, status: 'DEPRECATED' as const }
      render(<AssetCard asset={deprecatedAsset} />)

      expect(screen.getByText('已弃用')).toBeInTheDocument()
      const statusElement = screen.getByText('已弃用').closest('span')
      expect(statusElement).toHaveClass('bg-red-100', 'text-red-800')
    })

    test('应该显示DRAFT状态', () => {
      const draftAsset = { ...mockAsset, status: 'DRAFT' as const }
      render(<AssetCard asset={draftAsset} />)

      expect(screen.getByText('草稿')).toBeInTheDocument()
      const statusElement = screen.getByText('草稿').closest('span')
      expect(statusElement).toHaveClass('bg-gray-100', 'text-gray-800')
    })
  })

  describe('AC#6: 实现列表项的快速预览功能', () => {
    test('应该显示快速预览按钮', () => {
      render(<AssetCard asset={mockAsset} showPreview={true} />)

      expect(screen.getByText('快速预览')).toBeInTheDocument()
      expect(screen.getByText('查看详情')).toBeInTheDocument()
    })

    test('应该支持隐藏预览按钮', () => {
      render(<AssetCard asset={mockAsset} showPreview={false} />)

      expect(screen.queryByText('快速预览')).not.toBeInTheDocument()
      expect(screen.queryByText('查看详情')).not.toBeInTheDocument()
    })

    test('点击快速预览应该打开预览模态框', () => {
      render(<AssetCard asset={mockAsset} showPreview={true} />)

      const previewButton = screen.getByText('快速预览')
      fireEvent.click(previewButton)

      expect(screen.getByTestId('preview-modal')).toBeInTheDocument()
      // 使用getAllByText检查存在多个同样文本的元素
      const titleElements = screen.getAllByText('用户数据表')
      expect(titleElements.length).toBeGreaterThan(0)
    })

    test('点击关闭应该关闭预览模态框', () => {
      render(<AssetCard asset={mockAsset} showPreview={true} />)

      // 打开模态框
      const previewButton = screen.getByText('快速预览')
      fireEvent.click(previewButton)

      expect(screen.getByTestId('preview-modal')).toBeInTheDocument()

      // 关闭模态框
      const closeButton = screen.getByText('关闭')
      fireEvent.click(closeButton)

      expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument()
    })

    test('点击预览按钮不应该触发卡片点击事件', () => {
      const mockOnClick = jest.fn()
      render(<AssetCard asset={mockAsset} onClick={mockOnClick} showPreview={true} />)

      const previewButton = screen.getByText('快速预览')
      fireEvent.click(previewButton)

      expect(mockOnClick).not.toHaveBeenCalled()
    })
  })

  describe('用户交互', () => {
    test('点击卡片应该触发onClick回调', () => {
      const mockOnClick = jest.fn()
      render(<AssetCard asset={mockAsset} onClick={mockOnClick} />)

      const card = screen.getByText('用户数据表').closest('div')
      fireEvent.click(card!)

      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })

    test('点击查看详情按钮应该触发onClick回调', () => {
      const mockOnClick = jest.fn()
      render(<AssetCard asset={mockAsset} onClick={mockOnClick} showPreview={true} />)

      const detailButton = screen.getByRole('button', { name: '查看详情' })
      fireEvent.click(detailButton)

      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })

    test('应该有hover效果样式', () => {
      render(<AssetCard asset={mockAsset} />)

      // 找到顶层卡片div元素
      const cardContainer = screen.getByText('用户数据表').closest('div[class*="bg-white"]')
      expect(cardContainer).toHaveClass('hover:shadow-md', 'transition-shadow', 'cursor-pointer')
    })
  })

  describe('响应式布局', () => {
    test('应该有响应式网格类名', () => {
      render(<AssetCard asset={mockAsset} />)

      // 找到顶层卡片div元素
      const cardContainer = screen.getByText('用户数据表').closest('div[class*="bg-white"]')
      expect(cardContainer).toHaveClass('bg-white', 'border', 'rounded-lg', 'shadow-sm')
    })
  })

  describe('边界情况处理', () => {
    test('应该处理无描述的情况', () => {
      const assetWithoutDescription = { ...mockAsset, description: undefined }
      render(<AssetCard asset={assetWithoutDescription} />)

      expect(screen.getByText('用户数据表')).toBeInTheDocument()
      expect(screen.queryByText('存储用户基础信息的数据表')).not.toBeInTheDocument()
    })

    test('应该处理无负责人的情况', () => {
      const assetWithoutOwner = { ...mockAsset, owner: undefined }
      render(<AssetCard asset={assetWithoutOwner} />)

      expect(screen.getByText('用户数据表')).toBeInTheDocument()
      expect(screen.queryByText('张三')).not.toBeInTheDocument()
    })

    test('应该处理无浏览次数的情况', () => {
      const assetWithoutViewCount = { ...mockAsset, viewCount: undefined }
      render(<AssetCard asset={assetWithoutViewCount} />)

      expect(screen.getByText('0 次浏览')).toBeInTheDocument()
    })

    test('应该处理无分类信息的情况', () => {
      const assetWithoutCategory = { ...mockAsset, category: undefined }
      render(<AssetCard asset={assetWithoutCategory} />)

      expect(screen.getByText('用户数据表')).toBeInTheDocument()
      expect(screen.queryByText(/分类：/)).not.toBeInTheDocument()
    })
  })

  describe('可访问性', () => {
    test('状态标签应该有合适的语义', () => {
      render(<AssetCard asset={mockAsset} />)

      const statusSpan = screen.getByText('可用')
      expect(statusSpan.tagName).toBe('SPAN')
      expect(statusSpan).toHaveClass('inline-flex', 'items-center')
    })

    test('时间信息应该有title属性', () => {
      render(<AssetCard asset={mockAsset} />)

      // 根据实际HTML结构，时间信息在span元素上带有title属性
      const timeElement = screen.getByText(/2023/)
      expect(timeElement).toHaveAttribute('title')
    })

    test('负责人信息应该可以完整显示', () => {
      const longNameAsset = { ...mockAsset, owner: '这是一个非常长的负责人姓名测试' }
      render(<AssetCard asset={longNameAsset} />)

      // 根据实际HTML结构，负责人信息在span元素上带有title属性
      const ownerElement = screen.getByText('这是一个非常长的负责人姓名测试')
      expect(ownerElement).toHaveAttribute('title', '这是一个非常长的负责人姓名测试')
    })
  })
})