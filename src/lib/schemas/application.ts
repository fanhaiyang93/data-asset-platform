import { z } from 'zod'
import { BusinessPurpose } from '@prisma/client'

// 业务用途枚举验证
const businessPurposeSchema = z.nativeEnum(BusinessPurpose, {
  errorMap: () => ({ message: '请选择有效的业务用途' })
})

// 日期验证 - 确保日期不能是过去时间
const futureDateSchema = z.date({
  required_error: '请选择日期',
  invalid_type_error: '请输入有效的日期'
}).refine(
  (date) => date >= new Date(new Date().setHours(0, 0, 0, 0)),
  {
    message: '日期不能早于今天'
  }
)

// 手机号验证
const phoneSchema = z.string()
  .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号码')
  .optional()
  .or(z.literal(''))

// 邮箱验证
const emailSchema = z.string({
  required_error: '请填写联系邮箱'
})
  .email('请输入有效的邮箱地址')
  .min(1, '请填写联系邮箱')

// 申请表单验证schema
export const applicationFormSchema = z.object({
  // 基本申请信息
  assetId: z.string().min(1, '资产ID不能为空'),
  purpose: businessPurposeSchema,
  reason: z.string({
    required_error: '请填写申请理由'
  })
    .min(10, '申请理由至少需要10个字符')
    .max(500, '申请理由不能超过500个字符')
    .trim(),

  // 使用期限
  startDate: futureDateSchema,
  endDate: futureDateSchema,

  // 申请人信息
  applicantName: z.string({
    required_error: '请填写姓名'
  })
    .min(1, '请填写姓名')
    .max(50, '姓名不能超过50个字符')
    .trim(),

  department: z.string()
    .max(100, '部门名称不能超过100个字符')
    .trim()
    .optional()
    .or(z.literal('')),

  contactEmail: emailSchema,
  contactPhone: phoneSchema
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: '结束日期必须晚于开始日期',
    path: ['endDate']
  }
).refine(
  (data) => {
    const diffTime = data.endDate.getTime() - data.startDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 365 // 最多申请一年
  },
  {
    message: '申请期限不能超过一年',
    path: ['endDate']
  }
)

// 草稿验证schema - 较为宽松的验证，用于草稿保存
export const applicationDraftSchema = z.object({
  assetId: z.string().optional(),
  purpose: businessPurposeSchema.optional(),
  reason: z.string()
    .max(500, '申请理由不能超过500个字符')
    .optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  applicantName: z.string()
    .max(50, '姓名不能超过50个字符')
    .optional(),
  department: z.string()
    .max(100, '部门名称不能超过100个字符')
    .optional(),
  contactEmail: z.string()
    .email('请输入有效的邮箱地址')
    .optional()
    .or(z.literal('')),
  contactPhone: phoneSchema
})

// TypeScript类型推导
export type ApplicationFormData = z.infer<typeof applicationFormSchema>
export type ApplicationDraftData = z.infer<typeof applicationDraftSchema>

// 字段级验证函数
export const fieldValidators = {
  // 验证申请理由
  reason: (value: string) => {
    try {
      z.string()
        .min(10, '申请理由至少需要10个字符')
        .max(500, '申请理由不能超过500个字符')
        .parse(value)
      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || '验证失败'
      }
      return '验证失败'
    }
  },

  // 验证姓名
  applicantName: (value: string) => {
    try {
      z.string()
        .min(1, '请填写姓名')
        .max(50, '姓名不能超过50个字符')
        .parse(value.trim())
      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || '验证失败'
      }
      return '验证失败'
    }
  },

  // 验证邮箱
  contactEmail: (value: string) => {
    try {
      emailSchema.parse(value)
      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || '验证失败'
      }
      return '验证失败'
    }
  },

  // 验证手机号
  contactPhone: (value: string) => {
    if (!value || value.trim() === '') return null
    try {
      phoneSchema.parse(value)
      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || '验证失败'
      }
      return '验证失败'
    }
  },

  // 验证日期范围
  dateRange: (startDate: Date, endDate: Date) => {
    try {
      // 验证单个日期
      futureDateSchema.parse(startDate)
      futureDateSchema.parse(endDate)

      // 验证日期范围
      if (endDate <= startDate) {
        return '结束日期必须晚于开始日期'
      }

      // 验证申请期限不超过一年
      const diffTime = endDate.getTime() - startDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > 365) {
        return '申请期限不能超过一年'
      }

      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message || '日期验证失败'
      }
      return '日期验证失败'
    }
  }
}