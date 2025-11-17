'use client';

import React, { useState, useCallback } from 'react';
import { AssetTemplate, TemplateType, AssetFormData, AssetType } from '@/types/assetOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Eye,
  Copy,
  Download,
  Upload,
  Star,
  Users,
  Calendar,
  Database,
  Globe,
  FileText,
  Layers,
  BarChart3,
  Zap,
  Search,
  Filter
} from 'lucide-react';

interface AssetTemplateProps {
  templateType?: TemplateType;
  onApply?: (template: AssetTemplate) => void;
  onSave?: (template: AssetTemplate) => void;
  allowEdit?: boolean;
  allowCreate?: boolean;
}

// 模板类型图标映射
const TEMPLATE_TYPE_ICONS = {
  [TemplateType.BUSINESS_TABLE]: Database,
  [TemplateType.DIMENSION_TABLE]: Layers,
  [TemplateType.FACT_TABLE]: BarChart3,
  [TemplateType.LOG_TABLE]: FileText,
  [TemplateType.API_INTERFACE]: Globe,
  [TemplateType.CUSTOM]: Star
};

// 模板类型选项
const TEMPLATE_TYPE_OPTIONS = [
  { value: TemplateType.BUSINESS_TABLE, label: '业务表模板', description: '标准业务数据表结构' },
  { value: TemplateType.DIMENSION_TABLE, label: '维度表模板', description: '数据仓库维度表结构' },
  { value: TemplateType.FACT_TABLE, label: '事实表模板', description: '数据仓库事实表结构' },
  { value: TemplateType.LOG_TABLE, label: '日志表模板', description: '系统日志表结构' },
  { value: TemplateType.API_INTERFACE, label: 'API接口模板', description: 'REST API接口定义' },
  { value: TemplateType.CUSTOM, label: '自定义模板', description: '用户自定义模板' }
];

// 模拟模板数据
const MOCK_TEMPLATES: AssetTemplate[] = [
  {
    id: 'tmpl_user_profile',
    name: '用户档案表模板',
    type: TemplateType.BUSINESS_TABLE,
    description: '标准用户信息表，包含基本信息、联系方式等常用字段',
    schema: {
      assetType: AssetType.TABLE,
      name: 'user_profile',
      description: '用户档案信息表',
      schema: {
        tableName: 'user_profile',
        fields: [
          { id: '1', name: 'user_id', type: 'string', nullable: false, primaryKey: true, description: '用户ID' },
          { id: '2', name: 'username', type: 'string', nullable: false, primaryKey: false, description: '用户名' },
          { id: '3', name: 'email', type: 'string', nullable: false, primaryKey: false, description: '邮箱' },
          { id: '4', name: 'phone', type: 'string', nullable: true, primaryKey: false, description: '手机号' },
          { id: '5', name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false, description: '创建时间' }
        ]
      },
      metadata: {
        dataSource: 'mysql' as any,
        updateFrequency: 'daily' as any,
        sensitivityLevel: 'internal' as any,
        tags: ['用户数据', 'PII']
      }
    },
    isSystem: true,
    usage: 156,
    createdBy: 'system',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-01')
  },
  {
    id: 'tmpl_order_fact',
    name: '订单事实表模板',
    type: TemplateType.FACT_TABLE,
    description: '电商订单事实表，包含订单维度和度量字段',
    schema: {
      assetType: AssetType.TABLE,
      name: 'order_fact',
      description: '订单业务事实表',
      schema: {
        tableName: 'order_fact',
        fields: [
          { id: '1', name: 'order_key', type: 'string', nullable: false, primaryKey: true, description: '订单键' },
          { id: '2', name: 'user_key', type: 'string', nullable: false, primaryKey: false, description: '用户键' },
          { id: '3', name: 'product_key', type: 'string', nullable: false, primaryKey: false, description: '产品键' },
          { id: '4', name: 'quantity', type: 'integer', nullable: false, primaryKey: false, description: '数量' },
          { id: '5', name: 'unit_price', type: 'decimal', nullable: false, primaryKey: false, description: '单价' },
          { id: '6', name: 'total_amount', type: 'decimal', nullable: false, primaryKey: false, description: '总金额' },
          { id: '7', name: 'order_date', type: 'date', nullable: false, primaryKey: false, description: '订单日期' }
        ]
      },
      metadata: {
        dataSource: 'hive' as any,
        updateFrequency: 'daily' as any,
        sensitivityLevel: 'confidential' as any,
        tags: ['订单数据', '事实表', '核心业务']
      }
    },
    isSystem: true,
    usage: 89,
    createdBy: 'system',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-25')
  },
  {
    id: 'tmpl_api_standard',
    name: '标准API模板',
    type: TemplateType.API_INTERFACE,
    description: 'REST API接口标准模板，包含常用的CRUD接口定义',
    schema: {
      assetType: AssetType.API,
      name: 'standard_api',
      description: '标准REST API接口',
      metadata: {
        dataSource: 'api' as any,
        updateFrequency: 'realtime' as any,
        sensitivityLevel: 'public' as any,
        tags: ['API接口', 'REST', 'HTTP']
      }
    },
    isSystem: true,
    usage: 245,
    createdBy: 'system',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-10')
  }
];

export default function AssetTemplate({
  templateType,
  onApply,
  onSave,
  allowEdit = true,
  allowCreate = true
}: AssetTemplateProps) {
  const [templates, setTemplates] = useState<AssetTemplate[]>(MOCK_TEMPLATES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<TemplateType | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<AssetTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AssetTemplate | null>(null);

  // 过滤模板
  const getFilteredTemplates = useCallback(() => {
    return templates.filter(template => {
      const matchesSearch = !searchTerm ||
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedType === 'all' || template.type === selectedType;
      const matchesProps = !templateType || template.type === templateType;

      return matchesSearch && matchesType && matchesProps;
    });
  }, [templates, searchTerm, selectedType, templateType]);

  // 应用模板
  const handleApplyTemplate = useCallback((template: AssetTemplate) => {
    setSelectedTemplate(template);
    if (onApply) {
      onApply(template);
    }
  }, [onApply]);

  // 复制模板
  const handleCopyTemplate = useCallback(async (template: AssetTemplate) => {
    const newTemplate: AssetTemplate = {
      ...template,
      id: `tmpl_copy_${Date.now()}`,
      name: `${template.name} (副本)`,
      isSystem: false,
      usage: 0,
      createdBy: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setTemplates(prev => [...prev, newTemplate]);
    alert('模板复制成功');
  }, []);

  // 删除模板
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    if (template.isSystem) {
      alert('系统模板不能删除');
      return;
    }

    if (!window.confirm('确定要删除此模板吗？删除后不可恢复。')) {
      return;
    }

    setTemplates(prev => prev.filter(t => t.id !== templateId));
    alert('模板删除成功');
  }, [templates]);

  // 渲染模板卡片
  const renderTemplateCard = useCallback((template: AssetTemplate) => {
    const Icon = TEMPLATE_TYPE_ICONS[template.type];
    const isSelected = selectedTemplate?.id === template.id;

    return (
      <Card
        key={template.id}
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        }`}
        onClick={() => setSelectedTemplate(template)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {TEMPLATE_TYPE_OPTIONS.find(opt => opt.value === template.type)?.label}
                  </Badge>
                  {template.isSystem && (
                    <Badge variant="secondary" className="text-xs">
                      系统
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {isSelected && (
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {template.description}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <div className="flex items-center space-x-3">
              <span className="flex items-center">
                <Users className="w-3 h-3 mr-1" />
                {template.usage}
              </span>
              <span className="flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {template.updatedAt.toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* 模板标签 */}
          {template.schema.metadata?.tags && (
            <div className="flex flex-wrap gap-1 mb-3">
              {template.schema.metadata.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {template.schema.metadata.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{template.schema.metadata.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyTemplate(template);
                }}
              >
                <Zap className="w-3 h-3 mr-1" />
                应用
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyTemplate(template);
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                复制
              </Button>
            </div>

            <div className="flex space-x-1">
              {allowEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTemplate(template);
                  }}
                >
                  <Edit className="w-3 h-3" />
                </Button>
              )}
              {!template.isSystem && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.id);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [selectedTemplate, allowEdit, handleApplyTemplate, handleCopyTemplate, handleDeleteTemplate]);

  // 渲染列表视图
  const renderTemplateList = useCallback((template: AssetTemplate) => {
    const Icon = TEMPLATE_TYPE_ICONS[template.type];
    const isSelected = selectedTemplate?.id === template.id;

    return (
      <Card
        key={template.id}
        className={`cursor-pointer transition-all hover:shadow-sm ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        }`}
        onClick={() => setSelectedTemplate(template)}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Icon className="w-6 h-6 text-gray-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-medium truncate">{template.name}</h4>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {TEMPLATE_TYPE_OPTIONS.find(opt => opt.value === template.type)?.label}
                </Badge>
                {template.isSystem && (
                  <Badge variant="secondary" className="text-xs">
                    系统
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-1">{template.description}</p>
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {template.usage} 次使用
                </span>
                <span>更新于 {template.updatedAt.toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyTemplate(template);
                }}
              >
                应用
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [selectedTemplate, handleApplyTemplate]);

  const filteredTemplates = getFilteredTemplates();

  return (
    <div className="space-y-6">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">资产模板管理</h2>
          <p className="text-gray-600">管理和使用资产创建模板，提高录入效率</p>
        </div>
        {allowCreate && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建模板
          </Button>
        )}
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索模板名称或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as any)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="所有类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有类型</SelectItem>
                {TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="w-8 h-8 p-0"
              >
                <div className="grid grid-cols-2 gap-0.5 w-3 h-3">
                  <div className="bg-current w-1 h-1 rounded-sm"></div>
                  <div className="bg-current w-1 h-1 rounded-sm"></div>
                  <div className="bg-current w-1 h-1 rounded-sm"></div>
                  <div className="bg-current w-1 h-1 rounded-sm"></div>
                </div>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="w-8 h-8 p-0"
              >
                <div className="space-y-1 w-3 h-3">
                  <div className="bg-current w-3 h-0.5 rounded"></div>
                  <div className="bg-current w-3 h-0.5 rounded"></div>
                  <div className="bg-current w-3 h-0.5 rounded"></div>
                </div>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 模板统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
            <div className="text-sm text-gray-500">总模板数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {templates.filter(t => t.isSystem).length}
            </div>
            <div className="text-sm text-gray-500">系统模板</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {templates.filter(t => !t.isSystem).length}
            </div>
            <div className="text-sm text-gray-500">自定义模板</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {templates.reduce((sum, t) => sum + t.usage, 0)}
            </div>
            <div className="text-sm text-gray-500">总使用次数</div>
          </CardContent>
        </Card>
      </div>

      {/* 模板列表 */}
      <div>
        {filteredTemplates.length > 0 ? (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          }>
            {filteredTemplates.map(template =>
              viewMode === 'grid'
                ? renderTemplateCard(template)
                : renderTemplateList(template)
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || selectedType !== 'all' ? '未找到匹配的模板' : '暂无模板'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedType !== 'all'
                  ? '尝试调整搜索条件或筛选类型'
                  : '开始创建第一个资产模板'
                }
              </p>
              <div className="flex justify-center space-x-2">
                {(searchTerm || selectedType !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedType('all');
                    }}
                  >
                    清除筛选
                  </Button>
                )}
                {allowCreate && (
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    创建模板
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 选中模板的详细信息 */}
      {selectedTemplate && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              模板详情：{selectedTemplate.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">模板类型</Label>
                <p>{TEMPLATE_TYPE_OPTIONS.find(opt => opt.value === selectedTemplate.type)?.label}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">使用次数</Label>
                <p>{selectedTemplate.usage} 次</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">创建者</Label>
                <p>{selectedTemplate.createdBy === 'system' ? '系统' : selectedTemplate.createdBy}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">最后更新</Label>
                <p>{selectedTemplate.updatedAt.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">描述</Label>
              <p className="text-gray-900">{selectedTemplate.description}</p>
            </div>

            {/* 字段信息 */}
            {selectedTemplate.schema.schema?.fields && (
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  字段结构 ({selectedTemplate.schema.schema.fields.length} 个字段)
                </Label>
                <div className="max-h-40 overflow-y-auto border rounded bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">字段名</th>
                        <th className="px-2 py-1 text-left">类型</th>
                        <th className="px-2 py-1 text-left">描述</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTemplate.schema.schema.fields.slice(0, 10).map((field, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-2 py-1 font-mono">{field.name}</td>
                          <td className="px-2 py-1">
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                          </td>
                          <td className="px-2 py-1 truncate max-w-32">
                            {field.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedTemplate.schema.schema.fields.length > 10 && (
                    <div className="text-center py-1 text-xs text-gray-500 bg-gray-50">
                      还有 {selectedTemplate.schema.schema.fields.length - 10} 个字段...
                    </div>
                  )}
                </div>
              </div>
            )}

            {onApply && (
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTemplate(null)}
                >
                  取消选择
                </Button>
                <Button
                  onClick={() => handleApplyTemplate(selectedTemplate)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  应用此模板
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}