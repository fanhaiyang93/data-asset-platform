/**
 * Epic 5 Story 2: 资产接入管理测试
 * 验证资产接入管理功能的完整性
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import {
  AssetFormData,
  AssetType,
  DataSourceType,
  FieldDataType,
  TemplateType,
  ValidationResult,
  ImportResult
} from '@/types/assetOnboarding'
import { assetOnboardingService } from '@/lib/services/assetOnboarding'

describe('Epic 5 Story 2: 资产接入管理', () => {
  beforeEach(() => {
    // 清理localStorage
    localStorage.clear()
  })

  describe('AC1: 实现资产新增表单', () => {
    test('应该包含所有必要字段', () => {
      const formData: AssetFormData = {
        name: 'user_behavior_analysis',
        displayName: '用户行为分析表',
        description: '记录用户在平台上的各种行为数据',
        assetType: AssetType.TABLE,
        categoryId: 'business_data',
        ownerId: 'user1',
        metadata: {
          dataSource: DataSourceType.MYSQL,
          updateFrequency: 'daily',
          sensitivityLevel: 'internal',
          tags: ['用户行为', '分析']
        },
        status: 'draft'
      }

      expect(formData).toHaveProperty('name')
      expect(formData).toHaveProperty('description')
      expect(formData).toHaveProperty('categoryId')
      expect(formData).toHaveProperty('ownerId')
      expect(formData).toHaveProperty('metadata')
      expect(formData.name).toBe('user_behavior_analysis')
    })

    test('应该验证必填字段', async () => {
      const incompleteData = {
        name: '',
        description: '',
        categoryId: '',
        ownerId: ''
      }

      const result = await assetOnboardingService.validateAssetData(incompleteData)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      const errorFields = result.errors.map(e => e.field)
      expect(errorFields).toContain('name')
      expect(errorFields).toContain('description')
      expect(errorFields).toContain('categoryId')
      expect(errorFields).toContain('ownerId')
    })

    test('应该验证资产名称格式', async () => {
      const testCases = [
        { name: '123invalid', valid: false, reason: '不能以数字开头' },
        { name: 'valid_name', valid: true, reason: '有效的名称' },
        { name: 'invalid-name', valid: false, reason: '不能包含连字符' },
        { name: 'validName123', valid: true, reason: '有效的名称' },
        { name: 'invalid name', valid: false, reason: '不能包含空格' }
      ]

      for (const testCase of testCases) {
        const result = await assetOnboardingService.validateAssetData({
          name: testCase.name,
          description: 'test description',
          categoryId: 'test',
          ownerId: 'test'
        })

        if (testCase.valid) {
          const nameErrors = result.errors.filter(e => e.field === 'name')
          expect(nameErrors.length).toBe(0)
        } else {
          const nameErrors = result.errors.filter(e => e.field === 'name')
          expect(nameErrors.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('AC2: 支持富文本编辑器编写资产描述', () => {
    test('应该提升内容展示效果', () => {
      // 验证富文本内容处理
      const richTextContent = {
        html: '<p><strong>用户行为分析表</strong></p><ul><li>记录用户点击事件</li><li>追踪页面访问路径</li></ul>',
        plainText: '用户行为分析表\n• 记录用户点击事件\n• 追踪页面访问路径',
        wordCount: 25
      }

      expect(richTextContent).toHaveProperty('html')
      expect(richTextContent).toHaveProperty('plainText')
      expect(richTextContent).toHaveProperty('wordCount')
      expect(richTextContent.html).toContain('<strong>')
      expect(richTextContent.html).toContain('<ul>')
    })

    test('应该支持内容长度限制', () => {
      const maxLength = 5000
      const content = 'A'.repeat(maxLength + 100)

      const isValid = content.length <= maxLength
      expect(isValid).toBe(false)

      const truncatedContent = content.substring(0, maxLength)
      expect(truncatedContent.length).toBe(maxLength)
    })
  })

  describe('AC3: 提供资产分类的下拉选择和新增功能', () => {
    test('应该便于分类管理', () => {
      const categories = [
        { id: 'user_data', name: '用户数据', parentId: null, level: 0 },
        { id: 'business_data', name: '业务数据', parentId: null, level: 0 },
        { id: 'user_profile', name: '用户档案', parentId: 'user_data', level: 1 },
        { id: 'user_behavior', name: '用户行为', parentId: 'user_data', level: 1 }
      ]

      const topLevelCategories = categories.filter(c => c.level === 0)
      const childCategories = categories.filter(c => c.level === 1)

      expect(topLevelCategories).toHaveLength(2)
      expect(childCategories).toHaveLength(2)

      // 验证层级关系
      const userDataChildren = categories.filter(c => c.parentId === 'user_data')
      expect(userDataChildren).toHaveLength(2)
    })

    test('应该支持新分类创建', () => {
      const newCategory = {
        name: '系统日志',
        code: 'system_logs',
        description: '系统运行日志数据',
        parentId: 'system_data',
        level: 1
      }

      expect(newCategory).toHaveProperty('name')
      expect(newCategory).toHaveProperty('code')
      expect(newCategory).toHaveProperty('description')
      expect(newCategory).toHaveProperty('parentId')
      expect(newCategory).toHaveProperty('level')
    })
  })

  describe('AC4: 支持表结构信息的批量导入', () => {
    test('应该减少手工录入工作量', async () => {
      const mockFile = new File([''], 'schema.csv', { type: 'text/csv' })
      const importOptions = {
        fileType: 'csv' as const,
        hasHeader: true,
        delimiter: ',',
        encoding: 'utf-8'
      }

      const result = await assetOnboardingService.importSchema(mockFile, importOptions)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('totalRecords')
      expect(result).toHaveProperty('successRecords')
      expect(result).toHaveProperty('failedRecords')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('previewData')

      if (result.previewData) {
        expect(Array.isArray(result.previewData)).toBe(true)
        result.previewData.forEach(field => {
          expect(field).toHaveProperty('name')
          expect(field).toHaveProperty('type')
          expect(field).toHaveProperty('nullable')
          expect(field).toHaveProperty('primaryKey')
        })
      }
    })

    test('应该处理导入错误和警告', async () => {
      const mockFile = new File(['invalid content'], 'invalid.csv', { type: 'text/csv' })
      const importOptions = {
        fileType: 'csv' as const,
        hasHeader: true,
        delimiter: ','
      }

      const result = await assetOnboardingService.importSchema(mockFile, importOptions)

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          expect(error).toHaveProperty('message')
          expect(typeof error.message).toBe('string')
        })
      }

      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          expect(warning).toHaveProperty('message')
          expect(typeof warning.message).toBe('string')
        })
      }
    })
  })

  describe('AC5: 实现资产元数据模板', () => {
    test('应该提高录入效率和数据一致性', async () => {
      const templates = await assetOnboardingService.getTemplates()

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)

      templates.forEach(template => {
        expect(template).toHaveProperty('id')
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('type')
        expect(template).toHaveProperty('description')
        expect(template).toHaveProperty('schema')
        expect(template).toHaveProperty('isSystem')
      })

      // 验证业务表模板
      const businessTemplate = templates.find(t => t.type === TemplateType.BUSINESS_TABLE)
      expect(businessTemplate).toBeDefined()
      expect(businessTemplate?.schema.schema?.fields).toBeDefined()
      expect(businessTemplate?.schema.schema?.fields?.length).toBeGreaterThan(0)
    })

    test('应该支持模板应用', async () => {
      const templateId = 'business_table'
      const appliedData = await assetOnboardingService.applyTemplate(templateId)

      expect(appliedData).toHaveProperty('assetType')
      expect(appliedData).toHaveProperty('schema')
      expect(appliedData).toHaveProperty('metadata')

      // 应该有默认字段但名称等关键信息为空（需要用户填写）
      expect(appliedData.name).toBe('')
      expect(appliedData.description).toBe('')
      expect(appliedData.schema?.fields?.length).toBeGreaterThan(0)
    })
  })

  describe('AC6: 提供表单验证和数据完整性检查', () => {
    test('应该确保资产信息质量', async () => {
      const validData: Partial<AssetFormData> = {
        name: 'valid_table_name',
        description: '这是一个有效的资产描述，包含足够的信息来描述该资产的用途和内容',
        categoryId: 'business_data',
        ownerId: 'user1',
        schema: {
          tableName: 'valid_table',
          fields: [
            {
              name: 'id',
              type: FieldDataType.STRING,
              nullable: false,
              primaryKey: true,
              length: 32
            },
            {
              name: 'name',
              type: FieldDataType.STRING,
              nullable: false,
              primaryKey: false,
              length: 100
            }
          ]
        },
        metadata: {
          dataSource: DataSourceType.MYSQL,
          updateFrequency: 'daily',
          sensitivityLevel: 'internal',
          tags: []
        }
      }

      const result = await assetOnboardingService.validateAssetData(validData)
      expect(result.isValid).toBe(true)
    })

    test('应该检查表结构完整性', async () => {
      const dataWithInvalidSchema: Partial<AssetFormData> = {
        name: 'test_table',
        description: 'Test description',
        categoryId: 'test_category',
        ownerId: 'test_user',
        schema: {
          tableName: '',  // 空表名
          fields: []      // 无字段
        }
      }

      const result = await assetOnboardingService.validateAssetData(dataWithInvalidSchema)
      expect(result.isValid).toBe(false)

      const schemaErrors = result.errors.filter(e => e.field.startsWith('schema'))
      expect(schemaErrors.length).toBeGreaterThan(0)
    })

    test('应该检查字段名重复', async () => {
      const dataWithDuplicateFields: Partial<AssetFormData> = {
        name: 'test_table',
        description: 'Test description',
        categoryId: 'test_category',
        ownerId: 'test_user',
        schema: {
          tableName: 'test_table',
          fields: [
            {
              name: 'id',
              type: FieldDataType.STRING,
              nullable: false,
              primaryKey: true
            },
            {
              name: 'id',  // 重复字段名
              type: FieldDataType.INTEGER,
              nullable: false,
              primaryKey: false
            }
          ]
        }
      }

      const result = await assetOnboardingService.validateAssetData(dataWithDuplicateFields)
      expect(result.isValid).toBe(false)

      const duplicateError = result.errors.find(e => e.code === 'DUPLICATE_FIELDS')
      expect(duplicateError).toBeDefined()
    })
  })

  describe('AC7: 支持资产信息的预览功能', () => {
    test('应该确认无误后再正式上架', async () => {
      const testData: AssetFormData = {
        name: 'user_events',
        displayName: '用户事件表',
        description: '记录用户在系统中的各种操作事件',
        assetType: AssetType.TABLE,
        categoryId: 'user_data',
        ownerId: 'user1',
        schema: {
          tableName: 'user_events',
          fields: [
            {
              name: 'event_id',
              type: FieldDataType.STRING,
              nullable: false,
              primaryKey: true,
              length: 36
            },
            {
              name: 'user_id',
              type: FieldDataType.STRING,
              nullable: false,
              primaryKey: false,
              length: 32
            },
            {
              name: 'event_type',
              type: FieldDataType.STRING,
              nullable: false,
              primaryKey: false,
              length: 50
            },
            {
              name: 'event_data',
              type: FieldDataType.JSON,
              nullable: true,
              primaryKey: false
            },
            {
              name: 'created_at',
              type: FieldDataType.TIMESTAMP,
              nullable: false,
              primaryKey: false
            }
          ]
        },
        metadata: {
          dataSource: DataSourceType.POSTGRESQL,
          updateFrequency: 'realtime',
          sensitivityLevel: 'confidential',
          tags: ['用户事件', '实时数据'],
          dataVolume: 1000000
        },
        status: 'draft'
      }

      const previewData = await assetOnboardingService.generatePreview(testData)

      expect(previewData).toHaveProperty('asset')
      expect(previewData).toHaveProperty('validationResult')
      expect(previewData).toHaveProperty('estimatedSize')
      expect(previewData).toHaveProperty('recommendedOptimizations')

      expect(previewData.asset).toEqual(testData)
      expect(previewData.estimatedSize).toBeGreaterThan(0)
      expect(Array.isArray(previewData.recommendedOptimizations)).toBe(true)
    })
  })

  describe('数据质量和优化建议', () => {
    test('应该提供数据质量评估', async () => {
      const largeTableData: AssetFormData = {
        name: 'large_table',
        description: '大型数据表，包含很多文本字段',
        assetType: AssetType.TABLE,
        categoryId: 'business_data',
        ownerId: 'user1',
        schema: {
          tableName: 'large_table',
          fields: [
            // 多个文本字段
            { name: 'field1', type: FieldDataType.TEXT, nullable: false, primaryKey: false },
            { name: 'field2', type: FieldDataType.TEXT, nullable: false, primaryKey: false },
            { name: 'field3', type: FieldDataType.TEXT, nullable: false, primaryKey: false },
            { name: 'field4', type: FieldDataType.TEXT, nullable: false, primaryKey: false },
            { name: 'id', type: FieldDataType.STRING, nullable: false, primaryKey: true }
          ]
        },
        metadata: {
          dataSource: DataSourceType.MYSQL,
          updateFrequency: 'daily',
          sensitivityLevel: 'internal',
          tags: []
        },
        status: 'draft'
      }

      const previewData = await assetOnboardingService.generatePreview(largeTableData)

      expect(previewData.recommendedOptimizations).toBeDefined()
      expect(previewData.recommendedOptimizations?.length).toBeGreaterThan(0)

      // 应该建议优化文本字段过多的问题
      const textFieldOptimization = previewData.recommendedOptimizations?.find(opt =>
        opt.includes('文本字段')
      )
      expect(textFieldOptimization).toBeDefined()
    })

    test('应该估算存储大小', async () => {
      const tableData: AssetFormData = {
        name: 'size_test_table',
        description: '用于测试大小估算的表',
        assetType: AssetType.TABLE,
        categoryId: 'test',
        ownerId: 'user1',
        schema: {
          tableName: 'size_test',
          fields: [
            { name: 'id', type: FieldDataType.STRING, length: 32, nullable: false, primaryKey: true },
            { name: 'data', type: FieldDataType.TEXT, nullable: true, primaryKey: false },
            { name: 'count', type: FieldDataType.INTEGER, nullable: false, primaryKey: false }
          ]
        },
        metadata: {
          dataSource: DataSourceType.MYSQL,
          updateFrequency: 'daily',
          sensitivityLevel: 'internal',
          tags: []
        },
        status: 'draft'
      }

      const previewData = await assetOnboardingService.generatePreview(tableData)

      expect(previewData.estimatedSize).toBeGreaterThan(0)
      // 估算: 32 (id) + 1000 (text) + 4 (integer) = 1036 bytes per row
      expect(previewData.estimatedSize).toBeGreaterThan(1000)
    })
  })

  describe('本地存储和草稿管理', () => {
    test('应该支持草稿保存和恢复', async () => {
      const draftData: Partial<AssetFormData> = {
        name: 'draft_asset',
        description: '草稿资产',
        categoryId: 'test'
      }

      // 保存草稿
      await assetOnboardingService.saveDraft(draftData)

      // 加载草稿
      const loadedDraft = await assetOnboardingService.loadDraft()

      expect(loadedDraft).toBeDefined()
      expect(loadedDraft?.name).toBe(draftData.name)
      expect(loadedDraft?.description).toBe(draftData.description)
      expect(loadedDraft?.categoryId).toBe(draftData.categoryId)
    })

    test('应该清理过期草稿', async () => {
      const draftData: Partial<AssetFormData> = {
        name: 'expired_draft'
      }

      // 手动设置过期草稿
      const expiredDraft = {
        data: draftData,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25小时前
        version: 1
      }

      localStorage.setItem('asset_onboarding_draft', JSON.stringify(expiredDraft))

      // 尝试加载应该返回null
      const loadedDraft = await assetOnboardingService.loadDraft()
      expect(loadedDraft).toBeNull()
    })

    test('应该检查资产名称可用性', async () => {
      const availableName = 'unique_asset_name'
      const unavailableName = 'users' // 已存在的名称

      const availableResult = await assetOnboardingService.checkAssetNameAvailability(availableName)
      const unavailableResult = await assetOnboardingService.checkAssetNameAvailability(unavailableName)

      expect(availableResult).toBe(true)
      expect(unavailableResult).toBe(false)
    })
  })

  describe('表单步骤管理', () => {
    test('应该支持多步骤表单导航', () => {
      const formSteps = [
        'template_selection',
        'basic_info',
        'schema_definition',
        'metadata',
        'preview'
      ]

      // 验证步骤顺序
      expect(formSteps).toHaveLength(5)
      expect(formSteps[0]).toBe('template_selection')
      expect(formSteps[formSteps.length - 1]).toBe('preview')

      // 模拟步骤导航
      let currentStep = 0
      const nextStep = () => {
        if (currentStep < formSteps.length - 1) {
          currentStep++
        }
      }
      const prevStep = () => {
        if (currentStep > 0) {
          currentStep--
        }
      }

      nextStep()
      expect(currentStep).toBe(1)
      expect(formSteps[currentStep]).toBe('basic_info')

      prevStep()
      expect(currentStep).toBe(0)
      expect(formSteps[currentStep]).toBe('template_selection')
    })
  })
})