import DOMPurify from 'dompurify'

// 内容安全配置
const SECURITY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'strike', 's',
    'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'code', 'pre', 'hr'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
}

/**
 * 清理富文本内容，防止XSS攻击
 */
export function sanitizeRichTextContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  try {
    // 配置DOMPurify
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: SECURITY_CONFIG.ALLOWED_TAGS,
      ALLOWED_ATTR: SECURITY_CONFIG.ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: SECURITY_CONFIG.ALLOWED_URI_REGEXP,
      FORBID_TAGS: SECURITY_CONFIG.FORBID_TAGS,
      FORBID_ATTR: SECURITY_CONFIG.FORBID_ATTR,

      // 保留换行和空白字符
      KEEP_CONTENT: true,

      // 移除不安全的属性值
      SANITIZE_DOM: true,

      // 移除空标签
      ALLOW_EMPTY_TAGS: false,

      // 链接安全处理
      ADD_ATTR: {
        'a': {
          'target': '_blank',
          'rel': 'noopener noreferrer'
        }
      },

      // 自定义钩子函数
      HOOK_AFTER_SANITIZE: (fragment) => {
        // 检查内容长度
        const textContent = fragment.textContent || ''
        if (textContent.length > 100000) { // 100KB限制
          throw new Error('内容长度超出限制')
        }

        return fragment
      }
    })
  } catch (error) {
    console.error('内容安全过滤失败:', error)
    // 出错时返回纯文本内容
    return content.replace(/<[^>]*>/g, '').substring(0, 1000)
  }
}

/**
 * 验证富文本内容是否安全
 */
export function validateRichTextContent(content: string): {
  isValid: boolean
  errors: string[]
  cleanContent?: string
} {
  const errors: string[] = []

  if (!content) {
    return { isValid: true, errors: [], cleanContent: '' }
  }

  // 长度检查
  const textLength = content.replace(/<[^>]*>/g, '').length
  if (textLength > 100000) {
    errors.push('内容长度不能超过100KB')
  }

  // 恶意脚本检查
  const maliciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /vbscript:/i,
    /data:text\/html/i
  ]

  maliciousPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      errors.push(`检测到不安全的内容模式 #${index + 1}`)
    }
  })

  try {
    // 尝试清理内容
    const cleanContent = sanitizeRichTextContent(content)

    return {
      isValid: errors.length === 0,
      errors,
      cleanContent
    }
  } catch (error) {
    errors.push('内容处理失败')
    return {
      isValid: false,
      errors
    }
  }
}

/**
 * 提取富文本的纯文本内容
 */
export function extractTextFromRichContent(content: string): string {
  if (!content) return ''

  try {
    // 使用DOMPurify清理内容后提取文本
    const cleanHtml = sanitizeRichTextContent(content)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = cleanHtml
    return tempDiv.textContent || tempDiv.innerText || ''
  } catch {
    // 备用方案：简单的标签移除
    return content.replace(/<[^>]*>/g, '').trim()
  }
}

/**
 * 计算富文本内容的字符数（不包括HTML标签）
 */
export function countRichTextCharacters(content: string): number {
  return extractTextFromRichContent(content).length
}

/**
 * 检查内容是否为空（忽略HTML标签）
 */
export function isRichTextEmpty(content: string): boolean {
  const textContent = extractTextFromRichContent(content)
  return !textContent || textContent.trim().length === 0
}