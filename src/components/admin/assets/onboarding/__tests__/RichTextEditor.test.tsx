/**
 * 富文本编辑器测试 - AC #2
 * 验证富文本编辑器的功能和模板应用
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Tiptap Editor first
const mockEditor = {
  getHTML: jest.fn().mockReturnValue('<p>测试内容</p>'),
  getText: jest.fn().mockReturnValue('测试内容'),
  chain: jest.fn().mockReturnThis(),
  focus: jest.fn().mockReturnThis(),
  toggleBold: jest.fn().mockReturnThis(),
  toggleItalic: jest.fn().mockReturnThis(),
  toggleCode: jest.fn().mockReturnThis(),
  toggleHeading: jest.fn().mockReturnThis(),
  toggleBulletList: jest.fn().mockReturnThis(),
  toggleOrderedList: jest.fn().mockReturnThis(),
  toggleBlockquote: jest.fn().mockReturnThis(),
  setLink: jest.fn().mockReturnThis(),
  unsetLink: jest.fn().mockReturnThis(),
  undo: jest.fn().mockReturnThis(),
  redo: jest.fn().mockReturnThis(),
  setContent: jest.fn().mockReturnThis(),
  commands: {
    setContent: jest.fn()
  },
  can: jest.fn().mockReturnValue({
    undo: jest.fn().mockReturnValue(true),
    redo: jest.fn().mockReturnValue(true)
  }),
  isActive: jest.fn().mockReturnValue(false),
  getAttributes: jest.fn().mockReturnValue({ href: '' }),
  run: jest.fn()
};

jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn().mockReturnValue(mockEditor),
  EditorContent: ({ editor }: any) => (
    <div data-testid="editor-content">模拟编辑器内容</div>
  )
}));

import RichTextEditor from '../RichTextEditor';

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: jest.fn(() => true),
  writable: true,
});

describe('RichTextEditor', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染富文本编辑器', () => {
    render(
      <RichTextEditor
        content="<p>初始内容</p>"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    expect(screen.getByText('快速模板')).toBeInTheDocument();
    expect(screen.getByText('字数统计')).toBeInTheDocument();
  });

  it('应该显示工具栏按钮', () => {
    render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
      />
    );

    // 验证主要工具栏按钮存在
    expect(screen.getByRole('button', { name: /H1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /H2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /H3/i })).toBeInTheDocument();
  });

  it('应该支持模板应用', async () => {
    render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        templates={[
          { name: '测试模板', content: '<h3>测试标题</h3><p>测试内容</p>' }
        ]}
      />
    );

    // 点击模板按钮
    fireEvent.click(screen.getByText('测试模板'));

    // 验证编辑器设置内容被调用
    await waitFor(() => {
      expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<h3>测试标题</h3><p>测试内容</p>');
    });
  });

  it('应该正确显示字数统计', () => {
    mockEditor.getText.mockReturnValue('这是一个测试内容，用于验证字数统计功能');

    render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        maxLength={100}
        showWordCount={true}
      />
    );

    expect(screen.getByText(/字数统计/)).toBeInTheDocument();
  });

  it('应该在超出字数限制时显示警告', () => {
    mockEditor.getText.mockReturnValue('很长的测试内容'.repeat(20));

    render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        maxLength={50}
        showWordCount={true}
      />
    );

    expect(screen.getByText(/内容长度超出限制/)).toBeInTheDocument();
  });

  it('应该支持禁用状态', () => {
    render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        disabled={true}
      />
    );

    // 在禁用状态下，编辑器应该不可编辑
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('应该在模板应用前显示确认对话框', async () => {
    mockEditor.getText.mockReturnValue('现有内容');
    window.confirm = jest.fn().mockReturnValue(false);

    render(
      <RichTextEditor
        content="现有内容"
        onChange={mockOnChange}
        templates={[
          { name: '替换模板', content: '<p>新内容</p>' }
        ]}
      />
    );

    fireEvent.click(screen.getByText('替换模板'));

    expect(window.confirm).toHaveBeenCalledWith('当前内容将被模板替换，确定继续吗？');
  });
});

describe('RichTextEditor - 集成测试', () => {
  it('应该能够完成完整的富文本编辑流程', async () => {
    const mockOnChange = jest.fn();

    render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        placeholder="请输入资产描述..."
        maxLength={2000}
        showWordCount={true}
      />
    );

    // 1. 验证编辑器正确渲染
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();

    // 2. 验证模板功能
    expect(screen.getByText('基础描述模板')).toBeInTheDocument();
    expect(screen.getByText('业务表描述模板')).toBeInTheDocument();

    // 3. 应用模板
    fireEvent.click(screen.getByText('基础描述模板'));

    // 4. 验证工具栏功能可用
    const boldButton = screen.getByRole('button', { name: /H1/i });
    expect(boldButton).toBeEnabled();

    // 5. 验证字数统计显示
    expect(screen.getByText('字数统计')).toBeInTheDocument();
  });
});