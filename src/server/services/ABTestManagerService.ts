import { redis } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  type SortOption,
  type ScoringWeights,
  type ABTestConfig,
  type ABTestVariant,
  type ABTestResult
} from '@/types/search'

/**
 * ABTestManagerService - A/B测试管理服务
 *
 * 功能：
 * 1. 创建和管理排序算法A/B测试
 * 2. 用户流量分配和变体分配
 * 3. A/B测试结果收集和分析
 * 4. 统计显著性检验
 * 5. 测试生命周期管理
 */
export class ABTestManagerService {
  private cachePrefix = 'ab_test:'
  private cacheTtl = 86400 // 24小时缓存

  /**
   * 创建A/B测试
   */
  async createABTest(config: Omit<ABTestConfig, 'testId'>): Promise<string> {
    try {
      const testId = this.generateTestId()

      const abTestConfig: ABTestConfig = {
        ...config,
        testId,
        participants: [],
        results: {
          control: {
            variant: 'control',
            participants: 0,
            conversions: 0,
            totalSessions: 0,
            avgSatisfactionScore: 0,
            avgClickThroughRate: 0,
            avgResponseTime: 0,
            significance: 0
          },
          test: {
            variant: 'test',
            participants: 0,
            conversions: 0,
            totalSessions: 0,
            avgSatisfactionScore: 0,
            avgClickThroughRate: 0,
            avgResponseTime: 0,
            significance: 0
          }
        }
      }

      // 验证测试配置
      this.validateTestConfig(abTestConfig)

      // 存储测试配置
      const testKey = `${this.cachePrefix}config:${testId}`
      await redis.setex(testKey, this.cacheTtl * 30, JSON.stringify(abTestConfig)) // 30天TTL

      // 添加到活跃测试列表
      await this.addToActiveTests(testId)

      console.log(`A/B测试创建成功: ${testId} - ${config.testName}`)
      return testId
    } catch (error) {
      console.error('创建A/B测试失败:', error)
      throw error
    }
  }

  /**
   * 为用户分配测试变体
   */
  async assignUserToVariant(
    testId: string,
    userId: string,
    forceVariant?: 'control' | 'test'
  ): Promise<{
    variant: 'control' | 'test'
    weights: ScoringWeights
    isNewParticipant: boolean
  }> {
    try {
      // 检查用户是否已分配变体
      const existingAssignment = await this.getUserVariantAssignment(testId, userId)
      if (existingAssignment) {
        const testConfig = await this.getTestConfig(testId)
        const weights = existingAssignment.variant === 'control'
          ? testConfig.controlWeights
          : testConfig.testWeights

        return {
          variant: existingAssignment.variant,
          weights,
          isNewParticipant: false
        }
      }

      // 获取测试配置
      const testConfig = await this.getTestConfig(testId)

      // 检查测试是否还在运行
      if (testConfig.status !== 'active' || new Date() > testConfig.endDate) {
        throw new Error('A/B测试已结束或未激活')
      }

      // 分配变体
      const variant = forceVariant || this.assignVariant(userId, testConfig.trafficSplit)
      const weights = variant === 'control' ? testConfig.controlWeights : testConfig.testWeights

      // 记录用户分配
      await this.recordUserAssignment(testId, userId, variant)

      // 更新参与者计数
      await this.updateParticipantCount(testConfig, variant)

      console.log(`用户 ${userId} 已分配到测试 ${testId} 的 ${variant} 组`)

      return {
        variant,
        weights,
        isNewParticipant: true
      }
    } catch (error) {
      console.error('分配用户测试变体失败:', error)
      throw error
    }
  }

  /**
   * 记录A/B测试结果
   */
  async recordTestResult(
    testId: string,
    userId: string,
    sessionId: string,
    metrics: {
      satisfactionScore?: number
      clickThroughRate?: number
      responseTime?: number
      converted?: boolean // 是否转化（如下载、收藏等）
      sessionDuration?: number
    }
  ): Promise<void> {
    try {
      // 获取用户变体分配
      const assignment = await this.getUserVariantAssignment(testId, userId)
      if (!assignment) {
        console.warn(`用户 ${userId} 未参与测试 ${testId}`)
        return
      }

      // 记录测试结果
      const resultKey = `${this.cachePrefix}result:${testId}:${assignment.variant}:${sessionId}`
      const resultData = {
        userId,
        sessionId,
        variant: assignment.variant,
        timestamp: new Date(),
        metrics
      }

      await redis.setex(resultKey, this.cacheTtl * 7, JSON.stringify(resultData)) // 7天TTL

      // 更新聚合统计
      await this.updateAggregateStats(testId, assignment.variant, metrics)

      console.log(`A/B测试结果已记录: ${testId}, 用户: ${userId}, 变体: ${assignment.variant}`)
    } catch (error) {
      console.error('记录A/B测试结果失败:', error)
    }
  }

  /**
   * 获取A/B测试结果分析
   */
  async getTestResultAnalysis(testId: string): Promise<{
    testConfig: ABTestConfig
    results: {
      control: ABTestResult
      test: ABTestResult
    }
    statisticalSignificance: {
      satisfactionScore: {
        pValue: number
        significant: boolean
        confidenceLevel: number
      }
      clickThroughRate: {
        pValue: number
        significant: boolean
        confidenceLevel: number
      }
      responseTime: {
        pValue: number
        significant: boolean
        confidenceLevel: number
      }
    }
    recommendation: {
      winningVariant: 'control' | 'test' | 'inconclusive'
      confidence: number
      reasoning: string
      suggestedAction: 'rollout' | 'rollback' | 'continue' | 'redesign'
    }
    insights: string[]
  }> {
    try {
      const testConfig = await this.getTestConfig(testId)

      // 获取聚合结果
      const controlStats = await this.getVariantStats(testId, 'control')
      const testStats = await this.getVariantStats(testId, 'test')

      // 计算统计显著性
      const significance = this.calculateStatisticalSignificance(controlStats, testStats)

      // 生成推荐
      const recommendation = this.generateRecommendation(controlStats, testStats, significance)

      // 生成洞察
      const insights = this.generateInsights(testConfig, controlStats, testStats, significance)

      return {
        testConfig,
        results: {
          control: controlStats,
          test: testStats
        },
        statisticalSignificance: significance,
        recommendation,
        insights
      }
    } catch (error) {
      console.error('获取A/B测试结果分析失败:', error)
      throw new Error('获取测试结果分析失败')
    }
  }

  /**
   * 获取活跃的A/B测试列表
   */
  async getActiveABTests(): Promise<Array<{
    testId: string
    testName: string
    status: string
    startDate: Date
    endDate: Date
    participants: number
    trafficSplit: number
  }>> {
    try {
      const activeTestsKey = `${this.cachePrefix}active_tests`
      const activeTestIds = await redis.smembers(activeTestsKey)

      const tests = await Promise.all(
        activeTestIds.map(async (testId) => {
          try {
            const config = await this.getTestConfig(testId)
            return {
              testId: config.testId,
              testName: config.testName,
              status: config.status,
              startDate: config.startDate,
              endDate: config.endDate,
              participants: config.participants.length,
              trafficSplit: config.trafficSplit
            }
          } catch (error) {
            console.error(`获取测试配置失败: ${testId}`, error)
            return null
          }
        })
      )

      return tests.filter(test => test !== null) as Array<{
        testId: string
        testName: string
        status: string
        startDate: Date
        endDate: Date
        participants: number
        trafficSplit: number
      }>
    } catch (error) {
      console.error('获取活跃A/B测试列表失败:', error)
      return []
    }
  }

  /**
   * 停止A/B测试
   */
  async stopABTest(
    testId: string,
    reason: string,
    userId: string
  ): Promise<void> {
    try {
      const testConfig = await this.getTestConfig(testId)

      // 更新测试状态
      testConfig.status = 'stopped'
      testConfig.endDate = new Date()

      // 保存更新的配置
      const testKey = `${this.cachePrefix}config:${testId}`
      await redis.setex(testKey, this.cacheTtl * 30, JSON.stringify(testConfig))

      // 从活跃测试列表中移除
      await this.removeFromActiveTests(testId)

      // 记录停止原因
      const stopLogKey = `${this.cachePrefix}stop_log:${testId}`
      const stopLog = {
        reason,
        stoppedBy: userId,
        stoppedAt: new Date(),
        testDuration: new Date().getTime() - testConfig.startDate.getTime()
      }
      await redis.setex(stopLogKey, this.cacheTtl * 30, JSON.stringify(stopLog))

      console.log(`A/B测试已停止: ${testId}, 原因: ${reason}`)
    } catch (error) {
      console.error('停止A/B测试失败:', error)
      throw error
    }
  }

  /**
   * 获取测试配置
   */
  private async getTestConfig(testId: string): Promise<ABTestConfig> {
    const testKey = `${this.cachePrefix}config:${testId}`
    const cached = await redis.get(testKey)

    if (!cached) {
      throw new Error(`A/B测试不存在: ${testId}`)
    }

    const config = JSON.parse(cached)
    // 转换日期字符串为Date对象
    config.startDate = new Date(config.startDate)
    config.endDate = new Date(config.endDate)

    return config
  }

  /**
   * 获取用户变体分配
   */
  private async getUserVariantAssignment(
    testId: string,
    userId: string
  ): Promise<{ variant: 'control' | 'test'; assignedAt: Date } | null> {
    try {
      const assignmentKey = `${this.cachePrefix}assignment:${testId}:${userId}`
      const cached = await redis.get(assignmentKey)

      if (!cached) {
        return null
      }

      const assignment = JSON.parse(cached)
      assignment.assignedAt = new Date(assignment.assignedAt)
      return assignment
    } catch (error) {
      console.error('获取用户变体分配失败:', error)
      return null
    }
  }

  /**
   * 分配变体
   */
  private assignVariant(userId: string, trafficSplit: number): 'control' | 'test' {
    // 使用用户ID的哈希值确保同一用户总是分配到相同变体
    const hash = this.hashUserId(userId)
    return hash < trafficSplit ? 'test' : 'control'
  }

  /**
   * 用户ID哈希
   */
  private hashUserId(userId: string): number {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash) / 2147483648 // 标准化到0-1
  }

  /**
   * 记录用户分配
   */
  private async recordUserAssignment(
    testId: string,
    userId: string,
    variant: 'control' | 'test'
  ): Promise<void> {
    const assignmentKey = `${this.cachePrefix}assignment:${testId}:${userId}`
    const assignment = {
      variant,
      assignedAt: new Date()
    }

    await redis.setex(assignmentKey, this.cacheTtl * 30, JSON.stringify(assignment))
  }

  /**
   * 更新参与者计数
   */
  private async updateParticipantCount(
    testConfig: ABTestConfig,
    variant: 'control' | 'test'
  ): Promise<void> {
    try {
      testConfig.results[variant].participants++
      testConfig.participants.push({
        userId: `user_${Date.now()}`, // 实际应该是真实用户ID
        variant,
        assignedAt: new Date()
      })

      // 保存更新的配置
      const testKey = `${this.cachePrefix}config:${testConfig.testId}`
      await redis.setex(testKey, this.cacheTtl * 30, JSON.stringify(testConfig))
    } catch (error) {
      console.error('更新参与者计数失败:', error)
    }
  }

  /**
   * 更新聚合统计
   */
  private async updateAggregateStats(
    testId: string,
    variant: 'control' | 'test',
    metrics: any
  ): Promise<void> {
    try {
      const statsKey = `${this.cachePrefix}stats:${testId}:${variant}`
      const cached = await redis.get(statsKey)

      let stats = cached ? JSON.parse(cached) : {
        totalSessions: 0,
        conversions: 0,
        totalSatisfactionScore: 0,
        totalClickThroughRate: 0,
        totalResponseTime: 0,
        sessionCount: 0
      }

      stats.totalSessions++

      if (metrics.converted) {
        stats.conversions++
      }

      if (metrics.satisfactionScore) {
        stats.totalSatisfactionScore += metrics.satisfactionScore
      }

      if (metrics.clickThroughRate) {
        stats.totalClickThroughRate += metrics.clickThroughRate
      }

      if (metrics.responseTime) {
        stats.totalResponseTime += metrics.responseTime
      }

      stats.sessionCount++

      await redis.setex(statsKey, this.cacheTtl * 7, JSON.stringify(stats))
    } catch (error) {
      console.error('更新聚合统计失败:', error)
    }
  }

  /**
   * 获取变体统计
   */
  private async getVariantStats(testId: string, variant: 'control' | 'test'): Promise<ABTestResult> {
    try {
      const statsKey = `${this.cachePrefix}stats:${testId}:${variant}`
      const cached = await redis.get(statsKey)

      const defaultStats: ABTestResult = {
        variant,
        participants: 0,
        conversions: 0,
        totalSessions: 0,
        avgSatisfactionScore: 0,
        avgClickThroughRate: 0,
        avgResponseTime: 0,
        significance: 0
      }

      if (!cached) {
        return defaultStats
      }

      const stats = JSON.parse(cached)

      return {
        variant,
        participants: stats.sessionCount,
        conversions: stats.conversions,
        totalSessions: stats.totalSessions,
        avgSatisfactionScore: stats.sessionCount > 0 ? stats.totalSatisfactionScore / stats.sessionCount : 0,
        avgClickThroughRate: stats.sessionCount > 0 ? stats.totalClickThroughRate / stats.sessionCount : 0,
        avgResponseTime: stats.sessionCount > 0 ? stats.totalResponseTime / stats.sessionCount : 0,
        significance: 0 // 将在统计分析中计算
      }
    } catch (error) {
      console.error('获取变体统计失败:', error)
      return {
        variant,
        participants: 0,
        conversions: 0,
        totalSessions: 0,
        avgSatisfactionScore: 0,
        avgClickThroughRate: 0,
        avgResponseTime: 0,
        significance: 0
      }
    }
  }

  /**
   * 计算统计显著性
   */
  private calculateStatisticalSignificance(
    control: ABTestResult,
    test: ABTestResult
  ): any {
    // 简化的统计显著性计算
    // 实际应用中应使用更严格的统计方法

    const calculatePValue = (controlMean: number, testMean: number, sampleSize: number): number => {
      if (sampleSize < 30) return 1.0 // 样本太小

      const diff = Math.abs(testMean - controlMean)
      const pooledStd = Math.sqrt(controlMean * (1 - controlMean) / sampleSize)
      const zScore = diff / pooledStd

      // 简化的p值计算
      return Math.max(0.001, 2 * (1 - this.normalCDF(Math.abs(zScore))))
    }

    const satisfactionPValue = calculatePValue(
      control.avgSatisfactionScore / 5, // 标准化到0-1
      test.avgSatisfactionScore / 5,
      Math.min(control.participants, test.participants)
    )

    const ctrPValue = calculatePValue(
      control.avgClickThroughRate,
      test.avgClickThroughRate,
      Math.min(control.participants, test.participants)
    )

    const responseTimePValue = calculatePValue(
      control.avgResponseTime / 1000, // 标准化
      test.avgResponseTime / 1000,
      Math.min(control.participants, test.participants)
    )

    return {
      satisfactionScore: {
        pValue: satisfactionPValue,
        significant: satisfactionPValue < 0.05,
        confidenceLevel: (1 - satisfactionPValue) * 100
      },
      clickThroughRate: {
        pValue: ctrPValue,
        significant: ctrPValue < 0.05,
        confidenceLevel: (1 - ctrPValue) * 100
      },
      responseTime: {
        pValue: responseTimePValue,
        significant: responseTimePValue < 0.05,
        confidenceLevel: (1 - responseTimePValue) * 100
      }
    }
  }

  /**
   * 标准正态分布累积分布函数
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  /**
   * 误差函数近似
   */
  private erf(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x >= 0 ? 1 : -1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }

  /**
   * 生成推荐
   */
  private generateRecommendation(
    control: ABTestResult,
    test: ABTestResult,
    significance: any
  ): any {
    let winningVariant: 'control' | 'test' | 'inconclusive' = 'inconclusive'
    let confidence = 0.5
    let reasoning = '测试结果不够显著，需要更多数据'
    let suggestedAction: 'rollout' | 'rollback' | 'continue' | 'redesign' = 'continue'

    // 检查样本大小
    if (control.participants < 30 || test.participants < 30) {
      return {
        winningVariant: 'inconclusive',
        confidence: 0.3,
        reasoning: '样本大小不足，建议继续收集数据',
        suggestedAction: 'continue'
      }
    }

    // 综合评估指标
    const testBetter = (
      (test.avgSatisfactionScore > control.avgSatisfactionScore && significance.satisfactionScore.significant) ||
      (test.avgClickThroughRate > control.avgClickThroughRate && significance.clickThroughRate.significant) ||
      (test.avgResponseTime < control.avgResponseTime && significance.responseTime.significant)
    )

    const controlBetter = (
      (control.avgSatisfactionScore > test.avgSatisfactionScore && significance.satisfactionScore.significant) ||
      (control.avgClickThroughRate > test.avgClickThroughRate && significance.clickThroughRate.significant) ||
      (control.avgResponseTime < test.avgResponseTime && significance.responseTime.significant)
    )

    if (testBetter && !controlBetter) {
      winningVariant = 'test'
      confidence = 0.85
      reasoning = '测试组在关键指标上显著优于对照组'
      suggestedAction = 'rollout'
    } else if (controlBetter && !testBetter) {
      winningVariant = 'control'
      confidence = 0.80
      reasoning = '对照组表现更好，建议回滚到原始配置'
      suggestedAction = 'rollback'
    } else if (testBetter && controlBetter) {
      winningVariant = 'inconclusive'
      confidence = 0.6
      reasoning = '测试结果混合，不同指标表现不一致'
      suggestedAction = 'redesign'
    }

    return {
      winningVariant,
      confidence,
      reasoning,
      suggestedAction
    }
  }

  /**
   * 生成洞察
   */
  private generateInsights(
    testConfig: ABTestConfig,
    control: ABTestResult,
    test: ABTestResult,
    significance: any
  ): string[] {
    const insights: string[] = []

    // 参与者数量分析
    if (control.participants + test.participants < 100) {
      insights.push('测试参与者数量较少，建议延长测试时间以获得更可靠的结果')
    }

    // 满意度分析
    const satisfactionDiff = test.avgSatisfactionScore - control.avgSatisfactionScore
    if (Math.abs(satisfactionDiff) > 0.2) {
      if (satisfactionDiff > 0) {
        insights.push(`测试组用户满意度提升了${(satisfactionDiff).toFixed(2)}分，表现出色`)
      } else {
        insights.push(`测试组用户满意度下降了${Math.abs(satisfactionDiff).toFixed(2)}分，需要关注`)
      }
    }

    // 点击率分析
    const ctrDiff = test.avgClickThroughRate - control.avgClickThroughRate
    if (Math.abs(ctrDiff) > 0.05) {
      const improvement = ((ctrDiff / control.avgClickThroughRate) * 100).toFixed(1)
      if (ctrDiff > 0) {
        insights.push(`测试组点击率提升了${improvement}%，用户参与度更高`)
      } else {
        insights.push(`测试组点击率下降了${Math.abs(Number(improvement))}%，需要分析原因`)
      }
    }

    // 响应时间分析
    const timeDiff = test.avgResponseTime - control.avgResponseTime
    if (Math.abs(timeDiff) > 50) { // 50ms差异
      if (timeDiff < 0) {
        insights.push(`测试组响应时间减少了${Math.abs(timeDiff).toFixed(0)}ms，性能有所提升`)
      } else {
        insights.push(`测试组响应时间增加了${timeDiff.toFixed(0)}ms，可能影响用户体验`)
      }
    }

    // 统计显著性分析
    const significantMetrics = []
    if (significance.satisfactionScore.significant) significantMetrics.push('用户满意度')
    if (significance.clickThroughRate.significant) significantMetrics.push('点击率')
    if (significance.responseTime.significant) significantMetrics.push('响应时间')

    if (significantMetrics.length > 0) {
      insights.push(`${significantMetrics.join('、')}指标达到统计显著性水平`)
    } else {
      insights.push('当前指标尚未达到统计显著性，建议继续收集数据')
    }

    // 测试持续时间分析
    const testDuration = new Date().getTime() - testConfig.startDate.getTime()
    const daysRunning = Math.floor(testDuration / (24 * 60 * 60 * 1000))
    if (daysRunning < 7) {
      insights.push('测试已运行${daysRunning}天，建议至少运行一周以获得更稳定的结果')
    }

    return insights
  }

  /**
   * 验证测试配置
   */
  private validateTestConfig(config: ABTestConfig): void {
    if (!config.testName || config.testName.trim().length === 0) {
      throw new Error('测试名称不能为空')
    }

    if (config.trafficSplit < 0.1 || config.trafficSplit > 0.9) {
      throw new Error('流量分配比例必须在0.1-0.9之间')
    }

    if (config.endDate <= config.startDate) {
      throw new Error('结束时间必须晚于开始时间')
    }

    // 验证权重配置
    const validateWeights = (weights: ScoringWeights) => {
      const sum = weights.relevance + weights.popularity + weights.recency + weights.personalization
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error('权重总和必须等于1.0')
      }
    }

    validateWeights(config.controlWeights)
    validateWeights(config.testWeights)
  }

  /**
   * 生成测试ID
   */
  private generateTestId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `abtest_${timestamp}_${random}`
  }

  /**
   * 添加到活跃测试列表
   */
  private async addToActiveTests(testId: string): Promise<void> {
    const activeTestsKey = `${this.cachePrefix}active_tests`
    await redis.sadd(activeTestsKey, testId)
  }

  /**
   * 从活跃测试列表中移除
   */
  private async removeFromActiveTests(testId: string): Promise<void> {
    const activeTestsKey = `${this.cachePrefix}active_tests`
    await redis.srem(activeTestsKey, testId)
  }

  /**
   * 清理过期测试
   */
  async cleanupExpiredTests(): Promise<void> {
    try {
      const activeTests = await this.getActiveABTests()
      const now = new Date()

      for (const test of activeTests) {
        if (now > test.endDate && test.status === 'active') {
          await this.stopABTest(test.testId, '测试时间到期', 'system')
          console.log(`自动停止过期测试: ${test.testId}`)
        }
      }
    } catch (error) {
      console.error('清理过期测试失败:', error)
    }
  }
}

export const abTestManagerService = new ABTestManagerService()