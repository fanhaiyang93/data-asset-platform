/**
 * 申请凭证组件
 * 显示申请的完整信息并支持PDF导出
 */

'use client'

import React, { useRef } from 'react'
import { format } from 'date-fns'
import { ApplicationDetail } from '@/types/application'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DocumentTextIcon,
  PrinterIcon,
  ShareIcon,
  QrCodeIcon,
  CalendarIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon
} from '@heroicons/react/24/outline'

interface ApplicationReceiptProps {
  application: ApplicationDetail
  className?: string
}

export function ApplicationReceipt({ application, className = '' }: ApplicationReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  // 获取状态显示信息
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: '待审批', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
      case 'APPROVED':
        return { label: '已批准', color: 'bg-green-100 text-green-800 border-green-200' }
      case 'REJECTED':
        return { label: '已拒绝', color: 'bg-red-100 text-red-800 border-red-200' }
      default:
        return { label: '处理中', color: 'bg-blue-100 text-blue-800 border-blue-200' }
    }
  }

  // 获取业务用途显示文本
  const getPurposeLabel = (purpose: string) => {
    const purposeMap: Record<string, string> = {
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

  // 打印凭证
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const receiptContent = receiptRef.current?.innerHTML || ''

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>申请凭证 - ${application.applicationNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #374151;
              background: white;
              padding: 20px;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .receipt-title {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .receipt-number {
              font-size: 18px;
              color: #6b7280;
              font-weight: 500;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .info-item {
              display: flex;
              align-items: center;
              padding: 8px 0;
            }
            .info-label {
              font-weight: 600;
              color: #374151;
              min-width: 100px;
              margin-right: 10px;
            }
            .info-value {
              color: #1f2937;
            }
            .section {
              margin: 25px 0;
              padding: 20px;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 15px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 16px;
              font-size: 14px;
              font-weight: 500;
            }
            .asset-info {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin: 10px 0;
            }
            .reason-text {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              white-space: pre-wrap;
              line-height: 1.5;
            }
            @page {
              margin: 20mm;
              size: A4;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="receipt-title">数据资产申请凭证</div>
            <div class="receipt-number">申请编号：${application.applicationNumber}</div>
          </div>
          ${receiptContent}
          <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>本凭证由数据资产管理平台自动生成</p>
            <p>生成时间：${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.print()
  }

  // 分享凭证（复制链接）
  const handleShare = async () => {
    const url = `${window.location.origin}/applications/receipt/${application.applicationNumber}`

    try {
      await navigator.clipboard.writeText(url)
      // 这里可以添加成功提示
      alert('凭证链接已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
      alert('复制失败，请手动复制链接')
    }
  }

  const statusInfo = getStatusInfo(application.status)

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* 操作按钮 */}
      <div className=\"flex justify-end gap-2 mb-6 no-print\">
        <Button
          variant=\"outline\"
          onClick={handleShare}
          className=\"flex items-center gap-2\"
        >
          <ShareIcon className=\"h-4 w-4\" />
          分享凭证
        </Button>
        <Button
          variant=\"outline\"
          onClick={handlePrint}
          className=\"flex items-center gap-2\"
        >
          <PrinterIcon className=\"h-4 w-4\" />
          打印凭证
        </Button>
      </div>

      {/* 凭证内容 */}
      <Card className=\"shadow-lg\">
        <CardHeader className=\"text-center bg-gradient-to-r from-blue-50 to-indigo-50 border-b\">
          <div className=\"flex items-center justify-center mb-4\">
            <DocumentTextIcon className=\"h-12 w-12 text-blue-600\" />
          </div>
          <CardTitle className=\"text-2xl font-bold text-gray-900 mb-2\">
            数据资产申请凭证
          </CardTitle>
          <div className=\"flex items-center justify-center gap-4\">
            <p className=\"text-lg font-semibold text-gray-700\">
              申请编号：{application.applicationNumber}
            </p>
            <Badge className={statusInfo.color}>
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent ref={receiptRef} className=\"p-8\">
          {/* 申请人信息 */}
          <div className=\"section\">
            <h3 className=\"section-title flex items-center gap-2\">
              <UserCircleIcon className=\"h-5 w-5\" />
              申请人信息
            </h3>
            <div className=\"info-grid\">
              <div className=\"info-item\">
                <span className=\"info-label\">申请人：</span>
                <span className=\"info-value font-semibold\">{application.applicantName}</span>
              </div>
              {application.department && (
                <div className=\"info-item\">
                  <BuildingOfficeIcon className=\"h-4 w-4 text-gray-400 mr-2\" />
                  <span className=\"info-label\">部门：</span>
                  <span className=\"info-value\">{application.department}</span>
                </div>
              )}
              <div className=\"info-item\">
                <EnvelopeIcon className=\"h-4 w-4 text-gray-400 mr-2\" />
                <span className=\"info-label\">联系邮箱：</span>
                <span className=\"info-value\">{application.contactEmail}</span>
              </div>
              {application.contactPhone && (
                <div className=\"info-item\">
                  <PhoneIcon className=\"h-4 w-4 text-gray-400 mr-2\" />
                  <span className=\"info-label\">联系电话：</span>
                  <span className=\"info-value\">{application.contactPhone}</span>
                </div>
              )}
            </div>
          </div>

          <Separator className=\"my-6\" />

          {/* 资产信息 */}
          <div className=\"section\">
            <h3 className=\"section-title\">申请资产信息</h3>
            <div className=\"asset-info\">
              <div className=\"flex justify-between items-start mb-3\">
                <h4 className=\"text-lg font-semibold text-gray-900\">{application.asset.name}</h4>
                <Badge variant=\"outline\" className=\"ml-2\">
                  {application.asset.category.name}
                </Badge>
              </div>
              {application.asset.description && (
                <p className=\"text-gray-600 leading-relaxed\">{application.asset.description}</p>
              )}
            </div>
          </div>

          <Separator className=\"my-6\" />

          {/* 申请详情 */}
          <div className=\"section\">
            <h3 className=\"section-title\">申请详情</h3>
            <div className=\"space-y-4\">
              <div className=\"info-item\">
                <span className=\"info-label\">业务用途：</span>
                <span className=\"info-value font-semibold\">{getPurposeLabel(application.purpose)}</span>
              </div>
              <div className=\"info-item\">
                <CalendarIcon className=\"h-4 w-4 text-gray-400 mr-2\" />
                <span className=\"info-label\">使用期限：</span>
                <span className=\"info-value\">
                  {format(new Date(application.startDate), 'yyyy年MM月dd日')} 至{' '}
                  {format(new Date(application.endDate), 'yyyy年MM月dd日')}
                </span>
              </div>
              <div>
                <span className=\"info-label block mb-2\">申请理由：</span>
                <div className=\"reason-text\">
                  {application.reason}
                </div>
              </div>
            </div>
          </div>

          <Separator className=\"my-6\" />

          {/* 时间信息 */}
          <div className=\"section\">
            <h3 className=\"section-title\">时间信息</h3>
            <div className=\"info-grid\">
              <div className=\"info-item\">
                <span className=\"info-label\">创建时间：</span>
                <span className=\"info-value\">
                  {format(new Date(application.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                </span>
              </div>
              {application.submittedAt && (
                <div className=\"info-item\">
                  <span className=\"info-label\">提交时间：</span>
                  <span className=\"info-value\">
                    {format(new Date(application.submittedAt), 'yyyy-MM-dd HH:mm:ss')}
                  </span>
                </div>
              )}
              {application.reviewedAt && (
                <div className=\"info-item\">
                  <span className=\"info-label\">审核时间：</span>
                  <span className=\"info-value\">
                    {format(new Date(application.reviewedAt), 'yyyy-MM-dd HH:mm:ss')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 审核信息（如果有） */}
          {application.reviewComment && (
            <>
              <Separator className=\"my-6\" />
              <div className=\"section\">
                <h3 className=\"section-title\">审核意见</h3>
                <div className=\"reason-text\">
                  {application.reviewComment}
                </div>
                {application.reviewer && (
                  <div className=\"mt-4 text-sm text-gray-600\">
                    审核人：{application.reviewer.name || application.reviewer.email}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 凭证验证信息 */}
          <div className=\"mt-8 pt-6 border-t border-dashed border-gray-300\">
            <div className=\"flex items-center justify-between text-sm text-gray-500\">
              <div className=\"flex items-center gap-2\">
                <QrCodeIcon className=\"h-4 w-4\" />
                <span>凭证唯一标识：{application.applicationNumber}</span>
              </div>
              <div>
                生成时间：{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
              </div>
            </div>
            <div className=\"mt-3 text-center text-xs text-gray-400\">
              本凭证由数据资产管理平台自动生成，具有法律效力
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ApplicationReceipt