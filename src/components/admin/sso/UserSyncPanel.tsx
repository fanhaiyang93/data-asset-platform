'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sync,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Settings
} from 'lucide-react'
import { UserSyncResult } from '@/lib/ssoRoleMapping'
import { toast } from '@/hooks/use-toast'

interface UserSyncPanelProps {
  providerId: string
  onSyncComplete?: () => void
}

interface SyncStats {
  total: number
  created: number
  updated: number
  noChange: number
  errors: number
}

interface SyncJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  stats: SyncStats
  results: UserSyncResult[]
  startedAt: string
  completedAt?: string
  error?: string
}

export default function UserSyncPanel({ providerId, onSyncComplete }: UserSyncPanelProps) {
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([])
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null)
  const [syncType, setSyncType] = useState<'full' | 'incremental'>('incremental')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 模拟获取历史同步任务
    setSyncJobs([
      {
        id: 'job-1',
        status: 'completed',
        progress: 100,
        stats: { total: 150, created: 5, updated: 12, noChange: 133, errors: 0 },
        results: [],
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3500000).toISOString()
      },
      {
        id: 'job-2',
        status: 'completed',
        progress: 100,
        stats: { total: 145, created: 0, updated: 3, noChange: 140, errors: 2 },
        results: [],
        startedAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 7100000).toISOString()
      }
    ])
  }, [])

  const handleStartSync = async () => {
    if (!providerId) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/sso/users/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId,
          syncType
        }),
      })

      if (response.ok) {
        const data = await response.json()

        const newJob: SyncJob = {
          id: `job-${Date.now()}`,
          status: 'completed',
          progress: 100,
          stats: data.stats,
          results: data.results,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }

        setSyncJobs(prev => [newJob, ...prev])
        setCurrentJob(newJob)

        toast({
          title: '同步完成',
          description: `成功同步 ${data.stats.total} 个用户，创建 ${data.stats.created} 个，更新 ${data.stats.updated} 个`
        })

        onSyncComplete?.()
      } else {
        throw new Error('同步失败')
      }
    } catch (error) {
      toast({
        title: '同步失败',
        description: '无法执行用户同步',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewResults = (job: SyncJob) => {
    setSelectedJob(job)
    setShowResults(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            运行中
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            已完成
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            失败
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return <Badge className="bg-green-100 text-green-800">创建</Badge>
      case 'updated':
        return <Badge className="bg-blue-100 text-blue-800">更新</Badge>
      case 'noChange':
        return <Badge className="bg-gray-100 text-gray-800">无变化</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SYSTEM_ADMIN':
        return <Badge className="bg-red-100 text-red-800">系统管理员</Badge>
      case 'DATA_ADMIN':
        return <Badge className="bg-blue-100 text-blue-800">数据管理员</Badge>
      case 'BUSINESS_USER':
        return <Badge className="bg-green-100 text-green-800">业务用户</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  if (!providerId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">请先选择SSO提供商</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* 同步控制面板 */}
        <Card>
          <CardHeader>
            <CardTitle>用户同步设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">同步类型</label>
                <Select value={syncType} onValueChange={(value: 'full' | 'incremental') => setSyncType(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incremental">增量同步</SelectItem>
                    <SelectItem value="full">全量同步</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  {syncType === 'incremental' ? '只同步有变化的用户' : '同步所有用户'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStartSync} disabled={loading}>
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sync className="h-4 w-4 mr-2" />
                  )}
                  {loading ? '同步中...' : '开始同步'}
                </Button>
              </div>
            </div>

            {/* 当前任务进度 */}
            {currentJob && currentJob.status === 'running' && (
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">同步进行中...</span>
                  <span className="text-sm text-muted-foreground">{currentJob.progress}%</span>
                </div>
                <Progress value={currentJob.progress} className="mb-2" />
                <div className="text-sm text-muted-foreground">
                  已处理 {Math.round(currentJob.stats.total * currentJob.progress / 100)} / {currentJob.stats.total} 个用户
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 同步历史 */}
        <Card>
          <CardHeader>
            <CardTitle>同步历史</CardTitle>
          </CardHeader>
          <CardContent>
            {syncJobs.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无同步记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>开始时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>总数</TableHead>
                      <TableHead>创建</TableHead>
                      <TableHead>更新</TableHead>
                      <TableHead>错误</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          {new Date(job.startedAt).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(job.status)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{job.stats.total}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600">{job.stats.created}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-blue-600">{job.stats.updated}</span>
                        </TableCell>
                        <TableCell>
                          <span className={job.stats.errors > 0 ? 'text-red-600' : 'text-muted-foreground'}>
                            {job.stats.errors}
                          </span>
                        </TableCell>
                        <TableCell>
                          {job.completedAt ? (
                            <span className="text-sm">
                              {Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewResults(job)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 同步配置建议 */}
        <Card>
          <CardHeader>
            <CardTitle>同步配置建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">自动同步</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  配置定时任务自动同步用户信息，建议每小时执行一次增量同步。
                </p>
                <Button variant="outline" size="sm">
                  配置自动同步
                </Button>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium">错误通知</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  当同步出现错误时，系统会自动发送通知到管理员邮箱。
                </p>
                <Button variant="outline" size="sm">
                  配置通知设置
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 同步结果详情对话框 */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>同步结果详情</DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              {/* 同步统计 */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{selectedJob.stats.total}</div>
                    <div className="text-sm text-muted-foreground">总计</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedJob.stats.created}</div>
                    <div className="text-sm text-muted-foreground">创建</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedJob.stats.updated}</div>
                    <div className="text-sm text-muted-foreground">更新</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{selectedJob.stats.noChange}</div>
                    <div className="text-sm text-muted-foreground">无变化</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{selectedJob.stats.errors}</div>
                    <div className="text-sm text-muted-foreground">错误</div>
                  </CardContent>
                </Card>
              </div>

              {/* 详细结果 */}
              {selectedJob.results.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">同步详情</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户邮箱</TableHead>
                          <TableHead>操作</TableHead>
                          <TableHead>旧角色</TableHead>
                          <TableHead>新角色</TableHead>
                          <TableHead>错误</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedJob.results.slice(0, 50).map((result, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {result.attributes.email || '-'}
                            </TableCell>
                            <TableCell>
                              {getActionBadge(result.action)}
                            </TableCell>
                            <TableCell>
                              {result.oldRole ? getRoleBadge(result.oldRole) : '-'}
                            </TableCell>
                            <TableCell>
                              {getRoleBadge(result.newRole)}
                            </TableCell>
                            <TableCell>
                              {result.errors && result.errors.length > 0 ? (
                                <span className="text-red-600 text-sm">
                                  {result.errors[0]}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedJob.results.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      显示前50条结果，共{selectedJob.results.length}条
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}