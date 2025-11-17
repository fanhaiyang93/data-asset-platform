/**
 * 状态映射器
 * 负责申请状态在本地系统和数据平台之间的双向映射
 */

import { ApplicationStatus } from '@/types/integration'

/**
 * 平台状态枚举
 */
export enum PlatformStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  ON_HOLD = 'on_hold'
}

/**
 * 状态映射配置
 */
export interface StatusMappingConfig {
  localStatus: ApplicationStatus
  platformStatus: PlatformStatus
  displayName: string
  description?: string
  color?: string
}

/**
 * 状态映射器类
 */
export class StatusMapper {
  private mappings: Map<ApplicationStatus, StatusMappingConfig>
  private reverseMappings: Map<PlatformStatus, ApplicationStatus>

  constructor() {
    this.mappings = new Map()
    this.reverseMappings = new Map()
    this.initializeDefaultMappings()
  }

  /**
   * 将本地状态映射为平台状态
   */
  mapToPlatform(localStatus: ApplicationStatus): PlatformStatus {
    const config = this.mappings.get(localStatus)

    if (!config) {
      console.warn(`未找到状态映射: ${localStatus}, 使用默认值`)
      return PlatformStatus.SUBMITTED
    }

    return config.platformStatus
  }

  /**
   * 将平台状态映射为本地状态
   */
  mapFromPlatform(platformStatus: PlatformStatus): ApplicationStatus {
    const localStatus = this.reverseMappings.get(platformStatus)

    if (!localStatus) {
      console.warn(`未找到平台状态映射: ${platformStatus}, 使用默认值`)
      return ApplicationStatus.PENDING
    }

    return localStatus
  }

  /**
   * 获取状态显示名称
   */
  getDisplayName(status: ApplicationStatus): string {
    const config = this.mappings.get(status)
    return config?.displayName || status
  }

  /**
   * 获取状态描述
   */
  getDescription(status: ApplicationStatus): string | undefined {
    const config = this.mappings.get(status)
    return config?.description
  }

  /**
   * 获取状态颜色
   */
  getColor(status: ApplicationStatus): string {
    const config = this.mappings.get(status)
    return config?.color || 'gray'
  }

  /**
   * 检查状态是否有效
   */
  isValidStatus(status: string): status is ApplicationStatus {
    return Object.values(ApplicationStatus).includes(status as ApplicationStatus)
  }

  /**
   * 检查平台状态是否有效
   */
  isValidPlatformStatus(status: string): status is PlatformStatus {
    return Object.values(PlatformStatus).includes(status as PlatformStatus)
  }

  /**
   * 批量映射状态
   */
  mapBatch(statuses: ApplicationStatus[]): PlatformStatus[] {
    return statuses.map(status => this.mapToPlatform(status))
  }

  /**
   * 批量反向映射状态
   */
  reverseBatch(statuses: PlatformStatus[]): ApplicationStatus[] {
    return statuses.map(status => this.mapFromPlatform(status))
  }

  /**
   * 初始化默认状态映射
   */
  private initializeDefaultMappings(): void {
    const defaultMappings: StatusMappingConfig[] = [
      {
        localStatus: ApplicationStatus.PENDING,
        platformStatus: PlatformStatus.SUBMITTED,
        displayName: '待处理',
        description: '申请已提交,等待审核',
        color: 'blue'
      },
      {
        localStatus: ApplicationStatus.IN_REVIEW,
        platformStatus: PlatformStatus.UNDER_REVIEW,
        displayName: '审核中',
        description: '申请正在审核中',
        color: 'yellow'
      },
      {
        localStatus: ApplicationStatus.APPROVED,
        platformStatus: PlatformStatus.APPROVED,
        displayName: '已批准',
        description: '申请已通过审核',
        color: 'green'
      },
      {
        localStatus: ApplicationStatus.REJECTED,
        platformStatus: PlatformStatus.REJECTED,
        displayName: '已拒绝',
        description: '申请未通过审核',
        color: 'red'
      },
      {
        localStatus: ApplicationStatus.CANCELLED,
        platformStatus: PlatformStatus.CANCELLED,
        displayName: '已取消',
        description: '申请已被用户取消',
        color: 'gray'
      },
      {
        localStatus: ApplicationStatus.EXPIRED,
        platformStatus: PlatformStatus.EXPIRED,
        displayName: '已过期',
        description: '申请已超过有效期',
        color: 'orange'
      }
    ]

    // 建立正向和反向映射
    for (const config of defaultMappings) {
      this.mappings.set(config.localStatus, config)
      this.reverseMappings.set(config.platformStatus, config.localStatus)
    }

    // 处理平台特有的状态
    this.reverseMappings.set(PlatformStatus.ON_HOLD, ApplicationStatus.IN_REVIEW)
  }

  /**
   * 添加自定义状态映射
   */
  addMapping(config: StatusMappingConfig): void {
    this.mappings.set(config.localStatus, config)
    this.reverseMappings.set(config.platformStatus, config.localStatus)
  }

  /**
   * 移除状态映射
   */
  removeMapping(localStatus: ApplicationStatus): void {
    const config = this.mappings.get(localStatus)
    if (config) {
      this.reverseMappings.delete(config.platformStatus)
      this.mappings.delete(localStatus)
    }
  }

  /**
   * 获取所有映射配置
   */
  getAllMappings(): StatusMappingConfig[] {
    return Array.from(this.mappings.values())
  }

  /**
   * 获取状态转换规则
   * 返回允许的状态转换路径
   */
  getTransitionRules(): Map<ApplicationStatus, ApplicationStatus[]> {
    return new Map([
      [ApplicationStatus.PENDING, [
        ApplicationStatus.IN_REVIEW,
        ApplicationStatus.CANCELLED
      ]],
      [ApplicationStatus.IN_REVIEW, [
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.CANCELLED
      ]],
      [ApplicationStatus.APPROVED, [
        ApplicationStatus.EXPIRED
      ]],
      [ApplicationStatus.REJECTED, []],
      [ApplicationStatus.CANCELLED, []],
      [ApplicationStatus.EXPIRED, []]
    ])
  }

  /**
   * 验证状态转换是否有效
   */
  isValidTransition(
    fromStatus: ApplicationStatus,
    toStatus: ApplicationStatus
  ): boolean {
    const rules = this.getTransitionRules()
    const allowedTransitions = rules.get(fromStatus) || []
    return allowedTransitions.includes(toStatus)
  }

  /**
   * 获取状态的可转换列表
   */
  getAvailableTransitions(currentStatus: ApplicationStatus): ApplicationStatus[] {
    const rules = this.getTransitionRules()
    return rules.get(currentStatus) || []
  }
}

/**
 * 创建默认状态映射器实例
 */
export function createStatusMapper(): StatusMapper {
  return new StatusMapper()
}

/**
 * 状态工具函数
 */
export const StatusUtils = {
  /**
   * 判断状态是否为终态
   */
  isFinalStatus(status: ApplicationStatus): boolean {
    return [
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.CANCELLED,
      ApplicationStatus.EXPIRED
    ].includes(status)
  },

  /**
   * 判断状态是否为活跃状态
   */
  isActiveStatus(status: ApplicationStatus): boolean {
    return [
      ApplicationStatus.PENDING,
      ApplicationStatus.IN_REVIEW
    ].includes(status)
  },

  /**
   * 判断状态是否为成功状态
   */
  isSuccessStatus(status: ApplicationStatus): boolean {
    return status === ApplicationStatus.APPROVED
  },

  /**
   * 判断状态是否为失败状态
   */
  isFailureStatus(status: ApplicationStatus): boolean {
    return [
      ApplicationStatus.REJECTED,
      ApplicationStatus.CANCELLED,
      ApplicationStatus.EXPIRED
    ].includes(status)
  }
}
