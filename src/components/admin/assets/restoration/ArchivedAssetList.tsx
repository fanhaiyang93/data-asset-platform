/**
 * 已下架资产列表组件
 * Story 5.4: 资产下架管理
 *
 * 显示和管理已下架的资产列表
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, RotateCcw, Eye } from 'lucide-react'
import {
  ArchivedAssetSummary,
  ArchivedAssetsQueryParams,
  ArchivedAssetsResponse,
  DecommissionReason,
  DecommissionReasonLabels,
  ExtendedAssetStatus
} from '@/types/assetLifecycle'
import { AssetRestore } from './AssetRestore'
import { getStatusLabel, getStatusColor } from '@/lib/services/softDelete'

interface ArchivedAssetListProps {
  onAssetSelected?: (assetId: string) => void
}

export function ArchivedAssetList({ onAssetSelected }: ArchivedAssetListProps) {
  const [assets, setAssets] = useState<ArchivedAssetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReason, setSelectedReason] = useState<DecommissionReason | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(20)
  const [hasMore, setHasMore] = useState(false)

  // 恢复对话框状态
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<ArchivedAssetSummary | null>(null)

  // 加载已下架资产列表
  const loadArchivedAssets = async () => {
    setLoading(true)

    try {
      const params: ArchivedAssetsQueryParams = {
        page,
        limit,
        searchQuery: searchQuery || undefined,
        reason: selectedReason !== 'all' ? [selectedReason] : undefined,
        sortBy: 'decommissionedAt',
        sortOrder: 'desc'
      }

      // TODO: 调用实际API
      const response: ArchivedAssetsResponse = await fetchArchivedAssets(params)

      setAssets(response.assets)
      setTotal(response.total)
      setHasMore(response.hasMore)
    } catch (error) {
      console.error('Failed to load archived assets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArchivedAssets()
  }, [page, selectedReason])

  const handleSearch = () => {
    setPage(1)
    loadArchivedAssets()
  }

  const handleRestore = (asset: ArchivedAssetSummary) => {
    setSelectedAsset(asset)
    setRestoreDialogOpen(true)
  }

  const handleRestoreComplete = () => {
    // 刷新列表
    loadArchivedAssets()
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      {/* 搜索和筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="搜索已下架资产..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            搜索
          </Button>
        </div>

        <Select
          value={selectedReason}
          onValueChange={(value) => setSelectedReason(value as DecommissionReason | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部原因</SelectItem>
            {Object.entries(DecommissionReasonLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>共找到 {total} 个已下架资产</span>
        <span>
          显示 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条
        </span>
      </div>

      {/* 资产列表 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>资产名称</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>下架原因</TableHead>
              <TableHead>下架时间</TableHead>
              <TableHead>下架操作人</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">加载中...</p>
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-gray-500">暂无已下架资产</p>
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{asset.name}</div>
                      {asset.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {asset.description.length > 50
                            ? asset.description.substring(0, 50) + '...'
                            : asset.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {asset.category ? (
                      <Badge variant="outline">{asset.category.name}</Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge>
                      {DecommissionReasonLabels[asset.reason] || asset.reason}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(asset.decommissionedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {asset.decommissionedByName || asset.decommissionedBy}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-${getStatusColor(asset.status)}-500 text-${getStatusColor(asset.status)}-700`}
                    >
                      {getStatusLabel(asset.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAssetSelected?.(asset.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                      {asset.canRestore && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(asset)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          恢复
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || loading}
          >
            上一页
          </Button>
          <span className="text-sm text-gray-600">
            第 {page} 页 / 共 {Math.ceil(total / limit)} 页
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={!hasMore || loading}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 恢复对话框 */}
      {selectedAsset && (
        <AssetRestore
          assetId={selectedAsset.id}
          assetName={selectedAsset.name}
          currentStatus={selectedAsset.status}
          open={restoreDialogOpen}
          onOpenChange={setRestoreDialogOpen}
          onRestoreComplete={handleRestoreComplete}
        />
      )}
    </div>
  )
}

// 模拟API调用 - TODO: 替换为实际API
async function fetchArchivedAssets(
  params: ArchivedAssetsQueryParams
): Promise<ArchivedAssetsResponse> {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 500))

  // 返回模拟数据
  return {
    assets: [],
    total: 0,
    hasMore: false,
    page: params.page || 1,
    limit: params.limit || 20
  }
}
