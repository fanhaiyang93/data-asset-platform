import { format } from 'date-fns'

/**
 * 生成唯一的申请编号
 * 格式: APP-YYYYMMDD-HHMMSS-XXXX
 * 其中 XXXX 是4位随机数字
 */
export function generateApplicationNumber(): string {
  const now = new Date()
  const dateStr = format(now, 'yyyyMMdd')
  const timeStr = format(now, 'HHmmss')
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  return `APP-${dateStr}-${timeStr}-${randomSuffix}`
}

/**
 * 验证申请编号格式是否正确
 * @param applicationNumber 申请编号
 * @returns 是否为有效格式
 */
export function isValidApplicationNumber(applicationNumber: string): boolean {
  const pattern = /^APP-\d{8}-\d{6}-\d{4}$/
  return pattern.test(applicationNumber)
}

/**
 * 从申请编号中提取创建日期
 * @param applicationNumber 申请编号
 * @returns 创建日期或null（如果格式无效）
 */
export function extractDateFromApplicationNumber(applicationNumber: string): Date | null {
  if (!isValidApplicationNumber(applicationNumber)) {
    return null
  }

  const parts = applicationNumber.split('-')
  const dateStr = parts[1] // YYYYMMDD
  const timeStr = parts[2] // HHMMSS

  if (!dateStr || !timeStr) {
    return null
  }

  const year = parseInt(dateStr.substr(0, 4))
  const month = parseInt(dateStr.substr(4, 2)) - 1 // 月份从0开始
  const day = parseInt(dateStr.substr(6, 2))
  const hour = parseInt(timeStr.substr(0, 2))
  const minute = parseInt(timeStr.substr(2, 2))
  const second = parseInt(timeStr.substr(4, 2))

  return new Date(year, month, day, hour, minute, second)
}