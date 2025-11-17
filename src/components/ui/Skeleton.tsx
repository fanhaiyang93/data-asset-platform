'use client'

import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
  animate?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = false,
  animate = true
}) => {
  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  return (
    <div
      className={`bg-gray-200 ${animate ? 'animate-pulse' : ''} ${
        rounded ? 'rounded-full' : 'rounded'
      } ${className}`}
      style={style}
    />
  )
}

// 树形结构骨架屏
export const TreeSkeleton: React.FC<{ levels?: number; itemsPerLevel?: number }> = ({
  levels = 3,
  itemsPerLevel = 4
}) => {
  const renderLevel = (level: number, count: number) => {
    return Array.from({ length: count }, (_, index) => (
      <div key={`${level}-${index}`} className="mb-2">
        <div className="flex items-center space-x-3" style={{ paddingLeft: `${level * 16 + 12}px` }}>
          {/* 展开图标 */}
          <Skeleton width={16} height={16} />
          {/* 文件夹图标 */}
          <Skeleton width={20} height={20} />
          {/* 名称 */}
          <Skeleton width={Math.random() * 100 + 80} height={16} />
          {/* 数量标识 */}
          <Skeleton width={24} height={20} rounded />
        </div>

        {/* 子级别（递归减少项目数） */}
        {level < levels - 1 && Math.random() > 0.5 && (
          <div className="mt-1">
            {renderLevel(level + 1, Math.floor(itemsPerLevel / 2))}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="space-y-2 p-4">
      {renderLevel(0, itemsPerLevel)}
    </div>
  )
}

// 面包屑骨架屏
export const BreadcrumbSkeleton: React.FC<{ items?: number }> = ({ items = 3 }) => {
  return (
    <div className="flex items-center space-x-2">
      {Array.from({ length: items }, (_, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <div className="mx-2">
              <Skeleton width={16} height={16} />
            </div>
          )}
          <Skeleton width={Math.random() * 40 + 60} height={16} />
        </React.Fragment>
      ))}
    </div>
  )
}

// 卡片骨架屏
export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      {/* 标题 */}
      <Skeleton width="60%" height={28} />

      {/* 内容行 */}
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            width={index === lines - 1 ? '40%' : '100%'}
            height={16}
          />
        ))}
      </div>

      {/* 底部操作区 */}
      <div className="flex space-x-2 pt-4">
        <Skeleton width={80} height={32} />
        <Skeleton width={60} height={32} />
      </div>
    </div>
  )
}

// 列表项骨架屏
export const ListItemSkeleton: React.FC = () => {
  return (
    <div className="flex items-center space-x-3 p-3 border-b border-gray-100">
      {/* 图标 */}
      <Skeleton width={40} height={40} rounded />

      {/* 内容 */}
      <div className="flex-1 space-y-2">
        <Skeleton width="70%" height={16} />
        <Skeleton width="40%" height={14} />
      </div>

      {/* 右侧信息 */}
      <div className="text-right space-y-1">
        <Skeleton width={60} height={14} />
        <Skeleton width={40} height={12} />
      </div>
    </div>
  )
}

// 统计数据骨架屏
export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
          <Skeleton width="100%" height={14} className="mb-2" />
          <Skeleton width="60%" height={32} className="mb-1" />
          <Skeleton width="40%" height={12} />
        </div>
      ))}
    </div>
  )
}

export default Skeleton