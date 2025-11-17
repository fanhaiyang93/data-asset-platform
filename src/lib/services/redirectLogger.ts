import { prisma } from '../prisma';
import { User, Application } from '@prisma/client';

/**
 * 第三方平台跳转日志记录服务
 * 记录所有跳转行为，便于问题排查和用户行为分析
 */

export interface RedirectLog {
  id?: string;
  userId: string;
  applicationId: string;
  platform: string;
  redirectUrl: string;
  redirectMode: string;
  status: 'initiated' | 'success' | 'failed' | 'timeout';
  errorCode?: string;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  duration?: number; // 毫秒
  createdAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface RedirectAnalytics {
  totalRedirects: number;
  successRate: number;
  failureRate: number;
  platformBreakdown: Record<string, number>;
  errorBreakdown: Record<string, number>;
  averageDuration: number;
  peakHours: Record<string, number>;
}

export class RedirectLoggerService {
  /**
   * 记录跳转开始
   */
  static async logRedirectStart(
    user: User,
    application: Application,
    platform: string,
    redirectUrl: string,
    redirectMode: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // 首先检查platform_redirects表是否存在，如果不存在则创建
      await this.ensureRedirectLogTable();

      const logEntry = await prisma.$executeRawUnsafe(`
        INSERT INTO platform_redirects (
          user_id, application_id, platform, redirect_url, redirect_mode,
          status, user_agent, ip_address, session_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
        user.id,
        application.id,
        platform,
        redirectUrl,
        redirectMode,
        'initiated',
        metadata?.userAgent || '',
        metadata?.ipAddress || '',
        metadata?.sessionId || '',
        JSON.stringify(metadata || {})
      );

      // 获取插入的ID
      const result = await prisma.$queryRawUnsafe(`
        SELECT LAST_INSERT_ID() as id
      `) as Array<{ id: number }>;

      const logId = result[0]?.id?.toString() || 'unknown';

      console.log(`跳转日志记录开始: ID=${logId}, 用户=${user.id}, 申请=${application.id}, 平台=${platform}`);

      return logId;
    } catch (error) {
      console.error('记录跳转开始日志失败:', error);
      // 即使日志记录失败，也不应该阻止正常业务流程
      return 'log-failed';
    }
  }

  /**
   * 更新跳转状态为成功
   */
  static async logRedirectSuccess(
    logId: string,
    duration?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE platform_redirects
        SET status = ?, completed_at = NOW(), duration = ?, metadata = JSON_MERGE(metadata, ?)
        WHERE id = ?
      `,
        'success',
        duration || null,
        JSON.stringify(metadata || {}),
        logId
      );

      console.log(`跳转成功: ID=${logId}, 耗时=${duration}ms`);
    } catch (error) {
      console.error('更新跳转成功日志失败:', error);
    }
  }

  /**
   * 更新跳转状态为失败
   */
  static async logRedirectFailure(
    logId: string,
    errorCode: string,
    errorMessage: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE platform_redirects
        SET status = ?, error_code = ?, error_message = ?, completed_at = NOW(), metadata = JSON_MERGE(metadata, ?)
        WHERE id = ?
      `,
        'failed',
        errorCode,
        errorMessage,
        JSON.stringify(metadata || {}),
        logId
      );

      console.log(`跳转失败: ID=${logId}, 错误=${errorCode}: ${errorMessage}`);
    } catch (error) {
      console.error('更新跳转失败日志失败:', error);
    }
  }

  /**
   * 标记跳转超时
   */
  static async logRedirectTimeout(logId: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE platform_redirects
        SET status = ?, completed_at = NOW()
        WHERE id = ? AND status = 'initiated'
      `,
        'timeout',
        logId
      );

      console.log(`跳转超时: ID=${logId}`);
    } catch (error) {
      console.error('更新跳转超时日志失败:', error);
    }
  }

  /**
   * 查询用户的跳转历史
   */
  static async getUserRedirectHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<RedirectLog[]> {
    try {
      const records = await prisma.$queryRawUnsafe(`
        SELECT * FROM platform_redirects
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, userId, limit, offset) as RedirectLog[];

      return records.map(record => ({
        ...record,
        metadata: typeof record.metadata === 'string'
          ? JSON.parse(record.metadata)
          : record.metadata
      }));
    } catch (error) {
      console.error('查询用户跳转历史失败:', error);
      return [];
    }
  }

  /**
   * 查询申请的跳转历史
   */
  static async getApplicationRedirectHistory(
    applicationId: string
  ): Promise<RedirectLog[]> {
    try {
      const records = await prisma.$queryRawUnsafe(`
        SELECT * FROM platform_redirects
        WHERE application_id = ?
        ORDER BY created_at DESC
      `, applicationId) as RedirectLog[];

      return records.map(record => ({
        ...record,
        metadata: typeof record.metadata === 'string'
          ? JSON.parse(record.metadata)
          : record.metadata
      }));
    } catch (error) {
      console.error('查询申请跳转历史失败:', error);
      return [];
    }
  }

  /**
   * 获取跳转分析数据
   */
  static async getRedirectAnalytics(
    startDate?: Date,
    endDate?: Date,
    platform?: string
  ): Promise<RedirectAnalytics> {
    try {
      const whereClause = this.buildAnalyticsWhereClause(startDate, endDate, platform);

      // 总跳转数
      const totalResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total FROM platform_redirects ${whereClause}
      `) as Array<{ total: number }>;
      const totalRedirects = totalResult[0]?.total || 0;

      // 成功率统计
      const statusResult = await prisma.$queryRawUnsafe(`
        SELECT status, COUNT(*) as count
        FROM platform_redirects ${whereClause}
        GROUP BY status
      `) as Array<{ status: string; count: number }>;

      const successCount = statusResult.find(s => s.status === 'success')?.count || 0;
      const failedCount = statusResult.find(s => s.status === 'failed')?.count || 0;

      // 平台分布
      const platformResult = await prisma.$queryRawUnsafe(`
        SELECT platform, COUNT(*) as count
        FROM platform_redirects ${whereClause}
        GROUP BY platform
      `) as Array<{ platform: string; count: number }>;

      // 错误分布
      const errorResult = await prisma.$queryRawUnsafe(`
        SELECT error_code, COUNT(*) as count
        FROM platform_redirects
        ${whereClause} AND error_code IS NOT NULL
        GROUP BY error_code
      `) as Array<{ error_code: string; count: number }>;

      // 平均耗时
      const durationResult = await prisma.$queryRawUnsafe(`
        SELECT AVG(duration) as avg_duration
        FROM platform_redirects
        ${whereClause} AND duration IS NOT NULL
      `) as Array<{ avg_duration: number }>;

      // 高峰时段分析
      const peakHoursResult = await prisma.$queryRawUnsafe(`
        SELECT HOUR(created_at) as hour, COUNT(*) as count
        FROM platform_redirects ${whereClause}
        GROUP BY HOUR(created_at)
        ORDER BY count DESC
      `) as Array<{ hour: number; count: number }>;

      return {
        totalRedirects,
        successRate: totalRedirects > 0 ? (successCount / totalRedirects) * 100 : 0,
        failureRate: totalRedirects > 0 ? (failedCount / totalRedirects) * 100 : 0,
        platformBreakdown: Object.fromEntries(
          platformResult.map(p => [p.platform, p.count])
        ),
        errorBreakdown: Object.fromEntries(
          errorResult.map(e => [e.error_code, e.count])
        ),
        averageDuration: durationResult[0]?.avg_duration || 0,
        peakHours: Object.fromEntries(
          peakHoursResult.map(p => [p.hour.toString(), p.count])
        )
      };
    } catch (error) {
      console.error('获取跳转分析数据失败:', error);
      return {
        totalRedirects: 0,
        successRate: 0,
        failureRate: 0,
        platformBreakdown: {},
        errorBreakdown: {},
        averageDuration: 0,
        peakHours: {}
      };
    }
  }

  /**
   * 清理过期日志（保留最近90天）
   */
  static async cleanupOldLogs(): Promise<number> {
    try {
      const result = await prisma.$executeRawUnsafe(`
        DELETE FROM platform_redirects
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
      `);

      console.log(`清理了 ${result} 条过期跳转日志`);
      return typeof result === 'number' ? result : 0;
    } catch (error) {
      console.error('清理过期日志失败:', error);
      return 0;
    }
  }

  /**
   * 确保跳转日志表存在
   */
  private static async ensureRedirectLogTable(): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS platform_redirects (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          application_id VARCHAR(255) NOT NULL,
          platform VARCHAR(100) NOT NULL,
          redirect_url TEXT NOT NULL,
          redirect_mode VARCHAR(50) NOT NULL,
          status ENUM('initiated', 'success', 'failed', 'timeout') NOT NULL DEFAULT 'initiated',
          error_code VARCHAR(100) NULL,
          error_message TEXT NULL,
          user_agent TEXT NULL,
          ip_address VARCHAR(45) NULL,
          session_id VARCHAR(255) NULL,
          duration INT NULL,
          metadata JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_application_id (application_id),
          INDEX idx_platform (platform),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      // 表可能已存在，忽略错误
      console.debug('跳转日志表初始化:', error);
    }
  }

  /**
   * 构建分析查询的WHERE子句
   */
  private static buildAnalyticsWhereClause(
    startDate?: Date,
    endDate?: Date,
    platform?: string
  ): string {
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`created_at >= '${startDate.toISOString()}'`);
    }
    if (endDate) {
      conditions.push(`created_at <= '${endDate.toISOString()}'`);
    }
    if (platform) {
      conditions.push(`platform = '${platform}'`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * 批量处理超时的跳转记录
   */
  static async processTimeoutRedirects(): Promise<number> {
    try {
      // 将15分钟前仍处于initiated状态的记录标记为超时
      const result = await prisma.$executeRawUnsafe(`
        UPDATE platform_redirects
        SET status = 'timeout', completed_at = NOW()
        WHERE status = 'initiated'
        AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
      `);

      if (typeof result === 'number' && result > 0) {
        console.log(`处理了 ${result} 个超时跳转记录`);
      }

      return typeof result === 'number' ? result : 0;
    } catch (error) {
      console.error('处理超时跳转记录失败:', error);
      return 0;
    }
  }
}