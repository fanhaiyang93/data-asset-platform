import { TimeEstimationService, getTimeEstimationService, resetTimeEstimationService } from '@/lib/services/timeEstimation'
import { ApplicationStatus } from '@prisma/client'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    applicationStatusLog: {
      findMany: jest.fn(),
    },
    application: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  },
}))

// Get the mocked prisma instance
const mockPrisma = require('@/lib/prisma').prisma

describe('TimeEstimationService', () => {
  let service: TimeEstimationService

  beforeEach(() => {
    service = new TimeEstimationService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    resetTimeEstimationService()
  })

  describe('estimateCompletionTime', () => {
    const mockApplication = {
      id: 'app-1',
      status: 'PENDING' as ApplicationStatus,
      asset: {
        id: 'asset-1',
        type: 'database',
        name: 'Test Database'
      },
      submittedAt: new Date(),
      reviewedAt: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    }

    it('should return actual completion time for approved applications', async () => {
      const approvedApp = {
        ...mockApplication,
        status: 'APPROVED' as ApplicationStatus,
        reviewedAt: new Date('2024-01-15T10:00:00Z'),
      }

      const result = await service.estimateCompletionTime(approvedApp)

      expect(result.estimatedCompletionTime).toEqual(approvedApp.reviewedAt)
      expect(result.confidence).toBe(1.0)
      expect(result.baseProcessingTime).toBe(0)
      expect(result.queueDelay).toBe(0)
      expect(result.holidayAdjustment).toBe(0)
    })

    it('should return actual completion time for rejected applications', async () => {
      const rejectedApp = {
        ...mockApplication,
        status: 'REJECTED' as ApplicationStatus,
        reviewedAt: new Date('2024-01-15T14:00:00Z'),
      }

      const result = await service.estimateCompletionTime(rejectedApp)

      expect(result.estimatedCompletionTime).toEqual(rejectedApp.reviewedAt)
      expect(result.confidence).toBe(1.0)
    })

    it('should calculate estimation for pending applications', async () => {
      // Mock historical data
      mockPrisma.applicationStatusLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          application: {
            submittedAt: new Date('2024-01-01T09:00:00Z'),
            reviewedAt: new Date('2024-01-01T13:00:00Z'), // 4 hours
          },
        },
        {
          id: 'log-2',
          application: {
            submittedAt: new Date('2024-01-02T10:00:00Z'),
            reviewedAt: new Date('2024-01-02T12:00:00Z'), // 2 hours
          },
        },
      ])

      // Mock queue data
      mockPrisma.application.count.mockResolvedValue(5) // 5 pending applications
      mockPrisma.user.count.mockResolvedValue(2) // 2 active reviewers

      // Mock recent applications for historical average
      mockPrisma.application.findMany.mockResolvedValue([
        {
          submittedAt: new Date('2024-01-10T09:00:00Z'),
          reviewedAt: new Date('2024-01-10T15:00:00Z'), // 6 hours
        },
      ])

      const result = await service.estimateCompletionTime(mockApplication)

      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.baseProcessingTime).toBeGreaterThan(0)
      expect(result.estimatedCompletionTime).toBeInstanceOf(Date)
      expect(result.factors.assetType).toBe('database')
    })

    it('should handle errors gracefully and return default estimation', async () => {
      mockPrisma.applicationStatusLog.findMany.mockRejectedValue(new Error('Database error'))

      const result = await service.estimateCompletionTime(mockApplication)

      expect(result.estimatedCompletionTime).toBeInstanceOf(Date)
      expect(result.confidence).toBe(0.5)
      expect(result.baseProcessingTime).toBe(1440) // 24 hours default
    })

    it('should use default processing time when no historical data exists', async () => {
      mockPrisma.applicationStatusLog.findMany.mockResolvedValue([])
      mockPrisma.application.count.mockResolvedValue(0)
      mockPrisma.user.count.mockResolvedValue(1)
      mockPrisma.application.findMany.mockResolvedValue([])

      const result = await service.estimateCompletionTime(mockApplication)

      // Database assets default to 4 hours (240 minutes)
      expect(result.baseProcessingTime).toBe(240)
    })
  })

  describe('working day calculations', () => {
    it('should calculate working minutes correctly', () => {
      const service = new TimeEstimationService()
      const startDate = new Date('2024-01-15T09:00:00Z') // Monday 9 AM
      const endDate = new Date('2024-01-15T17:00:00Z') // Monday 5 PM

      const workingMinutes = (service as any).calculateWorkingMinutes(startDate, endDate)

      // 8 hours = 480 minutes
      expect(workingMinutes).toBe(480)
    })

    it('should skip weekends in working time calculation', () => {
      const service = new TimeEstimationService()
      const startDate = new Date('2024-01-12T17:00:00Z') // Friday 5 PM
      const endDate = new Date('2024-01-15T09:00:00Z') // Monday 9 AM

      const workingMinutes = (service as any).calculateWorkingMinutes(startDate, endDate)

      // Should be 0 as it spans a weekend
      expect(workingMinutes).toBe(0)
    })

    it('should calculate working datetime correctly', () => {
      const service = new TimeEstimationService()
      const startDate = new Date('2024-01-15T14:00:00Z') // Monday 2 PM
      const minutes = 240 // 4 hours

      const result = (service as any).calculateWorkingDateTime(startDate, minutes)

      // Should be Monday 6 PM (2 PM + 4 hours)
      expect(result.getHours()).toBe(18)
    })
  })

  describe('confidence calculation', () => {
    it('should increase confidence with historical data', () => {
      const service = new TimeEstimationService()

      const highConfidenceFactors = {
        baseProcessingTime: 120,
        queueDelay: 30, // Less than 1 hour
        reviewerWorkload: 3, // Moderate workload
        historicalAverage: 150, // Has historical data
      }

      const confidence = (service as any).calculateConfidence(highConfidenceFactors)

      expect(confidence).toBeGreaterThan(0.9)
    })

    it('should decrease confidence with high queue delay', () => {
      const service = new TimeEstimationService()

      const lowConfidenceFactors = {
        baseProcessingTime: 120,
        queueDelay: 120, // 2 hours queue delay
        reviewerWorkload: 10, // High workload
        historicalAverage: 0, // No historical data
      }

      const confidence = (service as any).calculateConfidence(lowConfidenceFactors)

      expect(confidence).toBeLessThan(0.9)
    })
  })

  describe('global service instance', () => {
    it('should return same instance on multiple calls', () => {
      const service1 = getTimeEstimationService()
      const service2 = getTimeEstimationService()

      expect(service1).toBe(service2)
    })

    it('should create new instance after reset', () => {
      const service1 = getTimeEstimationService()
      resetTimeEstimationService()
      const service2 = getTimeEstimationService()

      expect(service1).not.toBe(service2)
    })
  })
})