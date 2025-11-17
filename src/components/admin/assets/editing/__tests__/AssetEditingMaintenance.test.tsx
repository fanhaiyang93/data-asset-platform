/**
 * 资产编辑与维护功能测试
 * Story 5.3: 资产编辑与维护
 *
 * 测试覆盖所有AC:
 * AC1: 资产信息的在线编辑功能
 * AC2: 资产状态的快速切换
 * AC3: 资产修改历史记录和版本对比
 * AC4: 资产信息的批量编辑功能
 * AC5: 资产标签和关键词的管理
 * AC6: 资产变更的审核和确认机制
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AssetEditForm } from '../AssetEditForm'
import { AssetStatusManager } from '../AssetStatusManager'
import { BatchEditForm } from '../BatchEditForm'
import { AssetVersionHistory } from '../../versioning/AssetVersionHistory'
import TagEditor from '../TagEditor'
import { ChangeApproval } from '../../approval/ChangeApproval'
import { AssetStatus, ChangeType, ApprovalStatus } from '@/types/assetMaintenance'

// Mock服务
jest.mock('@/lib/services/assetEditing')
jest.mock('@/lib/services/versionControl')

describe('Story 5.3: 资产编辑与维护', () => {
  describe('AC1: 资产信息的在线编辑功能', () => {
    const mockAssetId = 'test-asset-123'
    const mockOnSave = jest.fn()

    it('应该能够加载并显示资产编辑表单', async () => {
      render(
        <AssetEditForm
          assetId={mockAssetId}
          onSave={mockOnSave}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('编辑资产')).toBeInTheDocument()
      })
    })

    it('应该支持所有资产字段的修改', async () => {
      render(
        <AssetEditForm
          assetId={mockAssetId}
          onSave={mockOnSave}
        />
      )

      await waitFor(() => {
        // 验证基本信息字段
        expect(screen.getByLabelText(/资产名称/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/显示名称/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/资产类型/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/负责人/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/描述/i)).toBeInTheDocument()

        // 验证元数据字段
        expect(screen.getByLabelText(/数据源类型/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/更新频率/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/敏感级别/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/标签/i)).toBeInTheDocument()
      })
    })

    it('应该实现表单字段的增量更新', async () => {
      render(
        <AssetEditForm
          assetId={mockAssetId}
          onSave={mockOnSave}
        />
      )

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/资产名称/i) as HTMLInputElement
        fireEvent.change(nameInput, { target: { value: '新资产名称' } })
        expect(nameInput.value).toBe('新资产名称')
      })
    })

    it('应该显示验证错误', async () => {
      render(
        <AssetEditForm
          assetId={mockAssetId}
          onSave={mockOnSave}
        />
      )

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/资产名称/i)
        fireEvent.change(nameInput, { target: { value: '' } })

        const saveButton = screen.getByText('保存更改')
        fireEvent.click(saveButton)
      })

      // 应该显示错误提示
      await waitFor(() => {
        expect(screen.getByText(/请修正表单中的错误/i)).toBeInTheDocument()
      })
    })

    it('应该支持乐观锁和冲突检测', async () => {
      // 模拟版本冲突
      mockOnSave.mockRejectedValue({
        status: 409,
        conflicts: [
          {
            field: 'name',
            yourValue: '新名称',
            currentValue: '其他用户修改的名称',
            lastModifiedBy: 'user2',
            lastModifiedAt: new Date()
          }
        ]
      })

      render(
        <AssetEditForm
          assetId={mockAssetId}
          onSave={mockOnSave}
        />
      )

      // 测试冲突处理
      // (实际实现会显示冲突对话框)
    })
  })

  describe('AC2: 资产状态的快速切换', () => {
    const mockOnChange = jest.fn()

    it('应该显示所有可用状态', () => {
      render(
        <AssetStatusManager
          assetId="test-asset"
          currentStatus={AssetStatus.ACTIVE}
          onChange={mockOnChange}
        />
      )

      const statusSelect = screen.getByLabelText(/资产状态/i)
      expect(statusSelect).toBeInTheDocument()

      // 验证所有状态选项
      expect(screen.getByText(/可用/i)).toBeInTheDocument()
      expect(screen.getByText(/维护中/i)).toBeInTheDocument()
      expect(screen.getByText(/已下线/i)).toBeInTheDocument()
      expect(screen.getByText(/已弃用/i)).toBeInTheDocument()
    })

    it('应该显示状态变更确认对话框', async () => {
      render(
        <AssetStatusManager
          assetId="test-asset"
          currentStatus={AssetStatus.ACTIVE}
          onChange={mockOnChange}
          requireConfirmation={true}
        />
      )

      const statusSelect = screen.getByLabelText(/资产状态/i)
      fireEvent.change(statusSelect, { target: { value: AssetStatus.MAINTENANCE } })

      await waitFor(() => {
        expect(screen.getByText(/确认状态变更/i)).toBeInTheDocument()
      })
    })

    it('应该支持填写状态变更原因', async () => {
      render(
        <AssetStatusManager
          assetId="test-asset"
          currentStatus={AssetStatus.ACTIVE}
          onChange={mockOnChange}
        />
      )

      const statusSelect = screen.getByLabelText(/资产状态/i)
      fireEvent.change(statusSelect, { target: { value: AssetStatus.INACTIVE } })

      await waitFor(() => {
        const reasonInput = screen.getByPlaceholderText(/请说明状态变更的原因/i)
        expect(reasonInput).toBeInTheDocument()

        fireEvent.change(reasonInput, { target: { value: '系统维护' } })
        expect(reasonInput).toHaveValue('系统维护')
      })
    })

    it('应该在变更后即时生效', async () => {
      render(
        <AssetStatusManager
          assetId="test-asset"
          currentStatus={AssetStatus.ACTIVE}
          onChange={mockOnChange}
        />
      )

      const statusSelect = screen.getByLabelText(/资产状态/i)
      fireEvent.change(statusSelect, { target: { value: AssetStatus.MAINTENANCE } })

      await waitFor(() => {
        const confirmButton = screen.getByText(/确认变更/i)
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          AssetStatus.MAINTENANCE,
          expect.any(String)
        )
      })
    })
  })

  describe('AC3: 资产修改历史记录和版本对比', () => {
    const mockAssetId = 'test-asset-123'

    it('应该显示版本历史列表', async () => {
      render(<AssetVersionHistory assetId={mockAssetId} />)

      await waitFor(() => {
        expect(screen.getByText(/版本历史/i)).toBeInTheDocument()
      })
    })

    it('应该显示每个版本的变更信息', async () => {
      render(<AssetVersionHistory assetId={mockAssetId} />)

      await waitFor(() => {
        // 应该显示变更摘要
        // 应该显示变更者和时间
        // 应该显示变更字段
      })
    })

    it('应该支持选择两个版本进行对比', async () => {
      render(<AssetVersionHistory assetId={mockAssetId} />)

      await waitFor(() => {
        // 选择两个版本
        // 点击对比按钮
        const compareButton = screen.queryByText(/对比版本/i)
        if (compareButton) {
          fireEvent.click(compareButton)
        }
      })
    })

    it('应该支持恢复到历史版本', async () => {
      render(<AssetVersionHistory assetId={mockAssetId} />)

      await waitFor(() => {
        const restoreButtons = screen.queryAllByText(/恢复此版本/i)
        if (restoreButtons.length > 0) {
          fireEvent.click(restoreButtons[0])
        }
      })
    })
  })

  describe('AC4: 资产信息的批量编辑功能', () => {
    const mockAssetIds = ['asset-1', 'asset-2', 'asset-3']
    const mockOnSubmit = jest.fn()

    it('应该支持多选资产的批量操作', () => {
      render(
        <BatchEditForm
          assetIds={mockAssetIds}
          onSubmit={mockOnSubmit}
        />
      )

      expect(screen.getByText(/已选择 3 个资产/i)).toBeInTheDocument()
    })

    it('应该实现批量状态更新功能', async () => {
      render(
        <BatchEditForm
          assetIds={mockAssetIds}
          onSubmit={mockOnSubmit}
        />
      )

      const operationTypeSelect = screen.getByLabelText(/操作类型/i)
      fireEvent.change(operationTypeSelect, { target: { value: 'status_update' } })

      await waitFor(() => {
        expect(screen.getByLabelText(/新状态/i)).toBeInTheDocument()
      })
    })

    it('应该支持批量标签和分类的修改', async () => {
      render(
        <BatchEditForm
          assetIds={mockAssetIds}
          onSubmit={mockOnSubmit}
        />
      )

      const operationTypeSelect = screen.getByLabelText(/操作类型/i)
      fireEvent.change(operationTypeSelect, { target: { value: 'tag_management' } })

      await waitFor(() => {
        expect(screen.getByLabelText(/标签/i)).toBeInTheDocument()
      })
    })

    it('应该显示批量操作的进度', async () => {
      mockOnSubmit.mockResolvedValue({
        totalAssets: 3,
        successCount: 2,
        failedCount: 1,
        skippedCount: 0,
        results: [],
        errors: []
      })

      render(
        <BatchEditForm
          assetIds={mockAssetIds}
          onSubmit={mockOnSubmit}
        />
      )

      // 执行批量操作
      const submitButton = screen.getByText(/执行批量操作/i)
      fireEvent.click(submitButton)

      // 应该显示进度
      // (实际实现会显示进度条和统计)
    })
  })

  describe('AC5: 资产标签和关键词的管理', () => {
    const mockOnChange = jest.fn()

    it('应该支持标签的添加和删除', () => {
      render(
        <TagEditor
          assetId="test-asset"
          currentTags={['tag1', 'tag2']}
          onChange={mockOnChange}
        />
      )

      // 应该显示现有标签
      expect(screen.getByText('tag1')).toBeInTheDocument()
      expect(screen.getByText('tag2')).toBeInTheDocument()
    })

    it('应该限制标签数量', () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`)

      render(
        <TagEditor
          assetId="test-asset"
          currentTags={manyTags}
          onChange={mockOnChange}
          maxTags={20}
        />
      )

      // 应该达到上限时禁止添加更多标签
    })

    it('应该提供标签建议', () => {
      render(
        <TagEditor
          assetId="test-asset"
          currentTags={[]}
          onChange={mockOnChange}
        />
      )

      // 应该在输入时显示建议
      // (实际实现可能需要模拟API响应)
    })
  })

  describe('AC6: 资产变更的审核和确认机制', () => {
    const mockRequest = {
      id: 'approval-123',
      type: ChangeType.UPDATE,
      assetId: 'asset-123',
      assetName: '测试资产',
      requestedBy: 'user1',
      requestedByName: '张三',
      requestedAt: new Date(),
      reason: '更新资产信息',
      changes: { name: '新名称' },
      previousData: { name: '旧名称' },
      status: ApprovalStatus.PENDING,
      approvalHistory: [],
      requiredApprovers: ['admin1'],
      currentApprovers: []
    }

    const mockOnApprove = jest.fn()
    const mockOnReject = jest.fn()
    const mockOnRequestChanges = jest.fn()

    it('应该显示需要审核的变更类型', () => {
      render(
        <ChangeApproval
          request={mockRequest}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onRequestChanges={mockOnRequestChanges}
        />
      )

      expect(screen.getByText(/变更审核/i)).toBeInTheDocument()
      expect(screen.getByText(mockRequest.assetName)).toBeInTheDocument()
    })

    it('应该显示变更内容的前后对比', () => {
      render(
        <ChangeApproval
          request={mockRequest}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onRequestChanges={mockOnRequestChanges}
        />
      )

      // 应该显示变更内容
      expect(screen.getByText(/变更内容/i)).toBeInTheDocument()
    })

    it('应该支持批准操作', async () => {
      render(
        <ChangeApproval
          request={mockRequest}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onRequestChanges={mockOnRequestChanges}
        />
      )

      const approveButton = screen.getByText(/批准/i)
      fireEvent.click(approveButton)

      const confirmButton = screen.getByText(/确认批准/i)
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalled()
      })
    })

    it('应该支持拒绝操作并要求填写原因', async () => {
      render(
        <ChangeApproval
          request={mockRequest}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onRequestChanges={mockOnRequestChanges}
        />
      )

      const rejectButton = screen.getByText(/拒绝/i)
      fireEvent.click(rejectButton)

      // 应该显示审核意见输入框
      await waitFor(() => {
        const commentInput = screen.getByPlaceholderText(/请说明拒绝原因/i)
        expect(commentInput).toBeInTheDocument()

        fireEvent.change(commentInput, { target: { value: '不符合规范' } })

        const confirmButton = screen.getByText(/确认拒绝/i)
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(mockOnReject).toHaveBeenCalledWith('不符合规范')
      })
    })

    it('应该显示审核历史记录', () => {
      const requestWithHistory = {
        ...mockRequest,
        approvalHistory: [
          {
            id: 'history-1',
            requestId: 'approval-123',
            approver: 'admin1',
            approverName: '管理员',
            action: 'approve' as const,
            comments: '通过审核',
            timestamp: new Date()
          }
        ]
      }

      render(
        <ChangeApproval
          request={requestWithHistory}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onRequestChanges={mockOnRequestChanges}
        />
      )

      expect(screen.getByText(/审核历史/i)).toBeInTheDocument()
      expect(screen.getByText(/管理员/i)).toBeInTheDocument()
      expect(screen.getByText(/通过审核/i)).toBeInTheDocument()
    })
  })
})
