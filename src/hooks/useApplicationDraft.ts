import { useState, useEffect, useRef } from 'react'
import { api } from '@/trpc/react'
import { ApplicationFormData, ApplicationDraftData } from '@/lib/schemas/application'
import { toast } from 'sonner'

interface UseApplicationDraftOptions {
  assetId: string
  initialData?: Partial<ApplicationFormData>
  autoSaveInterval?: number // 自动保存间隔，毫秒
}

export function useApplicationDraft({
  assetId,
  initialData,
  autoSaveInterval = 2000, // 默认2秒自动保存
}: UseApplicationDraftOptions) {
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isDraftSaving, setIsDraftSaving] = useState(false)
  const [lastDraftData, setLastDraftData] = useState<Partial<ApplicationFormData> | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // tRPC mutations
  const saveDraftMutation = api.applications.saveDraft.useMutation({
    onSuccess: (data) => {
      setDraftId(data.id)
      setIsDraftSaving(false)
      // 显示保存成功提示（较为轻量）
      toast.success('草稿已自动保存', {
        duration: 1000,
        position: 'top-right',
      })
    },
    onError: (error) => {
      setIsDraftSaving(false)
      console.error('草稿保存失败:', error)
      toast.error('草稿保存失败，请检查网络连接')
    },
  })

  const deleteDraftMutation = api.applications.deleteDraft.useMutation({
    onSuccess: () => {
      setDraftId(null)
      setLastDraftData(null)
      toast.success('草稿已删除')
    },
    onError: (error) => {
      console.error('草稿删除失败:', error)
      toast.error('草稿删除失败')
    },
  })

  // 保存草稿函数
  const saveDraft = async (data: Partial<ApplicationFormData>) => {
    // 如果数据没有变化，不进行保存
    if (lastDraftData && JSON.stringify(data) === JSON.stringify(lastDraftData)) {
      return
    }

    setIsDraftSaving(true)
    setLastDraftData(data)

    try {
      const draftData: ApplicationDraftData = {
        assetId,
        ...data,
      }

      await saveDraftMutation.mutateAsync({
        id: draftId || undefined,
        ...draftData,
      })
    } catch (error) {
      console.error('保存草稿失败:', error)
    }
  }

  // 自动保存函数
  const autoSaveDraft = (data: Partial<ApplicationFormData>) => {
    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // 设置新的自动保存定时器
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft(data)
    }, autoSaveInterval)
  }

  // 手动保存草稿
  const saveNow = (data: Partial<ApplicationFormData>) => {
    // 清除自动保存定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    saveDraft(data)
  }

  // 删除草稿
  const deleteDraft = () => {
    if (draftId) {
      deleteDraftMutation.mutate({ id: draftId })
    }
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // 初始化草稿ID（如果initialData包含ID）
  useEffect(() => {
    if (initialData && 'id' in initialData && initialData.id) {
      setDraftId(initialData.id as string)
    }
  }, [initialData])

  return {
    // 状态
    draftId,
    isDraftSaving,

    // 函数
    autoSaveDraft,
    saveNow,
    deleteDraft,

    // 是否有草稿
    hasDraft: !!draftId,

    // 加载状态
    isDeleting: deleteDraftMutation.isLoading,
  }
}