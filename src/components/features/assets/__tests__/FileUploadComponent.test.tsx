import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import FileUploadComponent from '../FileUploadComponent'

const mockOnFileUpload = jest.fn()
const mockOnFileDelete = jest.fn()
const mockOnFileView = jest.fn()
const mockOnFileDownload = jest.fn()

describe('FileUploadComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染文件上传组件', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          onFileUpload={mockOnFileUpload}
        />
      )

      expect(screen.getByText('文档管理')).toBeInTheDocument()
      expect(screen.getByText('拖拽文件到此处或')).toBeInTheDocument()
      expect(screen.getByText('选择文件')).toBeInTheDocument()
    })

    it('应该显示文件数量限制', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          maxFiles={5}
          onFileUpload={mockOnFileUpload}
        />
      )

      expect(screen.getByText('0/5')).toBeInTheDocument()
    })

    it('应该在禁用状态下隐藏上传区域', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          disabled={true}
          onFileUpload={mockOnFileUpload}
        />
      )

      expect(screen.queryByText('拖拽文件到此处或')).not.toBeInTheDocument()
    })
  })

  describe('文件验证', () => {
    it('应该验证文件大小限制', async () => {
      const user = userEvent.setup()
      render(
        <FileUploadComponent
          assetId="test-asset"
          maxFileSize={1024} // 1KB限制
          onFileUpload={mockOnFileUpload}
        />
      )

      // 创建一个超大文件
      const file = new File(['x'.repeat(2048)], 'large-file.pdf', {
        type: 'application/pdf'
      })

      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement

      // 模拟文件选择
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      })

      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText(/文件大小超出限制/)).toBeInTheDocument()
      })
    })

    it('应该验证文件类型', async () => {
      const user = userEvent.setup()
      render(
        <FileUploadComponent
          assetId="test-asset"
          allowedTypes={['application/pdf']}
          onFileUpload={mockOnFileUpload}
        />
      )

      // 创建不支持的文件类型
      const file = new File(['content'], 'test.exe', {
        type: 'application/x-executable'
      })

      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      })

      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText(/文件类型不支持/)).toBeInTheDocument()
      })
    })

    it('应该验证文件数量限制', async () => {
      const user = userEvent.setup()
      render(
        <FileUploadComponent
          assetId="test-asset"
          maxFiles={1}
          existingFiles={[{
            id: 'existing-1',
            name: 'existing.pdf',
            size: 1024,
            type: 'application/pdf',
            uploadedAt: new Date(),
            status: 'completed'
          }]}
          onFileUpload={mockOnFileUpload}
        />
      )

      const file = new File(['content'], 'new-file.pdf', {
        type: 'application/pdf'
      })

      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      })

      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText(/最多只能上传 1 个文件/)).toBeInTheDocument()
      })
    })
  })

  describe('拖拽功能', () => {
    it('应该支持拖拽上传', async () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          onFileUpload={mockOnFileUpload}
        />
      )

      const dropZone = screen.getByText('拖拽文件到此处或').closest('div')!

      // 模拟拖拽进入
      fireEvent.dragOver(dropZone, {
        dataTransfer: {
          files: []
        }
      })

      // 验证拖拽状态
      expect(dropZone).toHaveClass('border-primary')

      // 模拟拖拽离开
      fireEvent.dragLeave(dropZone)

      // 验证拖拽状态重置
      expect(dropZone).not.toHaveClass('border-primary')
    })

    it('应该处理文件拖拽放置', async () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          onFileUpload={mockOnFileUpload}
        />
      )

      const file = new File(['content'], 'dropped-file.pdf', {
        type: 'application/pdf'
      })

      const dropZone = screen.getByText('拖拽文件到此处或').closest('div')!

      // 模拟文件放置
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      })

      // 等待文件处理完成
      await waitFor(() => {
        expect(screen.getByText('dropped-file.pdf')).toBeInTheDocument()
      })
    })
  })

  describe('现有文件显示', () => {
    const existingFiles = [
      {
        id: 'file-1',
        name: 'document.pdf',
        size: 1024000,
        type: 'application/pdf',
        uploadedAt: new Date('2023-01-01'),
        status: 'completed' as const,
        url: 'https://example.com/file-1'
      },
      {
        id: 'file-2',
        name: 'spreadsheet.xlsx',
        size: 2048000,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedAt: new Date('2023-01-02'),
        status: 'completed' as const,
        url: 'https://example.com/file-2'
      }
    ]

    it('应该显示现有文件列表', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          existingFiles={existingFiles}
          onFileUpload={mockOnFileUpload}
        />
      )

      expect(screen.getByText('document.pdf')).toBeInTheDocument()
      expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument()
      expect(screen.getByText('已上传文件')).toBeInTheDocument()
    })

    it('应该显示正确的文件信息', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          existingFiles={existingFiles}
          onFileUpload={mockOnFileUpload}
        />
      )

      // 验证文件大小格式化
      expect(screen.getByText(/1000 KB/)).toBeInTheDocument()
      expect(screen.getByText(/2000 KB/)).toBeInTheDocument()

      // 验证文件类型
      expect(screen.getByText('PDF文档')).toBeInTheDocument()
      expect(screen.getByText('Excel表格')).toBeInTheDocument()

      // 验证上传日期
      expect(screen.getByText(/2023\/1\/1/)).toBeInTheDocument()
      expect(screen.getByText(/2023\/1\/2/)).toBeInTheDocument()
    })

    it('应该显示文件操作按钮', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          existingFiles={existingFiles}
          onFileUpload={mockOnFileUpload}
          onFileView={mockOnFileView}
          onFileDownload={mockOnFileDownload}
          onFileDelete={mockOnFileDelete}
        />
      )

      // 验证操作按钮存在
      const viewButtons = screen.getAllByTitle('预览文件')
      const downloadButtons = screen.getAllByTitle('下载文件')
      const deleteButtons = screen.getAllByTitle('删除文件')

      expect(viewButtons).toHaveLength(2)
      expect(downloadButtons).toHaveLength(2)
      expect(deleteButtons).toHaveLength(2)
    })
  })

  describe('文件操作', () => {
    const existingFiles = [
      {
        id: 'file-1',
        name: 'document.pdf',
        size: 1024000,
        type: 'application/pdf',
        uploadedAt: new Date('2023-01-01'),
        status: 'completed' as const,
        url: 'https://example.com/file-1'
      }
    ]

    it('应该处理文件预览', async () => {
      const user = userEvent.setup()
      render(
        <FileUploadComponent
          assetId="test-asset"
          existingFiles={existingFiles}
          onFileView={mockOnFileView}
        />
      )

      const viewButton = screen.getByTitle('预览文件')
      await user.click(viewButton)

      expect(mockOnFileView).toHaveBeenCalledWith(existingFiles[0])
    })

    it('应该处理文件下载', async () => {
      const user = userEvent.setup()
      render(
        <FileUploadComponent
          assetId="test-asset"
          existingFiles={existingFiles}
          onFileDownload={mockOnFileDownload}
        />
      )

      const downloadButton = screen.getByTitle('下载文件')
      await user.click(downloadButton)

      expect(mockOnFileDownload).toHaveBeenCalledWith(existingFiles[0])
    })

    it('应该处理文件删除', async () => {
      const user = userEvent.setup()
      mockOnFileDelete.mockResolvedValue(undefined)

      render(
        <FileUploadComponent
          assetId="test-asset"
          existingFiles={existingFiles}
          onFileDelete={mockOnFileDelete}
        />
      )

      const deleteButton = screen.getByTitle('删除文件')
      await user.click(deleteButton)

      expect(mockOnFileDelete).toHaveBeenCalledWith('file-1')

      await waitFor(() => {
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument()
      })
    })
  })

  describe('上传状态', () => {
    it('应该显示上传进度', async () => {
      const user = userEvent.setup()
      render(
        <FileUploadComponent
          assetId="test-asset"
          onFileUpload={mockOnFileUpload}
        />
      )

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf'
      })

      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      })

      await user.upload(input, file)

      // 验证上传中状态
      await waitFor(() => {
        expect(screen.getByText('上传中...')).toBeInTheDocument()
      })

      // 等待上传完成
      await waitFor(() => {
        expect(screen.queryByText('上传中...')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('应该处理上传错误', async () => {
      const user = userEvent.setup()
      mockOnFileUpload.mockRejectedValue(new Error('上传失败'))

      render(
        <FileUploadComponent
          assetId="test-asset"
          onFileUpload={mockOnFileUpload}
        />
      )

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf'
      })

      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      })

      await user.upload(input, file)

      // 等待错误显示
      await waitFor(() => {
        expect(screen.getByText(/上传失败/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('使用说明', () => {
    it('应该显示使用说明', () => {
      render(
        <FileUploadComponent
          assetId="test-asset"
          maxFileSize={5 * 1024 * 1024}
          maxFiles={20}
          onFileUpload={mockOnFileUpload}
        />
      )

      expect(screen.getByText(/支持的文件格式/)).toBeInTheDocument()
      expect(screen.getByText(/单个文件最大：5 MB/)).toBeInTheDocument()
      expect(screen.getByText(/最多可上传：20 个文件/)).toBeInTheDocument()
      expect(screen.getByText(/安全扫描和权限控制/)).toBeInTheDocument()
    })
  })
})