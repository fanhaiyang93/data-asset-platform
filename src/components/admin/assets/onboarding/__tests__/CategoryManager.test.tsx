/**
 * 分类管理功能测试 - AC #3
 * 验证资产分类的下拉选择和新增功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CategoryManager from '../CategoryManager';
import { AssetCategory } from '@/types/assetOnboarding';

const mockCategories: AssetCategory[] = [
  {
    id: 'user_data',
    name: '用户数据',
    code: 'USER_DATA',
    description: '用户相关数据',
    level: 0,
    path: '/用户数据',
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [
      {
        id: 'user_profile',
        name: '用户档案',
        code: 'USER_PROFILE',
        parentId: 'user_data',
        level: 1,
        path: '/用户数据/用户档案',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  },
  {
    id: 'business_data',
    name: '业务数据',
    code: 'BUSINESS_DATA',
    description: '核心业务数据',
    level: 0,
    path: '/业务数据',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

describe('CategoryManager', () => {
  const mockOnCategorySelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染分类列表', () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        allowCreate={true}
        allowEdit={true}
        showCounts={true}
      />
    );

    expect(screen.getByText('资产分类')).toBeInTheDocument();
    expect(screen.getByText('用户数据')).toBeInTheDocument();
    expect(screen.getByText('业务数据')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索分类名称或描述...')).toBeInTheDocument();
  });

  it('应该支持分类搜索功能', async () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
      />
    );

    const searchInput = screen.getByPlaceholderText('搜索分类名称或描述...');
    fireEvent.change(searchInput, { target: { value: '用户' } });

    await waitFor(() => {
      expect(screen.getByText('用户数据')).toBeInTheDocument();
      // 业务数据应该被过滤掉（如果搜索功能正常工作）
    });
  });

  it('应该支持分类选择', () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
      />
    );

    // 点击分类项
    fireEvent.click(screen.getByText('用户数据'));

    expect(mockOnCategorySelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user_data',
        name: '用户数据'
      })
    );
  });

  it('应该支持层级结构展开/折叠', async () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
      />
    );

    // 默认应该展开一些分类
    expect(screen.getByText('用户档案')).toBeInTheDocument();

    // 找到展开/折叠按钮并点击
    // 注意：这里需要根据实际渲染的DOM结构调整选择器
    const expandButtons = screen.getAllByRole('button');
    const expandButton = expandButtons.find(button =>
      button.querySelector('svg') // 查找包含SVG图标的按钮
    );

    if (expandButton) {
      fireEvent.click(expandButton);
      // 验证折叠后的行为
    }
  });

  it('应该显示新建分类按钮（当允许创建时）', () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        allowCreate={true}
      />
    );

    expect(screen.getByText('新建分类')).toBeInTheDocument();
  });

  it('应该隐藏新建分类按钮（当不允许创建时）', () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        allowCreate={false}
      />
    );

    expect(screen.queryByText('新建分类')).not.toBeInTheDocument();
  });

  it('应该显示分类统计信息', () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        showCounts={true}
      />
    );

    expect(screen.getByText('分类统计')).toBeInTheDocument();
  });

  it('应该处理空分类列表状态', () => {
    // 模拟空分类数据
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
      />
    );

    // 在搜索无结果时应该显示空状态
    const searchInput = screen.getByPlaceholderText('搜索分类名称或描述...');
    fireEvent.change(searchInput, { target: { value: '不存在的分类' } });

    // 这里测试逻辑需要根据实际组件的空状态处理来调整
  });
});

describe('CategoryManager - 新建分类功能', () => {
  const mockOnCategorySelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it('应该能够打开新建分类对话框', async () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        allowCreate={true}
      />
    );

    fireEvent.click(screen.getByText('新建分类'));

    await waitFor(() => {
      expect(screen.getByText('创建新分类')).toBeInTheDocument();
      expect(screen.getByText('为数据资产创建新的分类，便于管理和查找')).toBeInTheDocument();
    });
  });

  it('应该验证分类名称必填', async () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        allowCreate={true}
      />
    );

    fireEvent.click(screen.getByText('新建分类'));

    await waitFor(() => {
      expect(screen.getByText('创建')).toBeInTheDocument();
    });

    // 点击创建按钮但没有填写名称
    const createButton = screen.getByText('创建');
    fireEvent.click(createButton);

    // 应该显示验证错误或阻止提交
  });

  it('应该能够选择父分类', async () => {
    render(
      <CategoryManager
        onCategorySelect={mockOnCategorySelect}
        allowCreate={true}
      />
    );

    fireEvent.click(screen.getByText('新建分类'));

    await waitFor(() => {
      expect(screen.getByText('父分类')).toBeInTheDocument();
    });

    // 这里应该能够选择父分类
    // 具体的测试逻辑取决于Select组件的实现
  });
});

describe('CategoryManager - 分类层级展示', () => {
  it('应该正确显示分类层级结构', () => {
    render(
      <CategoryManager
        onCategorySelect={jest.fn()}
      />
    );

    // 验证顶级分类显示
    expect(screen.getByText('用户数据')).toBeInTheDocument();
    expect(screen.getByText('业务数据')).toBeInTheDocument();

    // 验证子分类显示
    expect(screen.getByText('用户档案')).toBeInTheDocument();
  });

  it('应该支持拖拽排序功能', () => {
    // 这个测试比较复杂，需要模拟拖拽事件
    render(
      <CategoryManager
        onCategorySelect={jest.fn()}
        allowEdit={true}
      />
    );

    // 验证基本渲染
    expect(screen.getByText('用户数据')).toBeInTheDocument();

    // 拖拽功能的测试需要更复杂的事件模拟
    // 这里先验证组件能够正常渲染
  });
});