import { AuthService } from './auth';
import { SSOService } from './sso';

// SSO降级配置
export interface SSOFallbackConfig {
  enabled: boolean;
  healthCheckInterval: number; // 健康检查间隔（毫秒）
  fallbackAfterFailures: number; // 连续失败多少次后降级
  retryInterval: number; // 重试间隔（毫秒）
  maxRetryAttempts: number; // 最大重试次数
  localAuthEnabled: boolean; // 是否启用本地认证
  maintenanceMode: boolean; // 维护模式
}

// SSO健康状态
export interface SSOHealthStatus {
  provider: string;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
  responseTime?: number;
}

// 降级策略
export enum FallbackStrategy {
  LOCAL_AUTH = 'local_auth',
  MAINTENANCE_MODE = 'maintenance_mode',
  QUEUE_REQUESTS = 'queue_requests'
}

export class SSOFallbackService {
  private static config: SSOFallbackConfig = {
    enabled: true,
    healthCheckInterval: 30000, // 30秒
    fallbackAfterFailures: 3,
    retryInterval: 60000, // 1分钟
    maxRetryAttempts: 10,
    localAuthEnabled: true,
    maintenanceMode: false
  };

  private static healthStatus = new Map<string, SSOHealthStatus>();
  private static healthCheckTimers = new Map<string, NodeJS.Timeout>();
  private static fallbackActive = new Map<string, boolean>();

  // 配置降级服务
  static configure(config: Partial<SSOFallbackConfig>) {
    this.config = { ...this.config, ...config };
  }

  // 启动健康检查
  static startHealthChecks(providers: string[]) {
    if (!this.config.enabled) {
      return;
    }

    providers.forEach(provider => {
      // 初始化健康状态
      this.healthStatus.set(provider, {
        provider,
        healthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0
      });

      // 启动定期健康检查
      const timer = setInterval(
        () => this.performHealthCheck(provider),
        this.config.healthCheckInterval
      );

      this.healthCheckTimers.set(provider, timer);

      // 立即执行一次健康检查
      this.performHealthCheck(provider);
    });
  }

  // 停止健康检查
  static stopHealthChecks() {
    this.healthCheckTimers.forEach(timer => clearInterval(timer));
    this.healthCheckTimers.clear();
  }

  // 检查SSO服务可用性
  static async checkSSOAvailability(provider: string): Promise<boolean> {
    try {
      const startTime = Date.now();
      const available = await SSOService.checkSSOAvailability(provider);
      const responseTime = Date.now() - startTime;

      // 更新健康状态
      const status = this.healthStatus.get(provider);
      if (status) {
        status.healthy = available;
        status.lastCheck = new Date();
        status.responseTime = responseTime;

        if (available) {
          status.consecutiveFailures = 0;
          status.lastError = undefined;
        } else {
          status.consecutiveFailures++;
          status.lastError = 'Service unavailable';
        }

        this.healthStatus.set(provider, status);

        // 检查是否需要降级
        this.evaluateFallback(provider);
      }

      return available;

    } catch (error) {
      console.error(`SSO health check failed for ${provider}:`, error);

      const status = this.healthStatus.get(provider);
      if (status) {
        status.healthy = false;
        status.lastCheck = new Date();
        status.consecutiveFailures++;
        status.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.healthStatus.set(provider, status);

        this.evaluateFallback(provider);
      }

      return false;
    }
  }

  // 获取降级策略
  static getFallbackStrategy(provider: string): FallbackStrategy {
    if (this.config.maintenanceMode) {
      return FallbackStrategy.MAINTENANCE_MODE;
    }

    if (this.fallbackActive.get(provider) && this.config.localAuthEnabled) {
      return FallbackStrategy.LOCAL_AUTH;
    }

    return FallbackStrategy.QUEUE_REQUESTS;
  }

  // 处理SSO认证失败
  static async handleSSOFailure(provider: string, error: Error): Promise<{
    shouldFallback: boolean;
    strategy: FallbackStrategy;
    message: string;
  }> {
    console.error(`SSO authentication failed for ${provider}:`, error);

    // 更新失败统计
    const status = this.healthStatus.get(provider);
    if (status) {
      status.consecutiveFailures++;
      status.lastError = error.message;
      status.healthy = false;
      this.healthStatus.set(provider, status);
    }

    // 评估是否需要降级
    this.evaluateFallback(provider);

    const shouldFallback = this.fallbackActive.get(provider) || false;
    const strategy = this.getFallbackStrategy(provider);

    let message = '';
    switch (strategy) {
      case FallbackStrategy.LOCAL_AUTH:
        message = 'SSO服务暂时不可用，请使用账号密码登录';
        break;
      case FallbackStrategy.MAINTENANCE_MODE:
        message = '系统维护中，请稍后再试';
        break;
      case FallbackStrategy.QUEUE_REQUESTS:
        message = 'SSO服务繁忙，请稍后重试';
        break;
    }

    return {
      shouldFallback,
      strategy,
      message
    };
  }

  // 执行本地认证降级
  static async fallbackToLocalAuth(email: string, password: string): Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
  }> {
    try {
      if (!this.config.localAuthEnabled) {
        return {
          success: false,
          error: 'Local authentication is disabled'
        };
      }

      // 这里应该调用本地认证逻辑
      // 简化实现 - 实际应该验证用户凭据
      const user = await this.findLocalUser(email);

      if (!user) {
        return {
          success: false,
          error: 'User not found or SSO-only account'
        };
      }

      const validPassword = await AuthService.verifyPassword(password, user.passwordHash);

      if (!validPassword) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // 生成访问令牌
      const token = await AuthService.generateTokenWithUserData(user.id);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      };

    } catch (error) {
      console.error('Local auth fallback failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Local authentication failed'
      };
    }
  }

  // 获取所有服务健康状态
  static getHealthStatuses(): SSOHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  // 获取特定服务健康状态
  static getProviderHealth(provider: string): SSOHealthStatus | null {
    return this.healthStatus.get(provider) || null;
  }

  // 手动触发健康检查
  static async manualHealthCheck(provider: string): Promise<SSOHealthStatus> {
    await this.performHealthCheck(provider);
    return this.getProviderHealth(provider)!;
  }

  // 重置服务状态
  static resetProviderStatus(provider: string) {
    const status = this.healthStatus.get(provider);
    if (status) {
      status.healthy = true;
      status.consecutiveFailures = 0;
      status.lastError = undefined;
      this.healthStatus.set(provider, status);
      this.fallbackActive.set(provider, false);
    }
  }

  // 强制启用/禁用降级
  static setFallbackMode(provider: string, enabled: boolean) {
    this.fallbackActive.set(provider, enabled);
  }

  // 获取降级统计信息
  static getFallbackStatistics(): {
    totalProviders: number;
    healthyProviders: number;
    fallbackActive: number;
    averageResponseTime: number;
  } {
    const statuses = this.getHealthStatuses();
    const healthyCount = statuses.filter(s => s.healthy).length;
    const fallbackCount = Array.from(this.fallbackActive.values()).filter(Boolean).length;
    const avgResponseTime = statuses
      .filter(s => s.responseTime)
      .reduce((sum, s) => sum + (s.responseTime || 0), 0) / statuses.length || 0;

    return {
      totalProviders: statuses.length,
      healthyProviders: healthyCount,
      fallbackActive: fallbackCount,
      averageResponseTime: Math.round(avgResponseTime)
    };
  }

  // 私有方法：执行健康检查
  private static async performHealthCheck(provider: string) {
    await this.checkSSOAvailability(provider);
  }

  // 私有方法：评估是否需要降级
  private static evaluateFallback(provider: string) {
    const status = this.healthStatus.get(provider);
    if (!status) return;

    const shouldFallback = status.consecutiveFailures >= this.config.fallbackAfterFailures;
    const currentFallback = this.fallbackActive.get(provider) || false;

    if (shouldFallback && !currentFallback) {
      console.warn(`Activating fallback mode for SSO provider: ${provider}`);
      this.fallbackActive.set(provider, true);

      // 启动恢复检查
      this.startRecoveryCheck(provider);

    } else if (!shouldFallback && currentFallback && status.healthy) {
      console.info(`Deactivating fallback mode for SSO provider: ${provider}`);
      this.fallbackActive.set(provider, false);
    }
  }

  // 私有方法：启动恢复检查
  private static startRecoveryCheck(provider: string) {
    const checkRecovery = async () => {
      const isHealthy = await this.checkSSOAvailability(provider);

      if (isHealthy) {
        const status = this.healthStatus.get(provider);
        if (status && status.consecutiveFailures === 0) {
          // 服务已恢复
          this.fallbackActive.set(provider, false);
          console.info(`SSO provider ${provider} has recovered`);
          return;
        }
      }

      // 继续检查
      setTimeout(checkRecovery, this.config.retryInterval);
    };

    setTimeout(checkRecovery, this.config.retryInterval);
  }

  // 私有方法：查找本地用户
  private static async findLocalUser(email: string): Promise<any> {
    // 这里应该查询数据库中的本地用户
    // 简化实现
    const { prisma } = await import('./prisma');

    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        ssoProvider: true
      }
    });
  }
}