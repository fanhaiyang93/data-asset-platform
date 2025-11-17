'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { BusinessPurposeSelect } from './BusinessPurposeSelect'
import { BusinessPurpose } from '@prisma/client'
import { format } from 'date-fns'
import { applicationFormSchema, ApplicationFormData, fieldValidators } from '@/lib/schemas/application'
import { useApplicationDraft } from '@/hooks/useApplicationDraft'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Save, Clock, User } from 'lucide-react'

interface ApplicationFormProps {
  assetId: string
  onSubmit: (data: ApplicationFormData) => void
  onSaveDraft?: (data: Partial<ApplicationFormData>) => void
  initialData?: Partial<ApplicationFormData>
  loading?: boolean
  className?: string
}

export function ApplicationForm({
  assetId,
  onSubmit,
  onSaveDraft,
  initialData,
  loading = false,
  className
}: ApplicationFormProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(initialData?.startDate)
  const [endDate, setEndDate] = useState<Date | undefined>(initialData?.endDate)
  const [purpose, setPurpose] = useState<BusinessPurpose | null>(initialData?.purpose || null)

  // 获取当前用户信息以进行自动填充
  const { user, isLoading: isLoadingUser } = useCurrentUser()

  // 草稿保存功能
  const {
    isDraftSaving,
    autoSaveDraft,
    saveNow,
    hasDraft,
    draftId
  } = useApplicationDraft({
    assetId,
    initialData,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
    setValue,
    watch,
    reset,
    trigger
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
    mode: 'onChange', // 启用实时验证
    defaultValues: {
      assetId,
      applicantName: initialData?.applicantName || user?.name || '',
      department: initialData?.department || user?.department || '',
      contactEmail: initialData?.contactEmail || user?.email || '',
      contactPhone: initialData?.contactPhone || '',
      reason: initialData?.reason || '',
      purpose: initialData?.purpose,
      startDate: initialData?.startDate,
      endDate: initialData?.endDate
    }
  })

  // 监听表单变化，自动保存草稿
  const formData = watch()

  // 用户信息自动填充
  useEffect(() => {
    if (user && !isLoadingUser && !initialData) {
      // 只在没有初始数据时进行自动填充
      if (user.name && !formData.applicantName) {
        setValue('applicantName', user.name, { shouldDirty: false })
      }
      if (user.email && !formData.contactEmail) {
        setValue('contactEmail', user.email, { shouldDirty: false })
      }
      if (user.department && !formData.department) {
        setValue('department', user.department, { shouldDirty: false })
      }
    }
  }, [user, isLoadingUser, initialData, setValue, formData])
  useEffect(() => {
    if (isDirty) {
      const draftData: Partial<ApplicationFormData> = {
        ...formData,
        purpose: purpose || undefined,
        startDate,
        endDate
      }

      // 使用新的自动保存功能
      autoSaveDraft(draftData)

      // 如果有旧的回调函数，仍然调用它以保持兼容性
      if (onSaveDraft) {
        onSaveDraft(draftData)
      }
    }
  }, [formData, isDirty, purpose, startDate, endDate, autoSaveDraft, onSaveDraft])

  // 手动保存草稿
  const handleManualSaveDraft = () => {
    const draftData: Partial<ApplicationFormData> = {
      ...formData,
      purpose: purpose || undefined,
      startDate,
      endDate
    }
    saveNow(draftData)
  }

  // 手动填充用户信息
  const handleAutoFillUserInfo = () => {
    if (user) {
      if (user.name) {
        setValue('applicantName', user.name, { shouldDirty: true, shouldValidate: true })
      }
      if (user.email) {
        setValue('contactEmail', user.email, { shouldDirty: true, shouldValidate: true })
      }
      if (user.department) {
        setValue('department', user.department, { shouldDirty: true, shouldValidate: true })
      }
    }
  }

  // 表单提交处理
  const onFormSubmit = (data: ApplicationFormData) => {
    onSubmit(data)
  }

  // 处理日期变更并触发验证
  const handleDateChange = async (field: 'startDate' | 'endDate', date: Date | undefined) => {
    if (!date) return

    if (field === 'startDate') {
      setStartDate(date)
      setValue('startDate', date, { shouldDirty: true, shouldValidate: true })
    } else {
      setEndDate(date)
      setValue('endDate', date, { shouldDirty: true, shouldValidate: true })
    }

    // 触发整个表单验证（特别是日期范围验证）
    await trigger(['startDate', 'endDate'])
  }

  // 处理业务用途变更
  const handlePurposeChange = async (purposeValue: BusinessPurpose) => {
    setPurpose(purposeValue)
    setValue('purpose', purposeValue, { shouldDirty: true, shouldValidate: true })
    await trigger('purpose')
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>数据资产访问申请</CardTitle>
        <CardDescription>
          请填写以下信息以申请访问数据资产。所有标有 * 的字段均为必填项。
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onFormSubmit)}>
        <CardContent className="space-y-6">
          {/* 业务用途选择 */}
          <div className="space-y-2">
            <Label htmlFor="purpose">业务用途 *</Label>
            <BusinessPurposeSelect
              value={purpose}
              onValueChange={handlePurposeChange}
              disabled={loading}
            />
            {errors.purpose && (
              <p className="text-sm text-destructive">{errors.purpose.message}</p>
            )}
          </div>

          {/* 申请理由 */}
          <div className="space-y-2">
            <Label htmlFor="reason">申请理由 *</Label>
            <Textarea
              id="reason"
              placeholder="请详细说明申请此数据资产的具体原因和用途..."
              className="min-h-[100px]"
              disabled={loading}
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {/* 使用期限 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>使用开始日期 *</Label>
              <DatePicker
                date={startDate}
                onSelect={(date) => handleDateChange('startDate', date)}
                placeholder="选择开始日期"
                disabled={loading}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>使用结束日期 *</Label>
              <DatePicker
                date={endDate}
                onSelect={(date) => handleDateChange('endDate', date)}
                placeholder="选择结束日期"
                disabled={loading}
              />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          {/* 申请人信息 */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">申请人信息</h3>
              {user && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFillUserInfo}
                  disabled={loading || isLoadingUser}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  自动填充
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="applicantName">姓名 *</Label>
                <Input
                  id="applicantName"
                  placeholder="请输入姓名"
                  disabled={loading}
                  {...register('applicantName')}
                />
                {errors.applicantName && (
                  <p className="text-sm text-destructive">{errors.applicantName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">部门</Label>
                <Input
                  id="department"
                  placeholder="请输入部门"
                  disabled={loading}
                  {...register('department')}
                />
                {errors.department && (
                  <p className="text-sm text-destructive">{errors.department.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">联系邮箱 *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="请输入邮箱地址"
                  disabled={loading}
                  {...register('contactEmail')}
                />
                {errors.contactEmail && (
                  <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">联系电话</Label>
                <Input
                  id="contactPhone"
                  placeholder="请输入联系电话"
                  disabled={loading}
                  {...register('contactPhone')}
                />
                {errors.contactPhone && (
                  <p className="text-sm text-destructive">{errors.contactPhone.message}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isDraftSaving && (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                <span>正在保存草稿...</span>
              </>
            )}
            {hasDraft && !isDraftSaving && (
              <>
                <Save className="h-4 w-4 text-green-600" />
                <span>草稿已保存</span>
              </>
            )}
            {isDirty && !isDraftSaving && !hasDraft && (
              <span>有未保存的更改</span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleManualSaveDraft}
              disabled={loading || isDraftSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isDraftSaving ? '保存中...' : '保存草稿'}
            </Button>

            <Button
              type="submit"
              disabled={loading || !isValid}
            >
              {loading ? '提交中...' : '下一步'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}