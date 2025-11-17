'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  Search,
  Key,
  Link,
  Copy,
  FileDown,
  Filter,
  CheckCircle
} from 'lucide-react'
import { type TableColumn } from '@/server/services/AssetService'

interface TableSchemaDisplayProps {
  columns: TableColumn[]
  indexes?: string[]
  constraints?: string[]
  onCopySchema?: () => void
  onExportSchema?: () => void
}

export function TableSchemaDisplay({
  columns,
  indexes = [],
  constraints = [],
  onCopySchema,
  onExportSchema
}: TableSchemaDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'primaryKey' | 'foreignKey' | 'nullable'>('all')

  // 过滤和搜索逻辑
  const filteredColumns = useMemo(() => {
    let filtered = columns

    // 根据筛选类型过滤
    if (filterType !== 'all') {
      filtered = filtered.filter(column => {
        switch (filterType) {
          case 'primaryKey':
            return column.isPrimaryKey
          case 'foreignKey':
            return column.isForeignKey
          case 'nullable':
            return column.nullable
          default:
            return true
        }
      })
    }

    // 根据搜索词过滤
    if (searchTerm) {
      filtered = filtered.filter(column =>
        column.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        column.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        column.comment?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }, [columns, searchTerm, filterType])

  const handleCopySchema = () => {
    const schemaText = columns.map(column => {
      const constraints = []
      if (column.isPrimaryKey) constraints.push('PRIMARY KEY')
      if (column.isForeignKey) constraints.push('FOREIGN KEY')
      if (!column.nullable) constraints.push('NOT NULL')
      if (column.defaultValue) constraints.push(`DEFAULT ${column.defaultValue}`)

      return `${column.name} ${column.type}${constraints.length > 0 ? ` (${constraints.join(', ')})` : ''} -- ${column.comment || ''}`
    }).join('\n')

    navigator.clipboard.writeText(schemaText)
    onCopySchema?.()
  }

  const handleExportSchema = () => {
    const schemaData = {
      tableName: 'Table Schema',
      columns,
      indexes,
      constraints,
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(schemaData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'table-schema.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    onExportSchema?.()
  }

  const getTypeColor = (type: string) => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('int') || lowerType.includes('number')) return 'bg-blue-100 text-blue-800'
    if (lowerType.includes('varchar') || lowerType.includes('text') || lowerType.includes('char')) return 'bg-green-100 text-green-800'
    if (lowerType.includes('date') || lowerType.includes('time')) return 'bg-purple-100 text-purple-800'
    if (lowerType.includes('bool')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const filterOptions = [
    { value: 'all', label: '全部字段', count: columns.length },
    { value: 'primaryKey', label: '主键', count: columns.filter(c => c.isPrimaryKey).length },
    { value: 'foreignKey', label: '外键', count: columns.filter(c => c.isForeignKey).length },
    { value: 'nullable', label: '可空', count: columns.filter(c => c.nullable).length }
  ]

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* 头部操作区 */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">表结构信息</h3>
              <p className="text-sm text-muted-foreground">
                共 {columns.length} 个字段，当前显示 {filteredColumns.length} 个
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySchema}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                复制结构
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSchema}
                className="flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                导出
              </Button>
            </div>
          </div>

          {/* 搜索和筛选区 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="搜索字段名、类型或注释..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filterType === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(option.value as any)}
                  className="flex items-center gap-2"
                  disabled={option.count === 0 && option.value !== 'all'}
                >
                  <Filter className="w-3 h-3" />
                  {option.label}
                  <Badge variant="secondary" className="ml-1">
                    {option.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* 表格区域 */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">字段名</TableHead>
                    <TableHead className="w-[150px]">类型</TableHead>
                    <TableHead className="w-[80px] text-center">约束</TableHead>
                    <TableHead className="w-[100px] text-center">可空</TableHead>
                    <TableHead className="w-[120px]">默认值</TableHead>
                    <TableHead className="min-w-[200px]">注释</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredColumns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm || filterType !== 'all'
                          ? '没有找到匹配的字段'
                          : '暂无字段信息'
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredColumns.map((column, index) => (
                      <TableRow key={`${column.name}-${index}`} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {column.name}
                            {column.isPrimaryKey && (
                              <Key className="w-4 h-4 text-yellow-600" title="主键" />
                            )}
                            {column.isForeignKey && (
                              <Link className="w-4 h-4 text-blue-600" title="外键" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={getTypeColor(column.type)}
                          >
                            {column.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            {column.isPrimaryKey && (
                              <Badge variant="outline" className="text-xs">PK</Badge>
                            )}
                            {column.isForeignKey && (
                              <Badge variant="outline" className="text-xs">FK</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {column.nullable ? (
                            <span className="text-muted-foreground">是</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-600 font-medium">否</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {column.defaultValue ? (
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              {column.defaultValue}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {column.comment ? (
                            <span className="text-sm">{column.comment}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* 索引和约束信息 */}
          {(indexes.length > 0 || constraints.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {indexes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      索引信息 ({indexes.length})
                    </h4>
                    <div className="space-y-2">
                      {indexes.map((index, i) => (
                        <div key={i} className="text-sm bg-muted p-2 rounded">
                          <code>{index}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {constraints.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      约束信息 ({constraints.length})
                    </h4>
                    <div className="space-y-2">
                      {constraints.map((constraint, i) => (
                        <div key={i} className="text-sm bg-muted p-2 rounded">
                          <code>{constraint}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}