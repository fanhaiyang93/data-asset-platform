'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import RichTextEditor from './RichTextEditor'
import { Edit3, Save, X, AlertCircle, CheckCircle } from 'lucide-react'
import { type AssetDetail } from '@/server/services/AssetService'

interface MetadataEditorProps {
  asset: AssetDetail
  isEditing: boolean
  onToggleEdit: () => void
  onSave: (metadata: {
    description?: string
    tags?: string
  }) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
}

export function MetadataEditor({
  asset,
  isEditing,
  onToggleEdit,
  onSave,
  onCancel,
  disabled = false
}: MetadataEditorProps) {
  const [description, setDescription] = useState(asset.description || '')
  const [tags, setTags] = useState(asset.tags || '')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // 重置表单数据
  const resetForm = useCallback(() => {
    setDescription(asset.description || '')
    setTags(asset.tags || '')
    setHasChanges(false)
    setValidationErrors([])
  }, [asset.description, asset.tags])

  // 检测变更
  const checkForChanges = useCallback(() => {
    const descriptionChanged = description !== (asset.description || '')
    const tagsChanged = tags !== (asset.tags || '')
    setHasChanges(descriptionChanged || tagsChanged)
  }, [description, tags, asset.description, asset.tags])

  React.useEffect(() => {
    checkForChanges()
  }, [checkForChanges])

  // 描述内容变更处理
  const handleDescriptionChange = useCallback((content: string) => {
    setDescription(content)
  }, [])

  // 标签输入处理
  const handleTagsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTags(event.target.value)
  }, [])

  // 验证表单数据
  const validateForm = useCallback(() => {
    const errors: string[] = []

    // 描述长度验证（已在RichTextEditor中处理，这里做额外检查）
    if (description && description.length > 100000) {
      errors.push('描述内容过长，请控制在100KB以内')
    }

    // 标签格式验证
    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean)
      if (tagList.length > 20) {
        errors.push('标签数量不能超过20个')
      }

      const invalidTags = tagList.filter(tag => tag.length > 50)
      if (invalidTags.length > 0) {
        errors.push('单个标签长度不能超过50个字符')
      }
    }

    setValidationErrors(errors)
    return errors.length === 0
  }, [description, tags])

  // 保存处理
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        description: description || undefined,
        tags: tags || undefined
      })

      // 保存成功后退出编辑模式
      onToggleEdit()
      setHasChanges(false)
    } catch (error) {
      console.error('保存失败:', error)
      setValidationErrors(['保存失败，请重试'])
    } finally {
      setIsSaving(false)
    }
  }, [description, tags, validateForm, onSave, onToggleEdit])

  // 取消编辑
  const handleCancel = useCallback(() => {
    resetForm()
    onCancel?.()
    onToggleEdit()
  }, [resetForm, onCancel, onToggleEdit])

  // 标签显示组件
  const TagDisplay = ({ tagString }: { tagString: string }) => {
    if (!tagString) return <span className="text-muted-foreground">暂无标签</span>

    return (
      <div className="flex flex-wrap gap-2">
        {tagString.split(',').map((tag, index) => (
          <Badge key={index} variant="secondary" className="text-xs">
            {tag.trim()}
          </Badge>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 操作按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">元数据管理</h3>

        {!isEditing ? (
          <Button
            onClick={onToggleEdit}
            disabled={disabled}
            className="flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            编辑元数据
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </div>

      {/* 验证错误显示 */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-red-800">请修正以下问题：</p>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 变更提示 */}
      {isEditing && hasChanges && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-800">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">您有未保存的更改</span>
          </div>
        </div>
      )}

      {/* 描述编辑区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">资产描述</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <RichTextEditor
              content={description}
              placeholder="请输入资产的详细描述，支持富文本格式..."
              onContentChange={handleDescriptionChange}
              autoSave={false}
              maxLength={100000}
              className="w-full"
            />
          ) : (
            <div className="min-h-[100px] p-4 bg-muted/50 rounded-lg">
              {asset.description ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: asset.description }}
                />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span>暂无描述信息</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 标签编辑区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">标签管理</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={tags}
                onChange={handleTagsChange}
                placeholder="输入标签，多个标签用逗号分隔，如：数据分析,用户行为,实时数据"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">
                提示：用逗号分隔多个标签，每个标签不超过50个字符，最多20个标签
              </p>
              {/* 标签预览 */}
              {tags && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">标签预览：</p>
                  <TagDisplay tagString={tags} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <TagDisplay tagString={asset.tags || ''} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 保存状态指示器 */}
      {!isEditing && hasChanges && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">更改已保存</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MetadataEditor