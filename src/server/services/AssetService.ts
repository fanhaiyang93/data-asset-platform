import { prisma } from '@/lib/prisma'
import { type Asset, type AssetStatus, type AssetSensitivity } from '@prisma/client'
import { TRPCError } from '@trpc/server'

export interface CreateAssetInput {
  name: string
  description?: string
  code: string
  categoryId: string
  status?: AssetStatus
  type?: string
  format?: string
  size?: bigint
  recordCount?: bigint
  databaseName?: string
  schemaName?: string
  tableName?: string
  qualityScore?: number
  tags?: string
  createdBy?: string
}

export interface UpdateAssetInput {
  name?: string
  description?: string
  code?: string
  categoryId?: string
  status?: AssetStatus
  type?: string
  format?: string
  size?: bigint
  recordCount?: bigint
  databaseName?: string
  schemaName?: string
  tableName?: string
  qualityScore?: number
  lastValidated?: Date
  tags?: string
  updatedBy?: string
}

export interface FindManyAssetsInput {
  categoryId?: string
  status?: AssetStatus
  sensitivity?: AssetSensitivity
  type?: string
  search?: string
  tags?: string[]
  skip?: number
  take?: number
  orderBy?: {
    field: 'name' | 'createdAt' | 'updatedAt' | 'accessCount' | 'qualityScore'
    direction: 'asc' | 'desc'
  }
}

export interface AssetDetail extends Asset {
  category: any
  creator: any
  updater: any
  metadataVersions: any[]
  usageStats?: {
    applicationCount: number
    activeUsers: number
    lastAccessed?: Date
  }
  tableSchema?: {
    columns: TableColumn[]
    indexes: string[]
    constraints: string[]
  }
}

export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  comment?: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  defaultValue?: string
}

export interface SampleDataInput {
  assetId: string
  limit?: number
}

export interface SampleDataResult {
  columns: string[]
  rows: any[][]
  totalRows: number
  isMasked: boolean
  processingTime: number
}

export class AssetService {
  /**
   * 创建资产
   */
  static async create(data: CreateAssetInput): Promise<Asset> {
    try {
      // 检查分类是否存在
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '指定的分类不存在'
        })
      }

      // 检查资产编码是否唯一
      const existingAsset = await prisma.asset.findUnique({
        where: { code: data.code }
      })

      if (existingAsset) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '资产编码已存在'
        })
      }

      const asset = await prisma.asset.create({
        data: {
          ...data,
          status: data.status || 'DRAFT'
        },
        include: {
          category: true,
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        }
      })

      return asset
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('创建资产失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '创建资产失败'
      })
    }
  }

  /**
   * 根据ID获取资产
   */
  static async findById(id: string): Promise<Asset | null> {
    try {
      const asset = await prisma.asset.findUnique({
        where: { id },
        include: {
          category: true,
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          updater: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          metadataVersions: {
            orderBy: {
              version: 'desc'
            },
            take: 1
          }
        }
      })

      // 更新访问计数
      if (asset) {
        await prisma.asset.update({
          where: { id },
          data: {
            accessCount: {
              increment: 1
            },
            lastAccessed: new Date()
          }
        })
      }

      return asset
    } catch (error) {
      console.error('获取资产失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取资产失败'
      })
    }
  }

  /**
   * 查询多个资产
   */
  static async findMany(params: FindManyAssetsInput): Promise<{
    assets: Asset[]
    total: number
  }> {
    try {
      const {
        categoryId,
        status,
        sensitivity,
        type,
        search,
        tags,
        skip = 0,
        take = 20,
        orderBy = { field: 'updatedAt', direction: 'desc' }
      } = params

      // 构建查询条件
      const where: any = {}

      if (categoryId) {
        where.categoryId = categoryId
      }

      if (status) {
        where.status = status
      }

      if (sensitivity) {
        where.sensitivity = sensitivity
      }

      if (type) {
        where.type = type
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { code: { contains: search } }
        ]
      }

      if (tags && tags.length > 0) {
        // 简单的标签查询实现（假设标签存储为JSON字符串）
        where.tags = {
          contains: tags[0] // 简化处理，实际应该更复杂的JSON查询
        }
      }

      // 构建排序条件
      const orderByClause: any = {}
      orderByClause[orderBy.field] = orderBy.direction

      // 执行查询
      const [assets, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause,
          include: {
            category: true,
            creator: {
              select: {
                id: true,
                username: true,
                name: true
              }
            }
          }
        }),
        prisma.asset.count({ where })
      ])

      return { assets, total }
    } catch (error) {
      console.error('查询资产失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '查询资产失败'
      })
    }
  }

  /**
   * 更新资产
   */
  static async update(id: string, data: UpdateAssetInput): Promise<Asset> {
    try {
      // 检查资产是否存在
      const existingAsset = await prisma.asset.findUnique({
        where: { id }
      })

      if (!existingAsset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '资产不存在'
        })
      }

      // 如果更新编码，检查唯一性
      if (data.code && data.code !== existingAsset.code) {
        const codeExists = await prisma.asset.findUnique({
          where: { code: data.code }
        })

        if (codeExists) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '资产编码已存在'
          })
        }
      }

      // 如果更新分类，检查分类是否存在
      if (data.categoryId && data.categoryId !== existingAsset.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId }
        })

        if (!category) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '指定的分类不存在'
          })
        }
      }

      const asset = await prisma.asset.update({
        where: { id },
        data,
        include: {
          category: true,
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          },
          updater: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        }
      })

      return asset
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('更新资产失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '更新资产失败'
      })
    }
  }

  /**
   * 删除资产
   */
  static async delete(id: string): Promise<void> {
    try {
      const asset = await prisma.asset.findUnique({
        where: { id }
      })

      if (!asset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '资产不存在'
        })
      }

      // 软删除：将状态设置为DEPRECATED而不是物理删除
      await prisma.asset.update({
        where: { id },
        data: {
          status: 'DEPRECATED'
        }
      })
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('删除资产失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '删除资产失败'
      })
    }
  }

  /**
   * 获取资产统计信息
   */
  static async getStats(categoryId?: string): Promise<{
    total: number
    byStatus: Record<AssetStatus, number>
    byType: Record<string, number>
  }> {
    try {
      const where: any = {}
      if (categoryId) {
        where.categoryId = categoryId
      }

      const [total, statusStats, typeStats] = await Promise.all([
        prisma.asset.count({ where }),
        prisma.asset.groupBy({
          by: ['status'],
          where,
          _count: {
            status: true
          }
        }),
        prisma.asset.groupBy({
          by: ['type'],
          where: {
            ...where,
            type: { not: null }
          },
          _count: {
            type: true
          }
        })
      ])

      const byStatus = statusStats.reduce((acc, stat) => {
        acc[stat.status as AssetStatus] = stat._count.status
        return acc
      }, {} as Record<AssetStatus, number>)

      const byType = typeStats.reduce((acc, stat) => {
        if (stat.type) {
          acc[stat.type] = stat._count.type
        }
        return acc
      }, {} as Record<string, number>)

      return {
        total,
        byStatus,
        byType
      }
    } catch (error) {
      console.error('获取资产统计失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取资产统计失败'
      })
    }
  }

  /**
   * 获取资产详情（增强版，包含使用统计和表结构）
   */
  static async getAssetDetail(id: string): Promise<AssetDetail | null> {
    try {
      const asset = await prisma.asset.findUnique({
        where: { id },
        include: {
          category: true,
          creator: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true
            }
          },
          updater: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true
            }
          },
          metadataVersions: {
            orderBy: {
              version: 'desc'
            },
            take: 5,
            include: {
              creator: {
                select: {
                  id: true,
                  username: true,
                  name: true
                }
              }
            }
          }
        }
      })

      if (!asset) {
        return null
      }

      // 更新访问计数和访问日志
      await prisma.$transaction([
        prisma.asset.update({
          where: { id },
          data: {
            accessCount: {
              increment: 1
            },
            lastAccessed: new Date()
          }
        }),
        // 记录访问日志
        prisma.accessLog.create({
          data: {
            assetId: id,
            action: 'VIEW_DETAIL',
            metadata: {
              timestamp: new Date().toISOString(),
              source: 'web'
            }
          }
        }).catch(() => {
          // 忽略访问日志失败，不影响主流程
          console.warn('记录访问日志失败，但不影响资产详情获取')
        })
      ])

      // 获取使用统计
      const usageStats = await this.getAssetUsageStats(id)

      // 获取表结构信息
      const tableSchema = await this.getTableSchema(asset)

      const assetDetail: AssetDetail = {
        ...asset,
        usageStats,
        tableSchema
      }

      return assetDetail
    } catch (error) {
      console.error('获取资产详情失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取资产详情失败'
      })
    }
  }

  /**
   * 获取样例数据（带脱敏处理）
   */
  static async getSampleData(input: SampleDataInput): Promise<SampleDataResult> {
    const startTime = Date.now()
    const { assetId, limit = 10 } = input

    try {
      // 获取资产信息
      const asset = await prisma.asset.findUnique({
        where: { id: assetId }
      })

      if (!asset) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '资产不存在'
        })
      }

      // 模拟从数据库获取样例数据
      // 在实际环境中，这里会连接到实际的数据源
      const sampleData = await this.fetchSampleDataFromSource(asset, limit)

      // 应用脱敏策略
      const maskedData = await this.applyDataMasking(sampleData, asset)

      const processingTime = Date.now() - startTime

      // 确保脱敏处理时间不超过200ms
      if (processingTime > 200) {
        console.warn(`数据脱敏处理时间超过阈值: ${processingTime}ms`)
      }

      return {
        columns: maskedData.columns,
        rows: maskedData.rows,
        totalRows: maskedData.totalRows,
        isMasked: true,
        processingTime
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      console.error('获取样例数据失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '获取样例数据失败'
      })
    }
  }

  /**
   * 获取资产使用统计
   */
  private static async getAssetUsageStats(assetId: string) {
    try {
      // 这里模拟获取统计数据，实际应该从应用记录表中统计
      const [applicationCount, accessLogs] = await Promise.all([
        // 模拟申请次数统计
        prisma.assetApplication?.count({
          where: { assetId }
        }).catch(() => 0) || 0,

        // 获取最近的访问记录
        prisma.accessLog?.findMany({
          where: {
            assetId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 最近30天
            }
          },
          select: { createdBy: true },
          distinct: ['createdBy']
        }).catch(() => []) || []
      ])

      return {
        applicationCount,
        activeUsers: accessLogs.length,
        lastAccessed: new Date()
      }
    } catch (error) {
      console.warn('获取使用统计失败:', error)
      return {
        applicationCount: 0,
        activeUsers: 0
      }
    }
  }

  /**
   * 获取表结构信息
   */
  private static async getTableSchema(asset: Asset): Promise<AssetDetail['tableSchema']> {
    try {
      if (!asset.databaseName || !asset.tableName) {
        return undefined
      }

      // 模拟获取表结构信息
      // 实际环境中应该连接到数据库获取真实的表结构
      const mockColumns: TableColumn[] = [
        {
          name: 'id',
          type: 'bigint',
          nullable: false,
          comment: '主键ID',
          isPrimaryKey: true,
          isForeignKey: false
        },
        {
          name: 'name',
          type: 'varchar(255)',
          nullable: false,
          comment: '名称',
          isPrimaryKey: false,
          isForeignKey: false
        },
        {
          name: 'email',
          type: 'varchar(255)',
          nullable: true,
          comment: '邮箱地址',
          isPrimaryKey: false,
          isForeignKey: false
        },
        {
          name: 'created_at',
          type: 'timestamp',
          nullable: false,
          comment: '创建时间',
          isPrimaryKey: false,
          isForeignKey: false,
          defaultValue: 'CURRENT_TIMESTAMP'
        }
      ]

      return {
        columns: mockColumns,
        indexes: ['PRIMARY KEY (id)', 'INDEX idx_name (name)', 'INDEX idx_email (email)'],
        constraints: ['NOT NULL (id, name)', 'UNIQUE (email)']
      }
    } catch (error) {
      console.warn('获取表结构失败:', error)
      return undefined
    }
  }

  /**
   * 从数据源获取样例数据
   */
  private static async fetchSampleDataFromSource(asset: Asset, limit: number) {
    // 模拟数据获取逻辑
    // 实际环境中会根据asset的连接信息连接到真实数据源
    const mockData = {
      columns: ['id', 'name', 'email', 'created_at'],
      rows: [
        [1, 'John Doe', 'john.doe@example.com', '2023-01-01 10:00:00'],
        [2, 'Jane Smith', 'jane.smith@example.com', '2023-01-02 11:00:00'],
        [3, 'Bob Johnson', 'bob.johnson@example.com', '2023-01-03 12:00:00'],
        [4, 'Alice Brown', 'alice.brown@example.com', '2023-01-04 13:00:00'],
        [5, 'Charlie Davis', 'charlie.davis@example.com', '2023-01-05 14:00:00']
      ].slice(0, limit),
      totalRows: 1000000 // 模拟总行数
    }

    return mockData
  }

  /**
   * 应用数据脱敏策略
   */
  private static async applyDataMasking(data: any, asset: Asset) {
    // 应用脱敏规则
    const maskedRows = data.rows.map((row: any[]) => {
      return row.map((value: any, index: number) => {
        const columnName = data.columns[index]

        // 邮箱脱敏
        if (columnName.toLowerCase().includes('email') && typeof value === 'string') {
          const [username, domain] = value.split('@')
          if (username && domain) {
            return `${username.substring(0, 2)}***@${domain}`
          }
        }

        // 姓名脱敏
        if (columnName.toLowerCase().includes('name') && typeof value === 'string') {
          if (value.length > 2) {
            return `${value.charAt(0)}***${value.charAt(value.length - 1)}`
          }
        }

        return value
      })
    })

    return {
      columns: data.columns,
      rows: maskedRows,
      totalRows: data.totalRows
    }
  }
}