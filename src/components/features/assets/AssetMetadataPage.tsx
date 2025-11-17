'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Database,
  Edit,
  Save,
  History,
  FileTemplate,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Tag as TagIcon
} from 'lucide-react'

// 导入我们的安全组件
import { SecureComponentWrapper, useSecurityContext } from '@/components/common/SecureComponentWrapper'
import { InlinePermissionCheck, ConditionalPermissionMessage } from '@/components/common/PermissionGuard'
import RichTextEditor from './RichTextEditor'
import FileUploadComponent from './FileUploadComponent'
import TagEditor from './TagEditor'
import MetadataQualityChecker from './MetadataQualityChecker'
import VersionHistoryViewer from './VersionHistoryViewer'
import MetadataTemplateSelector from './MetadataTemplateSelector'

interface AssetMetadata {
  id: string
  name: string
  description: string
  tags: string
  owner: string
  ownerId: string
  lastUpdated: Date
  documentation: string[]
  createdAt: Date
  updatedAt: Date
  version: string
}

interface AssetMetadataPageProps {
  assetId: string
  initialMetadata?: AssetMetadata
  onMetadataUpdate?: (metadata: AssetMetadata) => Promise<void>
  onMetadataSave?: (metadata: AssetMetadata) => Promise<void>
}

export function AssetMetadataPage({
  assetId,
  initialMetadata,
  onMetadataUpdate,
  onMetadataSave
}: AssetMetadataPageProps) {
  // 使用安全上下文获取用户信息
  const { user, loading: userLoading, error: userError } = useSecurityContext()

  // 组件状态
  const [metadata, setMetadata] = useState<AssetMetadata>(
    initialMetadata || {
      id: assetId,
      name: '',
      description: '',
      tags: '',
      owner: '',
      ownerId: '',
      lastUpdated: new Date(),
      documentation: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    }
  )

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<'metadata' | 'quality' | 'history' | 'templates'>('metadata')

  // 监听用户错误
  useEffect(() => {
    if (userError) {
      console.error('用户认证错误:', userError)
    }
  }, [userError])

  // 处理元数据更新
  const handleMetadataChange = (field: keyof AssetMetadata, value: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date()
    }))
    setHasUnsavedChanges(true)
  }

  // 保存元数据
  const handleSave = async () => {
    if (!onMetadataSave) return

    setIsSaving(true)
    try {
      await onMetadataSave(metadata)
      setHasUnsavedChanges(false)
      setIsEditing(false)
    } catch (error) {
      console.error('保存失败:', error)
      // 这里的错误会被ErrorBoundary捕获
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  // 取消编辑
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm('有未保存的更改，确定要放弃吗？')) {
        setIsEditing(false)
        setHasUnsavedChanges(false)
        // 重置到初始状态
        if (initialMetadata) {
          setMetadata(initialMetadata)
        }
      }
    } else {
      setIsEditing(false)
    }
  }

  // 渲染标签页导航
  const renderTabNavigation = () => (
    <div className="flex space-x-1 border-b">
      {[
        { id: 'metadata', label: '基础信息', icon: Database },
        { id: 'quality', label: '质量检查', icon: CheckCircle },
        { id: 'history', label: '版本历史', icon: History },
        { id: 'templates', label: '模板库', icon: FileTemplate }
      ].map((tab) => {
        const IconComponent = tab.icon
        const isActive = activeTab === tab.id

        return (
          <Button
            key={tab.id}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="text-xs"
          >
            <IconComponent className="w-3 h-3 mr-1" />
            {tab.label}
          </Button>
        )
      })}
    </div>
  )

  // 渲染基础信息标签页
  const renderMetadataTab = () => (
    <div className="space-y-6">
      {/* 资产名称 */}
      <SecureComponentWrapper
        user={user}
        resource="asset"
        action="edit"
        assetOwnerId={metadata.ownerId}
        loading={userLoading}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">资产名称</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <input
                type="text"
                value={metadata.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
                placeholder="请输入资产名称"
                className="w-full p-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm">{metadata.name || '未设置'}</p>
            )}
          </CardContent>
        </Card>
      </SecureComponentWrapper>

      {/* 详细描述 */}
      <SecureComponentWrapper
        user={user}
        resource="asset"
        action="edit"
        assetOwnerId={metadata.ownerId}
        loading={userLoading}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">详细描述</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              content={metadata.description}
              onContentChange={(content) => handleMetadataChange('description', content)}
              readOnly={!isEditing}
              placeholder="请输入资产的详细描述..."
            />
          </CardContent>
        </Card>
      </SecureComponentWrapper>

      {/* 标签管理 */}
      <SecureComponentWrapper
        user={user}
        resource="asset"
        action="manage_tags"
        assetOwnerId={metadata.ownerId}
        loading={userLoading}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">标签分类</CardTitle>
          </CardHeader>
          <CardContent>
            <TagEditor
              value={metadata.tags}
              onChange={(tags) => handleMetadataChange('tags', tags)}
              readOnly={!isEditing}
              placeholder="添加相关标签..."
            />
          </CardContent>
        </Card>
      </SecureComponentWrapper>

      {/* 文档上传 */}
      <SecureComponentWrapper
        user={user}
        resource="asset"
        action="upload_files"
        assetOwnerId={metadata.ownerId}
        loading={userLoading}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">相关文档</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <FileUploadComponent
                accept=".pdf,.doc,.docx,.xlsx,.xls"
                maxSize={10 * 1024 * 1024} // 10MB
                onFilesChange={(files) => {
                  const fileNames = files.map(file => file.name)
                  handleMetadataChange('documentation', fileNames)
                }}
              />
            ) : (
              <div className="space-y-2">
                {metadata.documentation.length > 0 ? (
                  metadata.documentation.map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <FileTemplate className="w-4 h-4" />
                      <span>{doc}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">暂无相关文档</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </SecureComponentWrapper>
    </div>
  )

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">加载用户信息中...</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>资产元数据管理</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>资产ID: {assetId}</span>
                  <Badge variant="outline" className="text-xs">
                    版本 {metadata.version}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 权限状态指示 */}
              <InlinePermissionCheck
                user={user}
                resource="asset"
                action="edit"
                assetOwnerId={metadata.ownerId}
              >
                <Badge variant="secondary" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  可编辑
                </Badge>
              </InlinePermissionCheck>

              {/* 编辑控制按钮 */}
              <InlinePermissionCheck
                user={user}
                resource="asset"
                action="edit"
                assetOwnerId={metadata.ownerId}
              >
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving || !hasUnsavedChanges}
                      className="text-xs"
                    >
                      {isSaving ? (
                        <>保存中...</>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" />
                          保存
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="text-xs"
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-xs"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    编辑
                  </Button>
                )}
              </InlinePermissionCheck>
            </div>
          </div>

          {/* 权限警告消息 */}
          <ConditionalPermissionMessage
            user={user}
            resource="asset"
            action="edit"
            assetOwnerId={metadata.ownerId}
            showWhenDenied={true}
            deniedMessage="您只能查看此资产，如需编辑请联系资产所有者或管理员"
            className="mt-2"
          />

          {/* 未保存更改警告 */}
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span>有未保存的更改</span>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 标签页导航 */}
      <Card>
        <CardContent className="p-0">
          {renderTabNavigation()}
        </CardContent>
      </Card>

      {/* 标签页内容 */}
      <div className="min-h-[400px]">
        {activeTab === 'metadata' && renderMetadataTab()}

        {activeTab === 'quality' && (
          <SecureComponentWrapper
            user={user}
            resource="asset"
            action="view"
            assetOwnerId={metadata.ownerId}
            loading={userLoading}
          >
            <MetadataQualityChecker
              metadata={metadata}
              onImprove={(suggestions) => {
                console.log('质量改进建议:', suggestions)
                // 这里可以实现自动应用建议的逻辑
              }}
            />
          </SecureComponentWrapper>
        )}

        {activeTab === 'history' && (
          <SecureComponentWrapper
            user={user}
            resource="asset"
            action="view_history"
            assetOwnerId={metadata.ownerId}
            loading={userLoading}
          >
            <VersionHistoryViewer
              assetId={assetId}
              versions={[]} // 这里应该从API获取版本历史
              onVersionRestore={async (versionId) => {
                console.log('恢复到版本:', versionId)
                // 实现版本恢复逻辑
              }}
              onVersionPreview={(versionId) => {
                console.log('预览版本:', versionId)
                // 实现版本预览逻辑
              }}
            />
          </SecureComponentWrapper>
        )}

        {activeTab === 'templates' && (
          <SecureComponentWrapper
            user={user}
            resource="asset"
            action="view"
            loading={userLoading}
          >
            <MetadataTemplateSelector
              onTemplateSelect={(template) => {
                console.log('选择模板:', template)
              }}
              onTemplateApply={(template) => {
                // 应用模板到当前元数据
                if (confirm(`确定要应用模板"${template.name}"吗？这将覆盖当前的部分字段。`)) {
                  // 实现模板应用逻辑
                  console.log('应用模板:', template)
                }
              }}
            />
          </SecureComponentWrapper>
        )}
      </div>

      {/* 页面底部信息 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>负责人: {metadata.owner || '未设置'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>最后更新: {metadata.lastUpdated.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TagIcon className="w-3 h-3" />
              <span>标签: {metadata.tags ? metadata.tags.split(',').length : 0} 个</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AssetMetadataPage