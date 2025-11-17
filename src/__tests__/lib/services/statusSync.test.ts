import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { StatusSyncService, getStatusSyncService, resetStatusSyncService } from '../statusSync'
import { ApplicationStatus } from '@prisma/client'

// Mock WebSocket
class MockWebSocket {
  readyState = 1 // OPEN
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {}

  send(data: string) {
    // Mock send method
  }

  close() {
    this.readyState = 3 // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any

// Mock fetch
global.fetch = vi.fn()

describe('StatusSyncService', () => {
  let service: StatusSyncService

  beforeEach(() => {
    service = new StatusSyncService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.destroy()
    resetStatusSyncService()
  })

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const service = new StatusSyncService()
      expect(service).toBeInstanceOf(StatusSyncService)
    })

    it('should accept custom config', () => {
      const config = {
        wsUrl: 'ws://custom.example.com',
        heartbeatInterval: 60000,
        maxReconnectAttempts: 10,
        reconnectDelay: 2000,
        httpFallbackInterval: 20000
      }

      const service = new StatusSyncService(config)
      expect(service).toBeInstanceOf(StatusSyncService)
    })
  })

  describe('WebSocket connection', () => {
    it('should connect to WebSocket on initialize', () => {
      const connectSpy = vi.spyOn(service as any, 'connectWebSocket')

      service.initialize()

      expect(connectSpy).toHaveBeenCalled()
    })

    it('should handle connection open event', () => {
      const service = new StatusSyncService()
      const emitSpy = vi.spyOn(service, 'emit')

      service.initialize()

      // Simulate WebSocket open
      const ws = (service as any).ws
      if (ws && ws.onopen) {
        ws.onopen(new Event('open'))
      }

      expect(emitSpy).toHaveBeenCalledWith('connection_change', { isConnected: true })
    })

    it('should handle connection close event and attempt reconnect', async () => {
      const service = new StatusSyncService()
      const reconnectSpy = vi.spyOn(service as any, 'scheduleReconnect')

      service.initialize()

      // Simulate WebSocket close
      const ws = (service as any).ws
      if (ws && ws.onclose) {
        ws.onclose(new CloseEvent('close'))
      }

      expect(reconnectSpy).toHaveBeenCalled()
    })

    it('should handle WebSocket message', () => {
      const service = new StatusSyncService()
      const emitSpy = vi.spyOn(service, 'emit')

      service.initialize()

      const mockMessage = {
        type: 'status_update',
        data: {
          applicationId: 'app-1',
          newStatus: 'APPROVED' as ApplicationStatus,
          oldStatus: 'PENDING' as ApplicationStatus,
          timestamp: new Date().toISOString()
        }
      }

      // Simulate WebSocket message
      const ws = (service as any).ws
      if (ws && ws.onmessage) {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(mockMessage)
        })
        ws.onmessage(messageEvent)
      }

      expect(emitSpy).toHaveBeenCalledWith('status_updated', mockMessage.data)
    })
  })

  describe('subscription management', () => {
    it('should subscribe to application updates', () => {
      const service = new StatusSyncService()
      const sendSpy = vi.spyOn(service as any, 'sendMessage')

      service.initialize()
      service.subscribeToApplication('app-1')

      expect(sendSpy).toHaveBeenCalledWith({
        type: 'subscribe',
        applicationId: 'app-1'
      })
    })

    it('should unsubscribe from application updates', () => {
      const service = new StatusSyncService()
      const sendSpy = vi.spyOn(service as any, 'sendMessage')

      service.initialize()
      service.subscribeToApplication('app-1')
      service.unsubscribeFromApplication('app-1')

      expect(sendSpy).toHaveBeenCalledWith({
        type: 'unsubscribe',
        applicationId: 'app-1'
      })
    })

    it('should track subscribed applications', () => {
      const service = new StatusSyncService()

      service.subscribeToApplication('app-1')
      service.subscribeToApplication('app-2')

      const subscriptions = (service as any).subscriptions
      expect(subscriptions.has('app-1')).toBe(true)
      expect(subscriptions.has('app-2')).toBe(true)

      service.unsubscribeFromApplication('app-1')
      expect(subscriptions.has('app-1')).toBe(false)
      expect(subscriptions.has('app-2')).toBe(true)
    })
  })

  describe('HTTP fallback', () => {
    it('should use HTTP polling when WebSocket is unavailable', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          updates: [
            {
              applicationId: 'app-1',
              newStatus: 'APPROVED',
              oldStatus: 'PENDING',
              timestamp: new Date().toISOString()
            }
          ]
        })
      } as Response)

      const service = new StatusSyncService()
      service.subscribeToApplication('app-1')

      await (service as any).pollForUpdates()

      expect(mockFetch).toHaveBeenCalledWith('/api/status-updates/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationIds: ['app-1'] })
      })
    })

    it('should handle HTTP polling errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      const service = new StatusSyncService()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      service.subscribeToApplication('app-1')
      await (service as any).pollForUpdates()

      expect(consoleSpy).toHaveBeenCalledWith('HTTP polling failed:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('refresh status', () => {
    it('should refresh single application status', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          applicationId: 'app-1',
          newStatus: 'APPROVED',
          oldStatus: 'PENDING',
          timestamp: new Date().toISOString()
        })
      } as Response)

      const service = new StatusSyncService()
      const result = await service.refreshStatus('app-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/applications/app-1/status', {
        method: 'POST'
      })
      expect(result).toBeDefined()
    })

    it('should handle refresh errors', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      } as Response)

      const service = new StatusSyncService()
      const result = await service.refreshStatus('nonexistent-app')

      expect(result).toBeNull()
    })
  })

  describe('heartbeat mechanism', () => {
    it('should send heartbeat messages periodically', () => {
      vi.useFakeTimers()

      const service = new StatusSyncService({ heartbeatInterval: 5000 })
      const sendSpy = vi.spyOn(service as any, 'sendMessage')

      service.initialize()

      // Fast-forward time to trigger heartbeat
      vi.advanceTimersByTime(5000)

      expect(sendSpy).toHaveBeenCalledWith({ type: 'ping' })

      vi.useRealTimers()
    })
  })

  describe('global service instance', () => {
    it('should return same instance on multiple calls', () => {
      const service1 = getStatusSyncService()
      const service2 = getStatusSyncService()

      expect(service1).toBe(service2)
    })

    it('should create new instance after reset', () => {
      const service1 = getStatusSyncService()
      resetStatusSyncService()
      const service2 = getStatusSyncService()

      expect(service1).not.toBe(service2)
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const service = new StatusSyncService()
      service.initialize()

      const ws = (service as any).ws
      const closeSpy = ws ? vi.spyOn(ws, 'close') : null

      service.destroy()

      if (closeSpy) {
        expect(closeSpy).toHaveBeenCalled()
      }
      expect((service as any).ws).toBeNull()
    })
  })
})