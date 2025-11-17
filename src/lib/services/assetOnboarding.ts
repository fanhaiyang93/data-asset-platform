/**
 * 资产接入管理服务
 * 提供资产创建、验证、模板管理等功能
 */
import {
  AssetFormData,
  AssetTemplate,
  ValidationResult,
  ValidationError,
  TemplateType,
  ImportResult,
  ImportOptions,
  AssetField,
  FieldDataType,
  PreviewData
} from '@/types/assetOnboarding'

class AssetOnboardingService {
  private readonly STORAGE_KEY = 'asset_onboarding_draft'

  // 创建资产
  async createAsset(data: AssetFormData): Promise<{ id: string; asset: AssetFormData }> {
    try {
      // 验证数据
      const validationResult = await this.validateAssetData(data)
      if (!validationResult.isValid) {
        throw new Error(`Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`)
      }

      // 模拟API调用
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error(`Failed to create asset: ${response.statusText}`)
      }

      const result = await response.json()

      // 清除本地缓存
      this.clearDraft()

      return result
    } catch (error) {
      console.error('Asset creation failed:', error)
      throw error
    }
  }

  // 验证资产数据
  async validateAssetData(data: Partial<AssetFormData>): Promise<ValidationResult> {
    const errors: ValidationError[] = []

    // 基本信息验证
    if (!data.name?.trim()) {
      errors.push({
        field: 'name',
        message: '资产名称不能为空',
        code: 'REQUIRED',
        severity: 'error'
      })
    } else if (data.name.length > 100) {
      errors.push({
        field: 'name',
        message: '资产名称长度不能超过100个字符',
        code: 'MAX_LENGTH',
        severity: 'error'
      })
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(data.name)) {
      errors.push({
        field: 'name',
        message: '资产名称只能包含字母、数字和下划线，且必须以字母开头',
        code: 'INVALID_FORMAT',
        severity: 'error'
      })
    }

    if (!data.description?.trim()) {
      errors.push({
        field: 'description',
        message: '资产描述不能为空',
        code: 'REQUIRED',
        severity: 'error'
      })
    } else if (data.description.length < 10) {
      errors.push({
        field: 'description',
        message: '资产描述至少需要10个字符',
        code: 'MIN_LENGTH',
        severity: 'warning'
      })
    }

    if (!data.categoryId) {
      errors.push({
        field: 'categoryId',
        message: '请选择资产分类',
        code: 'REQUIRED',
        severity: 'error'
      })
    }

    if (!data.ownerId) {
      errors.push({
        field: 'ownerId',
        message: '请指定资产负责人',
        code: 'REQUIRED',
        severity: 'error'
      })
    }

    // 表结构验证
    if (data.schema) {
      if (!data.schema.tableName?.trim()) {
        errors.push({
          field: 'schema.tableName',
          message: '表名不能为空',
          code: 'REQUIRED',
          severity: 'error'
        })
      }

      if (!data.schema.fields || data.schema.fields.length === 0) {
        errors.push({
          field: 'schema.fields',
          message: '至少需要定义一个字段',
          code: 'REQUIRED',
          severity: 'error'
        })
      } else {
        // 字段验证
        data.schema.fields.forEach((field, index) => {
          if (!field.name?.trim()) {
            errors.push({
              field: `schema.fields[${index}].name`,
              message: `第${index + 1}个字段名称不能为空`,
              code: 'REQUIRED',
              severity: 'error'
            })
          }

          if (!field.type) {
            errors.push({
              field: `schema.fields[${index}].type`,
              message: `第${index + 1}个字段类型不能为空`,
              code: 'REQUIRED',
              severity: 'error'
            })
          }
        })

        // 检查主键
        const primaryKeys = data.schema.fields.filter(f => f.primaryKey)
        if (primaryKeys.length === 0) {
          errors.push({
            field: 'schema.fields',
            message: '至少需要定义一个主键字段',
            code: 'NO_PRIMARY_KEY',
            severity: 'warning'
          })
        }

        // 检查字段名重复
        const fieldNames = data.schema.fields.map(f => f.name.toLowerCase())
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index)
        if (duplicates.length > 0) {
          errors.push({
            field: 'schema.fields',
            message: `字段名重复: ${duplicates.join(', ')}`,
            code: 'DUPLICATE_FIELDS',
            severity: 'error'
          })
        }
      }
    }

    // 元数据验证
    if (data.metadata) {
      if (!data.metadata.dataSource) {
        errors.push({
          field: 'metadata.dataSource',
          message: '请选择数据源类型',
          code: 'REQUIRED',
          severity: 'error'
        })
      }

      if (!data.metadata.updateFrequency) {
        errors.push({
          field: 'metadata.updateFrequency',
          message: '请选择更新频率',
          code: 'REQUIRED',
          severity: 'error'
        })
      }

      if (!data.metadata.sensitivityLevel) {
        errors.push({
          field: 'metadata.sensitivityLevel',
          message: '请选择敏感级别',
          code: 'REQUIRED',
          severity: 'error'
        })
      }
    }

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings: errors.filter(e => e.severity === 'warning')
    }
  }

  // 保存草稿
  async saveDraft(data: Partial<AssetFormData>): Promise<void> {
    try {
      const draft = {
        data,
        timestamp: new Date().toISOString(),
        version: 1
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(draft))
    } catch (error) {
      console.warn('Failed to save draft:', error)
    }
  }

  // 加载草稿
  async loadDraft(): Promise<Partial<AssetFormData> | null> {
    try {
      const draftStr = localStorage.getItem(this.STORAGE_KEY)
      if (!draftStr) return null

      const draft = JSON.parse(draftStr)

      // 检查草稿是否过期（24小时）
      const draftTime = new Date(draft.timestamp)
      const now = new Date()
      const hoursDiff = (now.getTime() - draftTime.getTime()) / (1000 * 60 * 60)

      if (hoursDiff > 24) {
        this.clearDraft()
        return null
      }

      return draft.data
    } catch (error) {
      console.warn('Failed to load draft:', error)
      return null
    }
  }

  // 清除草稿
  clearDraft(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear draft:', error)
    }
  }

  // 获取资产模板列表
  async getTemplates(): Promise<AssetTemplate[]> {
    try {
      const response = await fetch('/api/assets/templates')
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('Failed to fetch templates:', error)

      // 返回默认模板
      return this.getDefaultTemplates()
    }
  }

  // 获取默认模板
  private getDefaultTemplates(): AssetTemplate[] {
    return [
      {
        id: 'business_table',
        name: '业务表模板',
        type: TemplateType.BUSINESS_TABLE,
        description: '标准业务表结构，包含常用字段和约束',
        schema: {
          assetType: 'table' as const,
          schema: {
            tableName: '',
            fields: [
              {
                name: 'id',
                type: FieldDataType.STRING,
                description: '主键ID',
                nullable: false,
                primaryKey: true,
                length: 32
              },
              {
                name: 'name',
                type: FieldDataType.STRING,
                description: '名称',
                nullable: false,
                primaryKey: false,
                length: 100
              },
              {
                name: 'created_at',
                type: FieldDataType.TIMESTAMP,
                description: '创建时间',
                nullable: false,
                primaryKey: false
              },
              {
                name: 'updated_at',
                type: FieldDataType.TIMESTAMP,
                description: '更新时间',
                nullable: false,
                primaryKey: false
              }
            ]
          },
          metadata: {
            dataSource: 'mysql' as const,
            updateFrequency: 'daily' as const,
            sensitivityLevel: 'internal' as const,
            tags: ['业务表']
          }
        },
        isSystem: true,
        usage: 156,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'dimension_table',
        name: '维度表模板',
        type: TemplateType.DIMENSION_TABLE,
        description: '数据仓库维度表标准结构',
        schema: {
          assetType: 'table' as const,
          schema: {
            tableName: '',
            fields: [
              {
                name: 'dim_key',
                type: FieldDataType.STRING,
                description: '维度键',
                nullable: false,
                primaryKey: true,
                length: 32
              },
              {
                name: 'natural_key',
                type: FieldDataType.STRING,
                description: '业务键',
                nullable: false,
                primaryKey: false,
                length: 50
              },
              {
                name: 'version',
                type: FieldDataType.INTEGER,
                description: '版本号',
                nullable: false,
                primaryKey: false,
                defaultValue: '1'
              },
              {
                name: 'effective_date',
                type: FieldDataType.DATE,
                description: '生效日期',
                nullable: false,
                primaryKey: false
              },
              {
                name: 'expiry_date',
                type: FieldDataType.DATE,
                description: '失效日期',
                nullable: true,
                primaryKey: false
              }
            ]
          },
          metadata: {
            dataSource: 'hive' as const,
            updateFrequency: 'daily' as const,
            sensitivityLevel: 'internal' as const,
            tags: ['维度表', '数据仓库']
          }
        },
        isSystem: true,
        usage: 89,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  }

  // 应用模板
  async applyTemplate(templateId: string): Promise<Partial<AssetFormData>> {
    const templates = await this.getTemplates()
    const template = templates.find(t => t.id === templateId)

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    return {
      ...template.schema,
      name: '',
      description: '',
      ownerId: '',
      categoryId: ''
    }
  }

  // 导入表结构
  async importSchema(file: File, options: ImportOptions): Promise<ImportResult> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('options', JSON.stringify(options))

      const response = await fetch('/api/assets/import', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Schema import failed:', error)

      // 模拟导入结果
      return this.mockImportResult(file, options)
    }
  }

  // 模拟导入结果
  private async mockImportResult(file: File, options: ImportOptions): Promise<ImportResult> {
    // 简单的文件解析模拟
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          totalRecords: 10,
          successRecords: 8,
          failedRecords: 2,
          errors: [
            {
              row: 3,
              field: 'type',
              message: '不支持的数据类型: varchar2',
              rawValue: 'varchar2'
            },
            {
              row: 7,
              field: 'name',
              message: '字段名包含特殊字符',
              rawValue: 'user-name'
            }
          ],
          warnings: [
            {
              row: 5,
              field: 'length',
              message: '建议为字符串类型指定长度',
              suggestion: '添加长度限制以优化存储'
            }
          ],
          previewData: [
            {
              name: 'id',
              type: FieldDataType.STRING,
              description: '主键',
              nullable: false,
              primaryKey: true,
              length: 32
            },
            {
              name: 'name',
              type: FieldDataType.STRING,
              description: '名称',
              nullable: false,
              primaryKey: false,
              length: 100
            },
            {
              name: 'email',
              type: FieldDataType.STRING,
              description: '邮箱',
              nullable: true,
              primaryKey: false,
              length: 200
            }
          ]
        })
      }, 1500)
    })
  }

  // 生成预览数据
  async generatePreview(data: AssetFormData): Promise<PreviewData> {
    const validationResult = await this.validateAssetData(data)

    // 估算数据大小（简单模拟）
    let estimatedSize = 0
    if (data.schema?.fields) {
      estimatedSize = data.schema.fields.reduce((total, field) => {
        let fieldSize = 0
        switch (field.type) {
          case FieldDataType.STRING:
            fieldSize = field.length || 50
            break
          case FieldDataType.INTEGER:
            fieldSize = 4
            break
          case FieldDataType.DECIMAL:
            fieldSize = 8
            break
          case FieldDataType.BOOLEAN:
            fieldSize = 1
            break
          case FieldDataType.DATE:
          case FieldDataType.DATETIME:
          case FieldDataType.TIMESTAMP:
            fieldSize = 8
            break
          case FieldDataType.TEXT:
            fieldSize = 1000
            break
          default:
            fieldSize = 10
        }
        return total + fieldSize
      }, 0)
    }

    // 生成优化建议
    const recommendedOptimizations: string[] = []

    if (data.schema?.fields) {
      const hasIndex = data.schema.fields.some(f => f.primaryKey)
      if (!hasIndex) {
        recommendedOptimizations.push('建议为常用查询字段添加索引')
      }

      const textFields = data.schema.fields.filter(f => f.type === FieldDataType.TEXT)
      if (textFields.length > 3) {
        recommendedOptimizations.push('考虑将部分文本字段移到单独的扩展表中')
      }

      if (estimatedSize > 1000) {
        recommendedOptimizations.push('考虑数据分区以提高查询性能')
      }
    }

    return {
      asset: data,
      validationResult,
      estimatedSize,
      recommendedOptimizations
    }
  }

  // 检查资产名称是否可用
  async checkAssetNameAvailability(name: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/assets/check-name?name=${encodeURIComponent(name)}`)
      if (!response.ok) {
        throw new Error('Failed to check name availability')
      }
      const result = await response.json()
      return result.available
    } catch (error) {
      console.error('Name availability check failed:', error)
      // 模拟结果
      return !['users', 'orders', 'products'].includes(name.toLowerCase())
    }
  }
}

// 导出单例实例
export const assetOnboardingService = new AssetOnboardingService()
export default assetOnboardingService