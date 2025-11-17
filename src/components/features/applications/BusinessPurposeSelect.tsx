'use client'

import { BusinessPurpose } from '@prisma/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// 业务用途标签映射
const businessPurposeLabels: Record<BusinessPurpose, string> = {
  [BusinessPurpose.REPORT_CREATION]: '报表制作',
  [BusinessPurpose.DATA_ANALYSIS]: '数据分析',
  [BusinessPurpose.BUSINESS_MONITOR]: '业务监控',
  [BusinessPurpose.MODEL_TRAINING]: '模型训练',
  [BusinessPurpose.SYSTEM_INTEGRATION]: '系统集成',
  [BusinessPurpose.RESEARCH_ANALYSIS]: '研究分析',
  [BusinessPurpose.OTHER]: '其他用途'
}

// 业务用途描述映射
const businessPurposeDescriptions: Record<BusinessPurpose, string> = {
  [BusinessPurpose.REPORT_CREATION]: '用于生成业务报表和数据可视化',
  [BusinessPurpose.DATA_ANALYSIS]: '进行数据挖掘、统计分析和洞察发现',
  [BusinessPurpose.BUSINESS_MONITOR]: '监控业务指标和运营状况',
  [BusinessPurpose.MODEL_TRAINING]: '训练机器学习模型和算法优化',
  [BusinessPurpose.SYSTEM_INTEGRATION]: '系统间数据同步和集成开发',
  [BusinessPurpose.RESEARCH_ANALYSIS]: '科研分析和学术研究用途',
  [BusinessPurpose.OTHER]: '其他未列出的业务用途'
}

interface BusinessPurposeSelectProps {
  value?: BusinessPurpose | null
  onValueChange: (value: BusinessPurpose) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function BusinessPurposeSelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = "请选择业务用途",
  className
}: BusinessPurposeSelectProps) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => onValueChange(val as BusinessPurpose)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(businessPurposeLabels).map(([key, label]) => {
          const purpose = key as BusinessPurpose
          return (
            <SelectItem key={key} value={key}>
              <div className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {businessPurposeDescriptions[purpose]}
                </span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}