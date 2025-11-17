'use client'

import React, { useMemo } from 'react'
import { ChevronRightIcon, HomeIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { type CategoryBreadcrumb } from '@/types'

interface BreadcrumbItem {
  id: string
  name: string
  href?: string
  current?: boolean
}

interface BreadcrumbProps {
  items: CategoryBreadcrumb[]
  maxItems?: number
  showHome?: boolean
  homeName?: string
  onItemClick?: (item: CategoryBreadcrumb, index: number) => void
  className?: string
  separator?: React.ReactNode
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items = [],
  maxItems = 4,
  showHome = true,
  homeName = '首页',
  onItemClick,
  className = '',
  separator
}) => {
  // 处理面包屑项目显示逻辑
  const displayItems = useMemo(() => {
    if (!items || items.length === 0) {
      return showHome ? [{ id: 'home', name: homeName, depth: -1, code: 'home' }] : []
    }

    let breadcrumbItems = [...items]

    // 如果显示首页，在开头添加
    if (showHome) {
      breadcrumbItems.unshift({ id: 'home', name: homeName, depth: -1, code: 'home' })
    }

    // 如果超过最大显示数量，进行省略处理
    if (breadcrumbItems.length > maxItems && maxItems > 2) {
      const keepStart = 1 // 保留首页
      const keepEnd = maxItems - 2 // 保留最后几项，留一个位置给省略号

      return [
        ...breadcrumbItems.slice(0, keepStart),
        { id: 'ellipsis', name: '...', depth: -2, code: 'ellipsis' }, // 省略号标识
        ...breadcrumbItems.slice(-keepEnd)
      ]
    }

    return breadcrumbItems
  }, [items, maxItems, showHome, homeName])

  // 处理项目点击
  const handleItemClick = (item: CategoryBreadcrumb, index: number, e: React.MouseEvent) => {
    e.preventDefault()

    // 省略号项目不可点击
    if (item.id === 'ellipsis') {
      return
    }

    // 首页项目处理
    if (item.id === 'home') {
      onItemClick?.(item, -1)
      return
    }

    onItemClick?.(item, index)
  }

  // 默认分隔符
  const defaultSeparator = <ChevronRightIcon className="h-4 w-4 text-gray-400" />

  // 如果没有项目，不渲染
  if (displayItems.length === 0) {
    return null
  }

  return (
    <nav className={`flex ${className}`} aria-label="面包屑导航">
      <ol className="flex items-center space-x-2 text-sm">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1
          const isEllipsis = item.id === 'ellipsis'
          const isHome = item.id === 'home'
          const isClickable = onItemClick && !isEllipsis && !isLast

          return (
            <li key={item.id} className="flex items-center">
              {/* 分隔符 */}
              {index > 0 && (
                <span className="mx-2 flex-shrink-0">
                  {separator || defaultSeparator}
                </span>
              )}

              {/* 面包屑项目 */}
              <div className="flex items-center">
                {/* 首页图标 */}
                {isHome && (
                  <HomeIcon className="h-4 w-4 mr-1 text-gray-500" />
                )}

                {/* 项目内容 */}
                {isClickable ? (
                  <button
                    onClick={(e) => handleItemClick(item, index, e)}
                    className={`font-medium transition-colors duration-150 ${
                      isLast
                        ? 'text-gray-900 cursor-default'
                        : 'text-blue-600 hover:text-blue-800 hover:underline'
                    }`}
                    title={item.name}
                    disabled={isLast}
                  >
                    <span className={isEllipsis ? 'px-1' : 'truncate max-w-[120px] sm:max-w-[200px]'}>
                      {item.name}
                    </span>
                  </button>
                ) : (
                  <span
                    className={`font-medium ${
                      isLast
                        ? 'text-gray-900'
                        : isEllipsis
                        ? 'text-gray-500 px-1'
                        : 'text-gray-600'
                    }`}
                    title={!isEllipsis ? item.name : undefined}
                  >
                    <span className={isEllipsis ? '' : 'truncate max-w-[120px] sm:max-w-[200px]'}>
                      {item.name}
                    </span>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// 高级面包屑组件，支持展开长路径
interface ExpandableBreadcrumbProps extends BreadcrumbProps {
  expandText?: string
  collapseText?: string
}

export const ExpandableBreadcrumb: React.FC<ExpandableBreadcrumbProps> = ({
  items = [],
  maxItems = 4,
  expandText = '显示完整路径',
  collapseText = '收起路径',
  ...props
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const shouldShowExpand = items.length > maxItems

  if (!shouldShowExpand) {
    return <Breadcrumb items={items} maxItems={maxItems} {...props} />
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={items}
          maxItems={isExpanded ? Infinity : maxItems}
          {...props}
        />

        {shouldShowExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-4 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
          >
            {isExpanded ? collapseText : expandText}
          </button>
        )}
      </div>
    </div>
  )
}

// 紧凑型面包屑，适用于移动端
export const CompactBreadcrumb: React.FC<BreadcrumbProps> = ({
  items = [],
  onItemClick,
  className = '',
  ...props
}) => {
  if (items.length === 0) return null

  const currentItem = items[items.length - 1]
  const hasParent = items.length > 1

  return (
    <nav className={`flex items-center ${className}`} aria-label="面包屑导航">
      {hasParent && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault()
              const parentItem = items[items.length - 2]
              onItemClick?.(parentItem, items.length - 2)
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
          >
            <ChevronRightIcon className="h-4 w-4 mr-1 rotate-180" />
            返回
          </button>
          <span className="mx-2 text-gray-400">|</span>
        </>
      )}

      <span className="text-gray-900 font-medium text-sm truncate">
        {currentItem.name}
      </span>
    </nav>
  )
}

export default Breadcrumb