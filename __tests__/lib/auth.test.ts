import { AuthService } from '@/lib/auth'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// Mock the dependencies
jest.mock('jsonwebtoken')
jest.mock('bcryptjs')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

const mockedJwt = jwt as jest.Mocked<typeof jwt>
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      }

      mockedJwt.sign.mockReturnValue('mocked-token' as any)

      const result = AuthService.generateToken(payload)

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        { expiresIn: '24h' }
      )
      expect(result).toBe('mocked-token')
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid JWT token', () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      }

      mockedJwt.verify.mockReturnValue(payload as any)

      const result = AuthService.verifyToken('valid-token')

      expect(mockedJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret')
      expect(result).toEqual(payload)
    })

    it('should return null for invalid token', () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const result = AuthService.verifyToken('invalid-token')

      expect(result).toBeNull()
    })
  })

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as any)

      const result = await AuthService.hashPassword('plaintext-password')

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-password', 12)
      expect(result).toBe('hashed-password')
    })
  })

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as any)

      const result = await AuthService.verifyPassword('plaintext', 'hashed')

      expect(mockedBcrypt.compare).toHaveBeenCalledWith('plaintext', 'hashed')
      expect(result).toBe(true)
    })

    it('should reject an incorrect password', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as any)

      const result = await AuthService.verifyPassword('wrong', 'hashed')

      expect(result).toBe(false)
    })
  })
})