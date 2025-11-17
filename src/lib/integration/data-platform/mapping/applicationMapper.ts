/**
 * 申请数据映射器
 * 负责申请表单数据与数据平台API格式之间的双向转换
 */

import {
  ApplicationData,
  PlatformApplication,
  DataMapper,
  ValidationResult
} from '@/types/integration'

/**
 * 字段映射配置
 */
export interface FieldMapping {
  sourceField: string
  targetField: string
  transform?: (value: any) => any
  reverseTransform?: (value: any) => any
  required?: boolean
  validate?: (value: any) => boolean
}

/**
 * 映射器配置
 */
export interface MapperConfig {
  strict?: boolean // 严格模式:未映射的字段会抛出错误
  ignoreNull?: boolean // 忽略null值
  customMappings?: FieldMapping[]
}

/**
 * 申请数据映射器类
 */
export class ApplicationDataMapper implements DataMapper<ApplicationData, PlatformApplication> {
  private config: MapperConfig
  private fieldMappings: Map<string, FieldMapping>

  constructor(config: MapperConfig = {}) {
    this.config = {
      strict: false,
      ignoreNull: true,
      ...config
    }

    // 初始化默认字段映射
    this.fieldMappings = this.initializeFieldMappings()

    // 添加自定义映射
    if (config.customMappings) {
      config.customMappings.forEach(mapping => {
        this.fieldMappings.set(mapping.sourceField, mapping)
      })
    }
  }

  /**
   * 将申请表单数据映射为平台API格式
   */
  map(source: ApplicationData): PlatformApplication {
    const mapped: any = {}

    try {
      // 基本字段映射
      for (const [sourceField, mapping] of this.fieldMappings) {
        const sourceValue = this.getNestedValue(source, sourceField)

        // 处理null值
        if (sourceValue === null || sourceValue === undefined) {
          if (this.config.ignoreNull) {
            continue
          }
          if (mapping.required) {
            throw new Error(`必填字段 ${sourceField} 不能为空`)
          }
        }

        // 应用转换函数
        const transformedValue = mapping.transform
          ? mapping.transform(sourceValue)
          : sourceValue

        // 设置目标值
        this.setNestedValue(mapped, mapping.targetField, transformedValue)
      }

      // 添加必需字段
      return this.addRequiredFields(mapped, source)

    } catch (error) {
      console.error('数据映射失败:', error)
      throw error
    }
  }

  /**
   * 将平台API格式反向映射为申请表单数据
   */
  reverseMap(target: PlatformApplication): ApplicationData {
    const mapped: any = {}

    try {
      // 反向字段映射
      for (const [sourceField, mapping] of this.fieldMappings) {
        const targetValue = this.getNestedValue(target, mapping.targetField)

        // 处理null值
        if (targetValue === null || targetValue === undefined) {
          if (this.config.ignoreNull) {
            continue
          }
        }

        // 应用逆向转换函数
        const transformedValue = mapping.reverseTransform
          ? mapping.reverseTransform(targetValue)
          : targetValue

        // 设置源值
        this.setNestedValue(mapped, sourceField, transformedValue)
      }

      return mapped as ApplicationData

    } catch (error) {
      console.error('数据反向映射失败:', error)
      throw error
    }
  }

  /**
   * 验证数据
   */
  validate(data: ApplicationData | PlatformApplication): ValidationResult {
    const errors: Array<{ field: string; message: string }> = []

    // 检查是否为申请表单数据
    const isApplicationData = 'assetId' in data

    if (isApplicationData) {
      // 验证申请表单数据
      const appData = data as ApplicationData

      if (!appData.assetId) {
        errors.push({ field: 'assetId', message: '资产ID不能为空' })
      }

      if (!appData.purpose || appData.purpose.length < 10) {
        errors.push({ field: 'purpose', message: '申请目的至少需要10个字符' })
      }

      if (!appData.duration) {
        errors.push({ field: 'duration', message: '使用期限不能为空' })
      }

      if (!['read', 'write', 'full'].includes(appData.accessType)) {
        errors.push({ field: 'accessType', message: '无效的访问类型' })
      }

      if (!appData.department || appData.department.length < 2) {
        errors.push({ field: 'department', message: '部门名称至少需要2个字符' })
      }

      if (!appData.supervisor || appData.supervisor.length < 2) {
        errors.push({ field: 'supervisor', message: '主管姓名至少需要2个字符' })
      }

      if (!appData.applicant?.id) {
        errors.push({ field: 'applicant.id', message: '申请人ID不能为空' })
      }

    } else {
      // 验证平台API数据
      const platformData = data as PlatformApplication

      if (!platformData.asset_id) {
        errors.push({ field: 'asset_id', message: '资产ID不能为空' })
      }

      if (!platformData.reason) {
        errors.push({ field: 'reason', message: '申请原因不能为空' })
      }

      if (!platformData.applicant_info?.user_id) {
        errors.push({ field: 'applicant_info.user_id', message: '申请人ID不能为空' })
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 初始化字段映射配置
   */
  private initializeFieldMappings(): Map<string, FieldMapping> {
    const mappings: FieldMapping[] = [
      // 资产相关
      {
        sourceField: 'assetId',
        targetField: 'asset_id'
      },
      // 申请原因和目的
      {
        sourceField: 'purpose',
        targetField: 'reason'
      },
      {
        sourceField: 'purpose',
        targetField: 'business_purpose'
      },
      // 访问类型
      {
        sourceField: 'accessType',
        targetField: 'access_level',
        transform: (value: 'read' | 'write' | 'full') => {
          const levelMap = {
            read: '只读',
            write: '读写',
            full: '完全访问'
          }
          return levelMap[value] || value
        },
        reverseTransform: (value: string) => {
          const reverseMap: Record<string, 'read' | 'write' | 'full'> = {
            '只读': 'read',
            '读写': 'write',
            '完全访问': 'full'
          }
          return reverseMap[value] || 'read'
        }
      },
      // 使用期限
      {
        sourceField: 'duration',
        targetField: 'duration_days',
        transform: (value: string) => parseInt(value, 10),
        reverseTransform: (value: number) => value.toString()
      },
      // 部门和主管
      {
        sourceField: 'department',
        targetField: 'department'
      },
      {
        sourceField: 'supervisor',
        targetField: 'supervisor'
      },
      // 额外备注
      {
        sourceField: 'additionalNotes',
        targetField: 'notes'
      },
      // 申请人信息(嵌套对象)
      {
        sourceField: 'applicant.id',
        targetField: 'applicant_info.user_id'
      },
      {
        sourceField: 'applicant.name',
        targetField: 'applicant_info.username'
      },
      {
        sourceField: 'applicant.email',
        targetField: 'applicant_info.email'
      }
    ]

    return new Map(mappings.map(m => [m.sourceField, m]))
  }

  /**
   * 添加必需字段
   */
  private addRequiredFields(
    mapped: any,
    source: ApplicationData
  ): PlatformApplication {
    // 确保asset_name字段存在(可能需要从其他地方获取)
    if (!mapped.asset_name) {
      mapped.asset_name = source.assetId // 临时使用ID,实际应该查询资产名称
    }

    // 添加元数据
    if (!mapped.metadata) {
      mapped.metadata = {
        mappedAt: new Date().toISOString(),
        sourceVersion: '1.0'
      }
    }

    return mapped as PlatformApplication
  }

  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key]
    }, obj)
  }

  /**
   * 设置嵌套对象的值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!

    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {}
      }
      return current[key]
    }, obj)

    target[lastKey] = value
  }

  /**
   * 添加自定义映射
   */
  addMapping(mapping: FieldMapping): void {
    this.fieldMappings.set(mapping.sourceField, mapping)
  }

  /**
   * 移除映射
   */
  removeMapping(sourceField: string): void {
    this.fieldMappings.delete(sourceField)
  }

  /**
   * 获取所有映射配置
   */
  getMappings(): Map<string, FieldMapping> {
    return new Map(this.fieldMappings)
  }
}

/**
 * 创建默认映射器实例
 */
export function createApplicationMapper(config?: MapperConfig): ApplicationDataMapper {
  return new ApplicationDataMapper(config)
}
