import { applicationFormSchema, applicationDraftSchema, fieldValidators } from '../application'
import { BusinessPurpose } from '@prisma/client'

describe('Application Schema', () => {
  describe('applicationFormSchema', () => {
    const validData = {
      assetId: 'test-asset-id',
      purpose: BusinessPurpose.DATA_ANALYSIS,
      reason: '这是一个有效的申请理由，用于数据分析工作，需要访问相关数据资产',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-31'),
      applicantName: '张三',
      department: '技术部',
      contactEmail: 'zhangsan@example.com',
      contactPhone: '13800138000',
    }

    it('应该验证有效的申请数据', () => {
      const result = applicationFormSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('应该拒绝空的资产ID', () => {
      const invalidData = { ...validData, assetId: '' }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('资产ID不能为空')
      }
    })

    it('应该拒绝无效的业务用途', () => {
      const invalidData = { ...validData, purpose: 'INVALID_PURPOSE' }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('应该拒绝过短的申请理由', () => {
      const invalidData = { ...validData, reason: '短理由' }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('申请理由至少需要10个字符')
      }
    })

    it('应该拒绝过长的申请理由', () => {
      const longReason = 'a'.repeat(501)
      const invalidData = { ...validData, reason: longReason }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('申请理由不能超过500个字符')
      }
    })

    it('应该拒绝过去的日期', () => {
      const pastDate = new Date('2020-01-01')
      const invalidData = { ...validData, startDate: pastDate }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('日期不能早于今天')
      }
    })

    it('应该拒绝结束日期早于开始日期', () => {
      const invalidData = {
        ...validData,
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-12-01'),
      }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('结束日期必须晚于开始日期')
      }
    })

    it('应该拒绝超过一年的申请期限', () => {
      const invalidData = {
        ...validData,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-02'), // 超过一年
      }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('申请期限不能超过一年')
      }
    })

    it('应该拒绝空的申请人姓名', () => {
      const invalidData = { ...validData, applicantName: '' }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('请填写姓名')
      }
    })

    it('应该拒绝过长的姓名', () => {
      const longName = 'a'.repeat(51)
      const invalidData = { ...validData, applicantName: longName }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('姓名不能超过50个字符')
      }
    })

    it('应该拒绝无效的邮箱格式', () => {
      const invalidData = { ...validData, contactEmail: 'invalid-email' }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('请输入有效的邮箱地址')
      }
    })

    it('应该拒绝无效的手机号格式', () => {
      const invalidData = { ...validData, contactPhone: '123456' }
      const result = applicationFormSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('请输入有效的手机号码')
      }
    })

    it('应该接受空的手机号', () => {
      const validDataWithoutPhone = { ...validData, contactPhone: '' }
      const result = applicationFormSchema.safeParse(validDataWithoutPhone)
      expect(result.success).toBe(true)
    })

    it('应该接受空的部门', () => {
      const validDataWithoutDepartment = { ...validData, department: '' }
      const result = applicationFormSchema.safeParse(validDataWithoutDepartment)
      expect(result.success).toBe(true)
    })
  })

  describe('applicationDraftSchema', () => {
    it('应该接受部分填写的草稿数据', () => {
      const draftData = {
        assetId: 'test-asset-id',
        reason: '部分理由',
        applicantName: '张三',
      }
      const result = applicationDraftSchema.safeParse(draftData)
      expect(result.success).toBe(true)
    })

    it('应该接受空的草稿数据', () => {
      const emptyDraft = {}
      const result = applicationDraftSchema.safeParse(emptyDraft)
      expect(result.success).toBe(true)
    })

    it('应该拒绝过长的申请理由', () => {
      const longReason = 'a'.repeat(501)
      const invalidDraft = { reason: longReason }
      const result = applicationDraftSchema.safeParse(invalidDraft)
      expect(result.success).toBe(false)
    })
  })

  describe('fieldValidators', () => {
    describe('reason', () => {
      it('应该验证有效的申请理由', () => {
        const result = fieldValidators.reason('这是一个有效的申请理由，用于数据分析')
        expect(result).toBeNull()
      })

      it('应该拒绝过短的申请理由', () => {
        const result = fieldValidators.reason('短理由')
        expect(result).toBe('申请理由至少需要10个字符')
      })

      it('应该拒绝过长的申请理由', () => {
        const longReason = 'a'.repeat(501)
        const result = fieldValidators.reason(longReason)
        expect(result).toBe('申请理由不能超过500个字符')
      })
    })

    describe('applicantName', () => {
      it('应该验证有效的姓名', () => {
        const result = fieldValidators.applicantName('张三')
        expect(result).toBeNull()
      })

      it('应该拒绝空的姓名', () => {
        const result = fieldValidators.applicantName('')
        expect(result).toBe('请填写姓名')
      })

      it('应该拒绝过长的姓名', () => {
        const longName = 'a'.repeat(51)
        const result = fieldValidators.applicantName(longName)
        expect(result).toBe('姓名不能超过50个字符')
      })
    })

    describe('contactEmail', () => {
      it('应该验证有效的邮箱', () => {
        const result = fieldValidators.contactEmail('zhangsan@example.com')
        expect(result).toBeNull()
      })

      it('应该拒绝无效的邮箱格式', () => {
        const result = fieldValidators.contactEmail('invalid-email')
        expect(result).toBe('请输入有效的邮箱地址')
      })

      it('应该拒绝空的邮箱', () => {
        const result = fieldValidators.contactEmail('')
        expect(result).toBe('请填写联系邮箱')
      })
    })

    describe('contactPhone', () => {
      it('应该验证有效的手机号', () => {
        const result = fieldValidators.contactPhone('13800138000')
        expect(result).toBeNull()
      })

      it('应该接受空的手机号', () => {
        const result = fieldValidators.contactPhone('')
        expect(result).toBeNull()
      })

      it('应该拒绝无效的手机号格式', () => {
        const result = fieldValidators.contactPhone('123456')
        expect(result).toBe('请输入有效的手机号码')
      })
    })

    describe('dateRange', () => {
      it('应该验证有效的日期范围', () => {
        const startDate = new Date('2024-12-01')
        const endDate = new Date('2024-12-31')
        const result = fieldValidators.dateRange(startDate, endDate)
        expect(result).toBeNull()
      })

      it('应该拒绝结束日期早于开始日期', () => {
        const startDate = new Date('2024-12-31')
        const endDate = new Date('2024-12-01')
        const result = fieldValidators.dateRange(startDate, endDate)
        expect(result).toBe('结束日期必须晚于开始日期')
      })

      it('应该拒绝超过一年的申请期限', () => {
        const startDate = new Date('2024-01-01')
        const endDate = new Date('2025-01-02')
        const result = fieldValidators.dateRange(startDate, endDate)
        expect(result).toBe('申请期限不能超过一年')
      })

      it('应该拒绝过去的日期', () => {
        const pastDate = new Date('2020-01-01')
        const futureDate = new Date('2025-01-01')
        const result = fieldValidators.dateRange(pastDate, futureDate)
        expect(result).toBe('日期不能早于今天')
      })
    })
  })
})