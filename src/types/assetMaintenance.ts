/**
 * 资产编辑与维护相关的TypeScript类型定义
 * Story 5.3: 资产编辑与维护
 */

import { AssetFormData, AssetMetadata, AssetSchema } from './assetOnboarding'

// 资产状态枚举
export enum AssetStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated'
}

// 变更类型枚举
export enum ChangeType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  DELETE = 'DELETE',
  BULK_UPDATE = 'BULK_UPDATE'
}

// 资产版本信息
export interface AssetVersion {
  id: string
  assetId: string
  versionNumber: number
  changeType: ChangeType
  changedFields: string[]
  previousData: Partial<AssetFormData>
  newData: Partial<AssetFormData>
  changeReason?: string
  changedBy: string
  changedByName?: string
  changedAt: Date
  approved: boolean
  approvedBy?: string
  approvedByName?: string
  approvedAt?: Date
}

// 版本比较结果
export interface VersionComparison {
  versionA: AssetVersion
  versionB: AssetVersion
  differences: FieldDifference[]
  impactAnalysis?: {
    affectedSystems: string[]
    riskLevel: 'low' | 'medium' | 'high'
    recommendations: string[]
  }
}

// 字段差异
export interface FieldDifference {
  field: string
  fieldLabel: string
  oldValue: any
  newValue: any
  changeType: 'added' | 'removed' | 'modified'
}

// 批量操作类型
export enum BatchOperationType {
  STATUS_UPDATE = 'status_update',
  TAG_MANAGEMENT = 'tag_management',
  CATEGORY_CHANGE = 'category_change',
  METADATA_UPDATE = 'metadata_update',
  BULK_DELETE = 'bulk_delete'
}

// 批量编辑配置
export interface BatchEditConfig {
  operationType: BatchOperationType
  assetIds: string[]
  changes: Partial<AssetFormData>
  reason?: string
  requireApproval: boolean
}

// 批量操作结果
export interface BatchOperationResult {
  totalAssets: number
  successCount: number
  failedCount: number
  skippedCount: number
  results: BatchItemResult[]
  errors: BatchError[]
}

// 单个批量操作结果
export interface BatchItemResult {
  assetId: string
  assetName: string
  status: 'success' | 'failed' | 'skipped'
  message?: string
  error?: string
}

// 批量操作错误
export interface BatchError {
  assetId: string
  assetName: string
  field?: string
  error: string
  code: string
}

// 变更审核规则
export interface ApprovalRule {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: number
  conditions: ApprovalCondition[]
  approvers: string[]
  requireAllApprovers: boolean
}

// 审核条件
export interface ApprovalCondition {
  type: 'field_change' | 'status_change' | 'batch_threshold' | 'sensitivity_level'
  field?: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in'
  value: any
}

// 变更审核请求
export interface ChangeApprovalRequest {
  id: string
  type: ChangeType
  assetId?: string
  assetName?: string
  batchConfig?: BatchEditConfig
  requestedBy: string
  requestedByName?: string
  requestedAt: Date
  reason?: string
  changes: Partial<AssetFormData>
  previousData?: Partial<AssetFormData>
  status: ApprovalStatus
  approvalHistory: ApprovalAction[]
  requiredApprovers: string[]
  currentApprovers: string[]
}

// 审核状态
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

// 审核操作
export interface ApprovalAction {
  id: string
  requestId: string
  approver: string
  approverName?: string
  action: 'approve' | 'reject' | 'request_changes'
  comments?: string
  timestamp: Date
}

// 资产编辑表单配置
export interface AssetEditFormConfig {
  assetId: string
  editableFields: EditableField[]
  readOnlyFields: string[]
  requiredFields: string[]
  validationRules: ValidationRule[]
  enableVersioning: boolean
  requireApproval: boolean
}

// 可编辑字段
export interface EditableField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean' | 'richtext' | 'tags'
  placeholder?: string
  options?: { value: string; label: string }[]
  validation?: ValidationRule
  helpText?: string
  requireApproval?: boolean
}

// 验证规则
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any) => boolean
}

// 标签管理
export interface TagManagement {
  assetId: string
  currentTags: string[]
  suggestedTags: string[]
  popularTags: string[]
  recentTags: string[]
}

// 关键词管理
export interface KeywordManagement {
  assetId: string
  keywords: string[]
  autoExtractedKeywords: string[]
  userDefinedKeywords: string[]
}

// 资产编辑状态
export interface AssetEditState {
  assetId: string
  originalData: AssetFormData
  currentData: Partial<AssetFormData>
  changedFields: string[]
  isDirty: boolean
  isValid: boolean
  isSaving: boolean
  validationErrors: Record<string, string>
  optimisticLockVersion: number
}

// 乐观锁配置
export interface OptimisticLockConfig {
  enabled: boolean
  versionField: string
  conflictResolution: 'fail' | 'merge' | 'overwrite' | 'prompt'
}

// 编辑冲突信息
export interface EditConflict {
  assetId: string
  field: string
  yourValue: any
  currentValue: any
  lastModifiedBy: string
  lastModifiedAt: Date
  resolution?: 'keep_yours' | 'use_current' | 'merge'
}

// 变更日志条目
export interface ChangeLogEntry {
  id: string
  assetId: string
  assetName: string
  versionId: string
  changeType: ChangeType
  summary: string
  details: string
  changedFields: string[]
  changedBy: string
  changedByName?: string
  changedAt: Date
  approved: boolean
  approvedBy?: string
  approvedAt?: Date
}

// 搜索和筛选配置
export interface ChangeLogFilter {
  assetIds?: string[]
  changeTypes?: ChangeType[]
  changedBy?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  approvalStatus?: boolean
  searchQuery?: string
}

// 版本恢复配置
export interface VersionRestoreConfig {
  versionId: string
  assetId: string
  fields?: string[]
  reason?: string
  requireApproval: boolean
}

// 版本恢复结果
export interface VersionRestoreResult {
  success: boolean
  restoredVersion: number
  conflicts: EditConflict[]
  newVersionId?: string
  message: string
}

// 资产校验结果
export interface AssetValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  dataQuality?: DataQualityMetrics
}

// 数据质量指标
export interface DataQualityMetrics {
  completeness: number
  consistency: number
  accuracy: number
  timeliness: number
  overall: number
}

// 校验错误
export interface ValidationError {
  field: string
  fieldLabel: string
  message: string
  code: string
  severity: 'error' | 'critical'
  suggestion?: string
}

// 校验警告
export interface ValidationWarning {
  field: string
  fieldLabel: string
  message: string
  code: string
  severity: 'warning' | 'info'
  suggestion?: string
}

// 自定义校验规则
export interface CustomValidationRule {
  id: string
  name: string
  description: string
  field?: string
  validator: (data: AssetFormData) => ValidationError | null
  enabled: boolean
}

// 依赖关系检查
export interface DependencyCheck {
  assetId: string
  dependencies: AssetDependency[]
  dependents: AssetDependency[]
  circularDependencies: string[][]
}

// 资产依赖关系
export interface AssetDependency {
  assetId: string
  assetName: string
  dependencyType: 'schema' | 'data' | 'business' | 'technical'
  description?: string
  impact: 'low' | 'medium' | 'high'
}

// 权限检查结果
export interface PermissionCheckResult {
  canEdit: boolean
  canEditFields: string[]
  canChangeStatus: boolean
  canDelete: boolean
  canApprove: boolean
  restrictions: string[]
}
