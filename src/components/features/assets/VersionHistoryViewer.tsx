'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  History,
  Clock,
  User,
  GitCommit,
  ArrowLeft,
  Eye,
  RotateCcw,
  Diff,
  ChevronDown,
  ChevronRight,
  FileText,
  Calendar,
  Tag as TagIcon,
  Upload
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetadataChange {
  field: string
  fieldLabel: string
  oldValue: any
  newValue: any
  changeType: 'added' | 'modified' | 'removed'
}

interface MetadataVersion {
  id: string
  version: string
  timestamp: Date
  author: string
  authorId: string
  changes: MetadataChange[]
  changesSummary: string
  totalChanges: number
  isCurrentVersion?: boolean
}

interface VersionHistoryViewerProps {
  assetId: string
  versions: MetadataVersion[]
  onVersionRestore?: (versionId: string) => Promise<void>
  onVersionPreview?: (versionId: string) => void
  currentVersion?: string
  className?: string
}

export function VersionHistoryViewer({
  assetId,
  versions = [],
  onVersionRestore,
  onVersionPreview,
  currentVersion,
  className
}: VersionHistoryViewerProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const [isRestoring, setIsRestoring] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [compareVersions, setCompareVersions] = useState<[string, string] | null>(null)

  // 切换版本详情展开状态
  const toggleVersionExpansion = (versionId: string) => {
    const newExpanded = new Set(expandedVersions)
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId)
    } else {
      newExpanded.add(versionId)
    }
    setExpandedVersions(newExpanded)
  }

  // 处理版本恢复
  const handleVersionRestore = async (versionId: string) => {
    if (!onVersionRestore) return

    setIsRestoring(versionId)
    try {
      await onVersionRestore(versionId)
      setSelectedVersion(null)
    } catch (error) {
      console.error('版本恢复失败:', error)
    } finally {
      setIsRestoring(null)
    }
  }

  // 格式化时间显示
  const formatTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (days > 0) {
      return `${days}天前`
    } else if (hours > 0) {
      return `${hours}小时前`
    } else if (minutes > 0) {
      return `${minutes}分钟前`
    } else {
      return '刚刚'
    }
  }

  // 获取变更类型的样式
  const getChangeTypeStyle = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'modified':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'removed':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // 获取变更类型的图标
  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Upload className="w-3 h-3" />
      case 'modified':
        return <FileText className="w-3 h-3" />
      case 'removed':
        return <ArrowLeft className="w-3 h-3" />
      default:
        return <GitCommit className="w-3 h-3" />
    }
  }

  // 获取字段图标
  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'name':
      case 'description':
        return <FileText className="w-4 h-4" />
      case 'tags':
        return <TagIcon className="w-4 h-4" />
      case 'owner':
        return <User className="w-4 h-4" />
      case 'lastUpdated':
        return <Calendar className="w-4 h-4" />
      default:
        return <GitCommit className="w-4 h-4" />
    }
  }

  // 渲染变更详情
  const renderChangeDetails = (change: MetadataChange) => {
    const formatValue = (value: any) => {
      if (value === null || value === undefined) return '(空)'
      if (typeof value === 'object') return JSON.stringify(value)
      if (typeof value === 'string' && value.length > 100) {
        return value.substring(0, 100) + '...'
      }
      return String(value)
    }

    return (
      <div key={`${change.field}-${change.changeType}`} className="p-3 border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          {getFieldIcon(change.field)}
          <span className="font-medium text-sm">{change.fieldLabel}</span>
          <Badge
            variant="outline"
            className={cn("text-xs", getChangeTypeStyle(change.changeType))}
          >
            {getChangeTypeIcon(change.changeType)}
            {change.changeType === 'added' ? '新增' :
             change.changeType === 'modified' ? '修改' : '删除'}
          </Badge>
        </div>

        {change.changeType === 'modified' && (
          <div className="space-y-2 text-sm">
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <div className="text-red-600 font-medium mb-1">旧值:</div>
              <div className="text-gray-700">{formatValue(change.oldValue)}</div>
            </div>
            <div className="p-2 bg-green-50 border border-green-200 rounded">
              <div className="text-green-600 font-medium mb-1">新值:</div>
              <div className="text-gray-700">{formatValue(change.newValue)}</div>
            </div>
          </div>
        )}

        {change.changeType === 'added' && (
          <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
            <div className="text-green-600 font-medium mb-1">新增内容:</div>
            <div className="text-gray-700">{formatValue(change.newValue)}</div>
          </div>
        )}

        {change.changeType === 'removed' && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
            <div className="text-red-600 font-medium mb-1">删除内容:</div>
            <div className="text-gray-700">{formatValue(change.oldValue)}</div>
          </div>
        )}
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            版本历史
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无版本历史记录</p>
            <p className="text-sm mt-2">资产元数据的变更记录将显示在这里</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            版本历史
          </div>
          <Badge variant="secondary" className="text-xs">
            {versions.length} 个版本
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 版本列表 */}
        <div className="space-y-3">
          {versions.map((version, index) => {
            const isExpanded = expandedVersions.has(version.id)
            const isCurrentVersion = version.isCurrentVersion || version.id === currentVersion
            const isSelected = selectedVersion === version.id

            return (
              <div
                key={version.id}
                className={cn(
                  "border rounded-lg transition-all duration-200",
                  isCurrentVersion && "border-primary bg-primary/5",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                {/* 版本头部 */}
                <div className="p-4 cursor-pointer" onClick={() => toggleVersionExpansion(version.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <GitCommit className="w-4 h-4 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">版本 {version.version}</span>
                          {isCurrentVersion && (
                            <Badge variant="default" className="text-xs">
                              当前版本
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{version.author}</span>
                          <Clock className="w-3 h-3 ml-1" />
                          <span>{formatTime(version.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {version.totalChanges} 处变更
                      </Badge>
                      {!isCurrentVersion && onVersionRestore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVersionRestore(version.id)
                          }}
                          disabled={isRestoring === version.id}
                          className="text-xs"
                        >
                          {isRestoring === version.id ? (
                            <>恢复中...</>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              恢复
                            </>
                          )}
                        </Button>
                      )}
                      {onVersionPreview && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            onVersionPreview(version.id)
                          }}
                          className="text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          预览
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 变更摘要 */}
                  <div className="mt-2 text-sm text-muted-foreground">
                    {version.changesSummary}
                  </div>
                </div>

                {/* 展开的版本详情 */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-3">
                      <h4 className="font-medium text-sm">变更详情</h4>
                      <div className="space-y-3">
                        {version.changes.map((change, changeIndex) => (
                          <div key={changeIndex}>
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>

                      {/* 版本信息 */}
                      <Separator />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>版本ID: {version.id}</span>
                          <span>时间: {version.timestamp.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* 操作说明 */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p><strong>使用说明：</strong></p>
          <p>• 点击版本条目可展开查看详细变更内容</p>
          <p>• 使用"恢复"按钮可将资产元数据恢复到指定版本</p>
          <p>• 使用"预览"按钮可预览指定版本的完整内容</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default VersionHistoryViewer