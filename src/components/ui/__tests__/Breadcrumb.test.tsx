import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { Breadcrumb, CompactBreadcrumb, ExpandableBreadcrumb } from '../Breadcrumb'
import { type CategoryBreadcrumb } from '@/types'

// 测试数据
const mockBreadcrumbItems: CategoryBreadcrumb[] = [
  {
    id: '1',
    name: '人力资源',
    depth: 0,
    code: 'HR',
    path: '/HR'
  },
  {
    id: '2',
    name: '员工信息',
    depth: 1,
    code: 'HR_EMPLOYEE',
    path: '/HR/HR_EMPLOYEE'
  },
  {
    id: '3',
    name: '基础信息',
    depth: 2,
    code: 'HR_EMPLOYEE_BASIC',
    path: '/HR/HR_EMPLOYEE/HR_EMPLOYEE_BASIC'
  }
]

describe('Breadcrumb Component', () => {
  // AC4: 测试面包屑导航的路径显示和点击跳转
  it('should display breadcrumb path correctly', () => {
    render(<Breadcrumb items={mockBreadcrumbItems} />)

    // 检查所有面包屑项是否显示
    expect(screen.getByText('数据资产')).toBeInTheDocument() // 默认首页
    expect(screen.getByText('人力资源')).toBeInTheDocument()
    expect(screen.getByText('员工信息')).toBeInTheDocument()
    expect(screen.getByText('基础信息')).toBeInTheDocument()

    // 检查首页图标
    const homeIcon = document.querySelector('svg')
    expect(homeIcon).toBeInTheDocument()
  })

  it('should handle item clicks correctly', async () => {
    const mockOnItemClick = jest.fn()
    const user = userEvent.setup()

    render(
      <Breadcrumb
        items={mockBreadcrumbItems}
        onItemClick={mockOnItemClick}
      />
    )

    // 点击人力资源
    const hrItem = screen.getByText('人力资源')
    await user.click(hrItem)

    expect(mockOnItemClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        name: '人力资源'
      }),
      0
    )
  })

  it('should handle home click correctly', async () => {
    const mockOnItemClick = jest.fn()
    const user = userEvent.setup()

    render(
      <Breadcrumb
        items={mockBreadcrumbItems}
        onItemClick={mockOnItemClick}
        showHome={true}
      />
    )

    // 点击首页
    const homeItem = screen.getByText('数据资产')
    await user.click(homeItem)

    expect(mockOnItemClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'home',
        name: '数据资产'
      }),
      -1
    )
  })

  // 测试长路径的省略功能
  it('should truncate long paths correctly', () => {
    const longPath: CategoryBreadcrumb[] = [
      { id: '1', name: '一级分类', depth: 0, code: 'L1' },
      { id: '2', name: '二级分类', depth: 1, code: 'L2' },
      { id: '3', name: '三级分类', depth: 2, code: 'L3' },
      { id: '4', name: '四级分类', depth: 3, code: 'L4' },
      { id: '5', name: '五级分类', depth: 4, code: 'L5' },
      { id: '6', name: '六级分类', depth: 5, code: 'L6' }
    ]

    render(<Breadcrumb items={longPath} maxItems={4} />)

    // 应该显示省略号
    expect(screen.getByText('...')).toBeInTheDocument()

    // 应该显示首页和最后几项
    expect(screen.getByText('数据资产')).toBeInTheDocument()
    expect(screen.getByText('六级分类')).toBeInTheDocument()
  })

  // 测试无首页模式
  it('should work without home item', () => {
    render(<Breadcrumb items={mockBreadcrumbItems} showHome={false} />)

    // 不应该显示首页
    expect(screen.queryByText('数据资产')).not.toBeInTheDocument()

    // 应该直接显示第一个项目
    expect(screen.getByText('人力资源')).toBeInTheDocument()
  })

  // 测试自定义首页名称
  it('should support custom home name', () => {
    render(
      <Breadcrumb
        items={mockBreadcrumbItems}
        showHome={true}
        homeName="资产管理"
      />
    )

    expect(screen.getByText('资产管理')).toBeInTheDocument()
    expect(screen.queryByText('数据资产')).not.toBeInTheDocument()
  })

  // 测试最后一项不可点击
  it('should make last item non-clickable', async () => {
    const mockOnItemClick = jest.fn()
    const user = userEvent.setup()

    render(
      <Breadcrumb
        items={mockBreadcrumbItems}
        onItemClick={mockOnItemClick}
      />
    )

    // 点击最后一项
    const lastItem = screen.getByText('基础信息')
    await user.click(lastItem)

    // 最后一项应该不触发回调
    expect(mockOnItemClick).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: '基础信息' }),
      expect.any(Number)
    )
  })
})

describe('CompactBreadcrumb Component', () => {
  it('should display compact breadcrumb for mobile', () => {
    render(<CompactBreadcrumb items={mockBreadcrumbItems} />)

    // 应该显示返回按钮
    expect(screen.getByText('返回')).toBeInTheDocument()

    // 应该显示当前项目
    expect(screen.getByText('基础信息')).toBeInTheDocument()
  })

  it('should handle back navigation', async () => {
    const mockOnItemClick = jest.fn()
    const user = userEvent.setup()

    render(
      <CompactBreadcrumb
        items={mockBreadcrumbItems}
        onItemClick={mockOnItemClick}
      />
    )

    // 点击返回按钮
    const backButton = screen.getByText('返回')
    await user.click(backButton)

    // 应该导航到父级
    expect(mockOnItemClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '2',
        name: '员工信息'
      }),
      1
    )
  })

  it('should not show back button for single item', () => {
    render(<CompactBreadcrumb items={[mockBreadcrumbItems[0]]} />)

    expect(screen.queryByText('返回')).not.toBeInTheDocument()
    expect(screen.getByText('人力资源')).toBeInTheDocument()
  })
})

describe('ExpandableBreadcrumb Component', () => {
  it('should show expand button for long paths', () => {
    const longPath: CategoryBreadcrumb[] = [
      { id: '1', name: '一级', depth: 0, code: 'L1' },
      { id: '2', name: '二级', depth: 1, code: 'L2' },
      { id: '3', name: '三级', depth: 2, code: 'L3' },
      { id: '4', name: '四级', depth: 3, code: 'L4' },
      { id: '5', name: '五级', depth: 4, code: 'L5' }
    ]

    render(<ExpandableBreadcrumb items={longPath} maxItems={3} />)

    // 应该显示展开按钮
    expect(screen.getByText('显示完整路径')).toBeInTheDocument()
  })

  it('should expand and collapse correctly', async () => {
    const longPath: CategoryBreadcrumb[] = [
      { id: '1', name: '一级', depth: 0, code: 'L1' },
      { id: '2', name: '二级', depth: 1, code: 'L2' },
      { id: '3', name: '三级', depth: 2, code: 'L3' },
      { id: '4', name: '四级', depth: 3, code: 'L4' },
      { id: '5', name: '五级', depth: 4, code: 'L5' }
    ]

    const user = userEvent.setup()
    render(<ExpandableBreadcrumb items={longPath} maxItems={3} />)

    // 初始状态应该显示省略号
    expect(screen.getByText('...')).toBeInTheDocument()

    // 点击展开
    const expandButton = screen.getByText('显示完整路径')
    await user.click(expandButton)

    // 展开后应该显示所有项目
    expect(screen.getByText('一级')).toBeInTheDocument()
    expect(screen.getByText('二级')).toBeInTheDocument()
    expect(screen.getByText('三级')).toBeInTheDocument()
    expect(screen.getByText('四级')).toBeInTheDocument()
    expect(screen.getByText('五级')).toBeInTheDocument()

    // 应该显示收起按钮
    expect(screen.getByText('收起路径')).toBeInTheDocument()
  })

  it('should not show expand button for short paths', () => {
    render(<ExpandableBreadcrumb items={mockBreadcrumbItems} maxItems={5} />)

    // 不应该显示展开按钮
    expect(screen.queryByText('显示完整路径')).not.toBeInTheDocument()
  })
})

describe('Breadcrumb Accessibility', () => {
  it('should have proper ARIA labels', () => {
    render(<Breadcrumb items={mockBreadcrumbItems} />)

    // 应该有面包屑导航的aria-label
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', '面包屑导航')
  })

  it('should have proper button titles', () => {
    render(<Breadcrumb items={mockBreadcrumbItems} />)

    const hrButton = screen.getByText('人力资源')
    expect(hrButton).toHaveAttribute('title', '人力资源')
  })
})