'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  FileTemplate,
  Star,
  Search,
  Clock,
  User,
  Tag as TagIcon,
  CheckCircle,
  Settings,
  Plus,
  Layers,
  Database,
  Globe,
  BarChart3,
  FileText,
  Users,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'tags' | 'select' | 'date' | 'number'
  required: boolean
  defaultValue?: any
  options?: string[]
  placeholder?: string
  description?: string
}

interface MetadataTemplate {
  id: string
  name: string
  description: string
  category: 'database' | 'api' | 'report' | 'analytics' | 'document' | 'custom'
  icon?: string
  fields: TemplateField[]
  tags: string[]
  usageCount: number
  createdBy: string
  createdAt: Date
  lastUsed?: Date
  isRecommended?: boolean
  isFavorite?: boolean
}

interface MetadataTemplateSelectorProps {
  templates?: MetadataTemplate[]
  onTemplateSelect: (template: MetadataTemplate) => void
  onTemplateApply?: (template: MetadataTemplate, customFields?: any) => void
  selectedCategory?: string
  onCategoryChange?: (category: string) => void
  showCreateTemplate?: boolean
  onCreateTemplate?: () => void
  className?: string
}

const defaultTemplates: MetadataTemplate[] = [
  {
    id: 'db-table-template',
    name: '数据库表模板',
    description: '适用于关系型数据库表的标准元数据模板',
    category: 'database',
    fields: [
      { name: 'tableName', label: '表名', type: 'text', required: true, placeholder: '输入表名' },
      { name: 'description', label: '表描述', type: 'textarea', required: true, placeholder: '详细描述表的用途和内容' },
      { name: 'owner', label: '负责人', type: 'text', required: true, placeholder: '数据负责人' },
      { name: 'dataSource', label: '数据源', type: 'select', required: true, options: ['生产库', '测试库', '开发库'] },
      { name: 'updateFrequency', label: '更新频率', type: 'select', required: false, options: ['实时', '每日', '每周', '每月'] },
      { name: 'tags', label: '标签', type: 'tags', required: false, placeholder: '添加相关标签' }
    ],
    tags: ['数据库', '表结构', '关系型'],
    usageCount: 156,
    createdBy: '系统管理员',
    createdAt: new Date('2023-01-15'),
    lastUsed: new Date('2023-11-10'),
    isRecommended: true
  },
  {
    id: 'api-template',
    name: 'API接口模板',
    description: 'RESTful API接口的标准文档模板',
    category: 'api',
    fields: [
      { name: 'apiName', label: 'API名称', type: 'text', required: true },
      { name: 'description', label: 'API描述', type: 'textarea', required: true },
      { name: 'version', label: '版本号', type: 'text', required: true, defaultValue: '1.0.0' },
      { name: 'method', label: '请求方法', type: 'select', required: true, options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { name: 'owner', label: '维护人员', type: 'text', required: true },
      { name: 'tags', label: '标签', type: 'tags', required: false }
    ],
    tags: ['API', '接口', 'RESTful'],
    usageCount: 89,
    createdBy: '开发团队',
    createdAt: new Date('2023-02-20'),
    lastUsed: new Date('2023-11-08'),
    isRecommended: true
  },
  {
    id: 'report-template',
    name: '报表模板',
    description: '业务报表和分析文档的标准模板',
    category: 'report',
    fields: [
      { name: 'reportName', label: '报表名称', type: 'text', required: true },
      { name: 'description', label: '报表说明', type: 'textarea', required: true },
      { name: 'businessPurpose', label: '业务用途', type: 'textarea', required: true },
      { name: 'frequency', label: '生成频率', type: 'select', required: true, options: ['实时', '每日', '每周', '每月', '季度', '年度'] },
      { name: 'owner', label: '负责人', type: 'text', required: true },
      { name: 'tags', label: '标签', type: 'tags', required: false }
    ],
    tags: ['报表', '分析', '业务'],
    usageCount: 67,
    createdBy: '业务分析师',
    createdAt: new Date('2023-03-10'),
    isRecommended: false
  },
  {
    id: 'analytics-template',
    name: '数据分析模板',
    description: '数据分析项目和指标的标准化模板',
    category: 'analytics',
    fields: [
      { name: 'analysisName', label: '分析名称', type: 'text', required: true },
      { name: 'description', label: '分析描述', type: 'textarea', required: true },
      { name: 'metrics', label: '关键指标', type: 'textarea', required: true, placeholder: '列出主要分析指标' },
      { name: 'dataRange', label: '数据范围', type: 'text', required: false, placeholder: '数据时间范围' },
      { name: 'analyst', label: '分析师', type: 'text', required: true },
      { name: 'tags', label: '标签', type: 'tags', required: false }
    ],
    tags: ['数据分析', '指标', '分析师'],
    usageCount: 45,
    createdBy: '数据团队',
    createdAt: new Date('2023-04-05'),
    isRecommended: false
  }
]

export function MetadataTemplateSelector({
  templates = defaultTemplates,
  onTemplateSelect,
  onTemplateApply,
  selectedCategory = 'all',
  onCategoryChange,
  showCreateTemplate = true,
  onCreateTemplate,
  className
}: MetadataTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredTemplates, setFilteredTemplates] = useState(templates)
  const [selectedTemplate, setSelectedTemplate] = useState<MetadataTemplate | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // 分类选项
  const categories = [
    { id: 'all', label: '全部模板', icon: Layers },
    { id: 'database', label: '数据库', icon: Database },
    { id: 'api', label: 'API接口', icon: Globe },
    { id: 'report', label: '报表', icon: BarChart3 },
    { id: 'analytics', label: '数据分析', icon: Zap },
    { id: 'document', label: '文档', icon: FileText },
    { id: 'custom', label: '自定义', icon: Settings }
  ]

  // 过滤模板
  useEffect(() => {
    let filtered = templates

    // 分类过滤
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory)
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // 排序：推荐 -> 使用次数 -> 最近使用
    filtered.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1
      if (!a.isRecommended && b.isRecommended) return 1
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
      if (a.lastUsed && b.lastUsed) return b.lastUsed.getTime() - a.lastUsed.getTime()
      return 0
    })

    setFilteredTemplates(filtered)
  }, [templates, selectedCategory, searchQuery])

  // 获取分类图标
  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category?.icon || FileTemplate
  }

  // 获取模板图标
  const getTemplateIcon = (category: string) => {
    const IconComponent = getCategoryIcon(category)
    return <IconComponent className="w-5 h-5" />
  }

  // 处理模板选择
  const handleTemplateSelect = (template: MetadataTemplate) => {
    setSelectedTemplate(template)
    onTemplateSelect(template)
  }

  // 处理模板应用
  const handleTemplateApply = (template: MetadataTemplate) => {
    if (onTemplateApply) {
      onTemplateApply(template)
    }
    setShowPreview(false)
  }

  // 格式化使用次数
  const formatUsageCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileTemplate className="w-5 h-5" />
            元数据模板
          </div>
          {showCreateTemplate && onCreateTemplate && (
            <Button
              size="sm"
              onClick={onCreateTemplate}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              新建模板
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索模板名称、描述或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* 分类筛选 */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const IconComponent = category.icon
            const isSelected = selectedCategory === category.id

            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange?.(category.id)}
                className="text-xs"
              >
                <IconComponent className="w-3 h-3 mr-1" />
                {category.label}
              </Button>
            )
          })}
        </div>

        {/* 模板列表 */}
        <div className="space-y-3">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileTemplate className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>未找到匹配的模板</p>
              <p className="text-sm mt-2">尝试调整搜索条件或选择其他分类</p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={cn(
                  "p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-sm",
                  selectedTemplate?.id === template.id && "border-primary bg-primary/5"
                )}
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-primary mt-1">
                      {getTemplateIcon(template.category)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{template.name}</h3>
                        {template.isRecommended && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            推荐
                          </Badge>
                        )}
                        {template.isFavorite && (
                          <Badge variant="outline" className="text-xs">
                            收藏
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {template.description}
                      </p>

                      {/* 标签 */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {template.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* 元信息 */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          使用 {formatUsageCount(template.usageCount)} 次
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {template.createdBy}
                        </div>
                        {template.lastUsed && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            最近使用
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-3">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTemplateApply(template)
                      }}
                      className="text-xs whitespace-nowrap"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      应用模板
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTemplate(template)
                        setShowPreview(true)
                      }}
                      className="text-xs whitespace-nowrap"
                    >
                      预览
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 模板预览 */}
        {showPreview && selectedTemplate && (
          <div className="mt-6 p-4 border border-primary rounded-lg bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">模板预览: {selectedTemplate.name}</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPreview(false)}
                className="text-xs"
              >
                关闭
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                {selectedTemplate.description}
              </p>

              <Separator />

              <div>
                <h5 className="font-medium text-sm mb-3">包含字段 ({selectedTemplate.fields.length}个):</h5>
                <div className="space-y-2">
                  {selectedTemplate.fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-background border rounded text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        {field.required && (
                          <Badge variant="destructive" className="text-xs">必填</Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  size="sm"
                  onClick={() => handleTemplateApply(selectedTemplate)}
                  className="text-xs"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  确认应用
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p><strong>使用说明：</strong></p>
          <p>• 选择合适的模板分类快速筛选</p>
          <p>• 使用搜索功能查找特定模板</p>
          <p>• 点击"预览"查看模板详细字段</p>
          <p>• 点击"应用模板"快速填充元数据字段</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default MetadataTemplateSelector