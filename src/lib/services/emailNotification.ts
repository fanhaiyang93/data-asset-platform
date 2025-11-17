/**
 * 邮件通知服务
 * 支持申请确认邮件和状态变更通知
 */

import { ApplicationStatus, BusinessPurpose } from '@prisma/client'
import { format } from 'date-fns'

interface ApplicationEmailData {
  applicationNumber: string
  applicantName: string
  applicantEmail: string
  assetName: string
  assetCategory: string
  purpose: BusinessPurpose
  reason: string
  startDate: Date
  endDate: Date
  submittedAt: Date
  status: ApplicationStatus
  reviewComment?: string
  reviewedAt?: Date
  actionUrl?: string
}

interface EmailTemplate {
  subject: string
  htmlContent: string
  textContent: string
}

export class EmailNotificationService {
  private static readonly FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@dataasset.com'
  private static readonly BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  /**
   * 发送申请确认邮件
   */
  static async sendApplicationConfirmation(data: ApplicationEmailData): Promise<boolean> {
    try {
      const template = this.generateConfirmationTemplate(data)
      return await this.sendEmail(data.applicantEmail, template)
    } catch (error) {
      console.error('发送申请确认邮件失败:', error)
      return false
    }
  }

  /**
   * 发送状态变更通知邮件
   */
  static async sendStatusChangeNotification(data: ApplicationEmailData): Promise<boolean> {
    try {
      const template = this.generateStatusChangeTemplate(data)
      return await this.sendEmail(data.applicantEmail, template)
    } catch (error) {
      console.error('发送状态变更通知邮件失败:', error)
      return false
    }
  }

  /**
   * 生成申请确认邮件模板
   */
  private static generateConfirmationTemplate(data: ApplicationEmailData): EmailTemplate {
    const actionUrl = data.actionUrl || `${this.BASE_URL}/applications/success/${data.applicationNumber}`
    const receiptUrl = `${this.BASE_URL}/applications/receipt/${data.applicationNumber}`

    const subject = `申请确认 - ${data.applicationNumber}`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset=\"utf-8\">
          <title>申请确认通知</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #374151;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #e5e7eb;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              color: #059669;
              margin-bottom: 10px;
            }
            .application-id {
              font-size: 18px;
              color: #6b7280;
              font-weight: 500;
            }
            .content {
              margin: 20px 0;
            }
            .info-section {
              margin: 25px 0;
              padding: 20px;
              background: #f9fafb;
              border-radius: 6px;
            }
            .info-title {
              font-weight: 600;
              color: #374151;
              margin-bottom: 10px;
            }
            .info-item {
              margin: 8px 0;
              display: flex;
            }
            .info-label {
              font-weight: 500;
              color: #6b7280;
              min-width: 80px;
              margin-right: 10px;
            }
            .info-value {
              color: #1f2937;
            }
            .reason-box {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 6px;
              margin: 10px 0;
              border-left: 4px solid #3b82f6;
            }
            .button {
              display: inline-block;
              background: #3b82f6;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin: 10px 10px 10px 0;
            }
            .button-secondary {
              background: #6b7280;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
            .next-steps {
              background: #dbeafe;
              padding: 20px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .next-steps h3 {
              color: #1e40af;
              margin-bottom: 15px;
              font-size: 16px;
            }
            .step {
              margin: 10px 0;
              padding-left: 20px;
              position: relative;
            }
            .step::before {
              content: \"→\";
              position: absolute;
              left: 0;
              color: #3b82f6;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class=\"container\">
            <div class=\"header\">
              <div class=\"logo\">数据资产管理平台</div>
              <h1 class=\"title\">申请提交成功！</h1>
              <div class=\"application-id\">申请编号：${data.applicationNumber}</div>
            </div>

            <div class=\"content\">
              <p>尊敬的 ${data.applicantName}，</p>
              <p>您的数据资产申请已成功提交，我们已收到您的申请并将尽快处理。</p>

              <div class=\"info-section\">
                <div class=\"info-title\">申请信息摘要</div>
                <div class=\"info-item\">
                  <span class=\"info-label\">申请资产：</span>
                  <span class=\"info-value\">${data.assetName}</span>
                </div>
                <div class=\"info-item\">
                  <span class=\"info-label\">资产分类：</span>
                  <span class=\"info-value\">${data.assetCategory}</span>
                </div>
                <div class=\"info-item\">
                  <span class=\"info-label\">业务用途：</span>
                  <span class=\"info-value\">${this.getPurposeLabel(data.purpose)}</span>
                </div>
                <div class=\"info-item\">
                  <span class=\"info-label\">使用期限：</span>
                  <span class=\"info-value\">
                    ${format(data.startDate, 'yyyy-MM-dd')} 至 ${format(data.endDate, 'yyyy-MM-dd')}
                  </span>
                </div>
                <div class=\"info-item\">
                  <span class=\"info-label\">提交时间：</span>
                  <span class=\"info-value\">${format(data.submittedAt, 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>
              </div>

              <div class=\"reason-box\">
                <strong>申请理由：</strong><br>
                ${data.reason.replace(/\\n/g, '<br>')}
              </div>

              <div class=\"next-steps\">
                <h3>后续流程</h3>
                <div class=\"step\">您的申请已进入审核队列</div>
                <div class=\"step\">资产管理员将在1-3个工作日内完成审核</div>
                <div class=\"step\">审核完成后会通过邮件通知您结果</div>
                <div class=\"step\">您可以随时查看申请状态和进度</div>
              </div>

              <div style=\"text-align: center; margin: 30px 0;\">
                <a href=\"${actionUrl}\" class=\"button\">查看申请详情</a>
                <a href=\"${receiptUrl}\" class=\"button button-secondary\">下载申请凭证</a>
              </div>
            </div>

            <div class=\"footer\">
              <p>如有疑问，请联系我们：support@dataasset.com</p>
              <p>此邮件为系统自动发送，请勿直接回复</p>
            </div>
          </div>
        </body>
      </html>
    `

    const textContent = `
申请提交成功！

尊敬的 ${data.applicantName}，

您的数据资产申请已成功提交：

申请编号：${data.applicationNumber}
申请资产：${data.assetName}
资产分类：${data.assetCategory}
业务用途：${this.getPurposeLabel(data.purpose)}
使用期限：${format(data.startDate, 'yyyy-MM-dd')} 至 ${format(data.endDate, 'yyyy-MM-dd')}
提交时间：${format(data.submittedAt, 'yyyy-MM-dd HH:mm:ss')}

申请理由：
${data.reason}

后续流程：
1. 您的申请已进入审核队列
2. 资产管理员将在1-3个工作日内完成审核
3. 审核完成后会通过邮件通知您结果
4. 您可以随时查看申请状态和进度

查看申请详情：${actionUrl}
下载申请凭证：${receiptUrl}

如有疑问，请联系我们：support@dataasset.com
此邮件为系统自动发送，请勿直接回复
    `

    return { subject, htmlContent, textContent }
  }

  /**
   * 生成状态变更通知邮件模板
   */
  private static generateStatusChangeTemplate(data: ApplicationEmailData): EmailTemplate {
    const actionUrl = data.actionUrl || `${this.BASE_URL}/applications/success/${data.applicationNumber}`
    const statusLabel = this.getStatusLabel(data.status)
    const statusColor = this.getStatusColor(data.status)

    const subject = `申请状态更新 - ${data.applicationNumber} - ${statusLabel}`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset=\"utf-8\">
          <title>申请状态更新通知</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #374151;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #e5e7eb;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              color: ${statusColor};
              margin-bottom: 10px;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 20px;
              font-weight: 500;
              font-size: 14px;
              background: ${statusColor}20;
              color: ${statusColor};
              border: 1px solid ${statusColor}40;
            }
            .info-section {
              margin: 25px 0;
              padding: 20px;
              background: #f9fafb;
              border-radius: 6px;
            }
            .review-section {
              margin: 20px 0;
              padding: 20px;
              background: #fef3c7;
              border-radius: 6px;
              border-left: 4px solid #f59e0b;
            }
            .button {
              display: inline-block;
              background: #3b82f6;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin: 10px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class=\"container\">
            <div class=\"header\">
              <div class=\"logo\">数据资产管理平台</div>
              <h1 class=\"title\">申请状态更新</h1>
              <div style=\"margin: 15px 0;\">
                <span class=\"status-badge\">${statusLabel}</span>
              </div>
              <div>申请编号：${data.applicationNumber}</div>
            </div>

            <div class=\"content\">
              <p>尊敬的 ${data.applicantName}，</p>
              <p>您的数据资产申请状态已更新为：<strong>${statusLabel}</strong></p>

              ${data.reviewComment ? `
                <div class=\"review-section\">
                  <strong>审核意见：</strong><br>
                  ${data.reviewComment.replace(/\\n/g, '<br>')}
                  ${data.reviewedAt ? `<br><br><small>审核时间：${format(data.reviewedAt, 'yyyy-MM-dd HH:mm:ss')}</small>` : ''}
                </div>
              ` : ''}

              <div class=\"info-section\">
                <strong>申请信息</strong><br>
                申请资产：${data.assetName}<br>
                申请用途：${this.getPurposeLabel(data.purpose)}<br>
                使用期限：${format(data.startDate, 'yyyy-MM-dd')} 至 ${format(data.endDate, 'yyyy-MM-dd')}
              </div>

              <div style=\"text-align: center; margin: 30px 0;\">
                <a href=\"${actionUrl}\" class=\"button\">查看申请详情</a>
              </div>
            </div>

            <div class=\"footer\">
              <p>如有疑问，请联系我们：support@dataasset.com</p>
              <p>此邮件为系统自动发送，请勿直接回复</p>
            </div>
          </div>
        </body>
      </html>
    `

    const textContent = `
申请状态更新

尊敬的 ${data.applicantName}，

您的数据资产申请状态已更新：

申请编号：${data.applicationNumber}
当前状态：${statusLabel}
申请资产：${data.assetName}
申请用途：${this.getPurposeLabel(data.purpose)}
使用期限：${format(data.startDate, 'yyyy-MM-dd')} 至 ${format(data.endDate, 'yyyy-MM-dd')}

${data.reviewComment ? `审核意见：\n${data.reviewComment}\n` : ''}
${data.reviewedAt ? `审核时间：${format(data.reviewedAt, 'yyyy-MM-dd HH:mm:ss')}\n` : ''}

查看申请详情：${actionUrl}

如有疑问，请联系我们：support@dataasset.com
此邮件为系统自动发送，请勿直接回复
    `

    return { subject, htmlContent, textContent }
  }

  /**
   * 发送邮件（模拟实现）
   * 在真实环境中，这里应该集成实际的邮件服务（如 Resend、SendGrid 等）
   */
  private static async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      // 模拟邮件发送
      console.log('📧 模拟发送邮件:')
      console.log('收件人:', to)
      console.log('主题:', template.subject)
      console.log('内容长度:', template.htmlContent.length, '字符')

      // 在真实环境中，这里应该是:
      // const result = await resend.emails.send({
      //   from: this.FROM_EMAIL,
      //   to,
      //   subject: template.subject,
      //   html: template.htmlContent,
      //   text: template.textContent,
      // })
      // return result.error ? false : true

      // 模拟随机成功/失败
      const success = Math.random() > 0.1 // 90% 成功率

      if (success) {
        console.log('✅ 邮件发送成功')
      } else {
        console.log('❌ 邮件发送失败（模拟）')
      }

      return success
    } catch (error) {
      console.error('邮件发送异常:', error)
      return false
    }
  }

  /**
   * 获取业务用途显示文本
   */
  private static getPurposeLabel(purpose: BusinessPurpose): string {
    const purposeMap: Record<BusinessPurpose, string> = {
      REPORT_CREATION: '报表制作',
      DATA_ANALYSIS: '数据分析',
      BUSINESS_MONITOR: '业务监控',
      MODEL_TRAINING: '模型训练',
      SYSTEM_INTEGRATION: '系统集成',
      RESEARCH_ANALYSIS: '研究分析',
      OTHER: '其他用途',
    }
    return purposeMap[purpose] || purpose
  }

  /**
   * 获取状态显示文本
   */
  private static getStatusLabel(status: ApplicationStatus): string {
    const statusMap: Record<ApplicationStatus, string> = {
      DRAFT: '草稿',
      PENDING: '待审批',
      APPROVED: '已批准',
      REJECTED: '已拒绝',
    }
    return statusMap[status] || status
  }

  /**
   * 获取状态颜色
   */
  private static getStatusColor(status: ApplicationStatus): string {
    const colorMap: Record<ApplicationStatus, string> = {
      DRAFT: '#6b7280',
      PENDING: '#f59e0b',
      APPROVED: '#059669',
      REJECTED: '#dc2626',
    }
    return colorMap[status] || '#6b7280'
  }

  /**
   * 批量发送邮件通知
   */
  static async sendBulkNotifications(notifications: ApplicationEmailData[]): Promise<{
    success: number
    failed: number
    results: Array<{ email: string; success: boolean; error?: string }>
  }> {
    const results: Array<{ email: string; success: boolean; error?: string }> = []
    let success = 0
    let failed = 0

    for (const data of notifications) {
      try {
        const result = await this.sendApplicationConfirmation(data)
        results.push({
          email: data.applicantEmail,
          success: result,
        })

        if (result) {
          success++
        } else {
          failed++
        }
      } catch (error) {
        results.push({
          email: data.applicantEmail,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        })
        failed++
      }

      // 避免过快发送，添加小延迟
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { success, failed, results }
  }
}