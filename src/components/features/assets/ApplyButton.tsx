'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  FileText,
  Send,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { type AssetDetail } from '@/server/services/AssetService'

const applyFormSchema = z.object({
  purpose: z.string().min(10, '申请目的至少需要10个字符'),
  duration: z.enum(['30', '90', '180', '365'], {
    required_error: '请选择使用期限'
  }),
  accessType: z.enum(['read', 'write', 'full'], {
    required_error: '请选择访问类型'
  }),
  department: z.string().min(2, '部门名称至少需要2个字符'),
  supervisor: z.string().min(2, '主管姓名至少需要2个字符'),
  additionalNotes: z.string().optional()
})

type ApplyFormValues = z.infer<typeof applyFormSchema>

interface ApplyButtonProps {
  asset: AssetDetail
  onApply?: (applicationData: ApplyFormValues & { assetId: string }) => Promise<void>
  disabled?: boolean
}

export function ApplyButton({ asset, onApply, disabled = false }: ApplyButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      purpose: '',
      duration: '90',
      accessType: 'read',
      department: '',
      supervisor: '',
      additionalNotes: ''
    }
  })

  const handleSubmit = async (values: ApplyFormValues) => {
    if (!onApply) return

    setIsSubmitting(true)
    try {
      await onApply({
        ...values,
        assetId: asset.id
      })
      setIsOpen(false)
      form.reset()
    } catch (error) {
      console.error('申请提交失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getDurationText = (duration: string) => {
    switch (duration) {
      case '30': return '30天'
      case '90': return '3个月'
      case '180': return '6个月'
      case '365': return '1年'
      default: return duration
    }
  }

  const getAccessTypeText = (type: string) => {
    switch (type) {
      case 'read': return '只读'
      case 'write': return '读写'
      case 'full': return '完全访问'
      default: return type
    }
  }

  const getAccessTypeColor = (type: string) => {
    switch (type) {
      case 'read': return 'bg-green-100 text-green-800'
      case 'write': return 'bg-yellow-100 text-yellow-800'
      case 'full': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      {/* 使用历史统计卡片 */}
      {asset.usageStats && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                资产使用统计
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {asset.usageStats.applicationCount}
                </div>
                <div className="text-sm text-muted-foreground">总申请次数</div>
              </div>

              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {asset.usageStats.activeUsers}
                </div>
                <div className="text-sm text-muted-foreground">活跃用户数</div>
              </div>
            </div>

            {asset.usageStats.lastAccessed && (
              <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                最近访问: {new Date(asset.usageStats.lastAccessed).toLocaleString('zh-CN')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 一键申请按钮 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="w-full"
            disabled={disabled || asset.status !== 'AVAILABLE'}
          >
            <FileText className="w-5 h-5 mr-2" />
            {asset.status === 'AVAILABLE' ? '申请访问权限' : '资产暂不可申请'}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              申请访问权限
            </DialogTitle>
            <DialogDescription>
              申请访问资产 "{asset.name}"，请填写以下信息以便审核。
            </DialogDescription>
          </DialogHeader>

          {/* 资产基本信息 */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <h4 className="font-medium mb-3">申请资产信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">资产名称:</span>
                  <span className="font-medium">{asset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">资产编码:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">{asset.code}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">数据规模:</span>
                  <span>{asset.recordCount ? Number(asset.recordCount).toLocaleString() : '未知'} 条记录</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">负责人:</span>
                  <span>{asset.creator?.name || asset.creator?.username || '未知'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* 申请目的 */}
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      申请目的 *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请详细说明申请该数据资产的具体目的和用途..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      请详细说明申请目的，有助于加快审核流程
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 使用期限 */}
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        使用期限 *
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择使用期限" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30天（临时使用）</SelectItem>
                          <SelectItem value="90">3个月（短期项目）</SelectItem>
                          <SelectItem value="180">6个月（中期项目）</SelectItem>
                          <SelectItem value="365">1年（长期使用）</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 访问类型 */}
                <FormField
                  control={form.control}
                  name="accessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        访问权限 *
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择访问类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="read">只读访问（查询、下载）</SelectItem>
                          <SelectItem value="write">读写访问（查询、修改）</SelectItem>
                          <SelectItem value="full">完全访问（所有操作）</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 所属部门 */}
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>所属部门 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入您的部门名称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 主管姓名 */}
                <FormField
                  control={form.control}
                  name="supervisor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>直属主管 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入直属主管姓名" {...field} />
                      </FormControl>
                      <FormDescription>
                        用于权限审核流程
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 补充说明 */}
              <FormField
                control={form.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>补充说明</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="如有其他需要说明的信息，请在此填写..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      可选填写，有助于审核人员更好地理解您的需求
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 申请预览 */}
              {form.watch('purpose') && form.watch('duration') && form.watch('accessType') && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      申请预览
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">期限:</span>
                        <Badge variant="outline">{getDurationText(form.watch('duration'))}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">权限:</span>
                        <Badge className={getAccessTypeColor(form.watch('accessType'))}>
                          {getAccessTypeText(form.watch('accessType'))}
                        </Badge>
                      </div>
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground">目的:</span>
                        <p className="mt-1 text-sm">{form.watch('purpose')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      提交申请
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 申请状态提示 */}
      {asset.status !== 'AVAILABLE' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 mb-1">资产暂不可申请</h4>
                <p className="text-sm text-yellow-700">
                  {asset.status === 'MAINTENANCE' && '该资产正在维护中，请稍后再试'}
                  {asset.status === 'DEPRECATED' && '该资产已废弃，不再提供访问'}
                  {asset.status === 'DRAFT' && '该资产仍在准备中，尚未正式发布'}
                </p>
                {asset.creator && (
                  <p className="text-sm text-yellow-700 mt-2">
                    如有疑问，请联系负责人：{asset.creator.name || asset.creator.username}
                    {asset.creator.email && (
                      <a
                        href={`mailto:${asset.creator.email}`}
                        className="ml-2 inline-flex items-center gap-1 text-yellow-800 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {asset.creator.email}
                      </a>
                    )}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}