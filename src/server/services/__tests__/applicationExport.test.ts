import { describe, it, expect, beforeEach } from '@jest/globals'
import { ApplicationExportService, type ExportApplicationData } from '@/lib/services/applicationExport'
import { ApplicationStatus, BusinessPurpose } from '@prisma/client'

describe('ApplicationExportService', () => {
  const mockApplicationData: ExportApplicationData[] = [
    {
      id: 'app-1',
      applicationNumber: 'DA-20240101-0001',
      status: ApplicationStatus.APPROVED,
      purpose: BusinessPurpose.DATA_ANALYSIS,
      reason: '需要进行季度数据分析报告',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      applicantName: '张三',
      department: 'IT部门',
      contactEmail: 'zhangsan@company.com',
      contactPhone: '13800138000',
      reviewComment: '申请理由充分，同意申请',
      reviewedAt: new Date('2024-01-02T10:00:00Z'),
      submittedAt: new Date('2024-01-01T14:00:00Z'),
      createdAt: new Date('2024-01-01T09:00:00Z'),
      updatedAt: new Date('2024-01-02T10:00:00Z'),
      asset: {
        id: 'asset-1',
        name: '用户行为数据表',
        description: '记录用户在系统中的行为数据',
        type: 'table',
        category: {
          id: 'cat-1',
          name: '用户数据',
        },
      },
      reviewer: {
        id: 'reviewer-1',
        name: '李四',
        email: 'lisi@company.com',
      },
    },
    {
      id: 'app-2',
      applicationNumber: 'DA-20240102-0001',
      status: ApplicationStatus.PENDING,
      purpose: BusinessPurpose.REPORT_CREATION,
      reason: '需要创建月度业务报表',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-28'),
      applicantName: '王五',
      department: '业务部门',
      contactEmail: 'wangwu@company.com',
      contactPhone: null,
      reviewComment: null,
      reviewedAt: null,
      submittedAt: new Date('2024-01-02T15:30:00Z'),
      createdAt: new Date('2024-01-02T14:00:00Z'),
      updatedAt: new Date('2024-01-02T15:30:00Z'),
      asset: {
        id: 'asset-2',
        name: '销售数据表',
        description: '记录产品销售相关数据',
        type: 'table',
        category: {
          id: 'cat-2',
          name: '业务数据',
        },
      },
      reviewer: null,
    },
  ]

  describe('exportToCSV', () => {
    it('应该成功导出CSV格式数据', async () => {
      const blob = await ApplicationExportService.exportToCSV(mockApplicationData)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/csv;charset=utf-8')

      // 读取CSV内容
      const csvContent = await blob.text()

      // 验证BOM和头部
      expect(csvContent).toMatch(/^\uFEFF/) // BOM
      expect(csvContent).toContain('申请编号,申请状态,状态说明')
      expect(csvContent).toContain('DA-20240101-0001')
      expect(csvContent).toContain('DA-20240102-0001')
      expect(csvContent).toContain('张三')
      expect(csvContent).toContain('王五')
    })

    it('应该正确处理包含逗号的字段', async () => {
      const dataWithCommas: ExportApplicationData[] = [
        {
          ...mockApplicationData[0],
          reason: '需要进行数据分析，包括用户行为、销售趋势等',
          applicantName: '张三,高级分析师',
        },
      ]

      const blob = await ApplicationExportService.exportToCSV(dataWithCommas)
      const csvContent = await blob.text()

      // 验证逗号被正确转义
      expect(csvContent).toContain('"需要进行数据分析，包括用户行为、销售趋势等"')
      expect(csvContent).toContain('"张三,高级分析师"')
    })

    it('应该支持进度回调', async () => {
      const progressCallbacks: { progress: number; status: string }[] = []

      await ApplicationExportService.exportToCSV(
        mockApplicationData,
        {},
        (progress, status) => {
          progressCallbacks.push({ progress, status })
        }
      )

      expect(progressCallbacks.length).toBeGreaterThan(0)
      expect(progressCallbacks[0].progress).toBe(10)
      expect(progressCallbacks[progressCallbacks.length - 1].progress).toBe(100)
    })

    it('应该支持字段筛选', async () => {
      const blob = await ApplicationExportService.exportToCSV(
        mockApplicationData,
        {
          includeFields: ['applicationNumber', 'status', 'applicantName']
        }
      )

      const csvContent = await blob.text()
      const lines = csvContent.split('\n')
      const headers = lines[0].replace(/^\uFEFF/, '').split(',')

      expect(headers).toHaveLength(3)
      expect(headers).toContain('申请编号')
      expect(headers).toContain('申请状态')
      expect(headers).toContain('申请人')
    })
  })

  describe('exportToExcel', () => {
    it('应该生成Excel格式的Blob', async () => {
      const blob = await ApplicationExportService.exportToExcel(mockApplicationData)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/vnd.ms-excel;charset=utf-8')
    })
  })

  describe('exportSelected', () => {
    it('应该只导出选中的申请记录', async () => {
      const selectedIds = ['app-1']
      const blob = await ApplicationExportService.exportSelected(
        selectedIds,
        mockApplicationData,
        { format: 'csv' }
      )

      const csvContent = await blob.text()

      expect(csvContent).toContain('DA-20240101-0001')
      expect(csvContent).not.toContain('DA-20240102-0001')
    })

    it('选中ID为空时应该抛出错误', async () => {
      await expect(
        ApplicationExportService.exportSelected(
          [],
          mockApplicationData,
          { format: 'csv' }
        )
      ).rejects.toThrow('没有选中任何申请记录')
    })
  })

  describe('generateFilename', () => {
    it('应该生成带时间戳的文件名', () => {
      const filename = ApplicationExportService.generateFilename('csv')

      expect(filename).toMatch(/^申请记录_\d{8}_\d{6}\.csv$/)
    })

    it('应该包含日期范围信息', () => {
      const filename = ApplicationExportService.generateFilename('csv', {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      })

      expect(filename).toContain('20240101至20240131')
    })

    it('应该包含记录数量信息', () => {
      const filename = ApplicationExportService.generateFilename('excel', {
        totalCount: 100
      })

      expect(filename).toContain('共100条')
      expect(filename).toEndWith('.xls')
    })
  })

  describe('getExportPreview', () => {
    it('应该返回正确的预览信息', () => {
      const preview = ApplicationExportService.getExportPreview(mockApplicationData)

      expect(preview.totalCount).toBe(2)
      expect(preview.statusBreakdown).toHaveProperty('已通过', 1)
      expect(preview.statusBreakdown).toHaveProperty('待审核', 1)
      expect(preview.purposeBreakdown).toHaveProperty('数据分析', 1)
      expect(preview.purposeBreakdown).toHaveProperty('报表制作', 1)
      expect(preview.dateRange).toBeDefined()
      expect(preview.estimatedFileSize).toMatch(/\d+\s+(Bytes|KB|MB)/)
    })

    it('空数据应该返回零值', () => {
      const preview = ApplicationExportService.getExportPreview([])

      expect(preview.totalCount).toBe(0)
      expect(preview.statusBreakdown).toEqual({})
      expect(preview.purposeBreakdown).toEqual({})
      expect(preview.dateRange).toBeNull()
      expect(preview.estimatedFileSize).toBe('0 KB')
    })
  })

  describe('private methods', () => {
    it('应该正确转义CSV值', () => {
      // 测试私有方法的功能通过公开方法间接测试
      const dataWithSpecialChars: ExportApplicationData[] = [
        {
          ...mockApplicationData[0],
          reason: '测试"引号"和\n换行符',
        },
      ]

      return expect(
        ApplicationExportService.exportToCSV(dataWithSpecialChars)
      ).resolves.toBeInstanceOf(Blob)
    })

    it('应该正确格式化文件大小', () => {
      // 通过预览功能间接测试
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockApplicationData[0],
        id: `app-${i}`,
        applicationNumber: `DA-20240101-${String(i).padStart(4, '0')}`,
      }))

      const preview = ApplicationExportService.getExportPreview(largeDataSet)

      expect(preview.estimatedFileSize).toMatch(/\d+(\.\d+)?\s+(KB|MB)/)
    })
  })
})