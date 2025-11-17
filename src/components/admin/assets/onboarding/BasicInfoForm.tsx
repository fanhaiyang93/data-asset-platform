'use client';

import React from 'react';
import { AssetFormData, AssetType } from '@/types/assetOnboarding';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Tag, Shield, Info, Type, FileText } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface BasicInfoFormProps {
  data: Partial<AssetFormData>;
  errors: Record<string, string[]>;
  onChange: (updates: Partial<AssetFormData>) => void;
}

const ASSET_CATEGORIES = [
  { id: 'user_data', name: '用户数据', description: '用户相关的业务数据' },
  { id: 'business_data', name: '业务数据', description: '核心业务流程数据' },
  { id: 'system_data', name: '系统数据', description: '系统运行和监控数据' },
  { id: 'external_data', name: '外部数据', description: '第三方或外部接口数据' },
  { id: 'analytics_data', name: '分析数据', description: '数据分析和报表数据' },
  { id: 'archive_data', name: '归档数据', description: '历史归档数据' }
];

const MOCK_USERS = [
  { id: 'user_001', name: '张三', role: '数据工程师', department: '数据平台部' },
  { id: 'user_002', name: '李四', role: '产品经理', department: '产品部' },
  { id: 'user_003', name: '王五', role: '系统架构师', department: '技术部' },
  { id: 'user_004', name: '赵六', role: '业务分析师', department: '业务部' },
  { id: 'user_005', name: '钱七', role: '数据科学家', department: '算法部' }
];

const ACCESS_LEVELS = [
  {
    value: 'public',
    label: '公开',
    description: '所有用户都可以访问',
    color: 'bg-green-100 text-green-800',
    icon: '🔓'
  },
  {
    value: 'internal',
    label: '内部',
    description: '仅内部员工可以访问',
    color: 'bg-blue-100 text-blue-800',
    icon: '🏢'
  },
  {
    value: 'confidential',
    label: '机密',
    description: '需要特殊权限才能访问',
    color: 'bg-orange-100 text-orange-800',
    icon: '⚠️'
  },
  {
    value: 'restricted',
    label: '限制',
    description: '仅指定人员可以访问',
    color: 'bg-red-100 text-red-800',
    icon: '🔒'
  }
];

export default function BasicInfoForm({ data, errors, onChange }: BasicInfoFormProps) {
  const [useRichTextEditor, setUseRichTextEditor] = React.useState(false);

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString
      .split(/[,，、\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onChange({
      metadata: {
        ...data.metadata,
        tags
      }
    });
  };

  const getTagsString = () => {
    return data.metadata?.tags?.join(', ') || '';
  };

  return (
    <div className="space-y-6">
      {/* 基本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Info className="w-5 h-5 mr-2" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 资产名称和显示名称 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                资产名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={data.name || ''}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="请输入资产名称（英文、数字、下划线）"
                className={errors.name ? 'border-red-500 focus:border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.name[0]}
                </p>
              )}
              <p className="text-xs text-gray-500">
                建议使用英文命名，如：user_profile_table
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium">
                显示名称
              </Label>
              <Input
                id="displayName"
                value={data.displayName || ''}
                onChange={(e) => onChange({ displayName: e.target.value })}
                placeholder="资产的友好显示名称（中文）"
              />
              <p className="text-xs text-gray-500">
                用于展示的中文名称，如：用户档案表
              </p>
            </div>
          </div>

          {/* 资产描述 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="text-sm font-medium">
                资产描述 <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant={useRichTextEditor ? "outline" : "default"}
                  size="sm"
                  onClick={() => setUseRichTextEditor(false)}
                  className="text-xs"
                >
                  <Type className="w-3 h-3 mr-1" />
                  纯文本
                </Button>
                <Button
                  type="button"
                  variant={useRichTextEditor ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseRichTextEditor(true)}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  富文本
                </Button>
              </div>
            </div>

            {useRichTextEditor ? (
              <RichTextEditor
                content={data.description || ''}
                onChange={(content) => onChange({ description: content })}
                placeholder="请详细描述该资产的用途、包含的数据内容、业务意义等信息..."
                maxLength={2000}
                showWordCount={true}
              />
            ) : (
              <>
                <Textarea
                  id="description"
                  value={data.description || ''}
                  onChange={(e) => onChange({ description: e.target.value })}
                  placeholder="请详细描述该资产的用途、包含的数据内容、业务意义等信息..."
                  rows={6}
                  className={errors.description ? 'border-red-500 focus:border-red-500' : ''}
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    建议包含：数据来源、业务场景、字段概述等信息
                  </p>
                  <span className="text-xs text-gray-400">
                    {data.description?.length || 0} / 2000
                  </span>
                </div>
              </>
            )}

            {errors.description && (
              <p className="text-sm text-red-600 flex items-center">
                <span className="mr-1">⚠️</span>
                {errors.description[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 分类和负责人卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <User className="w-5 h-5 mr-2" />
            分类与负责人
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 资产分类 */}
            <div className="space-y-2">
              <Label htmlFor="categoryId" className="text-sm font-medium">
                资产分类 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={data.categoryId || ''}
                onValueChange={(value) => onChange({ categoryId: value })}
              >
                <SelectTrigger className={errors.categoryId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="请选择资产分类" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex flex-col">
                        <span>{category.name}</span>
                        <span className="text-xs text-gray-500">{category.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-red-600 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.categoryId[0]}
                </p>
              )}
            </div>

            {/* 资产负责人 */}
            <div className="space-y-2">
              <Label htmlFor="ownerId" className="text-sm font-medium">
                资产负责人 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={data.ownerId || ''}
                onValueChange={(value) => onChange({ ownerId: value })}
              >
                <SelectTrigger className={errors.ownerId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="请选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_USERS.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span>{user.name} ({user.role})</span>
                        <span className="text-xs text-gray-500">{user.department}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ownerId && (
                <p className="text-sm text-red-600 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.ownerId[0]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 访问控制和标签卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Shield className="w-5 h-5 mr-2" />
            访问控制与标签
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 访问级别 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              访问级别 <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {ACCESS_LEVELS.map((level) => (
                <div
                  key={level.value}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    data.metadata?.sensitivityLevel === level.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => onChange({
                    metadata: {
                      ...data.metadata,
                      sensitivityLevel: level.value as any
                    }
                  })}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{level.icon}</span>
                    <span className="font-medium text-sm">{level.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{level.description}</p>
                </div>
              ))}
            </div>
            {errors.sensitivityLevel && (
              <p className="text-sm text-red-600 flex items-center">
                <span className="mr-1">⚠️</span>
                {errors.sensitivityLevel[0]}
              </p>
            )}
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-medium flex items-center">
              <Tag className="w-4 h-4 mr-1" />
              标签
            </Label>
            <Input
              id="tags"
              value={getTagsString()}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="输入标签，用逗号或空格分隔，如：用户数据, 核心业务, PII"
            />
            <p className="text-xs text-gray-500">
              标签有助于资产的搜索和分类，建议添加业务相关的关键词
            </p>

            {/* 显示已添加的标签 */}
            {data.metadata?.tags && data.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.metadata.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 预填充建议 */}
      {data.assetType && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-800">💡 填写建议</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700">
            <div className="space-y-2">
              {data.assetType === AssetType.TABLE && (
                <>
                  <p>• 表名建议使用小写英文，如：user_profile, order_detail</p>
                  <p>• 描述中包含主要字段说明和业务用途</p>
                  <p>• 根据数据敏感程度选择合适的访问级别</p>
                </>
              )}
              {data.assetType === AssetType.API && (
                <>
                  <p>• API名称建议使用RESTful风格，如：user-service-api</p>
                  <p>• 描述中包含接口功能、参数说明和返回格式</p>
                  <p>• 考虑API的安全等级设置访问权限</p>
                </>
              )}
              {data.assetType === AssetType.FILE && (
                <>
                  <p>• 文件名建议包含格式信息，如：sales_report.xlsx</p>
                  <p>• 描述中说明文件内容、更新频率和格式规范</p>
                  <p>• 根据文件内容敏感性设置访问级别</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}