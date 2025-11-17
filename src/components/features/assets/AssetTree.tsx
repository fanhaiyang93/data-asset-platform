'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ScaleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { type CategoryTree, type TreeNodeProps } from '@/types'
import { TreeSkeleton } from '@/components/ui/Skeleton'
import { trpc } from '@/lib/trpc'

// localStorage 键名
const STORAGE_KEY = 'asset-tree-expanded-nodes'

// 获取分类图标的工具函数
const getCategoryIcon = (category: CategoryTree, isExpanded: boolean) => {
  const { code, name, depth } = category

  // 业务域级别的特定图标
  if (depth === 0) {
    if (code.includes('hr') || name.includes('人力') || name.includes('人事')) {
      return <BuildingOfficeIcon className="w-5 h-5 text-blue-500" />
    }
    if (code.includes('finance') || name.includes('财务') || name.includes('会计')) {
      return <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
    }
    if (code.includes('legal') || name.includes('法务') || name.includes('法律')) {
      return <ScaleIcon className="w-5 h-5 text-purple-500" />
    }
  }

  // 有子节点的文件夹图标
  if (category.children && category.children.length > 0) {
    return isExpanded ? (
      <FolderOpenIcon className="w-5 h-5 text-blue-500" />
    ) : (
      <FolderIcon className="w-5 h-5 text-gray-500" />
    )
  }

  // 叶子节点使用文档图标
  return <DocumentTextIcon className="w-5 h-5 text-gray-400" />
}

// 扩展的树节点属性
interface ExtendedTreeNodeProps extends TreeNodeProps {
  expandedNodes?: Set<string>
  selectedNodeId?: string
}

// 树节点组件
const TreeNode = React.memo<ExtendedTreeNodeProps>(({
  node,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  showCount = true,
  expandedNodes,
  selectedNodeId
}) => {
  // 使用外部状态覆盖内部props
  const actualIsExpanded = expandedNodes ? expandedNodes.has(node.id) : isExpanded
  const actualIsSelected = selectedNodeId ? selectedNodeId === node.id : isSelected
  const hasChildren = node.children && node.children.length > 0
  const indentLevel = level * 16 // 16px per level

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggle(node.id)
    }
  }, [hasChildren, onToggle, node.id])

  const handleSelect = useCallback(() => {
    onSelect(node.id)
  }, [onSelect, node.id])

  return (
    <div className="select-none">
      {/* 当前节点 */}
      <div
        className={`
          flex items-center py-2 md:py-3 px-2 md:px-3 cursor-pointer transition-colors duration-150 touch-manipulation
          ${actualIsSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-500'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700'
          }
          ${level === 0 ? 'font-medium' : ''}
        `}
        style={{ paddingLeft: `${8 + indentLevel}px` }}
        onClick={handleSelect}
      >
        {/* 展开/收起图标 */}
        <button
          onClick={handleToggle}
          className={`
            mr-1 md:mr-2 p-1 rounded-md transition-colors touch-manipulation
            hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600
            ${!hasChildren ? 'invisible' : ''}
          `}
          aria-label={actualIsExpanded ? '收起' : '展开'}
        >
          {hasChildren && (
            actualIsExpanded ? (
              <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 md:w-4 md:h-4" />
            )
          )}
        </button>

        {/* 分类图标 */}
        <div className="mr-2 md:mr-3 flex-shrink-0">
          {getCategoryIcon(node, actualIsExpanded)}
        </div>

        {/* 分类名称 */}
        <span className="flex-1 text-sm md:text-base truncate font-medium" title={node.name}>
          {node.name}
        </span>

        {/* 资产数量 */}
        {showCount && (node._count?.assets || node.assetCount || 0) > 0 && (
          <span className={`
            flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium
            ${actualIsSelected
              ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }
          `}>
            {node._count?.assets || node.assetCount || 0}
          </span>
        )}
      </div>

      {/* 子节点 */}
      {hasChildren && actualIsExpanded && (
        <div className="border-l border-gray-200 dark:border-gray-700 ml-4 md:ml-6">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              isExpanded={false} // 占位符，实际由外部状态控制
              isSelected={false} // 占位符，实际由外部状态控制
              onToggle={onToggle}
              onSelect={onSelect}
              showCount={showCount}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  )
})

TreeNode.displayName = 'TreeNode'

interface AssetTreeProps {
  onCategorySelect?: (category: CategoryTree) => void
  showCounts?: boolean
  initialExpandedNodes?: string[]
  className?: string
  rootId?: string
}

export const AssetTree: React.FC<AssetTreeProps> = ({
  onCategorySelect,
  showCounts = true,
  initialExpandedNodes = [],
  className = '',
  rootId
}) => {
  // 状态管理
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(initialExpandedNodes))
  const [selectedNode, setSelectedNode] = useState<string | undefined>()

  // 从localStorage加载展开状态
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const expandedNodeIds = JSON.parse(saved)
        setExpandedNodes(new Set(expandedNodeIds))
      }
    } catch (error) {
      console.warn('Failed to load expanded nodes from localStorage:', error)
    }
  }, [])

  // 保存展开状态到localStorage
  const saveExpandedNodes = useCallback((expandedNodes: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedNodes)))
    } catch (error) {
      console.warn('Failed to save expanded nodes to localStorage:', error)
    }
  }, [])

  // 获取分类树数据
  const { data: categoryTree, isLoading, error, refetch } = trpc.assets.getCategoryTreeWithStats.useQuery({
    rootId
  })

  // 切换展开/收起状态
  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newExpandedNodes = new Set(prev)

      if (newExpandedNodes.has(nodeId)) {
        newExpandedNodes.delete(nodeId)
      } else {
        newExpandedNodes.add(nodeId)
      }

      saveExpandedNodes(newExpandedNodes)
      return newExpandedNodes
    })
  }, [saveExpandedNodes])

  // 选择节点并触发回调
  const handleSelect = useCallback((nodeId: string) => {
    setSelectedNode(nodeId)

    // 查找选中的分类并回调
    const findNode = (nodes: CategoryTree[], id: string): CategoryTree | null => {
      for (const node of nodes) {
        if (node.id === id) return node
        if (node.children) {
          const found = findNode(node.children, id)
          if (found) return found
        }
      }
      return null
    }

    if (categoryTree && onCategorySelect) {
      const selectedCategory = findNode(categoryTree, nodeId)
      if (selectedCategory) {
        onCategorySelect(selectedCategory)
      }
    }
  }, [categoryTree, onCategorySelect])

  // 递归渲染树节点
  const renderTreeNodes = useCallback((nodes: CategoryTree[], level: number = 0) => {
    return nodes.map((node) => (
      <TreeNode
        key={node.id}
        node={node}
        level={level}
        isExpanded={expandedNodes.has(node.id)}
        isSelected={selectedNode === node.id}
        onToggle={handleToggle}
        onSelect={handleSelect}
        showCount={showCounts}
        expandedNodes={expandedNodes}
        selectedNodeId={selectedNode}
      />
    ))
  }, [expandedNodes, selectedNode, handleToggle, handleSelect, showCounts])

  // 记忆化的树节点渲染
  const treeNodes = useMemo(() => {
    if (!categoryTree) return null
    return renderTreeNodes(categoryTree)
  }, [categoryTree, renderTreeNodes])

  // 加载状态
  if (isLoading) {
    return (
      <div className={`${className}`}>
        <TreeSkeleton levels={3} itemsPerLevel={5} />
        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">加载分类树...</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`${className} p-4`}>
        <div className="text-center text-red-600">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-red-800">加载分类树失败</h3>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  // 空状态
  if (!categoryTree || categoryTree.length === 0) {
    return (
      <div className={`${className} p-4`}>
        <div className="text-center text-gray-500">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无分类数据</h3>
          <p className="mt-1 text-sm text-gray-500">请联系管理员创建数据资产分类</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700 ${className}`}>
      {/* 响应式容器 */}
      <div className="max-h-96 md:max-h-[500px] overflow-y-auto">
        <div className="min-h-0">
          {treeNodes}
        </div>
      </div>
    </div>
  )
}

export default AssetTree