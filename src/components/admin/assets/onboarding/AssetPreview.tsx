'use client';

import React from 'react';
import { AssetFormData, ValidationResult, AssetType } from '@/types/assetOnboarding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Info,
  Edit,
  AlertTriangle,
  CheckCircle,
  Database,
  Calendar,
  User,
  Shield,
  Tag,
  FileText,
  Clock,
  Activity
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AssetPreviewProps {
  data: AssetFormData;
  validationResult?: ValidationResult | null;
  onEdit?: (section: string) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  'user_data': '用户数据',
  'business_data': '业务数据',
  'system_data': '系统数据',
  'external_data': '外部数据',
  'analytics_data': '分析数据',
  'archive_data': '归档数据'
};

const ASSET_TYPE_NAMES: Record<string, string> = {
  [AssetType.TABLE]: '数据表',
  [AssetType.VIEW]: '视图',
  [AssetType.API]: 'API接口',
  [AssetType.FILE]: '文件',
  [AssetType.STREAM]: '数据流'
};

const DATA_SOURCE_NAMES: Record<string, string> = {
  'mysql': 'MySQL',
  'postgresql': 'PostgreSQL',
  'oracle': 'Oracle',
  'sqlserver': 'SQL Server',
  'mongodb': 'MongoDB',
  'hive': 'Hive',
  'clickhouse': 'ClickHouse',
  'elasticsearch': 'Elasticsearch',
  'redis': 'Redis',
  'kafka': 'Kafka',
  'api': 'API',
  'file': '文件'
};

const UPDATE_FREQUENCY_NAMES: Record<string, string> = {
  'realtime': '实时',
  'daily': '每日',
  'weekly': '每周',
  'monthly': '每月',
  'quarterly': '每季度',
  'yearly': '每年',
  'manual': '手动'
};

const SENSITIVITY_LEVEL_NAMES: Record<string, string> = {
  'public': '公开',
  'internal': '内部',
  'confidential': '机密',
  'restricted': '限制'
};

const getSensitivityLevelColor = (level: string) => {
  switch (level) {
    case 'public': return 'bg-green-100 text-green-800 border-green-200';
    case 'internal': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'confidential': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'restricted': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function AssetPreview({ data, validationResult, onEdit }: AssetPreviewProps) {
  // 计算完整性得分
  const calculateCompleteness = () => {
    let score = 0;
    let total = 0;

    // 必填字段
    const requiredFields = ['name', 'description', 'categoryId', 'ownerId'];
    requiredFields.forEach(field => {
      total++;
      if (data[field as keyof AssetFormData]) score++;
    });

    // 可选但重要的字段
    const optionalFields = ['displayName', 'schema', 'metadata'];
    optionalFields.forEach(field => {
      total++;
      if (data[field as keyof AssetFormData]) score++;
    });

    // 标签
    total++;
    if (data.metadata?.tags && data.metadata.tags.length > 0) score++;

    return Math.round((score / total) * 100);
  };

  const completeness = calculateCompleteness();

  return (
    <div className="space-y-6">
      {/* 标题和完整性指标 */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          资产预览
        </h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">完整性</span>
            <Badge
              variant={completeness >= 80 ? "default" : completeness >= 60 ? "secondary" : "destructive"}
              className="font-medium"
            >
              {completeness}%
            </Badge>
          </div>
        </div>
      </div>

      {/* 验证结果提示 */}
      {validationResult && (
        <>
          {validationResult.errors.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">发现 {validationResult.errors.length} 个错误：</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.errors.map((error, index) => (
                    <li key={index} className="text-sm">
                      <strong>{error.field}:</strong> {error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validationResult.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">注意事项：</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">
                      <strong>{warning.field}:</strong> {warning.message}
                      {warning.suggestion && (
                        <div className="text-blue-600 mt-1">💡 建议：{warning.suggestion}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validationResult.isValid && validationResult.errors.length === 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ 所有必填项已完成，资产信息验证通过！
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* 基本信息卡片 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Info className="w-5 h-5 mr-2" />
            基本信息
          </CardTitle>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit('basic')}>
              <Edit className="w-4 h-4 mr-1" />
              编辑
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">资产名称</label>
                <p className="font-medium text-lg">{data.name || '-'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">显示名称</label>
                <p className="text-gray-900">{data.displayName || data.name || '-'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">资产类型</label>
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-gray-500" />
                  <Badge variant="outline">
                    {ASSET_TYPE_NAMES[data.assetType as string] || data.assetType}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">分类</label>
                <p className="text-gray-900">
                  {CATEGORY_NAMES[data.categoryId || ''] || data.categoryId || '-'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">负责人</label>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{data.ownerId || '-'}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">访问级别</label>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <Badge
                    className={`border ${getSensitivityLevelColor(data.metadata?.sensitivityLevel || 'public')}`}
                  >
                    {SENSITIVITY_LEVEL_NAMES[data.metadata?.sensitivityLevel || 'public']}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium text-gray-500">描述</label>
            <p className="mt-1 text-gray-900 whitespace-pre-wrap">
              {data.description || '-'}
            </p>
          </div>

          {/* 标签 */}
          {data.metadata?.tags && data.metadata.tags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-500 flex items-center mb-2">
                <Tag className="w-4 h-4 mr-1" />
                标签
              </label>
              <div className="flex flex-wrap gap-2">
                {data.metadata.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 表结构信息 */}
      {data.schema && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              表结构信息
            </CardTitle>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit('schema')}>
                <Edit className="w-4 h-4 mr-1" />
                编辑
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">表名</label>
                <p className="font-mono bg-gray-50 px-2 py-1 rounded border">
                  {data.schema.tableName || '-'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">字段数量</label>
                <p className="text-gray-900">
                  {data.schema.fields?.length || 0} 个字段
                </p>
              </div>
            </div>

            {/* 字段列表预览 */}
            {data.schema.fields && data.schema.fields.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">字段预览</label>
                <div className="max-h-48 overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">字段名</th>
                        <th className="px-3 py-2 text-left">类型</th>
                        <th className="px-3 py-2 text-left">属性</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.schema.fields.slice(0, 10).map((field, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2 font-mono text-sm">{field.name}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {field.primaryKey && (
                                <Badge variant="default" className="text-xs">PK</Badge>
                              )}
                              {field.nullable && (
                                <Badge variant="secondary" className="text-xs">NULL</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.schema.fields.length > 10 && (
                    <div className="text-center py-2 text-sm text-gray-500 bg-gray-50">
                      还有 {data.schema.fields.length - 10} 个字段...
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 元数据信息 */}
      {data.metadata && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              元数据信息
            </CardTitle>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit('metadata')}>
                <Edit className="w-4 h-4 mr-1" />
                编辑
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">数据源</label>
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-gray-500" />
                  <Badge variant="outline">
                    {DATA_SOURCE_NAMES[data.metadata.dataSource as string] || data.metadata.dataSource}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">更新频率</label>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <Badge variant="outline">
                    {UPDATE_FREQUENCY_NAMES[data.metadata.updateFrequency as string] || data.metadata.updateFrequency}
                  </Badge>
                </div>
              </div>

              {data.metadata.dataVolume && (
                <div>
                  <label className="text-sm font-medium text-gray-500">数据量</label>
                  <p className="text-gray-900">{data.metadata.dataVolume.toLocaleString()} 条</p>
                </div>
              )}
            </div>

            {/* 数据质量信息 */}
            {data.metadata.dataQuality && (
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">数据质量评估</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.metadata.dataQuality.completeness}%
                    </div>
                    <div className="text-xs text-gray-500">完整性</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {data.metadata.dataQuality.accuracy}%
                    </div>
                    <div className="text-xs text-gray-500">准确性</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.metadata.dataQuality.consistency}%
                    </div>
                    <div className="text-xs text-gray-500">一致性</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {data.metadata.dataQuality.timeliness}%
                    </div>
                    <div className="text-xs text-gray-500">时效性</div>
                  </div>
                </div>
              </div>
            )}

            {/* 业务词汇表 */}
            {data.metadata.businessGlossary && data.metadata.businessGlossary.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">业务词汇</label>
                <div className="flex flex-wrap gap-2">
                  {data.metadata.businessGlossary.map((term, index) => (
                    <Badge key={index} variant="outline">
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 系统信息 */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">系统信息</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium">状态：</span>
              <Badge variant="secondary" className="ml-2">
                {data.status === 'draft' ? '草稿' :
                 data.status === 'review' ? '待审核' :
                 data.status === 'active' ? '已发布' : '未知'}
              </Badge>
            </div>
            <div>
              <span className="font-medium">创建时间：</span>
              <span className="ml-2">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}