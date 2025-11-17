/**
 * 批量操作类型定义
 * Story 5.6: 批量操作工具
 *
 * 提供批量选择、状态更新、导入导出、撤销等操作的类型定义
 */

/**
 * 批量操作类型枚举
 */
export enum BatchOperationType {
  STATUS_UPDATE = 'status_update',
  DELETE = 'delete',
  IMPORT = 'import',
  EXPORT = 'export',
  METADATA_UPDATE = 'metadata_update',
  CATEGORY_CHANGE = 'category_change',
  TAG_ADD = 'tag_add',
  TAG_REMOVE = 'tag_remove'
}

/**
 * 批量操作状态枚举
 */
export enum BatchOperationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIALLY_COMPLETED = 'partially_completed'
}

/**
 * 资产状态枚举
 */
export enum AssetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived'
}

/**
 * 批量操作基础信息
 */
export interface BatchOperation {
  id: string
  type: BatchOperationType
  status: BatchOperationStatus
  totalItems: number
  processedItems: number
  successItems: number
  failedItems: number
  createdBy: string
  createdByName?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  pausedAt?: Date
  estimatedTimeRemaining?: number
  throughputPerSecond?: number
  metadata: BatchOperationMetadata
  error?: string
  canUndo: boolean
  undoExpiresAt?: Date
}

/**
 * 批量操作元数据
 */
export interface BatchOperationMetadata {
  assetIds: string[]
  operationParams: Record<string, unknown>
  snapshot?: OperationSnapshot
  batchSize?: number
  currentBatch?: number
  totalBatches?: number
}

/**
 * 批量选择状态
 */
export interface BatchSelectionState {
  selectedItems: Set<string>
  selectAll: boolean
  selectionCriteria?: SelectionCriteria
  excludedItems: Set<string>
  totalCount: number
  selectedCount: number
}

/**
 * 选择条件
 */
export interface SelectionCriteria {
  status?: AssetStatus[]
  categories?: string[]
  tags?: string[]
  dateRange?: {
    field: 'createdAt' | 'updatedAt'
    start: Date
    end: Date
  }
  searchQuery?: string
}

/**
 * 批量操作进度信息
 */
export interface BatchOperationProgress {
  operationId: string
  status: BatchOperationStatus
  totalItems: number
  processedItems: number
  successItems: number
  failedItems: number
  currentBatch: number
  totalBatches: number
  progress: number
  estimatedTimeRemaining: number
  throughputPerSecond: number
  lastUpdated: Date
  errors: BatchOperationError[]
}

/**
 * 批量操作错误信息
 */
export interface BatchOperationError {
  itemId: string
  itemName?: string
  error: string
  timestamp: Date
  canRetry: boolean
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  operationId: string
  status: BatchOperationStatus
  totalItems: number
  successItems: number
  failedItems: number
  skippedItems: number
  duration: number
  startedAt: Date
  completedAt: Date
  successIds: string[]
  failedIds: string[]
  errors: BatchOperationError[]
  canUndo: boolean
  undoExpiresAt?: Date
  summary: {
    message: string
    details?: string[]
  }
}

/**
 * 操作快照
 */
export interface OperationSnapshot {
  operationId: string
  operationType: BatchOperationType
  affectedAssets: AssetSnapshot[]
  timestamp: Date
  expiresAt: Date
  metadata: Record<string, unknown>
}

/**
 * 资产快照
 */
export interface AssetSnapshot {
  assetId: string
  assetName: string
  beforeState: Record<string, unknown>
  afterState: Record<string, unknown>
}

/**
 * 批量状态更新参数
 */
export interface BatchStatusUpdateParams {
  assetIds: string[]
  newStatus: AssetStatus
  reason?: string
  effectiveDate?: Date
  notifyOwners?: boolean
  userId: string
}

/**
 * 批量导入选项
 */
export interface BatchImportOptions {
  file: File
  template: ImportTemplate
  skipDuplicates: boolean
  updateExisting: boolean
  validateOnly: boolean
  batchSize?: number
  userId: string
}

/**
 * 导入模板
 */
export interface ImportTemplate {
  id: string
  name: string
  description: string
  requiredFields: ImportField[]
  optionalFields: ImportField[]
  validationRules: ValidationRule[]
  sampleData: Record<string, unknown>[]
  downloadUrl?: string
}

/**
 * 导入字段定义
 */
export interface ImportField {
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'array'
  required: boolean
  description?: string
  example?: string
  validation?: ValidationRule[]
}

/**
 * 验证规则
 */
export interface ValidationRule {
  type: 'required' | 'pattern' | 'range' | 'length' | 'custom'
  params?: Record<string, unknown>
  message: string
}

/**
 * 批量导入结果
 */
export interface BatchImportResult {
  operationId: string
  status: BatchOperationStatus
  totalRows: number
  validRows: number
  invalidRows: number
  importedRows: number
  skippedRows: number
  duration: number
  errors: ImportError[]
  warnings: ImportWarning[]
  preview?: ImportPreview
}

/**
 * 导入错误
 */
export interface ImportError {
  row: number
  field?: string
  value?: unknown
  error: string
  canFix: boolean
}

/**
 * 导入警告
 */
export interface ImportWarning {
  row: number
  field: string
  message: string
  suggestion?: string
}

/**
 * 导入预览
 */
export interface ImportPreview {
  totalRows: number
  validRows: number
  invalidRows: number
  sampleValidRows: Record<string, unknown>[]
  sampleInvalidRows: {
    row: number
    data: Record<string, unknown>
    errors: string[]
  }[]
}

/**
 * 批量导出选项
 */
export interface BatchExportOptions {
  assetIds: string[]
  format: 'csv' | 'excel' | 'json'
  includeFields: string[]
  includeMetadata: boolean
  userId: string
}

/**
 * 批量导出结果
 */
export interface BatchExportResult {
  operationId: string
  status: BatchOperationStatus
  totalItems: number
  exportedItems: number
  fileUrl?: string
  fileName?: string
  fileSize?: number
  format: string
  createdAt: Date
  expiresAt?: Date
}

/**
 * 撤销操作参数
 */
export interface UndoOperationParams {
  operationId: string
  userId: string
  reason?: string
}

/**
 * 撤销操作结果
 */
export interface UndoOperationResult {
  success: boolean
  message: string
  restoredItems: number
  failedItems: number
  errors?: BatchOperationError[]
}

/**
 * 操作历史记录
 */
export interface OperationHistoryRecord {
  id: string
  operationId: string
  type: BatchOperationType
  status: BatchOperationStatus
  totalItems: number
  successItems: number
  failedItems: number
  createdBy: string
  createdByName: string
  createdAt: Date
  completedAt?: Date
  duration?: number
  canUndo: boolean
  undoExpiresAt?: Date
  isUndone: boolean
  undoneAt?: Date
  undoneBy?: string
}

/**
 * 批量操作配置
 */
export interface BatchOperationConfig {
  maxConcurrentOperations: number
  maxItemsPerBatch: number
  defaultBatchSize: number
  undoRetentionDays: number
  maxImportFileSize: number
  allowedImportFormats: string[]
  allowedExportFormats: string[]
}

/**
 * 批量操作统计
 */
export interface BatchOperationStatistics {
  totalOperations: number
  runningOperations: number
  completedOperations: number
  failedOperations: number
  averageDuration: number
  averageSuccessRate: number
  operationsByType: Record<BatchOperationType, number>
  operationsByStatus: Record<BatchOperationStatus, number>
}

/**
 * 默认批量操作配置
 */
export const DEFAULT_BATCH_OPERATION_CONFIG: BatchOperationConfig = {
  maxConcurrentOperations: 5,
  maxItemsPerBatch: 100,
  defaultBatchSize: 50,
  undoRetentionDays: 1,
  maxImportFileSize: 10 * 1024 * 1024, // 10MB
  allowedImportFormats: ['xlsx', 'xls', 'csv'],
  allowedExportFormats: ['xlsx', 'csv', 'json']
}

/**
 * 标准导入模板
 */
export const STANDARD_IMPORT_TEMPLATES: Record<string, Omit<ImportTemplate, 'id'>> = {
  basic: {
    name: '基础资产信息模板',
    description: '用于批量导入资产的基本信息',
    requiredFields: [
      {
        name: 'name',
        label: '资产名称',
        type: 'string',
        required: true,
        description: '资产的唯一标识名称',
        example: 'user_info_table'
      },
      {
        name: 'category',
        label: '资产分类',
        type: 'string',
        required: true,
        description: '资产所属分类',
        example: '数据表'
      },
      {
        name: 'owner',
        label: '负责人',
        type: 'string',
        required: true,
        description: '资产负责人邮箱或ID',
        example: 'user@example.com'
      }
    ],
    optionalFields: [
      {
        name: 'description',
        label: '资产描述',
        type: 'string',
        required: false,
        description: '资产的详细说明',
        example: '用户信息表'
      },
      {
        name: 'tags',
        label: '标签',
        type: 'array',
        required: false,
        description: '资产标签,多个标签用逗号分隔',
        example: 'user,core,production'
      },
      {
        name: 'status',
        label: '状态',
        type: 'string',
        required: false,
        description: '资产状态',
        example: 'active'
      }
    ],
    validationRules: [
      {
        type: 'required',
        params: { fields: ['name', 'category', 'owner'] },
        message: '必填字段不能为空'
      },
      {
        type: 'pattern',
        params: {
          field: 'owner',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        message: '负责人必须是有效的邮箱地址'
      }
    ],
    sampleData: [
      {
        name: 'user_info_table',
        category: '数据表',
        owner: 'admin@example.com',
        description: '用户基本信息表',
        tags: 'user,core',
        status: 'active'
      }
    ]
  },
  detailed: {
    name: '详细资产信息模板',
    description: '用于批量导入资产的详细信息,包含元数据',
    requiredFields: [
      {
        name: 'name',
        label: '资产名称',
        type: 'string',
        required: true,
        example: 'user_info_table'
      },
      {
        name: 'category',
        label: '资产分类',
        type: 'string',
        required: true,
        example: '数据表'
      },
      {
        name: 'owner',
        label: '负责人',
        type: 'string',
        required: true,
        example: 'user@example.com'
      },
      {
        name: 'database',
        label: '所属数据库',
        type: 'string',
        required: true,
        example: 'prod_db'
      }
    ],
    optionalFields: [
      {
        name: 'description',
        label: '资产描述',
        type: 'string',
        required: false,
        example: '用户信息表'
      },
      {
        name: 'dataSource',
        label: '数据源',
        type: 'string',
        required: false,
        example: 'MySQL'
      },
      {
        name: 'updateFrequency',
        label: '更新频率',
        type: 'string',
        required: false,
        example: 'daily'
      },
      {
        name: 'sensitivityLevel',
        label: '敏感级别',
        type: 'string',
        required: false,
        example: 'high'
      }
    ],
    validationRules: [],
    sampleData: []
  }
}
