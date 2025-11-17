import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { UserRole } from '@prisma/client'
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  systemAdminProcedure,
  createPermissionProcedure
} from '../../lib/trpc'
// import { PermissionService, PERMISSIONS } from '../../lib/permissions'
import { SSOService } from '../../lib/sso'
import { UserSyncService } from '../../lib/userSync'

// 权限检查程序 - 暂时注释掉
// const checkPermissionProcedure = createPermissionProcedure(PERMISSIONS.RESOURCES.ADMIN, PERMISSIONS.ACTIONS.READ)

export const authRouter = createTRPCRouter({
  // SSO回调处理
  ssoCallback: publicProcedure
    .input(z.object({
      provider: z.enum(['saml', 'oauth']),
      code: z.string().optional(),
      state: z.string().optional(),
      samlResponse: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        let responseData: any;

        if (input.provider === 'saml' && input.samlResponse) {
          responseData = input.samlResponse;
        } else if (input.provider === 'oauth' && input.code) {
          responseData = { code: input.code, state: input.state };
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Missing required SSO parameters'
          });
        }

        // 验证SSO响应
        const validationResult = await SSOService.validateResponse(input.provider, responseData);

        if (!validationResult.success || !validationResult.userInfo) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: validationResult.error || 'SSO validation failed'
          });
        }

        // 同步用户信息
        const syncResult = await UserSyncService.syncUserFromSSO(validationResult.userInfo);

        if (!syncResult.success || !syncResult.user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: syncResult.error || 'User sync failed'
          });
        }

        // 创建会话令牌
        const token = await SSOService.createSSOSession(validationResult.userInfo);

        return {
          success: true,
          token,
          user: {
            id: syncResult.user.id,
            email: syncResult.user.email,
            name: syncResult.user.name,
            role: syncResult.user.role,
            provider: validationResult.userInfo.provider
          }
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error('SSO callback error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'SSO authentication failed'
        });
      }
    }),

  // 检查SSO可用性
  checkSSOAvailability: publicProcedure
    .input(z.object({
      provider: z.enum(['saml', 'oauth'])
    }))
    .query(async ({ input }) => {
      const available = await SSOService.checkSSOAvailability(input.provider);
      return { available };
    }),

  // 获取用户同步统计（管理员功能）
  getUserSyncStats: systemAdminProcedure
    .query(async () => {
      const stats = await UserSyncService.getSyncStatistics();
      return stats;
    }),

  // 检查用户权限
  checkPermission: protectedProcedure
    .input(z.object({
      resource: z.string(),
      action: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      // 简化权限检查 - 仅基于角色
      const isAdmin = ctx.user.role === 'SYSTEM_ADMIN' || ctx.user.role === 'ASSET_MANAGER'
      return { allowed: isAdmin }
    }),

  // 获取用户所有权限
  getUserPermissions: protectedProcedure
    .query(async ({ ctx }) => {
      // 基于角色返回权限列表
      const permissions = await ctx.prisma.permission.findMany({
        where: { role: ctx.user.role }
      })
      return permissions
    }),

  // 获取当前用户信息（包括权限）
  getMe: protectedProcedure
    .query(async ({ ctx }) => {
      const user = ctx.user

      // 基于角色获取权限
      const permissions = await ctx.prisma.permission.findMany({
        where: { role: user.role }
      })

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        department: user.department,
        role: user.role,
        permissions,
      }
    }),

  // 管理员功能：获取所有用户列表
  getUsers: systemAdminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
      role: z.nativeEnum(UserRole).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.search && {
          OR: [
            { username: { contains: input.search, mode: 'insensitive' as const } },
            { email: { contains: input.search, mode: 'insensitive' as const } },
            { name: { contains: input.search, mode: 'insensitive' as const } },
          ],
        }),
        ...(input.role && { role: input.role }),
      }

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            department: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.user.count({ where }),
      ])

      return {
        users,
        total,
        hasMore: input.offset + input.limit < total,
      }
    }),

  // 管理员功能：更改用户角色
  changeUserRole: systemAdminProcedure
    .input(z.object({
      userId: z.string(),
      newRole: z.nativeEnum(UserRole),
      reason: z.string().min(1, '请提供角色变更原因'),
    }))
    .mutation(async ({ input, ctx }) => {
      // 防止用户修改自己的角色
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '不能修改自己的角色',
        })
      }

      // 更新用户角色
      const updatedUser = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.newRole }
      })

      // 记录详细的角色变更日志
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'role_change_approved',
          resource: `user:${input.userId}`,
          newValue: input.newRole,
          ipAddress: 'unknown',
          userAgent: 'unknown',
          metadata: {
            reason: input.reason,
            adminUsername: ctx.user.username,
          }
        }
      })

      return { success: true }
    }),

  // 管理员功能：获取用户审计日志
  getUserAuditLogs: systemAdminProcedure
    .input(z.object({
      userId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      action: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input.userId && { userId: input.userId }),
        ...(input.action && { action: { contains: input.action } }),
        ...(input.dateFrom || input.dateTo) && {
          createdAt: {
            ...(input.dateFrom && { gte: input.dateFrom }),
            ...(input.dateTo && { lte: input.dateTo }),
          },
        },
      }

      const [logs, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                username: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.auditLog.count({ where }),
      ])

      return {
        logs,
        total,
        hasMore: input.offset + input.limit < total,
      }
    }),

  // 获取系统权限统计
  getPermissionStats: systemAdminProcedure
    .query(async ({ ctx }) => {
      // 用户角色分布
      const roleStats = await ctx.prisma.user.groupBy({
        by: ['role'],
        _count: {
          role: true,
        },
      })

      // 最近权限活动
      const recentActivity = await ctx.prisma.auditLog.findMany({
        where: {
          action: {
            in: ['permission_checked', 'access_denied', 'role_changed'],
          },
        },
        include: {
          user: {
            select: {
              username: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      // 权限拒绝统计（过去7天）
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const deniedAccessCount = await ctx.prisma.auditLog.count({
        where: {
          action: 'access_denied',
          createdAt: { gte: sevenDaysAgo },
        },
      })

      return {
        roleDistribution: roleStats.map(stat => ({
          role: stat.role,
          count: stat._count.role,
        })),
        recentActivity,
        deniedAccessCount,
      }
    }),

  // 获取管理面板统计信息
  getAdminDashboard: systemAdminProcedure
    .query(async ({ ctx }) => {
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      // 用户统计
      const [totalUsers, activeUsers, adminUsers, onlineUsers] = await Promise.all([
        ctx.prisma.user.count(),
        ctx.prisma.user.count({ where: { lastLoginAt: { not: null } } }),
        ctx.prisma.user.count({ where: { role: UserRole.SYSTEM_ADMIN } }),
        ctx.prisma.user.count({ where: { lastLoginAt: { gte: oneDayAgo } } }),
      ])

      return {
        userStats: {
          total: totalUsers,
          active: activeUsers,
          admin: adminUsers,
          online: onlineUsers,
        },
      }
    }),
})