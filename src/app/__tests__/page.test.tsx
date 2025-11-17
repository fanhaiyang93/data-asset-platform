import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import HomePage from '../page';
import { useAuth } from '@/hooks/useAuth';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/SessionTimeoutWarning', () => {
  return function MockSessionTimeoutWarning() {
    return <div data-testid="session-timeout-warning">SessionTimeoutWarning</div>;
  };
});

jest.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

jest.mock('@/components/common/CategoryCard', () => ({
  CategoryCard: ({ config, onClick }: any) => (
    <div data-testid={`category-card-${config.id}`} onClick={onClick}>
      {config.title}
    </div>
  ),
  PREDEFINED_CATEGORIES: {
    hr: { id: 'hr', title: 'HR', icon: null, gradient: '' },
    finance: { id: 'finance', title: 'Finance', icon: null, gradient: '' },
    legal: { id: 'legal', title: 'Legal', icon: null, gradient: '' },
  },
}));

describe('HomePage - Hero Search Area (UX-1)', () => {
  const mockPush = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue({
      user: { username: 'Test User', email: 'test@example.com', role: 'BUSINESS_USER' },
      isLoading: false,
      isAuthenticated: true,
      logout: mockLogout,
    });
  });

  describe('AC1: Hero区域大搜索框', () => {
    it('should render Hero area with search box', () => {
      render(<HomePage />);

      // 验证标题存在
      expect(screen.getByText('数据资产管理平台')).toBeInTheDocument();
      expect(screen.getByText('快速发现和申请企业数据资产')).toBeInTheDocument();

      // 验证搜索框存在
      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should have 64px height search box', () => {
      render(<HomePage />);

      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      expect(searchInput).toHaveStyle({ height: '64px' });
    });

    it('should have search icon prefix and search button suffix', () => {
      render(<HomePage />);

      // 验证搜索按钮存在
      const searchButton = screen.getByRole('button', { name: /搜索/i });
      expect(searchButton).toBeInTheDocument();
    });
  });

  describe('AC2: 实时搜索建议', () => {
    it('should show search suggestions when input >= 2 characters', async () => {
      render(<HomePage />);

      const searchInput = screen.getByPlaceholderText('搜索数据资产...');

      // 输入少于2个字符,不显示建议
      await userEvent.type(searchInput, '员');
      await waitFor(() => {
        expect(screen.queryByText('员工信息')).not.toBeInTheDocument();
      });

      // 输入2个字符,显示建议
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, '员工');
      await waitFor(() => {
        expect(screen.getByText('员工信息')).toBeInTheDocument();
      });
    });

    it('should navigate to search page when suggestion is selected', async () => {
      render(<HomePage />);

      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      await userEvent.type(searchInput, '员工');

      await waitFor(() => {
        const suggestion = screen.getByText('员工信息');
        expect(suggestion).toBeInTheDocument();
      });

      const suggestion = screen.getByText('员工信息');
      fireEvent.click(suggestion);

      expect(mockPush).toHaveBeenCalledWith('/search?q=%E5%91%98%E5%B7%A5%E4%BF%A1%E6%81%AF');
    });
  });

  describe('AC3: 热门搜索标签', () => {
    it('should render 5 hot search tags', () => {
      render(<HomePage />);

      const expectedTags = ['员工信息', '财务报表', '合同数据', '考勤记录', '薪酬数据'];

      expectedTags.forEach((tag) => {
        expect(screen.getByText(tag, { exact: false })).toBeInTheDocument();
      });
    });

    it('should navigate to search page when tag is clicked', () => {
      render(<HomePage />);

      const tag = screen.getByText('员工信息', { exact: false });
      fireEvent.click(tag);

      expect(mockPush).toHaveBeenCalledWith('/search?q=%E5%91%98%E5%B7%A5%E4%BF%A1%E6%81%AF');
    });

    it('should have hover effect on tags', () => {
      render(<HomePage />);

      const tag = screen.getByText('员工信息', { exact: false });
      expect(tag).toHaveStyle({ cursor: 'pointer' });
    });
  });

  describe('AC4: 搜索提交功能', () => {
    it('should submit search when search button is clicked', async () => {
      render(<HomePage />);

      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      await userEvent.type(searchInput, '测试查询');

      const searchButton = screen.getByRole('button', { name: /搜索/i });
      fireEvent.click(searchButton);

      expect(mockPush).toHaveBeenCalledWith('/search?q=%E6%B5%8B%E8%AF%95%E6%9F%A5%E8%AF%A2');
    });

    it('should submit search when Enter key is pressed', async () => {
      render(<HomePage />);

      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      await userEvent.type(searchInput, '测试查询{Enter}');

      expect(mockPush).toHaveBeenCalledWith('/search?q=%E6%B5%8B%E8%AF%95%E6%9F%A5%E8%AF%A2');
    });

    it('should not submit search with empty query', async () => {
      render(<HomePage />);

      const searchButton = screen.getByRole('button', { name: /搜索/i });
      fireEvent.click(searchButton);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('AC5: 统计卡片精简', () => {
    it('should render exactly 3 statistics cards', () => {
      render(<HomePage />);

      // 验证3个统计卡片存在
      expect(screen.getByText('数据资产总数')).toBeInTheDocument();
      expect(screen.getByText('本周新增')).toBeInTheDocument();
      expect(screen.getByText('活跃用户')).toBeInTheDocument();

      // 验证"快速搜索"卡片不存在
      expect(screen.queryByText('快速搜索')).not.toBeInTheDocument();
    });
  });

  describe('AC6: 响应式设计', () => {
    it('should have max-width 900px for search box container', () => {
      render(<HomePage />);

      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      const container = searchInput.closest('div');

      expect(container).toHaveStyle({ maxWidth: '900px' });
    });
  });

  describe('Authentication Flow', () => {
    it('should show loading spinner when loading', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        logout: mockLogout,
      });

      render(<HomePage />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        logout: mockLogout,
      });

      render(<HomePage />);

      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full search flow from input to navigation', async () => {
      render(<HomePage />);

      // 1. 输入搜索词
      const searchInput = screen.getByPlaceholderText('搜索数据资产...');
      await userEvent.type(searchInput, '员工');

      // 2. 等待搜索建议出现
      await waitFor(() => {
        expect(screen.getByText('员工信息')).toBeInTheDocument();
      });

      // 3. 选择建议
      const suggestion = screen.getByText('员工信息');
      fireEvent.click(suggestion);

      // 4. 验证导航
      expect(mockPush).toHaveBeenCalledWith('/search?q=%E5%91%98%E5%B7%A5%E4%BF%A1%E6%81%AF');
    });

    it('should allow quick search via hot tags', () => {
      render(<HomePage />);

      // 点击热门标签
      const tag = screen.getByText('财务报表', { exact: false });
      fireEvent.click(tag);

      // 验证导航
      expect(mockPush).toHaveBeenCalledWith('/search?q=%E8%B4%A2%E5%8A%A1%E6%8A%A5%E8%A1%A8');
    });
  });
});
