'use client';

import React, { useState } from 'react';
import { AssetFormData, DataSourceType } from '@/types/assetOnboarding';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Database,
  Clock,
  Shield,
  BarChart3,
  Tag,
  AlertCircle,
  Plus,
  X,
  Calendar,
  TrendingUp,
  Users,
  Settings
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MetadataFormProps {
  data: Partial<AssetFormData>;
  errors: Record<string, string[]>;
  onChange: (updates: Partial<AssetFormData>) => void;
}

const DATA_SOURCES = [
  { value: DataSourceType.MYSQL, label: 'MySQL', icon: '🐬', description: 'MySQL 关系型数据库' },
  { value: DataSourceType.POSTGRESQL, label: 'PostgreSQL', icon: '🐘', description: 'PostgreSQL 数据库' },
  { value: DataSourceType.ORACLE, label: 'Oracle', icon: '🔶', description: 'Oracle 数据库' },
  { value: DataSourceType.SQLSERVER, label: 'SQL Server', icon: '📊', description: 'Microsoft SQL Server' },
  { value: DataSourceType.MONGODB, label: 'MongoDB', icon: '🍃', description: 'MongoDB 文档数据库' },
  { value: DataSourceType.ELASTICSEARCH, label: 'Elasticsearch', icon: '🔍', description: 'Elasticsearch 搜索引擎' },
  { value: DataSourceType.HIVE, label: 'Hive', icon: '🐝', description: 'Apache Hive 数据仓库' },
  { value: DataSourceType.CLICKHOUSE, label: 'ClickHouse', icon: '⚡', description: 'ClickHouse 分析数据库' },
  { value: DataSourceType.REDIS, label: 'Redis', icon: '🔴', description: 'Redis 内存数据库' },
  { value: DataSourceType.KAFKA, label: 'Kafka', icon: '📨', description: 'Apache Kafka 消息队列' },
  { value: DataSourceType.API, label: 'API', icon: '🌐', description: 'REST/GraphQL API' },
  { value: DataSourceType.FILE, label: 'File', icon: '📁', description: '文件系统' }
];

const UPDATE_FREQUENCIES = [
  { value: 'realtime', label: '实时', description: '数据实时更新', color: 'bg-green-100 text-green-800' },
  { value: 'daily', label: '每日', description: '每天更新一次', color: 'bg-blue-100 text-blue-800' },
  { value: 'weekly', label: '每周', description: '每周更新一次', color: 'bg-purple-100 text-purple-800' },
  { value: 'monthly', label: '每月', description: '每月更新一次', color: 'bg-orange-100 text-orange-800' },
  { value: 'quarterly', label: '每季度', description: '每季度更新一次', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'yearly', label: '每年', description: '每年更新一次', color: 'bg-red-100 text-red-800' },
  { value: 'manual', label: '手动', description: '手动触发更新', color: 'bg-gray-100 text-gray-800' }
];

const SENSITIVITY_LEVELS = [
  {
    value: 'public',
    label: '公开',
    description: '所有用户都可以访问',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '🔓'
  },
  {
    value: 'internal',
    label: '内部',
    description: '仅内部员工可以访问',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '🏢'
  },
  {
    value: 'confidential',
    label: '机密',
    description: '需要特殊权限才能访问',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '⚠️'
  },
  {
    value: 'restricted',
    label: '限制',
    description: '仅指定人员可以访问',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '🔒'
  }
];

const COMMON_BUSINESS_TERMS = [
  '用户数据', 'PII', '核心业务', '财务数据', '订单信息',
  '产品目录', '库存管理', '营销数据', '客户服务', '系统日志',
  '性能监控', '安全审计', '合规数据', 'GDPR', '数据治理'
];

export default function MetadataForm({ data, errors, onChange }: MetadataFormProps) {
  const [customTerm, setCustomTerm] = useState('');

  const metadata = data.metadata || {
    dataSource: DataSourceType.MYSQL,
    updateFrequency: 'daily',
    sensitivityLevel: 'internal',
    tags: [],
    businessGlossary: []
  };

  // 更新元数据
  const updateMetadata = (updates: any) => {
    onChange({
      metadata: {
        ...metadata,
        ...updates
      }
    });
  };

  // 添加业务术语
  const addBusinessTerm = (term: string) => {
    const currentTerms = metadata.businessGlossary || [];
    if (!currentTerms.includes(term)) {
      updateMetadata({
        businessGlossary: [...currentTerms, term]
      });
    }
    setCustomTerm('');
  };

  // 移除业务术语
  const removeBusinessTerm = (term: string) => {
    const currentTerms = metadata.businessGlossary || [];
    updateMetadata({
      businessGlossary: currentTerms.filter(t => t !== term)
    });
  };

  // 更新数据质量评估
  const updateDataQuality = (field: string, value: number) => {
    const currentQuality = metadata.dataQuality || {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      timeliness: 0
    };

    updateMetadata({
      dataQuality: {
        ...currentQuality,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 数据源配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            数据源配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                数据源类型 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={metadata.dataSource}
                onValueChange={(value) => updateMetadata({ dataSource: value as DataSourceType })}
              >
                <SelectTrigger className={errors.dataSource ? 'border-red-500' : ''}>
                  <SelectValue placeholder="请选择数据源类型" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      <div className="flex items-center space-x-2">
                        <span>{source.icon}</span>
                        <div>
                          <div className="font-medium">{source.label}</div>
                          <div className="text-xs text-gray-500">{source.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.dataSource && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.dataSource[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>连接字符串</Label>
              <Input
                value={metadata.connectionString || ''}
                onChange={(e) => updateMetadata({ connectionString: e.target.value })}
                placeholder="数据源连接配置（可选）"
                type="password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>数据量（条）</Label>
              <Input
                type="number"
                value={metadata.dataVolume || ''}
                onChange={(e) => updateMetadata({ dataVolume: parseInt(e.target.value) || 0 })}
                placeholder="预估数据条数"
              />
            </div>

            <div className="space-y-2">
              <Label>保留期限（天）</Label>
              <Input
                type="number"
                value={metadata.retentionPeriod || ''}
                onChange={(e) => updateMetadata({ retentionPeriod: parseInt(e.target.value) || 0 })}
                placeholder="数据保留天数"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 更新策略 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            更新策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>
              更新频率 <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {UPDATE_FREQUENCIES.map((frequency) => (
                <div
                  key={frequency.value}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    metadata.updateFrequency === frequency.value
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => updateMetadata({ updateFrequency: frequency.value })}
                >
                  <div className="text-center">
                    <Badge className={`${frequency.color} mb-2`}>
                      {frequency.label}
                    </Badge>
                    <p className="text-xs text-gray-600">{frequency.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {errors.updateFrequency && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.updateFrequency[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 安全性配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            安全性配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>
              敏感级别 <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {SENSITIVITY_LEVELS.map((level) => (
                <div
                  key={level.value}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    metadata.sensitivityLevel === level.value
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => updateMetadata({ sensitivityLevel: level.value })}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{level.icon}</span>
                    <span className="font-medium text-sm">{level.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{level.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>访问要求</Label>
            <Textarea
              value={(metadata.accessRequirements || []).join('\n')}
              onChange={(e) => updateMetadata({
                accessRequirements: e.target.value.split('\n').filter(req => req.trim())
              })}
              placeholder="每行输入一个访问要求，如：&#10;需要数据访问权限申请&#10;必须通过安全培训&#10;仅限工作时间访问"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 数据质量评估 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            数据质量评估
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {['completeness', 'accuracy', 'consistency', 'timeliness'].map((field) => {
            const labels: Record<string, string> = {
              completeness: '完整性',
              accuracy: '准确性',
              consistency: '一致性',
              timeliness: '时效性'
            };

            const descriptions: Record<string, string> = {
              completeness: '数据字段的完整程度',
              accuracy: '数据内容的准确程度',
              consistency: '数据格式的一致程度',
              timeliness: '数据更新的及时程度'
            };

            const currentValue = metadata.dataQuality?.[field as keyof typeof metadata.dataQuality] || 0;

            return (
              <div key={field} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">{labels[field]}</Label>
                    <p className="text-xs text-gray-500">{descriptions[field]}</p>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {currentValue}%
                  </Badge>
                </div>
                <Slider
                  value={[currentValue]}
                  onValueChange={(value) => updateDataQuality(field, value[0])}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 业务词汇表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Tag className="w-5 h-5 mr-2" />
            业务词汇表
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 快速添加常用术语 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">常用业务术语</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_BUSINESS_TERMS.map((term) => (
                <Button
                  key={term}
                  variant="outline"
                  size="sm"
                  onClick={() => addBusinessTerm(term)}
                  disabled={metadata.businessGlossary?.includes(term)}
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {term}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义术语输入 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">添加自定义术语</Label>
            <div className="flex space-x-2">
              <Input
                value={customTerm}
                onChange={(e) => setCustomTerm(e.target.value)}
                placeholder="输入业务术语"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && customTerm.trim()) {
                    addBusinessTerm(customTerm.trim());
                  }
                }}
              />
              <Button
                onClick={() => addBusinessTerm(customTerm.trim())}
                disabled={!customTerm.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 已添加的术语 */}
          {metadata.businessGlossary && metadata.businessGlossary.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                已添加术语 ({metadata.businessGlossary.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {metadata.businessGlossary.map((term, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-red-100 hover:text-red-800 group"
                    onClick={() => removeBusinessTerm(term)}
                  >
                    {term}
                    <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 补充信息 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm text-blue-800 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            配置建议
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>数据源类型决定了数据的访问方式和性能特征</li>
            <li>更新频率应该与业务需求和数据变化频率匹配</li>
            <li>敏感级别影响数据的访问权限和安全控制</li>
            <li>数据质量评估有助于用户了解数据的可信度</li>
            <li>业务词汇表提高数据的可发现性和理解性</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}