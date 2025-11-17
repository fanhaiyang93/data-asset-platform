'use client';

import React, { useState } from 'react';
import { AssetType, TemplateType, AssetTemplate } from '@/types/assetOnboarding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Database,
  Eye,
  FileText,
  Zap,
  Layers,
  BarChart3,
  Globe,
  Search,
  Star,
  Clock,
  Users
} from 'lucide-react';

interface TemplateSelectorProps {
  selectedType?: AssetType;
  onSelect: (assetType: AssetType) => void;
  onApplyTemplate?: (template: AssetTemplate) => void;
}

// 模拟模板数据
const MOCK_TEMPLATES: AssetTemplate[] = [
  {
    id: 'tmpl_001',
    name: '用户档案表',
    type: TemplateType.BUSINESS_TABLE,
    description: '标准用户信息表，包含基本信息、联系方式、偏好设置等字段',
    schema: {
      assetType: AssetType.TABLE,
      schema: {
        tableName: 'user_profile',
        fields: [
          { id: '1', name: 'user_id', type: 'string', nullable: false, primaryKey: true, description: '用户唯一标识' },
          { id: '2', name: 'username', type: 'string', nullable: false, primaryKey: false, description: '用户名' },
          { id: '3', name: 'email', type: 'string', nullable: false, primaryKey: false, description: '邮箱地址' },
          { id: '4', name: 'phone', type: 'string', nullable: true, primaryKey: false, description: '手机号' },
          { id: '5', name: 'created_at', type: 'datetime', nullable: false, primaryKey: false, description: '创建时间' },
          { id: '6', name: 'updated_at', type: 'datetime', nullable: false, primaryKey: false, description: '更新时间' }
        ]
      },
      metadata: {
        dataSource: 'mysql' as any,
        updateFrequency: 'daily' as any,
        sensitivityLevel: 'internal' as any,
        tags: ['用户数据', 'PII', '核心业务']
      }
    },
    isSystem: true,
    usage: 245,
    createdBy: 'system',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 'tmpl_002',
    name: '订单明细表',
    type: TemplateType.FACT_TABLE,
    description: '电商订单事实表，包含订单基本信息、商品详情、金额计算等',
    schema: {
      assetType: AssetType.TABLE,
      schema: {
        tableName: 'order_detail',
        fields: [
          { id: '1', name: 'order_id', type: 'string', nullable: false, primaryKey: true, description: '订单ID' },
          { id: '2', name: 'user_id', type: 'string', nullable: false, primaryKey: false, description: '用户ID' },
          { id: '3', name: 'product_id', type: 'string', nullable: false, primaryKey: false, description: '商品ID' },
          { id: '4', name: 'quantity', type: 'integer', nullable: false, primaryKey: false, description: '购买数量' },
          { id: '5', name: 'unit_price', type: 'decimal', nullable: false, primaryKey: false, description: '单价' },
          { id: '6', name: 'total_amount', type: 'decimal', nullable: false, primaryKey: false, description: '总金额' },
          { id: '7', name: 'order_date', type: 'datetime', nullable: false, primaryKey: false, description: '下单时间' }
        ]
      },
      metadata: {
        dataSource: 'mysql' as any,
        updateFrequency: 'realtime' as any,
        sensitivityLevel: 'confidential' as any,
        tags: ['订单数据', '业务数据', '事实表']
      }
    },
    isSystem: true,
    usage: 189,
    createdBy: 'system',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20')
  },
  {
    id: 'tmpl_003',
    name: '产品维度表',
    type: TemplateType.DIMENSION_TABLE,
    description: '产品维度信息表，包含商品分类、属性、描述等维度信息',
    schema: {
      assetType: AssetType.TABLE,
      schema: {
        tableName: 'product_dimension',
        fields: [
          { id: '1', name: 'product_id', type: 'string', nullable: false, primaryKey: true, description: '商品ID' },
          { id: '2', name: 'product_name', type: 'string', nullable: false, primaryKey: false, description: '商品名称' },
          { id: '3', name: 'category_id', type: 'string', nullable: false, primaryKey: false, description: '分类ID' },
          { id: '4', name: 'category_name', type: 'string', nullable: false, primaryKey: false, description: '分类名称' },
          { id: '5', name: 'brand', type: 'string', nullable: true, primaryKey: false, description: '品牌' },
          { id: '6', name: 'price', type: 'decimal', nullable: false, primaryKey: false, description: '价格' }
        ]
      },
      metadata: {
        dataSource: 'mysql' as any,
        updateFrequency: 'daily' as any,
        sensitivityLevel: 'internal' as any,
        tags: ['产品数据', '维度表', '主数据']
      }
    },
    isSystem: true,
    usage: 156,
    createdBy: 'system',
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25')
  },
  {
    id: 'tmpl_004',
    name: '系统日志表',
    type: TemplateType.LOG_TABLE,
    description: '应用系统日志表，记录用户操作、系统事件、错误信息等',
    schema: {
      assetType: AssetType.TABLE,
      schema: {
        tableName: 'system_log',
        fields: [
          { id: '1', name: 'log_id', type: 'string', nullable: false, primaryKey: true, description: '日志ID' },
          { id: '2', name: 'timestamp', type: 'datetime', nullable: false, primaryKey: false, description: '时间戳' },
          { id: '3', name: 'level', type: 'string', nullable: false, primaryKey: false, description: '日志级别' },
          { id: '4', name: 'message', type: 'text', nullable: false, primaryKey: false, description: '日志消息' },
          { id: '5', name: 'user_id', type: 'string', nullable: true, primaryKey: false, description: '用户ID' },
          { id: '6', name: 'ip_address', type: 'string', nullable: true, primaryKey: false, description: 'IP地址' }
        ]
      },
      metadata: {
        dataSource: 'clickhouse' as any,
        updateFrequency: 'realtime' as any,
        sensitivityLevel: 'internal' as any,
        tags: ['日志数据', '系统监控', '运维']
      }
    },
    isSystem: true,
    usage: 87,
    createdBy: 'system',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01')
  },
  {
    id: 'tmpl_005',
    name: 'REST API 模板',
    type: TemplateType.API_INTERFACE,
    description: '标准 REST API 接口模板，包含常用的增删改查接口定义',
    schema: {
      assetType: AssetType.API,
      metadata: {
        dataSource: 'api' as any,
        updateFrequency: 'realtime' as any,
        sensitivityLevel: 'public' as any,
        tags: ['API接口', 'REST', 'HTTP']
      }
    },
    isSystem: true,
    usage: 123,
    createdBy: 'system',
    createdAt: new Date('2024-02-05'),
    updatedAt: new Date('2024-02-05')
  }
];

const ASSET_TYPE_OPTIONS = [
  {
    type: AssetType.TABLE,
    icon: Database,
    title: '数据表',
    description: '关系型数据库表、视图等结构化数据',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconColor: 'text-blue-600'
  },
  {
    type: AssetType.VIEW,
    icon: Eye,
    title: '数据视图',
    description: '基于数据表创建的虚拟视图',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    iconColor: 'text-green-600'
  },
  {
    type: AssetType.API,
    icon: Globe,
    title: 'API 接口',
    description: 'REST API、GraphQL 等接口服务',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    iconColor: 'text-purple-600'
  },
  {
    type: AssetType.FILE,
    icon: FileText,
    title: '文件资源',
    description: 'Excel、CSV、JSON 等文件数据',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    iconColor: 'text-orange-600'
  },
  {
    type: AssetType.STREAM,
    icon: Zap,
    title: '数据流',
    description: 'Kafka、消息队列等流式数据',
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    iconColor: 'text-yellow-600'
  }
];

const TEMPLATE_TYPE_ICONS = {
  [TemplateType.BUSINESS_TABLE]: Database,
  [TemplateType.DIMENSION_TABLE]: Layers,
  [TemplateType.FACT_TABLE]: BarChart3,
  [TemplateType.LOG_TABLE]: FileText,
  [TemplateType.API_INTERFACE]: Globe,
  [TemplateType.CUSTOM]: Star
};

export default function TemplateSelector({ selectedType, onSelect, onApplyTemplate }: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<AssetTemplate | null>(null);

  // 筛选模板
  const filteredTemplates = MOCK_TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !selectedType || template.schema.assetType === selectedType;
    return matchesSearch && matchesType;
  });

  // 选择资产类型
  const handleAssetTypeSelect = (assetType: AssetType) => {
    onSelect(assetType);
    setSelectedTemplate(null);
  };

  // 应用模板
  const handleApplyTemplate = (template: AssetTemplate) => {
    setSelectedTemplate(template);
    onSelect(template.schema.assetType!);
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题和说明 */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">选择资产类型或模板</h3>
        <p className="text-gray-600">
          选择合适的资产类型开始创建，或使用预设模板快速开始
        </p>
      </div>

      {/* 资产类型选择 */}
      <div>
        <h4 className="text-lg font-medium mb-4 flex items-center">
          <Star className="w-5 h-5 mr-2" />
          资产类型
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ASSET_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.type;

            return (
              <Card
                key={option.type}
                className={`cursor-pointer transition-all ${option.color} ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'
                }`}
                onClick={() => handleAssetTypeSelect(option.type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${option.color}`}>
                      <Icon className={`w-6 h-6 ${option.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{option.title}</h5>
                      <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                    </div>
                    {isSelected && (
                      <div className="text-blue-600">
                        <Star className="w-5 h-5 fill-current" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 分隔线 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 border-t border-gray-200"></div>
        <span className="text-sm text-gray-500 bg-white px-3">或选择预设模板</span>
        <div className="flex-1 border-t border-gray-200"></div>
      </div>

      {/* 模板搜索 */}
      <div className="space-y-4">
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
          <Badge variant="secondary">
            {filteredTemplates.length} 个模板
          </Badge>
        </div>

        {/* 模板列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => {
            const TypeIcon = TEMPLATE_TYPE_ICONS[template.type];
            const isSelected = selectedTemplate?.id === template.id;

            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-md bg-blue-50' : ''
                }`}
                onClick={() => handleApplyTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-gray-100 rounded">
                        <TypeIcon className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {template.type.replace('_', ' ')}
                          </Badge>
                          {template.isSystem && (
                            <Badge variant="secondary" className="text-xs">
                              系统模板
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-blue-600">
                        <Star className="w-5 h-5 fill-current" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {template.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>{template.usage} 次使用</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{template.updatedAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 显示模板标签 */}
                  {template.schema.metadata?.tags && template.schema.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.schema.metadata.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5">
                          {tag}
                        </Badge>
                      ))}
                      {template.schema.metadata.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          +{template.schema.metadata.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 空状态 */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">未找到匹配的模板</h4>
            <p className="text-gray-600 mb-4">
              尝试调整搜索关键词，或直接选择资产类型开始创建
            </p>
            <Button
              variant="outline"
              onClick={() => setSearchTerm('')}
            >
              清除搜索条件
            </Button>
          </div>
        )}
      </div>

      {/* 自定义创建选项 */}
      <div className="border-t pt-6">
        <Card className="bg-gray-50 border-dashed border-2 border-gray-300 hover:border-gray-400 cursor-pointer transition-all">
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <Star className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">自定义创建</h4>
                <p className="text-sm text-gray-600">
                  不使用模板，从头开始创建自定义资产
                </p>
              </div>
              <Button variant="outline" size="sm">
                开始自定义
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}