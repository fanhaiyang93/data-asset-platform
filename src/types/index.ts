// 分层目录展示相关类型定义

export interface CategoryTree {
  id: string
  name: string
  description?: string
  code: string
  depth: number
  path?: string
  sortOrder: number
  isActive: boolean
  assetCount: number
  children: CategoryTree[]
  parentId?: string
  createdAt: Date
  updatedAt: Date
  _count?: {
    assets: number
    children: number
  }
}

export interface CategoryBreadcrumb {
  id: string
  name: string
  depth: number
  code: string
  path?: string
}

export interface AssetTreeState {
  expandedNodes: Set<string>
  selectedNode?: string
  loading: boolean
  error?: string
}

export interface TreeNodeProps {
  node: CategoryTree
  level: number
  isExpanded: boolean
  isSelected: boolean
  onToggle: (nodeId: string) => void
  onSelect: (nodeId: string) => void
  showCount?: boolean
}

// 资产列表展示相关类型定义

export type AssetStatus = 'AVAILABLE' | 'MAINTENANCE' | 'DEPRECATED' | 'DRAFT'
export type AssetSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'

export interface AssetSummary {
  id: string
  name: string
  description?: string
  status: AssetStatus
  sensitivity?: AssetSensitivity
  updatedAt: Date
  owner?: string
  viewCount?: number
  category?: {
    id: string
    name: string
    code: string
  }
}

export interface AssetListResponse {
  assets: AssetSummary[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}

export interface AssetListParams {
  categoryId: string
  page?: number
  limit?: number
  sortBy?: 'name' | 'updatedAt' | 'viewCount'
  sortOrder?: 'asc' | 'desc'
}

export interface AssetListState {
  assets: AssetSummary[]
  loading: boolean
  error?: string
  total: number
  hasMore: boolean
  page: number
  limit: number
  sortBy: 'name' | 'updatedAt' | 'viewCount'
  sortOrder: 'asc' | 'desc'
}

export interface AssetPreview {
  id: string
  name: string
  description?: string
  status: AssetStatus
  owner?: string
  updatedAt: Date
  viewCount?: number
  metadata?: {
    format?: string
    size?: string
    recordCount?: string
    qualityScore?: number
  }
}