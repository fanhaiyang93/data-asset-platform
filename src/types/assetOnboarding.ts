/**
 * 资产接入管理相关的TypeScript类型定义
 */

// 资产类型枚举
export enum AssetType {
  TABLE = 'table',
  VIEW = 'view',
  API = 'api',
  FILE = 'file',
  STREAM = 'stream'
}

// 数据源类型枚举
export enum DataSourceType {
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
  ORACLE = 'oracle',
  SQLSERVER = 'sqlserver',
  MONGODB = 'mongodb',
  ELASTICSEARCH = 'elasticsearch',
  HIVE = 'hive',
  CLICKHOUSE = 'clickhouse',
  REDIS = 'redis',
  KAFKA = 'kafka',
  API = 'api',
  FILE = 'file'
}

// 字段数据类型
export enum FieldDataType {
  STRING = 'string',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  TIMESTAMP = 'timestamp',
  TEXT = 'text',
  JSON = 'json',
  BINARY = 'binary'
}

// 资产字段定义
export interface AssetField {
  id?: string
  name: string
  type: FieldDataType
  description?: string
  nullable: boolean
  primaryKey: boolean
  defaultValue?: string
  length?: number
  precision?: number
  scale?: number
  comment?: string
}

// 资产表结构
export interface AssetSchema {
  tableName: string
  fields: AssetField[]
  indexes?: AssetIndex[]
  constraints?: AssetConstraint[]
  partitions?: AssetPartition[]
}

// 索引定义
export interface AssetIndex {
  name: string
  type: 'primary' | 'unique' | 'index' | 'fulltext'
  fields: string[]
  comment?: string
}

// 约束定义
export interface AssetConstraint {
  name: string
  type: 'foreign_key' | 'check' | 'unique'
  fields: string[]
  referenceTable?: string
  referenceFields?: string[]
  condition?: string
}

// 分区定义
export interface AssetPartition {
  type: 'range' | 'hash' | 'list'
  field: string
  partitions: {
    name: string
    value?: string
    condition?: string
  }[]
}

// 资产分类
export interface AssetCategory {
  id: string
  name: string
  code: string
  description?: string
  parentId?: string
  level: number
  path: string
  children?: AssetCategory[]
  createdAt: Date
  updatedAt: Date
}

// 资产元数据
export interface AssetMetadata {
  dataSource: DataSourceType
  connectionString?: string
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'manual'
  dataVolume?: number
  dataQuality?: {
    completeness: number
    accuracy: number
    consistency: number
    timeliness: number
  }
  tags: string[]
  businessGlossary?: string[]
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted'
  retentionPeriod?: number
  accessRequirements?: string[]
}

// 资产表单数据
export interface AssetFormData {
  // 基本信息
  name: string
  displayName?: string
  description: string
  assetType: AssetType
  categoryId: string
  ownerId: string

  // 表结构信息
  schema?: AssetSchema

  // 元数据信息
  metadata: AssetMetadata

  // 状态信息
  status: 'draft' | 'review' | 'active' | 'inactive'

  // 创建信息
  createdBy?: string
  createdAt?: Date
  updatedBy?: string
  updatedAt?: Date
}

// 资产模板类型
export enum TemplateType {
  BUSINESS_TABLE = 'business_table',
  DIMENSION_TABLE = 'dimension_table',
  FACT_TABLE = 'fact_table',
  LOG_TABLE = 'log_table',
  API_INTERFACE = 'api_interface',
  CUSTOM = 'custom'
}

// 资产模板定义
export interface AssetTemplate {
  id: string
  name: string
  type: TemplateType
  description: string
  schema: Partial<AssetFormData>
  isSystem: boolean
  usage: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// 表单验证结果
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// 验证错误
export interface ValidationError {
  field: string
  message: string
  code: string
  severity: 'error' | 'warning'
}

// 验证警告
export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// 导入选项
export interface ImportOptions {
  fileType: 'excel' | 'csv' | 'json' | 'sql'
  hasHeader: boolean
  delimiter?: string
  encoding?: string
  mapping?: FieldMapping[]
}

// 字段映射
export interface FieldMapping {
  sourceField: string
  targetField: string
  transform?: (value: any) => any
}

// 导入结果
export interface ImportResult {
  success: boolean
  totalRecords: number
  successRecords: number
  failedRecords: number
  errors: ImportError[]
  warnings: ImportWarning[]
  previewData?: AssetField[]
}

// 导入错误
export interface ImportError {
  row?: number
  field?: string
  message: string
  rawValue?: any
}

// 导入警告
export interface ImportWarning {
  row?: number
  field?: string
  message: string
  suggestion?: string
}

// 预览数据
export interface PreviewData {
  asset: AssetFormData
  validationResult: ValidationResult
  estimatedSize?: number
  recommendedOptimizations?: string[]
}

// 表单步骤
export enum FormStep {
  TEMPLATE_SELECTION = 'template_selection',
  BASIC_INFO = 'basic_info',
  SCHEMA_DEFINITION = 'schema_definition',
  METADATA = 'metadata',
  PREVIEW = 'preview',
  CONFIRMATION = 'confirmation'
}

// 表单状态
export interface FormState {
  currentStep: FormStep
  completedSteps: FormStep[]
  data: Partial<AssetFormData>
  validationErrors: Record<string, string[]>
  isDirty: boolean
  isSaving: boolean
}

// 快捷操作
export interface QuickAction {
  id: string
  label: string
  icon: string
  templateType: TemplateType
  description: string
}

// 批量操作
export interface BatchOperation {
  type: 'import' | 'export' | 'delete' | 'update'
  assets: string[]
  options?: Record<string, any>
}

// 操作历史
export interface OperationHistory {
  id: string
  type: 'create' | 'update' | 'delete' | 'import' | 'export'
  assetId?: string
  assetName?: string
  userId: string
  userName: string
  timestamp: Date
  details: Record<string, any>
  status: 'success' | 'failed' | 'partial'
}