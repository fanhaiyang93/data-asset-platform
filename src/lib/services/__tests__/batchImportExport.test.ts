/**
 * 批量导入导出服务测试
 * Story 5.6: 批量操作工具
 *
 * 测试批量导入导出功能
 */

import { describe, it, expect } from '@jest/globals'
import { BatchImportExportService } from '../batchImportExport'
import { BatchOperationStatus } from '@/types/batchOperations'

describe('BatchImportExportService', () => {
  describe('getImportTemplate', () => {
    it('应该获取基础导入模板', () => {
      const template = BatchImportExportService.getImportTemplate('basic')

      expect(template).toHaveProperty('id')
      expect(template).toHaveProperty('name')
      expect(template).toHaveProperty('requiredFields')
      expect(template).toHaveProperty('optionalFields')
      expect(template).toHaveProperty('validationRules')
      expect(template).toHaveProperty('sampleData')
    })

    it('应该获取详细导入模板', () => {
      const template = BatchImportExportService.getImportTemplate('detailed')

      expect(template.name).toContain('详细')
      expect(template.requiredFields.length).toBeGreaterThan(0)
    })

    it('模板应该包含必填字段', () => {
      const template = BatchImportExportService.getImportTemplate('basic')

      const requiredFieldNames = template.requiredFields.map((f) => f.name)
      expect(requiredFieldNames).toContain('name')
      expect(requiredFieldNames).toContain('category')
      expect(requiredFieldNames).toContain('owner')
    })
  })

  describe('generateImportTemplate', () => {
    it('应该生成模板文件', async () => {
      const blob = await BatchImportExportService.generateImportTemplate('basic')

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/csv')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('模板文件应该包含标题行和示例数据', async () => {
      const blob = await BatchImportExportService.generateImportTemplate('basic')
      const text = await blob.text()

      const lines = text.split('\n')
      expect(lines.length).toBeGreaterThanOrEqual(2) // 至少包含标题行和一行示例数据
    })
  })

  describe('importAssets', () => {
    // 创建模拟文件
    const createMockFile = (content: string, name: string = 'test.csv'): File => {
      const blob = new Blob([content], { type: 'text/csv' })
      return new File([blob], name, { type: 'text/csv' })
    }

    it('应该成功导入有效数据', async () => {
      const template = BatchImportExportService.getImportTemplate('basic')
      const mockFile = createMockFile('name,category,owner\nasset1,表,user@test.com')

      const result = await BatchImportExportService.importAssets({
        file: mockFile,
        template,
        skipDuplicates: false,
        updateExisting: false,
        validateOnly: false,
        userId: 'user-1'
      })

      expect(result).toHaveProperty('operationId')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('totalRows')
      expect(result).toHaveProperty('validRows')
      expect(result).toHaveProperty('invalidRows')
      expect(result).toHaveProperty('importedRows')
    })

    it('验证模式应该只返回预览', async () => {
      const template = BatchImportExportService.getImportTemplate('basic')
      const mockFile = createMockFile('name,category,owner\nasset1,表,user@test.com')

      const result = await BatchImportExportService.importAssets({
        file: mockFile,
        template,
        skipDuplicates: false,
        updateExisting: false,
        validateOnly: true,
        userId: 'user-1'
      })

      expect(result.importedRows).toBe(0)
      expect(result.preview).toBeDefined()
      expect(result.preview?.sampleValidRows).toBeDefined()
      expect(result.preview?.sampleInvalidRows).toBeDefined()
    })

    it('应该报告验证错误', async () => {
      const template = BatchImportExportService.getImportTemplate('basic')
      const mockFile = createMockFile('invalid data')

      const result = await BatchImportExportService.importAssets({
        file: mockFile,
        template,
        skipDuplicates: false,
        updateExisting: false,
        validateOnly: true,
        userId: 'user-1'
      })

      expect(result.errors).toBeDefined()
      if (result.errors.length > 0) {
        expect(result.errors[0]).toHaveProperty('row')
        expect(result.errors[0]).toHaveProperty('error')
      }
    })
  })

  describe('exportAssets', () => {
    it('应该导出CSV格式', async () => {
      const assetIds = ['asset-1', 'asset-2', 'asset-3']

      const result = await BatchImportExportService.exportAssets({
        assetIds,
        format: 'csv',
        includeFields: ['name', 'category', 'owner'],
        includeMetadata: false,
        userId: 'user-1'
      })

      expect(result.status).toBe(BatchOperationStatus.COMPLETED)
      expect(result.format).toBe('csv')
      expect(result.fileUrl).toBeTruthy()
      expect(result.fileName).toContain('.csv')
    })

    it('应该导出Excel格式', async () => {
      const assetIds = ['asset-1', 'asset-2']

      const result = await BatchImportExportService.exportAssets({
        assetIds,
        format: 'excel',
        includeFields: [],
        includeMetadata: false,
        userId: 'user-1'
      })

      expect(result.format).toBe('excel')
      expect(result.fileName).toContain('.xlsx')
    })

    it('应该导出JSON格式', async () => {
      const assetIds = ['asset-1', 'asset-2']

      const result = await BatchImportExportService.exportAssets({
        assetIds,
        format: 'json',
        includeFields: [],
        includeMetadata: true,
        userId: 'user-1'
      })

      expect(result.format).toBe('json')
      expect(result.fileName).toContain('.json')
    })

    it('应该设置文件过期时间', async () => {
      const result = await BatchImportExportService.exportAssets({
        assetIds: ['asset-1'],
        format: 'csv',
        includeFields: [],
        includeMetadata: false,
        userId: 'user-1'
      })

      expect(result.expiresAt).toBeDefined()
      expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now())
    })

    it('导出项目数应该正确', async () => {
      const assetIds = ['asset-1', 'asset-2', 'asset-3']

      const result = await BatchImportExportService.exportAssets({
        assetIds,
        format: 'csv',
        includeFields: [],
        includeMetadata: false,
        userId: 'user-1'
      })

      expect(result.exportedItems).toBe(assetIds.length)
    })
  })

  describe('previewImportData', () => {
    const createMockFile = (content: string): File => {
      const blob = new Blob([content], { type: 'text/csv' })
      return new File([blob], 'test.csv', { type: 'text/csv' })
    }

    it('应该预览导入数据', async () => {
      const template = BatchImportExportService.getImportTemplate('basic')
      const mockFile = createMockFile('name,category,owner\nasset1,表,user@test.com')

      const preview = await BatchImportExportService.previewImportData(mockFile, template)

      expect(preview).toHaveProperty('totalRows')
      expect(preview).toHaveProperty('validRows')
      expect(preview).toHaveProperty('invalidRows')
      expect(preview).toHaveProperty('sampleValidRows')
      expect(preview).toHaveProperty('sampleInvalidRows')
    })

    it('示例数据应该最多5行', async () => {
      const template = BatchImportExportService.getImportTemplate('basic')
      const mockFile = createMockFile('name,category,owner\nasset1,表,user@test.com')

      const preview = await BatchImportExportService.previewImportData(mockFile, template)

      expect(preview.sampleValidRows.length).toBeLessThanOrEqual(5)
      expect(preview.sampleInvalidRows.length).toBeLessThanOrEqual(5)
    })
  })
})
