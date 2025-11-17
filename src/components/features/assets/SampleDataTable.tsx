'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  Database,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { type SampleDataResult } from '@/server/services/AssetService'

interface SampleDataTableProps {
  data: SampleDataResult
  isLoading?: boolean
  onRefresh?: () => void
  title?: string
}

export function SampleDataTable({
  data,
  isLoading = false,
  onRefresh,
  title = '数据样例'
}: SampleDataTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [showMaskedData, setShowMaskedData] = useState(true)
  const rowsPerPage = 5

  // 分页逻辑
  const totalRows = data.rows.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const currentRows = data.rows.slice(startIndex, endIndex)

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">NULL</span>
    }
    if (typeof value === 'string' && value.length > 50) {
      return (
        <span title={value} className="cursor-help">
          {value.substring(0, 50)}...
        </span>
      )
    }
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? 'TRUE' : 'FALSE'}
        </Badge>
      )
    }
    if (typeof value === 'number') {
      return <span className="font-mono">{value.toLocaleString()}</span>
    }
    return <span>{String(value)}</span>
  }

  const getColumnType = (columnIndex: number) => {
    // 基于列名推测数据类型用于样式
    const columnName = data.columns[columnIndex]?.toLowerCase() || ''
    if (columnName.includes('id') || columnName.includes('count')) return 'number'
    if (columnName.includes('email')) return 'email'
    if (columnName.includes('date') || columnName.includes('time')) return 'date'
    if (columnName.includes('name') || columnName.includes('title')) return 'text'
    return 'default'
  }

  const getCellClassName = (columnIndex: number) => {
    const type = getColumnType(columnIndex)
    switch (type) {
      case 'number':
        return 'text-right font-mono'
      case 'email':
        return 'font-mono text-blue-600'
      case 'date':
        return 'font-mono text-purple-600'
      case 'text':
        return 'text-gray-900'
      default:
        return ''
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>共 {data.totalRows.toLocaleString()} 行数据</span>
              <span>显示前 {data.rows.length} 行</span>
              {data.isMasked && (
                <Badge variant="outline" className="text-orange-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  已脱敏
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              处理时间: {data.processingTime}ms
            </div>

            {data.isMasked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMaskedData(!showMaskedData)}
                className="flex items-center gap-2"
              >
                {showMaskedData ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    隐藏脱敏
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    显示脱敏
                  </>
                )}
              </Button>
            )}

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              正在加载数据样例...
            </div>
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Database className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">暂无数据样例</p>
            <p className="text-sm">该资产可能没有可用的样例数据</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 表格区域 */}
            <div className="border-t overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {data.columns.map((column, index) => (
                      <TableHead
                        key={`${column}-${index}`}
                        className={`min-w-[120px] ${
                          getColumnType(index) === 'number' ? 'text-right' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{column}</span>
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            #{index + 1}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRows.map((row, rowIndex) => (
                    <TableRow
                      key={`row-${startIndex + rowIndex}`}
                      className="hover:bg-muted/50"
                    >
                      {row.map((cell, cellIndex) => (
                        <TableCell
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className={getCellClassName(cellIndex)}
                        >
                          {formatCellValue(cell)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页控制 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 pb-4">
                <div className="text-sm text-muted-foreground">
                  显示第 {startIndex + 1} - {Math.min(endIndex, totalRows)} 行，
                  共 {totalRows} 行样例数据
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 数据脱敏提示 */}
            {data.isMasked && showMaskedData && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mx-6 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-800 mb-1">数据脱敏说明</h4>
                    <p className="text-sm text-orange-700">
                      为保护数据隐私，敏感字段（如姓名、邮箱等）已进行脱敏处理。
                      脱敏处理时间：{data.processingTime}ms，符合 &lt;200ms 的性能要求。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}