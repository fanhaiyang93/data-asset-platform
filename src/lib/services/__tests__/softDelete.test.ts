/**
 * 软删除服务测试
 * Story 5.4: 资产下架管理
 *
 * 测试软删除逻辑和状态过滤
 */

import { describe, it, expect } from '@jest/globals'
import { SoftDeleteService } from '../softDelete'
import { ExtendedAssetStatus } from '@/types/assetLifecycle'

describe('SoftDeleteService', () => {
  describe('getUserAssetFilter', () => {
    it('应该返回排除已下架和已归档资产的过滤器', () => {
      const filter = SoftDeleteService.getUserAssetFilter()

      expect(filter).toHaveProperty('status')
      expect(filter.status).toHaveProperty('notIn')
      expect(filter.status.notIn).toContain(ExtendedAssetStatus.DECOMMISSIONED)
      expect(filter.status.notIn).toContain(ExtendedAssetStatus.ARCHIVED)
    })
  })

  describe('getAdminAssetFilter', () => {
    it('仅活跃资产时应该返回 ACTIVE 过滤器', () => {
      const filter = SoftDeleteService.getAdminAssetFilter({
        includeDecommissioned: false,
        includeArchived: false,
        onlyActive: true
      })

      expect(filter.status).toBe(ExtendedAssetStatus.ACTIVE)
    })

    it('包含已下架资产时不应该排除 DECOMMISSIONED 状态', () => {
      const filter = SoftDeleteService.getAdminAssetFilter({
        includeDecommissioned: true,
        includeArchived: false,
        onlyActive: false
      })

      if (filter.status?.notIn) {
        expect(filter.status.notIn).not.toContain(ExtendedAssetStatus.DECOMMISSIONED)
        expect(filter.status.notIn).toContain(ExtendedAssetStatus.ARCHIVED)
      }
    })

    it('包含所有状态时应该返回空过滤器', () => {
      const filter = SoftDeleteService.getAdminAssetFilter({
        includeDecommissioned: true,
        includeArchived: true,
        onlyActive: false
      })

      expect(Object.keys(filter)).toHaveLength(0)
    })
  })

  describe('isDecommissioned', () => {
    it('应该正确识别已下架状态', () => {
      expect(SoftDeleteService.isDecommissioned(ExtendedAssetStatus.DECOMMISSIONED)).toBe(true)
      expect(SoftDeleteService.isDecommissioned(ExtendedAssetStatus.ARCHIVED)).toBe(true)
      expect(SoftDeleteService.isDecommissioned(ExtendedAssetStatus.ACTIVE)).toBe(false)
      expect(SoftDeleteService.isDecommissioned(ExtendedAssetStatus.MAINTENANCE)).toBe(false)
    })
  })

  describe('isVisibleToUser', () => {
    it('活跃状态资产对用户可见', () => {
      expect(SoftDeleteService.isVisibleToUser(ExtendedAssetStatus.ACTIVE)).toBe(true)
      expect(SoftDeleteService.isVisibleToUser(ExtendedAssetStatus.MAINTENANCE)).toBe(true)
      expect(SoftDeleteService.isVisibleToUser(ExtendedAssetStatus.INACTIVE)).toBe(true)
    })

    it('已下架资产对用户不可见', () => {
      expect(SoftDeleteService.isVisibleToUser(ExtendedAssetStatus.DECOMMISSIONED)).toBe(false)
      expect(SoftDeleteService.isVisibleToUser(ExtendedAssetStatus.ARCHIVED)).toBe(false)
    })
  })

  describe('canTransitionStatus', () => {
    it('活跃状态可以转换为下架状态', () => {
      const result = SoftDeleteService.canTransitionStatus(
        ExtendedAssetStatus.ACTIVE,
        ExtendedAssetStatus.DECOMMISSIONED
      )

      expect(result.allowed).toBe(true)
    })

    it('已下架状态可以恢复为活跃状态', () => {
      const result = SoftDeleteService.canTransitionStatus(
        ExtendedAssetStatus.DECOMMISSIONED,
        ExtendedAssetStatus.ACTIVE
      )

      expect(result.allowed).toBe(true)
    })

    it('已归档状态不能直接恢复为活跃状态', () => {
      const result = SoftDeleteService.canTransitionStatus(
        ExtendedAssetStatus.ARCHIVED,
        ExtendedAssetStatus.ACTIVE
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('已下架状态可以转换为已归档状态', () => {
      const result = SoftDeleteService.canTransitionStatus(
        ExtendedAssetStatus.DECOMMISSIONED,
        ExtendedAssetStatus.ARCHIVED
      )

      expect(result.allowed).toBe(true)
    })
  })

  describe('getAvailableTransitions', () => {
    it('活跃状态应该有多个可用转换', () => {
      const transitions = SoftDeleteService.getAvailableTransitions(
        ExtendedAssetStatus.ACTIVE
      )

      expect(transitions.length).toBeGreaterThan(0)
      expect(transitions).toContain(ExtendedAssetStatus.DECOMMISSIONED)
      expect(transitions).toContain(ExtendedAssetStatus.MAINTENANCE)
    })

    it('已下架状态应该可以恢复到多个活跃状态', () => {
      const transitions = SoftDeleteService.getAvailableTransitions(
        ExtendedAssetStatus.DECOMMISSIONED
      )

      expect(transitions).toContain(ExtendedAssetStatus.ACTIVE)
      expect(transitions).toContain(ExtendedAssetStatus.MAINTENANCE)
      expect(transitions).toContain(ExtendedAssetStatus.INACTIVE)
    })
  })

  describe('validateBatchDecommission', () => {
    it('应该正确分类有效和无效的资产', () => {
      const assets = [
        { assetId: '1', status: ExtendedAssetStatus.ACTIVE },
        { assetId: '2', status: ExtendedAssetStatus.MAINTENANCE },
        { assetId: '3', status: ExtendedAssetStatus.DECOMMISSIONED }
      ]

      const result = SoftDeleteService.validateBatchDecommission(assets)

      expect(result.valid).toHaveLength(2)
      expect(result.invalid).toHaveLength(1)
      expect(result.invalid[0].assetId).toBe('3')
    })

    it('所有活跃状态资产都应该有效', () => {
      const assets = [
        { assetId: '1', status: ExtendedAssetStatus.ACTIVE },
        { assetId: '2', status: ExtendedAssetStatus.MAINTENANCE },
        { assetId: '3', status: ExtendedAssetStatus.INACTIVE }
      ]

      const result = SoftDeleteService.validateBatchDecommission(assets)

      expect(result.valid).toHaveLength(3)
      expect(result.invalid).toHaveLength(0)
    })
  })

  describe('generateStatusStatistics', () => {
    it('应该正确统计各状态数量', () => {
      const statuses = [
        ExtendedAssetStatus.ACTIVE,
        ExtendedAssetStatus.ACTIVE,
        ExtendedAssetStatus.MAINTENANCE,
        ExtendedAssetStatus.DECOMMISSIONED
      ]

      const stats = SoftDeleteService.generateStatusStatistics(statuses)

      expect(stats[ExtendedAssetStatus.ACTIVE]).toBe(2)
      expect(stats[ExtendedAssetStatus.MAINTENANCE]).toBe(1)
      expect(stats[ExtendedAssetStatus.DECOMMISSIONED]).toBe(1)
      expect(stats[ExtendedAssetStatus.ARCHIVED]).toBe(0)
    })

    it('空数组应该返回全0统计', () => {
      const stats = SoftDeleteService.generateStatusStatistics([])

      Object.values(stats).forEach(count => {
        expect(count).toBe(0)
      })
    })
  })

  describe('canPhysicallyDelete', () => {
    it('非归档状态不能物理删除', () => {
      const result = SoftDeleteService.canPhysicallyDelete(
        ExtendedAssetStatus.DECOMMISSIONED,
        new Date(),
        90
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('已归档')
    })

    it('归档时间未设置不能物理删除', () => {
      const result = SoftDeleteService.canPhysicallyDelete(
        ExtendedAssetStatus.ARCHIVED,
        null,
        90
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('归档时间')
    })

    it('归档时间不足不能物理删除', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 30) // 30天前

      const result = SoftDeleteService.canPhysicallyDelete(
        ExtendedAssetStatus.ARCHIVED,
        recentDate,
        90
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('至少 90 天')
    })

    it('归档时间超过保留期可以物理删除', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 100) // 100天前

      const result = SoftDeleteService.canPhysicallyDelete(
        ExtendedAssetStatus.ARCHIVED,
        oldDate,
        90
      )

      expect(result.allowed).toBe(true)
    })
  })
})
