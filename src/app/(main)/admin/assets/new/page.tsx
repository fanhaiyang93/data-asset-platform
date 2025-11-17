import { AssetOnboardingForm } from '@/components/admin/assets/onboarding/AssetOnboardingForm'

export default function NewAssetPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">新增数据资产</h1>
          <p className="text-gray-600 mt-1">
            添加新的数据资产到平台中，填写完整的资产信息和元数据
          </p>
        </div>
      </div>

      <AssetOnboardingForm />
    </div>
  )
}