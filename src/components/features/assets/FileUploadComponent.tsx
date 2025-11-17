'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  File,
  X,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  Trash2,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  Archive,
  MoreHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 文件类型定义
interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
  url?: string
  status: 'uploading' | 'completed' | 'error'
  progress?: number
  errorMessage?: string
}

interface FileUploadComponentProps {
  assetId: string
  existingFiles?: UploadedFile[]
  onFileUpload?: (files: UploadedFile[]) => Promise<void>
  onFileDelete?: (fileId: string) => Promise<void>
  onFileView?: (file: UploadedFile) => void
  onFileDownload?: (file: UploadedFile) => void
  maxFileSize?: number // bytes
  maxFiles?: number
  allowedTypes?: string[]
  disabled?: boolean
  className?: string
}

// 允许的文件类型映射
const ALLOWED_FILE_TYPES = {
  'application/pdf': { label: 'PDF文档', icon: FileText, color: 'text-red-600' },
  'application/msword': { label: 'Word文档', icon: FileText, color: 'text-blue-600' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'Word文档', icon: FileText, color: 'text-blue-600' },
  'application/vnd.ms-excel': { label: 'Excel表格', icon: File, color: 'text-green-600' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'Excel表格', icon: File, color: 'text-green-600' },
  'application/vnd.ms-powerpoint': { label: 'PowerPoint演示', icon: File, color: 'text-orange-600' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PowerPoint演示', icon: File, color: 'text-orange-600' },
  'text/plain': { label: '文本文件', icon: FileText, color: 'text-gray-600' },
  'text/csv': { label: 'CSV文件', icon: File, color: 'text-green-600' },
  'application/json': { label: 'JSON文件', icon: File, color: 'text-yellow-600' },
  'image/jpeg': { label: 'JPEG图片', icon: FileImage, color: 'text-purple-600' },
  'image/png': { label: 'PNG图片', icon: FileImage, color: 'text-purple-600' },
  'image/gif': { label: 'GIF图片', icon: FileImage, color: 'text-purple-600' },
  'application/zip': { label: 'ZIP压缩包', icon: Archive, color: 'text-gray-600' },
  'application/x-rar-compressed': { label: 'RAR压缩包', icon: Archive, color: 'text-gray-600' }
}

const DEFAULT_ALLOWED_TYPES = Object.keys(ALLOWED_FILE_TYPES)
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_MAX_FILES = 10

export function FileUploadComponent({
  assetId,
  existingFiles = [],
  onFileUpload,
  onFileDelete,
  onFileView,
  onFileDownload,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  className
}: FileUploadComponentProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 格式化文件大小
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // 获取文件类型信息
  const getFileTypeInfo = useCallback((type: string) => {
    return ALLOWED_FILE_TYPES[type] || {
      label: '其他文件',
      icon: File,
      color: 'text-gray-600'
    }
  }, [])

  // 验证文件
  const validateFile = useCallback((file: File) => {
    const errors: string[] = []

    // 文件大小检查
    if (file.size > maxFileSize) {
      errors.push(`文件 "${file.name}" 大小超出限制 (${formatFileSize(maxFileSize)})`)
    }

    // 文件类型检查
    if (!allowedTypes.includes(file.type)) {
      errors.push(`文件 "${file.name}" 类型不支持`)
    }

    // 文件名长度检查
    if (file.name.length > 255) {
      errors.push(`文件 "${file.name}" 名称过长`)
    }

    return errors
  }, [maxFileSize, allowedTypes, formatFileSize])

  // 处理文件选择
  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const fileArray = Array.from(selectedFiles)
    const validationErrors: string[] = []

    // 检查文件数量限制
    if (files.length + fileArray.length > maxFiles) {
      validationErrors.push(`最多只能上传 ${maxFiles} 个文件`)
    }

    // 验证每个文件
    const validFiles: File[] = []
    fileArray.forEach(file => {
      const fileErrors = validateFile(file)
      if (fileErrors.length > 0) {
        validationErrors.push(...fileErrors)
      } else {
        validFiles.push(file)
      }
    })

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setUploading(true)

    try {
      // 创建上传文件对象
      const uploadFiles: UploadedFile[] = validFiles.map(file => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        status: 'uploading' as const,
        progress: 0
      }))

      // 添加到文件列表（显示上传进度）
      setFiles(prev => [...prev, ...uploadFiles])

      // 模拟文件上传进度（实际项目中应该是真实的上传逻辑）
      for (const uploadFile of uploadFiles) {
        // 模拟上传进度
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 100))
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, progress }
              : f
          ))
        }

        // 标记为完成
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: 'completed', progress: 100, url: `/api/files/${uploadFile.id}` }
            : f
        ))
      }

      // 调用上传回调
      if (onFileUpload) {
        await onFileUpload(uploadFiles)
      }

    } catch (error) {
      console.error('文件上传失败:', error)
      setErrors(['文件上传失败，请重试'])

      // 标记上传失败的文件
      setFiles(prev => prev.map(f =>
        f.status === 'uploading'
          ? { ...f, status: 'error', errorMessage: '上传失败' }
          : f
      ))
    } finally {
      setUploading(false)
    }
  }, [files.length, maxFiles, validateFile, onFileUpload])

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [disabled, handleFileSelect])

  // 文件操作
  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      if (onFileDelete) {
        await onFileDelete(fileId)
      }
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('删除文件失败:', error)
      setErrors(['删除文件失败，请重试'])
    }
  }, [onFileDelete])

  const handleViewFile = useCallback((file: UploadedFile) => {
    if (onFileView) {
      onFileView(file)
    }
  }, [onFileView])

  const handleDownloadFile = useCallback((file: UploadedFile) => {
    if (onFileDownload) {
      onFileDownload(file)
    }
  }, [onFileDownload])

  // 清除错误
  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            文档管理
          </div>
          <Badge variant="secondary" className="text-xs">
            {files.length}/{maxFiles}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 错误提示 */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-medium text-red-800">上传失败：</p>
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearErrors}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 上传区域 */}
        {!disabled && files.length < maxFiles && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              uploading && "opacity-50 pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.join(',')}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />

            <div className="space-y-4">
              <div className="flex justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  拖拽文件到此处或{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:text-primary/80 underline"
                  >
                    选择文件
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 PDF、Word、Excel、PowerPoint 等格式，单个文件最大 {formatFileSize(maxFileSize)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">已上传文件</h4>
            <div className="space-y-2">
              {files.map((file) => {
                const typeInfo = getFileTypeInfo(file.type)
                const IconComponent = typeInfo.icon

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("flex-shrink-0", typeInfo.color)}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        {file.status === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • {typeInfo.label}
                        </span>
                        {file.uploadedAt && (
                          <span className="text-xs text-muted-foreground">
                            • {file.uploadedAt.toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress || 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            上传中... {file.progress || 0}%
                          </p>
                        </div>
                      )}

                      {file.status === 'error' && file.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{file.errorMessage}</p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {file.status === 'completed' && (
                      <div className="flex items-center gap-1">
                        {onFileView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewFile(file)}
                            title="预览文件"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}

                        {onFileDownload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile(file)}
                            title="下载文件"
                            className="h-8 w-8 p-0"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}

                        {!disabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file.id)}
                            title="删除文件"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 支持的文件格式：PDF、Word、Excel、PowerPoint、文本文件、图片等</p>
          <p>• 单个文件最大：{formatFileSize(maxFileSize)}</p>
          <p>• 最多可上传：{maxFiles} 个文件</p>
          <p>• 上传的文件将进行安全扫描和权限控制</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default FileUploadComponent