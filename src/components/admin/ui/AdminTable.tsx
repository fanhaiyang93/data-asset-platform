'use client'

import * as React from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminButton } from './AdminButton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableAction, BatchAction } from '@/types/admin'

interface AdminTableColumn<T = any> {
  key: string
  title: string
  dataIndex?: keyof T
  render?: (value: any, record: T, index: number) => React.ReactNode
  sortable?: boolean
  width?: string | number
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
}

interface AdminTableProps<T = any> {
  columns: AdminTableColumn<T>[]
  data: T[]
  rowKey: keyof T | ((record: T) => string)
  loading?: boolean
  selectable?: boolean
  selectedRowKeys?: string[]
  onSelectionChange?: (selectedRowKeys: string[], selectedRows: T[]) => void
  actions?: TableAction<T>[]
  batchActions?: BatchAction<T>[]
  pagination?: {
    current: number
    pageSize: number
    total: number
    onChange: (page: number, pageSize: number) => void
  }
  className?: string
  emptyText?: string
  size?: 'default' | 'small' | 'large'
}

export function AdminTable<T = any>({
  columns,
  data,
  rowKey,
  loading = false,
  selectable = false,
  selectedRowKeys = [],
  onSelectionChange,
  actions = [],
  batchActions = [],
  pagination,
  className,
  emptyText = '暂无数据',
  size = 'default'
}: AdminTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)

  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record)
    }
    return String(record[rowKey])
  }

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' }
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return null
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return

    if (checked) {
      const allKeys = data.map((record, index) => getRowKey(record, index))
      onSelectionChange(allKeys, data)
    } else {
      onSelectionChange([], [])
    }
  }

  const handleSelectRow = (record: T, index: number, checked: boolean) => {
    if (!onSelectionChange) return

    const key = getRowKey(record, index)
    let newSelectedKeys: string[]
    let newSelectedRows: T[]

    if (checked) {
      newSelectedKeys = [...selectedRowKeys, key]
      newSelectedRows = data.filter((item, idx) =>
        newSelectedKeys.includes(getRowKey(item, idx))
      )
    } else {
      newSelectedKeys = selectedRowKeys.filter(k => k !== key)
      newSelectedRows = data.filter((item, idx) =>
        newSelectedKeys.includes(getRowKey(item, idx))
      )
    }

    onSelectionChange(newSelectedKeys, newSelectedRows)
  }

  const renderActions = (record: T) => {
    if (actions.length === 0) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AdminButton variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </AdminButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((action, index) => {
            if (action.visible && !action.visible(record)) return null

            const isDisabled = action.disabled ? action.disabled(record) : false

            return (
              <React.Fragment key={action.id}>
                <DropdownMenuItem
                  disabled={isDisabled}
                  onClick={() => !isDisabled && action.onClick(record)}
                  className={cn(
                    action.variant === 'destructive' && 'text-red-600 focus:text-red-600'
                  )}
                >
                  {action.icon && (
                    <span className="mr-2 h-4 w-4 flex items-center">
                      {action.icon}
                    </span>
                  )}
                  {action.label}
                </DropdownMenuItem>
                {index < actions.length - 1 && <DropdownMenuSeparator />}
              </React.Fragment>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const sizeClasses = {
    small: 'text-sm',
    default: '',
    large: 'text-base'
  }

  const paddingClasses = {
    small: 'px-2 py-1',
    default: 'px-4 py-3',
    large: 'px-6 py-4'
  }

  if (loading) {
    return (
      <div className="border rounded-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* 批量操作栏 */}
      {selectable && selectedRowKeys.length > 0 && batchActions.length > 0 && (
        <div className="bg-blue-50 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              已选择 {selectedRowKeys.length} 项
            </span>
            <div className="flex items-center space-x-2">
              {batchActions.map(action => {
                const selectedRows = data.filter((item, idx) =>
                  selectedRowKeys.includes(getRowKey(item, idx))
                )
                const isDisabled = action.disabled ? action.disabled(selectedRows) : false

                return (
                  <AdminButton
                    key={action.id}
                    variant={action.variant === 'destructive' ? 'danger' : 'admin'}
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && action.onClick(selectedRows)}
                  >
                    {action.icon && <span className="mr-1">{action.icon}</span>}
                    {action.label}
                  </AdminButton>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className={cn('w-full', sizeClasses[size])}>
          <thead className="bg-gray-50 border-b">
            <tr>
              {selectable && (
                <th className={cn('text-left', paddingClasses[size])}>
                  <Checkbox
                    checked={
                      data.length > 0 && selectedRowKeys.length === data.length
                    }
                    indeterminate={
                      selectedRowKeys.length > 0 && selectedRowKeys.length < data.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              )}

              {columns.map(column => (
                <th
                  key={column.key}
                  className={cn(
                    'font-medium text-gray-900',
                    paddingClasses[size],
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortConfig?.key === column.key ? (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : (
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}

              {actions.length > 0 && (
                <th className={cn('text-center', paddingClasses[size])}>
                  操作
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)
                  }
                  className="text-center py-12 text-gray-500"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((record, index) => {
                const key = getRowKey(record, index)
                const isSelected = selectedRowKeys.includes(key)

                return (
                  <tr
                    key={key}
                    className={cn(
                      'hover:bg-gray-50',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    {selectable && (
                      <td className={paddingClasses[size]}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={checked =>
                            handleSelectRow(record, index, Boolean(checked))
                          }
                        />
                      </td>
                    )}

                    {columns.map(column => (
                      <td
                        key={column.key}
                        className={cn(
                          paddingClasses[size],
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {column.render
                          ? column.render(
                              column.dataIndex ? record[column.dataIndex] : record,
                              record,
                              index
                            )
                          : column.dataIndex
                          ? String(record[column.dataIndex] || '')
                          : ''}
                      </td>
                    ))}

                    {actions.length > 0 && (
                      <td className={cn('text-center', paddingClasses[size])}>
                        {renderActions(record)}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {pagination && (
        <div className="bg-white border-t px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            显示第 {((pagination.current - 1) * pagination.pageSize) + 1} 到{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} 项，
            共 {pagination.total} 项
          </div>
          <div className="flex items-center space-x-2">
            <AdminButton
              variant="outline"
              size="sm"
              disabled={pagination.current <= 1}
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
            >
              上一页
            </AdminButton>
            <span className="text-sm">
              第 {pagination.current} 页，共 {Math.ceil(pagination.total / pagination.pageSize)} 页
            </span>
            <AdminButton
              variant="outline"
              size="sm"
              disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
            >
              下一页
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  )
}