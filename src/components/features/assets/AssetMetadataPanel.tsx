'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Info,
  Calendar,
  RefreshCw,
  Database,
  User,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  Users,
  Clock,
  Scale,
  Tag,
  CheckCircle
} from 'lucide-react'
import { type AssetDetail } from '@/server/services/AssetService'

interface AssetMetadataPanelProps {
  asset: AssetDetail
  onContactOwner?: (contact: any) => void
  onContactTechnical?: (contact: any) => void
}

export function AssetMetadataPanel({
  asset,
  onContactOwner,
  onContactTechnical
}: AssetMetadataPanelProps) {
  const formatDate = (date: Date | string | null) => {
    if (!date) return '未知'
    try {
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '日期格式错误'
    }
  }

  const formatSize = (size: bigint | number | null) => {
    if (!size) return '未知'
    const sizeNum = typeof size === 'bigint' ? Number(size) : size

    if (sizeNum < 1024) return `${sizeNum} B`
    if (sizeNum < 1024 * 1024) return `${(sizeNum / 1024).toFixed(2)} KB`
    if (sizeNum < 1024 * 1024 * 1024) return `${(sizeNum / (1024 * 1024)).toFixed(2)} MB`
    return `${(sizeNum / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const formatRecordCount = (count: bigint | number | null) => {
    if (!count) return '未知'
    const countNum = typeof count === 'bigint' ? Number(count) : count
    return countNum.toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800'
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800'
      case 'DEPRECATED':
        return 'bg-red-100 text-red-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '可用'
      case 'MAINTENANCE':
        return '维护中'
      case 'DEPRECATED':
        return '已废弃'
      case 'DRAFT':
        return '草稿'
      default:
        return status
    }
  }

  const getQualityScoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-800'
    if (score >= 90) return 'bg-green-100 text-green-800'
    if (score >= 70) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      {/* 基础信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            基础信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">状态</span>
                <Badge className={getStatusColor(asset.status)}>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {getStatusText(asset.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">类型</span>
                <Badge variant="outline">
                  <Database className="w-3 h-3 mr-1" />
                  {asset.type || '未指定'}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">格式</span>
                <span className="text-sm">{asset.format || '未指定'}</span>
              </div>

              {asset.qualityScore && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground min-w-[80px]">质量评分</span>
                  <Badge className={getQualityScoreColor(asset.qualityScore)}>
                    <Scale className="w-3 h-3 mr-1" />
                    {asset.qualityScore}/100
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">数据规模</span>
                <span className="text-sm font-mono">{formatSize(asset.size)}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">记录数量</span>
                <span className="text-sm font-mono">{formatRecordCount(asset.recordCount)}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">访问次数</span>
                <span className="text-sm font-mono">{asset.accessCount || 0}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">最后验证</span>
                <span className="text-sm">{formatDate(asset.lastValidated)}</span>
              </div>
            </div>
          </div>

          {/* 标签显示 */}
          {asset.tags && (
            <div className="pt-3 border-t">
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px] mt-1">标签</span>
                <div className="flex flex-wrap gap-2">
                  {asset.tags.split(',').map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 时间信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            时间信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">创建时间</span>
                <span className="text-sm">{formatDate(asset.createdAt)}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">更新时间</span>
                <span className="text-sm">{formatDate(asset.updatedAt)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">最后访问</span>
                <span className="text-sm">{formatDate(asset.lastAccessed)}</span>
              </div>

              {asset.usageStats?.lastAccessed && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground min-w-[80px]">统计更新</span>
                  <span className="text-sm">{formatDate(asset.usageStats.lastAccessed)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 负责人信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            联系人信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 创建者信息 */}
          {asset.creator && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                创建者
              </h4>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{asset.creator.name || asset.creator.username}</p>
                    {asset.creator.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {asset.creator.email}
                      </p>
                    )}
                  </div>
                  {onContactOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onContactOwner(asset.creator)}
                      className="flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      联系
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 最后更新者信息 */}
          {asset.updater && asset.updater.id !== asset.creator?.id && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                最后更新者
              </h4>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{asset.updater.name || asset.updater.username}</p>
                    {asset.updater.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {asset.updater.email}
                      </p>
                    )}
                  </div>
                  {onContactTechnical && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onContactTechnical(asset.updater)}
                      className="flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      联系
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 使用统计信息 */}
          {asset.usageStats && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                使用统计
              </h4>
              <div className="bg-muted rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {asset.usageStats.applicationCount}
                    </div>
                    <div className="text-sm text-muted-foreground">申请次数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {asset.usageStats.activeUsers}
                    </div>
                    <div className="text-sm text-muted-foreground">活跃用户</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asset.description ? (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {asset.description}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">暂无使用说明</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 数据源信息卡片 */}
      {(asset.databaseName || asset.schemaName || asset.tableName) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              数据源信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {asset.databaseName && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">数据库</span>
                <code className="bg-muted px-2 py-1 rounded text-sm">{asset.databaseName}</code>
              </div>
            )}

            {asset.schemaName && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">模式</span>
                <code className="bg-muted px-2 py-1 rounded text-sm">{asset.schemaName}</code>
              </div>
            )}

            {asset.tableName && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">表名</span>
                <code className="bg-muted px-2 py-1 rounded text-sm">{asset.tableName}</code>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}