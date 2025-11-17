'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  Target,
  FileText,
  Tag as TagIcon,
  Calendar,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QualityCheck {
  field: string
  label: string
  status: 'complete' | 'partial' | 'missing'
  importance: 'critical' | 'important' | 'optional'
  score: number
  suggestion?: string
}

interface MetadataQualityReport {
  overallScore: number
  completeness: number
  checks: QualityCheck[]
  suggestions: string[]
}

interface MetadataQualityCheckerProps {
  metadata: {
    name?: string
    description?: string
    tags?: string
    owner?: string
    lastUpdated?: Date
    documentation?: string[]
  }
  onImprove?: (suggestions: string[]) => void
  className?: string
}

export function MetadataQualityChecker({
  metadata,
  onImprove,
  className
}: MetadataQualityCheckerProps) {

  // 计算质量检查结果
  const calculateQualityReport = (): MetadataQualityReport => {
    const checks: QualityCheck[] = [
      {
        field: 'name',
        label: '资产名称',
        status: metadata.name ? 'complete' : 'missing',
        importance: 'critical',
        score: metadata.name ? 100 : 0,
        suggestion: !metadata.name ? '请提供资产名称' : undefined
      },
      {
        field: 'description',
        label: '详细描述',
        status: !metadata.description
          ? 'missing'
          : metadata.description.length > 50
            ? 'complete'
            : 'partial',
        importance: 'critical',
        score: !metadata.description
          ? 0
          : metadata.description.length > 50
            ? 100
            : 60,
        suggestion: !metadata.description
          ? '请添加详细的资产描述'
          : metadata.description.length <= 50
            ? '建议丰富资产描述内容，提供更多使用信息'
            : undefined
      },
      {
        field: 'tags',
        label: '标签分类',
        status: !metadata.tags
          ? 'missing'
          : metadata.tags.split(',').filter(Boolean).length >= 3
            ? 'complete'
            : 'partial',
        importance: 'important',
        score: !metadata.tags
          ? 0
          : metadata.tags.split(',').filter(Boolean).length >= 3
            ? 100
            : 70,
        suggestion: !metadata.tags
          ? '请添加相关标签提高可发现性'
          : metadata.tags.split(',').filter(Boolean).length < 3
            ? '建议添加更多标签，至少3个标签有助于分类和搜索'
            : undefined
      },
      {
        field: 'owner',
        label: '负责人信息',
        status: metadata.owner ? 'complete' : 'missing',
        importance: 'important',
        score: metadata.owner ? 100 : 0,
        suggestion: !metadata.owner ? '请指定资产负责人' : undefined
      },
      {
        field: 'lastUpdated',
        label: '更新时间',
        status: metadata.lastUpdated
          ? (Date.now() - metadata.lastUpdated.getTime() < 90 * 24 * 60 * 60 * 1000)
            ? 'complete'
            : 'partial'
          : 'missing',
        importance: 'optional',
        score: !metadata.lastUpdated
          ? 0
          : (Date.now() - metadata.lastUpdated.getTime() < 90 * 24 * 60 * 60 * 1000)
            ? 100
            : 50,
        suggestion: !metadata.lastUpdated
          ? '更新时间信息缺失'
          : (Date.now() - metadata.lastUpdated.getTime() >= 90 * 24 * 60 * 60 * 1000)
            ? '资产信息较久未更新，建议检查并更新'
            : undefined
      },
      {
        field: 'documentation',
        label: '相关文档',
        status: metadata.documentation && metadata.documentation.length > 0
          ? 'complete'
          : 'missing',
        importance: 'optional',
        score: metadata.documentation && metadata.documentation.length > 0 ? 100 : 0,
        suggestion: !metadata.documentation || metadata.documentation.length === 0
          ? '建议上传相关文档，如使用说明、数据字典等'
          : undefined
      }
    ]

    // 计算加权分数
    const weights = {
      critical: 0.4,
      important: 0.35,
      optional: 0.25
    }

    let totalWeightedScore = 0
    let totalWeight = 0

    checks.forEach(check => {
      const weight = weights[check.importance]
      totalWeightedScore += check.score * weight
      totalWeight += weight * 100
    })

    const overallScore = Math.round(totalWeightedScore / totalWeight * 100)
    const completeness = Math.round(
      checks.filter(c => c.status === 'complete').length / checks.length * 100
    )

    const suggestions = checks
      .filter(check => check.suggestion)
      .map(check => check.suggestion!)

    return {
      overallScore,
      completeness,
      checks,
      suggestions
    }
  }

  const report = calculateQualityReport()

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />
      case 'missing':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'description':
        return <FileText className="w-4 h-4" />
      case 'tags':
        return <TagIcon className="w-4 h-4" />
      case 'owner':
        return <User className="w-4 h-4" />
      case 'lastUpdated':
        return <Calendar className="w-4 h-4" />
      default:
        return <Target className="w-4 h-4" />
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          元数据完整性检查
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 总体评分 */}
        <div className="grid grid-cols-2 gap-4">
          <div className={cn(
            "p-4 rounded-lg border text-center",
            getScoreColor(report.overallScore)
          )}>
            <div className="text-2xl font-bold">{report.overallScore}</div>
            <div className="text-sm font-medium">质量评分</div>
          </div>
          <div className={cn(
            "p-4 rounded-lg border text-center",
            getScoreColor(report.completeness)
          )}>
            <div className="text-2xl font-bold">{report.completeness}%</div>
            <div className="text-sm font-medium">完整度</div>
          </div>
        </div>

        {/* 详细检查项 */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">检查详情</h4>
          <div className="space-y-2">
            {report.checks.map((check, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-muted-foreground">
                    {getFieldIcon(check.field)}
                  </div>
                  <span className="font-medium text-sm">{check.label}</span>
                  <Badge
                    variant={check.importance === 'critical' ? 'destructive' :
                            check.importance === 'important' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {check.importance === 'critical' ? '必需' :
                     check.importance === 'important' ? '重要' : '可选'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {check.score}分
                  </span>
                  {getStatusIcon(check.status)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 改进建议 */}
        {report.suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">改进建议</h4>
              {onImprove && (
                <Button
                  size="sm"
                  onClick={() => onImprove(report.suggestions)}
                  className="text-xs"
                >
                  应用建议
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {report.suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 质量等级说明 */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p><strong>评分说明：</strong></p>
          <p>• 90-100分：优秀 - 元数据信息完整规范</p>
          <p>• 70-89分：良好 - 基本信息完整，建议完善细节</p>
          <p>• 0-69分：需要改进 - 缺少重要信息，影响使用体验</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default MetadataQualityChecker