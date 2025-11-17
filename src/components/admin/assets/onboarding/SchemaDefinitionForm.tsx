'use client';

import React, { useState } from 'react';
import { AssetFormData, AssetType, AssetField, FieldDataType } from '@/types/assetOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Trash2,
  Database,
  Key,
  AlertCircle,
  Info,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SchemaDefinitionFormProps {
  data: Partial<AssetFormData>;
  errors: Record<string, string[]>;
  onChange: (updates: Partial<AssetFormData>) => void;
  assetType?: AssetType;
}

const DATA_TYPES = [
  { value: FieldDataType.STRING, label: 'String', description: '字符串类型' },
  { value: FieldDataType.INTEGER, label: 'Integer', description: '整数类型' },
  { value: FieldDataType.DECIMAL, label: 'Decimal', description: '小数类型' },
  { value: FieldDataType.BOOLEAN, label: 'Boolean', description: '布尔类型' },
  { value: FieldDataType.DATE, label: 'Date', description: '日期类型' },
  { value: FieldDataType.DATETIME, label: 'DateTime', description: '日期时间类型' },
  { value: FieldDataType.TIMESTAMP, label: 'Timestamp', description: '时间戳类型' },
  { value: FieldDataType.TEXT, label: 'Text', description: '长文本类型' },
  { value: FieldDataType.JSON, label: 'JSON', description: 'JSON对象类型' },
  { value: FieldDataType.BINARY, label: 'Binary', description: '二进制类型' }
];

const SAMPLE_FIELDS: AssetField[] = [
  {
    id: '1',
    name: 'id',
    type: FieldDataType.STRING,
    description: '主键ID',
    nullable: false,
    primaryKey: true
  },
  {
    id: '2',
    name: 'name',
    type: FieldDataType.STRING,
    description: '名称',
    nullable: false,
    primaryKey: false
  },
  {
    id: '3',
    name: 'created_at',
    type: FieldDataType.TIMESTAMP,
    description: '创建时间',
    nullable: false,
    primaryKey: false
  },
  {
    id: '4',
    name: 'updated_at',
    type: FieldDataType.TIMESTAMP,
    description: '更新时间',
    nullable: false,
    primaryKey: false
  }
];

export default function SchemaDefinitionForm({
  data,
  errors,
  onChange,
  assetType
}: SchemaDefinitionFormProps) {
  const [importModalOpen, setImportModalOpen] = useState(false);

  const schema = data.schema || { tableName: '', fields: [] };

  // 更新表名
  const updateTableName = (tableName: string) => {
    onChange({
      schema: {
        ...schema,
        tableName
      }
    });
  };

  // 添加字段
  const addField = () => {
    const newField: AssetField = {
      id: Date.now().toString(),
      name: '',
      type: FieldDataType.STRING,
      description: '',
      nullable: true,
      primaryKey: false
    };

    onChange({
      schema: {
        ...schema,
        fields: [...(schema.fields || []), newField]
      }
    });
  };

  // 更新字段
  const updateField = (fieldId: string, updates: Partial<AssetField>) => {
    const updatedFields = (schema.fields || []).map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    onChange({
      schema: {
        ...schema,
        fields: updatedFields
      }
    });
  };

  // 删除字段
  const removeField = (fieldId: string) => {
    const updatedFields = (schema.fields || []).filter(field => field.id !== fieldId);

    onChange({
      schema: {
        ...schema,
        fields: updatedFields
      }
    });
  };

  // 复制字段
  const duplicateField = (field: AssetField) => {
    const newField: AssetField = {
      ...field,
      id: Date.now().toString(),
      name: `${field.name}_copy`,
      primaryKey: false // 复制的字段不能是主键
    };

    onChange({
      schema: {
        ...schema,
        fields: [...(schema.fields || []), newField]
      }
    });
  };

  // 添加示例字段
  const addSampleFields = () => {
    onChange({
      schema: {
        ...schema,
        fields: [...(schema.fields || []), ...SAMPLE_FIELDS]
      }
    });
  };

  // 清空所有字段
  const clearAllFields = () => {
    if (window.confirm('确定要清空所有字段吗？此操作不可恢复。')) {
      onChange({
        schema: {
          ...schema,
          fields: []
        }
      });
    }
  };

  // 如果不是表类型，显示简化界面
  if (assetType && assetType !== AssetType.TABLE && assetType !== AssetType.VIEW) {
    return (
      <div className="space-y-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6 text-center">
            <Info className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              {assetType === AssetType.API ? 'API 接口无需定义字段结构' :
               assetType === AssetType.FILE ? '文件资产结构将在元数据中定义' :
               assetType === AssetType.STREAM ? '数据流结构将在元数据中定义' :
               '此类型资产无需定义字段结构'}
            </h3>
            <p className="text-blue-700">
              {assetType === AssetType.API ? '请在下一步的元数据配置中定义 API 接口规范' :
               assetType === AssetType.FILE ? '请在下一步配置文件格式和字段信息' :
               '请继续下一步完成资产配置'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 表基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            表结构定义
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">
                表名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tableName"
                value={schema.tableName}
                onChange={(e) => updateTableName(e.target.value)}
                placeholder="请输入表名（如：user_profile）"
                className={errors.tableName ? 'border-red-500' : ''}
              />
              {errors.tableName && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.tableName[0]}
                </p>
              )}
              <p className="text-xs text-gray-500">
                建议使用小写字母和下划线，如：order_detail
              </p>
            </div>

            <div className="space-y-2">
              <Label>字段统计</Label>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>总计：{schema.fields?.length || 0} 个字段</span>
                <span>主键：{schema.fields?.filter(f => f.primaryKey).length || 0} 个</span>
                <span>必填：{schema.fields?.filter(f => !f.nullable).length || 0} 个</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 字段管理工具栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button onClick={addField} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                添加字段
              </Button>
              <Button onClick={addSampleFields} variant="outline" size="sm">
                <Database className="w-4 h-4 mr-1" />
                添加示例字段
              </Button>
              <Button
                onClick={() => setImportModalOpen(true)}
                variant="outline"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-1" />
                导入字段
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={clearAllFields}
                variant="outline"
                size="sm"
                disabled={!schema.fields?.length}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                清空全部
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                导出结构
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 字段列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>字段定义</span>
            {schema.fields && schema.fields.length > 0 && (
              <Badge variant="secondary">
                {schema.fields.length} 个字段
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schema.fields && schema.fields.length > 0 ? (
            <div className="space-y-4">
              {schema.fields.map((field, index) => (
                <Card key={field.id} className="relative">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* 字段名 */}
                      <div className="md:col-span-3">
                        <Label className="text-xs text-gray-500">
                          字段名 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={field.name}
                          onChange={(e) => updateField(field.id!, { name: e.target.value })}
                          placeholder="字段名"
                          className="mt-1"
                        />
                      </div>

                      {/* 数据类型 */}
                      <div className="md:col-span-2">
                        <Label className="text-xs text-gray-500">数据类型</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(field.id!, { type: value as FieldDataType })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div>
                                  <div className="font-medium">{type.label}</div>
                                  <div className="text-xs text-gray-500">{type.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 字段描述 */}
                      <div className="md:col-span-4">
                        <Label className="text-xs text-gray-500">描述</Label>
                        <Input
                          value={field.description || ''}
                          onChange={(e) => updateField(field.id!, { description: e.target.value })}
                          placeholder="字段描述"
                          className="mt-1"
                        />
                      </div>

                      {/* 属性选项 */}
                      <div className="md:col-span-2">
                        <Label className="text-xs text-gray-500">属性</Label>
                        <div className="mt-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`primary-${field.id}`}
                              checked={field.primaryKey}
                              onCheckedChange={(checked) =>
                                updateField(field.id!, { primaryKey: !!checked })
                              }
                            />
                            <Label htmlFor={`primary-${field.id}`} className="text-xs">
                              <Key className="w-3 h-3 inline mr-1" />
                              主键
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`nullable-${field.id}`}
                              checked={field.nullable}
                              onCheckedChange={(checked) =>
                                updateField(field.id!, { nullable: !!checked })
                              }
                            />
                            <Label htmlFor={`nullable-${field.id}`} className="text-xs">
                              可空
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="md:col-span-1">
                        <Label className="text-xs text-gray-500">操作</Label>
                        <div className="mt-1 flex flex-col space-y-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateField(field)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeField(field.id!)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 字段索引标识 */}
                    <div className="absolute top-2 left-2">
                      <Badge variant="outline" className="text-xs">
                        {index + 1}
                      </Badge>
                    </div>

                    {/* 主键标识 */}
                    {field.primaryKey && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="default" className="text-xs">
                          <Key className="w-3 h-3 mr-1" />
                          PK
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">暂无字段定义</h4>
              <p className="text-gray-600 mb-4">
                点击"添加字段"开始定义表结构，或使用"添加示例字段"快速开始
              </p>
              <div className="flex justify-center space-x-2">
                <Button onClick={addField}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加字段
                </Button>
                <Button onClick={addSampleFields} variant="outline">
                  <Database className="w-4 h-4 mr-2" />
                  添加示例字段
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 验证提示 */}
      {errors.fields && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.fields[0]}
          </AlertDescription>
        </Alert>
      )}

      {/* 设计建议 */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-sm text-yellow-800 flex items-center">
            <Info className="w-4 h-4 mr-2" />
            设计建议
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-yellow-700 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>建议为每个表设置主键字段，通常是 id 字段</li>
            <li>时间相关字段推荐添加 created_at 和 updated_at</li>
            <li>字段名使用小写字母和下划线，如：user_name</li>
            <li>为重要字段添加详细的描述信息</li>
            <li>考虑字段的可空性，必填字段不应允许为空</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}