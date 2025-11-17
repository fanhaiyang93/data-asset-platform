/**
 * 字段验证器
 * 提供数据字段的验证和格式检查功能
 */

import { ValidationResult } from '@/types/integration'

/**
 * 验证规则接口
 */
export interface ValidationRule {
  name: string
  validate: (value: any) => boolean
  message: string
}

/**
 * 字段验证配置
 */
export interface FieldValidationConfig {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array'
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: any[]
  custom?: ValidationRule[]
}

/**
 * 字段验证器类
 */
export class FieldValidator {
  private validationConfigs: Map<string, FieldValidationConfig> = new Map()

  /**
   * 注册字段验证配置
   */
  registerField(fieldName: string, config: FieldValidationConfig): void {
    this.validationConfigs.set(fieldName, config)
  }

  /**
   * 验证单个字段
   */
  validateField(fieldName: string, value: any): ValidationResult {
    const config = this.validationConfigs.get(fieldName)
    const errors: Array<{ field: string; message: string }> = []

    if (!config) {
      return { valid: true, errors: [] }
    }

    // 必填检查
    if (config.required && (value === null || value === undefined || value === '')) {
      errors.push({
        field: fieldName,
        message: `${fieldName} 是必填字段`
      })
      return { valid: false, errors }
    }

    // 如果值为空且非必填,跳过其他检查
    if (value === null || value === undefined || value === '') {
      return { valid: true, errors: [] }
    }

    // 类型检查
    if (config.type) {
      if (!this.checkType(value, config.type)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 必须是 ${config.type} 类型`
        })
      }
    }

    // 字符串长度检查
    if (config.type === 'string' && typeof value === 'string') {
      if (config.minLength !== undefined && value.length < config.minLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 最少需要 ${config.minLength} 个字符`
        })
      }

      if (config.maxLength !== undefined && value.length > config.maxLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 最多允许 ${config.maxLength} 个字符`
        })
      }
    }

    // 数值范围检查
    if (config.type === 'number' && typeof value === 'number') {
      if (config.min !== undefined && value < config.min) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 不能小于 ${config.min}`
        })
      }

      if (config.max !== undefined && value > config.max) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 不能大于 ${config.max}`
        })
      }
    }

    // 正则表达式检查
    if (config.pattern && typeof value === 'string') {
      if (!config.pattern.test(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 格式不正确`
        })
      }
    }

    // 枚举值检查
    if (config.enum) {
      if (!config.enum.includes(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} 必须是以下值之一: ${config.enum.join(', ')}`
        })
      }
    }

    // 自定义验证规则
    if (config.custom) {
      for (const rule of config.custom) {
        if (!rule.validate(value)) {
          errors.push({
            field: fieldName,
            message: rule.message
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 验证多个字段
   */
  validateFields(data: Record<string, any>): ValidationResult {
    const allErrors: Array<{ field: string; message: string }> = []

    for (const [fieldName, value] of Object.entries(data)) {
      const result = this.validateField(fieldName, value)
      if (!result.valid) {
        allErrors.push(...result.errors)
      }
    }

    // 同时验证已注册但数据中不存在的必填字段
    for (const [fieldName, config] of this.validationConfigs) {
      if (config.required && !(fieldName in data)) {
        allErrors.push({
          field: fieldName,
          message: `${fieldName} 是必填字段`
        })
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    }
  }

  /**
   * 验证嵌套对象
   */
  validateNestedObject(
    data: Record<string, any>,
    prefix: string = ''
  ): ValidationResult {
    const allErrors: Array<{ field: string; message: string }> = []

    for (const [key, value] of Object.entries(data)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key

      // 如果值是对象,递归验证
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nestedResult = this.validateNestedObject(value, fieldPath)
        if (!nestedResult.valid) {
          allErrors.push(...nestedResult.errors)
        }
      } else {
        // 验证当前字段
        const result = this.validateField(fieldPath, value)
        if (!result.valid) {
          allErrors.push(...result.errors)
        }
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    }
  }

  /**
   * 类型检查
   */
  private checkType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'object':
        return value !== null && typeof value === 'object' && !Array.isArray(value)
      case 'array':
        return Array.isArray(value)
      default:
        return false
    }
  }

  /**
   * 清除所有验证配置
   */
  clearAll(): void {
    this.validationConfigs.clear()
  }

  /**
   * 移除字段验证配置
   */
  unregisterField(fieldName: string): void {
    this.validationConfigs.delete(fieldName)
  }

  /**
   * 获取所有验证配置
   */
  getAllConfigs(): Map<string, FieldValidationConfig> {
    return new Map(this.validationConfigs)
  }
}

/**
 * 创建申请数据字段验证器
 */
export function createApplicationFieldValidator(): FieldValidator {
  const validator = new FieldValidator()

  // 注册申请表单字段验证规则
  validator.registerField('assetId', {
    required: true,
    type: 'string',
    minLength: 1
  })

  validator.registerField('purpose', {
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 500
  })

  validator.registerField('duration', {
    required: true,
    type: 'string',
    enum: ['30', '90', '180', '365']
  })

  validator.registerField('accessType', {
    required: true,
    type: 'string',
    enum: ['read', 'write', 'full']
  })

  validator.registerField('department', {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  })

  validator.registerField('supervisor', {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50
  })

  validator.registerField('additionalNotes', {
    required: false,
    type: 'string',
    maxLength: 1000
  })

  validator.registerField('applicant.id', {
    required: true,
    type: 'string',
    minLength: 1
  })

  validator.registerField('applicant.name', {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50
  })

  validator.registerField('applicant.email', {
    required: true,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: [{
      name: 'email-format',
      validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: '邮箱格式不正确'
    }]
  })

  return validator
}

/**
 * 创建平台API数据字段验证器
 */
export function createPlatformFieldValidator(): FieldValidator {
  const validator = new FieldValidator()

  // 注册平台API字段验证规则
  validator.registerField('asset_id', {
    required: true,
    type: 'string'
  })

  validator.registerField('asset_name', {
    required: true,
    type: 'string'
  })

  validator.registerField('reason', {
    required: true,
    type: 'string',
    minLength: 10
  })

  validator.registerField('business_purpose', {
    required: true,
    type: 'string'
  })

  validator.registerField('access_level', {
    required: true,
    type: 'string'
  })

  validator.registerField('duration_days', {
    required: true,
    type: 'number',
    min: 1,
    max: 365
  })

  validator.registerField('department', {
    required: true,
    type: 'string'
  })

  validator.registerField('supervisor', {
    required: true,
    type: 'string'
  })

  validator.registerField('applicant_info.user_id', {
    required: true,
    type: 'string'
  })

  validator.registerField('applicant_info.username', {
    required: true,
    type: 'string'
  })

  validator.registerField('applicant_info.email', {
    required: true,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  })

  return validator
}
