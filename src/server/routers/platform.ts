import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../../lib/trpc';
import { TRPCError } from '@trpc/server';
import { PlatformIntegrationService } from '@/lib/services/platformIntegration';
import { SSOAuthService } from '@/lib/services/ssoAuth';
import { RedirectLoggerService } from '@/lib/services/redirectLogger';
import { prisma } from '@/lib/prisma';

/**
 * 第三方平台集成tRPC路由
 * 提供平台跳转、日志查询等功能的API接口
 */

export const platformRouter = createTRPCRouter({
  /**
   * 获取支持的平台列表和用户权限
   */
  getSupportedPlatforms: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const supportedPlatforms = PlatformIntegrationService.getSupportedPlatforms();
        const userPlatformAccess: Record<string, boolean> = {};

        // 检查用户对各平台的访问权限
        for (const platform of supportedPlatforms) {
          userPlatformAccess[platform] = await SSOAuthService.validatePlatformAccess(
            ctx.session.user.id,
            platform
          );
        }

        return {
          platforms: supportedPlatforms.map(platform => ({
            key: platform,
            name: getPlatformDisplayName(platform),
            description: getPlatformDescription(platform),
            hasAccess: userPlatformAccess[platform]
          })),
          userAccess: userPlatformAccess
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取平台信息失败'
        });
      }
    }),

  /**
   * 生成第三方平台跳转URL
   */
  initiateRedirect: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      platform: z.string(),
      mode: z.enum(['new_window', 'current_window', 'iframe']).optional().default('new_window'),
      userAgent: z.string().optional(),
      isMobile: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { applicationId, platform, mode, userAgent, isMobile } = input;

        // 验证平台支持
        const supportedPlatforms = PlatformIntegrationService.getSupportedPlatforms();
        if (!supportedPlatforms.includes(platform)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `不支持的平台: ${platform}`
          });
        }

        // 获取申请信息
        const application = await prisma.application.findUnique({
          where: { id: applicationId },
          include: { user: true }
        });

        if (!application) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '申请不存在'
          });
        }

        // 权限验证
        if (application.userId !== ctx.session.user.id && ctx.session.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权限访问此申请'
          });
        }

        // 验证用户平台访问权限
        const hasAccess = await SSOAuthService.validatePlatformAccess(
          ctx.session.user.id,
          platform
        );

        if (!hasAccess) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `您无权限访问 ${platform} 平台`
          });
        }

        // 获取完整用户信息
        const user = await prisma.user.findUnique({
          where: { id: ctx.session.user.id }
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '用户不存在'
          });
        }

        // 移动端优化模式选择
        let optimizedMode = mode;
        if (isMobile) {
          if (mode === 'new_window') {
            optimizedMode = 'current_window';
          }
          if (mode === 'iframe') {
            optimizedMode = 'current_window';
          }
        }

        // 构建跳转URL
        const redirectUrl = await PlatformIntegrationService.buildRedirectUrl(
          platform,
          user,
          application,
          {
            redirectMode: optimizedMode,
            userAgent,
            isMobile,
            sessionId: ctx.session.user.id
          }
        );

        // 记录跳转开始日志
        const logId = await RedirectLoggerService.logRedirectStart(
          user,
          application,
          platform,
          redirectUrl,
          optimizedMode,
          {
            userAgent,
            sessionId: ctx.session.user.id,
            isMobile,
            originalMode: mode,
            optimizedMode
          }
        );

        return {
          redirectUrl,
          platform,
          mode: optimizedMode,
          logId,
          optimized: mode !== optimizedMode,
          message: isMobile ? '已为移动端优化跳转方式' : '跳转URL生成成功'
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : '生成跳转URL失败'
        });
      }
    }),

  /**
   * 获取用户跳转历史
   */
  getRedirectHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
      platform: z.string().optional(),
      applicationId: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { limit, offset, platform, applicationId } = input;

        let redirectHistory;

        if (applicationId) {
          // 获取特定申请的跳转历史
          const application = await prisma.application.findUnique({
            where: { id: applicationId }
          });

          if (!application) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '申请不存在'
            });
          }

          // 权限验证
          if (application.userId !== ctx.session.user.id && ctx.session.user.role !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: '无权限查看此申请的跳转历史'
            });
          }

          redirectHistory = await RedirectLoggerService.getApplicationRedirectHistory(applicationId);
        } else {
          // 获取用户跳转历史
          redirectHistory = await RedirectLoggerService.getUserRedirectHistory(
            ctx.session.user.id,
            limit,
            offset
          );
        }

        // 过滤平台
        if (platform) {
          redirectHistory = redirectHistory.filter(record => record.platform === platform);
        }

        return {
          records: redirectHistory,
          total: redirectHistory.length,
          hasMore: redirectHistory.length === limit
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取跳转历史失败'
        });
      }
    }),

  /**
   * 获取跳转分析数据（仅管理员）
   */
  getRedirectAnalytics: protectedProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      platform: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      // 仅管理员可访问分析数据
      if (ctx.session.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '仅管理员可访问分析数据'
        });
      }

      try {
        const { startDate, endDate, platform } = input;

        const analytics = await RedirectLoggerService.getRedirectAnalytics(
          startDate,
          endDate,
          platform
        );

        return analytics;

      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取分析数据失败'
        });
      }
    }),

  /**
   * 更新跳转状态（用于前端回调）
   */
  updateRedirectStatus: protectedProcedure
    .input(z.object({
      logId: z.string(),
      status: z.enum(['success', 'failed', 'timeout']),
      duration: z.number().optional(),
      errorCode: z.string().optional(),
      errorMessage: z.string().optional(),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { logId, status, duration, errorCode, errorMessage, metadata } = input;

        if (status === 'success') {
          await RedirectLoggerService.logRedirectSuccess(logId, duration, metadata);
        } else if (status === 'failed') {
          await RedirectLoggerService.logRedirectFailure(
            logId,
            errorCode || 'UNKNOWN_ERROR',
            errorMessage || '未知错误',
            metadata
          );
        } else if (status === 'timeout') {
          await RedirectLoggerService.logRedirectTimeout(logId);
        }

        return { success: true };

      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '更新跳转状态失败'
        });
      }
    }),

  /**
   * 获取平台配置信息
   */
  getPlatformConfig: protectedProcedure
    .input(z.object({
      platform: z.string()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { platform } = input;

        const config = PlatformIntegrationService.getPlatformConfig(platform);
        if (!config) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '平台配置不存在'
          });
        }

        // 验证用户权限
        const hasAccess = await SSOAuthService.validatePlatformAccess(
          ctx.session.user.id,
          platform
        );

        return {
          platform: config.platform,
          name: getPlatformDisplayName(platform),
          description: getPlatformDescription(platform),
          hasAccess,
          supportedModes: ['new_window', 'current_window', 'iframe'],
          // 出于安全考虑，不返回敏感的配置信息如URL和密钥
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取平台配置失败'
        });
      }
    })
});

// 辅助函数
function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    hive: 'Hive数据平台',
    enterprise_wechat: '企业微信',
    oa_system: 'OA办公系统'
  };
  return names[platform] || platform;
}

function getPlatformDescription(platform: string): string {
  const descriptions: Record<string, string> = {
    hive: '企业级大数据平台，用于数据查询和分析审批',
    enterprise_wechat: '企业微信审批流程，支持移动端操作',
    oa_system: '办公自动化系统，标准企业审批流程'
  };
  return descriptions[platform] || '第三方平台集成';
}