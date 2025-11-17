import {
  generateApplicationNumber,
  isValidApplicationNumber,
  extractDateFromApplicationNumber,
} from '@/lib/utils/applicationNumber'

describe('applicationNumber utils', () => {
  describe('generateApplicationNumber', () => {
    it('应该生成正确格式的申请编号', () => {
      const applicationNumber = generateApplicationNumber()

      // 验证格式：APP-YYYYMMDD-HHMMSS-XXXX
      const pattern = /^APP-\d{8}-\d{6}-\d{4}$/
      expect(pattern.test(applicationNumber)).toBe(true)
    })

    it('应该生成唯一的申请编号', () => {
      const numbers = new Set()

      // 生成多个编号，验证不重复（虽然理论上可能重复，但概率极低）
      for (let i = 0; i < 100; i++) {
        const number = generateApplicationNumber()
        numbers.add(number)
      }

      // 大多数应该是唯一的
      expect(numbers.size).toBeGreaterThan(90)
    })

    it('应该包含当前日期信息', () => {
      const now = new Date()
      const applicationNumber = generateApplicationNumber()

      const dateStr = now.getFullYear().toString() +
                     (now.getMonth() + 1).toString().padStart(2, '0') +
                     now.getDate().toString().padStart(2, '0')

      expect(applicationNumber).toContain(dateStr)
    })
  })

  describe('isValidApplicationNumber', () => {
    it('应该验证有效的申请编号格式', () => {
      const validNumbers = [
        'APP-20241113-143022-1234',
        'APP-20231201-000000-0000',
        'APP-20251231-235959-9999',
      ]

      validNumbers.forEach(number => {
        expect(isValidApplicationNumber(number)).toBe(true)
      })
    })

    it('应该拒绝无效的申请编号格式', () => {
      const invalidNumbers = [
        'APP-2024113-143022-1234', // 日期格式错误
        'APP-20241113-14302-1234', // 时间格式错误
        'APP-20241113-143022-12345', // 随机数位数错误
        'APP-20241113-143022-123', // 随机数位数错误
        'INVALID-20241113-143022-1234', // 前缀错误
        '20241113-143022-1234', // 缺少前缀
        'APP-20241113-143022', // 缺少随机数
        '', // 空字符串
        'APP-ABCD1113-143022-1234', // 日期包含字母
      ]

      invalidNumbers.forEach(number => {
        expect(isValidApplicationNumber(number)).toBe(false)
      })
    })
  })

  describe('extractDateFromApplicationNumber', () => {
    it('应该从有效的申请编号中提取日期', () => {
      const applicationNumber = 'APP-20241113-143022-1234'
      const extractedDate = extractDateFromApplicationNumber(applicationNumber)

      expect(extractedDate).toBeInstanceOf(Date)
      expect(extractedDate!.getFullYear()).toBe(2024)
      expect(extractedDate!.getMonth()).toBe(10) // 11月 (0-based)
      expect(extractedDate!.getDate()).toBe(13)
      expect(extractedDate!.getHours()).toBe(14)
      expect(extractedDate!.getMinutes()).toBe(30)
      expect(extractedDate!.getSeconds()).toBe(22)
    })

    it('应该从无效格式返回null', () => {
      const invalidNumbers = [
        'INVALID-20241113-143022-1234',
        'APP-2024113-143022-1234',
        '',
        'random-string',
      ]

      invalidNumbers.forEach(number => {
        expect(extractDateFromApplicationNumber(number)).toBeNull()
      })
    })

    it('应该处理边界日期', () => {
      const testCases = [
        {
          number: 'APP-20241201-000000-0000',
          expected: { year: 2024, month: 11, date: 1, hour: 0, minute: 0, second: 0 }
        },
        {
          number: 'APP-20241231-235959-9999',
          expected: { year: 2024, month: 11, date: 31, hour: 23, minute: 59, second: 59 }
        },
      ]

      testCases.forEach(({ number, expected }) => {
        const extractedDate = extractDateFromApplicationNumber(number)
        expect(extractedDate).not.toBeNull()
        expect(extractedDate!.getFullYear()).toBe(expected.year)
        expect(extractedDate!.getMonth()).toBe(expected.month)
        expect(extractedDate!.getDate()).toBe(expected.date)
        expect(extractedDate!.getHours()).toBe(expected.hour)
        expect(extractedDate!.getMinutes()).toBe(expected.minute)
        expect(extractedDate!.getSeconds()).toBe(expected.second)
      })
    })
  })

  describe('integration test', () => {
    it('生成的编号应该能够通过验证并提取日期', () => {
      const applicationNumber = generateApplicationNumber()

      // 验证格式
      expect(isValidApplicationNumber(applicationNumber)).toBe(true)

      // 提取日期
      const extractedDate = extractDateFromApplicationNumber(applicationNumber)
      expect(extractedDate).toBeInstanceOf(Date)

      // 日期应该接近当前时间（允许几秒误差）
      const now = new Date()
      const timeDiff = Math.abs(now.getTime() - extractedDate!.getTime())
      expect(timeDiff).toBeLessThan(5000) // 5秒内
    })
  })
})