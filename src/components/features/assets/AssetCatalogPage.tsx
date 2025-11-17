'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { AssetTree } from './AssetTree'
import { AssetList } from './AssetList'
import { Breadcrumb, CompactBreadcrumb } from '@/components/ui/Breadcrumb'
import { type CategoryTree, type CategoryBreadcrumb, type AssetSummary } from '@/types'
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  Bars3Icon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline'

interface AssetCatalogPageProps {
  initialData?: CategoryTree[]
  onCategorySelect?: (categoryId: string, category: CategoryTree) => void
  onAssetSelect?: (asset: AssetSummary) => void
  className?: string
}

export const AssetCatalogPage: React.FC<AssetCatalogPageProps> = ({
  initialData = [],
  onCategorySelect,
  onAssetSelect,
  className = ''
}) => {
  // 状态管理
  const [treeData, setTreeData] = useState<CategoryTree[]>(initialData)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>()
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([])
  const [breadcrumbPath, setBreadcrumbPath] = useState<CategoryBreadcrumb[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  // 移动端状态
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // 检测屏幕尺寸
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  // 关闭移动端菜单（当屏幕变大时）
  useEffect(() => {
    if (!isMobile) {
      setIsMobileMenuOpen(false)
    }
  }, [isMobile])

  // 构建面包屑路径
  const buildBreadcrumbPath = (categoryId: string, data: CategoryTree[]): CategoryBreadcrumb[] => {
    const findPath = (nodes: CategoryTree[], targetId: string, currentPath: CategoryBreadcrumb[] = []): CategoryBreadcrumb[] | null => {
      for (const node of nodes) {
        const path = [
          ...currentPath,
          {
            id: node.id,
            name: node.name,
            depth: node.depth,
            code: node.code,
            path: node.path
          }
        ]

        if (node.id === targetId) {
          return path
        }

        if (node.children && node.children.length > 0) {
          const found = findPath(node.children, targetId, path)
          if (found) return found
        }
      }
      return null
    }

    return findPath(data, categoryId) || []
  }

  // 处理分类选择
  const handleCategorySelect = (categoryId: string, category: CategoryTree) => {
    setSelectedCategoryId(categoryId)

    // 构建面包屑路径
    const breadcrumbs = buildBreadcrumbPath(categoryId, treeData)
    setBreadcrumbPath(breadcrumbs)

    // 在移动端选择后关闭菜单
    if (isMobile) {
      setIsMobileMenuOpen(false)
    }

    // 触发外部回调
    onCategorySelect?.(categoryId, category)
  }

  // 处理节点展开/收起
  const handleNodeToggle = (nodeId: string, isExpanded: boolean) => {
    setExpandedNodeIds(prev => {
      if (isExpanded) {
        return [...prev, nodeId]
      } else {
        return prev.filter(id => id !== nodeId)
      }
    })
  }

  // 处理面包屑点击
  const handleBreadcrumbClick = (item: CategoryBreadcrumb, index: number) => {
    if (item.id === 'home') {
      setSelectedCategoryId(undefined)
      setBreadcrumbPath([])
      return
    }

    // 找到对应的分类并选择
    const findCategory = (nodes: CategoryTree[], targetId: string): CategoryTree | null => {
      for (const node of nodes) {
        if (node.id === targetId) return node
        if (node.children) {
          const found = findCategory(node.children, targetId)
          if (found) return found
        }
      }
      return null
    }

    const category = findCategory(treeData, item.id)
    if (category) {
      handleCategorySelect(item.id, category)
    }
  }

  // 过滤树数据（搜索功能）
  const filteredTreeData = useMemo(() => {
    if (!searchQuery.trim()) return treeData

    const filterTree = (nodes: CategoryTree[]): CategoryTree[] => {
      return nodes.reduce<CategoryTree[]>((acc, node) => {
        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             node.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             node.code.toLowerCase().includes(searchQuery.toLowerCase())

        const filteredChildren = filterTree(node.children || [])

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren
          })
        }

        return acc
      }, [])
    }

    return filterTree(treeData)
  }, [treeData, searchQuery])

  // 侧边栏内容
  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* 搜索栏 */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索分类..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* 分类树 */}
      <div className="flex-1 overflow-hidden">
        <AssetTree
          data={filteredTreeData}
          loading={loading}
          error={error}
          selectedNodeId={selectedCategoryId}
          expandedNodeIds={expandedNodeIds}
          showAssetCount={true}
          onNodeSelect={handleCategorySelect}
          onNodeToggle={handleNodeToggle}
          className="h-full"
        />
      </div>
    </div>
  )

  return (
    <div className={`h-full flex ${className}`}>
      {/* 桌面端侧边栏 */}
      <div className="hidden md:block w-80 bg-white border-r border-gray-200 flex-shrink-0">
        {sidebarContent}
      </div>

      {/* 移动端侧边栏遮罩 */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 移动端侧边栏 */}
      <div className={`md:hidden fixed inset-y-0 left-0 w-80 bg-white z-50 transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* 移动端头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">分类目录</h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* 侧边栏内容 */}
          <div className="flex-1 overflow-hidden">
            {sidebarContent}
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航栏 */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>

            {/* 面包屑导航 */}
            <div className="flex-1 min-w-0">
              {isMobile ? (
                <CompactBreadcrumb
                  items={breadcrumbPath}
                  onItemClick={handleBreadcrumbClick}
                  className="ml-3"
                />
              ) : (
                <Breadcrumb
                  items={breadcrumbPath}
                  maxItems={4}
                  showHome={true}
                  homeName="数据资产"
                  onItemClick={handleBreadcrumbClick}
                />
              )}
            </div>

            {/* 工具按钮 */}
            <div className="flex items-center space-x-2 ml-4">
              {/* 视图切换指示器 */}
              <div className="hidden sm:flex items-center text-xs text-gray-500">
                {isMobile ? (
                  <DevicePhoneMobileIcon className="h-4 w-4" />
                ) : (
                  <ComputerDesktopIcon className="h-4 w-4" />
                )}
              </div>

              {/* 设置按钮 */}
              <button className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4">
          {selectedCategoryId ? (
            <AssetList
              categoryId={selectedCategoryId}
              categoryName={breadcrumbPath[breadcrumbPath.length - 1]?.name}
              onAssetSelect={onAssetSelect}
              className="h-full"
            />
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ComputerDesktopIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">选择一个分类</h3>
              <p className="text-gray-500 mb-6">从左侧目录中选择一个分类来查看其中的数据资产</p>

              {/* 快速操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="md:hidden px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  浏览分类
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  查看统计
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default AssetCatalogPage