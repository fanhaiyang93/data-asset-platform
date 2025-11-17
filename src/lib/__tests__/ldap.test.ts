/**
 * LDAP服务测试
 * 测试LDAP用户目录集成功能
 */

import { LDAPService } from '../ldap'

// Mock ldapjs
const mockLdapClient = {
  bind: jest.fn(),
  search: jest.fn(),
  unbind: jest.fn(),
  on: jest.fn()
}

jest.mock('ldapjs', () => ({
  createClient: jest.fn(() => mockLdapClient)
}))

describe('LDAPService', () => {
  let ldapService: LDAPService

  beforeEach(() => {
    jest.clearAllMocks()
    ldapService = new LDAPService({
      url: 'ldap://test.example.com:389',
      baseDn: 'dc=test,dc=example,dc=com',
      bindDn: 'cn=admin,dc=test,dc=example,dc=com',
      bindPassword: 'test-password',
      userFilter: '(objectClass=person)'
    })
  })

  describe('连接管理', () => {
    test('应该能够成功连接LDAP服务器', async () => {
      mockLdapClient.bind.mockImplementation((dn, password, callback) => {
        callback(null)
      })

      const result = await ldapService.connect()
      expect(result).toBe(true)
      expect(mockLdapClient.bind).toHaveBeenCalledWith(
        'cn=admin,dc=test,dc=example,dc=com',
        'test-password',
        expect.any(Function)
      )
    })

    test('连接失败时应该返回false', async () => {
      mockLdapClient.bind.mockImplementation((dn, password, callback) => {
        callback(new Error('Connection failed'))
      })

      const result = await ldapService.connect()
      expect(result).toBe(false)
    })

    test('应该能够断开连接', async () => {
      mockLdapClient.unbind.mockImplementation((callback) => {
        callback(null)
      })

      await ldapService.disconnect()
      expect(mockLdapClient.unbind).toHaveBeenCalled()
    })
  })

  describe('用户搜索', () => {
    test('应该能够搜索用户', async () => {
      const mockSearchResults = [
        {
          dn: 'cn=John Doe,ou=users,dc=test,dc=example,dc=com',
          attributes: [
            { type: 'cn', values: ['John Doe'] },
            { type: 'mail', values: ['john.doe@example.com'] },
            { type: 'department', values: ['Engineering'] },
            { type: 'employeeNumber', values: ['12345'] }
          ]
        }
      ]

      mockLdapClient.search.mockImplementation((baseDn, options, callback) => {
        const mockSearchObject = {
          on: jest.fn((event, handler) => {
            if (event === 'searchEntry') {
              mockSearchResults.forEach(entry => handler({ object: entry }))
            } else if (event === 'end') {
              handler({ status: 0 })
            }
          })
        }
        callback(null, mockSearchObject)
      })

      const users = await ldapService.searchUsers('john.doe')

      expect(users).toHaveLength(1)
      expect(users[0]).toEqual({
        dn: 'cn=John Doe,ou=users,dc=test,dc=example,dc=com',
        cn: 'John Doe',
        mail: 'john.doe@example.com',
        department: 'Engineering',
        employeeNumber: '12345'
      })
    })

    test('搜索失败时应该返回空数组', async () => {
      mockLdapClient.search.mockImplementation((baseDn, options, callback) => {
        callback(new Error('Search failed'))
      })

      const users = await ldapService.searchUsers('nonexistent')
      expect(users).toEqual([])
    })

    test('应该能够根据邮箱搜索用户', async () => {
      const mockUser = {
        dn: 'cn=Jane Smith,ou=users,dc=test,dc=example,dc=com',
        attributes: [
          { type: 'cn', values: ['Jane Smith'] },
          { type: 'mail', values: ['jane.smith@example.com'] },
          { type: 'department', values: ['Marketing'] }
        ]
      }

      mockLdapClient.search.mockImplementation((baseDn, options, callback) => {
        expect(options.filter).toContain('mail=jane.smith@example.com')

        const mockSearchObject = {
          on: jest.fn((event, handler) => {
            if (event === 'searchEntry') {
              handler({ object: mockUser })
            } else if (event === 'end') {
              handler({ status: 0 })
            }
          })
        }
        callback(null, mockSearchObject)
      })

      const user = await ldapService.findUserByEmail('jane.smith@example.com')

      expect(user).toEqual({
        dn: 'cn=Jane Smith,ou=users,dc=test,dc=example,dc=com',
        cn: 'Jane Smith',
        mail: 'jane.smith@example.com',
        department: 'Marketing'
      })
    })
  })

  describe('用户验证', () => {
    test('应该能够验证用户凭据', async () => {
      mockLdapClient.bind.mockImplementation((dn, password, callback) => {
        if (dn === 'cn=John Doe,ou=users,dc=test,dc=example,dc=com' && password === 'correct-password') {
          callback(null)
        } else {
          callback(new Error('Invalid credentials'))
        }
      })

      const result = await ldapService.authenticateUser(
        'cn=John Doe,ou=users,dc=test,dc=example,dc=com',
        'correct-password'
      )

      expect(result).toBe(true)
    })

    test('错误密码应该验证失败', async () => {
      mockLdapClient.bind.mockImplementation((dn, password, callback) => {
        callback(new Error('Invalid credentials'))
      })

      const result = await ldapService.authenticateUser(
        'cn=John Doe,ou=users,dc=test,dc=example,dc=com',
        'wrong-password'
      )

      expect(result).toBe(false)
    })
  })

  describe('用户同步', () => {
    test('应该能够获取所有用户进行同步', async () => {
      const mockUsers = [
        {
          dn: 'cn=User1,ou=users,dc=test,dc=example,dc=com',
          attributes: [
            { type: 'cn', values: ['User One'] },
            { type: 'mail', values: ['user1@example.com'] },
            { type: 'department', values: ['IT'] }
          ]
        },
        {
          dn: 'cn=User2,ou=users,dc=test,dc=example,dc=com',
          attributes: [
            { type: 'cn', values: ['User Two'] },
            { type: 'mail', values: ['user2@example.com'] },
            { type: 'department', values: ['HR'] }
          ]
        }
      ]

      mockLdapClient.search.mockImplementation((baseDn, options, callback) => {
        const mockSearchObject = {
          on: jest.fn((event, handler) => {
            if (event === 'searchEntry') {
              mockUsers.forEach(user => handler({ object: user }))
            } else if (event === 'end') {
              handler({ status: 0 })
            }
          })
        }
        callback(null, mockSearchObject)
      })

      const users = await ldapService.getAllUsers()

      expect(users).toHaveLength(2)
      expect(users[0].cn).toBe('User One')
      expect(users[1].cn).toBe('User Two')
    })

    test('应该能够检测自上次同步以来的用户变更', async () => {
      const lastSyncTime = new Date('2023-01-01T00:00:00Z')

      mockLdapClient.search.mockImplementation((baseDn, options, callback) => {
        // 验证过滤器包含修改时间条件
        expect(options.filter).toContain('modifyTimestamp>=20230101000000Z')

        const mockSearchObject = {
          on: jest.fn((event, handler) => {
            if (event === 'searchEntry') {
              handler({
                object: {
                  dn: 'cn=Updated User,ou=users,dc=test,dc=example,dc=com',
                  attributes: [
                    { type: 'cn', values: ['Updated User'] },
                    { type: 'mail', values: ['updated@example.com'] },
                    { type: 'modifyTimestamp', values: ['20230201120000Z'] }
                  ]
                }
              })
            } else if (event === 'end') {
              handler({ status: 0 })
            }
          })
        }
        callback(null, mockSearchObject)
      })

      const changedUsers = await ldapService.getChangedUsersSince(lastSyncTime)

      expect(changedUsers).toHaveLength(1)
      expect(changedUsers[0].cn).toBe('Updated User')
    })
  })

  describe('错误处理', () => {
    test('网络错误应该被正确处理', async () => {
      mockLdapClient.bind.mockImplementation((dn, password, callback) => {
        callback(new Error('ECONNREFUSED'))
      })

      const result = await ldapService.connect()
      expect(result).toBe(false)
    })

    test('超时错误应该被正确处理', async () => {
      mockLdapClient.search.mockImplementation((baseDn, options, callback) => {
        setTimeout(() => {
          callback(new Error('Timeout'))
        }, 100)
      })

      const users = await ldapService.searchUsers('test', 50) // 50ms timeout
      expect(users).toEqual([])
    })
  })

  describe('配置验证', () => {
    test('无效配置应该抛出错误', () => {
      expect(() => {
        new LDAPService({
          url: '',
          baseDn: '',
          bindDn: '',
          bindPassword: ''
        })
      }).toThrow('LDAP configuration is invalid')
    })

    test('有效配置应该创建服务实例', () => {
      const service = new LDAPService({
        url: 'ldap://valid.example.com:389',
        baseDn: 'dc=valid,dc=example,dc=com',
        bindDn: 'cn=admin,dc=valid,dc=example,dc=com',
        bindPassword: 'valid-password'
      })

      expect(service).toBeInstanceOf(LDAPService)
    })
  })
})