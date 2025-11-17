/**
 * 统一错误处理和错误类型定义
 */

// 错误代码枚举
export enum ErrorCode {
  // 认证相关错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // 权限相关错误
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ROLE_REQUIRED = 'ROLE_REQUIRED',

  // 数据相关错误
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // 系统相关错误
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

// 自定义错误类
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context

    // 保持原型链
    Object.setPrototypeOf(this, AppError.prototype)

    // 捕获错误堆栈
    Error.captureStackTrace(this, this.constructor)
  }
}

// 预定义的错误类型
export class AuthenticationError extends AppError {
  constructor(message: string = '身份验证失败', context?: Record<string, any>) {
    super(ErrorCode.UNAUTHORIZED, message, 401, true, context)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = '权限不足', context?: Record<string, any>) {
    super(ErrorCode.FORBIDDEN, message, 403, true, context)
  }
}

export class ValidationError extends AppError {
  constructor(message: string = '输入验证失败', context?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, true, context)
  }
}

export class UserNotFoundError extends AppError {
  constructor(message: string = '用户不存在', context?: Record<string, any>) {
    super(ErrorCode.USER_NOT_FOUND, message, 404, true, context)
  }
}

// 错误处理工具类
export class ErrorHandler {
  /**
   * 检查是否为可操作的错误
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational
    }
    return false
  }

  /**
   * 格式化错误信息供客户端使用
   */
  static formatErrorForClient(error: Error): {
    code: string
    message: string
    statusCode: number
    context?: Record<string, any>
  } {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        context: error.context
      }
    }

    // 对于未知错误，不暴露详细信息
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: '内部服务器错误',
      statusCode: 500
    }
  }

  /**
   * 记录错误日志
   */
  static logError(error: Error, context?: Record<string, any>): void {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context
    }

    if (error instanceof AppError) {
      errorInfo.code = error.code
      errorInfo.statusCode = error.statusCode
      errorInfo.context = error.context
    }

    // 根据错误严重程度选择日志级别
    if (error instanceof AppError && error.statusCode < 500) {
      console.warn('Application Warning:', errorInfo)
    } else {
      console.error('Application Error:', errorInfo)
    }
  }

  /**
   * 统一错误响应格式
   */
  static createErrorResponse(error: Error, requestId?: string) {
    const formattedError = this.formatErrorForClient(error)

    return {
      success: false,
      error: formattedError,
      requestId,
      timestamp: new Date().toISOString()
    }
  }
}

// 权限相关的特定错误创建函数
export const createPermissionError = (
  resource: string,
  action: string,
  userRole?: string
): AuthorizationError => {
  return new AuthorizationError(
    `权限不足：无法执行 ${resource} 的 ${action} 操作`,
    { resource, action, userRole }
  )
}

export const createTokenError = (reason: string): AuthenticationError => {
  return new AuthenticationError(
    `令牌验证失败：${reason}`,
    { reason }
  )
}

export const createRoleError = (
  requiredRoles: string[],
  currentRole?: string
): AuthorizationError => {
  return new AuthorizationError(
    `角色权限不足，需要角色：${requiredRoles.join(', ')}`,
    { requiredRoles, currentRole }
  )
}