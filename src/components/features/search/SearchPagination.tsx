'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

interface SearchPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export const SearchPagination: React.FC<SearchPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = ''
}) => {
  if (totalPages <= 1) {
    return null
  }

  // 生成页码数组
  const generatePageNumbers = () => {
    const pages: (number | string)[] = []
    const delta = 2 // 当前页前后显示的页数

    if (totalPages <= 7) {
      // 如果总页数<=7，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 总是显示第一页
      pages.push(1)

      // 计算起始和结束页码
      let start = Math.max(2, currentPage - delta)
      let end = Math.min(totalPages - 1, currentPage + delta)

      // 调整范围确保显示足够的页码
      if (currentPage - delta <= 2) {
        end = Math.min(totalPages - 1, 2 + 2 * delta)
      }
      if (currentPage + delta >= totalPages - 1) {
        start = Math.max(2, totalPages - 1 - 2 * delta)
      }

      // 添加左侧省略号
      if (start > 2) {
        pages.push('...')
      }

      // 添加中间页码
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      // 添加右侧省略号
      if (end < totalPages - 1) {
        pages.push('...')
      }

      // 总是显示最后一页
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const pages = generatePageNumbers()

  // 计算显示的条目范围
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page)
    }
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  return (
    <div className={`flex items-center justify-between bg-white px-4 py-3 border-t border-gray-200 sm:px-6 ${className}`}>
      {/* 移动端分页 */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700">
          第 {currentPage} 页，共 {totalPages} 页
        </span>
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>

      {/* 桌面端分页 */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        {/* 结果统计 */}
        <div>
          <p className="text-sm text-gray-700">
            显示第 <span className="font-medium">{startItem}</span> 到{' '}
            <span className="font-medium">{endItem}</span> 条结果，共{' '}
            <span className="font-medium">{totalItems}</span> 条
          </p>
        </div>

        {/* 分页控件 */}
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="分页">
            {/* 上一页按钮 */}
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="上一页"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* 页码按钮 */}
            {pages.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                )
              }

              const pageNumber = Number(page)
              const isCurrentPage = pageNumber === currentPage

              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageClick(pageNumber)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                    isCurrentPage
                      ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-current={isCurrentPage ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              )
            })}

            {/* 下一页按钮 */}
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="下一页"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}