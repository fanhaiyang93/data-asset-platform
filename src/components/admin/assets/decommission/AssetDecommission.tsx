/**
 * 资产下架组件
 * Story 5.4: 资产下架管理
 *
 * 资产下架功能的入口组件
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Archive } from 'lucide-react'
import { DecommissionConfirmationDialog } from './DecommissionConfirmation'
import { ExtendedAssetStatus } from '@/types/assetLifecycle'

interface AssetDecommissionProps {
  assetId: string
  assetName: string
  currentStatus: ExtendedAssetStatus
  onDecommissionComplete?: () => void
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showIcon?: boolean
}

export function AssetDecommission({
  assetId,
  assetName,
  currentStatus,
  onDecommissionComplete,
  variant = 'destructive',
  size = 'default',
  showIcon = true
}: AssetDecommissionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleDecommissionClick = () => {
    setDialogOpen(true)
  }

  const handleDecommissionConfirm = () => {
    onDecommissionComplete?.()
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleDecommissionClick}
      >
        {showIcon && <Archive className="h-4 w-4 mr-2" />}
        下架资产
      </Button>

      <DecommissionConfirmationDialog
        assetId={assetId}
        assetName={assetName}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDecommissionConfirm={handleDecommissionConfirm}
      />
    </>
  )
}
