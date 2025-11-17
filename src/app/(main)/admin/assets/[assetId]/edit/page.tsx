/**
 * 资产编辑页面
 * Story 5.3: 资产编辑与维护
 *
 * 路由: /admin/assets/[assetId]/edit
 */

'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import AssetEditForm from '@/components/admin/assets/editing/AssetEditForm'
import { AssetFormData } from '@/types/assetOnboarding'
import { trpc } from '@/lib/trpc-client'
import { App } from 'antd'

interface AssetEditPageProps {
  params: Promise<{
    assetId: string
  }>
}

export default function AssetEditPage({ params }: AssetEditPageProps) {
  const router = useRouter()
  const { assetId } = use(params)
  const { message } = App.useApp()

  // 使用 tRPC mutation 更新资产
  const updateAsset = trpc.assets.updateAsset.useMutation({
    onSuccess: () => {
      message.success('资产更新成功!')
      router.push(`/admin/assets`)
    },
    onError: (error) => {
      message.error(`保存失败: ${error.message}`)
    }
  })

  const handleSave = async (data: AssetFormData) => {
    try {
      // 将 AssetFormData 转换为 UpdateAssetInput 格式
      const updateInput = {
        name: data.name,
        description: data.description,
        code: data.code,
        categoryId: data.categoryId,
        status: data.status,
        type: data.assetType || 'table',
        databaseName: data.schema?.databaseName || data.metadata?.dataSource,
        tableName: data.schema?.tableName,
        tags: data.metadata?.tags?.join(',')
      }

      await updateAsset.mutateAsync({
        id: assetId,
        data: updateInput
      })
    } catch (error) {
      console.error('Error saving asset:', error)
      // 错误已在 onError 回调中处理
    }
  }

  const handleCancel = () => {
    if (confirm('确定要取消编辑吗?未保存的更改将丢失。')) {
      router.push(`/admin/assets`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <AssetEditForm
          assetId={assetId}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
