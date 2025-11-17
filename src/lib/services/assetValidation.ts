/**
 * 资产校验服务
 * Story 5.3: 资产编辑与维护
 *
 * 提供资产数据校验功能:
 * - 数据一致性检查
 * - 业务规则验证
 * - 依赖关系检查
 * - 自定义校验规则
 */

import { AssetFormData } from '@/types/assetOnboarding'
import {
  AssetValidationResult,
  ValidationError,
  ValidationWarning,
  DataQualityMetrics,
  DependencyCheck,
  AssetDependency,
  CustomValidationRule
} from '@/types/assetMaintenance'

export class AssetValidationService {
  private customRules: CustomValidationRule[] = []

  /**
   * 执行完整的资产校验
   */
  async validateAsset(data: AssetFormData): Promise<AssetValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 基本字段验证
    this.validateBasicFields(data, errors, warnings)

    // 元数据验证
    this.validateMetadata(data, errors, warnings)

    // Schema验证
    if (data.schema) {
      this.validateSchema(data, errors, warnings)
    }

    // 业务规则验证
    await this.validateBusinessRules(data, errors, warnings)

    // 自定义规则验证
    this.validateCustomRules(data, errors)

    // 计算数据质量指标
    const dataQuality = this.calculateDataQuality(data, errors, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      dataQuality
    }
  }

  /**
   * 验证基本字段
   */
  private validateBasicFields(
    data: AssetFormData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // 必填字段检查
    if (!data.name || data.name.trim() === '') {
      errors.push({
        field: 'name',
        fieldLabel: '资产名称',
        message: '资产名称不能为空',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    } else {
      // 名称长度检查
      if (data.name.length < 3) {
        warnings.push({
          field: 'name',
          fieldLabel: '资产名称',
          message: '资产名称过短,建议至少3个字符',
          code: 'NAME_TOO_SHORT',
          severity: 'warning',
          suggestion: '使用更具描述性的名称'
        })
      }

      if (data.name.length > 100) {
        errors.push({
          field: 'name',
          fieldLabel: '资产名称',
          message: '资产名称不能超过100个字符',
          code: 'NAME_TOO_LONG',
          severity: 'error'
        })
      }
    }

    if (!data.description || data.description.trim() === '') {
      errors.push({
        field: 'description',
        fieldLabel: '资产描述',
        message: '资产描述不能为空',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    } else if (data.description.length < 10) {
      warnings.push({
        field: 'description',
        fieldLabel: '资产描述',
        message: '描述过于简短,建议提供更详细的说明',
        code: 'DESCRIPTION_TOO_SHORT',
        severity: 'warning',
        suggestion: '添加资产的用途、数据来源等详细信息'
      })
    }

    if (!data.categoryId) {
      errors.push({
        field: 'categoryId',
        fieldLabel: '资产分类',
        message: '必须选择资产分类',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    if (!data.ownerId) {
      errors.push({
        field: 'ownerId',
        fieldLabel: '资产负责人',
        message: '必须指定资产负责人',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    if (!data.assetType) {
      errors.push({
        field: 'assetType',
        fieldLabel: '资产类型',
        message: '必须选择资产类型',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }
  }

  /**
   * 验证元数据
   */
  private validateMetadata(
    data: AssetFormData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!data.metadata) {
      errors.push({
        field: 'metadata',
        fieldLabel: '元数据',
        message: '元数据信息不能为空',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
      return
    }

    const { metadata } = data

    // 数据源验证
    if (!metadata.dataSource) {
      errors.push({
        field: 'metadata.dataSource',
        fieldLabel: '数据源类型',
        message: '必须选择数据源类型',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    // 更新频率验证
    if (!metadata.updateFrequency) {
      errors.push({
        field: 'metadata.updateFrequency',
        fieldLabel: '更新频率',
        message: '必须选择更新频率',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    // 敏感级别验证
    if (!metadata.sensitivityLevel) {
      errors.push({
        field: 'metadata.sensitivityLevel',
        fieldLabel: '敏感级别',
        message: '必须选择敏感级别',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    // 标签验证
    if (!metadata.tags || metadata.tags.length === 0) {
      errors.push({
        field: 'metadata.tags',
        fieldLabel: '标签',
        message: '至少需要添加一个标签',
        code: 'REQUIRED_FIELD',
        severity: 'error',
        suggestion: '添加描述资产特征的标签'
      })
    } else if (metadata.tags.length > 20) {
      warnings.push({
        field: 'metadata.tags',
        fieldLabel: '标签',
        message: '标签数量过多,建议不超过20个',
        code: 'TOO_MANY_TAGS',
        severity: 'warning',
        suggestion: '保留最重要的标签'
      })
    }

    // 数据量验证
    if (metadata.dataVolume !== undefined) {
      if (metadata.dataVolume < 0) {
        errors.push({
          field: 'metadata.dataVolume',
          fieldLabel: '数据量',
          message: '数据量不能为负数',
          code: 'INVALID_VALUE',
          severity: 'error'
        })
      }

      if (metadata.dataVolume > 1000000000) {
        warnings.push({
          field: 'metadata.dataVolume',
          fieldLabel: '数据量',
          message: '数据量超过10亿,请确认是否正确',
          code: 'UNUSUALLY_LARGE',
          severity: 'warning'
        })
      }
    }
  }

  /**
   * 验证Schema
   */
  private validateSchema(
    data: AssetFormData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!data.schema || !data.schema.fields || data.schema.fields.length === 0) {
      warnings.push({
        field: 'schema',
        fieldLabel: 'Schema定义',
        message: 'Schema字段列表为空',
        code: 'EMPTY_SCHEMA',
        severity: 'warning',
        suggestion: '添加字段定义以提高资产可用性'
      })
      return
    }

    const fieldNames = new Set<string>()

    data.schema.fields.forEach((field, index) => {
      // 字段名重复检查
      if (fieldNames.has(field.name)) {
        errors.push({
          field: `schema.fields[${index}].name`,
          fieldLabel: `字段 ${field.name}`,
          message: `字段名 "${field.name}" 重复`,
          code: 'DUPLICATE_FIELD_NAME',
          severity: 'error'
        })
      }
      fieldNames.add(field.name)

      // 字段名格式检查
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
        errors.push({
          field: `schema.fields[${index}].name`,
          fieldLabel: `字段 ${field.name}`,
          message: '字段名只能包含字母、数字和下划线,且不能以数字开头',
          code: 'INVALID_FIELD_NAME',
          severity: 'error'
        })
      }

      // 字段类型检查
      if (!field.type) {
        errors.push({
          field: `schema.fields[${index}].type`,
          fieldLabel: `字段 ${field.name}`,
          message: '字段类型不能为空',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      }

      // 字段描述检查
      if (!field.description || field.description.trim() === '') {
        warnings.push({
          field: `schema.fields[${index}].description`,
          fieldLabel: `字段 ${field.name}`,
          message: '建议添加字段描述',
          code: 'MISSING_DESCRIPTION',
          severity: 'info',
          suggestion: '添加字段用途和含义的说明'
        })
      }
    })
  }

  /**
   * 验证业务规则
   */
  private async validateBusinessRules(
    data: AssetFormData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // 检查敏感数据规则
    if (data.metadata?.sensitivityLevel === 'confidential' ||
        data.metadata?.sensitivityLevel === 'restricted') {
      if (!data.metadata?.accessControl) {
        warnings.push({
          field: 'metadata.accessControl',
          fieldLabel: '访问控制',
          message: '敏感数据建议配置访问控制规则',
          code: 'MISSING_ACCESS_CONTROL',
          severity: 'warning',
          suggestion: '为机密或受限数据设置访问控制策略'
        })
      }
    }

    // 检查数据源一致性
    if (data.metadata?.dataSource && data.assetType) {
      // 可以添加数据源和资产类型的匹配规则
    }

    // 检查更新频率合理性
    if (data.metadata?.updateFrequency === 'realtime' &&
        data.metadata?.dataVolume &&
        data.metadata.dataVolume > 10000000) {
      warnings.push({
        field: 'metadata.updateFrequency',
        fieldLabel: '更新频率',
        message: '大数据量资产设置为实时更新可能影响性能',
        code: 'PERFORMANCE_WARNING',
        severity: 'warning',
        suggestion: '考虑使用批量更新方式'
      })
    }
  }

  /**
   * 验证自定义规则
   */
  private validateCustomRules(
    data: AssetFormData,
    errors: ValidationError[]
  ): void {
    this.customRules
      .filter(rule => rule.enabled)
      .forEach(rule => {
        const error = rule.validator(data)
        if (error) {
          errors.push(error)
        }
      })
  }

  /**
   * 计算数据质量指标
   */
  private calculateDataQuality(
    data: AssetFormData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): DataQualityMetrics {
    // 完整性评分 (0-100)
    const completeness = this.calculateCompleteness(data)

    // 一致性评分 (0-100)
    const consistency = Math.max(0, 100 - errors.length * 10)

    // 准确性评分 (0-100)
    const accuracy = Math.max(0, 100 - warnings.length * 5)

    // 及时性评分 (0-100)
    const timeliness = data.metadata?.updateFrequency ? 100 : 80

    // 综合评分
    const overall = Math.round(
      (completeness * 0.3 + consistency * 0.3 + accuracy * 0.2 + timeliness * 0.2)
    )

    return {
      completeness,
      consistency,
      accuracy,
      timeliness,
      overall
    }
  }

  /**
   * 计算完整性评分
   */
  private calculateCompleteness(data: AssetFormData): number {
    const fields = [
      data.name,
      data.description,
      data.categoryId,
      data.ownerId,
      data.assetType,
      data.metadata?.dataSource,
      data.metadata?.updateFrequency,
      data.metadata?.sensitivityLevel,
      data.metadata?.tags?.length,
      data.schema?.fields?.length
    ]

    const filledFields = fields.filter(f => f !== undefined && f !== null && f !== '').length
    return Math.round((filledFields / fields.length) * 100)
  }

  /**
   * 检查资产依赖关系
   */
  async checkDependencies(assetId: string): Promise<DependencyCheck> {
    try {
      const response = await fetch(`/api/assets/${assetId}/dependencies`)

      if (!response.ok) {
        throw new Error('Failed to check dependencies')
      }

      return await response.json()
    } catch (error) {
      console.error('Error checking dependencies:', error)
      return {
        assetId,
        dependencies: [],
        dependents: [],
        circularDependencies: []
      }
    }
  }

  /**
   * 添加自定义验证规则
   */
  addCustomRule(rule: CustomValidationRule): void {
    this.customRules.push(rule)
  }

  /**
   * 移除自定义验证规则
   */
  removeCustomRule(ruleId: string): void {
    this.customRules = this.customRules.filter(r => r.id !== ruleId)
  }

  /**
   * 获取所有自定义规则
   */
  getCustomRules(): CustomValidationRule[] {
    return [...this.customRules]
  }
}

// 导出单例实例
export const assetValidationService = new AssetValidationService()
